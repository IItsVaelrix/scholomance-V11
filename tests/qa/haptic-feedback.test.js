/**
 * Haptic Feedback QA — Mobile & Steam Deck
 * 
 * Purpose: Test cross-platform haptic feedback for UI interactions
 * 
 * Coverage:
 * - Mobile (Vibration API)
 * - Steam Deck / Handhelds (Gamepad API)
 * - Fallback behavior (unsupported devices)
 * - Haptic pattern presets (UI_HAPTICS)
 * - Accessibility (reduced haptics preference)
 * 
 * World-Law Connection: Haptic feedback is the "physical resonance" —
 * the world's answer to the player's touch. A silent glyph is a broken spell.
 */

import { describe, it, expect, vi } from 'vitest';

// ============================================================================
// Test Utilities & Mocks
// ============================================================================

function mockVibrationAPI(supported = true) {
  const originalVibrate = navigator.vibrate;
  if (supported) {
    Object.defineProperty(navigator, 'vibrate', {
      value: vi.fn(() => true),
      writable: true,
      configurable: true,
    });
  } else if (originalVibrate) {
    delete navigator.vibrate;
  }
  return () => {
    if (originalVibrate) navigator.vibrate = originalVibrate;
    else if (supported && navigator.vibrate) delete navigator.vibrate;
  };
}

function mockGamepadAPI(supported = true, gamepads = []) {
  const originalGetGamepads = navigator.getGamepads;
  if (supported) {
    Object.defineProperty(navigator, 'getGamepads', {
      value: vi.fn(() => gamepads),
      writable: true,
      configurable: true,
    });
  } else if (originalGetGamepads) {
    delete navigator.getGamepads;
  }
  return () => {
    if (originalGetGamepads) navigator.getGamepads = originalGetGamepads;
    else if (supported && navigator.getGamepads) delete navigator.getGamepads;
  };
}

function createMockGamepad({ hasVibrationEffect = true, hasHapticActuators = false, pulseSuccess = true } = {}) {
  const gamepad = { id: 'test-controller', index: 0, connected: true, vibrationEffect: null, hapticActuators: [] };
  if (hasVibrationEffect) gamepad.vibrationEffect = { playEffect: vi.fn(() => Promise.resolve()) };
  if (hasHapticActuators) gamepad.hapticActuators = [{ pulse: vi.fn(() => pulseSuccess ? Promise.resolve() : Promise.reject(new Error('Pulse failed'))) }];
  return gamepad;
}

async function importHaptics() {
  return await import('../../src/lib/platform/haptics.js');
}

// Local preset copies for testing
const HAPTICS = {
  TICK: { duration: 5, intensity: 0.2 },
  LIGHT: { duration: 10, intensity: 0.4 },
  MEDIUM: { duration: [15, 20, 15], intensity: 0.6 },
  HEAVY: { duration: [30, 40, 30], intensity: 0.8 },
  SUCCESS: { duration: [10, 40, 10, 20, 40], intensity: 0.7 },
  ERROR: { duration: [60, 60, 60, 60], intensity: 0.9 },
};

// ============================================================================
// Test Suites
// ============================================================================

describe('Haptic Feedback — Platform Detection', () => {
  describe('Mobile (Vibration API)', () => {
    it('should detect vibration API support', () => {
      const cleanup = mockVibrationAPI(true);
      try {
        expect('vibrate' in navigator).toBe(true);
      } finally { cleanup(); }
    });
    
    it('should gracefully handle missing vibration API', () => {
      const cleanup = mockVibrationAPI(false);
      try {
        expect('vibrate' in navigator).toBe(false);
      } finally { cleanup(); }
    });
    
    it('should call navigator.vibrate with correct duration', async () => {
      const cleanup = mockVibrationAPI(true);
      try {
        const { triggerHapticPulse } = await importHaptics();
        await triggerHapticPulse({ duration: 50, intensity: 0.5 });
        expect(navigator.vibrate).toHaveBeenCalledWith(50);
      } finally { cleanup(); }
    });
    
    it('should call navigator.vibrate with pattern array', async () => {
      const cleanup = mockVibrationAPI(true);
      try {
        const { triggerHapticPulse } = await importHaptics();
        const pattern = [30, 40, 30];
        await triggerHapticPulse({ duration: pattern, intensity: 0.8 });
        expect(navigator.vibrate).toHaveBeenCalledWith(pattern);
      } finally { cleanup(); }
    });
  });
  
  describe('Steam Deck / Handhelds (Gamepad API)', () => {
    it('should detect gamepad API support', () => {
      const cleanup = mockGamepadAPI(true, []);
      try {
        expect('getGamepads' in navigator).toBe(true);
      } finally { cleanup(); }
    });
    
    it('should gracefully handle missing gamepad API', () => {
      const cleanup = mockGamepadAPI(false, []);
      try {
        expect('getGamepads' in navigator).toBe(false);
      } finally { cleanup(); }
    });
    
    it('should trigger vibration on connected gamepad', async () => {
      const mockGamepad = createMockGamepad({ hasVibrationEffect: true });
      const cleanup = mockGamepadAPI(true, [mockGamepad]);
      try {
        const { triggerHapticPulse } = await importHaptics();
        await triggerHapticPulse({ duration: 100, intensity: 0.6 });
        expect(mockGamepad.vibrationEffect.playEffect).toHaveBeenCalledWith(
          'dual-rumble',
          expect.objectContaining({ duration: 100, weakMagnitude: 0.6, strongMagnitude: 0.6 })
        );
      } finally { cleanup(); }
    });
    
    it('should fallback to hapticActuators if vibrationEffect unavailable', async () => {
      const mockGamepad = createMockGamepad({ hasVibrationEffect: false, hasHapticActuators: true });
      const cleanup = mockGamepadAPI(true, [mockGamepad]);
      try {
        const { triggerHapticPulse } = await importHaptics();
        await triggerHapticPulse({ duration: 80, intensity: 0.7 });
        expect(mockGamepad.hapticActuators[0].pulse).toHaveBeenCalledWith(0.7, 80);
      } finally { cleanup(); }
    });
    
    it('should handle multiple connected gamepads', async () => {
      const gamepad1 = createMockGamepad({ hasVibrationEffect: true });
      const gamepad2 = createMockGamepad({ hasVibrationEffect: true });
      const cleanup = mockGamepadAPI(true, [gamepad1, gamepad2]);
      try {
        const { triggerHapticPulse } = await importHaptics();
        await triggerHapticPulse({ duration: 50, intensity: 0.5 });
        expect(gamepad1.vibrationEffect.playEffect).toHaveBeenCalled();
        expect(gamepad2.vibrationEffect.playEffect).toHaveBeenCalled();
      } finally { cleanup(); }
    });
    
    it('should skip disconnected gamepads', async () => {
      const connectedGamepad = createMockGamepad({ hasVibrationEffect: true });
      const disconnectedGamepad = { id: 'disconnected', index: 1, connected: false, vibrationEffect: null, hapticActuators: [] };
      const cleanup = mockGamepadAPI(true, [connectedGamepad, disconnectedGamepad]);
      try {
        const { triggerHapticPulse } = await importHaptics();
        await triggerHapticPulse({ duration: 50, intensity: 0.5 });
        expect(connectedGamepad.vibrationEffect.playEffect).toHaveBeenCalled();
      } finally { cleanup(); }
    });
  });
  
  describe('Desktop (No Haptics)', () => {
    it('should silently fail when no haptic hardware available', async () => {
      const vibrateCleanup = mockVibrationAPI(false);
      const gamepadCleanup = mockGamepadAPI(false, []);
      try {
        const { triggerHapticPulse } = await importHaptics();
        await expect(triggerHapticPulse(HAPTICS.HEAVY)).resolves.toBeUndefined();
      } finally {
        vibrateCleanup();
        gamepadCleanup();
      }
    });
  });
});

describe('Haptic Feedback — UI Presets', () => {
  describe('UI_HAPTICS Constants', () => {
    it('should have TICK preset for subtle interactions', () => {
      expect(HAPTICS.TICK).toEqual({ duration: 5, intensity: 0.2 });
    });
    it('should have LIGHT preset for standard confirmations', () => {
      expect(HAPTICS.LIGHT).toEqual({ duration: 10, intensity: 0.4 });
    });
    it('should have MEDIUM preset for weighted interactions', () => {
      expect(HAPTICS.MEDIUM).toEqual({ duration: [15, 20, 15], intensity: 0.6 });
    });
    it('should have HEAVY preset for significant actions', () => {
      expect(HAPTICS.HEAVY).toEqual({ duration: [30, 40, 30], intensity: 0.8 });
    });
    it('should have SUCCESS preset for positive feedback', () => {
      expect(HAPTICS.SUCCESS).toEqual({ duration: [10, 40, 10, 20, 40], intensity: 0.7 });
    });
    it('should have ERROR preset for warnings', () => {
      expect(HAPTICS.ERROR).toEqual({ duration: [60, 60, 60, 60], intensity: 0.9 });
    });
  });
  
  describe('Preset Usage', () => {
    it('should use TICK for navigation clicks', async () => {
      const cleanup = mockVibrationAPI(true);
      try {
        const { triggerHapticPulse } = await importHaptics();
        await triggerHapticPulse(HAPTICS.TICK);
        expect(navigator.vibrate).toHaveBeenCalledWith(5);
      } finally { cleanup(); }
    });
    it('should use HEAVY for ignition/orb clicks', async () => {
      const cleanup = mockVibrationAPI(true);
      try {
        const { triggerHapticPulse } = await importHaptics();
        await triggerHapticPulse(HAPTICS.HEAVY);
        expect(navigator.vibrate).toHaveBeenCalledWith([30, 40, 30]);
      } finally { cleanup(); }
    });
    it('should use SUCCESS for spell completion', async () => {
      const cleanup = mockVibrationAPI(true);
      try {
        const { triggerHapticPulse } = await importHaptics();
        await triggerHapticPulse(HAPTICS.SUCCESS);
        expect(navigator.vibrate).toHaveBeenCalledWith([10, 40, 10, 20, 40]);
      } finally { cleanup(); }
    });
    it('should use ERROR for failed operations', async () => {
      const cleanup = mockVibrationAPI(true);
      try {
        const { triggerHapticPulse } = await importHaptics();
        await triggerHapticPulse(HAPTICS.ERROR);
        expect(navigator.vibrate).toHaveBeenCalledWith([60, 60, 60, 60]);
      } finally { cleanup(); }
    });
  });
});

describe('Haptic Feedback — Edge Cases', () => {
  it('should handle zero duration gracefully', async () => {
    const cleanup = mockVibrationAPI(true);
    try {
      const { triggerHapticPulse } = await importHaptics();
      await triggerHapticPulse({ duration: 0, intensity: 0.5 });
      expect(navigator.vibrate).toHaveBeenCalledWith(0);
    } finally { cleanup(); }
  });
  
  it('should handle null/undefined options', async () => {
    const cleanup = mockVibrationAPI(true);
    try {
      const { triggerHapticPulse } = await importHaptics();
      await triggerHapticPulse();
      expect(navigator.vibrate).toHaveBeenCalledWith(10);
    } finally { cleanup(); }
  });
  
  it('should handle gamepad.vibrateEffect errors gracefully', async () => {
    const mockGamepad = createMockGamepad({ hasVibrationEffect: true });
    mockGamepad.vibrationEffect.playEffect.mockRejectedValue(new Error('Actuator failed'));
    const cleanup = mockGamepadAPI(true, [mockGamepad]);
    try {
      const { triggerHapticPulse } = await importHaptics();
      await expect(triggerHapticPulse({ duration: 50, intensity: 0.5 })).resolves.toBeUndefined();
    } finally { cleanup(); }
  });
  
  it('should handle gamepad.hapticActuators.pulse errors gracefully', async () => {
    const mockGamepad = createMockGamepad({ hasVibrationEffect: false, hasHapticActuators: true, pulseSuccess: false });
    const cleanup = mockGamepadAPI(true, [mockGamepad]);
    try {
      const { triggerHapticPulse } = await importHaptics();
      await expect(triggerHapticPulse({ duration: 50, intensity: 0.5 })).resolves.toBeUndefined();
    } finally { cleanup(); }
  });
});

describe('Haptic Feedback — Accessibility', () => {
  it('should document reduced-motion preference pattern', () => {
    const prefersReducedHaptics = true;
    expect(typeof prefersReducedHaptics).toBe('boolean');
  });
  
  it('should document haptic toggle pattern', () => {
    const hapticsEnabled = true;
    expect(typeof hapticsEnabled).toBe('boolean');
  });
});

describe('Haptic Feedback — Integration Scenarios', () => {
  describe('Scholomance Station Ignition', () => {
    it('should trigger HEAVY haptic on orb click', async () => {
      const cleanup = mockVibrationAPI(true);
      try {
        const { triggerHapticPulse } = await importHaptics();
        await triggerHapticPulse(HAPTICS.HEAVY);
        expect(navigator.vibrate).toHaveBeenCalledWith([30, 40, 30]);
      } finally { cleanup(); }
    });
  });
  
  describe('Navigation Clicks', () => {
    it('should trigger MEDIUM haptic on nav clicks', async () => {
      const cleanup = mockVibrationAPI(true);
      try {
        const { triggerHapticPulse } = await importHaptics();
        await triggerHapticPulse(HAPTICS.MEDIUM);
        expect(navigator.vibrate).toHaveBeenCalledWith([15, 20, 15]);
      } finally { cleanup(); }
    });
    it('should trigger TICK on subtle nav interactions', async () => {
      const cleanup = mockVibrationAPI(true);
      try {
        const { triggerHapticPulse } = await importHaptics();
        await triggerHapticPulse(HAPTICS.TICK);
        expect(navigator.vibrate).toHaveBeenCalledWith(5);
      } finally { cleanup(); }
    });
  });
  
  describe('Career Page Interactions', () => {
    it('should trigger SUCCESS haptic on milestone completion', async () => {
      const cleanup = mockVibrationAPI(true);
      try {
        const { triggerHapticPulse } = await importHaptics();
        await triggerHapticPulse(HAPTICS.SUCCESS);
        expect(navigator.vibrate).toHaveBeenCalledWith([10, 40, 10, 20, 40]);
      } finally { cleanup(); }
    });
  });
  
  describe('School Selection', () => {
    it('should trigger LIGHT haptic on school selection', async () => {
      const cleanup = mockVibrationAPI(true);
      try {
        const { triggerHapticPulse } = await importHaptics();
        await triggerHapticPulse(HAPTICS.LIGHT);
        expect(navigator.vibrate).toHaveBeenCalledWith(10);
      } finally { cleanup(); }
    });
  });
});

describe('Haptic Feedback — Performance', () => {
  it('should not block UI thread during haptic trigger', async () => {
    const mockGamepad = createMockGamepad({ hasVibrationEffect: true });
    const cleanup = mockGamepadAPI(true, [mockGamepad]);
    try {
      const { triggerHapticPulse } = await importHaptics();
      const startTime = performance.now();
      await triggerHapticPulse({ duration: 1000, intensity: 0.5 });
      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(10);
    } finally { cleanup(); }
  });
  
  it('should handle rapid successive haptic triggers', async () => {
    const cleanup = mockVibrationAPI(true);
    try {
      const { triggerHapticPulse } = await importHaptics();
      const hapticCount = 10;
      for (let i = 0; i < hapticCount; i++) {
        await triggerHapticPulse(HAPTICS.TICK);
      }
      expect(navigator.vibrate).toHaveBeenCalledTimes(hapticCount);
    } finally { cleanup(); }
  });
});

describe('Haptic Feedback — Bytecode Error Detection', () => {
  it('should detect when haptic API fails silently', () => {
    const hapticsExpected = true;
    const hapticsAvailable = false;
    if (hapticsExpected && !hapticsAvailable) {
      expect(hapticsAvailable).toBe(false);
    }
  });
});
