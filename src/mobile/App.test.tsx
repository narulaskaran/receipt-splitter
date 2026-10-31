import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactElement } from "react";
import { toast } from "sonner";

import { reportDurableStorageUnavailable } from "@/lib/storage";

import { App, MobileErrorBoundary } from "./App";

jest.mock("sonner", () => ({
  toast: {
    warning: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
  },
}));

jest.mock("@/components/ui/sonner", () => ({
  Toaster: () => null,
}));

jest.mock("@/components/home-screen", () => ({
  HomeScreen: () => <div>home</div>,
}));

jest.mock("@/components/split-screen", () => ({
  SplitScreen: () => <div>split</div>,
}));

function Boom(): ReactElement {
  throw new Error("boom");
}

describe("MobileErrorBoundary", () => {
  it("offers reload and does not clear the saved split", async () => {
    localStorage.setItem("receiptSplitterSession", "keep");
    const onReload = jest.fn();

    render(
      <MobileErrorBoundary onReload={onReload}>
        <Boom />
      </MobileErrorBoundary>,
    );

    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeInTheDocument();
    expect(screen.getByText(/saved split is still on this device/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(onReload).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("receiptSplitterSession")).toBe("keep");
  });
});

describe("App durable storage notice", () => {
  it("shows the unavailable notice once", () => {
    reportDurableStorageUnavailable("timeout");
    reportDurableStorageUnavailable("again");
    render(<App />);
    expect(toast.warning).toHaveBeenCalledTimes(1);
    expect(toast.warning).toHaveBeenCalledWith(
      expect.stringMatching(/backup storage on this device is unavailable/i),
    );
    expect(screen.getByText("home")).toBeInTheDocument();
  });
});
