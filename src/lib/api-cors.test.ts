/**
 * @jest-environment node
 */
import { parseNativeAppOrigins } from "./api-cors";

describe("NATIVE_APP_ORIGINS parsing", () => {
  it("drops wildcard entries", () => {
    expect(parseNativeAppOrigins("*").origins).toEqual([]);
  });

  it("normalizes trailing slashes on https origins", () => {
    expect(parseNativeAppOrigins("https://app.example.com/").origins).toEqual([
      "https://app.example.com",
    ]);
  });

  it("trims surrounding whitespace", () => {
    expect(parseNativeAppOrigins("  myapp://custom  ").origins).toEqual([
      "myapp://custom",
    ]);
  });

  it("ignores entries with a path", () => {
    expect(
      parseNativeAppOrigins("https://app.example.com/extra").origins).toEqual([]);
  });

  it("reports dropped entries", () => {
    expect(parseNativeAppOrigins("*, https://ok.example.com, https://a.example.com/x?y")).toEqual({
      origins: ["https://ok.example.com"],
      ignored: ["*", "https://a.example.com/x?y"],
    });
  });
});
