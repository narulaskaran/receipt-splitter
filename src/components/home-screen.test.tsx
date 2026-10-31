import { render, screen, waitFor } from "@testing-library/react";
import { HomeScreen } from "@/components/home-screen";
import { SESSION_STORAGE_KEY } from "@/lib/session-persistence";
import { mockPeople, mockReceipt } from "@/test/test-utils";

function seedSession() {
  localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      state: {
        originalReceipt: mockReceipt,
        people: mockPeople,
        assignedItems: [],
        unassignedItems: [],
        groups: [],
        isLoading: false,
        error: null,
      },
      activeTab: "people",
    })
  );
}

function sessionWrites(): string[] {
  return (localStorage.setItem as jest.Mock).mock.calls
    .filter((call: unknown[]) => call[0] === SESSION_STORAGE_KEY)
    .map((call: unknown[]) => call[1] as string);
}

describe("HomeScreen persistence", () => {
  it("does not overwrite a restored session with the initial empty state", async () => {
    seedSession();
    (localStorage.setItem as jest.Mock).mockClear();

    render(<HomeScreen />);

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /add people/i })).toHaveAttribute(
        "data-state",
        "active"
      );
    });

    for (const raw of sessionWrites()) {
      const parsed = JSON.parse(raw);
      expect(parsed.state.people).toHaveLength(mockPeople.length);
      expect(parsed.activeTab).toBe("people");
    }
    const stored = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) as string);
    expect(stored.state.people).toHaveLength(mockPeople.length);
  });

  it("does not restore or save until storageReady flips true", async () => {
    seedSession();
    (localStorage.setItem as jest.Mock).mockClear();

    const { rerender } = render(<HomeScreen storageReady={false} />);

    expect(screen.queryByRole("tab", { name: /upload receipt/i })).not.toBeInTheDocument();
    expect(sessionWrites()).toHaveLength(0);
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toContain(mockPeople[0].name);

    rerender(<HomeScreen storageReady />);

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /add people/i })).toHaveAttribute(
        "data-state",
        "active"
      );
    });

    expect(sessionWrites().length).toBeGreaterThan(0);
    for (const raw of sessionWrites()) {
      expect(JSON.parse(raw).state.people).toHaveLength(mockPeople.length);
    }
  });

  it("is a no-op for share-target when the cache API is missing", async () => {
    const cachesDescriptor = Object.getOwnPropertyDescriptor(globalThis, "caches");
    delete (globalThis as { caches?: unknown }).caches;
    window.history.replaceState(null, "", "/?share-target=1");

    render(<HomeScreen />);

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /upload receipt/i })).toBeInTheDocument();
    });
    expect(window.location.search).toBe("?share-target=1");

    if (cachesDescriptor) {
      Object.defineProperty(globalThis, "caches", cachesDescriptor);
    }
    window.history.replaceState(null, "", "/");
  });
});
