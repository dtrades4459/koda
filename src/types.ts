// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface TradeComment {
  id: number;
  author: string;
  text: string;
  ts: string;
}

/** Reactions are stored as arrays of user codes (one entry per reactor).
 *  Legacy data may contain a plain number — always normalise before display. */
export type ReactionMap = Record<string, string[] | number>;

export interface Trade {
  id: number;
  date: string;
  pair: string;
  session: string;
  bias: string;
  strategy: string;
  setup: string;
  entryPrice: string;
  slPrice: string;
  tpPrice: string;
  rr: string;
  outcome: string;
  pnl: string;
  notes: string;
  emotions: string;
  screenshot: string;
  pnlDollar: string;
  entryTime?: string;
  exitTime?: string;
  direction?: string;
  comments: TradeComment[];
  reactions: ReactionMap;
  createdAt?: string;
  updatedAt?: string;
  mae?: string;
  mfe?: string;
}

export interface Profile {
  name: string;
  handle: string;
  bio: string;
  avatar: string;
  broker: string;
  timezone: string;
  startDate: string;
  targetRR: string;
  maxTradesPerDay: string;
  uid?: string;
  code?: string;
  /** Short display alias shown on leaderboards instead of the raw code hash.
   *  3–12 chars, letters/numbers only. Does not affect storage keys. */
  alias?: string;
  /** Set to true once the user completes the onboarding flow. */
  onboarded?: boolean;
  /** If true, this user's trades are visible on their public profile. */
  publicTrades?: boolean;
  /** Futures instruments the user primarily trades (e.g. ["ES", "NQ"]). */
  instruments?: string[];
  /** Social media handles. */
  socialLinks?: { twitter?: string };
  /** Subscription plan tier. */
  plan?: "free" | "pro" | "elite";
  /** Stripe customer ID for billing portal / checkout. */
  stripeCustomerId?: string;
  /** User email (from auth session — populated at load time). */
  email?: string;
  /** Max daily loss in R before kill switch activates. 0 = disabled. */
  maxDailyLoss?: string;
  /** Account balance in $ for position size calculator. */
  accountBalance?: string;
}

export interface CircleMember {
  name: string;
  handle: string;
  avatar: string;
  code: string;
  joinedAt: string;
}

export interface Circle {
  metric?: "dollar" | "r" | "winrate" | "trades" | "avgr";
  id: number;
  code: string;
  name: string;
  description: string;
  strategy: string;
  privacy: "public" | "private";
  createdBy: string;
  createdAt: string;
  members: CircleMember[];
  isOwner: boolean;
}

export interface Insight {
  kicker: string;
  text: string;
  type: "info" | "warning" | "positive" | "danger";
}

export interface StrategyDef {
  code: string;
  setups: string[];
  checklist: string[];
  rules: string[];
}
