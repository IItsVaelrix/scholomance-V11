import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Storage } from '../lib/platform/storage';

const ThemeContext = createContext(null);

/**
 * ThemeProvider — manages dark/light theme state.
 * Persists preference to storage and sets data-theme attribute on <html>.
 */
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    return Storage.getItem('scholomance-theme') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    Storage.setItem('scholomance-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * useTheme — access current theme and toggle function.
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
