# Live Dynamics Evidence v0.1.0

Date: 2026-06-08

This note records an anonymized live smoke-test result for the public v0.1.0 release. It intentionally excludes tenant-specific project names, record IDs, user names, and status text.

## Environment

- Tenant type: Dynamics 365 / Dataverse
- Region host: `crm4.dynamics.com`
- App context: TPG Scheduler model-driven app
- Tested entity: `tpg_project`
- Browser context: authenticated Codex in-app Browser
- Write mode: read-only; no CRM write was attempted

## Read-Only Results

- `Xrm` and `Xrm.WebApi` were available in the authenticated browser context.
- Reading active project rows through Dataverse Web API succeeded.
- Three project rows were read from the active project view.
- The selected project record opened successfully as a `tpg_project` form.
- The project form exposed visible PMO-relevant tabs, including:
  - `Project Details`
  - `Status Details`
  - `Status Update`
  - `Status Report`
  - `Risks`
  - `Issues`
  - `Actions`
  - `Decisions`
  - `Inter-Project Links`
- The form included a visible `Status Updates Grid` control with internal control name `status_grid`.
- Current project fields such as project status, last status update, overall KPI, progress, and project manager were visible in the form context.

## Metadata Findings

The generic read path is verified. The API writeback path remains intentionally blocked until the tenant-specific Status Update table metadata is confirmed.

The following candidate logical names were not resolvable through `Xrm.Utility.getEntityMetadata` in the live session:

- `tpg_statusupdate`
- `tpg_projectstatusupdate`
- `gbl_statusupdate`

The status-update subgrid was visible as `status_grid`, but the underlying related entity logical name was not available from the first form-control inspection. A direct `EntityDefinitions` contains-query for status-like logical names returned an unsupported-query response in this tenant context.

## Safety Outcome

- Project read access: passed.
- Form detection: passed.
- Status Update tab detection: passed.
- Status Update subgrid detection: passed.
- Status Update entity metadata: blocked pending tenant-specific confirmation.
- Duplicate-check API path: blocked until metadata is confirmed.
- Create-plan API path: blocked until metadata is confirmed.
- CRM writeback: not attempted.

## Release Impact

The plugin remains release-ready for:

- read-only Dataverse API retrieval,
- PMO report generation,
- project safety gates,
- monthly status draft planning,
- browser-assisted manual Status Update staging,
- confirmation-gated writeback design.

Automatic API creation of Status Update records must remain disabled until the tenant-specific Status Update table logical name, entity set, project lookup binding, required fields, and permissions are confirmed in a controlled test project.

## Required Follow-Up Before Live API Writeback

1. Confirm the actual Status Update table logical name behind the `status_grid` subgrid from form customization or solution metadata.
2. Confirm the entity set name and project lookup binding.
3. Confirm required fields, especially reporting month/date, submitted-to, email flag, narrative/status text, and project lookup.
4. Run `TPGProjectAssist.retrieveStatusUpdates(...)` against a safe project and month.
5. Run duplicate and idempotency checks.
6. Build a create-record plan and verify `canAutoSave: false`.
7. Execute `createStatusUpdateWithConfirmation(...)` only in a low-risk test record with exact confirmation text.
