import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Home from "./page";
import { toast } from "sonner";
import { mockReceipt, mockPeople } from "@/test/test-utils";

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
});
