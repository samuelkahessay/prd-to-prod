"use client";

import { useState, useEffect, useCallback } from "react";
import { scanContent } from "./scanner";
import { SEED_SCANS } from "./seed-data";
import type { ContentType, ComplianceDisposition, ComplianceFinding } from "./scanner";

// ── Types ─────────────────────────────────────────────────────────────────────

export type { ContentType, ComplianceDisposition, ComplianceFinding };

export interface ComplianceScan {
  id: string;
  submittedAt: string;
  contentType: ContentType;
  sourceLabel: string;
  content: string;
  disposition: ComplianceDisposition;
  findings: ComplianceFinding[];
  operatorDecision?: "approved" | "rejected";
}

export interface ComplianceMetrics {
  totalScans: number;
  byRegulation: { PIPEDA: number; FINTRAC: number };
  byDisposition: {
    AUTO_BLOCK: number;
    HUMAN_REQUIRED: number;
    ADVISORY: number;
  };
  pendingDecisions: number;
}

// ── Storage keys ──────────────────────────────────────────────────────────────

const KEYS = {
  scans: "cs-showcase-scans",
  seeded: "cs-showcase-seeded",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function save<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

function uid(): string {
  return `scan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useComplianceStore() {
  // SSR-safe: initialize with empty arrays, hydrate in useEffect
  const [scans, setScans] = useState<ComplianceScan[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const seeded = localStorage.getItem(KEYS.seeded);

    if (seeded) {
      setScans(load<ComplianceScan[]>(KEYS.scans) ?? []);
    } else {
      save(KEYS.scans, SEED_SCANS);
      localStorage.setItem(KEYS.seeded, "1");
      setScans(SEED_SCANS);
    }

    setHydrated(true);
  }, []);

  // ── Submit a new scan ─────────────────────────────────────────────────────

  const submitScan = useCallback(
    (content: string, contentType: ContentType, sourceLabel: string) => {
      const { disposition, findings } = scanContent(content, contentType);

      const scan: ComplianceScan = {
        id: uid(),
        submittedAt: new Date().toISOString(),
        contentType,
        sourceLabel: sourceLabel.trim() || "untitled",
        content,
        disposition,
        findings,
      };

      setScans((prev) => {
        const updated = [scan, ...prev];
        save(KEYS.scans, updated);
        return updated;
      });

      return scan;
    },
    []
  );

  // ── Record operator decision on a HUMAN_REQUIRED scan ────────────────────

  const recordDecision = useCallback(
    (scanId: string, decision: "approved" | "rejected") => {
      setScans((prev) => {
        const updated = prev.map((s) =>
          s.id === scanId ? { ...s, operatorDecision: decision } : s
        );
        save(KEYS.scans, updated);
        return updated;
      });
    },
    []
  );

  // ── Metrics ───────────────────────────────────────────────────────────────

  const getMetrics = useCallback((): ComplianceMetrics => {
    const totalScans = scans.length;

    // Count regulations from findings
    const byRegulation = { PIPEDA: 0, FINTRAC: 0 };
    for (const scan of scans) {
      const regulations = new Set(scan.findings.map((f) => f.regulation));
      for (const reg of regulations) {
        byRegulation[reg]++;
      }
    }

    const byDisposition = { AUTO_BLOCK: 0, HUMAN_REQUIRED: 0, ADVISORY: 0 };
    for (const scan of scans) {
      byDisposition[scan.disposition]++;
    }

    const pendingDecisions = scans.filter(
      (s) => s.disposition === "HUMAN_REQUIRED" && !s.operatorDecision
    ).length;

    return { totalScans, byRegulation, byDisposition, pendingDecisions };
  }, [scans]);

  return { scans, hydrated, submitScan, recordDecision, getMetrics };
}
