# TPG-Scheduler-Codex-Plugin

This plugin package contains the Codex skill, metadata, scripts, tests, and fixtures for confirmation-gated Dynamics 365 TPG project status reporting.

## Commands

```powershell
npm run validate
npm test
npm run status-report:help
node ./scripts/statusbericht.js --board-pack <real-project-export.json> --docx reports/board-pack.docx --xlsx reports/board-pack.xlsx
node ./scripts/statusbericht.js --intelligence <real-project-export.json>
node ./scripts/statusbericht.js --pmo-report <real-project-export.json> --project-status "In Progress"
node ./scripts/statusbericht.js --pmo-report <real-project-export.json> --pmo-report-type executive_exception --json
node ./scripts/statusbericht.js --pmo-suite <real-project-export.json> --docx reports/pmo-suite.docx --xlsx reports/pmo-suite.xlsx
node ./scripts/statusbericht.js --pmo-report <real-project-export.json> --docx reports/pmo-status.docx --xlsx reports/pmo-status.xlsx
```

The legacy `statusbericht:*` npm script names are kept as compatibility aliases.

## Skill

Use the `status-report` skill for the Dynamics workflow. The skill requires the Codex in-app Browser, verifies the configured project manager, and keeps all CRM writes behind explicit confirmation.

Use the `pmo-report-suite` skill for PMO management reports, the 12-report suite, the Full Board Pack / Steering Pack, and DOCX/XLSX portfolio outputs.

Production PMO packs should use the authenticated Dynamics browser helper `TPGProjectAssist.retrieveBoardPackFromD365({ today: "YYYY-MM-DD" })`. Local JSON input is an explicit offline fallback only.

Maximum Logic Assurance is included in project intelligence and Board Pack output. It adds advisory logic validation, evidence traceability, and 12 logic-assurance USPs without changing CRM data.

Structured settings are exposed through `TPG_PLUGIN_SETTINGS` from `scripts/statusbericht.js`. Use that grouped object for D365, project, status-update, workflow, and safety settings; flat constants remain exported for compatibility.

## Safety

This package does not provide an unattended CRM writer. It prepares evidence-backed drafts, reports, and decision-support outputs. Saving in Dynamics remains a user-confirmed browser action.

## Public Artifacts

Repository-level documentation includes JSON schemas, a documentation-only synthetic sample output, privacy guidance, a release process, and a manual Dynamics smoke-test runbook. Productive CLI scripts do not point at sample data. Package validation checks these artifacts from `npm run validate`.
