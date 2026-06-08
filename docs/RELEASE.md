# Release Process

This repository is intended to be published as a public source repository while keeping CRM actions confirmation-gated.

## Pre-Release Checklist

1. Run local validation:

```powershell
cd plugins/tpg-scheduler-codex-plugin
npm ci
npm test
npm run validate
npm run release:check
```

2. Run the Dynamics end-to-end smoke test from `docs/DYNAMICS_E2E_RUNBOOK.md`.
3. Run the security review checklist from `SECURITY.md`.
4. Confirm GitHub Actions is green on `main` and no Node.js runtime deprecation warning is present.
5. Review `CHANGELOG.md`.
6. Confirm the Status API schemas and examples are included in the release package.
7. Create a signed tag, for example `v0.1.0`.
8. Push the tag to GitHub.

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
- Offline output generated from a real or anonymized project export.
- Dynamics smoke-test notes with no customer data.
- Status API live metadata notes with no customer data.
- Known limitations.
