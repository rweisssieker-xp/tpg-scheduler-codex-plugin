# Privacy

TPG-Scheduler-Codex-Plugin is designed for local, review-only project reporting workflows.

## Data Handling

- The plugin reads project data from the authenticated Dynamics browser context when the user has access.
- Offline commands read only the JSON files explicitly provided to the CLI.
- The plugin does not intentionally persist CRM data outside the working files the user creates or commits.
- Generated drafts, risk lists, evidence gaps, and reports are advisory until a human reviews them.

## CRM Write Safety

- No save, submit, send, delete, ownership change, or CRM state change is performed without explicit user confirmation.
- Email status updates are treated as high-risk and require separate review.
- Project-manager verification is part of the workflow before status collection or staging.

## Public Repository Guidance

Do not commit real customer, project, vendor, budget, employee, or decision data. Use anonymized fixtures only. Remove record URLs or replace them with synthetic examples before publishing evidence.

## Logs And Examples

Example outputs in this repository are synthetic. Any live smoke-test notes should describe results without including confidential project content.
