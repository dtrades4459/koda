// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · Discipline share card — canvas renderer + share helper
//
// Renders a DisciplineCardPayload to a 1200×675 PNG (X-native 16:9, reads fine
// on Discord) and hands it to navigator.share(files) where supported, falling
// back to a plain download. Brand colors are hardcoded — the card must look
// like Kōda on a stranger's feed regardless of the sharer's in-app theme.
//
// Gotchas handled here (spec Addendum §F):
//  - canvas taint: remote avatars are fetched → blob → ImageBitmap, never
//    drawn straight from a cross-origin URL
//  - fonts: Geist is loaded via document.fonts before drawing, else the first
//    share renders in the system fallback
// ═══════════════════════════════════════════════════════════════════════════════

import type { DisciplineCardPayload } from "./disciplineCard";
import { MONO, DISPLAY } from "../shared";

const W = 1200;
const H = 675;

// Brand tokens (DESIGN.md, dark) — intentionally not the live Theme object.
const BG = "#13110E";
const FG = "#EDEDE8";
const MUTED = "#8A8A82";
const DIM = "#55544E";
const ACCENT = "#7CA4F5"; // blue accent, hex for canvas compat (no oklch)
const BORDER = "rgba(237,237,232,0.10)";

async function loadFonts(): Promise<void> {
  // allSettled: a missing font face must never block the share — the canvas
  // falls back through the stack like the DOM does.
  await Promise.allSettled([
    document.fonts.load(`600 40px ${DISPLAY}`),
    document.fonts.load(`700 170px ${DISPLAY}`),
    document.fonts.load(`400 22px ${MONO}`),
    document.fonts.load(`600 24px ${MONO}`),
  ]);
}

/** Avatar → ImageBitmap without tainting the canvas. Null on any failure. */
async function loadAvatar(src: string): Promise<ImageBitmap | null> {
  if (!src) return null;
  try {
    const blob = src.startsWith("data:")
      ? await (await fetch(src)).blob()
      : await (await fetch(src, { mode: "cors" })).blob();
    if (!blob.type.startsWith("image/")) return null;
    return await createImageBitmap(blob);
  } catch {
    return null;
  }
}

function drawAvatar(
  ctx: CanvasRenderingContext2D,
  bitmap: ImageBitmap | null,
  initial: string,
  x: number, y: number, size: number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  if (bitmap) {
    ctx.clip();
    // cover-fit the bitmap into the circle
    const scale = Math.max(size / bitmap.width, size / bitmap.height);
    const dw = bitmap.width * scale;
    const dh = bitmap.height * scale;
    ctx.drawImage(bitmap, x + (size - dw) / 2, y + (size - dh) / 2, dw, dh);
  } else {
    ctx.fillStyle = "rgba(124,164,245,0.16)";
    ctx.fill();
    ctx.fillStyle = ACCENT;
    ctx.font = `600 ${size * 0.42}px ${DISPLAY}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initial.toUpperCase(), x + size / 2, y + size / 2 + 2);
  }
  ctx.restore();
}

export async function renderDisciplineCardPng(payload: DisciplineCardPayload): Promise<Blob> {
  await loadFonts();
  const avatar = await loadAvatar(payload.avatar);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");

  // ── Background + frame ──
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, W - 48, H - 48);

  // ── Masthead: wordmark left, circle right ──
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = FG;
  ctx.font = `600 26px ${MONO}`;
  ctx.fillText("K Ō D A", 72, 96);

  ctx.textAlign = "right";
  ctx.fillStyle = MUTED;
  ctx.font = `400 20px ${MONO}`;
  const circleLabel = `${payload.circleEmoji} ${payload.circleName.toUpperCase()}${payload.rank ? ` · RANK #${payload.rank}` : ""}`;
  ctx.fillText(circleLabel, W - 72, 96);

  // ── Identity block (left) ──
  const idY = 210;
  drawAvatar(ctx, avatar, payload.username.charAt(0) || "K", 72, idY, 88);
  ctx.textAlign = "left";
  ctx.fillStyle = FG;
  ctx.font = `600 40px ${DISPLAY}`;
  ctx.fillText(payload.username, 184, idY + 42);
  ctx.fillStyle = MUTED;
  ctx.font = `400 22px ${MONO}`;
  ctx.fillText(payload.handle, 184, idY + 76); // stored with @ — render as-is

  // ── Kicker ──
  ctx.fillStyle = DIM;
  ctx.font = `600 20px ${MONO}`;
  ctx.fillText("D I S C I P L I N E   S C O R E", 72, 392);

  // ── The score ──
  ctx.fillStyle = FG;
  ctx.font = `700 170px ${DISPLAY}`;
  ctx.fillText(String(payload.discipline.score), 66, 540);
  const scoreWidth = ctx.measureText(String(payload.discipline.score)).width;
  ctx.fillStyle = DIM;
  ctx.font = `600 48px ${DISPLAY}`;
  ctx.fillText(`/${payload.discipline.outOf}`, 66 + scoreWidth + 14, 540);

  // Grade chip
  const chipText = `${payload.discipline.grade} — ${payload.discipline.label.toUpperCase()}`;
  ctx.font = `600 24px ${MONO}`;
  const chipW = ctx.measureText(chipText).width + 44;
  const chipY = 568;
  ctx.fillStyle = "rgba(124,164,245,0.14)";
  ctx.beginPath();
  ctx.roundRect(72, chipY, chipW, 46, 23);
  ctx.fill();
  ctx.fillStyle = ACCENT;
  ctx.textAlign = "left";
  ctx.fillText(chipText, 94, chipY + 31);

  // ── Highlights (right column) ──
  const hlX = 660;
  let hlY = 420;
  if (payload.winRate != null) {
    ctx.fillStyle = FG;
    ctx.font = `600 24px ${MONO}`;
    ctx.fillText(`${payload.winRate}% WIN RATE`, hlX, hlY);
    hlY += 44;
  }
  ctx.fillStyle = MUTED;
  ctx.font = `400 22px ${MONO}`;
  for (const line of payload.highlights) {
    ctx.fillText(`· ${line}`, hlX, hlY);
    hlY += 38;
  }

  // ── Footer: the growth-loop link ──
  ctx.fillStyle = DIM;
  ctx.font = `400 19px ${MONO}`;
  ctx.textAlign = "right";
  ctx.fillText(payload.shareUrl.replace("https://", "").replace("&utm_source=share_card", ""), W - 72, H - 52);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error("toBlob returned null"))), "image/png");
  });
}

export type ShareCardResult = "shared" | "downloaded";

/** Render + hand off: native share sheet where files are supported, download otherwise. */
export async function shareDisciplineCard(payload: DisciplineCardPayload): Promise<ShareCardResult> {
  const blob = await renderDisciplineCardPng(payload);
  const file = new File([blob], "koda-discipline-card.png", { type: "image/png" });

  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: payload.shareText });
      return "shared";
    } catch (e) {
      // AbortError = user closed the sheet — treat as done, don't double-fire
      // a download on top of a deliberate cancel.
      if ((e as DOMException)?.name === "AbortError") return "shared";
      // Other failures fall through to download.
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "koda-discipline-card.png";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "downloaded";
}
