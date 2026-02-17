import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Storage } from '../lib/storage';

const IdeSkinContext = createContext(null);

const VALID_SKINS = ['default', 'jetbrains'];
const STORAGE_KEY = 'scholomance-ide-skin';

/**
 * IdeSkinProvider — manages IDE visual skin state.
 * Persists preference to storage and sets data-ide-skin attribute on <html>.
 */
export function IdeSkinProvider({ children }) {
  const [skin, setSkinRaw] = useState(() => {
    const stored = Storage.getItem(STORAGE_KEY);
    return VALID_SKINS.includes(stored) ? stored : 'default';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-ide-skin', skin);
    Storage.setItem(STORAGE_KEY, skin);
  }, [skin]);

  const setSkin = useCallback((value) => {
    if (VALID_SKINS.includes(value)) {
      setSkinRaw(value);
    }
  }, []);

  return (
    <IdeSkinContext.Provider value={{ skin, setSkin }}>
      {children}
    </IdeSkinContext.Provider>
  );
}

/**
 * useIdeSkin — access current IDE skin and setter.
 */
export function useIdeSkin() {
  const context = useContext(IdeSkinContext);
  if (!context) {
    throw new Error('useIdeSkin must be used within IdeSkinProvider');
  }
  return context;
}
