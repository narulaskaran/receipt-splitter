import { StrictMode, type ReactNode } from "react";
import { act } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { createRoot, hydrateRoot } from "react-dom/client";
import { ThemeProvider } from "./theme-provider";
import { getThemeInitScript, THEME_STORAGE_KEY } from "@/lib/theme";

function mockSystemDark(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches,
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })),
  });
}

async function hydrateAndRecordClasses(wrap: (node: ReactNode) => ReactNode) {
  const app = wrap(
    <ThemeProvider attribute="class" defaultTheme="system">
      <span>app</span>
    </ThemeProvider>
  );

  // What the server sends, then what the inline <head> script does.
  const html = renderToString(app);
  new Function(getThemeInitScript("system"))();

  // Record every intermediate class value: each mutation's oldValue is the
  // state before it, so together with the final value nothing is missed.
  const seen: string[] = [];
  const record = (records: MutationRecord[]) => {
    for (const r of records) seen.push(r.oldValue ?? "");
  };
  const observer = new MutationObserver(record);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
    attributeOldValue: true,
  });

  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);
  await act(async () => {
    hydrateRoot(container, app);
  });
  record(observer.takeRecords());
  observer.disconnect();

  seen.push(document.documentElement.className);
  return seen;
}

beforeEach(() => {
  document.documentElement.className = "";
  document.body.innerHTML = "";
});

describe("ThemeProvider hydration", () => {
  it.each([
    ["", (node: ReactNode) => node],
    [" in StrictMode", (node: ReactNode) => <StrictMode>{node}</StrictMode>],
  ])("keeps a saved dark theme on a light system%s", async (_label, wrap) => {
    mockSystemDark(false);
    localStorage.setItem(THEME_STORAGE_KEY, "dark");

    const seen = await hydrateAndRecordClasses(wrap);

    expect(seen.some((c) => c.split(" ").includes("light"))).toBe(false);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("keeps a saved light theme on a dark system", async () => {
    mockSystemDark(true);
    localStorage.setItem(THEME_STORAGE_KEY, "light");

    const seen = await hydrateAndRecordClasses((node) => node);

    expect(seen.some((c) => c.split(" ").includes("dark"))).toBe(false);
    expect(document.documentElement.classList.contains("light")).toBe(true);
  });
});

describe("init script and ThemeProvider", () => {
  const cases: [string | null, boolean][] = [];
  for (const stored of ["light", "dark", "system", "sepia", null]) {
    for (const systemDark of [false, true]) cases.push([stored, systemDark]);
  }

  it.each(cases)("resolve the same class (saved %p, system dark %p)", async (stored, systemDark) => {
    mockSystemDark(systemDark);
    if (stored !== null) localStorage.setItem(THEME_STORAGE_KEY, stored);

    new Function(getThemeInitScript("system"))();
    const fromScript = document.documentElement.className;

    document.documentElement.className = "";
    const container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      createRoot(container).render(
        <ThemeProvider attribute="class" defaultTheme="system">
          <span>app</span>
        </ThemeProvider>
      );
    });

    expect(document.documentElement.className).toBe(fromScript);
  });
});
