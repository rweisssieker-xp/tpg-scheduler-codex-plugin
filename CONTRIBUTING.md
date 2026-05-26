# Contributing

This repository is public for transparency and collaboration, but it targets a specific Dynamics 365 TPG workflow. Keep changes narrowly scoped and safety-preserving.

## Development Setup

```powershell
cd plugins/tpg-scheduler-codex-plugin
npm test
```

## Contribution Guidelines

- Keep documentation and user-facing metadata in en-US.
- Preserve the fixed German `kv` output phrase unless the target Dynamics process changes.
- Do not add automatic CRM save, submit, send, delete, ownership, or state-change behavior.
- Keep evidence codes visible in management-facing outputs.
- Add or update tests for behavior changes.
- Avoid committing local browser profiles, logs, secrets, or generated workspace state.

## Pull Request Checklist

- Tests pass with `npm test`.
- New AI/KI helper behavior has assertions in `scripts/project-intelligence.test.js`.
- Skill changes preserve explicit human confirmation before CRM writes.
- Documentation is updated when public behavior changes.
