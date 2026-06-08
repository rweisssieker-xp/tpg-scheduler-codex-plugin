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
await TPGProjectAssist.downloadPmoProjectExport()
```

4. Confirm that the downloaded JSON has `exportType: "tpg_pmo_project_export"`, `source: "dataverse_web_api"`, and a real `projects` array.
5. Generate a PMO suite from the export:

```powershell
node ./scripts/statusbericht.js --pmo-suite <real-dataverse-export.json> --docx reports/pmo-suite.docx --xlsx reports/pmo-suite.xlsx --json
```

6. Open one healthy project and one risky project when available.
7. Verify the current project manager check returns the expected configured owner before collecting status.
8. Build project intelligence and inspect:

- `projectSafetyGates.summary`
- `projectSafetyGates.projects[*].safetyLevel`
- `pmoControlTower.summary`
- `pmoControlTower.projects[*].checks`

9. Test `kv` normalization in a draft.
10. Generate a monthly status writeback plan from the same export:

```powershell
node ./scripts/statusbericht.js --monthly-status-plan <real-dataverse-export.json> --month YYYY-MM --json
```

11. Verify that the plan contains one draft per active project, the month-end report date, writeback blockers, and the exact confirmation text.
12. Validate the API writeback readiness path in the authenticated browser context:

```javascript
await TPGProjectAssist.probeDataversePermissions()
await TPGProjectAssist.discoverStatusUpdateMetadata()
```

13. Verify the returned Status Update logical name, entity set, project lookup binding, required fields, and privileges. Do not continue to API writeback if any field is ambiguous.
14. Read the target project's status history for the test month:

```javascript
await TPGProjectAssist.retrieveStatusUpdates(project, {
  entityLogicalName: "<confirmed-status-update-logical-name>",
  reportMonth: "YYYY-MM"
})
```

15. Run the duplicate check and monthly draft validation against that history. A duplicate must stop create and switch to manual review.
16. Build a create plan with `TPGProjectAssist.buildStatusUpdateCreateRecordPlan(project, draft, metadata, { reportMonth: "YYYY-MM" })`.
17. Confirm the plan has `canAutoSave: false`, no blockers, the expected `@odata.bind` project lookup, and a non-empty `confirmationText`.
18. In a non-production or low-risk test project only, call `TPGProjectAssist.createStatusUpdateWithConfirmation(project, draft, { metadata, confirmationText: plan.confirmationText })`.
19. Verify the saved response and `status_writeback_audit` event. If the confirmation text is edited, the call must return `saved: false`.
20. Confirm that no save occurs unless the user explicitly confirms project, month, status text, and email setting.
21. Turn on Email Status Update only in a safe test context and verify the workflow reports high writeback risk before any save.
22. Record pass/fail notes without real project data.

## Pass Criteria

- Active projects can be read only through the authenticated browser context.
- The PMO export envelope is produced from Dataverse Web API data and can drive CLI JSON, DOCX, and XLSX outputs.
- Non-matching project manager records are not processed for status staging.
- Safety gates and PMO controls appear before staging.
- `kv` expands to the configured unchanged-status phrase.
- Monthly status writeback plans are generated per active verified project and require Quick Create confirmation before saving.
- API writeback readiness verifies metadata, permissions, history, duplicates, idempotency, confirmation text, and audit output before any `Xrm.WebApi.createRecord` call.
- Email Status Update is surfaced as high risk.
- No CRM write happens without explicit confirmation.

## Failure Handling

Stop the live workflow if field detection, owner verification, or writeback confirmation behavior differs from this runbook. Capture only anonymized evidence and fix the mapping or documentation before continuing.
