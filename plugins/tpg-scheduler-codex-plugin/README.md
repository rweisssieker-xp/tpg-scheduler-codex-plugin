# TPG-Scheduler-Codex-Plugin

This plugin package contains the Codex skill, metadata, scripts, tests, and fixtures for confirmation-gated Dynamics 365 TPG project status reporting.

## Commands

```powershell
npm run validate
npm test
npm run status-report:help
npm run status-report:intelligence
```

The legacy `statusbericht:*` npm script names are kept as compatibility aliases.

## Skill

Use the `status-report` skill for the Dynamics workflow. The skill requires the Codex in-app Browser, verifies the configured project manager, and keeps all CRM writes behind explicit confirmation.

## Safety

This package does not provide an unattended CRM writer. It prepares evidence-backed drafts, reports, and decision-support outputs. Saving in Dynamics remains a user-confirmed browser action.

## Public Artifacts

Repository-level documentation includes JSON schemas, a synthetic sample output, privacy guidance, a release process, and a manual Dynamics smoke-test runbook. Package validation checks these artifacts from `npm run validate`.
