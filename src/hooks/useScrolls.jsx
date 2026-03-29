import { useState, useCallback, useMemo, useEffect } from "react";
import { z } from "zod";
import { Storage } from "../lib/platform/storage";
import { useAuth } from "./useAuth.jsx";

const LEGACY_LOCAL_STORAGE_KEY = "scholomance.scrolls.v1";
const LOCAL_SCROLL_INDEX_KEY = "scholomance.scrolls.v2.index";
const LOCAL_SCROLL_ITEM_PREFIX = "scholomance.scrolls.v2.item.";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CSRF_HEADER = "x-csrf-token";
const INDEX_VERSION = 2;
const PREVIEW_MAX_LENGTH = 120;

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
  updatedAt: TimestampSchema.optional(),
  submittedAt: TimestampSchema.nullish(),
}).passthrough();
const ScrollListSchema = z.array(ScrollSchema);
const ScrollIndexSchema = z.object({
  version: z.number().optional(),
  ids: z.array(z.string()),
}).passthrough();

const getStorage = () => {
  if (typeof window === "undefined") return null;
  try {
    return Storage;
  } catch {
    return null;
  }
};

const getScrollStorageKey = (id) => `${LOCAL_SCROLL_ITEM_PREFIX}${id}`;

const isWordCharCode = (charCode) => {
  return (
    (charCode >= 48 && charCode <= 57) ||
    (charCode >= 65 && charCode <= 90) ||
    (charCode >= 97 && charCode <= 122) ||
    charCode === 39
  );
};

const countWords = (value) => {
  if (!value) return 0;
  let count = 0;
  let inWord = false;
  for (let i = 0; i < value.length; i += 1) {
    const isWordChar = isWordCharCode(value.charCodeAt(i));
    if (isWordChar && !inWord) {
      count += 1;
      inWord = true;
    } else if (!isWordChar) {
      inWord = false;
    }
  }
  return count;
};

const toPreview = (content) => {
  const collapsed = String(content || "").replace(/\s+/g, " ").trim();
  if (!collapsed) return "";
  if (collapsed.length <= PREVIEW_MAX_LENGTH) return collapsed;
  return `${collapsed.slice(0, PREVIEW_MAX_LENGTH).trim()}...`;
};

const toMillis = (value) => {
  const parsed = new Date(value ?? 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const sortByUpdatedAtDesc = (a, b) => {
  return toMillis(b.updatedAt) - toMillis(a.updatedAt);
};

const withDerivedFields = (rawScroll, fallbackTimestamp = new Date().toISOString()) => {
  const id = String(rawScroll?.id || "");
  if (!id) return null;

  const title = String(rawScroll?.title || "").trim() || "Untitled Scroll";
  const content = String(rawScroll?.content || "");
  const createdAt = rawScroll?.createdAt || fallbackTimestamp;
  const updatedAt = rawScroll?.updatedAt || createdAt || fallbackTimestamp;

  return {
    ...rawScroll,
    id,
    title,
    content,
    createdAt,
    updatedAt,
    submittedAt: rawScroll?.submittedAt ?? null,
    preview: toPreview(content),
    wordCount: countWords(content),
    charCount: content.length,
  };
};

const parseIndexIds = (rawValue) => {
  if (!rawValue) return [];
  try {
    const parsed = JSON.parse(rawValue);
    if (Array.isArray(parsed)) {
      return parsed.filter((id) => typeof id === "string" && id.length > 0);
    }
    const schemaResult = ScrollIndexSchema.safeParse(parsed);
    if (schemaResult.success) {
      return schemaResult.data.ids.filter((id) => typeof id === "string" && id.length > 0);
    }
    return [];
  } catch {
    return [];
  }
};

const readIndexIds = (storage) => {
  const raw = storage.getItem(LOCAL_SCROLL_INDEX_KEY);
  if (raw == null) return null;
  return parseIndexIds(raw);
};

const writeIndexIds = (storage, ids) => {
  const payload = {
    version: INDEX_VERSION,
    ids,
  };
  storage.setItem(LOCAL_SCROLL_INDEX_KEY, JSON.stringify(payload));
};

const readLegacyScrolls = (storage) => {
  const raw = storage.getItem(LEGACY_LOCAL_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    const schemaResult = ScrollListSchema.safeParse(parsed);
    if (!schemaResult.success) return [];

    const normalized = [];
    for (const scroll of schemaResult.data) {
      const enriched = withDerivedFields(scroll);
      if (enriched) normalized.push(enriched);
    }
    normalized.sort(sortByUpdatedAtDesc);
    return normalized;
  } catch (error) {
    console.error("Failed to read legacy local scrolls:", error);
    return [];
  }
};

const readV2Scrolls = (storage) => {
  const ids = readIndexIds(storage);
  if (ids === null) return null;

  const scrolls = [];
  for (const id of ids) {
    const raw = storage.getItem(getScrollStorageKey(id));
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const schemaResult = ScrollSchema.safeParse(parsed);
      if (!schemaResult.success) continue;
      const enriched = withDerivedFields(schemaResult.data);
      if (enriched) scrolls.push(enriched);
    } catch {
      // Ignore malformed individual entries and continue loading the rest.
    }
  }
  return scrolls;
};

const writeLocalScrollSnapshot = (scrolls) => {
  const storage = getStorage();
  if (!storage) return;

  try {
    const normalized = [];
    for (const scroll of scrolls) {
      const enriched = withDerivedFields(scroll);
      if (enriched) normalized.push(enriched);
    }
    normalized.sort(sortByUpdatedAtDesc);

    const previousIds = readIndexIds(storage) || [];
    const nextIds = normalized.map((scroll) => scroll.id);
    const nextIdSet = new Set(nextIds);

    for (const scroll of normalized) {
      storage.setItem(getScrollStorageKey(scroll.id), JSON.stringify(scroll));
    }
    for (const staleId of previousIds) {
      if (!nextIdSet.has(staleId)) {
        storage.removeItem(getScrollStorageKey(staleId));
      }
    }

    writeIndexIds(storage, nextIds);
  } catch (error) {
    console.error("Failed to write local scroll snapshot:", error);
  }
};

const upsertLocalScroll = (scroll) => {
  const storage = getStorage();
  if (!storage || !scroll?.id) return;

  try {
    storage.setItem(getScrollStorageKey(scroll.id), JSON.stringify(scroll));
    const existingIds = readIndexIds(storage) || [];
    const nextIds = [scroll.id, ...existingIds.filter((id) => id !== scroll.id)];
    writeIndexIds(storage, nextIds);
  } catch (error) {
    console.error("Failed to upsert local scroll:", error);
  }
};

const removeLocalScroll = (id) => {
  if (!id) return;
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.removeItem(getScrollStorageKey(id));
    const existingIds = readIndexIds(storage);
    if (existingIds) {
      writeIndexIds(storage, existingIds.filter((value) => value !== id));
    }
  } catch (error) {
    console.error("Failed to remove local scroll:", error);
  }
};

const readLocalScrolls = () => {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const v2 = readV2Scrolls(storage);
    if (v2) {
      return v2;
    }

    const legacy = readLegacyScrolls(storage);
    if (!legacy.length) return [];

    writeLocalScrollSnapshot(legacy);
    storage.removeItem(LEGACY_LOCAL_STORAGE_KEY);
    return legacy;
  } catch (error) {
    console.error("Failed to read local scrolls:", error);
    return [];
  }
};

const upsertByRecency = (list, scroll, legacyId = null) => {
  const next = [];
  for (const item of list) {
    if (item.id === scroll.id) continue;
    if (legacyId && item.id === legacyId) continue;
    next.push(item);
  }
  return [scroll, ...next];
};

export function useScrolls() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [scrolls, setScrolls] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch server-backed scrolls once authentication has resolved.
  useEffect(() => {
    const localScrolls = readLocalScrolls();
    if (localScrolls.length) {
      setScrolls(localScrolls);
    }

    if (isAuthLoading) {
      setIsLoading(true);
      return;
    }

    if (!user) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const fetchScrolls = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/scrolls', { credentials: "include" });
        if (cancelled) return;
        if (response.ok) {
          const data = await response.json();
          const parsed = ScrollListSchema.safeParse(data);
          if (!parsed.success) {
            throw new Error("Invalid scroll list payload");
          }
          const normalized = parsed.data
            .map((scroll) => withDerivedFields(scroll))
            .filter(Boolean)
            .sort(sortByUpdatedAtDesc);
          setScrolls(normalized);
          writeLocalScrollSnapshot(normalized);
        } else if (response.status === 401) {
          console.log("Not logged in, no scrolls to load.");
        } else {
          console.error("Failed to fetch scrolls:", response.statusText);
        }
      } catch (error) {
        if (cancelled) return;
        console.error("Error fetching scrolls:", error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };
    fetchScrolls();
    return () => {
      cancelled = true;
    };
  }, [user, isAuthLoading]);

  const saveScroll = useCallback(async (scrollData) => {
    const isNew = !scrollData.id || !UUID_REGEX.test(scrollData.id);
    const id = isNew ? generateId() : scrollData.id;
    const legacyId = scrollData.id && scrollData.id !== id ? scrollData.id : null;
    const now = new Date().toISOString();
    const submit = Boolean(scrollData.submit);
    const submittedAt = scrollData?.submittedAt || (submit ? now : null);

    const scroll = {
      title: scrollData.title?.trim() || "Untitled Scroll",
      content: scrollData.content?.trim() || "",
      submit,
    };

    const localScroll = withDerivedFields({
      id,
      title: scroll.title,
      content: scroll.content,
      createdAt: scrollData.createdAt || now,
      updatedAt: now,
      submittedAt,
    }, now);
    if (!localScroll) return null;

    setScrolls((prev) => upsertByRecency(prev, localScroll, legacyId));
    upsertLocalScroll(localScroll);
    if (legacyId) removeLocalScroll(legacyId);

    if (!user) {
      return localScroll;
    }

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

      const normalizedServerScroll = withDerivedFields(parsed.data) || localScroll;
      setScrolls((prev) => upsertByRecency(prev, normalizedServerScroll, legacyId));
      upsertLocalScroll(normalizedServerScroll);
      if (legacyId) removeLocalScroll(legacyId);

      return normalizedServerScroll;
    } catch (e) {
      console.error("Failed to save scroll to server, using local copy.", e);
      return localScroll;
    }
  }, [user]);

  const deleteScroll = useCallback(async (id) => {
    setScrolls((prev) => prev.filter((s) => s.id !== id));
    removeLocalScroll(id);

    if (!user) {
      return;
    }

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
  }, [user]);

  const scrollLookup = useMemo(() => {
    const lookup = new Map();
    for (const scroll of scrolls) {
      lookup.set(scroll.id, scroll);
    }
    return lookup;
  }, [scrolls]);

  const getScrollById = useCallback(
    (id) => scrollLookup.get(id) || null,
    [scrollLookup]
  );

  return {
    scrolls,
    isLoading,
    saveScroll, // Replaces createScroll and updateScroll
    deleteScroll,
    getScrollById,
    scrollCount: scrolls.length,
  };
}
