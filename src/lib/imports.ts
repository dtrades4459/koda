// ─── Import audit trail ──────────────────────────────────────────────────────
// Uploads the original CSV/XLSX a user just imported into the private
// `trade-imports` Storage bucket, then writes an audit row to public.imports.
// Failure is non-fatal: trades still save, we just don't get the audit row.
// See supabase/migrations/20260529_imports_audit_trail.sql.

import { supabase } from "./supabase";

const BUCKET = "trade-imports";

export interface PersistImportArgs {
  file: File;
  /** Broker preset key, e.g. "rithmic" / "tradovate" / null when no preset matched. */
  broker: string | null;
  /** "personal" | "funded" | "demo" (or null). */
  accountType: string | null;
  rowCount: number;
  importedCount: number;
  duplicateCount: number;
}

export interface PersistImportResult {
  importId: string;
  storagePath: string;
}

/**
 * Build the per-user storage path for a fresh import.
 * Exported so it can be unit-tested without a Supabase round-trip.
 *   `{userId}/{ISO-stamp}-{rand}.{ext}`
 */
export function buildImportStoragePath(userId: string, filename: string, now: Date = new Date()): string {
  const parts = filename.split(".");
  const rawExt = parts.length > 1 ? parts[parts.length - 1] : "";
  const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, "") || "csv";
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  const rand = Math.random().toString(36).slice(2, 8);
  return `${userId}/${stamp}-${rand}.${ext}`;
}

/**
 * Upload the original file and write the audit row. Returns null on any
 * failure (auth missing, upload rejected, RLS denial, network) — callers
 * should treat this as a best-effort enhancement, not a hard requirement.
 */
export async function persistImport(args: PersistImportArgs): Promise<PersistImportResult | null> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (userErr || !userId) {
    console.warn("[koda imports] no authenticated user — skipping audit trail");
    return null;
  }

  const storagePath = buildImportStoragePath(userId, args.file.name);

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, args.file, {
      upsert: false,
      contentType: args.file.type || "text/csv",
    });
  if (uploadErr) {
    console.warn("[koda imports] storage upload failed:", uploadErr.message);
    return null;
  }

  const { data: row, error: insertErr } = await supabase
    .from("imports")
    .insert({
      user_id:         userId,
      filename:        args.file.name,
      storage_path:    storagePath,
      broker:          args.broker,
      account_type:    args.accountType,
      row_count:       args.rowCount,
      imported_count:  args.importedCount,
      duplicate_count: args.duplicateCount,
      file_size_bytes: args.file.size,
    })
    .select("id")
    .single();

  if (insertErr || !row) {
    console.warn("[koda imports] audit row insert failed:", insertErr?.message);
    // Clean up the orphan file so we don't pile up garbage in storage.
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return null;
  }

  return { importId: row.id as string, storagePath };
}
