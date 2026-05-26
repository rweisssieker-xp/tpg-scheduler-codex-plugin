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
- CLI behavior tests.
- Plugin metadata and documentation validation.

Run only plugin validation:

```powershell
npm run validate
```

The validation script checks:

- Plugin and package names match.
- Repository metadata points to GitHub.
- Skill, app, and MCP paths exist.
- Required public documentation files exist.
- The primary skill is named `status-report`.
- Critical CRM write-safety language remains present.
- Public docs use en-US wording, except for the fixed German CRM `kv` phrase where explicitly documented.
