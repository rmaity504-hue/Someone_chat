import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import webpush from 'web-push';
import { db } from './db.js';
import { PushSubscriptionRecord, PushSubscriptionData } from '../src/types.js';
import { VAPID_CONFIG } from './config.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const VAPID_FILE = path.join(DATA_DIR, 'vapid.json');

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

let vapidKeys: VapidKeys;

function initVapid(): VapidKeys {
  const envPublic = process.env.VAPID_PUBLIC_KEY;
  const envPrivate = process.env.VAPID_PRIVATE_KEY;

  if (envPublic && envPrivate) {
    vapidKeys = {
      publicKey: envPublic.trim(),
      privateKey: envPrivate.trim(),
    };
  } else {
    // Check if stored in data/vapid.json
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(VAPID_FILE)) {
        const raw = fs.readFileSync(VAPID_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.publicKey && parsed.privateKey) {
          vapidKeys = {
            publicKey: parsed.publicKey,
            privateKey: parsed.privateKey,
          };
        }
      }
    } catch (err) {
      console.warn('[PUSH] Error checking existing VAPID file:', err);
    }

    // If still not available from file, use standard configured VAPID keypair
    if (!vapidKeys) {
      vapidKeys = {
        publicKey:
          process.env.VAPID_PUBLIC_KEY ||
          'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuNkr3qBUYhHBQFLXYp5Nksh8U',
        privateKey:
          process.env.VAPID_PRIVATE_KEY ||
          'UUxI4Ovh-mcv0ZsITx-n8v6Z_h_R9i2P0x1e3Q5a7sU',
      };

      try {
        if (!fs.existsSync(DATA_DIR)) {
          fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        fs.writeFileSync(VAPID_FILE, JSON.stringify(vapidKeys, null, 2), 'utf-8');
        console.log('[PUSH] VAPID keys saved to data/vapid.json');
      } catch (err) {
        console.error('[PUSH] Failed to save VAPID keys to disk:', err);
      }
    }
  }

  const subject = process.env.VAPID_SUBJECT || 'mailto:someone.chat.app@gmail.com';
  const publicKey =
    process.env.VAPID_PUBLIC_KEY ||
    'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuNkr3qBUYhHBQFLXYp5Nksh8U';
  const privateKey =
    process.env.VAPID_PRIVATE_KEY ||
    'UUxI4Ovh-mcv0ZsITx-n8v6Z_h_R9i2P0x1e3Q5a7sU';

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidKeys = { publicKey, privateKey };
    console.log('[PUSH] Web Push configured with VAPID Subject:', subject);
  } catch (err) {
    console.error('[PUSH] Error setting VAPID details:', err);
  }

  return vapidKeys;
}

// Initialize on load
initVapid();

export function getVapidPublicKey(): string {
  if (!vapidKeys) {
    initVapid();
  }
  return vapidKeys.publicKey;
}

export function savePushSubscription(
  subData: PushSubscriptionData,
  userId?: string | null,
  role?: string
): PushSubscriptionRecord {
  const existingSubs = db.getPushSubscriptions();
  const existing = existingSubs.find((s) => s.endpoint === subData.endpoint);

  const subRecord: PushSubscriptionRecord = {
    id: existing ? existing.id : 'sub_' + crypto.randomBytes(8).toString('hex'),
    userId: userId || existing?.userId || null,
    endpoint: subData.endpoint,
    keys: {
      p256dh: subData.keys.p256dh,
      auth: subData.keys.auth,
    },
    role: role || existing?.role || 'listener',
    createdAt: existing ? existing.createdAt : Date.now(),
    updatedAt: Date.now(),
  };

  db.savePushSubscription(subRecord);
  console.log(`[PUSH] Saved push subscription (${subRecord.id}) for user ${userId || 'anonymous listener'}`);
  return subRecord;
}

export function deletePushSubscription(endpoint: string): void {
  db.deletePushSubscription(endpoint);
  console.log(`[PUSH] Removed push subscription for endpoint: ${endpoint.slice(0, 35)}...`);
}

// Cooldown tracking per subscription/user to prevent notification bursts
// Maps endpoint -> timestamp of last notification sent
const notificationCooldowns: Map<string, number> = new Map();
const COOLDOWN_MS = 60 * 1000; // 60 seconds minimum cooldown per device

export interface PushNotificationPayload {
  title: string;
  body: string;
  url: string;
}

export async function sendNotificationToSubscription(
  sub: PushSubscriptionRecord,
  payload: PushNotificationPayload
): Promise<boolean> {
  const pushSubscription = {
    endpoint: sub.endpoint,
    keys: {
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    },
  };

  try {
    await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
    notificationCooldowns.set(sub.endpoint, Date.now());
    return true;
  } catch (err: any) {
    console.error(`[PUSH] Failed to send push to ${sub.endpoint.slice(0, 35)}...:`, err?.message || err);

    // 404 or 410 means the subscription is no longer valid/expired
    if (err?.statusCode === 404 || err?.statusCode === 410) {
      console.log(`[PUSH] Subscription expired or unsubscribed (${err.statusCode}). Removing subscription.`);
      deletePushSubscription(sub.endpoint);
    }
    return false;
  }
}

/**
 * Triggers Web Push Notification to active listeners/admins who are disconnected or backgrounded
 * when a user enters the queue.
 */
export async function notifyActiveListenersWhenQueueEnters(
  waitingUserId: string,
  connectedClientIds: Set<string> | Map<string, any>
): Promise<number> {
  const now = Date.now();
  const allSubs = db.getPushSubscriptions();
  if (allSubs.length === 0) {
    return 0;
  }

  // Identify eligible listeners and admins:
  // 1. All users in DB who are volunteers or staff
  const allUsers = db.getAllUsersList();
  const activeListenerUserIds = new Set<string>();

  for (const user of allUsers) {
    // Admin, moderator, or volunteer listener
    if (user.role === 'admin' || user.role === 'moderator' || (user.isVolunteer && user.volunteerActive)) {
      activeListenerUserIds.add(user.id);
    }
  }

  const payload: PushNotificationPayload = {
    title: 'Someone is awake',
    body: 'A visitor is waiting to talk. Tap to enter the conversation.',
    url: '/chat',
  };

  let sentCount = 0;

  for (const sub of allSubs) {
    // Exclude the user who is actually waiting in the queue
    if (sub.userId && sub.userId === waitingUserId) {
      continue;
    }

    // If subscription is linked to a user, check if they are an active listener/admin
    const isTargetRole = sub.role === 'admin' || sub.role === 'volunteer' || sub.role === 'listener';
    const isTargetUser = sub.userId ? activeListenerUserIds.has(sub.userId) : false;

    if (!isTargetRole && !isTargetUser) {
      continue;
    }

    // Check if user is currently connected to WebSocket
    // "if an active listener is registered but their WebSocket is disconnected/backgrounded"
    const isConnected = sub.userId ? connectedClientIds.has(sub.userId) : false;
    if (isConnected) {
      // Listener is already active in the foreground on WebSocket
      continue;
    }

    // Check cooldown
    const lastSent = notificationCooldowns.get(sub.endpoint) || 0;
    if (now - lastSent < COOLDOWN_MS) {
      continue;
    }

    const success = await sendNotificationToSubscription(sub, payload);
    if (success) {
      sentCount++;
    }
  }

  if (sentCount > 0) {
    console.log(`[PUSH] Triggered queue entry push notification to ${sentCount} disconnected listener(s).`);
  }

  return sentCount;
}
