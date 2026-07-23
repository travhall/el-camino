import { describe, it, expect, beforeEach, vi } from "vitest";
import { requestDeduplicator } from "../requestDeduplication";

describe("requestDeduplicator", () => {
  beforeEach(() => {
    requestDeduplicator.clear();
  });

  it("shares one in-flight call across concurrent requests with the same key", async () => {
    let calls = 0;
    const fetcher = () =>
      new Promise<number>((resolve) => {
        calls++;
        setTimeout(() => resolve(calls), 10);
      });

    const [a, b, c] = await Promise.all([
      requestDeduplicator.dedupe("key-1", fetcher),
      requestDeduplicator.dedupe("key-1", fetcher),
      requestDeduplicator.dedupe("key-1", fetcher),
    ]);

    expect(calls).toBe(1);
    expect(a).toBe(1);
    expect(b).toBe(1);
    expect(c).toBe(1);
  });

  it("runs the fetcher again for sequential (non-overlapping) calls with the same key", async () => {
    let calls = 0;
    const fetcher = async () => {
      calls++;
      return calls;
    };

    const first = await requestDeduplicator.dedupe("key-2", fetcher);
    const second = await requestDeduplicator.dedupe("key-2", fetcher);

    expect(calls).toBe(2);
    expect(first).toBe(1);
    expect(second).toBe(2);
  });

  it("does not share in-flight calls across different keys", async () => {
    const fetcherA = vi.fn(async () => "a");
    const fetcherB = vi.fn(async () => "b");

    const [a, b] = await Promise.all([
      requestDeduplicator.dedupe("key-a", fetcherA),
      requestDeduplicator.dedupe("key-b", fetcherB),
    ]);

    expect(a).toBe("a");
    expect(b).toBe("b");
    expect(fetcherA).toHaveBeenCalledTimes(1);
    expect(fetcherB).toHaveBeenCalledTimes(1);
  });

  it("propagates a rejection to all concurrent waiters on the same key", async () => {
    const error = new Error("fetch failed");
    let calls = 0;
    const fetcher = () =>
      new Promise<never>((_resolve, reject) => {
        calls++;
        setTimeout(() => reject(error), 10);
      });

    const results = await Promise.allSettled([
      requestDeduplicator.dedupe("key-err", fetcher),
      requestDeduplicator.dedupe("key-err", fetcher),
    ]);

    expect(calls).toBe(1);
    expect(results[0].status).toBe("rejected");
    expect(results[1].status).toBe("rejected");
    if (results[0].status === "rejected") expect(results[0].reason).toBe(error);
  });

  it("removes the key from in-flight tracking once the call settles", async () => {
    await requestDeduplicator.dedupe("key-cleanup", async () => "done");
    expect(requestDeduplicator.getInflightCount()).toBe(0);
  });

  it("clear() removes all in-flight tracking", async () => {
    const pending = requestDeduplicator.dedupe(
      "key-pending",
      () => new Promise(() => {}), // never resolves
    );
    expect(requestDeduplicator.getInflightCount()).toBe(1);
    requestDeduplicator.clear();
    expect(requestDeduplicator.getInflightCount()).toBe(0);
    void pending; // avoid unhandled-promise noise; intentionally never settles
  });
});
