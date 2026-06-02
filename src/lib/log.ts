// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · centralized logger
//
// Tiny wrapper that:
//   • always console.* (so dev experience stays the same)
//   • forwards to Sentry if it's been initialized (see lib/sentry.ts)
//   • lets every call site tag a `scope` so production logs are searchable
//
// Use this instead of bare console.error inside data modules and effects so
// silent failures stop being silent.
// ═══════════════════════════════════════════════════════════════════════════════

type Ctx = Record<string, unknown> | undefined;

function getSentry(): any | null {
  // Sentry is loaded lazily and may or may not be present. We never import it
  // statically so the bundle stays small if it's not configured.
  const w = (typeof window !== "undefined" ? (window as any) : null);
  return w?.Sentry ?? null;
}

export const log = {
  info(scope: string, msg: string, ctx?: Ctx) {
    console.log(`[KODA][${scope}]`, msg, ctx ?? "");
  },

  warn(scope: string, msg: string, ctx?: Ctx) {
    console.warn(`[KODA][${scope}]`, msg, ctx ?? "");
    getSentry()?.captureMessage?.(msg, {
      level: "warning",
      tags: { scope },
      extra: ctx,
    });
  },

  error(scope: string, err: unknown, ctx?: Ctx) {
    console.error(`[KODA][${scope}]`, err, ctx ?? "");
    const sentry = getSentry();
    if (!sentry) return;
    if (err instanceof Error) {
      sentry.captureException?.(err, { tags: { scope }, extra: ctx });
    } else {
      sentry.captureMessage?.(extractMessage(err), {
        level: "error",
        tags: { scope },
        extra: { ...(ctx ?? {}), original: safeSerialize(err) },
      });
    }
  },
};

// Pull a human-readable string out of anything thrown. Plain objects (e.g. a
// PostgrestError or a fetch Response shape) used to land in Sentry as the
// title "[object Object]" via String(err) — useless for triage. Try common
// fields first, fall back to JSON, fall back to a tag.
function extractMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err == null) return "Unknown error (null/undefined)";
  if (typeof err !== "object") return String(err);
  const o = err as Record<string, unknown>;
  const candidates = [o.message, o.error_description, o.error, o.statusText, o.code, o.name];
  for (const c of candidates) {
    if (typeof c === "string" && c.length > 0) return c;
  }
  const json = safeSerialize(err);
  return json === "{}" ? "Unknown error (empty object)" : json;
}

function safeSerialize(value: unknown): string {
  try {
    return JSON.stringify(value, (_k, v) => (v instanceof Error ? { name: v.name, message: v.message, stack: v.stack } : v));
  } catch {
    return "[unserialisable]";
  }
}

/**
 * Wrap an async function so any thrown error is logged with a scope and a
 * fallback value is returned. Use at the boundary of effects so a single
 * failed read doesn't crash a whole screen.
 */
export async function safe<T>(scope: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    log.error(scope, e);
    return fallback;
  }
}
