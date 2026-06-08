const assert = require("node:assert/strict");
const {
  DATAVERSE_ORG_URL,
  PROJECT_ENTITY_LOGICAL_NAME,
  PROJECT_ENTITY_SET_NAME,
  PROJECT_PRIMARY_ID_ATTRIBUTE,
  PROJECT_PRIMARY_NAME_ATTRIBUTE,
  STATUS_UPDATE_FIELDS,
  UNCHANGED_STATUS_TEXT,
  buildActiveProjectsApiUrl,
  buildAuditEntry,
  buildAudienceReport,
  buildBatchProjectPreview,
  buildCalibrationReport,
  buildDataCompletenessScore,
  buildDecisionClosureItems,
  buildDynamicsProjectRecordUrl,
  buildExecutiveOnePager,
  buildExportBundle,
  buildGovernanceExceptions,
  buildLiveDynamicsRunPlan,
  buildManagementActionExportRows,
  buildMeetingCaptureDrafts,
  buildNudgeDrafts,
  buildPmoConfig,
  buildPortfolioNarrativeDiff,
  buildPortfolioRiskList,
  buildProjectManagerCoach,
  buildProjectRecordApiUrl,
  buildProjectIntelligence,
  buildProjectNudges,
  buildProjectSafetyGate,
  buildProjectSafetyGateSuite,
  buildPmoControlTower,
  buildPmoProjectControls,
  buildPmoStatusReport,
  buildRiskLedgerEntries,
  buildRiskTrendIntelligence,
  buildSafeWritebackSimulation,
  buildSteeringAgenda,
  buildWhatIfRecoveryPlan,
  buildStatusUpdateDraft,
  detectStatusDelta,
  evaluateProjectStatusQuality,
  evaluateStatusQuality,
  extractDecisionRadar,
  getDataverseBrowserSnippet,
  isSampleInputPath,
  isActiveProjectCandidate,
  mapProjectDataverseRow,
  normalizeGuid,
  normalizeStatusInput,
} = require("./statusbericht");

assert.equal(normalizeStatusInput("kv"), UNCHANGED_STATUS_TEXT);
assert.equal(normalizeStatusInput("KV"), UNCHANGED_STATUS_TEXT);
assert.equal(normalizeStatusInput("Kv"), UNCHANGED_STATUS_TEXT);
assert.equal(normalizeStatusInput("  kV  "), UNCHANGED_STATUS_TEXT);
assert.equal(normalizeStatusInput("Projekt ist im Plan."), "Projekt ist im Plan.");
assert.equal(normalizeStatusInput("  Projekt ist im Plan.  "), "Projekt ist im Plan.");
assert.equal(normalizeStatusInput(""), "");
assert.equal(normalizeStatusInput("   "), "");

assert.equal(DATAVERSE_ORG_URL, "https://posp365.crm4.dynamics.com");
assert.equal(PROJECT_ENTITY_LOGICAL_NAME, "tpg_project");
assert.equal(PROJECT_ENTITY_SET_NAME, "tpg_projects");
assert.equal(PROJECT_PRIMARY_ID_ATTRIBUTE, "tpg_projectid");
assert.equal(PROJECT_PRIMARY_NAME_ATTRIBUTE, "tpg_subject");
assert.equal(normalizeGuid("{84966C5D-996D-4D19-88DE-97A4300A6A62}"), "84966c5d-996d-4d19-88de-97a4300a6a62");
assert.match(
  buildDynamicsProjectRecordUrl("{84966C5D-996D-4D19-88DE-97A4300A6A62}"),
  /pagetype=entityrecord&etn=tpg_project&id=84966c5d-996d-4d19-88de-97a4300a6a62$/
);
assert.match(
  buildProjectRecordApiUrl("84966c5d-996d-4d19-88de-97a4300a6a62"),
  /^https:\/\/posp365\.crm4\.dynamics\.com\/api\/data\/v9\.2\/tpg_projects\(84966c5d-996d-4d19-88de-97a4300a6a62\)\?\$select=/
);
assert.match(buildActiveProjectsApiUrl(), /\$filter=statecode eq 0$/);
assert.equal(STATUS_UPDATE_FIELDS.statusSummary, "tpg_title");
assert.equal(STATUS_UPDATE_FIELDS.accomplishedActivities, "tpg_accomplishedactivities");
assert.equal(STATUS_UPDATE_FIELDS.submittedTo, "tpg_submittedto");
assert.equal(STATUS_UPDATE_FIELDS.emailStatusUpdate, "tpg_emailstatusupdate");
assert.deepEqual(buildStatusUpdateDraft("kv").fields.tpg_title, UNCHANGED_STATUS_TEXT);
assert.deepEqual(buildStatusUpdateDraft("Projekt ist im Plan.").fields.tpg_accomplishedactivities, "Projekt ist im Plan.");
assert.equal(buildStatusUpdateDraft("Projekt ist im Plan.").emailStatusUpdate, false);
assert.equal(buildStatusUpdateDraft("Projekt ist im Plan.").requiresExplicitSaveConfirmation, true);
assert.equal(isActiveProjectCandidate({ projectStatusLabel: "In Progress" }), true);
assert.equal(isActiveProjectCandidate({ projectStatusLabel: "Closed" }), false);
assert.equal(isActiveProjectCandidate({ projectStatusLabel: null }), true);
assert.deepEqual(
  evaluateProjectStatusQuality({
    name: "Cutover",
    projectStatusLabel: "In Progress",
    overallKpiLabel: "Red",
    progress: 95,
    finish: "2026-05-01",
    lastStatusUpdate: "",
  }),
  {
    score: 0,
    severity: "critical",
    recommendedAction: "needs_attention",
    warnings: [
      "No last status update is available.",
      "Overall KPI is Red.",
      "Finish date is in the past.",
      "Progress is 95% but the project is still In Progress.",
    ],
  }
);
assert.deepEqual(
  evaluateProjectStatusQuality({
    name: "Rollout",
    projectStatusLabel: "In Progress",
    overallKpiLabel: "Green",
    progress: 50,
    finish: "2026-05-30",
    lastStatusUpdate: "2026-05-12",
  }, { today: "2026-05-13" }),
  {
    score: 100,
    severity: "ok",
    recommendedAction: "collect_status",
    warnings: [],
  }
);
assert.deepEqual(
  buildBatchProjectPreview(
    [
      {
        id: "84966c5d-996d-4d19-88de-97a4300a6a62",
        projectId: "2024-1058",
        name: "Healthy",
        projectStatusLabel: "In Progress",
        overallKpiLabel: "Green",
        progress: 25,
        finish: "2026-05-30",
        lastStatusUpdate: "2026-05-12",
      },
      {
        id: "11111111-1111-1111-1111-111111111111",
        projectId: "2024-9999",
        name: "Late Risk",
        projectStatusLabel: "In Progress",
        overallKpiLabel: "Red",
        progress: 95,
        finish: "2026-05-01",
        lastStatusUpdate: "",
      },
    ],
    { today: "2026-05-13" }
  ).map((item) => ({
    projectId: item.projectId,
    name: item.name,
    severity: item.quality.severity,
    recommendedAction: item.quality.recommendedAction,
  })),
  [
    {
      projectId: "2024-9999",
      name: "Late Risk",
      severity: "critical",
      recommendedAction: "needs_attention",
    },
    {
      projectId: "2024-1058",
      name: "Healthy",
      severity: "ok",
      recommendedAction: "collect_status",
    },
  ]
);
assert.deepEqual(
  mapProjectDataverseRow({
    tpg_projectid: "{84966C5D-996D-4D19-88DE-97A4300A6A62}",
    tpg_projectnum: "2024-1058",
    gbl_projectnumber: 451584,
    tpg_subject: "Blue Print",
    tpg_projectstatus: 926720004,
    tpg_overallkpi: 926720002,
    "_ownerid_value@OData.Community.Display.V1.FormattedValue": "Reiner Weisssieker",
  }).projectStatusLabel,
  "Closed"
);
assert.match(getDataverseBrowserSnippet(), /window\.TPGProjectAssist/);
assert.match(getDataverseBrowserSnippet(), /buildProjectIntelligence/);
assert.match(getDataverseBrowserSnippet(), /detectStatusDelta/);
assert.match(getDataverseBrowserSnippet(), /buildAuditEntry/);
assert.match(getDataverseBrowserSnippet(), /buildSteeringAgenda/);
assert.match(getDataverseBrowserSnippet(), /buildRiskLedgerEntries/);
assert.match(getDataverseBrowserSnippet(), /buildCalibrationReport/);
assert.equal(isSampleInputPath("./scripts/fixtures/projects.sample.json"), true);
assert.equal(isSampleInputPath("./real-project-export.json"), false);
assert.equal(typeof buildAuditEntry, "function");
assert.equal(typeof buildAudienceReport, "function");
assert.equal(typeof buildCalibrationReport, "function");
assert.equal(typeof buildDataCompletenessScore, "function");
assert.equal(typeof buildExecutiveOnePager, "function");
assert.equal(typeof buildExportBundle, "function");
assert.equal(typeof buildGovernanceExceptions, "function");
assert.equal(typeof buildLiveDynamicsRunPlan, "function");
assert.equal(typeof buildManagementActionExportRows, "function");
assert.equal(typeof buildMeetingCaptureDrafts, "function");
assert.equal(typeof buildNudgeDrafts, "function");
assert.equal(typeof buildPmoConfig, "function");
assert.equal(typeof buildPortfolioNarrativeDiff, "function");
assert.equal(typeof buildPortfolioRiskList, "function");
assert.equal(typeof buildProjectManagerCoach, "function");
assert.equal(typeof buildProjectIntelligence, "function");
assert.equal(typeof buildProjectNudges, "function");
assert.equal(typeof buildProjectSafetyGate, "function");
assert.equal(typeof buildProjectSafetyGateSuite, "function");
assert.equal(typeof buildPmoControlTower, "function");
assert.equal(typeof buildPmoProjectControls, "function");
assert.equal(typeof buildPmoStatusReport, "function");
assert.equal(typeof buildRiskLedgerEntries, "function");
assert.equal(typeof buildRiskTrendIntelligence, "function");
assert.equal(typeof buildSafeWritebackSimulation, "function");
assert.equal(typeof buildSteeringAgenda, "function");
assert.equal(typeof buildWhatIfRecoveryPlan, "function");
assert.equal(typeof buildDecisionClosureItems, "function");
assert.equal(typeof detectStatusDelta, "function");
assert.equal(typeof evaluateStatusQuality, "function");
assert.equal(typeof extractDecisionRadar, "function");

console.log("statusbericht tests passed");
