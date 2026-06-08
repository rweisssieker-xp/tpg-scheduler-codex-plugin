---
name: status-report
description: Use when drafting confirmation-gated Dynamics 365 TPG project status reports for projects led by the current user.
---

# TPG Status Reporting

Use this skill when the user asks to create, draft, collect, or update status reports for TPG projects in Dynamics 365.

## Ground Rules

- Use the Codex in-app Browser plugin for all Dynamics navigation and UI interaction.
- Do not launch a separate Playwright, Edge, Chromium, Selenium, or OS browser process for the CRM workflow.
- Before browser work, invoke the `browser-use:browser` skill and bind to the `iab` browser as described there.
- Work only on active `tpg_project` records where the opened record's header field `Project Manager` is exactly `Reiner Weisssieker`.
- Start from the project list URL unless the user provides a specific project record URL:
  `https://posp365.crm4.dynamics.com/main.aspx?appid=1a66513c-266c-ef11-bfe2-6045bd8d5d87&forceUCI=1&pagetype=entitylist&etn=tpg_project&viewid=40761dc9-c0d4-ef11-a72e-7c1e52862247&viewType=4230`
- Open each matching project record before asking for status input.
- Ask for one status input per project.
- Treat `kv`, case-insensitively after trimming whitespace, as this fixed German CRM status phrase:
  `Status unverändert seit letztem Bericht (keine inhaltlichen Änderungen)`
- Preserve normal free text status input exactly except for surrounding whitespace.
- Empty input means skip the current project after user confirmation.
- Never save, submit, send, delete, change ownership, or change CRM state without explicit user confirmation.

## Codex Browser Automation

This workflow is executed by Codex itself through the in-app Browser surface. The helper script in `scripts/statusbericht.js` only contains pure constants and `kv` normalization tests; it must not be used as the CRM browser driver.

If Dynamics asks for login, pause and let the user complete Microsoft login manually inside the in-app browser.

## Dataverse Access

- Prefer Dataverse reads over visual UI scraping after a Dynamics browser session is authenticated.
- Use the logged-in Dynamics page context for Dataverse reads; do not introduce a separate OAuth, Azure CLI, Power Platform CLI, service-principal, or browser process unless the user explicitly asks for it.
- The project table discovered from Dynamics is:
  - logical name: `tpg_project`
  - Web API entity set: `tpg_projects`
  - primary id: `tpg_projectid`
  - primary name: `tpg_subject`
- The Dataverse organization URL is:
  `https://posp365.crm4.dynamics.com`
- The direct Web API shape for one project is:
  `https://posp365.crm4.dynamics.com/api/data/v9.2/tpg_projects(<project-guid>)`
- The direct Dynamics record URL shape is:
  `https://posp365.crm4.dynamics.com/main.aspx?appid=1a66513c-266c-ef11-bfe2-6045bd8d5d87&forceUCI=1&pagetype=entityrecord&etn=tpg_project&id=<project-guid>`
- Use `scripts/statusbericht.js` for stable constants and URL builders:
  - `buildActiveProjectsApiUrl()`
  - `buildProjectRecordApiUrl(projectId)`
  - `buildDynamicsProjectRecordUrl(projectId)`
  - `mapProjectDataverseRow(row)`
  - `evaluateProjectStatusQuality(project, options)`
  - `buildBatchProjectPreview(projects, options)`
  - `detectStatusDelta(project, options)`
  - `evaluateStatusQuality(project, options)`
  - `buildPortfolioRiskList(projects, options)`
  - `extractDecisionRadar(projects)`
  - `buildProjectNudges(projects, options)`
  - `buildSteeringAgenda(projects, options)`
  - `buildDecisionClosureItems(projects, options)`
  - `buildRiskLedgerEntries(projects, options)`
  - `buildNudgeDrafts(projects, options)`
  - `buildManagementActionExportRows(projects, options)`
  - `buildExportBundle(projects, options)`
  - `buildCalibrationReport(projects, options)`
  - `buildLiveDynamicsRunPlan(options)`
  - `buildPmoConfig(overrides)`
  - `buildGovernanceExceptions(projects, options)`
  - `buildRiskTrendIntelligence(previousLedger, currentLedger)`
  - `buildMeetingCaptureDrafts(meetingText, project)`
  - `buildPortfolioNarrativeDiff(previousIntelligence, currentIntelligence)`
  - `buildProjectManagerCoach(projects, options)`
  - `buildWhatIfRecoveryPlan(project, options)`
  - `buildAudienceReport(projects, options)`
  - `buildDataCompletenessScore(project)`
  - `buildSafeWritebackSimulation(project, draft)`
  - `buildAuditEntry(input)`
  - `buildExecutiveOnePager(projects, options)`
  - `buildProjectIntelligence(projects, options)`
  - `buildProjectSafetyGate(project, options)`
  - `buildProjectSafetyGateSuite(projects, options)`
  - `buildStatusUpdateDraft(statusText, options)`
  - `getDataverseBrowserSnippet()`
- To install browser-context helpers into an authenticated Dynamics page, print the snippet with:
  `npm run statusbericht:dataverse`
  Then run that JavaScript in the in-app Browser page context. It exposes `window.TPGProjectAssist`.
- To generate an offline project intelligence report from exported project JSON, run:
  `npm run statusbericht:intelligence`
  or:
  `node ./scripts/statusbericht.js --intelligence <projects.json> --today YYYY-MM-DD`
- Use `--json` with `--intelligence` when another automation should consume the complete intelligence pack.
- Use `--exports` with `--intelligence` to emit CSV strings for Power BI/import workflows and JSON for automation.
- Available browser helper methods after injection:
  - `TPGProjectAssist.retrieveActiveProjects({ top })`
  - `TPGProjectAssist.retrieveProject(projectId)`
  - `TPGProjectAssist.buildBatchProjectPreview(projects, { today })`
  - `TPGProjectAssist.evaluateProjectStatusQuality(project, { today })`
  - `TPGProjectAssist.buildProjectIntelligence(projects, { today })`
  - `TPGProjectAssist.buildPortfolioRiskList(projects, { today })`
  - `TPGProjectAssist.extractDecisionRadar(projects)`
  - `TPGProjectAssist.buildProjectNudges(projects, { today })`
  - `TPGProjectAssist.buildSteeringAgenda(projects, { today })`
  - `TPGProjectAssist.buildDecisionClosureItems(projects, { today })`
  - `TPGProjectAssist.buildRiskLedgerEntries(projects, { today })`
  - `TPGProjectAssist.buildNudgeDrafts(projects, { today })`
  - `TPGProjectAssist.buildCalibrationReport(projects, { today })`
  - `TPGProjectAssist.buildLiveDynamicsRunPlan({ today })`
  - `TPGProjectAssist.detectStatusDelta(project, { proposedStatusText })`
  - `TPGProjectAssist.buildAuditEntry(input)`
  - `TPGProjectAssist.buildExecutiveOnePager(projects, { today })`
  - `TPGProjectAssist.readCurrentProjectForm()`
  - `TPGProjectAssist.verifyCurrentProjectManager("Reiner Weisssieker")`
  - `TPGProjectAssist.readQuickCreateStatusUpdateFields()`

## Offline Intelligence CLI

- Input must be a JSON array of mapped project objects with fields such as `projectId`, `name`, `projectStatusLabel`, `overallKpiLabel`, `progress`, `finish`, `lastStatusUpdate`, `currentStatusText`, `obstaclesAndMeasures`, `decisions`, and `sponsorActions`.
- Markdown output includes:
  - executive one-pager
  - project leader queue
  - steering agenda
  - evidence lines with reason codes and source fields
  - per-project quality warnings
  - nudges
- JSON output includes the full result of `buildProjectIntelligence(projects, options)`.
- Export output includes `csv.managementActions`, `csv.riskLedger`, and a JSON payload with intelligence, risk ledger, and management action rows.
- Sample data is available at `scripts/fixtures/projects.sample.json`.
- When a project record is open, read form data through the Dynamics form context before relying on visible labels:
  ```js
  const xrm = window.Xrm || window.parent?.Xrm;
  const formContext = xrm?.Page;
  const fields = formContext.data.entity.attributes.get().map((attribute) => ({
    name: attribute.getName(),
    value: attribute.getValue(),
    type: attribute.getAttributeType?.(),
    requiredLevel: attribute.getRequiredLevel?.(),
  }));
  ```
- When using `Xrm.WebApi`, keep reads narrow with `$select`; do not retrieve all columns for large project lists.
- Default project `$select` columns:
  `tpg_projectid,tpg_projectnum,gbl_projectnumber,tpg_subject,tpg_projectstatus,tpg_lifecyclephase,tpg_overallkpi,tpg_progress,tpg_start,tpg_finish,gbl_laststatusupdate,_ownerid_value`
- For status-report candidate discovery, use Dataverse as a candidate source only. Still open the project record and verify `Project Manager` is exactly `Reiner Weisssieker` before staging or saving anything.
- Known Status Update quick-create field logical names:
  - `tpg_reportdate`: Report Date
  - `tpg_project`: Project
  - `tpg_title`: Status Summary
  - `ownerid`: Owner
  - `tpg_submittedto`: Submitted To
  - `tpg_emailstatusupdate`: Email Status Update
  - `tpg_accomplishedactivities`: Accomplished Activities / Current Status
  - `tpg_missedactivities`: Missed Activities
  - `tpg_plannedactivities`: Planned Activities / Next Steps
  - `tpg_sponsoractions`: Sponsor Actions
  - `gbl_obstaclesandmeasures`: Obstacles and Measures
  - `gbl_decisions`: Decisions
- Quick Create entry points discovered in Dynamics:
  - project form tab: `tab_status`
  - status updates subgrid/control: `status_grid`
  - command label: `Add New Status Update`
- Do not call `Xrm.WebApi.createRecord` for Status Update until the status-update entity set and required lookup binding targets are confirmed in the current environment. Use Quick Create staging as the safe write path.

## Expected Workflow

1. Open Dynamics 365 at the TPG project list.
2. Verify that the Dynamics account is logged in and that the current view is the configured project view.
3. Read visible project rows through the Browser DOM snapshot and use the list only as candidates. Keep only active rows whose state is `Created`, `Planning`, or `In Progress`.
   - If the authenticated Dynamics context allows Dataverse reads, prefer reading candidate projects from `tpg_projects` with narrow `$select` columns and `statecode eq 0`, then open each candidate record by URL.
   - If Dataverse reads are unavailable or blocked, fall back to the visible Dynamics grid.
   - Before collecting status input, build a batch preview with `buildBatchProjectPreview(projects, { today })` and show the user the prioritized list with project name, status, KPI, progress, finish date, last status update, severity, and warnings.
   - Treat `critical` or `warning` preview items as still processable, but call out that they likely need a real status instead of `kv`.
   - For management-oriented runs, use `buildProjectIntelligence(projects, { today })` to produce:
     - `preview`: project-leader status queue with delta and quality signals
     - `portfolioRisks`: CIO risk list sorted by score
     - `decisionRadar`: CEO/CIO decisions, sponsor actions, and blockers
     - `steeringAgenda`: prioritized decision agenda with owner, due date, and evidence reason codes
     - `decisionClosureItems`: open decision items for follow-up tracking
     - `riskLedger`: persistent-ready risk observations with detected/last-seen dates
     - `nudges`: PMO/project-leader follow-up prompts
     - `nudgeDrafts`: Teams/Outlook-ready drafts with `sendAutomatically: false`
     - `calibrationReport`: false-positive and data-quality review inputs
     - `liveDynamicsRunPlan`: read-only execution plan and safety gates
     - `governanceExceptions`: PMO governance violations by rule and evidence
     - `projectManagerCoach`: project-leader quality coaching signals
     - `dataCompleteness`: reportability score per project
     - `projectSafetyGates`: advisory safety gates that must be shown before status collection or CRM staging
     - `executiveOnePager`: Markdown one-pager for leadership review

## Advanced USP Helpers

- `buildGovernanceExceptions` flags violated governance rules such as critical projects without management attention or decisions that require SLA tracking.
- `buildRiskTrendIntelligence` compares previous and current risk ledgers and classifies new, recurring, and resolved risks.
- `buildMeetingCaptureDrafts` converts reviewed meeting notes into decision, risk, action, and status-draft fields. Never write these to CRM without user review.
- `buildPortfolioNarrativeDiff` summarizes what changed between two intelligence snapshots for CIO/CEO reporting.
- `buildProjectManagerCoach` aggregates quality signals per project owner for PMO coaching.
- `buildWhatIfRecoveryPlan` maps evidence codes to recovery actions.
- `buildAudienceReport` renders role-specific summaries for project managers, CIOs, and CEOs.
- `buildDataCompletenessScore` estimates whether a project is report-ready.
- `buildSafeWritebackSimulation` previews field changes, blockers, and confirmations before any CRM save.
- `buildAutonomousPmoWatchtower` combines governance exceptions, steering agenda items, and PM nudges into a review-only PMO watchtower.
- `buildRiskForecastTwin` projects near-term risk level, confidence, horizon, drivers, and likely impact from evidence codes.
- `buildMeetingToDynamicsPlan` converts meeting notes into reviewed Dynamics field drafts plus a safe writeback simulation.
- `buildExecutiveMemoryTimeline` turns previous/current intelligence snapshots into an executive change timeline.
- `buildDecisionSlaCockpit` aggregates decision closure items by overdue, due today, and upcoming SLA status.
- `buildProjectManagerQualityCoach` adds portfolio-level coaching totals and recommended PMO interventions.
- `buildRecoveryOptionGenerator` ranks recovery actions per project and marks options that require a decision.
- `buildTrustContract` exposes evidence count, data completeness, missing fields, and safety rules for a report.
- `buildSafeWritebackSimulationPro` adds risk controls and an audit preview to writeback simulation.
- `buildRoleBasedNarrativeEngine` returns audience-specific Markdown plus watchtower, SLA, and forecast sections.
- `buildDecisionDebtAnalysis` measures open decision debt, due/overdue decisions, blocked projects, and a decision-debt score.
- `buildProjectTruthScore` scores whether project status content is credible against KPI, schedule, closure, and mitigation evidence.
- `buildSponsorActionIntelligence` turns steering agenda items into concrete sponsor actions with owner, due date, priority, and evidence.
- `buildNoSurpriseForecast` watches all projects for likely escalation and silent risk signals before the next status cycle.
- `buildAiEscalationPack` builds a reviewed escalation packet with problem, impact, decision required, options, and evidence codes.
- `buildEvidenceGapDetector` identifies missing proof, owners, due dates, and closure evidence.
- `buildExecutiveQuestionGenerator` creates CIO/CEO steering questions for critical projects.
- `buildDecisionOptionScoring` ranks decision options by risk reduction, time gain, and effort.
- `buildPortfolioConstraintRadar` finds shared vendor, dependency, and owner constraints.
- `buildCommitmentTracker` extracts sponsor actions and decisions into open commitments.
- `buildRiskNarrativeDrift` detects recurring risks that were reworded across snapshots.
- `buildEscalationReadinessScore` scores whether an escalation is decision-ready.
- `buildGovernanceReplay` shows when warning signals first appeared across intelligence snapshots.
- `buildPmoPolicySimulator` evaluates proposed PMO policies against current project data.
- `buildCrossProjectDependencyIntelligence` detects shared dependencies with active risk.
- `buildReportQualityBenchmark` compares status-report quality across projects.
- `buildHumanConfirmationAnalytics` summarizes accepted, edited, and rejected AI suggestions.
- `buildProjectSafetyGate` evaluates one project across eight advisory safety domains and returns safety score, level, management attention, writeback risk, evidence, and actions.
- `buildProjectSafetyGateSuite` aggregates project safety gates for a portfolio and is included in `buildProjectIntelligence`.
4. For every matching project:
   - open the project record by double-clicking the project name gridcell from the current visible DOM snapshot
   - or open the record URL built from `buildDynamicsProjectRecordUrl(projectId)` when the candidate came from Dataverse
   - verify the opened record header shows `Project Manager` = `Reiner Weisssieker`; otherwise skip the record
   - show project title and URL in the conversation
   - ask for status input
   - normalize `kv` to the fixed unchanged-status sentence
   - build the prepared status with `buildStatusUpdateDraft(statusText, options)`
   - in dry-run mode, report the prepared status without writing
   - in staging mode, open `Status Update`, click `New Status Update`, and stage the status in the Quick Create dialog
   - ask for explicit save confirmation before clicking any save button
5. If no writable target field is confidently found, do not write in CRM. Print the prepared status and mark the project as `not_written`.

## Calibrated Dynamics UI

- The project list title observed in Dynamics is `MR Active Projects - RW`.
- The configured view id is `40761dc9-c0d4-ef11-a72e-7c1e52862247`.
- The logged-in account control was observed as `Account manager for Reiner Weisssieker`.
- Visible grid rows include columns: `Project ID`, `Name`, `Description`, `Effort`, `Priority`, `% Complete`, `Start Date`, `Finish Date`, `Current State`, `Overall KPI`, `Owner`, `Created On`, `Department`, `Enterprise Project Type`.
- The visible `Owner` text in rows is not sufficient for filtering. The assistant must open the record and read the header `Project Manager`.
- Active project states are `Created`, `Planning`, and `In Progress`. Skip `Closed`, `Declined`, and any unrecognized non-active state.
- In `MR Active Projects - RW`, the visible grid already contained only active `In Progress` rows for `Reiner Weisssieker`; still verify the opened record header before writing.
- Opening a record was verified by double-clicking the project name gridcell. Example opened record:
  `MDE Integration Schritt 1`
  `https://posp365.crm4.dynamics.com/main.aspx?appid=1a66513c-266c-ef11-bfe2-6045bd8d5d87&forceUCI=1&pagetype=entityrecord&etn=tpg_project&id=76aff425-d70e-4e29-9eba-db265d904fb9`
- In a project record, the status entry path is:
  `Status Update` tab -> `New Status Update` -> `Quick Create: Status Update`.
- Quick Create fields observed:
  - required `Report Date`
  - required `Project`
  - required `Status Summary`
  - required `Owner`
  - required `Submitted To`
  - `Email Status Update`
  - `Accomplished Activities / Current Status`
  - `Missed Activities`
  - `Planned Activities / Next Steps`
  - `Sponsor Actions`
  - `Obstacles and Measures`
  - `Decisions`

## Status Entry Mapping

- Put the user's normalized status text into `Status Summary`.
- Also put the same text into `Accomplished Activities / Current Status` unless the user provides a more structured status split.
- For `kv`, use exactly this fixed German CRM status phrase:
  `Status unverändert seit letztem Bericht (keine inhaltlichen Änderungen)`
- Leave optional activity fields blank unless the user supplies content for them.
- Do not guess `Submitted To`; if Dynamics requires it and no default is present, ask the user before saving.
- `Email Status Update` was observed as default `Yes`. Treat this as a separate risky action:
  - prefer switching it to `No` before save, or
  - ask for explicit confirmation that an email may be sent.

## Safety Requirements

- Default to dry-run when uncertain.
- Show the project safety level and material failed/critical gates before asking for status input or staging a CRM draft.
- Treat generated risk lists, nudges, decision radar, and executive reports as advisory until the user confirms the source data and wording.
- Treat `kv_blocked` as a warning, not a hard stop: the project leader may still choose `kv`, but the report must show the evidence codes that made it risky.
- Evidence codes such as `red_kpi`, `overdue_finish`, `high_progress_not_closed`, `missing_mitigation`, `missing_next_step`, and `stale_status` must remain visible in management summaries where possible.
- Create an audit entry for every proposed, staged, skipped, or saved status action with `buildAuditEntry(input)` when the run produces a report or handoff summary.
- Require a visible confirmation prompt before each save.
- Report processed project name, record URL, raw input, final status text, and outcome in the conversation.
- Continue with remaining projects after permission, navigation, or selector errors unless the user aborts.
- Do not process projects outside the configured project view or projects whose opened `Project Manager` is not `Reiner Weisssieker`.
- Never click `Save and Close` in `Quick Create: Status Update` until the user explicitly confirms the exact project, status text, and email setting.

## In-App Browser Selector Discipline

- Take a fresh Browser DOM snapshot after opening the list, applying filters, opening a project, and opening any form section or dialog.
- Build locators only from the current snapshot.
- Before any click, fill, or keypress, verify the target is unique.
- Prefer visible Dynamics labels and stable row/link attributes over broad CSS selectors.
- Treat a save click as a risky browser action. Ask immediately before the click and explain which project and status text will be saved.
