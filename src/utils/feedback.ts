/**
 * Web Audio API synthesizer and tactile haptic feedback engine for Someone.
 * Adheres strictly to browser autoplay policies with lazy AudioContext initialization.
 *
 * Implements:
 * 1. MATCH SOUND (playMatchChime): Gentle, warm two-tone acoustic chime (440 Hz -> 659.25 Hz over 0.8s) + haptic [40, 60, 40]
 * 2. MESSAGE INCOMING SOUND (playMessageSound): Subtle woodblock/drop tick (587.33 Hz fading over 0.15s) + haptic 30ms
 * 3. ERROR/DISCONNECT SOUND (playDisconnectSound): Low, soft descender (330 Hz -> 220 Hz over 0.3s) + haptic [60]
 * 4. User mute preference persisted in localStorage ('someone_sound_muted')
 * 5. Safe Web Audio node disconnection and cleanup on completion
 */

import { useState, useEffect } from 'react';

const MUTE_KEY = 'someone_sound_muted';

let audioCtx: AudioContext | null = null;
let isMuted = typeof window !== 'undefined' ? localStorage.getItem(MUTE_KEY) === 'true' : false;
const listeners = new Set<(muted: boolean) => void>();

// Debounce match chimes and disconnect sounds if multiple events arrive closely
let lastMatchChimeTime = 0;
let lastDisconnectSoundTime = 0;

/**
 * Lazy AudioContext initialization respecting browser autoplay policies
 */
export function getAudioContext(): AudioContext | null {
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

// Unlock audio context on initial user gesture
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  };
  ['click', 'keydown', 'touchstart'].forEach((evt) => {
    window.addEventListener(evt, unlockAudio, { capture: true, passive: true });
  });
}

export function isSoundMuted(): boolean {
  return isMuted;
}

export function setSoundMuted(muted: boolean): void {
  isMuted = muted;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(MUTE_KEY, muted ? 'true' : 'false');
    } catch {
      // ignore storage errors
    }
  }
  listeners.forEach((fn) => {
    try {
      fn(muted);
    } catch {}
  });
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
 * Haptic helpers using navigator.vibrate
 */
export function triggerMatchHaptic(): void {
  if (isMuted) return;
  if (typeof window !== 'undefined' && 'navigator' in window && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate([40, 60, 40]);
    } catch {}
  }
}

export function triggerMessageHaptic(): void {
  if (isMuted) return;
  if (typeof window !== 'undefined' && 'navigator' in window && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(30);
    } catch {}
  }
}

export function triggerDisconnectHaptic(): void {
  if (isMuted) return;
  if (typeof window !== 'undefined' && 'navigator' in window && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate([60]);
    } catch {}
  }
}

/**
 * MATCH SOUND (playMatchChime):
 * A gentle, warm two-tone acoustic chime (Sine wave from 440 Hz (A4) transitioning to 659.25 Hz (E5)
 * with exponential decay over 0.8 seconds).
 * Haptic: navigator.vibrate?.([40, 60, 40])
 */
export function playMatchChime(): void {
  const nowMs = Date.now();
  if (nowMs - lastMatchChimeTime < 800) {
    return;
  }
  lastMatchChimeTime = nowMs;

  triggerMatchHaptic();

  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Two-tone transition: 440 Hz (A4) transitioning up to 659.25 Hz (E5)
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.28);

    // Warm envelope with silky exponential decay over 0.8 seconds
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);

    osc.connect(gain);
    gain.connect(ctx.destination);

    // Explicit cleanup of nodes on completion
    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {}
    };

    osc.start(now);
    osc.stop(now + 0.82);
  } catch (err) {
    console.warn('[Audio] Error playing match chime:', err);
  }
}

/**
 * MESSAGE INCOMING SOUND (playMessageSound):
 * A short, subtle "drop" or "woodblock" tick (Sine wave at 587.33 Hz fading out over 0.15 seconds).
 * Haptic: navigator.vibrate?.(30)
 */
export function playMessageSound(): void {
  triggerMessageHaptic();

  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now);

    // Short subtle woodblock tick fading out over 0.15 seconds
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    // Explicit cleanup of nodes on completion
    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {}
    };

    osc.start(now);
    osc.stop(now + 0.16);
  } catch (err) {
    console.warn('[Audio] Error playing message sound:', err);
  }
}

// Backwards-compatible alias for existing imports
export const playMessageBlip = playMessageSound;

/**
 * ERROR/DISCONNECT SOUND (playDisconnectSound):
 * A low, soft descender (330 Hz down to 220 Hz over 0.3 seconds) to gently indicate
 * that the stranger has left.
 * Haptic: navigator.vibrate?.([60])
 */
export function playDisconnectSound(): void {
  const nowMs = Date.now();
  if (nowMs - lastDisconnectSoundTime < 500) {
    return;
  }
  lastDisconnectSoundTime = nowMs;

  triggerDisconnectHaptic();

  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Gentle descender from 330 Hz down to 220 Hz
    osc.frequency.setValueAtTime(330, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.28);

    // Soft fade out over 0.3s
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.10, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.30);

    osc.connect(gain);
    gain.connect(ctx.destination);

    // Explicit cleanup of nodes on completion
    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {}
    };

    osc.start(now);
    osc.stop(now + 0.32);
  } catch (err) {
    console.warn('[Audio] Error playing disconnect sound:', err);
  }
}

/**
 * React hook for subscribing to sound mute state and toggling
 */
export function useSoundMute() {
  const [muted, setMuted] = useState<boolean>(isSoundMuted());

  useEffect(() => {
    return onSoundMuteChange(setMuted);
  }, []);

  return {
    muted,
    isMuted: muted,
    toggleMute: toggleSoundMuted,
    setMuted: setSoundMuted,
  };
}
