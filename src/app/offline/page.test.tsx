import { render, screen } from "@testing-library/react";
import OfflinePage from "./page";

describe("OfflinePage", () => {
  it("explains the page isn't available and links back to the app", () => {
    render(<OfflinePage />);
    expect(
      screen.getByRole("heading", { name: /you're offline/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /back to your split/i })
    ).toHaveAttribute("href", "/");
    expect(
      screen.getByRole("button", { name: /try again/i })
    ).toBeInTheDocument();
  });
});
