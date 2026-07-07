import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TOUR_SEEN_KEY,
  TOUR_STEPS,
  hasSeenTour,
  markTourSeen,
} from "./tour";

describe("tour seen flag", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("hasSeenTour returns false when the flag is unset", () => {
    expect(hasSeenTour()).toBe(false);
  });

  it("markTourSeen sets the flag so hasSeenTour returns true", () => {
    markTourSeen();
    expect(localStorage.getItem(TOUR_SEEN_KEY)).toBe("1");
    expect(hasSeenTour()).toBe(true);
  });

  it("hasSeenTour returns false when storage getItem throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("unavailable");
    });
    expect(hasSeenTour()).toBe(false);
  });

  it("markTourSeen does not throw when storage setItem throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("unavailable");
    });
    expect(() => markTourSeen()).not.toThrow();
  });
});

describe("TOUR_STEPS", () => {
  it("has exactly three steps in load → comment → download order", () => {
    expect(TOUR_STEPS).toHaveLength(3);
    expect(TOUR_STEPS.map((s) => s.id)).toEqual([
      "load",
      "comment",
      "download",
    ]);
  });

  it("every step has a non-empty title and body", () => {
    for (const step of TOUR_STEPS) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.body.length).toBeGreaterThan(0);
    }
  });

  it("covers the core flow keywords across step text", () => {
    const text = TOUR_STEPS.map((s) => `${s.title} ${s.body}`)
      .join(" ")
      .toLowerCase();
    expect(text).toContain("load");
    expect(text).toContain("select text");
    expect(text).toContain("download");
  });
});
