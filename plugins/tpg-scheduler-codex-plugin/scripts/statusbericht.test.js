const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  DATAVERSE_ORG_URL,
  PMO_PROJECT_EXPORT_TYPE,
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
  buildDataverseQuery,
  buildDataversePermissionProbePlan,
  buildDeltaProjectsApiUrl,
  buildDecisionClosureItems,
  buildDynamicsProjectRecordUrl,
  buildMonthlyStatusReportDraft,
  buildMonthlyStatusReportRun,
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
  buildPmoProjectExport,
  buildPmoProjectControls,
  buildPmoReport,
  buildPmoReportSuite,
  buildPmoUspLayer,
  buildPmoStatusReport,
  buildPmoStatusReportDocxBuffer,
  buildPmoStatusReportXlsxBuffer,
  PMO_REPORT_TYPES,
  PMO_USP_IDS,
  buildStatusApiEnvelope,
  buildStatusReportIdempotencyKey,
  buildStatusUpdateAttachmentPlan,
  buildStatusUpdateCreateRecordPlan,
  buildStatusUpdateDuplicateCheck,
  buildStatusUpdateHistoryQuery,
  buildStatusUpdateWritebackPayload,
  buildRiskLedgerEntries,
  buildRiskTrendIntelligence,
  buildSafeWritebackSimulation,
  buildSteeringAgenda,
  buildWhatIfRecoveryPlan,
  buildStatusUpdateDraft,
  buildStatusWritebackAuditEvent,
  buildStatusWritebackQueue,
  buildStructuredStatusUpdateDraft,
  detectStatusDelta,
  evaluateProjectStatusQuality,
  evaluateStatusQuality,
  extractDecisionRadar,
  getDataverseBrowserSnippet,
  isSampleInputPath,
  isActiveProjectCandidate,
  mapProjectDataverseRow,
  mapDataverseError,
  normalizeGuid,
  normalizeStatusInput,
  readProjectsInput,
  unwrapProjectInput,
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
assert.match(buildActiveProjectsApiUrl(), /\$filter=statecode eq 0/);
assert.match(buildActiveProjectsApiUrl(), /\$orderby=modifiedon desc$/);
assert.match(buildActiveProjectsApiUrl(undefined, { top: 25 }), /\$top=25/);
assert.match(buildDataverseQuery(["tpg_projectid"], "statecode eq 0", 5, "modifiedon desc"), /\$orderby=modifiedon desc$/);
assert.equal(STATUS_UPDATE_FIELDS.statusSummary, "tpg_title");
assert.equal(STATUS_UPDATE_FIELDS.accomplishedActivities, "tpg_accomplishedactivities");
assert.equal(STATUS_UPDATE_FIELDS.submittedTo, "tpg_submittedto");
assert.equal(STATUS_UPDATE_FIELDS.emailStatusUpdate, "tpg_emailstatusupdate");
assert.deepEqual(buildStatusUpdateDraft("kv").fields.tpg_title, UNCHANGED_STATUS_TEXT);
assert.deepEqual(buildStatusUpdateDraft("Projekt ist im Plan.").fields.tpg_accomplishedactivities, "Projekt ist im Plan.");
assert.equal(buildStatusUpdateDraft("Projekt ist im Plan.").emailStatusUpdate, false);
assert.equal(buildStatusUpdateDraft("Projekt ist im Plan.").requiresExplicitSaveConfirmation, true);
const monthlyDraft = buildMonthlyStatusReportDraft(
  {
    id: "84966c5d-996d-4d19-88de-97a4300a6a62",
    projectId: "2024-1058",
    name: "Monthly Project",
    projectStatusLabel: "In Progress",
    overallKpiLabel: "Green",
    recordUrl: "https://posp365.crm4.dynamics.com/main.aspx?id=84966c5d-996d-4d19-88de-97a4300a6a62",
  },
  "kv",
  { reportMonth: "2026-06", projectManagerVerified: true, reviewed: true, submittedTo: "PMO" }
);
assert.equal(monthlyDraft.reportMonth, "2026-06");
assert.equal(monthlyDraft.periodEnd, "2026-06-30");
assert.equal(monthlyDraft.draft.fields.tpg_reportdate, "2026-06-30");
assert.equal(monthlyDraft.draft.fields.tpg_title, UNCHANGED_STATUS_TEXT);
assert.equal(monthlyDraft.writeback.mode, "quick_create_confirmation_gated");
assert.equal(monthlyDraft.writeback.canAutoSave, false);
assert.match(monthlyDraft.writeback.confirmationText, /CONFIRM MONTHLY STATUS WRITEBACK/);
const monthlyRun = buildMonthlyStatusReportRun([
  {
    projectId: "2024-1058",
    name: "Monthly Project",
    projectStatusLabel: "In Progress",
    overallKpiLabel: "Green",
    recordUrl: "https://posp365.crm4.dynamics.com/main.aspx?id=84966c5d-996d-4d19-88de-97a4300a6a62",
  },
  {
    projectId: "2024-9999",
    name: "Closed Project",
    projectStatusLabel: "Closed",
  },
], { reportMonth: "2026-06" });
assert.equal(monthlyRun.reportType, "monthly_status_writeback");
assert.equal(monthlyRun.summary.projectsReviewed, 1);
assert.equal(monthlyRun.summary.statusInputsMissing, 1);
assert.equal(monthlyRun.summary.canAutoSave, false);
const structuredDraft = buildStructuredStatusUpdateDraft({
  currentStatus: "Milestone finished.",
  nextSteps: "Prepare rollout.",
  risks: "Vendor delay risk.",
  decisions: "Approve rollout.",
  submittedTo: "PMO",
});
assert.equal(structuredDraft.fields.tpg_title, "Milestone finished.");
assert.equal(structuredDraft.fields.tpg_plannedactivities, "Prepare rollout.");
assert.equal(structuredDraft.fields.gbl_obstaclesandmeasures, "Vendor delay risk.");
const idempotencyKey = buildStatusReportIdempotencyKey(
  { id: "84966c5d-996d-4d19-88de-97a4300a6a62", projectId: "2024-1058" },
  monthlyDraft.draft,
  { reportMonth: "2026-06" }
);
assert.match(idempotencyKey, /^status:2024-1058:2026-06:/);
assert.equal(
  buildStatusUpdateDuplicateCheck(
    [{ _tpg_project_value: "84966c5d-996d-4d19-88de-97a4300a6a62", tpg_reportdate: "2026-06-15" }],
    monthlyDraft,
    { projectId: "84966c5d-996d-4d19-88DE-97A4300A6A62", reportMonth: "2026-06" }
  ).duplicateFound,
  true
);
const validatedMonthlyDraft = buildStatusWritebackQueue({
  reportMonth: "2026-06",
  reports: [monthlyDraft],
});
assert.equal(validatedMonthlyDraft.queueType, "monthly_status_writeback");
assert.equal(validatedMonthlyDraft.summary.canAutoSave, false);
assert.equal(validatedMonthlyDraft.items[0].canAutoSave, false);
const historyQuery = buildStatusUpdateHistoryQuery({ id: "84966c5d-996d-4d19-88de-97a4300a6a62" }, { reportMonth: "2026-06", entityLogicalName: "tpg_statusupdate" });
assert.match(historyQuery.filter, /tpg_reportdate ge 2026-06-01/);
assert.match(buildDeltaProjectsApiUrl({ modifiedSince: "2026-06-01T00:00:00Z" }), /modifiedon gt 2026-06-01T00:00:00Z/);
const writebackPayload = buildStatusUpdateWritebackPayload(
  { id: "84966c5d-996d-4d19-88de-97a4300a6a62" },
  monthlyDraft.draft,
  { entityLogicalName: "tpg_statusupdate", projectLookupBinding: "tpg_project" }
);
assert.equal(writebackPayload.canCreate, true);
assert.equal(writebackPayload.payload["tpg_project@odata.bind"], "/tpg_projects(84966c5d-996d-4d19-88de-97a4300a6a62)");
const createPlan = buildStatusUpdateCreateRecordPlan(
  { id: "84966c5d-996d-4d19-88de-97a4300a6a62", projectId: "2024-1058", name: "Monthly Project" },
  monthlyDraft.draft,
  { entityLogicalName: "tpg_statusupdate", projectLookupBinding: "tpg_project" },
  { reportMonth: "2026-06" }
);
assert.equal(createPlan.operation, "Xrm.WebApi.createRecord");
assert.equal(createPlan.canAutoSave, false);
assert.match(createPlan.confirmationText, /CONFIRM DATAVERSE STATUS CREATE/);
assert.equal(buildStatusUpdateAttachmentPlan({ projectId: "2024-1058" }, { path: "reports/pmo.docx" }, { confirmed: true }).blockers.length, 0);
assert.equal(mapDataverseError({ message: "Missing required field tpg_title" }).category, "required_field");
assert.equal(buildDataversePermissionProbePlan({ statusUpdateEntityLogicalName: "tpg_statusupdate" }).writeProbe.safeMode, "metadata_only_no_create");
assert.equal(buildStatusApiEnvelope({ ok: true }).api, "tpg_status_api");
assert.equal(buildStatusWritebackAuditEvent("proposed", { projectId: "2024-1058", reportMonth: "2026-06" }).outcome, "not_saved");
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
assert.match(getDataverseBrowserSnippet(), /retrieveProjectIntelligenceFromD365/);
assert.match(getDataverseBrowserSnippet(), /retrieveMonthlyStatusPlanFromD365/);
assert.match(getDataverseBrowserSnippet(), /retrieveBatchProjectPreviewFromD365/);
assert.match(getDataverseBrowserSnippet(), /exportActiveProjectsForPmoReports/);
assert.match(getDataverseBrowserSnippet(), /downloadPmoProjectExport/);
assert.match(getDataverseBrowserSnippet(), /copyPmoProjectExportToClipboard/);
assert.match(getDataverseBrowserSnippet(), /source: "dataverse_web_api"/);
assert.match(getDataverseBrowserSnippet(), /buildMonthlyStatusReportDraft/);
assert.match(getDataverseBrowserSnippet(), /buildMonthlyStatusReportRun/);
assert.match(getDataverseBrowserSnippet(), /retrieveAllRecords/);
assert.match(getDataverseBrowserSnippet(), /retrieveProjectDelta/);
assert.match(getDataverseBrowserSnippet(), /retrieveStatusUpdates/);
assert.match(getDataverseBrowserSnippet(), /discoverStatusUpdateMetadata/);
assert.match(getDataverseBrowserSnippet(), /probeDataversePermissions/);
assert.match(getDataverseBrowserSnippet(), /createStatusUpdateWithConfirmation/);
assert.equal(isSampleInputPath("./scripts/fixtures/projects.sample.json"), true);
assert.equal(isSampleInputPath("./reviewed-snapshot.json"), false);
const dataverseExport = buildPmoProjectExport([
  {
    id: "84966c5d-996d-4d19-88de-97a4300a6a62",
    projectId: "2024-1058",
    name: "Dataverse Export Project",
    projectStatusLabel: "In Progress",
  },
], { generatedAt: "2026-06-08T10:00:00.000Z" });
assert.equal(dataverseExport.exportType, PMO_PROJECT_EXPORT_TYPE);
assert.equal(dataverseExport.source, "dataverse_web_api");
assert.equal(dataverseExport.projectCount, 1);
assert.equal(dataverseExport.safety.readOnlyExport, true);
assert.equal(unwrapProjectInput(dataverseExport)[0].projectId, "2024-1058");
const exportPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "tpg-dataverse-export-")), "projects.json");
fs.writeFileSync(exportPath, JSON.stringify(dataverseExport), "utf8");
assert.throws(() => readProjectsInput(exportPath), /offline fallback only/);
assert.equal(readProjectsInput(exportPath, { allowOfflineInput: true })[0].name, "Dataverse Export Project");
assert.equal(typeof buildAuditEntry, "function");
assert.equal(typeof buildAudienceReport, "function");
assert.equal(typeof buildCalibrationReport, "function");
assert.equal(typeof buildDataCompletenessScore, "function");
assert.equal(typeof buildDataversePermissionProbePlan, "function");
assert.equal(typeof buildDeltaProjectsApiUrl, "function");
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
assert.equal(typeof buildPmoReport, "function");
assert.equal(typeof buildPmoReportSuite, "function");
assert.equal(typeof buildPmoUspLayer, "function");
assert.equal(typeof buildPmoStatusReport, "function");
assert.equal(typeof buildPmoStatusReportDocxBuffer, "function");
assert.equal(typeof buildPmoStatusReportXlsxBuffer, "function");
assert.equal(typeof buildStatusApiEnvelope, "function");
assert.equal(typeof buildStatusReportIdempotencyKey, "function");
assert.equal(typeof buildStatusUpdateAttachmentPlan, "function");
assert.equal(typeof buildStatusUpdateCreateRecordPlan, "function");
assert.equal(typeof buildStatusUpdateDuplicateCheck, "function");
assert.equal(typeof buildStatusUpdateHistoryQuery, "function");
assert.equal(typeof buildStatusUpdateWritebackPayload, "function");
assert.equal(typeof buildStatusWritebackAuditEvent, "function");
assert.equal(typeof buildStatusWritebackQueue, "function");
assert.equal(typeof buildStructuredStatusUpdateDraft, "function");
assert.equal(PMO_REPORT_TYPES.length, 12);
assert.equal(PMO_USP_IDS.length, 15);
assert.equal(typeof buildRiskLedgerEntries, "function");
assert.equal(typeof buildRiskTrendIntelligence, "function");
assert.equal(typeof buildSafeWritebackSimulation, "function");
assert.equal(typeof buildSteeringAgenda, "function");
assert.equal(typeof buildWhatIfRecoveryPlan, "function");
assert.equal(typeof buildDecisionClosureItems, "function");
assert.equal(typeof detectStatusDelta, "function");
assert.equal(typeof evaluateStatusQuality, "function");
assert.equal(typeof extractDecisionRadar, "function");
assert.equal(typeof mapDataverseError, "function");

console.log("statusbericht tests passed");
