# JSON Schemas

The plugin exposes stable JSON contracts for offline reports and downstream PMO tooling.

## Files

- `schemas/project-intelligence.schema.json`: top-level offline intelligence output.
- `schemas/project-safety-gates.schema.json`: advisory safety gate suite output.
- `schemas/pmo-control-tower.schema.json`: PMO control tower output with 25 checks per project.

The top-level project intelligence schema also includes the filtered `pmoStatusReport` contract.
The PMO report suite adds uniform report objects with `reportType`, `title`, `generatedAt`, `filters`, `summary`, `sections`, `rows`, `evidence`, and `dataGaps`.

DOCX and XLSX exports serialize the same `pmoStatusReport` object; the schema therefore remains the source contract for file-generation consumers.

## Contract Principles

- Outputs are advisory and evidence-backed.
- CRM writeback risk is reported as data, not executed automatically.
- Required evidence and recommended actions are explicit arrays so consuming tools can show missing proof before a project is discussed in governance.
- Unknown future fields may be added by minor versions; consumers should ignore fields they do not understand.

## Validation Use

Run local validation from the plugin package:

```powershell
cd plugins/tpg-scheduler-codex-plugin
npm run validate
```

The validator parses every schema, verifies the safety and PMO contract anchors, and checks the documentation-only sample output. Productive CLI runs reject sample or fixture paths.
