/**
 * @jest-environment node
 */
jest.mock("@/lib/uploadthing-storage", () => ({
  listReceiptFiles: jest.fn(),
  deleteReceiptFiles: jest.fn(),
}));
jest.mock("@/lib/webhook-notifications", () => ({
  sendErrorNotification: jest.fn(),
}));

import { GET } from "./route";
import { listReceiptFiles, deleteReceiptFiles } from "@/lib/uploadthing-storage";
import { sendErrorNotification } from "@/lib/webhook-notifications";

const mockList = listReceiptFiles as jest.Mock;
const mockDelete = deleteReceiptFiles as jest.Mock;

function makeRequest(auth?: string) {
  const headers = new Headers();
  if (auth !== undefined) {
    headers.set("authorization", auth);
  }
  return { headers } as unknown as Parameters<typeof GET>[0];
}

function oldDate(daysAgo: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.UPLOADTHING_TOKEN = "token";
  delete process.env.VERCEL_ENV;
  delete process.env.CRON_SECRET;
  mockDelete.mockResolvedValue(true);
  (sendErrorNotification as jest.Mock).mockResolvedValue(undefined);
});

describe("cleanup-old-receipts cron", () => {
  it("allows unauthenticated access in non-production when CRON_SECRET is unset", async () => {
    mockList.mockResolvedValue({ files: [], hasMore: false });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
  });

  it("returns 401 when CRON_SECRET is set but authorization is wrong", async () => {
    process.env.CRON_SECRET = "secret";
    const res = await GET(makeRequest("Bearer wrong"));
    expect(res.status).toBe(401);
  });

  it("returns 500 in production when CRON_SECRET is missing", async () => {
    process.env.VERCEL_ENV = "production";
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    expect(sendErrorNotification).toHaveBeenCalledWith(
      "cleanup_config_error",
      expect.stringContaining("CRON_SECRET")
    );
  });

  it("pages through list results and deletes old keys in batches", async () => {
    process.env.CRON_SECRET = "secret";
    mockList
      .mockResolvedValueOnce({
        files: [{ key: "old1", customId: null, name: "a", uploadedAt: oldDate(100) }],
        hasMore: true,
      })
      .mockResolvedValueOnce({
        files: [{ key: "new1", customId: null, name: "b", uploadedAt: oldDate(1) }],
        hasMore: false,
      });

    const res = await GET(makeRequest("Bearer secret"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockList).toHaveBeenCalledTimes(2);
    expect(mockDelete).toHaveBeenCalledWith(["old1"]);
    expect(body.deleted).toBe(1);
    expect(body.pages).toBe(2);
    expect(body.partial).toBe(false);
  });

  it("sets partial when list throws after starting", async () => {
    process.env.CRON_SECRET = "secret";
    mockList.mockRejectedValue(new Error("list boom"));

    const res = await GET(makeRequest("Bearer secret"));
    expect(res.status).toBe(500);
    expect(sendErrorNotification).toHaveBeenCalledWith(
      "cleanup_job_failure",
      expect.stringContaining("list boom")
    );
  });

  it("returns 500 when a delete batch fails", async () => {
    process.env.CRON_SECRET = "secret";
    const keys = Array.from({ length: 150 }, (_, i) => `k${i}`);
    mockList.mockResolvedValue({
      files: keys.map((key) => ({
        key,
        customId: null,
        name: key,
        uploadedAt: oldDate(100),
      })),
      hasMore: false,
    });
    mockDelete.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const res = await GET(makeRequest("Bearer secret"));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(mockDelete).toHaveBeenCalledTimes(2);
    expect(body.success).toBe(false);
    expect(body.deleted).toBe(100);
    expect(body.failed).toBe(50);
    expect(sendErrorNotification).toHaveBeenCalledWith(
      "cleanup_delete_failure",
      expect.stringContaining("50")
    );
  });

  it("stops deleting when the elapsed-time guard trips", async () => {
    jest.useFakeTimers();
    process.env.CRON_SECRET = "secret";
    const keys = Array.from({ length: 250 }, (_, i) => `k${i}`);
    mockList.mockResolvedValue({
      files: keys.map((key) => ({
        key,
        customId: null,
        name: key,
        uploadedAt: oldDate(100),
      })),
      hasMore: false,
    });
    mockDelete.mockResolvedValue(true);

    const started = Date.now();
    jest.setSystemTime(started);
    const requestPromise = GET(makeRequest("Bearer secret"));
    jest.setSystemTime(started + 241_000);
    await jest.runAllTimersAsync();
    const res = await requestPromise;
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.partial).toBe(true);
    expect(body.deleted).toBeLessThan(250);
    expect(sendErrorNotification).toHaveBeenCalledWith(
      "cleanup_partial",
      expect.stringContaining("partial")
    );
    jest.useRealTimers();
  });

  it("sends a partial notification when listing stops early", async () => {
    process.env.CRON_SECRET = "secret";
    const many = Array.from({ length: 500 }, (_, i) => ({
      key: `k${i}`,
      customId: null,
      name: `k${i}`,
      uploadedAt: oldDate(1),
    }));
    mockList
      .mockResolvedValueOnce({ files: many, hasMore: true })
      .mockResolvedValueOnce({ files: many, hasMore: true })
      .mockResolvedValueOnce({ files: many, hasMore: true })
      .mockResolvedValueOnce({ files: many, hasMore: true })
      .mockResolvedValueOnce({ files: many, hasMore: true })
      .mockResolvedValueOnce({ files: many, hasMore: true });

    jest.useFakeTimers();
    const started = Date.now();
    jest.setSystemTime(started);
    const requestPromise = GET(makeRequest("Bearer secret"));
    jest.setSystemTime(started + 241_000);
    const res = await requestPromise;
    const body = await res.json();

    expect(body.partial).toBe(true);
    expect(sendErrorNotification).toHaveBeenCalledWith(
      "cleanup_partial",
      expect.stringMatching(/listed|deleted/i)
    );
    jest.useRealTimers();
  });
});
