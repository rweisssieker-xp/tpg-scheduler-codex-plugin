---
name: status-report
description: Run the TPG-Scheduler-Codex-Plugin workflow for confirmation-gated Dynamics 365 TPG project status reporting from the repository root plugin entry.
---

# TPG Status Report

Use this root skill entry when the plugin is installed from the repository root. The implementation package, tests, fixtures, and deeper documentation live in `plugins/tpg-scheduler-codex-plugin/`.

For PMO reporting, portfolio management packs, the 12-report PMO suite, or DOCX/XLSX management reports, use the `pmo-report-suite` skill instead.

## Operating Rules

- Use the Codex in-app Browser for Dynamics 365 work.
- Read Dataverse data only through the authenticated browser context unless the user explicitly provides offline JSON.
- Verify the configured project manager before collecting or staging a status update.
- Show project safety level and PMO control findings before collecting or staging a status update.
- Treat `kv` as the configured unchanged-status shortcut.
- Never save, submit, send, delete, change ownership, or change CRM state without explicit user confirmation.
- Treat Email Status Update as a separate high-risk setting that must be reviewed before any save.

## Local Commands

```powershell
cd plugins/tpg-scheduler-codex-plugin
npm run status-report:help
node ./scripts/statusbericht.js --intelligence <real-project-export.json>
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
- required evidence gaps
- exact status text and email setting that would be staged
