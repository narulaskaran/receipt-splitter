import { getThemeInitScript, THEME_STORAGE_KEY } from "./theme";

function mockSystemDark(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({ matches, media: query })),
  });
}

function runScript(defaultTheme?: Parameters<typeof getThemeInitScript>[0]) {
  new Function(getThemeInitScript(defaultTheme))();
  return document.documentElement.classList;
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = "";
  mockSystemDark(false);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("getThemeInitScript", () => {
  it("applies a saved theme", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    expect(runScript().contains("dark")).toBe(true);
  });

  it("follows the system setting when nothing is saved", () => {
    mockSystemDark(true);
    expect(runScript().contains("dark")).toBe(true);
  });

  it("follows the system setting when the saved value is system", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "system");
    expect(runScript().contains("light")).toBe(true);
  });

  it("uses the given default when nothing valid is saved", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "sepia");
    mockSystemDark(true);
    expect(runScript("light").contains("light")).toBe(true);
  });

  it("keeps existing root classes", () => {
    document.documentElement.className = "existing-class";
    const classes = runScript();
    expect(classes.contains("existing-class")).toBe(true);
    expect(classes.contains("light")).toBe(true);
  });

  it("falls back to the default when storage throws", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    // jest.setup.ts installs a plain-object localStorage mock, so spy on it
    // directly rather than on Storage.prototype.
    const spy = jest.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(runScript("dark").contains("dark")).toBe(true);
    expect(spy).toHaveBeenCalled();
  });
});
