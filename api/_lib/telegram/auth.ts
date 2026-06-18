export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    date: number;
    text?: string;
    from?: { id: number; is_bot: boolean; first_name: string; username?: string };
    chat: { id: number; type: 'private' | 'group' | 'supergroup' | 'channel' };
  };
}

const ALLOWED_USER_IDS = new Set(
  (process.env.TELEGRAM_ALLOWED_USER_IDS ?? '')
    .split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(n => !isNaN(n) && n > 0),
);

const OPS_CHAT_ID = parseInt(process.env.TELEGRAM_OPS_CHAT_ID ?? '0', 10);

export function isAuthorized(update: TelegramUpdate): boolean {
  const msg = update.message;
  if (!msg) return false;
  const userId = msg.from?.id;
  if (!userId || !ALLOWED_USER_IDS.has(userId)) return false;
  return msg.chat.type === 'private' || msg.chat.id === OPS_CHAT_ID;
}

export function getChatId(update: TelegramUpdate): number {
  if (!update.message) throw new Error('getChatId called on update without message');
  return update.message.chat.id;
}

/**
 * Logs a clear hint when a dropped update is the signature of a stale
 * TELEGRAM_OPS_CHAT_ID — i.e. a whitelisted user messaged a non-private chat
 * whose id no longer matches OPS_CHAT_ID. This is exactly what happens when a
 * group gains Topics and is upgraded to a supergroup (its chat id changes
 * permanently). Without this, the handler drops the message with a silent 200
 * and the bot looks dead. The log prints the value to set.
 */
export function logDropDiagnostic(update: TelegramUpdate): void {
  const msg = update.message;
  if (!msg) return;
  const uid = msg.from?.id;
  if (uid && ALLOWED_USER_IDS.has(uid) && msg.chat.type !== 'private' && msg.chat.id !== OPS_CHAT_ID) {
    console.warn(
      `[telegram] authorized user ${uid} messaged chat ${msg.chat.id} (${msg.chat.type}) ` +
      `which != TELEGRAM_OPS_CHAT_ID (${OPS_CHAT_ID}). If this group gained Topics it became a ` +
      `supergroup with a new id — set TELEGRAM_OPS_CHAT_ID=${msg.chat.id} to restore the bot.`,
    );
  }
}
