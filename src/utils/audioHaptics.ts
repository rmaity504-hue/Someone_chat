/**
 * Web Audio API synthesizer and Haptic feedback engine for Someone.
 *
 * Implements:
 * 1. Soft ascending chime when a partner is matched (sine/triangle tones).
 * 2. Subtle single blip when an incoming message arrives.
 * 3. Haptic feedback on supported mobile devices (vibrate API).
 * 4. User mute/unmute state management persisted in localStorage.
 *
 * Zero external MP3 or CDN asset dependencies.
 */

import { useState, useEffect } from 'react';

const MUTE_KEY = 'someone_sound_muted';

let audioCtx: AudioContext | null = null;
let isMuted = typeof window !== 'undefined' ? localStorage.getItem(MUTE_KEY) === 'true' : false;
const listeners = new Set<(muted: boolean) => void>();

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!audioCtx) {
      audioCtx = new AudioCtx();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch (err) {
    console.warn('[Audio] Failed to initialize AudioContext:', err);
    return null;
  }
}

export function isSoundMuted(): boolean {
  return isMuted;
}

export function setSoundMuted(muted: boolean): void {
  isMuted = muted;
  if (typeof window !== 'undefined') {
    localStorage.setItem(MUTE_KEY, muted ? 'true' : 'false');
  }
  listeners.forEach((fn) => fn(muted));
}

export function toggleSoundMuted(): boolean {
  const next = !isMuted;
  setSoundMuted(next);
  return next;
}

export function onSoundMuteChange(handler: (muted: boolean) => void): () => void {
  listeners.add(handler);
  handler(isMuted);
  return () => {
    listeners.delete(handler);
  };
}

/**
 * Ascending chime synthesized with Web Audio API for match found:
 * 3 harmonious notes (C5 -> E5 -> G5) with silky exponential decay.
 */
export function playMatchChime(): void {
  // Trigger match haptics on mobile
  triggerMatchHaptic();

  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const notes = [
      { freq: 523.25, time: now },        // C5
      { freq: 659.25, time: now + 0.11 }, // E5
      { freq: 783.99, time: now + 0.22 }, // G5
    ];

    notes.forEach(({ freq, time }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);

      // Smooth attack & soft exponential decay
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(0.12, time + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(time);
      osc.stop(time + 0.3);
    });
  } catch (err) {
    console.warn('[Audio] Error playing match chime:', err);
  }
}

/**
 * Subtle single blip synthesized with Web Audio API for incoming message:
 * Clean 680Hz sine tone with rapid 75ms decay.
 */
export function playMessageBlip(): void {
  // Trigger message haptic on mobile
  triggerMessageHaptic();

  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(680, now);

    // Warm, unobtrusive blip
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.09, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.085);
  } catch (err) {
    console.warn('[Audio] Error playing message blip:', err);
  }
}

/**
 * Mobile haptic pulse for incoming message (40ms)
 */
export function triggerMessageHaptic(): void {
  if (isMuted) return;
  if (typeof window !== 'undefined' && 'navigator' in window && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(40);
    } catch {
      // ignore
    }
  }
}

/**
 * Mobile haptic pattern for partner match ([30, 50, 30]ms)
 */
export function triggerMatchHaptic(): void {
  if (isMuted) return;
  if (typeof window !== 'undefined' && 'navigator' in window && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate([30, 50, 30]);
    } catch {
      // ignore
    }
  }
}

export function useSoundMute() {
  const [muted, setMuted] = useState(isSoundMuted());
  useEffect(() => {
    return onSoundMuteChange(setMuted);
  }, []);
  return { muted, isMuted: muted, toggleMute: toggleSoundMuted, setMuted: setSoundMuted };
}

