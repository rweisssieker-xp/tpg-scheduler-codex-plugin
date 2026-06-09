# Architecture

## Overview

The plugin separates browser workflow guidance from deterministic project intelligence logic.

- The skill file describes how Codex should operate inside the in-app Browser.
- `scripts/statusbericht.js` exposes CLI commands, D365 API browser helpers, URL builders, and public exports.
- `scripts/lib/project-intelligence.js` contains pure functions for risk, decision, governance, and AI/KI intelligence features.
- The project safety gate layer evaluates each project across eight advisory safety domains before status collection or CRM staging.
- The PMO control tower layer evaluates each project across 25 governance and portfolio-control routines for PMO review.
- The Maximum USP layer turns the strongest 12 differentiators into a machine-readable advisory contract backed by runtime signals and proof metrics.
- The PMO USP layer turns 15 operational PMO differentiators into command queues, evidence ledgers, board-pack diffs, and runtime proof metrics.
- `schemas/` defines stable JSON contracts for downstream PMO and executive tooling.
- `examples/` contains synthetic output for documentation and consumer tests only; productive CLI paths reject sample files.
- Tests validate normalization, CLI behavior, and project intelligence outputs without requiring Dynamics access.
- `scripts/validate-plugin.js` validates plugin metadata, documentation presence, skill naming, and write-safety wording.
- `assets/icon.svg` provides a lightweight public plugin asset for repository and marketplace use.

## Core Modules

### Skill

`plugins/tpg-scheduler-codex-plugin/skills/status-report/SKILL.md` is the operating guide for Codex. It defines safety gates, Dynamics navigation rules, Dataverse read preferences, and write-confirmation requirements.

### Dataverse-First Data Path

The primary project data path is the authenticated Dynamics browser context:

1. Codex opens Dynamics and lets the user complete login.
2. `npm run status-report:dataverse` prints a browser snippet that uses `Xrm.WebApi.retrieveMultipleRecords`.
3. `TPGProjectAssist.retrieveProjectIntelligenceFromD365()`, `retrieveBatchProjectPreviewFromD365()`, `retrieveMonthlyStatusPlanFromD365()`, and the D365 API Max helpers read `tpg_projects` directly in the authenticated Dynamics context.
4. CLI file commands are an explicit offline fallback for reviewed local snapshots and require `--allow-offline-input`.

Visual UI scraping is only a fallback for navigation, field verification, and explicit save confirmation. The plugin does not add service-principal authentication or background CRM writes.

### CLI And Browser Snippet

`scripts/statusbericht.js` provides:

- offline fallback intelligence commands guarded by `--allow-offline-input`
- Dataverse browser-context snippet generation and D365 API helpers
- Dynamics URL builders
- status update draft helpers
- monthly project-leader status writeback plans
- 15 D365 API Max helpers for field discovery, live control center, status entity resolution, PM self-service, dry-runs, Submitted-To lookup, status history, duplicate prevention, steering packs, data-gap worklists, executive routing, Power BI output, permission probes, audit evidence, and pilot writeback
- public exports for project intelligence functions
- plugin validation checks

### Project Intelligence

`scripts/lib/project-intelligence.js` provides evidence-backed helper functions, including:

- risk and status quality evaluation
- decision closure and SLA tracking
- governance exceptions
- risk trend and forecast intelligence
- escalation packs
- trust contracts
- safe writeback simulation
- evidence gap detection
- executive question generation
- decision option scoring
- portfolio constraint and dependency intelligence
- commitment tracking
- narrative drift detection
- governance replay and PMO policy simulation
- report quality benchmarking
- human confirmation analytics
- maximum project safety gates
- PMO control tower routines
- maximum USP layer with 12 buildable differentiators
- PMO USP layer with 15 operational PMO differentiators

## Safety Boundaries

The plugin does not directly automate CRM writes from Node.js. Browser-based CRM actions must remain confirmation-gated. Generated content is advisory until reviewed by the user.

## Monthly Status Writeback

`buildMonthlyStatusReportDraft(project, statusText, options)` prepares one monthly Status Update draft for a project. It normalizes `kv`, sets the report date to the month end by default, builds the Dynamics target fields, runs project safety gates, simulates writeback blockers, and returns a confirmation string.

`buildMonthlyStatusReportRun(projects, options)` prepares a portfolio run for one report month. It filters to active projects, tracks missing project-leader input, counts writeback risks, and declares `quick_create_confirmation_gated` as the only writeback mode.

The production path calls `TPGProjectAssist.retrieveMonthlyStatusPlanFromD365({ month: "YYYY-MM" })` from the authenticated Dynamics browser context. The CLI command `--monthly-status-plan <snapshot.json> --allow-offline-input --month YYYY-MM` is only an offline fallback. Browser save behavior remains manual and confirmation-gated through `Quick Create: Status Update`.

## Status API Max Layer

The API layer adds production-oriented integration helpers around the monthly status workflow:

- Read APIs: paginated `retrieveAllRecords`, delta project reads, and status-update history by project/month.
- Safety APIs: duplicate checks, idempotency keys, monthly draft validation, permission probes, metadata discovery, and Dataverse error mapping.
- Writeback APIs: structured status drafts, bulk writeback queues, `Xrm.WebApi.createRecord` plans, audit events, and attachment plans.

The only direct Dataverse write helper is `createStatusUpdateWithConfirmation` in the authenticated browser snippet. It requires discovered metadata, a valid payload, and an exact confirmation string before calling `Xrm.WebApi.createRecord`; Node.js never writes CRM data.

### D365 API Max Features

The live browser helper layer exposes 15 production PMO/status functions on `window.TPGProjectAssist`: `discoverProjectFieldMetadataFromD365`, `buildLivePmoControlCenterFromD365`, `resolveStatusUpdateEntityFromD365`, `retrieveMonthlyPmSelfServiceFlowFromD365`, `simulateStatusWritebackFromD365`, `resolveSubmittedToCandidatesFromD365`, `retrieveStatusHistoryTimelineFromD365`, `checkDuplicateStatusUpdateFromD365`, `retrieveExecutiveSteeringPackFromD365`, `retrievePmoDataGapWorklistFromD365`, `routeCioCfoRiskFromD365`, `retrievePowerBiReadyPortfolioFromD365`, `probeD365PermissionsDetailed`, `buildAuditEvidencePackFromD365`, and `pilotStatusWritebackFromD365`.

These helpers intentionally reuse the authenticated D365 page context instead of exports, service principals, mock data, or background jobs. Writeback helpers remain dry-run by default and can only call Dataverse create after metadata resolution, blocker checks, duplicate checks, and exact confirmation text.

## Project Safety Gates

`buildProjectSafetyGate(project, options)` returns a per-project advisory safety profile with `safetyScore`, `safetyLevel`, `managementAttention`, `writebackRisk`, gate evidence, required evidence, and recommended actions.

`buildProjectSafetyGateSuite(projects, options)` aggregates the per-project gates and is included in `buildProjectIntelligence(projects, options)` as `projectSafetyGates`.

The eight safety domains are data integrity, status truth, delivery risk, decision governance, financial/resource risk, escalation readiness, report quality, and writeback safety. The gates never save or block CRM automatically; they make risk visible before a human confirms any action.

## PMO Control Tower

`buildPmoProjectControls(project, projects, options)` returns 25 PMO checks for one project, including steering readiness, policy compliance, priority drift, baseline/risk/action/decision aging, owner and due-date accountability, concentration risks, audit completeness, evidence traceability, report comparability, heatmap consistency, and recommended PMO intervention.

`buildPmoControlTower(projects, options)` aggregates the project controls and is included in `buildProjectIntelligence(projects, options)` as `pmoControlTower`.

`buildPmoStatusReport(projects, options)` applies PMO report filters before control-tower calculation. Supported filters include project status labels, last status report date ranges, exact last status report date, missing last status report, and text matching against the last status report narrative.

The CLI can serialize the filtered PMO status report to DOCX and XLSX. DOCX generation uses the `docx` package with a styled title band, subtitle band, executive callout, KPI cards, filter scope, status legend, project spotlight, summary, and project sections. XLSX generation writes a styled Office Open XML workbook through `jszip`, including frozen headers, column widths, autofilters, and PMO/safety highlighting while avoiding heavier spreadsheet dependency trees.

`buildPmoReport(reportType, projects, options)` builds one of the 12 PMO management reports. `buildPmoReportSuite(projects, options)` returns the complete 12-report suite. The `pmo-report-suite` skill is the user-facing entrypoint for these reports, while `status-report` remains focused on Dynamics status-entry workflows.

## Maximum USP Layer

`buildMaximumUspLayer(projects, options)` returns `layerType: "maximum_usps"`, summary counts, and exactly 12 implemented USP objects. Each USP includes target user, pain solved, concrete benefit, technical mechanism, required data, MVP implementation, trust controls, proof metric, feasibility, runtime signals, and USP score.

`buildProjectIntelligence(projects, options)` includes the same output as `maximumUsps`. The layer is advisory-only and reuses existing evidence-backed features: Project Safety Gates, No-Surprise Forecast, Status Truth Score, Monthly Writeback Guard, Decision Debt Analysis, PMO Report Suite, Cross-Project Dependency Intelligence, Project Manager Quality Coach, budget/resource reports, Trust Contracts, PMO Work Queue, and CRM Writeback Simulation.

## 15 PMO USP Layer

`buildPmoUspLayer(projects, options)` returns `layerType: "pmo_usps"`, summary counts, 15 implemented PMO USP objects, a prioritized `commandQueue`, an `evidenceLedger`, and portfolio-level `dataGaps`.

`buildProjectIntelligence(projects, options)` includes this output as `pmoUsps`. The layer reuses Safety Gates, PMO Control Tower, Decision Debt, Decision SLA Cockpit, Cross-Project Dependency Intelligence, Risk Narrative Drift, No-Surprise Forecast, Trust Contracts, Safe Writeback Simulation Pro, and the PMO Report Suite. Snapshot-dependent USPs report data gaps when `previousSnapshots` or `previousPack` are not provided.

## Schema Layer

The schema layer documents output contracts without adding runtime dependencies. Validation checks parse each schema and assert critical contract anchors:

- Project intelligence includes `projectSafetyGates` and `pmoControlTower`.
- Project intelligence includes `maximumUsps` with exactly 12 implemented USP entries.
- Project intelligence includes `pmoUsps` with exactly 15 implemented PMO USP entries.
- Safety gate projects expose safety score, level, management attention, writeback risk, gates, evidence, and actions.
- PMO control tower summaries declare exactly 25 checks per project.

Schemas are intentionally tolerant of additional properties so new advisory fields can be added without breaking consumers.

## Release And Governance

The public repository includes GitHub Actions CI, a tag-triggered release validation workflow, Dependabot configuration, CODEOWNERS, privacy guidance, and a Dynamics end-to-end smoke-test runbook. The live runbook remains manual because tenant access and CRM confirmation behavior cannot be validated from CI.

## Testing Strategy

The repository uses Node-based tests:

```powershell
cd plugins/tpg-scheduler-codex-plugin
npm test
```

The tests cover:

- status normalization
- status draft construction
- Dataverse URL/snippet generation
- project intelligence evidence rules
- AI/KI helper outputs
- maximum project safety gate outputs
- PMO control tower outputs
- CLI JSON/offline fallback behavior
- schema and documentation-only sample-output presence
- release, privacy, ownership, and dependency-management files
