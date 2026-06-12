import { getSessionId } from "./session";

describe("getSessionId", () => {
  it("creates and persists a session ID on first call", () => {
    const id = getSessionId();
    expect(id).toBe("00000000-0000-4000-8000-000000000000");
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "receiptSplitterSessionId",
      id
    );
  });

  it("returns the same ID on subsequent calls", () => {
    const first = getSessionId();
    const second = getSessionId();
    expect(second).toBe(first);
    expect(localStorage.setItem).toHaveBeenCalledTimes(1);
  });
});
