import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Home from "./page";
import { toast } from "sonner";
import { mockReceipt, mockPeople, createMockReceipt } from "@/test/test-utils";
import { RECEIPT_IMAGE_STORAGE_KEY } from "@/lib/storage";

type SerializedAssignments = [number, { personId: string; sharePercentage: number }[]][];

const baseState = {
  originalReceipt: mockReceipt,
  people: [] as typeof mockPeople,
  assignedItems: [] as SerializedAssignments,
  unassignedItems: [0, 1],
  groups: [],
  isLoading: false,
  error: null,
};

function loadSession(overrides: Partial<typeof baseState> = {}, activeTab = "upload") {
  localStorage.setItem(
    "receiptSplitterSession",
    JSON.stringify({ state: { ...baseState, ...overrides }, activeTab })
  );
}

describe("Home Page", () => {
  let originalSetItem: typeof localStorage.setItem;

  afterEach(() => {
    if (originalSetItem) {
      localStorage.setItem = originalSetItem;
      originalSetItem = undefined as never;
    }
  });

  describe("empty state", () => {
    it("starts on the upload tab with all downstream tabs and nav disabled", () => {
      render(<Home />);
      expect(screen.getByRole("tab", { name: /upload receipt/i })).toHaveAttribute("data-state", "active");
      expect(screen.getByRole("tab", { name: /add people/i })).toBeDisabled();
      expect(screen.getByRole("tab", { name: /assign items/i })).toBeDisabled();
      expect(screen.getByRole("tab", { name: /results/i })).toBeDisabled();
      expect(screen.getByRole("button", { name: /back/i })).toBeDisabled();
      expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
      expect(screen.getByRole("button", { name: /new split/i })).toBeDisabled();
    });

    it("shows the receipt uploader", () => {
      render(<Home />);
      expect(screen.getByText(/drag and drop or click to select/i)).toBeInTheDocument();
    });

    it("hides the progress bar and Split All Evenly button", () => {
      render(<Home />);
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /split all evenly/i })).not.toBeInTheDocument();
    });
  });

  describe("session restore", () => {
    it("restores active tab and enables tabs when receipt is loaded", () => {
      loadSession({ people: mockPeople }, "people");
      render(<Home />);
      expect(screen.getByRole("tab", { name: /add people/i })).toHaveAttribute("data-state", "active");
      expect(screen.getByRole("tab", { name: /add people/i })).toBeEnabled();
      expect(screen.getByRole("tab", { name: /assign items/i })).toBeEnabled();
    });

    it("falls back to empty state on corrupted localStorage", () => {
      localStorage.setItem("receiptSplitterSession", "invalid json {");
      render(<Home />);
      expect(screen.getByRole("tab", { name: /upload receipt/i })).toHaveAttribute("data-state", "active");
    });

    it("does not overwrite a restored session with empty default state", async () => {
      loadSession({ people: mockPeople }, "people");
      render(<Home />);

      await waitFor(() => {
        const raw = localStorage.getItem("receiptSplitterSession");
        expect(raw).toBeTruthy();
        const parsed = JSON.parse(raw as string);
        expect(parsed.activeTab).toBe("people");
        expect(parsed.state.people).toHaveLength(mockPeople.length);
      });
    });

    it("evicts the cached image and retries when saving the session fails", async () => {
      loadSession({ people: mockPeople }, "people");
      let sessionWriteFailures = 0;
      originalSetItem = localStorage.setItem;
      localStorage.setItem = jest.fn((key: string, value: string) => {
        if (key === "receiptSplitterSession" && sessionWriteFailures === 0) {
          sessionWriteFailures += 1;
          throw new DOMException("Quota exceeded", "QuotaExceededError");
        }
        return originalSetItem(key, value);
      }) as typeof localStorage.setItem;

      render(<Home />);

      await waitFor(() => {
        expect(sessionWriteFailures).toBe(1);
        expect(localStorage.getItem("receiptSplitterSession")).not.toBeNull();
      });
      expect(localStorage.removeItem).toHaveBeenCalledWith(RECEIPT_IMAGE_STORAGE_KEY);
    });

    it("continues rendering when the session retry also fails", async () => {
      loadSession({ people: mockPeople }, "people");
      originalSetItem = localStorage.setItem;
      localStorage.setItem = jest.fn((key: string) => {
        if (key === "receiptSplitterSession") {
          throw new DOMException("Quota exceeded", "QuotaExceededError");
        }
      }) as typeof localStorage.setItem;

      render(<Home />);

      await waitFor(() => {
        expect(localStorage.removeItem).toHaveBeenCalledWith(RECEIPT_IMAGE_STORAGE_KEY);
      });
      expect(screen.getByRole("tab", { name: /add people/i })).toHaveAttribute("data-state", "active");
    });

    it("restores a v2 session with receipts[]", () => {
      const receiptId = "00000000-0000-4000-8000-000000000000";
      localStorage.setItem(
        "receiptSplitterSession",
        JSON.stringify({
          version: 2,
          state: {
            receipts: [{ id: receiptId, receipt: mockReceipt }],
            people: mockPeople,
            assignedItems: [[receiptId, []]],
            groups: [],
            isLoading: false,
            error: null,
          },
          activeTab: "people",
        })
      );
      render(<Home />);
      expect(screen.getByRole("tab", { name: /add people/i })).toHaveAttribute("data-state", "active");
      expect(screen.getByRole("tab", { name: /add people/i })).toBeEnabled();
      expect(screen.getByRole("tab", { name: /assign items/i })).toBeEnabled();
    });
  });

  describe("New Split button", () => {
    it("clears session and image from localStorage and resets to upload tab", async () => {
      loadSession({ people: mockPeople }, "people");
      localStorage.setItem("receiptSplitterImage", "data:image/png;base64,abc123");

      render(<Home />);

      const newSplitButton = screen.getByRole("button", { name: /new split/i });
      expect(newSplitButton).toBeEnabled();

      fireEvent.click(newSplitButton);

      await waitFor(() => {
        expect(localStorage.getItem("receiptSplitterImage")).toBeNull();
      });
      expect(newSplitButton).toBeDisabled();
      expect(screen.getByRole("tab", { name: /upload receipt/i })).toHaveAttribute("data-state", "active");
    });
  });

  describe("tab navigation", () => {
    it("Next advances to the next tab", () => {
      loadSession({ people: mockPeople });
      render(<Home />);

      fireEvent.click(screen.getByRole("button", { name: /next/i }));

      expect(screen.getByRole("tab", { name: /add people/i })).toHaveAttribute("data-state", "active");
    });

    it("Back returns to the previous tab", () => {
      loadSession({ people: mockPeople }, "people");
      render(<Home />);

      fireEvent.click(screen.getByRole("button", { name: /back/i }));

      expect(screen.getByRole("tab", { name: /upload receipt/i })).toHaveAttribute("data-state", "active");
    });
  });

  describe("progress bar", () => {
    it("shows 0% when receipt is loaded but no items assigned", () => {
      loadSession();
      render(<Home />);
      expect(screen.getByRole("progressbar")).toBeInTheDocument();
      expect(screen.getByText("0%")).toBeInTheDocument();
    });

    it("shows 100% when all items are assigned", () => {
      loadSession({
        people: mockPeople,
        assignedItems: [
          [0, [{ personId: "a", sharePercentage: 100 }]],
          [1, [{ personId: "b", sharePercentage: 100 }]],
        ],
        unassignedItems: [],
      });
      render(<Home />);
      expect(screen.getByText("100%")).toBeInTheDocument();
    });
  });

  describe("Split All Evenly button", () => {
    it("is disabled when no people are added", () => {
      loadSession();
      render(<Home />);
      expect(screen.getByRole("button", { name: /split all evenly/i })).toBeDisabled();
    });

    it("assigns all items and fires success toast when clicked", () => {
      loadSession({ people: mockPeople });
      render(<Home />);

      fireEvent.click(screen.getByRole("button", { name: /split all evenly/i }));

      expect(toast.success).toHaveBeenCalledWith("All items split evenly among everyone!");
      expect(screen.getByText("100%")).toBeInTheDocument();
    });
  });

  describe("multi-receipt upload", () => {
    let uuidSeq = 0;

    beforeEach(() => {
      uuidSeq = 0;
      (crypto.randomUUID as jest.Mock).mockImplementation(
        () => `00000000-0000-4000-8000-${String(++uuidSeq).padStart(12, "0")}`
      );
    });

    afterEach(() => {
      (crypto.randomUUID as jest.Mock).mockImplementation(
        () => "00000000-0000-4000-8000-000000000000"
      );
    });

    function loadV2(options: {
      receipts?: Array<{ id: string; receipt: typeof mockReceipt }>;
      people?: typeof mockPeople;
      assignedItems?: unknown;
      groups?: unknown[];
      activeTab?: string;
    } = {}) {
      const receiptId = options.receipts?.[0]?.id ?? "r1";
      localStorage.setItem(
        "receiptSplitterSession",
        JSON.stringify({
          version: 2,
          state: {
            receipts: options.receipts ?? [{ id: receiptId, receipt: mockReceipt }],
            people: options.people ?? [],
            assignedItems: options.assignedItems ?? [[receiptId, []]],
            groups: options.groups ?? [],
            isLoading: false,
            error: null,
          },
          activeTab: options.activeTab ?? "upload",
        })
      );
    }

    async function uploadParsedReceipt(receipt: typeof mockReceipt) {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => receipt,
      });
      const input = screen.getByRole("presentation").querySelector("input");
      expect(input).not.toBeNull();
      const file = new File(["x"], `${receipt.restaurant ?? "receipt"}.jpg`, {
        type: "image/jpeg",
      });
      await userEvent.upload(input!, file);
    }

    it("keeps people when a second same-currency receipt is parsed", async () => {
      loadV2({ people: mockPeople });
      render(<Home />);

      await uploadParsedReceipt(
        createMockReceipt({ restaurant: "Second Cafe", currency: "USD" })
      );

      await waitFor(() => {
        expect(screen.getByText("Second Cafe")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("tab", { name: /add people/i }));
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
      expect(screen.getByText(/2 receipts · USD/)).toBeInTheDocument();
    });

    it("rejects a mismatched currency without adding it or dropping existing people", async () => {
      loadV2({ people: mockPeople });
      render(<Home />);

      await uploadParsedReceipt(
        createMockReceipt({ restaurant: "Paris Bistro", currency: "EUR" })
      );

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "This receipt is EUR, but this split is in USD."
        );
      });
      expect(screen.queryByText("Paris Bistro")).not.toBeInTheDocument();
      expect(screen.getByText("Testaurant")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("tab", { name: /add people/i }));
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
      expect(screen.getByText(/1 receipt · USD/)).toBeInTheDocument();
    });

    it("keeps people after removing a receipt", async () => {
      loadV2({
        people: mockPeople,
        receipts: [
          { id: "r1", receipt: mockReceipt },
          {
            id: "r2",
            receipt: createMockReceipt({ restaurant: "Second Cafe" }),
          },
        ],
        assignedItems: [
          ["r1", []],
          ["r2", []],
        ],
      });
      render(<Home />);

      fireEvent.click(screen.getByRole("button", { name: /remove second cafe/i }));
      fireEvent.click(screen.getByRole("button", { name: /^remove$/i }));

      await waitFor(() => {
        expect(screen.queryByText("Second Cafe")).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("tab", { name: /add people/i }));
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });

    it("keeps people in the session when the last receipt is removed", async () => {
      loadV2({ people: mockPeople });
      render(<Home />);

      fireEvent.click(screen.getByRole("button", { name: /remove testaurant/i }));
      fireEvent.click(screen.getByRole("button", { name: /^remove$/i }));

      await waitFor(() => {
        const raw = localStorage.getItem("receiptSplitterSession");
        expect(raw).toBeTruthy();
        const parsed = JSON.parse(raw as string);
        expect(parsed.state.receipts).toHaveLength(0);
        expect(parsed.state.people).toHaveLength(mockPeople.length);
      });
    });

    it("clears people when the first receipt is parsed in an empty session", async () => {
      loadV2({
        receipts: [],
        people: mockPeople,
        assignedItems: [],
      });
      render(<Home />);

      await uploadParsedReceipt(
        createMockReceipt({ restaurant: "New Place", currency: "USD" })
      );

      await waitFor(() => {
        expect(screen.getByText("New Place")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("tab", { name: /add people/i }));
      expect(screen.queryByText("Alice")).not.toBeInTheDocument();
      expect(screen.queryByText("Bob")).not.toBeInTheDocument();
    });

    it("caps the session at 10 receipts", async () => {
      const receipts = Array.from({ length: 10 }, (_, i) => ({
        id: `r${i}`,
        receipt: createMockReceipt({ restaurant: `Place ${i}` }),
      }));
      loadV2({
        receipts,
        assignedItems: receipts.map((r) => [r.id, []]),
      });
      render(<Home />);

      await uploadParsedReceipt(
        createMockReceipt({ restaurant: "One Too Many" })
      );

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringMatching(/already has 10 receipts/)
        );
      });
      expect(screen.queryByText("One Too Many")).not.toBeInTheDocument();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("copies a currency edit onto every receipt in the session", async () => {
      loadV2({
        receipts: [
          { id: "r1", receipt: mockReceipt },
          {
            id: "r2",
            receipt: createMockReceipt({ restaurant: "Second Cafe" }),
          },
        ],
        assignedItems: [
          ["r1", []],
          ["r2", []],
        ],
      });
      render(<Home />);

      fireEvent.click(screen.getByRole("button", { name: /edit/i }));
      fireEvent.click(screen.getByRole("combobox", { name: /currency/i }));
      fireEvent.click(screen.getByRole("option", { name: /EUR - Euro/i }));
      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(screen.getAllByText(/· EUR$/).length).toBeGreaterThanOrEqual(2);
      });
    });
  });
});
