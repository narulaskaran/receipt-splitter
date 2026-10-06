import { act, render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "./theme-provider";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import { ThemeToggle } from "./theme-toggle";

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
});

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = "";
});

afterEach(() => {
  jest.restoreAllMocks();
});

function renderToggle() {
  return render(
    <ThemeProvider attribute="class" defaultTheme="system">
      <ThemeToggle />
    </ThemeProvider>
  );
}

describe("ThemeToggle", () => {
  it("renders light, dark and system buttons with system pressed by default", () => {
    renderToggle();
    expect(screen.getByRole("group", { name: "Theme" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Light theme" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Dark theme" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "System theme" })).toHaveAttribute("aria-pressed", "true");
  });

  it("applies and saves the chosen theme", () => {
    renderToggle();
    fireEvent.click(screen.getByRole("button", { name: "Dark theme" }));

    expect(screen.getByRole("button", { name: "Dark theme" })).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");

    fireEvent.click(screen.getByRole("button", { name: "Light theme" }));
    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("restores a saved theme on mount", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    renderToggle();
    expect(screen.getByRole("button", { name: "Dark theme" })).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("ignores an invalid saved value", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "sepia");
    renderToggle();
    expect(screen.getByRole("button", { name: "System theme" })).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.classList.contains("light")).toBe(true);
  });

  it("picks up a theme changed in another tab", () => {
    renderToggle();
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: THEME_STORAGE_KEY }));
    });
    expect(screen.getByRole("button", { name: "Dark theme" })).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});

describe("ThemeToggle when storage is cleared in another tab", () => {
  it("drops this tab's choice and falls back to the default", () => {
    renderToggle();
    fireEvent.click(screen.getByRole("button", { name: "Dark theme" }));

    localStorage.clear();
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: null }));
    });

    expect(screen.getByRole("button", { name: "System theme" })).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.classList.contains("light")).toBe(true);
  });
});

describe("ThemeToggle when storage is blocked", () => {
  it("still switches the theme for this page load", () => {
    // jest.setup.ts installs a plain-object localStorage mock, so spy on it
    // directly rather than on Storage.prototype.
    const blocked = () => {
      throw new Error("blocked");
    };
    const getItem = jest.spyOn(window.localStorage, "getItem").mockImplementation(blocked);
    const setItem = jest.spyOn(window.localStorage, "setItem").mockImplementation(blocked);

    renderToggle();
    fireEvent.click(screen.getByRole("button", { name: "Dark theme" }));

    expect(getItem).toHaveBeenCalled();
    expect(setItem).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Dark theme" })).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
