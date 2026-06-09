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
npm run release:manifest
```

2. Run the Dynamics end-to-end smoke test from `docs/DYNAMICS_E2E_RUNBOOK.md`.
3. Run the security review checklist from `SECURITY.md`.
4. Confirm GitHub Actions is green on `main` and no Node.js runtime deprecation warning is present.
5. Review `CHANGELOG.md`.
6. Confirm the Status API schemas and examples are included in the release package.
7. Create a signed tag when local signing is configured, for example `git tag -s v0.1.0 -m "v0.1.0"`. If no signing key is configured, create an annotated tag with `git tag -a v0.1.0 -m "v0.1.0"`.
8. Push the tag to GitHub.

## GitHub Release

The release workflow runs on tags matching `v*` and validates the plugin. The GitHub Release provides the source archive and release notes. No automatic CRM installer is produced.

## Versioning

- Patch: documentation, tests, validation, or non-breaking output additions.
- Minor: new advisory features or additional optional JSON fields.
- Major: breaking schema changes or changed safety semantics.

## Release Evidence

Attach or link:

- CI run URL.
- Plugin validation output.
- Release manifest output from `npm run release:manifest`.
- Release notes from `docs/RELEASE_NOTES_v0.1.0.md` or the matching version file.
- Offline fallback output generated from a reviewed or anonymized local snapshot.
- Dynamics smoke-test notes with no customer data.
- Status API live metadata notes with no customer data.
- Known limitations.

For v0.1.0, see `docs/LIVE_DYNAMICS_EVIDENCE_v0.1.0.md` for anonymized live Dynamics evidence.
