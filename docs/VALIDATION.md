# Validation

Run all local checks from the plugin package:

```powershell
cd plugins/tpg-scheduler-codex-plugin
npm test
```

This runs:

- JavaScript syntax checks.
- Status workflow tests.
- Project intelligence tests.
- Maximum project safety gate tests.
- PMO control tower tests.
- PMO status report filter tests.
- PMO DOCX and XLSX file export tests.
- PMO report suite tests for all 12 report types.
- Maximum USP Layer tests for all 12 implemented advisory differentiators.
- Dataverse-first PMO export envelope tests for API helpers, browser snippet markers, and CLI input handling.
- Status API Max Layer tests for duplicate checks, idempotency keys, queues, create plans, audit events, attachment plans, error mapping, and browser helper markers.
- `pmo-report-suite` skill presence and report-type documentation.
- CLI behavior tests.
- Plugin metadata and documentation validation.
- The same validation flow used by GitHub Actions CI.

Run only plugin validation:

```powershell
npm run validate
```

Run release-readiness checks:

```powershell
npm run release:check
```

The validation script checks:

- The repository root contains `.codex-plugin/plugin.json` for plugin scanners that evaluate the repo root.
- Plugin and package names match.
- Repository metadata points to GitHub.
- Skill, app, and MCP paths exist.
- Required public documentation files exist.
- Release, privacy, schema, example, ownership, and dependency-management files exist.
- The primary skill is named `status-report`.
- Critical CRM write-safety language remains present.
- Public docs use en-US wording, except for the fixed German CRM `kv` phrase where explicitly documented.
- JSON schemas parse and expose the required project safety and PMO contract anchors.
- Status API schemas parse and expose queue, create-plan, duplicate-check, audit-event, and envelope contracts.
- The synthetic sample output includes `projectSafetyGates` and `pmoControlTower`.
- The synthetic sample output includes `maximumUsps` with 12 implemented USP entries.
- Productive npm intelligence scripts do not point at sample or fixture data.
- No npm script exposes demo, mock, sample, or fixture data as an active command.
- DOCX and XLSX export dependencies are validated, and the vulnerable `exceljs` dependency tree is disallowed.
- Dataverse export helpers remain read-only and expose the PMO export contract expected by report commands.
- GitHub Actions opt into the Node 24 JavaScript action runtime to avoid Node 20 runner deprecation warnings.
- Release readiness checks verify license/package consistency, ignored report output, tracked-file safety, workflow action versions, and possible secret patterns.

## GitHub Actions

The repository includes `.github/workflows/ci.yml`. CI runs on pushes and pull requests to `main` and executes:

```bash
cd plugins/tpg-scheduler-codex-plugin
npm ci
npm run validate
npm test
```

The repository also includes `.github/workflows/release.yml`. It runs on tags matching `v*` and repeats validation and tests.

## Live Dynamics Smoke Test

CI cannot authenticate into the tenant. Run `docs/DYNAMICS_E2E_RUNBOOK.md` before releases that change Browser behavior, Dataverse mapping, writeback confirmation flow, or status-update fields.

The anonymized v0.1.0 live smoke-test evidence is recorded in `docs/LIVE_DYNAMICS_EVIDENCE_v0.1.0.md`. The evidence verifies read-only Dataverse access and form detection, and keeps API Status Update creation blocked until tenant-specific metadata is confirmed.
