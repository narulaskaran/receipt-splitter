import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "./theme-provider";

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

describe("ThemeProvider", () => {
  it("renders children", () => {
    render(
      <ThemeProvider attribute="class">
        <div>child</div>
      </ThemeProvider>
    );
    expect(screen.getByText("child")).toBeInTheDocument();
  });
});
