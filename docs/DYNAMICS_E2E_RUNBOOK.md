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

3. Retrieve active project candidates.
4. Open one healthy project and one risky project when available.
5. Verify the current project manager check returns the expected configured owner before collecting status.
6. Build project intelligence and inspect:

- `projectSafetyGates.summary`
- `projectSafetyGates.projects[*].safetyLevel`
- `pmoControlTower.summary`
- `pmoControlTower.projects[*].checks`

7. Test `kv` normalization in a draft.
8. Confirm that no save occurs unless the user explicitly confirms project, status text, and email setting.
9. Turn on Email Status Update only in a safe test context and verify the workflow reports high writeback risk before any save.
10. Record pass/fail notes without real project data.

## Pass Criteria

- Active projects can be read only through the authenticated browser context.
- Non-matching project manager records are not processed for status staging.
- Safety gates and PMO controls appear before staging.
- `kv` expands to the configured unchanged-status phrase.
- Email Status Update is surfaced as high risk.
- No CRM write happens without explicit confirmation.

## Failure Handling

Stop the live workflow if field detection, owner verification, or writeback confirmation behavior differs from this runbook. Capture only anonymized evidence and fix the mapping or documentation before continuing.
