// src/utils/url.ts
export function buildSearchUrl(
    baseUrl: URL,
    params: Record<string, string | number | null>
): string {
    const url = new URL(baseUrl);
    Object.entries(params).forEach(([key, value]) => {
        if (value === null || value === '') {
            url.searchParams.delete(key);
        } else {
            url.searchParams.set(key, String(value));
        }
    });
    return url.toString();
}