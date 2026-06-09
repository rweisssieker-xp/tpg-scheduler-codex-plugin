---
name: status-report
description: Run the TPG-Scheduler-Codex-Plugin workflow for confirmation-gated Dynamics 365 TPG project status reporting from the repository root plugin entry.
---

# TPG Status Report

Use this root skill entry when the plugin is installed from the repository root. The implementation package, tests, fixtures, and deeper documentation live in `plugins/tpg-scheduler-codex-plugin/`.

For PMO reporting, portfolio management packs, the 12-report PMO suite, or DOCX/XLSX management reports, use the `pmo-report-suite` skill instead.

## Operating Rules

- Use the Codex in-app Browser for Dynamics 365 work.
- Read Dataverse data through the authenticated Dynamics browser context as the primary path unless the user explicitly provides offline JSON.
- For PMO inputs, create a read-only `tpg_pmo_project_export` via `TPGProjectAssist.downloadPmoProjectExport()` or `copyPmoProjectExportToClipboard()`.
- Verify the configured project manager before collecting or staging a status update.
- For monthly runs, prepare one Status Update per active verified project and report month with `--monthly-status-plan`.
- Use the Status API Max Layer for status history, duplicate checks, idempotency, writeback queues, metadata discovery, permission probes, audit events, and confirmation-gated Dataverse create plans.
- Show project safety level and PMO control findings before collecting or staging a status update.
- When generating intelligence JSON, include and explain `maximumUsps` if the user asks for USPs, differentiation, PMO/CIO/CEO value, or product positioning.
- When the user asks for PMO-specific value, operational PMO workflows, steering, audit, or CIO/CEO PMO outcomes, include and explain `pmoUsps`.
- Treat `kv` as the configured unchanged-status shortcut.
- Never save, submit, send, delete, change ownership, or change CRM state without explicit user confirmation.
- Treat Email Status Update as a separate high-risk setting that must be reviewed before any save.

## Local Commands

```powershell
cd plugins/tpg-scheduler-codex-plugin
npm run status-report:help
node ./scripts/statusbericht.js --intelligence <real-project-export.json>
node ./scripts/statusbericht.js --monthly-status-plan <real-project-export.json> --month YYYY-MM --json
node ./scripts/statusbericht.js --pmo-report <real-project-export.json> --project-status "In Progress"
node ./scripts/statusbericht.js --pmo-report <real-project-export.json> --docx reports/pmo-status.docx --xlsx reports/pmo-status.xlsx
npm test
```

## Evidence To Show

Before staging any CRM draft, show:

- project identity and current record URL
- project-manager verification result
- safety level and writeback risk
- PMO intervention recommendation
- maximum USP signals when relevant
- PMO USP command queue, evidence ledger, and data gaps when relevant
- required evidence gaps
- exact status text and email setting that would be staged
