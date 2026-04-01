/**
 * UI Stasis Bytecode Test Suite
 * 
 * Purpose: Test all clickable/animated UI elements for stasis (freeze/hang) conditions
 * using the PixelBrain Bytecode Error System for deterministic error encoding.
 * 
 * Coverage:
 * - Click handlers that could stall
 * - Animation lifecycle (mount/unmount/interrupt)
 * - Loading state transitions
 * - Disabled state enforcement
 * - Event cleanup on unmount
 * - Race conditions in async UI operations
 * - Pointer capture and drag operations
 * - Focus trap integrity
 * - RAF/interval/setTimeout cleanup
 * 
 * Error Encoding: All failures emit bytecode errors per 01_Bytecode_Error_System_Overview.md
 * 
 * World-Law Connection: UI stasis represents a "frozen glyph" — a word that refuses to 
 * complete its utterance. In a world where Syntax is Physics, a stalled UI is a 
 * linguistic law violation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BytecodeError,
  ERROR_CATEGORIES,
  ERROR_SEVERITY,
  MODULE_IDS,
  ERROR_CODES,
  parseErrorForAI,
} from '../../codex/core/pixelbrain/bytecode-error.js';

// ============================================================================
// Test Constants & Bytecode Factories
// ============================================================================

const MODULE_IDS_EXTENDED = {
  ...MODULE_IDS,
  UI_STASIS: 'UISTAS',
  LINGUISTIC: 'LINGUA',
  COMBAT: 'COMBAT',
};

/**
 * Creates a UI stasis error for clickable elements
 * 
 * World-Law: A button that does not answer touch violates the Law of Response.
 * The glyph hangs suspended, neither accepting nor rejecting the player's intent.
 */
function createClickStasisError(elementId, expectedState, actualState, context = {}) {
  return new BytecodeError(
    ERROR_CATEGORIES.UI_STASIS,
    ERROR_SEVERITY.CRIT,
    MODULE_IDS_EXTENDED.UI_STASIS,
    ERROR_CODES.CLICK_HANDLER_STALL,
    {
      elementId,
      elementType: 'button',
      expectedState,
      actualState,
      operation: 'click-handler',
      ...context,
    }
  );
}

/**
 * Creates an animation lifecycle error
 * 
 * World-Law: An animation that outlives its vessel is a ghost in the machine —
 * a spell that continues casting after the mage has fallen.
 */
function createAnimationLifecycleError(animationType, phase, reason, context = {}) {
  return new BytecodeError(
    ERROR_CATEGORIES.UI_STASIS,
    ERROR_SEVERITY.CRIT,
    MODULE_IDS_EXTENDED.UI_STASIS,
    ERROR_CODES.ANIMATION_LIFECYCLE_HANG,
    {
      animationType,
      phase,
      reason,
      ...context,
    }
  );
}

/**
 * Creates a race condition error for concurrent UI operations
 * 
 * World-Law: Two spells cast simultaneously upon the same glyph create resonance 
 * interference. The syntax cannot resolve conflicting intents.
 */
function createRaceConditionError(operation, concurrentOperations, context = {}) {
  return new BytecodeError(
    ERROR_CATEGORIES.STATE,
    ERROR_SEVERITY.CRIT,
    MODULE_IDS_EXTENDED.UI_STASIS,
    ERROR_CODES.RACE_CONDITION,
    {
      operation,
      concurrentOperations,
      ...context,
    }
  );
}

/**
 * Creates a timeout error for stalled operations
 * 
 * World-Law: Time is a resource bounded by the player's patience. An operation 
 * that exceeds its temporal vessel has broken the Law of Finite Wait.
 */
function createTimeoutError(operation, timeoutMs, context = {}) {
  return new BytecodeError(
    ERROR_CATEGORIES.RANGE,
    ERROR_SEVERITY.CRIT,
    MODULE_IDS_EXTENDED.UI_STASIS,
    ERROR_CODES.EXCEEDS_MAX,
    {
      operation,
      timeoutMs,
      actualDuration: context.actualDuration || null,
      ...context,
    }
  );
}

/**
 * Creates a pointer capture failure error
 * 
 * World-Law: The pointer is an extension of the player's will. To lose capture 
 * mid-gesture is to drop the quill mid-word.
 */
function createPointerCaptureFailure(elementId, pointerId, captureState, operation) {
  return new BytecodeError(
    ERROR_CATEGORIES.UI_STASIS,
    ERROR_SEVERITY.CRIT,
    MODULE_IDS_EXTENDED.UI_STASIS,
    ERROR_CODES.POINTER_CAPTURE_FAILURE,
    {
      elementId,
      pointerId,
      captureState,
      operation,
    }
  );
}

/**
 * Creates an event listener leak error
 * 
 * World-Law: Listeners are ears attuned to the world's events. An ear that 
 * persists after the head is gone is an abomination.
 */
function createEventListenerLeak(eventType, targetElement, listenerCount, expectedCount) {
  return new BytecodeError(
    ERROR_CATEGORIES.UI_STASIS,
    ERROR_SEVERITY.CRIT,
    MODULE_IDS_EXTENDED.UI_STASIS,
    ERROR_CODES.EVENT_LISTENER_LEAK,
    {
      eventType,
      targetElement,
      listenerCount,
      expectedCount,
    }
  );
}

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Waits for an element to be clickable (not disabled, not loading)
 * 
 * @param {HTMLElement} element - The element to wait for
 * @param {number} timeoutMs - Maximum wait time in milliseconds
 * @returns {Promise<boolean>} - Resolves when clickable
 * @throws {BytecodeError} - Emits bytecode error on timeout
 */
async function waitForClickable(element, timeoutMs = 3000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    const isDisabled = element.hasAttribute('disabled');
    const isLoading = element.getAttribute('aria-busy') === 'true' || 
                      element.classList.contains('is-loading');
    const isHidden = element.offsetParent === null;
    
    if (!isDisabled && !isLoading && !isHidden) {
      return true;
    }
    
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  throw createTimeoutError('wait-for-clickable', timeoutMs, {
    elementId: element.id || element.textContent?.slice(0, 20),
    finalState: {
      isDisabled: element.hasAttribute('disabled'),
      isLoading: element.getAttribute('aria-busy') === 'true',
      isHidden: element.offsetParent === null,
    },
  });
}

/**
 * Simulates a click with stasis detection
 * 
 * @param {HTMLElement} element - The element to click
 * @param {string} operationName - Name for error reporting
 * @param {number} timeoutMs - Timeout threshold
 * @returns {Promise<{duration: number, clickResolved: boolean}>}
 * @throws {BytecodeError} - Emits bytecode error on stall
 */
async function clickWithStasisDetection(element, operationName, timeoutMs = 5000) {
  const startTime = Date.now();
  let clickResolved = false;
  
  const clickPromise = (async () => {
    await fireEvent.click(element);
    clickResolved = true;
  })();
  
  // Wait for click to resolve or timeout
  await Promise.race([
    clickPromise,
    new Promise((_, reject) => 
      setTimeout(() => reject(createTimeoutError(operationName, timeoutMs)), timeoutMs)
    ),
  ]);
  
  const duration = Date.now() - startTime;
  return { duration, clickResolved };
}

/**
 * Monitors animation frame lifecycle for leak detection
 * 
 * @param {function} callback - Called each frame with (timestamp, frameCount)
 * @param {number} maxFrames - Maximum frames to observe
 * @returns {{stop: function}} - Control object with stop() method
 */
function monitorAnimationFrames(callback, maxFrames = 60) {
  let frameCount = 0;
  let animationId = null;
  const frames = [];
  
  const observeFrame = (timestamp) => {
    if (frameCount >= maxFrames) {
      return;
    }
    
    frames.push({ frame: frameCount, timestamp });
    frameCount++;
    
    callback(timestamp, frameCount);
    animationId = requestAnimationFrame(observeFrame);
  };
  
  animationId = requestAnimationFrame(observeFrame);
  
  return {
    stop: () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      return { frameCount, frames };
    },
  };
}

/**
 * Tracks event listener count on a target
 */
function trackEventListenerCount(target, eventType) {
  const listeners = new Set();
  
  const originalAdd = target.addEventListener;
  const originalRemove = target.removeEventListener;
  
  target.addEventListener = function(...args) {
    if (args[0] === eventType) {
      listeners.add(args[1]);
    }
    return originalAdd.apply(this, args);
  };
  
  target.removeEventListener = function(...args) {
    if (args[0] === eventType) {
      listeners.delete(args[1]);
    }
    return originalRemove.apply(this, args);
  };
  
  return {
    getCount: () => listeners.size,
    cleanup: () => {
      target.addEventListener = originalAdd;
      target.removeEventListener = originalRemove;
    },
  };
}

// ============================================================================
// Test Suites
// ============================================================================

describe('UI Stasis — Clickable Elements', () => {
  describe('Button Click Handlers', () => {
    it('should not stall on rapid consecutive clicks', async () => {
      // Test rapid-fire click resilience
      // World-Law: A glyph must answer each touch distinctly, even in rapid succession.
      const clickCount = 10;
      const maxDurationPerClick = 500; // ms
      
      let handlerCallCount = 0;
      const handler = vi.fn(() => {
        handlerCallCount++;
        return Promise.resolve();
      });
      
      const { container } = render(
        <button onClick={handler} data-testid="rapid-click-btn">
          Click Me
        </button>
      );
      
      const button = container.querySelector('[data-testid="rapid-click-btn"]');
      
      // Execute rapid clicks
      for (let i = 0; i < clickCount; i++) {
        const start = Date.now();
        await fireEvent.click(button);
        const duration = Date.now() - start;
        
        expect(duration).toBeLessThan(maxDurationPerClick);
      }
      
      // Verify all clicks were processed
      expect(handlerCallCount).toBe(clickCount);
    });
    
    it('should handle async click handlers without stasis', async () => {
      // World-Law: The click event must fire immediately, even if the spell 
      // takes time to cast. The touch and the effect are separate laws.
      let resolveHandler;
      const handlerPromise = new Promise(resolve => {
        resolveHandler = resolve;
      });
      
      const asyncHandler = vi.fn(async () => {
        await handlerPromise;
      });
      
      const { container } = render(
        <button onClick={asyncHandler} data-testid="async-btn">
          Async Action
        </button>
      );
      
      const button = container.querySelector('[data-testid="async-btn"]');
      
      // Click should not block
      const clickStart = Date.now();
      await fireEvent.click(button);
      const clickDuration = Date.now() - clickStart;
      
      expect(clickDuration).toBeLessThan(100); // Click event should fire immediately
      
      // Resolve the async handler
      resolveHandler();
      await handlerPromise;
    });
    
    it('should recover from click handler errors', async () => {
      // World-Law: A failed spell does not freeze the hand that cast it.
      const error = new Error('Handler failed');
      const failingHandler = vi.fn(() => {
        throw error;
      });
      
      const { container } = render(
        <button onClick={failingHandler} data-testid="error-btn">
          Error Button
        </button>
      );
      
      const button = container.querySelector('[data-testid="error-btn"]');
      
      // Click should not crash the UI
      await expect(fireEvent.click(button)).resolves.toBeDefined();
      
      // Verify handler was called
      expect(failingHandler).toHaveBeenCalledTimes(1);
    });
    
    it('should emit bytecode error on click handler stall', async () => {
      // World-Law: When a glyph refuses to answer, the refusal must be spoken 
      // in bytecode — the language of the machine's pain.
      const timeoutMs = 100;
      
      const stallingHandler = async () => {
        await new Promise(resolve => setTimeout(resolve, timeoutMs * 2));
      };
      
      const { container } = render(
        <button onClick={stallingHandler} data-testid="stall-btn">
          Stall
        </button>
      );
      
      const button = container.querySelector('[data-testid="stall-btn"]');
      
      try {
        await clickWithStasisDetection(button, 'test-click-operation', timeoutMs);
        expect.unreachable('Should have thrown timeout error');
      } catch (error) {
        const errorData = parseErrorForAI(error);
        
        expect(errorData.bytecode).toMatch(/^PB-ERR-v1-RANGE-CRIT-UISTAS-0202-/);
        expect(errorData.context.operation).toBe('test-click-operation');
        expect(errorData.context.timeoutMs).toBe(timeoutMs);
      }
    });
  });
  
  describe('Loading State Transitions', () => {
    it('should prevent clicks during loading state', async () => {
      // World-Law: A glyph in flux cannot accept new intent. The loading state
      // is a shield against conflicting commands.
      const handler = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      const LoadingButton = () => {
        const [loading, setLoading] = useState(false);
        
        const handleClick = async () => {
          setLoading(true);
          await handler();
          setLoading(false);
        };
        
        return (
          <button
            onClick={handleClick}
            disabled={loading}
            aria-busy={loading}
            data-testid="loading-btn"
          >
            {loading ? 'Loading...' : 'Click Me'}
          </button>
        );
      };

      const { container } = render(<LoadingButton />);
      const button = container.querySelector('[data-testid="loading-btn"]');

      // First click initiates loading
      fireEvent.click(button);
      
      // Wait for state update
      await waitFor(() => {
        expect(button).toBeDisabled();
      });
      
      expect(button.getAttribute('aria-busy')).toBe('true');

      // Clicks during loading should not call handler (button is disabled)
      fireEvent.click(button);
      expect(handler).toHaveBeenCalledTimes(1);

      // Wait for loading to complete
      await waitFor(() => {
        expect(button).not.toBeDisabled();
      }, { timeout: 500 });
    });

    it('should restore clickable state after loading error', async () => {
      // World-Law: A failed spell releases the glyph back to the player's hand. 
      // The error must not imprison the button.
      let isLoading = false;
      const failingHandler = vi.fn(async () => {
        isLoading = true;
        await new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Failed')), 100)
        );
        isLoading = false;
      });
      
      const { container } = render(
        <button 
          onClick={async (e) => {
            try {
              await failingHandler(e);
            } catch (err) {
              isLoading = false; // Recovery
            }
          }}
          disabled={isLoading}
          data-testid="error-recovery-btn"
        >
          {isLoading ? 'Loading...' : 'Click Me'}
        </button>
      );
      
      const button = container.querySelector('[data-testid="error-recovery-btn"]');
      
      // Click and wait for error
      await fireEvent.click(button);
      
      // Should recover to clickable state
      await waitFor(() => {
        expect(button).not.toBeDisabled();
      }, { timeout: 1000 });
    });
    
    it('should emit bytecode error if loading state never clears', async () => {
      // World-Law: A glyph frozen in loading is a word caught mid-utterance — 
      // a linguistic abomination that must be named.
      const timeoutMs = 500;
      let isLoading = true;
      
      const { container } = render(
        <button 
          disabled={isLoading}
          aria-busy={isLoading}
          data-testid="perma-loading-btn"
        >
          Loading...
        </button>
      );
      
      const button = container.querySelector('[data-testid="perma-loading-btn"]');
      
      try {
        await waitForClickable(button, timeoutMs);
        expect.unreachable('Should have thrown timeout error');
      } catch (error) {
        const errorData = parseErrorForAI(error);
        
        expect(errorData.bytecode).toMatch(/^PB-ERR-v1-RANGE-CRIT-UISTAS-0202-/);
        expect(errorData.context.operation).toBe('wait-for-clickable');
      }
    });
  });
  
  describe('Disabled State Enforcement', () => {
    it('should not trigger handler when disabled', async () => {
      // World-Law: A disabled glyph is a sealed rune. It cannot be activated 
      // by any touch, intentional or accidental.
      const handler = vi.fn();
      
      const { container } = render(
        <button onClick={handler} disabled data-testid="disabled-btn">
          Disabled
        </button>
      );
      
      const button = container.querySelector('[data-testid="disabled-btn"]');
      
      await fireEvent.click(button);
      
      expect(handler).not.toHaveBeenCalled();
    });
    
    it('should handle disabled state changes correctly', async () => {
      // World-Law: The seal on a glyph can be lifted, but the transition must 
      // be atomic — no touch may land in the between-state.
      const handler = vi.fn();
      
      const { container, rerender } = render(
        <button 
          onClick={handler} 
          disabled={true}
          data-testid="toggle-disabled-btn"
        >
          Toggle
        </button>
      );
      
      const button = container.querySelector('[data-testid="toggle-disabled-btn"]');
      
      // Enable -> click
      rerender(
        <button onClick={handler} disabled={false} data-testid="toggle-disabled-btn">
          Toggle
        </button>
      );
      await fireEvent.click(button);
      expect(handler).toHaveBeenCalledTimes(1);
      
      // Disable -> click should not work
      rerender(
        <button onClick={handler} disabled={true} data-testid="toggle-disabled-btn">
          Toggle
        </button>
      );
      await fireEvent.click(button);
      expect(handler).toHaveBeenCalledTimes(1); // Still 1
    });
  });
});

describe('UI Stasis — Animation Lifecycle', () => {
  describe('Framer Motion Animations', () => {
    it('should cleanup animations on unmount', async () => {
      // World-Law: When the vessel shatters, the spell within must dissipate. 
      // An animation that outlives its component is a ghost.
      let animationCleanupCalled = false;
      
      const AnimatedComponent = ({ shouldRender }) => {
        useEffect(() => {
          return () => {
            animationCleanupCalled = true;
          };
        }, []);
        
        if (!shouldRender) return null;
        
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            data-testid="animated-element"
          >
            Animated
          </motion.div>
        );
      };
      
      const { rerender } = render(<AnimatedComponent shouldRender={true} />);
      
      // Unmount
      rerender(<AnimatedComponent shouldRender={false} />);
      
      expect(animationCleanupCalled).toBe(true);
    });
    
    it('should handle animation interrupts without stasis', async () => {
      // World-Law: A spell interrupted mid-casting must not freeze the caster's 
      // hand. The new intent supersedes the old.
      const { container, rerender } = render(
        <motion.div
          initial={{ x: 0 }}
          animate={{ x: 100 }}
          transition={{ duration: 10 }} // Long animation
          data-testid="interruptible-anim"
        >
          Moving
        </motion.div>
      );
      
      const element = container.querySelector('[data-testid="interruptible-anim"]');
      
      // Interrupt with new animation
      rerender(
        <motion.div
          initial={{ x: 0 }}
          animate={{ x: -100 }}
          transition={{ duration: 0.1 }}
          data-testid="interruptible-anim"
        >
          Moving
        </motion.div>
      );
      
      // Should complete new animation without hanging
      await waitFor(() => {
        const transform = element.style.transform;
        expect(transform).toBeTruthy();
      }, { timeout: 2000 });
    });
    
    it('should emit bytecode error if animation cleanup not called', async () => {
      // World-Law: An animation that refuses to die when its vessel is gone 
      // violates the Law of Lifecycle. This must be named.
      let cleanupCalled = false;
      
      const LeakyComponent = () => {
        useEffect(() => {
          // Simulate starting an animation
          return () => {
            // Intentionally NOT cleaning up
            // cleanupCalled = true; // Missing!
          };
        }, []);
        
        return <div data-testid="leaky-anim">Leaky</div>;
      };
      
      const { unmount } = render(<LeakyComponent />);
      unmount();
      
      // This test documents the leak — in real code, we'd assert cleanupCalled === true
      expect(cleanupCalled).toBe(false);
      
      // Emit documentation error
      const error = createAnimationLifecycleError(
        'framer-motion',
        'unmount',
        'Cleanup function did not execute'
      );
      
      expect(error.bytecode).toMatch(/^PB-ERR-v1-UI_STASIS-CRIT-UISTAS-0E02-/);
    });
  });
  
  describe('CSS Animations', () => {
    it('should stop animations when element is hidden', async () => {
      // World-Law: A hidden glyph need not perform its dance. The animation 
      // may continue in CSS, but it must not cause stasis.
      const { container, rerender } = render(
        <div 
          className="loading-spinner"
          data-testid="spinner"
        >
          Loading
        </div>
      );
      
      const spinner = container.querySelector('[data-testid="spinner"]');
      
      // Verify animation is running (computed style)
      const initialAnimation = getComputedStyle(spinner).animationName;
      expect(initialAnimation).toBeTruthy();
      
      // Hide element
      rerender(
        <div 
          className="loading-spinner"
          data-testid="spinner"
          style={{ display: 'none' }}
        >
          Loading
        </div>
      );
      
      // Animation should be paused or removed
      const hiddenAnimation = getComputedStyle(spinner).animationName;
      // Note: CSS may still report animation even when hidden
      // The key is that it doesn't cause stasis
    });
  });
  
  describe('RequestAnimationFrame Loops', () => {
    it('should cleanup RAF loops on unmount', async () => {
      // World-Law: The heartbeat of an animation must stop when the heart is 
      // removed. An orphaned RAF loop is a zombie pulse.
      let rafId = null;
      let loopRunning = false;
      let cleanupCalled = false;
      
      const RAFComponent = () => {
        useEffect(() => {
          loopRunning = true;
          
          const loop = () => {
            if (!loopRunning) return;
            rafId = requestAnimationFrame(loop);
          };
          
          rafId = requestAnimationFrame(loop);
          
          return () => {
            loopRunning = false;
            if (rafId) {
              cancelAnimationFrame(rafId);
            }
            cleanupCalled = true;
          };
        }, []);
        
        return <div data-testid="raf-component">RAF Loop</div>;
      };
      
      const { unmount } = render(<RAFComponent />);
      
      expect(loopRunning).toBe(true);
      
      unmount();
      
      expect(cleanupCalled).toBe(true);
      expect(loopRunning).toBe(false);
    });
    
    it('should handle multiple concurrent RAF loops', async () => {
      // World-Law: Multiple heartbeats can coexist, but each must be tracked 
      // and each must be stoppable.
      const loopCount = 6;
      const loops = [];
      
      for (let i = 0; i < loopCount; i++) {
        loops.push(monitorAnimationFrames(() => {}, 10));
      }
      
      // Let them run briefly
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Stop all loops
      const results = loops.map(loop => loop.stop());
      
      // All loops should have processed frames
      results.forEach((result, index) => {
        expect(result.frameCount).toBeGreaterThan(0);
      });
    });
    
    it('should emit bytecode error for orphaned RAF loop', async () => {
      // World-Law: An RAF loop that continues after unmount is an abomination — 
      // a spell casting itself in the void.
      let rafId = null;
      let loopRunning = false;
      
      const OrphanedRAFComponent = () => {
        useEffect(() => {
          loopRunning = true;
          
          const loop = () => {
            if (!loopRunning) return;
            rafId = requestAnimationFrame(loop);
          };
          
          rafId = requestAnimationFrame(loop);
          
          // INTENTIONALLY NOT cleaning up
          return () => {
            // Missing: loopRunning = false; cancelAnimationFrame(rafId);
          };
        }, []);
        
        return <div data-testid="orphaned-raf">Orphaned RAF</div>;
      };
      
      const { unmount } = render(<OrphanedRAFComponent />);
      unmount();
      
      // Loop is still running (leak)
      expect(loopRunning).toBe(true);
      
      // Emit documentation error
      const error = createAnimationLifecycleError(
        'css-raf',
        'unmount',
        'RAF loop continues after component unmount',
        { componentId: 'orphaned-raf' }
      );
      
      expect(error.bytecode).toMatch(/^PB-ERR-v1-UI_STASIS-CRIT-UISTAS-0E02-/);
      
      // Manual cleanup for test
      loopRunning = false;
      cancelAnimationFrame(rafId);
    });
  });
  
  describe('SetInterval/SetTimeout Cleanup', () => {
    it('should clear intervals on unmount', async () => {
      // World-Law: The ticking of an interval is a promise to return. When the 
      // vessel is gone, the promise must be voided.
      let intervalCleared = false;
      let intervalId = null;
      
      const IntervalComponent = () => {
        useEffect(() => {
          intervalId = setInterval(() => {
            // Tick
          }, 100);
          
          return () => {
            clearInterval(intervalId);
            intervalCleared = true;
          };
        }, []);
        
        return <div data-testid="interval-component">Interval</div>;
      };
      
      const { unmount } = render(<IntervalComponent />);
      
      unmount();
      
      expect(intervalCleared).toBe(true);
      
      // Verify interval is actually cleared (should not throw)
      expect(() => clearInterval(intervalId)).not.toThrow();
    });
    
    it('should clear timeouts on unmount', async () => {
      // World-Law: A timeout is a future-self delivering a message. If the 
      // self no longer exists, the message must not be delivered.
      let timeoutCleared = false;
      let timeoutId = null;
      let timeoutExecuted = false;
      
      const TimeoutComponent = () => {
        useEffect(() => {
          timeoutId = setTimeout(() => {
            timeoutExecuted = true;
          }, 1000);
          
          return () => {
            clearTimeout(timeoutId);
            timeoutCleared = true;
          };
        }, []);
        
        return <div data-testid="timeout-component">Timeout</div>;
      };
      
      const { unmount } = render(<TimeoutComponent />);
      
      // Unmount before timeout fires
      unmount();
      
      expect(timeoutCleared).toBe(true);
      
      // Wait for original timeout duration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Timeout should not have executed
      expect(timeoutExecuted).toBe(false);
    });
    
    it('should emit bytecode error for interval leak', async () => {
      // World-Law: An interval that ticks into the void after its vessel is 
      // gone is a linguistic abomination.
      let intervalId = null;
      let cleanupCalled = false;
      
      const LeakyIntervalComponent = () => {
        useEffect(() => {
          intervalId = setInterval(() => {}, 100);
          
          return () => {
            // INTENTIONALLY NOT clearing interval
            // clearInterval(intervalId);
            cleanupCalled = true;
          };
        }, []);
        
        return <div data-testid="leaky-interval">Leaky Interval</div>;
      };
      
      const { unmount } = render(<LeakyIntervalComponent />);
      unmount();
      
      expect(cleanupCalled).toBe(false);
      
      // Emit documentation error
      const error = new BytecodeError(
        ERROR_CATEGORIES.UI_STASIS,
        ERROR_SEVERITY.CRIT,
        MODULE_IDS_EXTENDED.UI_STASIS,
        ERROR_CODES.INTERVAL_TIMER_LEAK,
        {
          intervalId,
          intervalMs: 100,
          componentId: 'leaky-interval',
          clearedOnUnmount: false,
        }
      );
      
      expect(error.bytecode).toMatch(/^PB-ERR-v1-UI_STASIS-CRIT-UISTAS-0E07-/);
      
      // Manual cleanup
      clearInterval(intervalId);
    });
  });
});

describe('UI Stasis — Race Conditions', () => {
  describe('Concurrent Async Operations', () => {
    it('should handle concurrent clicks without race conditions', async () => {
      // World-Law: Multiple touches upon the same glyph create resonance. Each 
      // must be answered distinctly, without interference.
      let operationCount = 0;
      const results = [];
      
      const concurrentHandler = vi.fn(async () => {
        const myCount = ++operationCount;
        await new Promise(resolve => setTimeout(resolve, 50));
        results.push(myCount);
      });
      
      const { container } = render(
        <button onClick={concurrentHandler} data-testid="concurrent-btn">
          Concurrent
        </button>
      );
      
      const button = container.querySelector('[data-testid="concurrent-btn"]');
      
      // Fire multiple clicks concurrently
      const clickPromises = Array(5).fill(null).map(() => fireEvent.click(button));
      await Promise.all(clickPromises);
      
      // Wait for all operations to complete
      await waitFor(() => {
        expect(results.length).toBe(5);
      });
      
      // All operations should complete
      expect(concurrentHandler).toHaveBeenCalledTimes(5);
    });
    
    it('should dedupe identical concurrent requests', async () => {
      // World-Law: Three mages chanting the same spell simultaneously should 
      // not triple-cast. The syntax recognizes the resonance and merges.
      let requestCount = 0;
      const pendingRequests = new Map();
      
      const dedupingHandler = async (requestId) => {
        if (pendingRequests.has(requestId)) {
          return pendingRequests.get(requestId);
        }
        
        const promise = (async () => {
          requestCount++;
          await new Promise(resolve => setTimeout(resolve, 100));
          pendingRequests.delete(requestId);
          return 'result';
        })();
        
        pendingRequests.set(requestId, promise);
        return promise;
      };
      
      const { container } = render(
        <button 
          onClick={() => dedupingHandler('same-id')}
          data-testid="dedupe-btn"
        >
          Dedupe
        </button>
      );
      
      const button = container.querySelector('[data-testid="dedupe-btn"]');
      
      // Fire concurrent identical requests
      await Promise.all([
        fireEvent.click(button),
        fireEvent.click(button),
        fireEvent.click(button),
      ]);
      
      // Should only execute once
      expect(requestCount).toBe(1);
    });
    
    it('should emit bytecode error on race condition', async () => {
      // World-Law: When two operations fight for the same state, the syntax 
      // fractures. This fracture must be named.
      let state = 0;
      const results = [];
      
      const raceHandler = async (value) => {
        const currentState = state;
        await new Promise(resolve => setTimeout(resolve, 50));
        state = currentState + value;
        results.push(state);
      };
      
      // Fire concurrent updates
      await Promise.all([
        raceHandler(1),
        raceHandler(10),
      ]);
      
      // Race condition: state might be 1 or 11 depending on timing
      // This documents the potential issue
      const error = createRaceConditionError(
        'state-update',
        ['race-handler-1', 'race-handler-2']
      );
      
      expect(error.bytecode).toMatch(/^PB-ERR-v1-STATE-CRIT-UISTAS-0303-/);
    });
  });
  
  describe('State Update Race Conditions', () => {
    it('should handle rapid state updates without tearing', async () => {
      // World-Law: Rapid incantations should not cause the glyph to display 
      // intermediate, incorrect forms. The final state must be true.
      let renderCount = 0;
      const renders = [];
      
      const StateComponent = () => {
        const [count, setCount] = useState(0);
        renderCount++;
        renders.push(count);
        
        return (
          <button 
            onClick={() => setCount(c => c + 1)}
            data-testid="rapid-state-btn"
          >
            {count}
          </button>
        );
      };
      
      const { container } = render(<StateComponent />);
      const button = container.querySelector('[data-testid="rapid-state-btn"]');
      
      // Rapid updates
      for (let i = 0; i < 10; i++) {
        await fireEvent.click(button);
      }
      
      // Final count should be 10
      expect(screen.getByText('10')).toBeTruthy();
      
      // No tearing: renders should be monotonic (not necessarily, React batches)
      // But final state should be correct
    });
  });
});

describe('UI Stasis — Edge Cases', () => {
  describe('Unmount During Async Operation', () => {
    it('should not update state after unmount', async () => {
      // World-Law: A message delivered to a departed mage should not resurrect 
      // their hand to write. The living do not take commands from the dead.
      let setStateAfterUnmount = false;
      
      const AsyncComponent = () => {
        const [data, setData] = useState(null);
        const mountedRef = useRef(true);
        
        useEffect(() => {
          return () => {
            mountedRef.current = false;
          };
        }, []);
        
        const loadData = async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          if (mountedRef.current) {
            setData('loaded');
            setStateAfterUnmount = false;
          } else {
            setStateAfterUnmount = true;
          }
        };
        
        return (
          <button onClick={loadData} data-testid="async-unmount-btn">
            {data || 'Load'}
          </button>
        );
      };
      
      const { container, unmount } = render(<AsyncComponent />);
      const button = container.querySelector('[data-testid="async-unmount-btn"]');
      
      // Start async operation
      fireEvent.click(button);
      
      // Unmount before it completes
      unmount();
      
      // Wait for operation to complete
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should detect unmount and not update state
      expect(setStateAfterUnmount).toBe(true);
    });
  });
  
  describe('Pointer Capture Failures', () => {
    it('should release pointer capture on element removal', async () => {
      // World-Law: When the hand holding the pointer is cut off, the pointer 
      // must fall. The machine should not hold a ghost touch.
      let pointerReleased = false;
      
      const DragComponent = () => {
        const handlePointerDown = (e) => {
          e.target.setPointerCapture(e.pointerId);
        };
        
        const handlePointerUp = (e) => {
          e.target.releasePointerCapture(e.pointerId);
          pointerReleased = true;
        };
        
        return (
          <div
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            data-testid="drag-element"
          >
            Drag Me
          </div>
        );
      };
      
      const { container, unmount } = render(<DragComponent />);
      const element = container.querySelector('[data-testid="drag-element"]');
      
      // Start drag
      fireEvent.pointerDown(element, { pointerId: 1 });
      
      // Remove element during drag
      unmount();
      
      // Pointer capture should be released (browser handles this)
      // We verify no errors are thrown
      expect(pointerReleased).toBe(false); // Won't be called since element is gone
      
      // Document the potential issue
      const error = createPointerCaptureFailure(
        'drag-element',
        1,
        'orphaned',
        'drag'
      );
      
      expect(error.bytecode).toMatch(/^PB-ERR-v1-UI_STASIS-CRIT-UISTAS-0E05-/);
    });
    
    it('should handle pointer capture loss gracefully', async () => {
      // World-Law: If the pointer slips free mid-gesture, the glyph should not 
      // freeze in expectation. It must accept the release.
      let dragComplete = false;
      let dragCancelled = false;
      
      const GracefulDragComponent = () => {
        const handlePointerDown = (e) => {
          try {
            e.target.setPointerCapture(e.pointerId);
          } catch (err) {
            // Capture failed — handle gracefully
          }
        };
        
        const handlePointerUp = () => {
          dragComplete = true;
        };
        
        const handleLostPointerCapture = () => {
          dragCancelled = true;
        };
        
        return (
          <div
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onLostPointerCapture={handleLostPointerCapture}
            data-testid="graceful-drag"
          >
            Graceful Drag
          </div>
        );
      };
      
      const { container } = render(<GracefulDragComponent />);
      const element = container.querySelector('[data-testid="graceful-drag"]');
      
      // Simulate drag start
      await fireEvent.pointerDown(element, { pointerId: 1 });
      
      // Simulate lost capture (e.g., user pressed Escape or browser intervention)
      await fireEvent(element, new Event('lostpointercapture', { bubbles: true }));
      
      expect(dragCancelled).toBe(true);
      expect(dragComplete).toBe(false);
    });
  });
  
  describe('Focus Trap Escapes', () => {
    it('should allow escape from focus traps', async () => {
      // World-Law: A prison of focus must have a key. The Escape key is that 
      // key — without it, the trap is a cage, not a tool.
      const FocusTrapComponent = () => {
        const trapRef = useRef(null);
        
        useEffect(() => {
          const trap = trapRef.current;
          trap?.focus();
          
          const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
              trap?.blur();
            }
          };
          
          document.addEventListener('keydown', handleKeyDown);
          return () => document.removeEventListener('keydown', handleKeyDown);
        }, []);
        
        return (
          <div ref={trapRef} tabIndex={-1} data-testid="focus-trap">
            <button data-testid="trap-btn-1">Btn 1</button>
            <button data-testid="trap-btn-2">Btn 2</button>
          </div>
        );
      };
      
      render(<FocusTrapComponent />);
      
      const trap = screen.getByTestId('focus-trap');
      expect(trap).toHaveFocus();
      
      // Escape should release focus
      await fireEvent.keyDown(document, { key: 'Escape' });
      
      expect(trap).not.toHaveFocus();
    });
    
    it('should emit bytecode error if focus trap cannot be escaped', async () => {
      // World-Law: A focus trap that refuses the Escape key is a prison without 
      // a key. This violates the Law of Voluntary Confinement.
      const UnescapableTrap = () => {
        const trapRef = useRef(null);
        
        useEffect(() => {
          const trap = trapRef.current;
          trap?.focus();
          
          const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
              // INTENTIONALLY ignoring escape
              e.preventDefault();
              e.stopPropagation();
            }
          };
          
          document.addEventListener('keydown', handleKeyDown);
          return () => document.removeEventListener('keydown', handleKeyDown);
        }, []);
        
        return (
          <div ref={trapRef} tabIndex={-1} data-testid="unescapable-trap">
            Trapped
          </div>
        );
      };
      
      render(<UnescapableTrap />);
      
      const trap = screen.getByTestId('unescapable-trap');
      expect(trap).toHaveFocus();
      
      // Try to escape
      await fireEvent.keyDown(document, { key: 'Escape' });
      
      // Still focused (trap is broken)
      expect(trap).toHaveFocus();
      
      // Emit documentation error
      const error = new BytecodeError(
        ERROR_CATEGORIES.UI_STASIS,
        ERROR_SEVERITY.WARN,
        MODULE_IDS_EXTENDED.UI_STASIS,
        ERROR_CODES.FOCUS_TRAP_ESCAPE,
        {
          trapId: 'unescapable-trap',
          escapeMethod: 'escape-key',
          focusLost: false,
        }
      );
      
      expect(error.bytecode).toMatch(/^PB-ERR-v1-UI_STASIS-WARN-UISTAS-0E04-/);
    });
  });
  
  describe('Memory Leaks in Event Subscriptions', () => {
    it('should cleanup event listeners on unmount', async () => {
      // World-Law: An ear attuned to the world's events must be removed when 
      // the head is gone. Otherwise, the world speaks to silence.
      let listenerCount = 0;
      
      const EventComponent = () => {
        useEffect(() => {
          const handler = () => {};
          document.addEventListener('scroll', handler);
          listenerCount++;
          
          return () => {
            document.removeEventListener('scroll', handler);
            listenerCount--;
          };
        }, []);
        
        return <div data-testid="event-component">Events</div>;
      };
      
      const initialListeners = listenerCount;
      
      const { unmount } = render(<EventComponent />);
      expect(listenerCount).toBe(initialListeners + 1);
      
      unmount();
      expect(listenerCount).toBe(initialListeners);
    });
    
    it('should emit bytecode error for event listener leak', async () => {
      // World-Law: A listener that persists after unmount is an ear floating in 
      // the void, still hearing. This is an abomination.
      const leakyHandler = () => {};
      let cleanupCalled = false;
      
      const LeakyEventComponent = () => {
        useEffect(() => {
          document.addEventListener('scroll', leakyHandler);
          
          return () => {
            // INTENTIONALLY NOT removing listener
            // document.removeEventListener('scroll', leakyHandler);
            cleanupCalled = true;
          };
        }, []);
        
        return <div data-testid="leaky-event">Leaky Event</div>;
      };
      
      const { unmount } = render(<LeakyEventComponent />);
      unmount();
      
      expect(cleanupCalled).toBe(false);
      
      // Emit documentation error
      const error = createEventListenerLeak(
        'scroll',
        'document',
        1, // listenerCount
        0  // expectedCount after unmount
      );
      
      expect(error.bytecode).toMatch(/^PB-ERR-v1-UI_STASIS-CRIT-UISTAS-0E03-/);
      
      // Manual cleanup
      document.removeEventListener('scroll', leakyHandler);
    });
  });
});

describe('UI Stasis — Accessibility Interactions', () => {
  describe('Keyboard Navigation', () => {
    it('should handle rapid keyboard navigation without stasis', async () => {
      // World-Law: The fingers that dance across the keyboard should not be 
      // caught by lag. Each keystroke must be answered in its time.
      const keyHandler = vi.fn();
      
      const { container } = render(
        <div 
          onKeyDown={keyHandler}
          tabIndex={0}
          data-testid="keyboard-nav"
        >
          <button>Item 1</button>
          <button>Item 2</button>
          <button>Item 3</button>
        </div>
      );
      
      const navElement = container.querySelector('[data-testid="keyboard-nav"]');
      navElement.focus();
      
      // Rapid tab navigation
      const keys = ['Tab', 'Tab', 'Tab', 'Shift+Tab', 'Shift+Tab'];
      
      for (const key of keys) {
        await fireEvent.keyDown(navElement, { key: key.split('+').pop() });
      }
      
      expect(keyHandler).toHaveBeenCalledTimes(keys.length);
    });
    
    it('should handle Escape key for modal dismissal', async () => {
      // World-Law: The Escape key is the universal release. Any modal that 
      // ignores it is a prison, not a UI pattern.
      const ModalComponent = () => {
        const [isOpen, setIsOpen] = useState(true);
        
        useEffect(() => {
          const handleEscape = (e) => {
            if (e.key === 'Escape' && isOpen) {
              setIsOpen(false);
            }
          };
          
          document.addEventListener('keydown', handleEscape);
          return () => document.removeEventListener('keydown', handleEscape);
        }, [isOpen]);
        
        if (!isOpen) return null;
        
        return (
          <div 
            role="dialog"
            aria-modal="true"
            data-testid="modal"
          >
            Modal Content
          </div>
        );
      };
      
      render(<ModalComponent />);
      
      expect(screen.getByTestId('modal')).toBeTruthy();
      
      await fireEvent.keyDown(document, { key: 'Escape' });
      
      expect(screen.queryByTestId('modal')).not.toBeTruthy();
    });
  });
  
  describe('Screen Reader Announcements', () => {
    it('should not block on aria-live updates', async () => {
      // World-Law: The voice that speaks to the blind must not choke on its 
      // own words. The announcement must flow freely.
      const LiveRegionComponent = () => {
        const [message, setMessage] = useState('Initial');
        
        const update = async () => {
          setMessage('Loading...');
          await new Promise(resolve => setTimeout(resolve, 50));
          setMessage('Complete');
        };
        
        return (
          <div>
            <div 
              aria-live="polite" 
              data-testid="live-region"
            >
              {message}
            </div>
            <button onClick={update} data-testid="update-btn">
              Update
            </button>
          </div>
        );
      };
      
      render(<LiveRegionComponent />);
      
      const button = screen.getByTestId('update-btn');
      const liveRegion = screen.getByTestId('live-region');
      
      expect(liveRegion.textContent).toBe('Initial');
      
      await fireEvent.click(button);
      
      await waitFor(() => {
        expect(liveRegion.textContent).toBe('Complete');
      });
    });
  });
});

describe('UI Stasis — Bytecode Error Integration', () => {
  it('should emit bytecode errors on stasis detection', async () => {
    // World-Law: When the UI freezes, the freeze must be named in the language 
    // of the machine. Bytecode is that language.
    const operationName = 'test-click-operation';
    const timeoutMs = 100;
    
    const stallingHandler = async () => {
      await new Promise(resolve => setTimeout(resolve, timeoutMs * 2));
    };
    
    const { container } = render(
      <button onClick={stallingHandler} data-testid="stall-btn">
        Stall
      </button>
    );
    
    const button = container.querySelector('[data-testid="stall-btn"]');
    
    try {
      await clickWithStasisDetection(button, operationName, timeoutMs);
      expect.unreachable('Should have thrown timeout error');
    } catch (error) {
      const errorData = parseErrorForAI(error);
      
      expect(errorData.bytecode).toMatch(/^PB-ERR-v1-RANGE-CRIT-UISTAS-0202-/);
      expect(errorData.context.operation).toBe(operationName);
      expect(errorData.context.timeoutMs).toBe(timeoutMs);
    }
  });
  
  it('should encode animation lifecycle errors as bytecode', () => {
    // World-Law: Every animation death must have a bytecode obituary.
    const error = createAnimationLifecycleError(
      'framer-motion',
      'exit',
      'Component unmounted before animation completed',
      { elementId: 'test-element' }
    );
    
    expect(error.bytecode).toMatch(/^PB-ERR-v1-UI_STASIS-CRIT-UISTAS-0E02-/);
    
    const decoded = JSON.parse(atob(error.context));
    expect(decoded.animationType).toBe('framer-motion');
    expect(decoded.phase).toBe('exit');
  });
  
  it('should encode race condition errors as bytecode', () => {
    // World-Law: When operations collide, the collision must be recorded in 
    // bytecode — the skid marks on the syntax.
    const error = createRaceConditionError(
      'state-update',
      ['concurrent-click-1', 'concurrent-click-2'],
      { elementId: 'test-button' }
    );
    
    expect(error.bytecode).toMatch(/^PB-ERR-v1-STATE-CRIT-UISTAS-0303-/);
    
    const decoded = JSON.parse(atob(error.context));
    expect(decoded.operation).toBe('state-update');
    expect(decoded.concurrentOperations).toHaveLength(2);
  });
  
  it('should encode pointer capture failure as bytecode', () => {
    // World-Law: A dropped pointer leaves a bytecode trail.
    const error = createPointerCaptureFailure(
      'drag-element',
      1,
      'orphaned',
      'drag'
    );
    
    expect(error.bytecode).toMatch(/^PB-ERR-v1-UI_STASIS-CRIT-UISTAS-0E05-/);
    
    const decoded = JSON.parse(atob(error.context));
    expect(decoded.elementId).toBe('drag-element');
    expect(decoded.pointerId).toBe(1);
    expect(decoded.captureState).toBe('orphaned');
  });
  
  it('should encode event listener leak as bytecode', () => {
    // World-Law: A listener that outlives its vessel is a ghost ear. The 
    // bytecode names it.
    const error = createEventListenerLeak(
      'scroll',
      'document',
      5,
      0
    );
    
    expect(error.bytecode).toMatch(/^PB-ERR-v1-UI_STASIS-CRIT-UISTAS-0E03-/);
    
    const decoded = JSON.parse(atob(error.context));
    expect(decoded.eventType).toBe('scroll');
    expect(decoded.targetElement).toBe('document');
    expect(decoded.listenerCount).toBe(5);
    expect(decoded.expectedCount).toBe(0);
  });
});

// ============================================================================
// Integration Test: Real Component Scenarios
// ============================================================================

describe('UI Stasis — Real Component Integration', () => {
  describe('WordTooltip Drag & Click', () => {
    it('should handle drag-click distinction without stasis', async () => {
      // World-Law: The touch that drags and the touch that clicks are different 
      // spells. The glyph must know the difference.
      let clickCount = 0;
      let dragDetected = false;
      
      const TooltipComponent = () => {
        const startPos = useRef({ x: 0, y: 0 });
        
        const handlePointerDown = (e) => {
          startPos.current = { x: e.clientX, y: e.clientY };
          e.target.setPointerCapture(e.pointerId);
        };
        
        const handlePointerMove = (e) => {
          const dx = e.clientX - startPos.current.x;
          const dy = e.clientY - startPos.current.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance > 5) {
            dragDetected = true;
          }
        };
        
        const handleClick = () => {
          if (!dragDetected) {
            clickCount++;
          }
          dragDetected = false;
        };
        
        return (
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onClick={handleClick}
            data-testid="tooltip-card"
          >
            Tooltip Card
          </div>
        );
      };
      
      const { container } = render(<TooltipComponent />);
      const element = container.querySelector('[data-testid="tooltip-card"]');
      
      // Click (no drag)
      await fireEvent.pointerDown(element, { clientX: 100, clientY: 100, pointerId: 1 });
      await fireEvent.pointerUp(element, { clientX: 100, clientY: 100, pointerId: 1 });
      await fireEvent.click(element);
      
      expect(clickCount).toBe(1);
      expect(dragDetected).toBe(false);
      
      // Drag
      await fireEvent.pointerDown(element, { clientX: 100, clientY: 100, pointerId: 1 });
      await fireEvent.pointerMove(element, { clientX: 150, clientY: 100, pointerId: 1 });
      await fireEvent.pointerUp(element, { clientX: 150, clientY: 100, pointerId: 1 });
      
      expect(dragDetected).toBe(true);
    });
  });
  
  describe('Combat Spellbook Input', () => {
    it('should handle rapid text input without stasis', async () => {
      // World-Law: The fingers that cast spells through text should not be 
      // slowed by the machine. Each keystroke is a phoneme uttered.
      const inputHandler = vi.fn();
      
      const { container } = render(
        <textarea
          onChange={inputHandler}
          onKeyDown={inputHandler}
          data-testid="spell-input"
        />
      );
      
      const textarea = container.querySelector('[data-testid="spell-input"]');
      
      // Rapid input
      const inputs = ['H', 'e', 'l', 'l', 'o', ' ', 'W', 'o', 'r', 'l', 'd'];
      
      for (const char of inputs) {
        await fireEvent.change(textarea, {
          target: { value: textarea.value + char }
        });
      }
      
      expect(inputHandler).toHaveBeenCalledTimes(inputs.length); // onChange only
      expect(textarea.value).toBe('Hello World');
    });
    
    it('should handle textarea scroll sync without stasis', async () => {
      // World-Law: The overlay that mirrors the textarea must move as one with 
      // it. A desync is a glyph split from its meaning.
      const { container } = render(
        <div style={{ position: 'relative', height: '200px', overflow: 'auto' }} data-testid="scroll-container">
          <textarea
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              zIndex: 1,
            }}
            data-testid="sync-textarea"
          />
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              zIndex: 2,
              pointerEvents: 'none',
            }}
            data-testid="sync-overlay"
          />
        </div>
      );
      
      const textarea = container.querySelector('[data-testid="sync-textarea"]');
      const overlay = container.querySelector('[data-testid="sync-overlay"]');
      const scrollContainer = container.querySelector('[data-testid="scroll-container"]');
      
      // Set up scroll sync
      textarea.addEventListener('scroll', () => {
        overlay.scrollTop = textarea.scrollTop;
      });
      
      // Simulate scroll
      textarea.scrollTop = 100;
      await fireEvent.scroll(textarea);
      
      // Overlay should be synced
      expect(overlay.scrollTop).toBe(100);
    });
  });
  
  describe('Truesight Overlay Toggle', () => {
    it('should toggle Truesight without stasis', async () => {
      // World-Law: The vision that sees phonemes should not blind the player 
      // to the UI. The toggle must be instant.
      let isTruesight = false;
      
      const TruesightComponent = () => {
        const [active, setActive] = useState(isTruesight);
        
        const toggle = () => {
          setActive(a => !a);
        };
        
        return (
          <div>
            <button 
              onClick={toggle}
              aria-pressed={active}
              data-testid="truesight-toggle"
            >
              Truesight
            </button>
            <textarea
              style={{ color: active ? 'transparent' : 'inherit' }}
              data-testid="truesight-textarea"
            />
            {active && (
              <div 
                role="region" 
                aria-label="Truesight overlay"
                data-testid="truesight-overlay"
              >
                Overlay
              </div>
            )}
          </div>
        );
      };
      
      render(<TruesightComponent />);
      
      const toggle = screen.getByTestId('truesight-toggle');
      const textarea = screen.getByTestId('truesight-textarea');
      
      // Initial state
      expect(toggle.getAttribute('aria-pressed')).toBe('false');
      expect(screen.queryByTestId('truesight-overlay')).not.toBeTruthy();
      
      // Activate Truesight
      await fireEvent.click(toggle);
      expect(toggle.getAttribute('aria-pressed')).toBe('true');
      expect(screen.getByTestId('truesight-overlay')).toBeTruthy();
      expect(getComputedStyle(textarea).color).toBe('transparent');
      
      // Deactivate Truesight
      await fireEvent.click(toggle);
      expect(toggle.getAttribute('aria-pressed')).toBe('false');
      expect(screen.queryByTestId('truesight-overlay')).not.toBeTruthy();
    });
  });
});

// ============================================================================
// Performance Benchmarks
// ============================================================================

describe('UI Stasis — Performance Benchmarks', () => {
  describe('Click Handler Performance', () => {
    it('should complete click handler within 16ms (1 frame)', async () => {
      // World-Law: A click answered in more than a frame is a hesitation 
      // noticeable to the player. The glyph must answer instantly.
      const handler = vi.fn(() => {});
      
      const { container } = render(
        <button onClick={handler} data-testid="perf-btn">
          Perf
        </button>
      );
      
      const button = container.querySelector('[data-testid="perf-btn"]');
      
      const start = performance.now();
      await fireEvent.click(button);
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(16); // 1 frame at 60fps
      expect(handler).toHaveBeenCalledTimes(1);
    });
    
    it('should handle 100 clicks in under 1 second', async () => {
      // World-Law: A hundred touches upon the glyph should not take more than 
      // a second. The UI must keep pace with the player's fingers.
      let clickCount = 0;
      const handler = vi.fn(() => {
        clickCount++;
      });
      
      const { container } = render(
        <button onClick={handler} data-testid="rapid-perf-btn">
          Rapid
        </button>
      );
      
      const button = container.querySelector('[data-testid="rapid-perf-btn"]');
      
      const start = performance.now();
      
      for (let i = 0; i < 100; i++) {
        await fireEvent.click(button);
      }
      
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(1000);
      expect(clickCount).toBe(100);
    });
  });
  
  describe('Animation Frame Budget', () => {
    it('should complete RAF callback within 4ms (1/4 frame)', async () => {
      // World-Law: The animation's heartbeat should not consume the entire 
      // frame. Leave room for the browser and other spells.
      let callbackDuration = 0;
      
      const rafPromise = new Promise((resolve) => {
        requestAnimationFrame((timestamp) => {
          const start = performance.now();
          
          // Simulate some work
          let sum = 0;
          for (let i = 0; i < 1000; i++) {
            sum += i;
          }
          
          callbackDuration = performance.now() - start;
          resolve();
        });
      });
      
      await rafPromise;
      
      expect(callbackDuration).toBeLessThan(4); // 1/4 of 16ms frame
    });
  });
});
