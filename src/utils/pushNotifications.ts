// Client-side Web Push Notification Manager

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  // Strip all whitespaces, newlines, carriage returns
  const cleanKey = base64String.replace(/\s+/g, '');
  const padding = '='.repeat((4 - (cleanKey.length % 4)) % 4);
  const base64 = (cleanKey + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Fallback constant so it NEVER fails if the API returns empty/undefined
export const HARDCODED_PUBLIC_KEY = 'BMzvZylzxhzL7LmFSW7Swj7GGariKK7WAWbk-Q2ESt1apjR2Ek9Rb1tfLSwoli3ww4IUfIlR1-VWATH1tAFJCBw';

export async function subscribeUserToPush(registration: ServiceWorkerRegistration): Promise<PushSubscription> {
  let publicKey = HARDCODED_PUBLIC_KEY;

  try {
    const res = await fetch('/api/push/vapid-public-key');
    if (res.ok) {
      const data = await res.json();
      if (data.publicKey && typeof data.publicKey === 'string' && data.publicKey.replace(/\s+/g, '').length > 20) {
        publicKey = data.publicKey.replace(/\s+/g, '');
      }
    }
  } catch (err) {
    console.warn('Using hardcoded VAPID public key fallback:', err);
  }

  // Convert key
  const applicationServerKey = urlBase64ToUint8Array(publicKey);

  // Subscribe
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });

  // Send to backend
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription),
  });

  return subscription;
}

export interface PushStatus {
  isSupported: boolean;
  permission: NotificationPermission | 'unsupported';
  isSubscribed: boolean;
}

export async function checkPushSubscriptionStatus(): Promise<PushStatus> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return {
      isSupported: false,
      permission: 'unsupported',
      isSubscribed: false,
    };
  }

  const permission = Notification.permission;
  if (permission !== 'granted') {
    return {
      isSupported: true,
      permission,
      isSubscribed: false,
    };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return {
      isSupported: true,
      permission,
      isSubscribed: Boolean(subscription),
    };
  } catch (err) {
    console.warn('[PUSH CLIENT] Error inspecting subscription:', err);
    return {
      isSupported: true,
      permission,
      isSubscribed: false,
    };
  }
}

export async function subscribeToPushNotifications(
  authToken?: string | null,
  role?: string
): Promise<{ success: boolean; error?: string }> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return { success: false, error: 'Push notifications are not supported by this browser.' };
  }

  try {
    // 1. Request user permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, error: 'Device notification permission was denied or closed.' };
    }

    // 2. Fetch server VAPID public key with hardcoded fallback
    let publicKey = HARDCODED_PUBLIC_KEY;
    try {
      const res = await fetch('/api/push/vapid-public-key');
      if (res.ok) {
        const data = await res.json();
        if (data.publicKey && typeof data.publicKey === 'string' && data.publicKey.trim().length > 20) {
          publicKey = data.publicKey.trim();
        }
      }
    } catch (err) {
      console.warn('Using hardcoded VAPID public key fallback:', err);
    }

    // 3. Register / get service worker registration
    const registration = await navigator.serviceWorker.ready;

    // 4. Retrieve existing or create new subscription
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const applicationServerKey = urlBase64ToUint8Array(publicKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    }

    // 5. Save to backend database
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const subRes = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        role: role || 'listener',
      }),
    });

    if (!subRes.ok) {
      const errData = await subRes.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to save subscription on server');
    }

    return { success: true };
  } catch (err: any) {
    console.error('[PUSH CLIENT] Subscription error:', err);
    const diagnosticMsg = err?.message || String(err);
    return {
      success: false,
      error: `Subscription error: ${diagnosticMsg}`,
    };
  }
}

export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await fetch('/api/notifications/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      }).catch(() => {});

      await subscription.unsubscribe();
      return true;
    }
  } catch (err) {
    console.error('[PUSH CLIENT] Unsubscribe error:', err);
  }
  return false;
}

export async function sendTestPushNotification(authToken: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/notifications/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { success: false, error: data.error || 'Failed to send test push notification.' };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error while testing notification.' };
  }
}
