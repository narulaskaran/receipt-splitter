import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";

import { setPlatform, webPlatform, type TipJar as TipJarApi, type TipProduct } from "@/lib/platform";

import { TipJar } from "./tip-jar";

const products: TipProduct[] = [
  { id: "tip.small", displayName: "Small tip", displayPrice: "€0.99" },
  { id: "tip.large", displayName: "Large tip", displayPrice: "€4.99" },
];

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function installTips(overrides: Partial<TipJarApi> = {}): TipJarApi {
  const tips: TipJarApi = {
    loadProducts: jest.fn(async () => products),
    purchase: jest.fn(async () => ({ status: "success" as const })),
    ...overrides,
  };
  setPlatform({
    ...webPlatform,
    kind: "ios",
    isNative: true,
    showKofi: false,
    tips,
  });
  return tips;
}

afterEach(() => {
  setPlatform(webPlatform);
});

describe("TipJar", () => {
  it("renders nothing when the platform has no tip jar", () => {
    setPlatform(webPlatform);
    render(<TipJar />);
    expect(screen.queryByRole("button", { name: "Leave a tip" })).not.toBeInTheDocument();
  });

  it("loads products on open and shows localized prices", async () => {
    const user = userEvent.setup();
    const gate = deferred<TipProduct[]>();
    const tips = installTips({ loadProducts: jest.fn(() => gate.promise) });

    render(<TipJar />);
    expect(tips.loadProducts).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Leave a tip" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Loading prices…");
    expect(screen.getByText(/don't unlock anything/i)).toBeInTheDocument();
    expect(screen.getByText(/app stays free/i)).toBeInTheDocument();

    gate.resolve(products);
    expect(await screen.findByRole("button", { name: /Small tip/ })).toHaveTextContent("€0.99");
    expect(screen.getByRole("button", { name: /Large tip/ })).toHaveTextContent("€4.99");
    const priceButton = screen.getByRole("button", { name: /Small tip/ });
    expect(priceButton.className).toContain("min-h-[44px]");
  });

  it("says tips are unavailable when the catalog is empty", async () => {
    const user = userEvent.setup();
    installTips({ loadProducts: jest.fn(async () => []) });
    render(<TipJar />);
    await user.click(screen.getByRole("button", { name: "Leave a tip" }));
    expect(await screen.findByText("Tips aren't available right now")).toBeInTheDocument();
  });

  it("disables every price while a purchase is in flight, then thanks and allows another", async () => {
    const user = userEvent.setup();
    const gate = deferred<{ status: "success" }>();
    const tips = installTips({
      purchase: jest.fn(() => gate.promise),
    });
    render(<TipJar />);
    await user.click(screen.getByRole("button", { name: "Leave a tip" }));
    const small = await screen.findByRole("button", { name: /Small tip/ });
    await user.click(small);

    expect(screen.getByRole("button", { name: /Small tip/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Large tip/ })).toBeDisabled();

    gate.resolve({ status: "success" });
    expect(await screen.findByText("Thank you!")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Small tip/ })).toBeEnabled();

    (tips.purchase as jest.Mock).mockResolvedValue({ status: "success" });
    await user.click(screen.getByRole("button", { name: /Large tip/ }));
    expect(tips.purchase).toHaveBeenCalledTimes(2);
    expect(tips.purchase).toHaveBeenLastCalledWith("tip.large");
  });

  it("shows a pending approval and stays quiet on cancel", async () => {
    const user = userEvent.setup();
    const tips = installTips({
      purchase: jest
        .fn()
        .mockResolvedValueOnce({ status: "pending" })
        .mockResolvedValueOnce({ status: "cancelled" }),
    });
    render(<TipJar />);
    await user.click(screen.getByRole("button", { name: "Leave a tip" }));
    await user.click(await screen.findByRole("button", { name: /Small tip/ }));
    expect(await screen.findByText("Waiting for approval…")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Large tip/ }));
    expect(screen.queryByText("Waiting for approval…")).not.toBeInTheDocument();
    expect(screen.queryByText("Thank you!")).not.toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
    expect(tips.purchase).toHaveBeenCalledTimes(2);
  });

  it("toasts a failed purchase and leaves the buttons usable", async () => {
    const user = userEvent.setup();
    installTips({
      purchase: jest.fn(async () => ({ status: "failed" as const, message: "unverified" })),
    });
    render(<TipJar />);
    await user.click(screen.getByRole("button", { name: "Leave a tip" }));
    await user.click(await screen.findByRole("button", { name: /Small tip/ }));
    expect(toast.error).toHaveBeenCalledWith("unverified");
    expect(screen.getByRole("button", { name: /Small tip/ })).toBeEnabled();
  });
});
