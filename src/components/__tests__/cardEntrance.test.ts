/**
 * Characterization tests for armCardsOnImageReady (plan 148). No mocking
 * needed — the helper has no external module dependencies, so these tests
 * exercise real DOM via happy-dom.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { armCardsOnImageReady } from "@/lib/ui/cardEntrance";

function wrapperWithImage(): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "article-card-wrapper";
  const img = document.createElement("img");
  wrapper.appendChild(img);
  return wrapper;
}

function setupGrid(...wrappers: HTMLElement[]): HTMLElement {
  const grid = document.createElement("div");
  grid.className = "article-grid";
  wrappers.forEach((w) => grid.appendChild(w));
  document.body.appendChild(grid);
  return grid;
}

describe("armCardsOnImageReady", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("arms a wrapper with no <img> synchronously", () => {
    const wrapper = document.createElement("div");
    wrapper.className = "article-card-wrapper";
    setupGrid(wrapper);

    armCardsOnImageReady(document, 1200);

    expect(wrapper.classList.contains("entrance-armed")).toBe(true);
  });

  it("arms a wrapper whose image.complete is already true, synchronously", () => {
    const wrapper = wrapperWithImage();
    const img = wrapper.querySelector("img")!;
    Object.defineProperty(img, "complete", { value: true });
    setupGrid(wrapper);

    armCardsOnImageReady(document, 1200);

    expect(wrapper.classList.contains("entrance-armed")).toBe(true);
  });

  it("arms a wrapper when its image fires load", () => {
    const wrapper = wrapperWithImage();
    const img = wrapper.querySelector("img")!;
    Object.defineProperty(img, "complete", { value: false });
    setupGrid(wrapper);

    armCardsOnImageReady(document, 1200);
    expect(wrapper.classList.contains("entrance-armed")).toBe(false);

    img.dispatchEvent(new Event("load"));
    expect(wrapper.classList.contains("entrance-armed")).toBe(true);
  });

  it("arms a wrapper when its image fires error", () => {
    const wrapper = wrapperWithImage();
    const img = wrapper.querySelector("img")!;
    Object.defineProperty(img, "complete", { value: false });
    setupGrid(wrapper);

    armCardsOnImageReady(document, 1200);
    expect(wrapper.classList.contains("entrance-armed")).toBe(false);

    img.dispatchEvent(new Event("error"));
    expect(wrapper.classList.contains("entrance-armed")).toBe(true);
  });

  it("arms a wrapper whose image never settles, after the timeout", () => {
    vi.useFakeTimers();
    const wrapper = wrapperWithImage();
    const img = wrapper.querySelector("img")!;
    Object.defineProperty(img, "complete", { value: false });
    setupGrid(wrapper);

    armCardsOnImageReady(document, 1200);
    expect(wrapper.classList.contains("entrance-armed")).toBe(false);

    vi.advanceTimersByTime(1199);
    expect(wrapper.classList.contains("entrance-armed")).toBe(false);

    vi.advanceTimersByTime(1);
    expect(wrapper.classList.contains("entrance-armed")).toBe(true);
  });

  it("is idempotent: arming a wrapper twice adds the class once", () => {
    vi.useFakeTimers();
    const wrapper = wrapperWithImage();
    const img = wrapper.querySelector("img")!;
    Object.defineProperty(img, "complete", { value: false });
    setupGrid(wrapper);

    armCardsOnImageReady(document, 1200);
    img.dispatchEvent(new Event("load"));
    vi.advanceTimersByTime(1200);

    expect(
      wrapper.className.split(" ").filter((c) => c === "entrance-armed")
        .length,
    ).toBe(1);
  });
});
