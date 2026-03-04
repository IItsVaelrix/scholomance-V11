import type { LexicalEntry } from '../core/lexical.js';

export interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  ttl: number;
}

export type EventCallback<T = unknown> = (data: T) => void;
export type Unsubscribe = () => void;

export interface DictionaryAdapter {
  name: string;
  lookup: (word: string) => Promise<Partial<LexicalEntry> | null>;
}
