// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';

type Update = import('../auth.js').TelegramUpdate;

function makeUpdate(
  userId: number,
  chatId: number,
  chatType: 'private' | 'group' | 'supergroup' = 'supergroup',
): Update {
  return {
    update_id: 1,
    message: {
      message_id: 1,
      date: Date.now(),
      text: '/help',
      from: { id: userId, is_bot: false, first_name: 'Test' },
      chat: { id: chatId, type: chatType },
    },
  };
}

// Module reads env at import time — reset module registry between tests
describe('isAuthorized', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.TELEGRAM_ALLOWED_USER_IDS = '100,200';
    process.env.TELEGRAM_OPS_CHAT_ID = '-9999';
  });

  it('allows whitelisted user in the ops group', async () => {
    const { isAuthorized } = await import('../auth.js');
    expect(isAuthorized(makeUpdate(100, -9999))).toBe(true);
  });

  it('rejects unknown user even in ops group', async () => {
    const { isAuthorized } = await import('../auth.js');
    expect(isAuthorized(makeUpdate(999, -9999))).toBe(false);
  });

  it('allows whitelisted user in private chat', async () => {
    const { isAuthorized } = await import('../auth.js');
    expect(isAuthorized(makeUpdate(100, 100, 'private'))).toBe(true);
  });

  it('rejects whitelisted user in a different group', async () => {
    const { isAuthorized } = await import('../auth.js');
    expect(isAuthorized(makeUpdate(100, -1234))).toBe(false);
  });

  it('rejects update with no message', async () => {
    const { isAuthorized } = await import('../auth.js');
    expect(isAuthorized({ update_id: 1 } as Update)).toBe(false);
  });
});

describe('logDropDiagnostic', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.TELEGRAM_ALLOWED_USER_IDS = '100,200';
    process.env.TELEGRAM_OPS_CHAT_ID = '-9999';
  });

  it('warns with the new chat id when a whitelisted user hits a mismatched group (the Topics-upgrade signature)', async () => {
    const { logDropDiagnostic } = await import('../auth.js');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logDropDiagnostic(makeUpdate(100, -1001234567890));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('TELEGRAM_OPS_CHAT_ID=-1001234567890');
    warn.mockRestore();
  });

  it('stays quiet for an unknown user (avoids logging random DMs)', async () => {
    const { logDropDiagnostic } = await import('../auth.js');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logDropDiagnostic(makeUpdate(999, -1001234567890));
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('stays quiet when the ops chat id already matches', async () => {
    const { logDropDiagnostic } = await import('../auth.js');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logDropDiagnostic(makeUpdate(100, -9999));
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
