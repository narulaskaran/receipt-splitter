import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Home from "./page";
import { toast } from "sonner";
import { mockReceipt, mockPeople, mockGroups, createMockReceipt } from "@/test/test-utils";
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

    it("hides the progress bar and Split evenly button", () => {
      render(<Home />);
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /split evenly/i })).not.toBeInTheDocument();
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

  describe("Split evenly button", () => {
    it("is disabled when no people are added", () => {
      loadSession({}, "assign");
      render(<Home />);
      expect(screen.getByRole("button", { name: /split evenly/i })).toBeDisabled();
    });

    it("assigns all items and fires success toast when clicked", () => {
      loadSession({ people: mockPeople }, "assign");
      render(<Home />);

      fireEvent.click(screen.getByRole("button", { name: /split evenly/i }));

      expect(toast.success).toHaveBeenCalledWith(
        "Split remaining items on Testaurant."
      );
      expect(toast.info).not.toHaveBeenCalled();
      expect(screen.getByText("100%")).toBeInTheDocument();
    });

    it("uses Untitled receipt in the toast when the restaurant has no name", () => {
      loadSession(
        {
          people: mockPeople,
          originalReceipt: { ...mockReceipt, restaurant: null },
        },
        "assign"
      );
      render(<Home />);

      fireEvent.click(screen.getByRole("button", { name: /split evenly/i }));

      expect(toast.success).toHaveBeenCalledWith(
        "Split remaining items on Untitled receipt."
      );
      expect(toast.info).not.toHaveBeenCalled();
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

    function goToPeopleTab() {
      fireEvent.click(screen.getByRole("button", { name: /next/i }));
      expect(screen.getByRole("tab", { name: /add people/i })).toHaveAttribute(
        "data-state",
        "active"
      );
    }

    it("keeps people when a second same-currency receipt is parsed", async () => {
      loadV2({ people: mockPeople });
      render(<Home />);

      await uploadParsedReceipt(
        createMockReceipt({ restaurant: "Second Cafe", currency: "USD" })
      );

      await waitFor(() => {
        expect(screen.getAllByText("Second Cafe").length).toBeGreaterThan(0);
      });

      goToPeopleTab();
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
      expect(screen.getAllByText("Testaurant").length).toBeGreaterThan(0);

      goToPeopleTab();
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

      goToPeopleTab();
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

    it("keeps people and groups after removing every receipt and uploading again", async () => {
      loadV2({ people: mockPeople, groups: mockGroups });
      render(<Home />);

      fireEvent.click(screen.getByRole("button", { name: /remove testaurant/i }));
      fireEvent.click(screen.getByRole("button", { name: /^remove$/i }));

      await waitFor(() => {
        expect(screen.queryByText("Testaurant")).not.toBeInTheDocument();
      });

      await uploadParsedReceipt(
        createMockReceipt({ restaurant: "Retry Cafe", currency: "USD" })
      );

      await waitFor(() => {
        expect(screen.getAllByText("Retry Cafe").length).toBeGreaterThan(0);
      });

      goToPeopleTab();
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
      expect(screen.getByText("Team A")).toBeInTheDocument();
      expect(screen.getByText("Team B")).toBeInTheDocument();
      expect(screen.getByText(/1 receipt · USD/)).toBeInTheDocument();
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

    it("rejects a currency edit on one receipt without rewriting the others", async () => {
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
        expect(toast.error).toHaveBeenCalledWith(
          "This receipt is EUR, but this split is in USD."
        );
      });
      expect(toast.success).not.toHaveBeenCalledWith("Receipt details updated");
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
      expect(screen.getAllByText(/· USD$/).length).toBeGreaterThanOrEqual(2);
      expect(screen.queryByText(/· EUR$/)).not.toBeInTheDocument();
    });

    it("allows changing currency when the session has a single receipt", async () => {
      loadV2();
      render(<Home />);

      fireEvent.click(screen.getByRole("button", { name: /edit/i }));
      fireEvent.click(screen.getByRole("combobox", { name: /currency/i }));
      fireEvent.click(screen.getByRole("option", { name: /EUR - Euro/i }));
      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(screen.getByText(/EUR - Euro/)).toBeInTheDocument();
      });
      expect(toast.error).not.toHaveBeenCalled();
    });
  });

  describe("multi-receipt assign tab", () => {
    const receiptA = createMockReceipt({
      restaurant: "Alpha Grill",
      date: "2024-06-01",
      items: [{ name: "Steak", price: 20, quantity: 1 }],
      subtotal: 20,
      tax: 0,
      tip: 0,
      total: 20,
    });
    const receiptB = createMockReceipt({
      restaurant: "Beta Cafe",
      date: "2024-06-02",
      items: [{ name: "Latte", price: 5, quantity: 1 }],
      subtotal: 5,
      tax: 0,
      tip: 0,
      total: 5,
    });

    function loadTwoReceipts(assignedItems?: unknown) {
      localStorage.setItem(
        "receiptSplitterSession",
        JSON.stringify({
          version: 2,
          state: {
            receipts: [
              { id: "r1", receipt: receiptA },
              { id: "r2", receipt: receiptB },
            ],
            people: mockPeople,
            assignedItems: assignedItems ?? [
              ["r1", []],
              ["r2", []],
            ],
            groups: [],
            isLoading: false,
            error: null,
          },
          activeTab: "assign",
        })
      );
    }

    function cardFor(name: string) {
      return screen.getByText(name).closest("[data-slot='card']") as HTMLElement;
    }

    it("renders both restaurant names as assignment cards", () => {
      loadTwoReceipts();
      render(<Home />);
      expect(screen.getByText("Alpha Grill")).toBeInTheDocument();
      expect(screen.getByText("Beta Cafe")).toBeInTheDocument();
      expect(screen.getByText("2024-06-01")).toBeInTheDocument();
      expect(screen.getByText("2024-06-02")).toBeInTheDocument();
    });

    it("split evenly on one receipt does not assign items on the other", () => {
      loadTwoReceipts();
      render(<Home />);

      fireEvent.click(
        within(cardFor("Alpha Grill")).getByRole("button", { name: /split evenly/i })
      );

      expect(toast.success).toHaveBeenCalledWith(
        "Split remaining items on Alpha Grill."
      );
      expect(
        within(cardFor("Alpha Grill")).queryAllByText(/unassigned/i)
      ).toHaveLength(0);
      expect(
        within(cardFor("Beta Cafe")).getAllByText(/unassigned/i).length
      ).toBeGreaterThan(0);
      expect(
        within(cardFor("Beta Cafe")).getByRole("button", { name: /split evenly/i })
      ).toBeEnabled();
      expect(screen.getByText("50%")).toBeInTheDocument();
    });

    it("progress reflects items across both receipts", () => {
      loadTwoReceipts([
        ["r1", [[0, [{ personId: "a", sharePercentage: 100 }]]]],
        ["r2", []],
      ]);
      render(<Home />);
      expect(screen.getByText("50%")).toBeInTheDocument();
    });

    it("always shows the date and numbers #n among duplicate titles only", () => {
      localStorage.setItem(
        "receiptSplitterSession",
        JSON.stringify({
          version: 2,
          state: {
            receipts: [
              {
                id: "r1",
                receipt: createMockReceipt({
                  restaurant: "Coffee",
                  date: "2024-01-01",
                  items: [{ name: "Latte", price: 5, quantity: 1 }],
                  subtotal: 5,
                  tax: 0,
                  tip: 0,
                  total: 5,
                }),
              },
              {
                id: "r2",
                receipt: createMockReceipt({
                  restaurant: "Lunch",
                  date: "2024-01-02",
                  items: [{ name: "Sandwich", price: 8, quantity: 1 }],
                  subtotal: 8,
                  tax: 0,
                  tip: 0,
                  total: 8,
                }),
              },
              {
                id: "r3",
                receipt: createMockReceipt({
                  restaurant: "Coffee",
                  date: "2024-01-01",
                  items: [{ name: "Mocha", price: 6, quantity: 1 }],
                  subtotal: 6,
                  tax: 0,
                  tip: 0,
                  total: 6,
                }),
              },
            ],
            people: mockPeople,
            assignedItems: [
              ["r1", []],
              ["r2", []],
              ["r3", []],
            ],
            groups: [],
            isLoading: false,
            error: null,
          },
          activeTab: "assign",
        })
      );
      render(<Home />);

      expect(screen.getAllByText("Coffee")).toHaveLength(2);
      expect(screen.getByText("Lunch")).toBeInTheDocument();
      expect(screen.getByText("2024-01-01 · #1")).toBeInTheDocument();
      expect(screen.getByText("2024-01-02")).toBeInTheDocument();
      expect(screen.getByText("2024-01-01 · #2")).toBeInTheDocument();
      expect(screen.queryByText("2024-01-01 · #3")).not.toBeInTheDocument();
      expect(screen.queryByText("#1", { exact: true })).not.toBeInTheDocument();
      expect(screen.queryByText("#3", { exact: true })).not.toBeInTheDocument();
    });

    it("names the receipt in the split evenly toast", () => {
      localStorage.setItem(
        "receiptSplitterSession",
        JSON.stringify({
          version: 2,
          state: {
            receipts: [
              {
                id: "r1",
                receipt: createMockReceipt({
                  restaurant: "Starbucks",
                  date: "2024-01-01",
                  items: [{ name: "Latte", price: 5, quantity: 1 }],
                  subtotal: 5,
                  tax: 0,
                  tip: 0,
                  total: 5,
                }),
              },
              {
                id: "r2",
                receipt: createMockReceipt({
                  restaurant: "Starbucks",
                  date: "2024-01-02",
                  items: [{ name: "Mocha", price: 6, quantity: 1 }],
                  subtotal: 6,
                  tax: 0,
                  tip: 0,
                  total: 6,
                }),
              },
            ],
            people: mockPeople,
            assignedItems: [
              ["r1", []],
              ["r2", []],
            ],
            groups: [],
            isLoading: false,
            error: null,
          },
          activeTab: "assign",
        })
      );
      render(<Home />);

      const morningCard = screen
        .getByText("2024-01-01 · #1")
        .closest("[data-slot='card']") as HTMLElement;
      fireEvent.click(
        within(morningCard).getByRole("button", { name: /split evenly/i })
      );

      expect(toast.success).toHaveBeenCalledWith(
        "Split remaining items on Starbucks."
      );
      expect(toast.info).not.toHaveBeenCalled();
    });
  });
});
