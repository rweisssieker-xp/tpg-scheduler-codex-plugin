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
12. Confirm that no save occurs unless the user explicitly confirms project, month, status text, and email setting.
13. Turn on Email Status Update only in a safe test context and verify the workflow reports high writeback risk before any save.
14. Record pass/fail notes without real project data.

## Pass Criteria

- Active projects can be read only through the authenticated browser context.
- The PMO export envelope is produced from Dataverse Web API data and can drive CLI JSON, DOCX, and XLSX outputs.
- Non-matching project manager records are not processed for status staging.
- Safety gates and PMO controls appear before staging.
- `kv` expands to the configured unchanged-status phrase.
- Monthly status writeback plans are generated per active verified project and require Quick Create confirmation before saving.
- Email Status Update is surfaced as high risk.
- No CRM write happens without explicit confirmation.

## Failure Handling

Stop the live workflow if field detection, owner verification, or writeback confirmation behavior differs from this runbook. Capture only anonymized evidence and fix the mapping or documentation before continuing.
