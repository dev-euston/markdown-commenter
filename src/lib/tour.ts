/**
 * Client-side onboarding tour helpers.
 *
 * The "seen" flag lives in localStorage so the tour auto-launches only on a
 * user's first visit and never reappears once seen or dismissed. Everything
 * here is fully offline — no network access anywhere in this module.
 */

export const TOUR_SEEN_KEY = "mdc:tour-seen";

/** Whether the user has already seen (or dismissed) the tour. */
export function hasSeenTour(): boolean {
  try {
    if (typeof window === "undefined" || !window.localStorage) return false;
    return window.localStorage.getItem(TOUR_SEEN_KEY) === "1";
  } catch {
    // Storage may be unavailable (SSR, private mode, disabled). Treat as unseen.
    return false;
  }
}

/** Persist that the tour has been seen. Never throws on storage failure. */
export function markTourSeen(): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.setItem(TOUR_SEEN_KEY, "1");
  } catch {
    // Ignore storage failures — the tour simply may re-appear next visit.
  }
}

export interface TourStep {
  id: string;
  title: string;
  body: string;
  /** CSS selector for the control this step describes, spotlighted if present. */
  target?: string;
}

/** Ordered walkthrough of the core load → comment → download flow. */
export const TOUR_STEPS: TourStep[] = [
  {
    id: "load",
    title: "Load a document",
    body: "Use “Open .md file” or “Open .zip” in the header to load a Markdown document — or drag and drop a file onto the drop zone.",
    target: '[data-tour="load"]',
  },
  {
    id: "comment",
    title: "Add a comment",
    body: "Select text in the rendered document to open a popover and attach a comment. Your comments appear in the sidebar, where you can resolve, reopen, or delete them.",
    target: '[data-tour="document"]',
  },
  {
    id: "download",
    title: "Download your work",
    body: "Use “Download comments” to save the comments JSON, or “Download .zip” to export the document and comments together.",
    target: '[data-tour="download"]',
  },
];
