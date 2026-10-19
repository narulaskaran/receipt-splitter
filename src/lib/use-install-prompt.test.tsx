import { act, renderHook, waitFor } from "@testing-library/react";
import { isIOSDevice, useInstallPrompt } from "./use-install-prompt";

function fireBeforeInstallPrompt(
  options: { outcome?: string; promptError?: Error } = {}
) {
  const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
    prompt: jest.Mock;
    userChoice: Promise<{ outcome: string }>;
  };
  event.prompt = options.promptError
    ? jest.fn().mockRejectedValue(options.promptError)
    : jest.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome: options.outcome ?? "accepted" });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

function mockDisplayMode(standalone: boolean) {
  (window.matchMedia as jest.Mock).mockImplementation((query: string) => ({
    matches: standalone && query === "(display-mode: standalone)",
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    dispatchEvent: jest.fn(),
    onchange: null,
  }));
}

describe("useInstallPrompt", () => {
  afterEach(() => {
    // Module state outlives each test; appinstalled clears the captured event.
    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    jest.restoreAllMocks();
  });

  it("offers nothing until the browser says the app is installable", async () => {
    mockDisplayMode(false);
    const { result } = renderHook(() => useInstallPrompt());
    await waitFor(() => expect(result.current.method).toBeNull());
  });

  it("offers the install prompt once beforeinstallprompt fires, and keeps the event", async () => {
    mockDisplayMode(false);
    const { result } = renderHook(() => useInstallPrompt());

    const event = fireBeforeInstallPrompt();
    expect(event.defaultPrevented).toBe(true);
    await waitFor(() => expect(result.current.method).toBe("prompt"));
  });

  it("shows the browser prompt, then stops offering it (it can only be used once)", async () => {
    mockDisplayMode(false);
    const { result } = renderHook(() => useInstallPrompt());
    const event = fireBeforeInstallPrompt();
    await waitFor(() => expect(result.current.method).toBe("prompt"));

    await act(async () => {
      await result.current.promptInstall();
    });

    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(result.current.method).toBeNull();
  });

  it("stops offering the prompt after the user dismisses it", async () => {
    mockDisplayMode(false);
    const { result } = renderHook(() => useInstallPrompt());
    const event = fireBeforeInstallPrompt({ outcome: "dismissed" });
    await waitFor(() => expect(result.current.method).toBe("prompt"));

    await act(async () => {
      await result.current.promptInstall();
    });

    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(result.current.method).toBeNull();
  });

  it("does not throw when the browser prompt rejects", async () => {
    mockDisplayMode(false);
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() => useInstallPrompt());
    fireBeforeInstallPrompt({ promptError: new Error("not allowed") });
    await waitFor(() => expect(result.current.method).toBe("prompt"));

    await act(async () => {
      await expect(result.current.promptInstall()).resolves.toBeUndefined();
    });

    expect(consoleError).toHaveBeenCalledWith(
      "Install prompt failed:",
      expect.any(Error)
    );
    expect(result.current.method).toBeNull();
  });

  it("offers nothing when iOS reports standalone via navigator.standalone", async () => {
    mockDisplayMode(false);
    jest
      .spyOn(window.navigator, "userAgent", "get")
      .mockReturnValue("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)");
    Object.defineProperty(window.navigator, "standalone", {
      value: true,
      configurable: true,
    });
    try {
      const { result } = renderHook(() => useInstallPrompt());
      await waitFor(() => expect(result.current.method).toBeNull());
    } finally {
      delete (window.navigator as { standalone?: boolean }).standalone;
    }
  });

  it("hides the offer when the window switches to standalone", async () => {
    let onChange: () => void = () => {};
    let standalone = false;
    (window.matchMedia as jest.Mock).mockImplementation((query: string) => ({
      get matches() {
        return standalone && query === "(display-mode: standalone)";
      },
      media: query,
      addEventListener: (_: string, handler: () => void) => {
        onChange = handler;
      },
      removeEventListener: jest.fn(),
    }));
    const { result } = renderHook(() => useInstallPrompt());
    fireBeforeInstallPrompt();
    await waitFor(() => expect(result.current.method).toBe("prompt"));

    standalone = true;
    act(() => onChange());

    expect(result.current.method).toBeNull();
  });

  it("stops offering install after appinstalled", async () => {
    mockDisplayMode(false);
    const { result } = renderHook(() => useInstallPrompt());
    fireBeforeInstallPrompt();
    await waitFor(() => expect(result.current.method).toBe("prompt"));

    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    expect(result.current.method).toBeNull();
  });

  it("offers nothing when the app is already running installed", async () => {
    mockDisplayMode(true);
    const { result } = renderHook(() => useInstallPrompt());
    fireBeforeInstallPrompt();
    await waitFor(() => expect(result.current.method).toBeNull());
  });

  it("shows Add to Home Screen instructions on iOS, which has no install event", async () => {
    mockDisplayMode(false);
    jest
      .spyOn(window.navigator, "userAgent", "get")
      .mockReturnValue(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1"
      );
    const { result } = renderHook(() => useInstallPrompt());
    await waitFor(() => expect(result.current.method).toBe("ios-instructions"));
  });
});

describe("isIOSDevice", () => {
  it("recognises iPhone and iPad user agents", () => {
    expect(
      isIOSDevice({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)", maxTouchPoints: 5 })
    ).toBe(true);
    expect(
      isIOSDevice({ userAgent: "Mozilla/5.0 (iPad; CPU OS 18_0)", maxTouchPoints: 5 })
    ).toBe(true);
  });

  it("recognises iPadOS, which reports a Mac user agent but has a touch screen", () => {
    const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)";
    expect(isIOSDevice({ userAgent: mac, maxTouchPoints: 5 })).toBe(true);
    expect(isIOSDevice({ userAgent: mac, maxTouchPoints: 0 })).toBe(false);
  });

  it("does not match Android or desktop browsers", () => {
    expect(
      isIOSDevice({ userAgent: "Mozilla/5.0 (Linux; Android 15) Chrome/130", maxTouchPoints: 5 })
    ).toBe(false);
  });
});
