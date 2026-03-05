import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { z } from "zod";

const UserSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string(),
}).passthrough();

const AuthContext = createContext(null);
const AUTH_SESSION_HINT_KEY = "scholomance.auth.session.v1";

function setSessionHint(isAuthenticated) {
  if (typeof window === "undefined") return;
  try {
    if (isAuthenticated) {
      window.localStorage.setItem(AUTH_SESSION_HINT_KEY, "1");
    } else {
      window.localStorage.removeItem(AUTH_SESSION_HINT_KEY);
    }
  } catch {
    // Ignore storage failures (private mode, disabled storage, etc.).
  }
}

function hasSessionHint() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(AUTH_SESSION_HINT_KEY) === "1";
  } catch {
    return false;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCsrfToken = useCallback(async () => {
    try {
      const res = await fetch('/auth/csrf-token', { credentials: 'include' });
      if (res.ok) {
        const { token } = await res.json();
        return token;
      }
    } catch (e) {
      console.error("Failed to fetch CSRF token", e);
    }
    return null;
  }, []);

  const checkMe = useCallback(async (options = {}) => {
    const force = Boolean(options?.force);
    if (!force && !hasSessionHint()) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/auth/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const parsed = UserSchema.safeParse(data.user);
        if (parsed.success) {
          setUser(parsed.data);
          setSessionHint(true);
        } else {
          console.error("Invalid user data from /auth/me", parsed.error);
          setUser(null);
          setSessionHint(false);
        }
      } else {
        setUser(null);
        if (res.status === 401 || res.status === 403) {
          setSessionHint(false);
        }
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
      credentials: 'include',
      body: JSON.stringify({ username, password })
    });

    if (res.ok) {
      setSessionHint(true);
      await checkMe({ force: true });
      return { success: true };
    } else {
      const err = await res.json();
      return { success: false, message: err.message || 'Login failed' };
    }
  };

  const register = async (username, email, password, captchaId, captchaAnswer) => {
    const token = await fetchCsrfToken();
    const res = await fetch('/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': token
      },
      credentials: 'include',
      body: JSON.stringify({ username, email, password, captchaId, captchaAnswer })
    });

    const data = await res.json();
    if (res.ok) {
      return { success: true, ...data };
    } else {
      return { success: false, message: data.message || 'Registration failed' };
    }
  };

  const logout = async () => {
    const token = await fetchCsrfToken();
    await fetch('/auth/logout', {
      method: 'POST',
      headers: { 'x-csrf-token': token },
      credentials: 'include'
    });
    setSessionHint(false);
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
