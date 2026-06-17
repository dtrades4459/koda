// Supabase CRUD for the multi-account registry (public.accounts), plus a
// first-load backfill that gives existing users a default account so nothing
// breaks. Follows the existing data-module pattern (auth.getUser → user_id).

import { supabase } from "../lib/supabase";
import type { Account, AccountType, DrawdownType, Trade } from "../types";

const uuid = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function fromRow(r: Record<string, unknown>): Account {
  return {
    id: r.id as string,
    name: r.name as string,
    type: (r.type as AccountType) ?? "personal",
    propFirm: (r.prop_firm as string | null) ?? null,
    accountSize: (r.account_size as number | null) ?? null,
    startingBalance: (r.starting_balance as number | null) ?? null,
    profitTarget: (r.profit_target as number | null) ?? null,
    maxDrawdown: (r.max_drawdown as number | null) ?? null,
    drawdownType: (r.drawdown_type as DrawdownType) ?? "trailing",
    isArchived: Boolean(r.is_archived),
    sortOrder: (r.sort_order as number) ?? 0,
    createdAt: r.created_at as string,
  };
}

export interface AccountInput {
  name: string;
  type: AccountType;
  propFirm?: string | null;
  accountSize?: number | null;
  startingBalance?: number | null;
  profitTarget?: number | null;
  maxDrawdown?: number | null;
  drawdownType?: DrawdownType;
  sortOrder?: number;
}

function toRow(input: Partial<AccountInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (input.name !== undefined) row.name = input.name;
  if (input.type !== undefined) row.type = input.type;
  if (input.propFirm !== undefined) row.prop_firm = input.propFirm;
  if (input.accountSize !== undefined) row.account_size = input.accountSize;
  if (input.startingBalance !== undefined) row.starting_balance = input.startingBalance;
  if (input.profitTarget !== undefined) row.profit_target = input.profitTarget;
  if (input.maxDrawdown !== undefined) row.max_drawdown = input.maxDrawdown;
  if (input.drawdownType !== undefined) row.drawdown_type = input.drawdownType;
  if (input.sortOrder !== undefined) row.sort_order = input.sortOrder;
  return row;
}

export async function listAccounts(): Promise<Account[]> {
  const { data, error } = await supabase.from("accounts").select("*").order("sort_order");
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

export async function createAccount(input: AccountInput): Promise<Account> {
  const { data: userResp } = await supabase.auth.getUser();
  const uid = userResp.user?.id;
  if (!uid) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("accounts")
    .insert({ user_id: uid, ...toRow(input) })
    .select("*")
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function updateAccount(id: string, patch: Partial<AccountInput>): Promise<void> {
  const { error } = await supabase.from("accounts").update(toRow(patch)).eq("id", id);
  if (error) throw error;
}

export async function archiveAccount(id: string): Promise<void> {
  const { error } = await supabase.from("accounts").update({ is_archived: true }).eq("id", id);
  if (error) throw error;
}

/**
 * Ensure the user has at least one account and that every trade is attributed.
 * Returns the default account (existing or freshly created) and a trades array
 * with any unattributed rows stamped. The caller persists `stampedTrades` to the
 * KV blob only when `changed` is true.
 */
export async function ensureDefaultAccount(
  trades: Trade[],
): Promise<{ accounts: Account[]; defaultAccount: Account; stampedTrades: Trade[]; changed: boolean }> {
  let accounts = await listAccounts();
  let defaultAccount = accounts.find(a => !a.isArchived) ?? accounts[0];

  if (!defaultAccount) {
    defaultAccount = await createAccount({ name: "My Account", type: "personal" });
    accounts = [defaultAccount, ...accounts];
  }

  let changed = false;
  const stampedTrades = trades.map(t => {
    if (t.accountId) return t;
    changed = true;
    return { ...t, accountId: defaultAccount!.id, groupId: t.groupId ?? uuid() };
  });

  return { accounts, defaultAccount, stampedTrades, changed };
}
