import { App } from "@capacitor/app";
import { Keyboard } from "@capacitor/keyboard";
import { Preferences } from "@capacitor/preferences";
import { StatusBar, Style } from "@capacitor/status-bar";

import { getPlatform, setPlatform, webPlatform } from "@/lib/platform";
import { PWA_BACKGROUND_DARK, PWA_BACKGROUND_LIGHT } from "@/lib/pwa";
import { safeSetItem, setStorageMirror } from "@/lib/storage";

import { bootNative } from "./index";
import { flush } from "./storage";

jest.mock("@capacitor/core", () => ({
  registerPlugin: jest.fn(() => ({
    getProducts: jest.fn(),
    purchase: jest.fn(),
  })),
}));

jest.mock("@capacitor/camera", () => ({
  Camera: { getPhoto: jest.fn(), pickImages: jest.fn() },
  CameraSource: { Camera: "CAMERA" },
  CameraResultType: { Uri: "uri" },
}));

jest.mock("@capacitor/share", () => ({
  Share: { canShare: jest.fn(), share: jest.fn() },
}));

jest.mock("@capacitor/clipboard", () => ({
  Clipboard: { write: jest.fn(), read: jest.fn() },
}));

jest.mock("@capacitor/browser", () => ({
  Browser: { open: jest.fn() },
}));

jest.mock("@capacitor/app", () => ({
  App: {
    canOpenUrl: jest.fn(),
    openUrl: jest.fn(),
    addListener: jest.fn(),
  },
}));

jest.mock("@capacitor/status-bar", () => ({
  StatusBar: {
    setStyle: jest.fn(),
    setBackgroundColor: jest.fn(),
  },
  Style: { Dark: "DARK", Light: "LIGHT", Default: "DEFAULT" },
}));

jest.mock("@capacitor/keyboard", () => ({
  Keyboard: {
    setAccessoryBarVisible: jest.fn(),
  },
}));

jest.mock("@capacitor/preferences", () => ({
  Preferences: {
    keys: jest.fn(async () => ({ keys: [] })),
    get: jest.fn(async () => ({ value: null })),
    set: jest.fn(async () => undefined),
    remove: jest.fn(async () => undefined),
  },
}));

type AppStateListener = (state: { isActive: boolean }) => void;

beforeEach(() => {
  document.documentElement.className = "";
  localStorage.clear();
  setPlatform(webPlatform);
  setStorageMirror(null);
  (Preferences.keys as jest.Mock).mockResolvedValue({ keys: [] });
  (Preferences.get as jest.Mock).mockResolvedValue({ value: null });
  (Preferences.set as jest.Mock).mockResolvedValue(undefined);
  (Preferences.remove as jest.Mock).mockResolvedValue(undefined);
  (StatusBar.setStyle as jest.Mock).mockResolvedValue(undefined);
  (StatusBar.setBackgroundColor as jest.Mock).mockResolvedValue(undefined);
  (Keyboard.setAccessoryBarVisible as jest.Mock).mockResolvedValue(undefined);
  (App.addListener as jest.Mock).mockResolvedValue({ remove: async () => {} });
});

afterEach(() => {
  setPlatform(webPlatform);
  setStorageMirror(null);
  document.documentElement.className = "";
});

describe("bootNative", () => {
  it("hydrates storage before installing the iOS platform", async () => {
    let release: (value: { keys: string[] }) => void = () => {};
    (Preferences.keys as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );

    const booting = bootNative();
    await Promise.resolve();
    expect(getPlatform().kind).toBe("web");

    release({ keys: [] });
    await booting;
    expect(getPlatform().kind).toBe("ios");
    expect(getPlatform().isNative).toBe(true);
    expect(getPlatform().showKofi).toBe(false);
  });

  it("styles the status bar for a stored dark theme", async () => {
    localStorage.setItem("theme", "dark");
    await bootNative();
    expect(StatusBar.setStyle).toHaveBeenCalledWith({ style: Style.Dark });
    expect(StatusBar.setBackgroundColor).toHaveBeenCalledWith({ color: PWA_BACKGROUND_DARK });
  });

  it("styles the status bar for a light document class", async () => {
    document.documentElement.classList.add("light");
    localStorage.setItem("theme", "dark");
    await bootNative();
    expect(StatusBar.setStyle).toHaveBeenCalledWith({ style: Style.Light });
    expect(StatusBar.setBackgroundColor).toHaveBeenCalledWith({ color: PWA_BACKGROUND_LIGHT });
  });

  it("follows a later theme change", async () => {
    await bootNative();
    (StatusBar.setStyle as jest.Mock).mockClear();
    localStorage.setItem("theme", "dark");
    window.dispatchEvent(new Event("themechange"));
    await Promise.resolve();
    expect(StatusBar.setStyle).toHaveBeenCalledWith({ style: Style.Dark });
  });

  it("keeps the accessory bar and ignores status bar and keyboard failures", async () => {
    (StatusBar.setStyle as jest.Mock).mockRejectedValue(new Error("no bar"));
    (StatusBar.setBackgroundColor as jest.Mock).mockRejectedValue(new Error("no bar"));
    (Keyboard.setAccessoryBarVisible as jest.Mock).mockRejectedValue(new Error("no keyboard"));
    await expect(bootNative()).resolves.toBeUndefined();
    expect(Keyboard.setAccessoryBarVisible).toHaveBeenCalledWith({ isVisible: true });
    expect(getPlatform().kind).toBe("ios");
  });

  it("flushes Preferences when the app goes inactive", async () => {
    let listener: AppStateListener | undefined;
    (App.addListener as jest.Mock).mockImplementation(async (event: string, cb: AppStateListener) => {
      expect(event).toBe("appStateChange");
      listener = cb;
      return { remove: async () => {} };
    });
    let release: () => void = () => {};
    (Preferences.set as jest.Mock).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );

    await bootNative();
    safeSetItem("receiptSplitterSession", "held");

    let flushed = false;
    const waiting = flush().then(() => {
      flushed = true;
    });
    listener?.({ isActive: false });
    await Promise.resolve();
    expect(flushed).toBe(false);

    release();
    await waiting;
    expect(flushed).toBe(true);
    expect(Preferences.set).toHaveBeenCalledWith({
      key: "receiptSplitterSession",
      value: "held",
    });
  });

  it("still boots when the app listener cannot be registered", async () => {
    (App.addListener as jest.Mock).mockRejectedValue(new Error("no app"));
    await expect(bootNative()).resolves.toBeUndefined();
    expect(getPlatform().kind).toBe("ios");
  });
});
