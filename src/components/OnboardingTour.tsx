"use client";

import { useEffect, useState } from "react";
import type { TourStep } from "@/lib/tour";

interface OnboardingTourProps {
  steps: TourStep[];
  onClose: () => void;
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export default function OnboardingTour({ steps, onClose }: OnboardingTourProps) {
  const [index, setIndex] = useState(0);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);

  const step = steps[index];
  const isFirst = index === 0;
  const isLast = index === steps.length - 1;

  // Locate the target for the current step and measure it from the DOM. Degrade
  // gracefully: if the control is not rendered (e.g. no document loaded), just
  // drop the spotlight ring. setState here synchronizes React with a live DOM
  // measurement, which is a legitimate effect use.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!step?.target) {
      setSpotlight(null);
      return;
    }
    const el = document.querySelector(step.target);
    if (!el) {
      setSpotlight(null);
      return;
    }
    el.scrollIntoView?.({ block: "center", inline: "nearest" });
    const rect = el.getBoundingClientRect();
    setSpotlight({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    });
  }, [step]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!step) return null;

  function next() {
    if (isLast) {
      onClose();
    } else {
      setIndex((i) => i + 1);
    }
  }

  function back() {
    setIndex((i) => Math.max(0, i - 1));
  }

  return (
    <div
      data-testid="onboarding-tour"
      className="fixed inset-0 z-[60] flex items-center justify-center"
    >
      {/* Dimmed backdrop; clicking it closes the tour. */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {spotlight && (
        <div
          className="pointer-events-none absolute rounded-md ring-2 ring-amber-400 ring-offset-2 ring-offset-transparent"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
          }}
          aria-hidden="true"
        />
      )}

      <div
        role="dialog"
        aria-modal="true"
        aria-label={step.title}
        className="relative z-10 w-80 rounded-lg border border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {step.title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Skip"
            className="shrink-0 rounded-md px-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            ×
          </button>
        </div>

        <p className="mt-2 text-xs text-zinc-700 dark:text-zinc-300">
          {step.body}
        </p>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-[11px] text-zinc-500 dark:text-zinc-500">
            Step {index + 1} of {steps.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={back}
              disabled={isFirst}
              className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Back
            </button>
            <button
              onClick={next}
              className="rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {isLast ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
