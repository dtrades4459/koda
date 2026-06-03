import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./supabase", () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: "tok" } } })) } },
}));

const originalNotification = (globalThis as any).Notification;
const originalNavigator = globalThis.navigator;

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("VITE_VAPID_PUBLIC_KEY", "BHg6dGVzdA");
});

afterEach(() => {
  (globalThis as any).Notification = originalNotification;
  Object.defineProperty(globalThis, "navigator", { value: originalNavigator, configurable: true });
  vi.unstubAllEnvs();
});

function installPushApis(opts: {
  requestPermission: () => Promise<NotificationPermission>;
  getRegistration?: () => Promise<unknown>;
}) {
  const order: string[] = [];
  const wrappedRequest = () => {
    order.push("requestPermission");
    return opts.requestPermission();
  };

  (globalThis as any).Notification = Object.assign(
    function Notification() {},
    { requestPermission: wrappedRequest, permission: "default" as NotificationPermission },
  );

  const fakeReg = {
    pushManager: {
      subscribe: vi.fn(async () => ({ toJSON: () => ({ endpoint: "https://x", keys: {} }) })),
    },
  };

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      serviceWorker: {
        getRegistration: async () => {
          order.push("getRegistration");
          return opts.getRegistration ? opts.getRegistration() : fakeReg;
        },
        register: async () => fakeReg,
        ready: Promise.resolve(fakeReg),
      },
    },
  });

  (globalThis as any).PushManager = function () {};
  (globalThis as any).fetch = vi.fn(async () => ({ ok: true }));

  return { order, fakeReg };
}

describe("subscribeToPush", () => {
  it("calls Notification.requestPermission before touching the service worker (iOS user-gesture preservation)", async () => {
    const { order } = installPushApis({ requestPermission: async () => "granted" as NotificationPermission });
    const { subscribeToPush } = await import("./push");
    await subscribeToPush();
    expect(order[0]).toBe("requestPermission");
    expect(order.indexOf("requestPermission")).toBeLessThan(order.indexOf("getRegistration"));
  });

  it("returns denied without registering the service worker when permission is denied", async () => {
    const { order } = installPushApis({ requestPermission: async () => "denied" as NotificationPermission });
    const { subscribeToPush } = await import("./push");
    const result = await subscribeToPush();
    expect(result).toEqual({ ok: false, reason: "denied", message: expect.stringContaining("blocked") });
    expect(order).not.toContain("getRegistration");
  });

  it("returns dismissed when permission resolves to default (prompt dismissed)", async () => {
    installPushApis({ requestPermission: async () => "default" as NotificationPermission });
    const { subscribeToPush } = await import("./push");
    const result = await subscribeToPush();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("dismissed");
  });

  it("returns unsupported when Notification is undefined", async () => {
    delete (globalThis as any).Notification;
    const { subscribeToPush } = await import("./push");
    const result = await subscribeToPush();
    expect(result).toEqual({ ok: false, reason: "unsupported", message: expect.any(String) });
  });
});
