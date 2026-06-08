# Security Policy

## Supported Versions

The current `main` branch is the only supported version.

## Reporting Security Issues

Do not open public issues for suspected vulnerabilities, credentials, private Dynamics URLs beyond those already documented, or tenant-specific access details. Contact the repository owner directly through GitHub.

## Security Model

- The plugin is confirmation-gated and must not save, submit, send, delete, change ownership, or change CRM state without explicit user confirmation.
- The plugin should use the authenticated Dynamics browser page context for Dataverse reads.
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

## Privacy

See `docs/PRIVACY.md` for data-handling guidance, public repository rules, and sample-output restrictions.
