export interface Scroll {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  submittedAt?: number | null;
  authorId: string;
}

export interface XPEvent {
  source: string;
  amount: number;
  timestamp: number;
  playerId: string;
  context?: Record<string, unknown>;
}
