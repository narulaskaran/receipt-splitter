import { render } from "@testing-library/react";
import { ThemeProvider, useTheme } from "./theme-provider";
import { Toaster } from "./ui/sonner";

// sonner ships ESM-only; stub the underlying Toaster so we can assert what
// our wrapper passes down.
jest.mock("sonner", () => ({
  Toaster: (props: { theme?: string }) => (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <section data-sonner-toaster="" data-theme={(props as any).theme} />
  ),
}));

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

describe("theme integration", () => {
  it("Toaster reflects the ThemeProvider theme (not next-themes)", () => {
    const { container } = render(
      <ThemeProvider defaultTheme="dark" attribute="class">
        <Toaster />
      </ThemeProvider>
    );

    const toaster = container.querySelector("[data-sonner-toaster]");
    expect(toaster).not.toBeNull();
    expect(toaster!.getAttribute("data-theme")).toBe("dark");
  });

  it("attribute=class toggles theme classes without wiping other root classes", () => {
    document.documentElement.className = "existing-class";

    render(
      <ThemeProvider defaultTheme="dark" attribute="class">
        <div>child</div>
      </ThemeProvider>
    );

    const root = document.documentElement;
    expect(root.classList.contains("dark")).toBe(true);
    expect(root.classList.contains("existing-class")).toBe(true);
  });
});

describe("useTheme context export", () => {
  it("exposes the custom provider context", () => {
    let observed: string | undefined;
    function Probe() {
      const { theme } = useTheme();
      observed = theme;
      return null;
    }
    render(
      <ThemeProvider defaultTheme="light">
        <Probe />
      </ThemeProvider>
    );
    expect(observed).toBe("light");
  });
});
