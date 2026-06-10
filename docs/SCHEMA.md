# JSON Schemas

The plugin exposes stable JSON contracts for offline reports and downstream PMO tooling.

## Files

- `schemas/project-intelligence.schema.json`: top-level project intelligence output for D365 API data and explicit offline fallback snapshots.
- `schemas/board-pack.schema.json`: Full Board Pack / Steering Pack output for executive, PMO, and project-leader review.
- `schemas/project-safety-gates.schema.json`: advisory safety gate suite output.
- `schemas/pmo-control-tower.schema.json`: PMO control tower output with 25 checks per project.
- `schemas/status-api-envelope.schema.json`: versioned Status API envelope.
- `schemas/status-writeback-queue.schema.json`: monthly status writeback queue contract.
- `schemas/status-update-create-plan.schema.json`: confirmation-gated Dataverse create plan.
- `schemas/status-writeback-audit-event.schema.json`: audit event for proposed, staged, saved, skipped, or failed status actions.
- `schemas/status-update-duplicate-check.schema.json`: duplicate detection result for project/month status updates.

The top-level project intelligence schema also includes the filtered `pmoStatusReport` contract and the `statusSuggestionReport` contract for review-only status text suggestions.
The PMO report suite adds uniform report objects with `reportType`, `title`, `generatedAt`, `filters`, `summary`, `sections`, `rows`, `evidence`, and `dataGaps`.
The Maximum USP layer adds `maximumUsps` with exactly 12 implemented advisory differentiators, each carrying implementation status, proof metric, required data, trust controls, and runtime signals.
The PMO USP layer adds `pmoUsps` with exactly 15 implemented operational PMO differentiators plus `commandQueue`, `evidenceLedger`, and `dataGaps`.
The Board Pack layer adds `boardPack` with `packType: "full_board_pack"`, audience sections, steering agenda, decision log, risk register, status suggestions, evidence ledger, data gaps, access issues, and review-only safety flags.
The preferred production data path is live D365 API retrieval through the authenticated Dynamics browser context. Local JSON envelopes or bare project arrays are offline fallback inputs and require `--allow-offline-input`.

DOCX and XLSX exports serialize the same report objects, including `pmoStatusReport`, `statusSuggestionReport`, and Board Pack output; the schema therefore remains the source contract for file-generation consumers.
The Status API Max Layer uses separate schemas so integrations can validate writeback queues and create plans without granting CRM write access.

## Contract Principles

- Outputs are advisory and evidence-backed.
- CRM writeback risk is reported as data, not executed automatically.
- Direct Dataverse write plans must declare `canAutoSave: false` and a confirmation text.
- Required evidence and recommended actions are explicit arrays so consuming tools can show missing proof before a project is discussed in governance.
- Unknown future fields may be added by minor versions; consumers should ignore fields they do not understand.

## Validation Use

Run local validation from the plugin package:

```powershell
cd plugins/tpg-scheduler-codex-plugin
npm run validate
```

The validator parses every schema, verifies the safety and PMO contract anchors, and checks the documentation-only sample output. Productive CLI runs reject sample or fixture paths.
