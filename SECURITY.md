# Security Policy

## Supported Versions

The current `main` branch is the only supported version.

## Reporting Security Issues

Do not open public issues for suspected vulnerabilities, credentials, private Dynamics URLs beyond those already documented, or tenant-specific access details. Contact the repository owner directly through GitHub.

## Security Model

- The plugin is confirmation-gated and must not save, submit, send, delete, change ownership, or change CRM state without explicit user confirmation.
- The plugin should use the authenticated Dynamics browser page context for Dataverse reads.
- Direct Dataverse writes are allowed only through confirmation-gated browser helpers after metadata discovery, duplicate checks, validation, and exact confirmation-text match.
- The plugin should not introduce separate OAuth flows, service principals, Azure CLI authentication, or Power Platform CLI authentication unless explicitly requested by the user.
- Local browser profiles, logs, and automation state are ignored by Git.
- Generated reports, nudges, and AI/KI outputs are advisory until reviewed.

## Secret Handling

Never commit:

- access tokens
- API keys
- cookies
- browser profiles
- Dynamics session data
- screenshots or logs containing confidential project data
- real `tpg_pmo_project_export` files or Status API writeback queues

## Security Review Checklist

- Confirm no real Dynamics exports, screenshots, logs, or report files are staged.
- Confirm every CRM write path requires explicit user confirmation.
- Confirm `Email Status Update` remains visible and high risk before saving.
- Confirm sample and fixture data are rejected by productive CLI commands.
- Confirm new schemas and examples contain only synthetic identifiers.

## Privacy

See `docs/PRIVACY.md` for data-handling guidance, public repository rules, and sample-output restrictions.
