# Dynamics End-to-End Runbook

Use this runbook to validate the live browser workflow against Dynamics 365 without automatic CRM writes.

## Scope

The smoke test verifies read access, project-manager verification, advisory intelligence generation, draft staging behavior, and confirmation gates.

## Preconditions

- Codex Desktop is signed in.
- The Browser plugin is available.
- The tester has read access to the target TPG project view.
- A non-production or low-risk test project is available when draft staging is tested.

## Steps

1. Open the configured TPG active project view in the Codex in-app Browser.
2. Load the Dataverse browser snippet from:

```powershell
cd plugins/tpg-scheduler-codex-plugin
npm run status-report:dataverse
```

3. In the authenticated Dynamics browser console, run:

```javascript
await TPGProjectAssist.retrieveProjectIntelligenceFromD365({ today: "YYYY-MM-DD" })
```

4. Confirm that the returned object contains real project intelligence from D365 API data and includes `preview`, `projectSafetyGates`, `pmoControlTower`, `maximumUsps`, `pmoUsps`, `boardPack`, `logicValidation`, and `logicAssuranceUsps`.
5. Generate the live Board Pack directly from D365 API data:

```javascript
await TPGProjectAssist.retrieveBoardPackFromD365({ today: "YYYY-MM-DD" })
```

Confirm that the returned pack has `source: "d365_api"`, `logicAssurance.assuranceLevel`, `logicAssurance.checks.length === 15`, `safety.canAutoSave === false`, project links where record URLs are available, and no CRM write side effects.
6. For DOCX/XLSX file-generation fallback only, use a reviewed offline snapshot and include `--allow-offline-input`:

```powershell
node ./scripts/statusbericht.js --pmo-suite <reviewed-snapshot.json> --allow-offline-input --docx reports/pmo-suite.docx --xlsx reports/pmo-suite.xlsx --json
```

7. Open one healthy project and one risky project when available.
8. Verify the current project manager check returns the expected configured owner before collecting status.
9. Build project intelligence and inspect:

- `projectSafetyGates.summary`
- `projectSafetyGates.projects[*].safetyLevel`
- `pmoControlTower.summary`
- `pmoControlTower.projects[*].checks`
- `logicValidation.summary.assuranceLevel`
- `logicValidation.checks`
- `logicValidation.evidenceTrace`

10. Test `kv` normalization in a draft.
11. Generate a monthly status writeback plan directly from D365 API data:

```powershell
await TPGProjectAssist.retrieveMonthlyStatusPlanFromD365({ month: "YYYY-MM" })
```

12. Verify that the plan contains one draft per active project, the month-end report date, writeback blockers, and the exact confirmation text.
13. Validate the API writeback readiness path in the authenticated browser context:

```javascript
await TPGProjectAssist.probeDataversePermissions()
await TPGProjectAssist.discoverStatusUpdateMetadata()
```

14. Verify the returned Status Update logical name, entity set, project lookup binding, required fields, and privileges. Do not continue to API writeback if any field is ambiguous.
15. Read the target project's status history for the test month:

```javascript
await TPGProjectAssist.retrieveStatusUpdates(project, {
  entityLogicalName: "<confirmed-status-update-logical-name>",
  reportMonth: "YYYY-MM"
})
```

16. Run the duplicate check and monthly draft validation against that history. A duplicate must stop create and switch to manual review.
17. Build a create plan with `TPGProjectAssist.buildStatusUpdateCreateRecordPlan(project, draft, metadata, { reportMonth: "YYYY-MM" })`.
18. Confirm the plan has `canAutoSave: false`, no blockers, the expected `@odata.bind` project lookup, and a non-empty `confirmationText`.
19. In a non-production or low-risk test project only, call `TPGProjectAssist.createStatusUpdateWithConfirmation(project, draft, { metadata, confirmationText: plan.confirmationText })`.
20. Verify the saved response and `status_writeback_audit` event. If the confirmation text is edited, the call must return `saved: false`.
21. Confirm that no save occurs unless the user explicitly confirms project, month, status text, and email setting.
22. Turn on Email Status Update only in a safe test context and verify the workflow reports high writeback risk before any save.
23. Record pass/fail notes without real project data.

## Evidence Recording

Keep raw browser exports and screenshots local only. Do not commit tenant-specific project names, record IDs, user names, status text, or downloaded Dataverse rows. Commit only anonymized evidence notes, such as `docs/LIVE_DYNAMICS_EVIDENCE_v0.1.0.md`, that record pass/fail status, detected control names, unresolved metadata, and whether any write was attempted.

## Pass Criteria

- Active projects can be read only through the authenticated browser context.
- Project intelligence and monthly status plans are produced directly from Dataverse Web API data. CLI file inputs are offline fallback only and require `--allow-offline-input`.
- Non-matching project manager records are not processed for status staging.
- Safety gates and PMO controls appear before staging.
- Logic Assurance appears in project intelligence and Board Pack output with all 15 check groups.
- `kv` expands to the configured unchanged-status phrase.
- Monthly status writeback plans are generated per active verified project and require Quick Create confirmation before saving.
- API writeback readiness verifies metadata, permissions, history, duplicates, idempotency, confirmation text, and audit output before any `Xrm.WebApi.createRecord` call.
- Email Status Update is surfaced as high risk.
- No CRM write happens without explicit confirmation.

## Failure Handling

Stop the live workflow if field detection, owner verification, or writeback confirmation behavior differs from this runbook. Capture only anonymized evidence and fix the mapping or documentation before continuing.
