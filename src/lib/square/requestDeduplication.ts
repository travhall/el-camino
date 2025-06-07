// src/lib/square/requestDeduplication.ts
class RequestDeduplicator {
  private inflight = new Map<string, Promise<any>>();

  async dedupe<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    if (this.inflight.has(key)) {
      return this.inflight.get(key)!;
    }

    const promise = fetcher().finally(() => {
      this.inflight.delete(key);
    });

    this.inflight.set(key, promise);
    return promise;
  }

  clear(): void {
    this.inflight.clear();
  }

  getInflightCount(): number {
    return this.inflight.size;
  }
}

export const requestDeduplicator = new RequestDeduplicator();
