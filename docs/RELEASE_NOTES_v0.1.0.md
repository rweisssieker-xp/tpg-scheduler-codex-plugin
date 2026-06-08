# TPG-Scheduler-Codex-Plugin v0.1.0

Initial public release for confirmation-gated Dynamics 365 TPG project status reporting and PMO management reporting.

## Highlights

- Dataverse-first project export from the authenticated Dynamics browser context.
- Monthly project-leader status writeback planning with duplicate checks, idempotency, safety gates, and exact confirmation text.
- Optional browser-context `Xrm.WebApi.createRecord` path that requires metadata discovery, validation, duplicate review, and exact confirmation.
- PMO report suite with 12 report types plus DOCX/XLSX outputs.
- Maximum Project Safety Gates and PMO Control Tower checks.
- Status API Max Layer with JSON schemas, synthetic examples, audit events, writeback queues, and Dataverse error mapping.
- Release-readiness checks and machine-readable release evidence manifest.

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
