import { useState, useCallback, useMemo, useEffect } from "react";
import { z } from "zod";

const LOCAL_STORAGE_KEY = "scholomance.scrolls.v1";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CSRF_HEADER = "x-csrf-token";

const generateUuid = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    // Per RFC 4122 v4
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
  const part1 = `${s4()}${s4()}`;
  const part2 = s4();
  const part3 = `4${s4().slice(1)}`;
  const part4 = ((8 + Math.floor(Math.random() * 4)).toString(16)) + s4().slice(1);
  const part5 = `${s4()}${s4()}${s4()}`;
  return `${part1}-${part2}-${part3}-${part4}-${part5}`;
};

const generateId = () => generateUuid();

const readLocalScrolls = () => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Failed to read local scrolls:", error);
    return [];
  }
};

const writeLocalScrolls = (scrolls) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(scrolls));
  } catch (error) {
    console.error("Failed to persist local scrolls:", error);
  }
};

let cachedCsrfToken = null;
let csrfPromise = null;

const getCsrfToken = async () => {
  if (cachedCsrfToken) return cachedCsrfToken;
  if (csrfPromise) return csrfPromise;
  csrfPromise = fetch("/auth/csrf-token", { credentials: "include" })
    .then((res) => {
      if (!res.ok) {
        throw new Error("Failed to fetch CSRF token");
      }
      return res.json();
    })
    .then((data) => {
      cachedCsrfToken = data?.token || null;
      return cachedCsrfToken;
    })
    .catch((error) => {
      cachedCsrfToken = null;
      throw error;
    })
    .finally(() => {
      csrfPromise = null;
    });
  return csrfPromise;
};

const TimestampSchema = z.union([z.number(), z.string()]);
const ScrollSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  createdAt: TimestampSchema.optional(),
  updatedAt: TimestampSchema.optional()
}).passthrough();
const ScrollListSchema = z.array(ScrollSchema);

export function useScrolls() {
  const [scrolls, setScrolls] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch initial scrolls from the server
  useEffect(() => {
    const localScrolls = readLocalScrolls();
    if (localScrolls.length) {
      setScrolls(localScrolls);
    }

    const fetchScrolls = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/scrolls', { credentials: "include" });
        if (response.ok) {
          const data = await response.json();
          const parsed = ScrollListSchema.safeParse(data);
          if (!parsed.success) {
            throw new Error("Invalid scroll list payload");
          }
          setScrolls(parsed.data);
          writeLocalScrolls(parsed.data);
        } else if (response.status === 401) {
          console.log("Not logged in, no scrolls to load.");
        } else {
          console.error("Failed to fetch scrolls:", response.statusText);
        }
      } catch (error) {
        console.error("Error fetching scrolls:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchScrolls();
  }, []);

  const saveScroll = useCallback(async (scrollData) => {
    const isNew = !scrollData.id || !UUID_REGEX.test(scrollData.id);
    const id = isNew ? generateId() : scrollData.id;
    const legacyId = scrollData.id && scrollData.id !== id ? scrollData.id : null;
    const now = new Date().toISOString();

    const scroll = {
      title: scrollData.title?.trim() || "Untitled Scroll",
      content: scrollData.content?.trim() || "",
    };

    const localScroll = {
      id,
      title: scroll.title,
      content: scroll.content,
      createdAt: scrollData.createdAt || now,
      updatedAt: now,
    };

    setScrolls((prev) => {
      const baseList = legacyId ? prev.filter((s) => s.id !== legacyId) : prev;
      const index = baseList.findIndex((s) => s.id === id);
      if (index > -1) {
        const existing = baseList[index];
        const newScrolls = [...baseList];
        newScrolls[index] = {
          ...existing,
          ...localScroll,
          createdAt: existing.createdAt || localScroll.createdAt,
        };
        writeLocalScrolls(newScrolls);
        return newScrolls;
      }
      const newScrolls = [localScroll, ...baseList];
      writeLocalScrolls(newScrolls);
      return newScrolls;
    });

    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(`/api/scrolls/${id}`, {
        method: 'POST',
        credentials: "include",
        headers: {
          'Content-Type': 'application/json',
          [CSRF_HEADER]: csrfToken,
        },
        body: JSON.stringify(scroll),
      });

      if (!response.ok) {
        throw new Error(`Failed to save scroll to server: ${response.status}`);
      }

      const savedScroll = await response.json();
      const parsed = ScrollSchema.safeParse(savedScroll);
      if (!parsed.success) {
        throw new Error("Invalid scroll payload");
      }

      setScrolls((prev) => {
        const baseList = legacyId ? prev.filter((s) => s.id !== legacyId) : prev;
        const index = baseList.findIndex((s) => s.id === id);
        if (index > -1) {
          const newScrolls = [...baseList];
          newScrolls[index] = parsed.data;
          writeLocalScrolls(newScrolls);
          return newScrolls;
        }
        const newScrolls = [parsed.data, ...baseList];
        writeLocalScrolls(newScrolls);
        return newScrolls;
      });

      return parsed.data;
    } catch (e) {
      console.error("Failed to save scroll to server, using local copy.", e);
      return localScroll;
    }
  }, []);

  const deleteScroll = useCallback(async (id) => {
    setScrolls((prev) => {
      const next = prev.filter((s) => s.id !== id);
      writeLocalScrolls(next);
      return next;
    });
    try {
      const csrfToken = await getCsrfToken();
      const response = await fetch(`/api/scrolls/${id}`, {
        method: 'DELETE',
        credentials: "include",
        headers: {
          [CSRF_HEADER]: csrfToken,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete scroll from server');
      }
    } catch (e) {
      console.error("Failed to delete scroll from server, keeping local state.", e);
    }
  }, []);

  const getScrollById = useCallback(
    (id) => scrolls.find((s) => s.id === id) || null,
    [scrolls]
  );

  const sortedScrolls = useMemo(
    () => [...scrolls].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
    [scrolls]
  );

  return {
    scrolls: sortedScrolls,
    isLoading,
    saveScroll, // Replaces createScroll and updateScroll
    deleteScroll,
    getScrollById,
    scrollCount: scrolls.length,
  };
}
