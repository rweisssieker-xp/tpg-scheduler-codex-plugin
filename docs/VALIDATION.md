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
- The primary skill is named `status-report`.
- Critical CRM write-safety language remains present.
- Public docs use en-US wording, except for the fixed German CRM `kv` phrase where explicitly documented.

## GitHub Actions

The repository includes `.github/workflows/ci.yml`. CI runs on pushes and pull requests to `main` and executes:

```bash
cd plugins/tpg-scheduler-codex-plugin
npm ci
npm run validate
npm test
```
