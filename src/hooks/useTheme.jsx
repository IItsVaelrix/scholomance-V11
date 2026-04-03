import { createContext, useContext, useState, useEffect } from 'react';
import { Storage } from '../lib/platform/storage';

const ThemeContext = createContext(null);

/**
 * ThemeProvider — manages application theme state.
 * Scholomance V11 is strictly Dark Mode per Vaelrix Law.
 */
export function ThemeProvider({ children }) {
  const [theme] = useState('dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    Storage.setItem('scholomance-theme', 'dark');
  }, []);

  return (
    <ThemeContext.Provider value={{ theme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * useTheme — access current theme.
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  // V11 is strictly dark mode — return safe default when used outside ThemeProvider
  // (e.g. in isolated component tests or lazy-loaded subtrees).
  if (!context) {
    return { theme: 'dark' };
  }
  return context;
}
