# TPG-Scheduler-Codex-Plugin v0.1.0

Initial public release for confirmation-gated Dynamics 365 TPG project status reporting and PMO management reporting.

## Highlights

- D365 API-first project intelligence from the authenticated Dynamics browser context; local snapshots are offline fallback only.
- Monthly project-leader status writeback planning with duplicate checks, idempotency, safety gates, and exact confirmation text.
- Optional browser-context `Xrm.WebApi.createRecord` path that requires metadata discovery, validation, duplicate review, and exact confirmation.
- PMO report suite with 12 report types plus DOCX/XLSX outputs.
- Maximum Project Safety Gates and PMO Control Tower checks.
- Status API Max Layer with JSON schemas, synthetic examples, audit events, writeback queues, and Dataverse error mapping.
- Release-readiness checks and machine-readable release evidence manifest.
- Anonymized live Dynamics evidence note for read-only Dataverse access and form detection.
- Post-release `main` adds the Maximum USP Layer with 12 implemented advisory differentiators in `maximumUsps`.
- Post-release `main` adds the 15 PMO USP Layer with command queue, evidence ledger, data gaps, and `pmoUsps`.
- Post-release `main` adds 15 D365 API Max Features on `window.TPGProjectAssist`, including live PMO control center, status timeline, duplicate prevention, PM self-service flow, steering pack, data-gap worklist, Power BI-ready output, audit evidence pack, and confirmation-gated pilot writeback.
- Post-release `main` adds the Automatic Status Suggestion Report for review-only status wording from D365 project fields and planning data, including JSON/DOCX/XLSX output and live `retrieveStatusSuggestionReportFromD365`.
- Post-release `main` adds the Full Board Pack / Steering Pack with live `retrieveBoardPackFromD365`, JSON/DOCX/XLSX output, audience sections, evidence ledger, project links, and review-only safety flags.
- Post-release `main` adds Maximum Logic Assurance with 15 advisory validation groups, 12 logic-assurance USPs, Board Pack assurance sections, schema/sample contracts, and Markdown/JSON/DOCX/XLSX visibility.

## Safety

- Node.js CLI never writes CRM data.
- Browser writeback remains confirmation-gated.
- Productive CLI commands reject sample and fixture data.
- Generated local reports are ignored by Git.
- Examples are synthetic and documentation-only.

## Validation

Required local checks:

```powershell
cd plugins/tpg-scheduler-codex-plugin
npm test
npm run validate
npm run release:check
npm run release:manifest
npm audit --audit-level=moderate
```

Run `docs/DYNAMICS_E2E_RUNBOOK.md` before production status writeback use.

## Live Dynamics Evidence

The anonymized smoke-test note is available at `docs/LIVE_DYNAMICS_EVIDENCE_v0.1.0.md`. It verifies read-only Dataverse access, project form detection, and Status Update tab/subgrid detection. API Status Update creation remains blocked until the tenant-specific Status Update table metadata is confirmed.
