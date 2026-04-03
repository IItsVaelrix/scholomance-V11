# UI Stasis QA — Quick Reference Card

> **Keep this open while developing interactive components.**

---

## 🚫 The Five Sins of UI Stasis

| Sin | Symptom | Fix | Bytecode |
|-----|---------|-----|----------|
| **The Frozen Glyph** | Button clicks do nothing | Add timeout + recovery | `UI_STASIS-0E01` |
| **The Ghost Animation** | Animation plays after unmount | Cleanup in useEffect return | `UI_STASIS-0E02` |
| **The Phantom Ear** | Event listener persists | RemoveEventListener in cleanup | `UI_STASIS-0E03` |
| **The Endless Loop** | RAF/interval runs forever | Cancel on unmount | `UI_STASIS-0E06/0E07` |
| **The Broken Prison** | Focus trap has no escape | Handle Escape key | `UI_STASIS-0E04` |

---

## ✅ Pre-Commit Checklist

Before committing any interactive component:

### Click Handlers
- [ ] Handler completes in <5 seconds
- [ ] Loading state clears on error
- [ ] Disabled state prevents clicks
- [ ] Async handler doesn't block UI

```javascript
// ✅ GOOD
const handleClick = async () => {
  setIsLoading(true);
  try {
    await saveData();
  } catch (err) {
    // Handle error
  } finally {
    setIsLoading(false); // Always clear!
  }
};

// ❌ BAD - Loading state never clears on error
const handleClick = async () => {
  setIsLoading(true);
  await saveData(); // Throws → loading stuck
  setIsLoading(false);
};
```

### Animations
- [ ] useEffect returns cleanup function
- [ ] RAF/interval cancelled in cleanup
- [ ] Animation doesn't update state after unmount

```javascript
// ✅ GOOD
useEffect(() => {
  let rafId = requestAnimationFrame(animate);
  return () => cancelAnimationFrame(rafId);
}, []);

// ❌ BAD - RAF orphaned
useEffect(() => {
  requestAnimationFrame(animate);
  // No cleanup!
}, []);
```

### Event Listeners
- [ ] Every addEventListener has removeEventListener
- [ ] Document/window listeners cleaned up
- [ ] Event bus subscriptions unsubscribed

```javascript
// ✅ GOOD
useEffect(() => {
  const handler = () => {};
  document.addEventListener('scroll', handler);
  return () => document.removeEventListener('scroll', handler);
}, []);

// ❌ BAD - Listener leak
useEffect(() => {
  document.addEventListener('scroll', handler);
  // No cleanup!
}, []);
```

### Focus Traps
- [ ] Escape key dismisses modal
- [ ] Focus returns to trigger on close
- [ ] Tab cycles within trap

```javascript
// ✅ GOOD
useEffect(() => {
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose();
  };
  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, [onClose]);
```

### Pointer Capture
- [ ] setPointerCapture paired with release
- [ ] lostpointercapture handled
- [ ] Capture released on unmount

```javascript
// ✅ GOOD
const handlePointerDown = (e) => {
  e.target.setPointerCapture(e.pointerId);
};

const handlePointerUp = (e) => {
  e.target.releasePointerCapture(e.pointerId);
};

const handleLostCapture = () => {
  // Handle gracefully
};

// ❌ BAD - No release, no lost handler
const handlePointerDown = (e) => {
  e.target.setPointerCapture(e.pointerId);
  // Never released!
};
```

---

## 🧪 Quick Test Commands

```bash
# Run UI stasis tests
npm test tests/qa/ui-stasis-bytecode.test.js

# Run visual regression
npm run test:visual

# Run accessibility tests
npm run test:a11y

# Run all QA tests
npm run test:qa
```

---

## 🐛 Debugging Stasis

### Button Frozen in Loading State

```javascript
// Add debug logging
useEffect(() => {
  console.log('Loading state:', isLoading);
  if (isLoading) {
    const timeout = setTimeout(() => {
      console.warn('⚠️ Loading state stuck for >5s');
    }, 5000);
    return () => clearTimeout(timeout);
  }
}, [isLoading]);
```

### Animation Not Cleaning Up

```javascript
// Add cleanup tracking
useEffect(() => {
  let cleanupCalled = false;
  
  const animate = () => {
    if (cleanupCalled) {
      console.error('❌ Animation running after cleanup!');
      return;
    }
    // ... animate
  };
  
  const rafId = requestAnimationFrame(animate);
  
  return () => {
    cleanupCalled = true;
    cancelAnimationFrame(rafId);
  };
}, []);
```

### Event Listener Leak

```javascript
// Track listener count
useEffect(() => {
  const before = getListenerCount('scroll');
  document.addEventListener('scroll', handler);
  
  return () => {
    document.removeEventListener('scroll', handler);
    const after = getListenerCount('scroll');
    if (after !== before) {
      console.error('❌ Listener leak detected!');
    }
  };
}, []);
```

---

## 📊 Performance Budgets

| Metric | Budget | How to Test |
|--------|--------|-------------|
| Click handler | <16ms | DevTools Performance tab |
| 100 clicks | <1s | `tests/qa/ui-stasis-bytecode.test.js` |
| RAF callback | <4ms | `performance.now()` in callback |
| Animation FPS | ≥58 | DevTools Performance |

---

## 🔤 Bytecode Error Decoder

When you see an error like:
```
PB-ERR-v1-UI_STASIS-CRIT-UISTAS-0E01-eyJ...-A1B2C3D4
```

**Decode it:**
```javascript
const bytecode = 'PB-ERR-v1-UI_STASIS-CRIT-UISTAS-0E01-eyJ...';
const parts = bytecode.split('-');
const category = parts[2];  // UI_STASIS
const severity = parts[3];  // CRIT
const module = parts[4];    // UISTAS
const code = parts[5];      // 0E01
const context = JSON.parse(atob(parts[6]));

console.log('Error:', ERROR_CODES[code]);
console.log('Context:', context);
```

**Common Codes:**
- `0E01` = Click handler stall
- `0E02` = Animation lifecycle hang
- `0E03` = Event listener leak
- `0E04` = Focus trap escape
- `0E05` = Pointer capture failure
- `0E06` = RAF loop orphan
- `0E07` = Interval timer leak

---

## 🎯 World-Law Reminders

> **The Law of Response:** Every touch must be answered within one frame.

> **The Law of Lifecycle:** No animation may outlive its vessel.

> **The Law of State:** State transitions must be atomic.

> **The Law of Voluntary Confinement:** A focus trap must have a key.

---

## 📞 Escalation Path

| Severity | Response | Contact |
|----------|----------|---------|
| FATAL | Immediate | @Angel + all agents |
| CRIT | <4 hours | @Claude (UI) or @Codex (logic) |
| WARN | <24 hours | @Claude |
| INFO | Next sprint | @Blackbox (add test) |

---

## 🔗 Reference Documents

- **Full QA Methodology:** `tests/qa/QA_METHODOLOGY.md`
- **Bytecode Error System:** `docs/ByteCode Error System/01_Bytecode_Error_System_Overview.md`
- **Error Code Reference:** `docs/ByteCode Error System/02_Error_Code_Reference.md`
- **Test Suite:** `tests/qa/ui-stasis-bytecode.test.js`
- **UI Spec:** `src/components/UI_SPEC.md` (for new components)

---

**Print this card. Tape it to your monitor. Let it haunt your commits.**
