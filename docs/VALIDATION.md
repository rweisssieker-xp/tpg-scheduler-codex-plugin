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
- `pmo-report-suite` skill presence and report-type documentation.
- CLI behavior tests.
- Plugin metadata and documentation validation.
- The same validation flow used by GitHub Actions CI.

Run only plugin validation:

```powershell
npm run validate
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
- The synthetic sample output includes `projectSafetyGates` and `pmoControlTower`.
- Productive npm intelligence scripts do not point at sample or fixture data.
- No npm script exposes demo, mock, sample, or fixture data as an active command.
- DOCX and XLSX export dependencies are validated, and the vulnerable `exceljs` dependency tree is disallowed.

## GitHub Actions

The repository includes `.github/workflows/ci.yml`. CI runs on pushes and pull requests to `main` and executes:

```bash
cd plugins/tpg-scheduler-codex-plugin
npm ci
npm run validate
npm test
```

The repository also includes `.github/workflows/release.yml`. It runs on tags matching `v*`, repeats validation and tests, and uploads a review package artifact.

## Live Dynamics Smoke Test

CI cannot authenticate into the tenant. Run `docs/DYNAMICS_E2E_RUNBOOK.md` before releases that change Browser behavior, Dataverse mapping, writeback confirmation flow, or status-update fields.
