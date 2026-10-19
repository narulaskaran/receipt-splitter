/**
 * @jest-environment node
 */
import { POST } from "./route";

describe("POST /share-target", () => {
  it("redirects to the home page when the service worker didn't handle it", async () => {
    const response = POST(
      new Request("https://example.com/share-target", { method: "POST" })
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://example.com/");
  });
});
