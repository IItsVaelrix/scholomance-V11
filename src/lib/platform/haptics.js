/**
 * Unified Haptics Engine — Scholomance V11
 *
 * Provides cross-medium tactile feedback (Mobile, Steam Deck, Gamepads).
 * Gracefully degrades if the device or browser is not capable.
 */

const IS_HANDHELD_HAPTICS_SUPPORTED = typeof navigator !== 'undefined' && 'vibrate' in navigator;
const IS_GAMEPAD_HAPTICS_SUPPORTED = typeof navigator !== 'undefined' && 'getGamepads' in navigator;

/**
 * Triggers a discrete haptic pulse on available hardware.
 * @param {Object} options
 * @param {number|number[]} options.duration - Duration in ms or pattern array (default 10)
 * @param {number} options.intensity - Strength 0.0 to 1.0 (Gamepad only, default 0.5)
 */
export async function triggerHapticPulse({ duration = 10, intensity = 0.5 } = {}) {
  // Normalize duration - use first element if array, sum if pattern
  const durationMs = Array.isArray(duration) ? duration.reduce((a, b) => a + b, 0) : duration;

  // 1. Mobile / Web Standard (Vibration API) - supports patterns
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(duration);
    } catch (e) {
      // Silent fail - likely missing permission or hardware
    }
  }

  // 2. Handhelds / Controllers (Gamepad API) - only supports single duration
  if (typeof navigator !== 'undefined' && 'getGamepads' in navigator) {
    try {
      const gamepads = navigator.getGamepads();
      if (!gamepads) return;
      
      for (const gp of gamepads) {
        if (!gp || !gp.connected) continue;

        // Modern vibrationEffect (Chromium / Steam Deck / Handhelds)
        if (gp.vibrationEffect?.playEffect) {
          // Fire and forget - don't await so UI remains responsive
          gp.vibrationEffect.playEffect('dual-rumble', {
            startDelay: 0,
            duration: durationMs,
            weakMagnitude: intensity,
            strongMagnitude: intensity,
          });
        }
        // Legacy/Alternative hapticActuators (Firefox / Safari / Some drivers)
        else if (gp.hapticActuators?.length > 0) {
          for (const actuator of gp.hapticActuators) {
            if (actuator && actuator.pulse) {
              actuator.pulse(intensity, durationMs);
            }
          }
        }
      }
    } catch (e) {
      // Silent fail
    }
  }
}

/**
 * Pre-defined haptic "weights" and waveforms for common UI interactions.
 * Waveforms use [pulse, gap, pulse] arrays for supported devices.
 */
export const UI_HAPTICS = {
  TICK: { duration: 5, intensity: 0.2 },           // Precise, subtle "tick"
  LIGHT: { duration: 10, intensity: 0.4 },         // standard confirmation
  MEDIUM: { duration: [15, 20, 15], intensity: 0.6 }, // The "Weight" signature
  HEAVY: { duration: [30, 40, 30], intensity: 0.8 },  // Heavy mechanical feel
  SUCCESS: { duration: [10, 40, 10, 20, 40], intensity: 0.7 }, // Confirmed/Success "bloom"
  ERROR: { duration: [60, 60, 60, 60], intensity: 0.9 },      // Sharp "Warning" stutter
};
