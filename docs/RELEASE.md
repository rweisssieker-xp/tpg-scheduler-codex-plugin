# Release Process

This repository is intended to be published as a public source repository while keeping CRM actions confirmation-gated.

## Pre-Release Checklist

1. Run local validation:

```powershell
cd plugins/tpg-scheduler-codex-plugin
npm ci
npm test
npm run validate
```

2. Run the Dynamics end-to-end smoke test from `docs/DYNAMICS_E2E_RUNBOOK.md`.
3. Confirm GitHub Actions is green on `main`.
4. Review `CHANGELOG.md`.
5. Create a signed tag, for example `v0.1.0`.
6. Push the tag to GitHub.

## GitHub Release

The release workflow runs on tags matching `v*`. It validates the plugin and uploads a repository snapshot artifact. The artifact is a review package, not an automatic CRM installer.

## Versioning

- Patch: documentation, tests, validation, or non-breaking output additions.
- Minor: new advisory features or additional optional JSON fields.
- Major: breaking schema changes or changed safety semantics.

## Release Evidence

Attach or link:

- CI run URL.
- Plugin validation output.
- Offline sample output.
- Dynamics smoke-test notes with no customer data.
- Known limitations.
