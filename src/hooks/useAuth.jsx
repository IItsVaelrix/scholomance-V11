import { createContext, useContext, useState, useEffect, useCallback } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [csrfToken, setCsrfToken] = useState(null);

  const fetchCsrfToken = useCallback(async () => {
    try {
      const res = await fetch('/auth/csrf-token');
      if (res.ok) {
        const { token } = await res.json();
        setCsrfToken(token);
        return token;
      }
    } catch (e) {
      console.error("Failed to fetch CSRF token", e);
    }
    return null;
  }, []);

  const checkMe = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (e) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkMe();
    fetchCsrfToken();
  }, [checkMe, fetchCsrfToken]);

  const login = async (username, password) => {
    const token = await fetchCsrfToken();
    const res = await fetch('/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': token
      },
      body: JSON.stringify({ username, password })
    });

    if (res.ok) {
      await checkMe();
      return { success: true };
    } else {
      const err = await res.json();
      return { success: false, message: err.message || 'Login failed' };
    }
  };

  const register = async (username, email, password) => {
    const token = await fetchCsrfToken();
    const res = await fetch('/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': token
      },
      body: JSON.stringify({ username, email, password })
    });

    if (res.ok) {
      return { success: true };
    } else {
      const err = await res.json();
      return { success: false, message: err.message || 'Registration failed' };
    }
  };

  const logout = async () => {
    const token = await fetchCsrfToken();
    await fetch('/auth/logout', {
      method: 'POST',
      headers: { 'x-csrf-token': token }
    });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, checkMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
