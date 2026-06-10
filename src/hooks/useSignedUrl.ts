import { useEffect, useState } from "react";
import { extractStoragePath, resolveScreenshotUrl } from "../lib/screenshots";

/** Resolve a stored screenshot value to a displayable URL at render time.
 *  Non-bucket values (data: URIs, external URLs) resolve synchronously;
 *  bucket URLs return "" for one render while the signed URL is fetched. */
export function useSignedUrl(stored: string | null | undefined): string {
  const isBucketUrl = !!stored && extractStoragePath(stored) !== null;
  const [url, setUrl] = useState(isBucketUrl ? "" : stored ?? "");

  useEffect(() => {
    let alive = true;
    if (!stored) { setUrl(""); return; }
    if (extractStoragePath(stored) === null) { setUrl(stored); return; }
    resolveScreenshotUrl(stored).then((u) => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [stored]);

  return url;
}
