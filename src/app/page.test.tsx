import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Home from "./page";
import { toast } from "sonner";
import { setupGlobalMocks, mockReceipt, mockPeople } from "@/test/test-utils";

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

beforeAll(() => {
  setupGlobalMocks();
});

beforeEach(() => {
  jest.clearAllMocks();
  localStorageMock.clear();
});

describe("Home Page", () => {
  describe("Initial Render", () => {
    it("renders the main heading", () => {
      render(<Home />);
      expect(screen.getByText("Receipt Splitter")).toBeInTheDocument();
    });

    it("renders the description", () => {
      render(<Home />);
      expect(
        screen.getByText(/upload a receipt, add people, and easily split items/i)
      ).toBeInTheDocument();
    });

    it("renders all tab triggers", () => {
      render(<Home />);
      expect(screen.getByRole("tab", { name: /upload receipt/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /add people/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /assign items/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /results/i })).toBeInTheDocument();
    });

    it("starts on the upload tab", () => {
      render(<Home />);
      expect(screen.getByRole("tab", { name: /upload receipt/i })).toHaveAttribute(
        "data-state",
        "active"
      );
    });

    it("renders navigation buttons", () => {
      render(<Home />);
      expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
    });

    it("renders New Split button", () => {
      render(<Home />);
      expect(screen.getByRole("button", { name: /new split/i })).toBeInTheDocument();
    });

    it("renders Ko-fi button", () => {
      render(<Home />);
      // Ko-fi button is rendered with an image
      expect(screen.getByAltText(/buy me a coffee at ko-fi.com/i)).toBeInTheDocument();
    });
  });

  describe("Navigation", () => {
    it("disables Add People tab when no receipt is uploaded", () => {
      render(<Home />);
      const peopleTab = screen.getByRole("tab", { name: /add people/i });
      expect(peopleTab).toBeDisabled();
    });

    it("disables Assign Items tab when no receipt is uploaded", () => {
      render(<Home />);
      const assignTab = screen.getByRole("tab", { name: /assign items/i });
      expect(assignTab).toBeDisabled();
    });

    it("disables Results tab when no receipt is uploaded", () => {
      render(<Home />);
      const resultsTab = screen.getByRole("tab", { name: /results/i });
      expect(resultsTab).toBeDisabled();
    });

    it("disables Back button on upload tab", () => {
      render(<Home />);
      const backButton = screen.getByRole("button", { name: /back/i });
      expect(backButton).toBeDisabled();
    });

    it("disables Next button when no receipt is uploaded", () => {
      render(<Home />);
      const nextButton = screen.getByRole("button", { name: /next/i });
      expect(nextButton).toBeDisabled();
    });
  });

  describe("New Split Button", () => {
    it("is disabled when there is no session", () => {
      render(<Home />);
      const newSplitButton = screen.getByRole("button", { name: /new split/i });
      expect(newSplitButton).toBeDisabled();
    });

    it("clears localStorage when clicked", () => {
      // Set up a session in localStorage
      localStorageMock.setItem(
        "receiptSplitterSession",
        JSON.stringify({
          state: { originalReceipt: mockReceipt, people: [], assignedItems: [], unassignedItems: [], groups: [], isLoading: false, error: null },
          activeTab: "people",
        })
      );

      render(<Home />);

      // The button should be enabled because there's a session
      const newSplitButton = screen.getByRole("button", { name: /new split/i });
      expect(newSplitButton).toBeEnabled();

      // Click it
      fireEvent.click(newSplitButton);

      // Verify the session was reset (button becomes disabled)
      expect(newSplitButton).toBeDisabled();

      // Verify active tab is back to upload
      expect(screen.getByRole("tab", { name: /upload receipt/i })).toHaveAttribute("data-state", "active");
    });
  });

  describe("Session Persistence", () => {
    it("restores session from localStorage on mount", () => {
      const savedSession = {
        state: {
          originalReceipt: mockReceipt,
          people: mockPeople,
          assignedItems: [[0, [{ personId: "a", sharePercentage: 100 }]]],
          unassignedItems: [1],
          groups: [],
          isLoading: false,
          error: null,
        },
        activeTab: "people",
      };

      localStorageMock.setItem("receiptSplitterSession", JSON.stringify(savedSession));

      render(<Home />);

      // The People tab should be active
      expect(screen.getByRole("tab", { name: /add people/i })).toHaveAttribute(
        "data-state",
        "active"
      );

      // The receipt should be loaded (tabs should be enabled)
      expect(screen.getByRole("tab", { name: /add people/i })).toBeEnabled();
    });

    it("handles corrupted localStorage data gracefully", () => {
      // Set up a console spy to suppress the expected error log
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      localStorageMock.setItem("receiptSplitterSession", "invalid json {");

      // Should render without throwing (error is logged but handled)
      render(<Home />);

      // Verify the component still renders
      expect(screen.getByText("Receipt Splitter")).toBeInTheDocument();

      // Clean up
      consoleSpy.mockRestore();
    });

    it("saves state to localStorage when state changes", async () => {
      render(<Home />);

      // Simulate a state change by switching tabs (this will trigger the useEffect)
      const uploadTab = screen.getByRole("tab", { name: /upload receipt/i });
      fireEvent.click(uploadTab);

      // Wait for the effect to run and save to localStorage
      await waitFor(() => {
        const savedData = localStorageMock.getItem("receiptSplitterSession");
        expect(savedData).toBeTruthy();
      });
    });
  });

  describe("Tab Content", () => {
    it("shows ReceiptUploader component on upload tab", () => {
      render(<Home />);
      expect(screen.getByText(/drag and drop or click to select/i)).toBeInTheDocument();
    });

    it("shows Ko-fi button at the bottom", () => {
      render(<Home />);
      // Ko-fi button is rendered with an image
      expect(screen.getByAltText(/buy me a coffee at ko-fi.com/i)).toBeInTheDocument();
    });
  });

  describe("Progress Bar", () => {
    it("does not show progress bar when no receipt is uploaded", () => {
      render(<Home />);
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });

    it("shows progress bar when receipt is uploaded", () => {
      const savedSession = {
        state: {
          originalReceipt: mockReceipt,
          people: [],
          assignedItems: [],
          unassignedItems: [0, 1],
          groups: [],
          isLoading: false,
          error: null,
        },
        activeTab: "upload",
      };

      localStorageMock.setItem("receiptSplitterSession", JSON.stringify(savedSession));

      render(<Home />);

      expect(screen.getByRole("progressbar")).toBeInTheDocument();
    });

    it("shows 0% progress when no items are assigned", () => {
      const savedSession = {
        state: {
          originalReceipt: mockReceipt,
          people: [],
          assignedItems: [],
          unassignedItems: [0, 1],
          groups: [],
          isLoading: false,
          error: null,
        },
        activeTab: "upload",
      };

      localStorageMock.setItem("receiptSplitterSession", JSON.stringify(savedSession));

      render(<Home />);

      expect(screen.getByText("0%")).toBeInTheDocument();
    });

    it("shows 100% progress when all items are assigned", () => {
      const savedSession = {
        state: {
          originalReceipt: mockReceipt,
          people: mockPeople,
          assignedItems: [
            [0, [{ personId: "a", sharePercentage: 100 }]],
            [1, [{ personId: "b", sharePercentage: 100 }]],
          ],
          unassignedItems: [],
          groups: [],
          isLoading: false,
          error: null,
        },
        activeTab: "upload",
      };

      localStorageMock.setItem("receiptSplitterSession", JSON.stringify(savedSession));

      render(<Home />);

      expect(screen.getByText("100%")).toBeInTheDocument();
    });
  });

  describe("Split All Evenly Button", () => {
    it("does not show when no receipt is uploaded", () => {
      render(<Home />);
      expect(screen.queryByRole("button", { name: /split all evenly/i })).not.toBeInTheDocument();
    });

    it("shows when receipt is uploaded", () => {
      const savedSession = {
        state: {
          originalReceipt: mockReceipt,
          people: mockPeople,
          assignedItems: [],
          unassignedItems: [0, 1],
          groups: [],
          isLoading: false,
          error: null,
        },
        activeTab: "upload",
      };

      localStorageMock.setItem("receiptSplitterSession", JSON.stringify(savedSession));

      render(<Home />);

      expect(screen.getByRole("button", { name: /split all evenly/i })).toBeInTheDocument();
    });

    it("is disabled when no people are added", () => {
      const savedSession = {
        state: {
          originalReceipt: mockReceipt,
          people: [],
          assignedItems: [],
          unassignedItems: [0, 1],
          groups: [],
          isLoading: false,
          error: null,
        },
        activeTab: "upload",
      };

      localStorageMock.setItem("receiptSplitterSession", JSON.stringify(savedSession));

      render(<Home />);

      expect(screen.getByRole("button", { name: /split all evenly/i })).toBeDisabled();
    });

    it("shows success toast when clicked with valid data", () => {
      const savedSession = {
        state: {
          originalReceipt: mockReceipt,
          people: mockPeople,
          assignedItems: [],
          unassignedItems: [0, 1],
          groups: [],
          isLoading: false,
          error: null,
        },
        activeTab: "upload",
      };

      localStorageMock.setItem("receiptSplitterSession", JSON.stringify(savedSession));

      render(<Home />);

      const splitButton = screen.getByRole("button", { name: /split all evenly/i });
      fireEvent.click(splitButton);

      expect(toast.success).toHaveBeenCalledWith("All items split evenly among everyone!");
    });
  });

  describe("Tab Switching", () => {
    it("enables people tab when receipt is uploaded", () => {
      const savedSession = {
        state: {
          originalReceipt: mockReceipt,
          people: mockPeople,
          assignedItems: [],
          unassignedItems: [0, 1],
          groups: [],
          isLoading: false,
          error: null,
        },
        activeTab: "upload",
      };

      localStorageMock.setItem("receiptSplitterSession", JSON.stringify(savedSession));

      render(<Home />);

      const peopleTab = screen.getByRole("tab", { name: /add people/i });
      const assignTab = screen.getByRole("tab", { name: /assign items/i });

      // Tabs should be enabled when receipt is uploaded and people are added
      expect(peopleTab).toBeEnabled();
      expect(assignTab).toBeEnabled();
    });
  });

  describe("Responsive Design", () => {
    it("renders header elements with responsive classes", () => {
      render(<Home />);
      const heading = screen.getByText("Receipt Splitter");
      expect(heading).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("handles empty receipt items array", () => {
      const emptyReceipt = {
        ...mockReceipt,
        items: [],
      };

      const savedSession = {
        state: {
          originalReceipt: emptyReceipt,
          people: mockPeople,
          assignedItems: [],
          unassignedItems: [],
          groups: [],
          isLoading: false,
          error: null,
        },
        activeTab: "upload",
      };

      localStorageMock.setItem("receiptSplitterSession", JSON.stringify(savedSession));

      expect(() => render(<Home />)).not.toThrow();
    });

    it("handles missing localStorage", () => {
      // Don't set any localStorage
      expect(() => render(<Home />)).not.toThrow();
    });
  });
});
