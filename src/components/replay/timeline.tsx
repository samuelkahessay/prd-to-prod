"use client";

import { useState } from "react";
import type { PipelineData } from "@/data/types";

export interface TimelineEvent {
  id: string;
  type: "issue" | "pr" | "review" | "merge";
  title: string;
  timestamp: string;
}

// Timeline runs 05:29 → 07:24 UTC (as per fixture data)
const START_TIME = new Date("2026-02-25T05:29:00Z").getTime();
const END_TIME = new Date("2026-02-25T07:24:05Z").getTime();
const DURATION = END_TIME - START_TIME;

const DOT_COLORS: Record<TimelineEvent["type"], string> = {
  issue: "bg-blue-500",
  pr: "bg-green-500",
  review: "bg-yellow-400",
  merge: "bg-purple-500",
};

function pct(ts: string): number {
  const ms = new Date(ts).getTime();
  return Math.min(100, Math.max(0, ((ms - START_TIME) / DURATION) * 100));
}

function fmtTime(ts: string): string {
  const d = new Date(ts);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

function buildEvents(data: PipelineData): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const issue of data.issues) {
    events.push({
      id: `issue-created-${issue.number}`,
      type: "issue",
      title: `Issue #${issue.number} Created: ${issue.title}`,
      timestamp: issue.createdAt,
    });
  }

  for (const pr of data.pullRequests) {
    events.push({
      id: `pr-opened-${pr.number}`,
      type: "pr",
      title: `PR #${pr.number} Opened: ${pr.title}`,
      timestamp: pr.createdAt,
    });
    if (pr.mergedAt) {
      events.push({
        id: `pr-merged-${pr.number}`,
        type: "merge",
        title: `PR #${pr.number} Merged: ${pr.title}`,
        timestamp: pr.mergedAt,
      });
    }
    for (let i = 0; i < pr.reviews.length; i++) {
      const review = pr.reviews[i];
      if (review.submittedAt) {
        events.push({
          id: `review-${pr.number}-${i}`,
          type: "review",
          title: `Review on PR #${pr.number} by ${review.author}`,
          timestamp: review.submittedAt,
        });
      }
    }
  }

  return events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

// Build axis ticks every 15 minutes from START_TIME to END_TIME
function buildTicks(): string[] {
  const ticks: string[] = [];
  const step = 15 * 60 * 1000;
  let t = START_TIME;
  while (t <= END_TIME) {
    const d = new Date(t);
    ticks.push(
      `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`
    );
    t += step;
  }
  return ticks;
}

interface TimelineProps {
  data: PipelineData;
}

export function Timeline({ data }: TimelineProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const events = buildEvents(data);
  const ticks = buildTicks();

  const issueCount = events.filter((e) => e.type === "issue").length;
  const prCount = events.filter((e) => e.type === "pr").length;
  const reviewCount = events.filter((e) => e.type === "review").length;
  const mergeCount = events.filter((e) => e.type === "merge").length;

  // Duration in minutes
  const durationMins = Math.round(DURATION / 60000);
  const durationHrs = Math.floor(durationMins / 60);
  const durationRemMins = durationMins % 60;

  return (
    <div className="flex flex-col gap-6">
      {/* Summary bar */}
      <div className="bg-gray-800 rounded-lg px-6 py-3 text-sm text-gray-300 font-mono">
        {issueCount} issues → {prCount} PRs → {reviewCount} reviews → {mergeCount} merges |{" "}
        {durationHrs}h {durationRemMins}m total
      </div>

      {/* Scrollable timeline */}
      <div
        className="overflow-x-auto rounded-lg border border-gray-800 bg-gray-900 p-4"
        role="region"
        aria-label="Pipeline event timeline"
      >
        <div className="relative min-w-[2400px] h-32">
          {/* Time axis ticks */}
          {ticks.map((tick, i) => {
            const d = new Date(`2026-02-25T${tick}:00Z`);
            const x = ((d.getTime() - START_TIME) / DURATION) * 100;
            return (
              <div key={tick} className="absolute top-0 flex flex-col items-center" style={{ left: `${x}%` }}>
                <div className="w-px h-3 bg-gray-600" />
                <span className="text-gray-500 text-[10px] mt-0.5">{tick}</span>
              </div>
            );
          })}

          {/* Axis baseline */}
          <div className="absolute top-3 left-0 right-0 h-px bg-gray-700" />

          {/* Event dots */}
          {events.map((event) => {
            const x = pct(event.timestamp);
            const isSelected = selected === event.id;
            return (
              <div
                key={event.id}
                className="absolute top-2 -translate-x-1/2 group cursor-pointer"
                style={{ left: `${x}%` }}
                onClick={() => setSelected(isSelected ? null : event.id)}
                role="button"
                aria-label={event.title}
                aria-pressed={isSelected}
              >
                <div
                  className={`w-3 h-3 rounded-full ${DOT_COLORS[event.type]} ${
                    isSelected ? "ring-2 ring-white ring-offset-1 ring-offset-gray-900" : ""
                  } transition-all`}
                />
                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 pointer-events-none">
                  <div className="bg-gray-700 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg max-w-xs truncate">
                    <div className="font-medium">{fmtTime(event.timestamp)}</div>
                    <div>{event.title}</div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Legend */}
          <div className="absolute bottom-0 left-0 flex gap-4 text-xs text-gray-400">
            {(["issue", "pr", "review", "merge"] as const).map((t) => (
              <span key={t} className="flex items-center gap-1">
                <span className={`w-2.5 h-2.5 rounded-full inline-block ${DOT_COLORS[t]}`} />
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Selected event details */}
      {selected && (
        <div className="bg-gray-800 rounded-lg px-6 py-3 text-sm text-gray-200">
          {(() => {
            const ev = events.find((e) => e.id === selected)!;
            return (
              <>
                <span className="font-medium text-white">{fmtTime(ev.timestamp)}</span> —{" "}
                {ev.title}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
