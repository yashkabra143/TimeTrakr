---
phase: 02-monetization
plan: "06"
subsystem: frontend
tags: [pdf-export, react-pdf, pro-feature, tax]
dependency_graph:
  requires: ["02-03", "02-05"]
  provides: ["tax-pdf-export"]
  affects: ["client/src/pages/tax.tsx"]
tech_stack:
  added: ["@react-pdf/renderer (client-side PDF generation)"]
  patterns: ["downloadTaxPDF async blob download", "ProGate feature gating via useIsPro hook"]
key_files:
  created:
    - client/src/components/tax-pdf-report.tsx
  modified:
    - client/src/pages/tax.tsx
decisions:
  - "Used unicode escape \\u20B9 for rupee symbol in PDF to avoid encoding issues in @react-pdf/renderer"
  - "Both Export PDF buttons (page header and CA-Ready Summary section) wired to handleExportPdf"
  - "handlePrint/window.print() removed entirely; print-only header div retained as harmless"
metrics:
  duration: "~15 minutes"
  completed_date: "2026-04-07"
  tasks_completed: 2
  files_changed: 2
---

# Phase 02 Plan 06: PDF Export (CA-Ready) Summary

**One-liner:** Client-side CA-ready PDF export using @react-pdf/renderer — Pro users download structured A4 tax report; free users see upgrade modal.

## What Was Built

### Task 1: TaxPDFReport component (`client/src/components/tax-pdf-report.tsx`)

New file with three exports:

- **`TaxReportData` interface** — typed shape for all tax page computed values (income totals, tax liability, installments, GST, TDS entries)
- **`TaxPDFReport` component** — React Document with five sections: Income Summary, Tax Liability Estimate, Advance Tax Schedule, GST Input Tax Credit (conditional on `isGstRegistered`), TDS Certificates (conditional on non-empty entries)
- **`downloadTaxPDF` function** — calls `pdf(<TaxPDFReport />).toBlob()`, creates an object URL, and triggers a browser download named `timetrakr-tax-report-{fy}.pdf`

PDF styling uses amber brand color (`#f59e0b`) for the header border and section title backgrounds, matching the TimeTrakr design system.

### Task 2: Wire Export PDF button (`client/src/pages/tax.tsx`)

- Replaced `handlePrint` (called `window.print()`) with `handleExportPdf` async function
- `handleExportPdf` gates on `isPro` (via `useIsPro()`) — free users see `UpgradeModal` with `featureName="PDF Export"`
- Pro users get a full `TaxReportData` object assembled from all computed values and `downloadTaxPDF` is awaited
- Added `isExporting` boolean state — button shows "Generating..." while PDF renders client-side
- Both Export PDF buttons updated (page header and the one in the CA-Ready Summary section)
- Added `UpgradeModal` render before closing fragment

## Commits

| Hash | Message |
|------|---------|
| b8d9262 | feat(02-06): create TaxPDFReport component and downloadTaxPDF function |
| e729c68 | feat(02-06): wire Export PDF button to downloadTaxPDF with Pro gating |

## Deviations from Plan

**1. [Rule 1 - Bug] Rupee symbol encoding for @react-pdf/renderer**
- **Found during:** Task 1
- **Issue:** The `₹` character (U+20B9) may not render correctly in @react-pdf/renderer when embedded in source as a literal character depending on font/encoding handling
- **Fix:** Used unicode escape `\u20B9` in the `fmt()` helper to ensure correct PDF encoding
- **Files modified:** `client/src/components/tax-pdf-report.tsx`
- **Commit:** b8d9262

## Known Stubs

None — all data is wired from live computed values on the tax page. No hardcoded placeholders.

## Threat Flags

None — this plan adds no new network endpoints, auth paths, or schema changes. PDF generation is entirely client-side.

## Self-Check: PASSED

- [x] `client/src/components/tax-pdf-report.tsx` exists
- [x] `client/src/pages/tax.tsx` contains `handleExportPdf` (not `handlePrint`)
- [x] Commits b8d9262 and e729c68 exist in git log
- [x] `npm run check` produces no errors in tax-related files
