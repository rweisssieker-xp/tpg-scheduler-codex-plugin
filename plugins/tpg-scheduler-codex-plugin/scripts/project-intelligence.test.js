const assert = require("node:assert/strict");
const {
  buildAuditEntry,
  buildAudienceReport,
  buildAutonomousPmoWatchtower,
  buildCalibrationReport,
  buildCommitmentTracker,
  buildCrossProjectDependencyIntelligence,
  buildDataCompletenessScore,
  buildDecisionDebtAnalysis,
  buildDecisionOptionScoring,
  buildDecisionSlaCockpit,
  buildDecisionClosureItems,
  buildAiEscalationPack,
  buildEscalationReadinessScore,
  buildEvidenceGapDetector,
  buildExecutiveQuestionGenerator,
  buildExecutiveOnePager,
  buildExecutiveMemoryTimeline,
  buildExportBundle,
  buildGovernanceExceptions,
  buildGovernanceReplay,
  buildHumanConfirmationAnalytics,
  buildLiveDynamicsRunPlan,
  buildManagementActionExportRows,
  buildMeetingCaptureDrafts,
  buildMeetingToDynamicsPlan,
  buildNudgeDrafts,
  buildPmoConfig,
  buildPortfolioNarrativeDiff,
  buildRecoveryOptionGenerator,
  buildProjectManagerCoach,
  buildProjectManagerQualityCoach,
  buildProjectIntelligence,
  buildProjectNudges,
  buildProjectSafetyGate,
  buildProjectSafetyGateSuite,
  buildPortfolioRiskList,
  buildProjectTruthScore,
  buildPmoPolicySimulator,
  buildPmoControlTower,
  buildPmoProjectControls,
  buildPortfolioConstraintRadar,
  buildNoSurpriseForecast,
  buildReportQualityBenchmark,
  buildRiskNarrativeDrift,
  buildRiskForecastTwin,
  buildRiskLedgerEntries,
  buildRiskTrendIntelligence,
  buildRoleBasedNarrativeEngine,
  buildSafeWritebackSimulation,
  buildSafeWritebackSimulationPro,
  buildSponsorActionIntelligence,
  buildSteeringAgenda,
  buildTrustContract,
  buildWhatIfRecoveryPlan,
  detectStatusDelta,
  extractDecisionRadar,
  evaluateStatusQuality,
} = require("./lib/project-intelligence");

const projects = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    projectId: "2024-9999",
    name: "ERP Cutover",
    projectStatusLabel: "In Progress",
    overallKpiLabel: "Red",
    progress: 95,
    finish: "2026-05-01",
    lastStatusUpdate: "Deployment blocked by vendor decision.",
    currentStatusText: "Deployment blocked by vendor decision.",
    obstaclesAndMeasures: "Vendor interface not ready.",
    decisions: "Approve fallback interface.",
    sponsorActions: "CIO to escalate vendor.",
    budgetStatusLabel: "Over Budget",
    resourceStatusLabel: "Understaffed",
    dependencyStatusLabel: "Blocked",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    projectId: "2024-1000",
    name: "CRM Rollout",
    projectStatusLabel: "In Progress",
    overallKpiLabel: "Green",
    progress: 40,
    finish: "2026-06-30",
    lastStatusUpdate: "Workshops completed.",
    currentStatusText: "Workshops completed.",
    plannedActivities: "Pilot next week.",
  },
];

assert.deepEqual(
  detectStatusDelta(projects[1], { proposedStatusText: "Workshops completed.", today: "2026-05-13" }),
  {
    changeType: "unchanged",
    recommendedInput: "kv_allowed",
    reasons: ["Proposed status matches the last status update."],
    evidence: [
      {
        code: "status_unchanged",
        field: "lastStatusUpdate",
        value: "Workshops completed.",
        message: "Proposed status matches the last status update.",
        source: {
          projectId: "2024-1000",
          recordUrl: null,
          field: "lastStatusUpdate",
          value: "Workshops completed.",
          observedAt: "2026-05-13",
        },
      },
    ],
  }
);

assert.deepEqual(
  detectStatusDelta(projects[0], { proposedStatusText: "Vendor delay blocks cutover.", today: "2026-05-13" }),
  {
    changeType: "changed",
    recommendedInput: "decision",
    reasons: [
      "Proposed status differs from the last status update.",
      "Overall KPI is Red.",
      "Decision text is present.",
      "Obstacle text is present.",
    ],
    evidence: [
      {
        code: "status_changed",
        field: "lastStatusUpdate",
        value: "Deployment blocked by vendor decision.",
        message: "Proposed status differs from the last status update.",
        source: {
          projectId: "2024-9999",
          recordUrl: null,
          field: "lastStatusUpdate",
          value: "Deployment blocked by vendor decision.",
          observedAt: "2026-05-13",
        },
      },
      {
        code: "red_kpi",
        field: "overallKpiLabel",
        value: "Red",
        message: "Overall KPI is Red.",
        source: {
          projectId: "2024-9999",
          recordUrl: null,
          field: "overallKpiLabel",
          value: "Red",
          observedAt: "2026-05-13",
        },
      },
      {
        code: "decision_present",
        field: "decisions",
        value: "Approve fallback interface.",
        message: "Decision text is present.",
        source: {
          projectId: "2024-9999",
          recordUrl: null,
          field: "decisions",
          value: "Approve fallback interface.",
          observedAt: "2026-05-13",
        },
      },
      {
        code: "obstacle_present",
        field: "obstaclesAndMeasures",
        value: "Vendor interface not ready.",
        message: "Obstacle text is present.",
        source: {
          projectId: "2024-9999",
          recordUrl: null,
          field: "obstaclesAndMeasures",
          value: "Vendor interface not ready.",
          observedAt: "2026-05-13",
        },
      },
    ],
  }
);

assert.equal(
  detectStatusDelta(projects[0], { proposedStatusText: "Deployment blocked by vendor decision." }).recommendedInput,
  "kv_blocked"
);

assert.equal(evaluateStatusQuality(projects[0], { today: "2026-05-13" }).severity, "critical");
assert.match(evaluateStatusQuality(projects[0], { today: "2026-05-13" }).warnings.join(" "), /Red KPI/);
assert.deepEqual(
  evaluateStatusQuality(projects[0], { today: "2026-05-13" }).evidence.map((item) => item.code),
  ["red_kpi", "overdue_finish", "high_progress_not_closed", "budget_overrun", "resource_risk", "dependency_blocked"]
);
assert.equal(evaluateStatusQuality(projects[1], { today: "2026-05-13" }).severity, "ok");

assert.deepEqual(
  buildPortfolioRiskList(projects, { today: "2026-05-13" }).map((item) => ({
    projectId: item.projectId,
    riskLevel: item.riskLevel,
    score: item.score,
  })),
  [{ projectId: "2024-9999", riskLevel: "critical", score: 100 }]
);

assert.deepEqual(extractDecisionRadar(projects).map((item) => item.projectId), ["2024-9999"]);
assert.match(extractDecisionRadar(projects)[0].managementAsk, /Approve fallback interface/);
assert.deepEqual(buildSteeringAgenda(projects, { today: "2026-05-13" })[0], {
  projectId: "2024-9999",
  name: "ERP Cutover",
  priority: "critical",
  agendaItem: "Approve fallback interface.",
  owner: "CIO",
  dueDate: "2026-05-13",
  reasonCodes: ["red_kpi", "overdue_finish", "high_progress_not_closed", "budget_overrun", "resource_risk", "dependency_blocked"],
  recordUrl: null,
});
assert.deepEqual(buildDecisionClosureItems(projects, { today: "2026-05-13" })[0], {
  id: "2024-9999::decision::Approve fallback interface.",
  projectId: "2024-9999",
  name: "ERP Cutover",
  decision: "Approve fallback interface.",
  owner: "CIO",
  dueDate: "2026-05-13",
  status: "open",
  blockedProject: true,
  evidenceCodes: ["red_kpi", "overdue_finish", "high_progress_not_closed", "budget_overrun", "resource_risk", "dependency_blocked"],
  trackingState: {
    closureStatus: "open",
    lastReviewedAt: "2026-05-13",
    nextReviewAt: "2026-05-20",
  },
  sla: {
    status: "due_today",
    daysUntilDue: 0,
    escalationLevel: 1,
  },
  recordUrl: null,
});

assert.deepEqual(buildProjectNudges(projects, { today: "2026-05-13" })[0], {
  projectId: "2024-9999",
  name: "ERP Cutover",
  priority: "high",
  prompt: "Bitte echten Status mit Risiko, Maßnahme und Management-Entscheidung erfassen; kv ist hier nicht belastbar.",
});

assert.deepEqual(
  buildAuditEntry({
    project: projects[0],
    action: "proposed",
    proposedStatusText: "Vendor delay blocks cutover.",
    outcome: "not_saved",
    actor: "Codex",
    at: "2026-05-13T19:00:00.000Z",
  }),
  {
    at: "2026-05-13T19:00:00.000Z",
    actor: "Codex",
    action: "proposed",
    outcome: "not_saved",
    projectId: "2024-9999",
    name: "ERP Cutover",
    proposedStatusText: "Vendor delay blocks cutover.",
    requiresExplicitSaveConfirmation: true,
  }
);

const report = buildExecutiveOnePager(projects, { today: "2026-05-13", audience: "CEO/CIO" });
assert.match(report, /# Project Portfolio One-Pager/);
assert.match(report, /ERP Cutover/);
assert.match(report, /Approve fallback interface/);

const intelligence = buildProjectIntelligence(projects, { today: "2026-05-13" });
assert.equal(intelligence.preview.length, 2);
assert.equal(intelligence.portfolioRisks.length, 1);
assert.equal(intelligence.decisionRadar.length, 1);
assert.equal(intelligence.steeringAgenda.length, 1);
assert.equal(intelligence.decisionClosureItems.length, 1);
assert.equal(intelligence.nudges.length, 1);
assert.deepEqual(buildPmoConfig({ progressAlmostDoneThreshold: 80 }).progressAlmostDoneThreshold, 80);
assert.deepEqual(
  evaluateStatusQuality(projects[0], { today: "2026-05-13" }).evidence.find((item) => item.code === "red_kpi").source,
  {
    projectId: "2024-9999",
    recordUrl: null,
    field: "overallKpiLabel",
    value: "Red",
    observedAt: "2026-05-13",
  }
);
assert.deepEqual(
  buildRiskLedgerEntries(projects, { today: "2026-05-13" }).map((item) => ({
    id: item.id,
    status: item.status,
    evidenceCode: item.evidenceCode,
  })),
  [
    { id: "2024-9999::red_kpi::2026-05-13", status: "open", evidenceCode: "red_kpi" },
    { id: "2024-9999::overdue_finish::2026-05-13", status: "open", evidenceCode: "overdue_finish" },
    { id: "2024-9999::high_progress_not_closed::2026-05-13", status: "open", evidenceCode: "high_progress_not_closed" },
    { id: "2024-9999::budget_overrun::2026-05-13", status: "open", evidenceCode: "budget_overrun" },
    { id: "2024-9999::resource_risk::2026-05-13", status: "open", evidenceCode: "resource_risk" },
    { id: "2024-9999::dependency_blocked::2026-05-13", status: "open", evidenceCode: "dependency_blocked" },
  ]
);
assert.deepEqual(buildDecisionClosureItems(projects, { today: "2026-05-13" })[0].trackingState, {
  closureStatus: "open",
  lastReviewedAt: "2026-05-13",
  nextReviewAt: "2026-05-20",
});
assert.deepEqual(buildManagementActionExportRows(projects, { today: "2026-05-13" })[0].type, "decision_closure");
assert.match(buildExportBundle(projects, { today: "2026-05-13" }).csv.managementActions, /decision_closure/);
assert.match(buildExportBundle(projects, { today: "2026-05-13" }).json, /riskLedger/);
assert.deepEqual(buildNudgeDrafts(projects, { today: "2026-05-13" })[0], {
  channel: "manual_review",
  toRole: "Projektleiter",
  projectId: "2024-9999",
  name: "ERP Cutover",
  subject: "Statusupdate benoetigt: ERP Cutover",
  body: "Bitte echten Status mit Risiko, Maßnahme und Management-Entscheidung erfassen; kv ist hier nicht belastbar.",
  sendAutomatically: false,
});
assert.deepEqual(
  buildCalibrationReport(projects, { today: "2026-05-13" }).summary,
  {
    projectsReviewed: 2,
    warningProjects: 0,
    criticalProjects: 1,
    missingRecordUrls: 2,
    missingLastStatus: 0,
  }
);
assert.deepEqual(buildLiveDynamicsRunPlan({ today: "2026-05-13" }).safety, {
  readOnlyUntilConfirmation: true,
  verifyProjectManager: true,
  blockAutomaticEmail: true,
  requireSaveConfirmation: true,
});
assert.equal(buildProjectIntelligence(projects, { today: "2026-05-13" }).riskLedger.length, 6);
assert.equal(buildProjectIntelligence(projects, { today: "2026-05-13" }).nudgeDrafts.length, 1);
assert.equal(buildProjectIntelligence(projects, { today: "2026-05-13" }).calibrationReport.summary.criticalProjects, 1);

assert.deepEqual(buildGovernanceExceptions(projects, { today: "2026-05-13" }).map((item) => item.ruleId), [
  "critical_project_requires_attention",
  "decision_sla_required",
]);
assert.deepEqual(
  buildDecisionClosureItems(projects, { today: "2026-05-20" })[0].sla,
  { status: "due_today", daysUntilDue: 0, escalationLevel: 1 }
);
assert.deepEqual(
  buildRiskTrendIntelligence(
    [{ id: "2024-9999::red_kpi::2026-05-06", projectId: "2024-9999", evidenceCode: "red_kpi", status: "open" }],
    buildRiskLedgerEntries(projects, { today: "2026-05-13" })
  ).summary,
  { newRisks: 5, recurringRisks: 1, resolvedRisks: 0 }
);
assert.deepEqual(buildMeetingCaptureDrafts("Decision: Approve fallback interface.\nRisk: Vendor delay.\nAction: CIO to escalate.", projects[0]), {
  projectId: "2024-9999",
  name: "ERP Cutover",
  decisions: ["Approve fallback interface."],
  risks: ["Vendor delay."],
  actions: ["CIO to escalate."],
  statusDraft: "Decision: Approve fallback interface. Risk: Vendor delay. Action: CIO to escalate.",
  requiresReview: true,
});
assert.match(
  buildPortfolioNarrativeDiff(
    { portfolioRisks: [], decisionClosureItems: [] },
    buildProjectIntelligence(projects, { today: "2026-05-13" })
  ).summary,
  /1 new portfolio risk/
);
assert.deepEqual(buildProjectManagerCoach(projects, { today: "2026-05-13" }).items[0], {
  owner: "Unassigned",
  projectsReviewed: 2,
  criticalProjects: 1,
  kvBlocked: 1,
  coachingHint: "Review critical projects and avoid unchanged status when evidence indicates risk.",
});
assert.deepEqual(buildWhatIfRecoveryPlan(projects[0], { today: "2026-05-13" }).actions.map((item) => item.actionId), [
  "kpi_recovery",
  "schedule_recovery",
  "closure_recovery",
  "budget_recovery",
  "resource_recovery",
  "dependency_recovery",
]);
assert.match(buildAudienceReport(projects, { today: "2026-05-13", audience: "ceo" }), /Decisions needed/);
assert.deepEqual(buildDataCompletenessScore({ projectId: "P1", name: "Incomplete" }).missingFields, [
  "recordUrl",
  "projectStatusLabel",
  "overallKpiLabel",
  "finish",
  "lastStatusUpdate",
]);
assert.deepEqual(
  buildSafeWritebackSimulation(projects[0], { fields: { tpg_title: "Status text" }, emailStatusUpdate: true }),
  {
    projectId: "2024-9999",
    name: "ERP Cutover",
    changes: [{ field: "tpg_title", nextValue: "Status text" }],
    blockers: ["Email Status Update is enabled."],
    confirmations: ["Confirm project, status text, target fields, and email setting before save."],
    canAutoSave: false,
  }
);

assert.deepEqual(buildAutonomousPmoWatchtower(projects, { today: "2026-05-13" }).summary, {
  exceptions: 2,
  agendaItems: 1,
  nudges: 1,
  requiresHumanReview: true,
});
assert.deepEqual(buildRiskForecastTwin(projects, { today: "2026-05-13" })[0], {
  projectId: "2024-9999",
  name: "ERP Cutover",
  forecastLevel: "critical",
  confidence: "high",
  horizonDays: 14,
  drivers: ["red_kpi", "overdue_finish", "high_progress_not_closed", "budget_overrun", "resource_risk", "dependency_blocked"],
  likelyImpact: "Escalation or missed milestone likely without recovery action.",
});
assert.deepEqual(
  buildMeetingToDynamicsPlan("Decision: Approve fallback interface.\nRisk: Vendor delay.\nAction: CIO to escalate.", projects[0]).simulation.canAutoSave,
  false
);
assert.deepEqual(
  buildExecutiveMemoryTimeline(
    { portfolioRisks: [], decisionClosureItems: [] },
    buildProjectIntelligence(projects, { today: "2026-05-13" }),
    { today: "2026-05-13" }
  ).events.map((item) => item.type),
  ["portfolio_risk_added", "decision_added"]
);
assert.deepEqual(buildDecisionSlaCockpit(projects, { today: "2026-05-20" }).summary, {
  total: 1,
  overdue: 0,
  dueToday: 1,
  upcoming: 0,
});
assert.deepEqual(buildProjectManagerQualityCoach(projects, { today: "2026-05-13" }).summary, {
  owners: 1,
  projectsReviewed: 2,
  criticalProjects: 1,
  kvBlocked: 1,
});
assert.deepEqual(buildRecoveryOptionGenerator(projects, { today: "2026-05-13" }).options[0].projectId, "2024-9999");
assert.deepEqual(buildRecoveryOptionGenerator(projects, { today: "2026-05-13" }).options[0].optionCount, 6);
assert.deepEqual(buildTrustContract(projects[0], { today: "2026-05-13" }).summary, {
  evidenceItems: 6,
  completenessScore: 80,
  writeRequiresConfirmation: true,
});
assert.deepEqual(
  buildSafeWritebackSimulationPro(projects[0], { fields: { tpg_title: "Status text" }, emailStatusUpdate: false }).riskControls,
  ["dry_run_first", "explicit_save_confirmation", "email_status_update_checked", "audit_entry_required"]
);
assert.match(buildRoleBasedNarrativeEngine(projects, { today: "2026-05-13", audience: "cio" }).markdown, /CIO Risk And Decision Brief/);
assert.equal(buildProjectIntelligence(projects, { today: "2026-05-13" }).riskForecastTwin.length, 1);
assert.equal(buildProjectIntelligence(projects, { today: "2026-05-13" }).decisionSlaCockpit.summary.total, 1);
assert.deepEqual(buildDecisionDebtAnalysis(projects, { today: "2026-05-20" }).summary, {
  openDecisions: 1,
  overdueDecisions: 0,
  dueTodayDecisions: 1,
  blockedProjects: 1,
  decisionDebtScore: 45,
});
assert.deepEqual(buildProjectTruthScore(projects[0], { today: "2026-05-13" }).summary, {
  score: 25,
  level: "low_trust",
  contradictionCount: 3,
  evidenceItems: 6,
});
assert.deepEqual(buildSponsorActionIntelligence(projects, { today: "2026-05-13" }).items[0], {
  projectId: "2024-9999",
  name: "ERP Cutover",
  sponsorRole: "CIO",
  action: "CIO to escalate vendor.",
  decisionRequired: "Approve fallback interface.",
  dueDate: "2026-05-13",
  priority: "critical",
  evidenceCodes: ["red_kpi", "overdue_finish", "high_progress_not_closed", "budget_overrun", "resource_risk", "dependency_blocked"],
});
assert.deepEqual(buildNoSurpriseForecast(projects, { today: "2026-05-13" }).summary, {
  watchedProjects: 2,
  likelyToEscalate: 1,
  silentRisks: 1,
});
assert.deepEqual(buildAiEscalationPack(projects[0], { today: "2026-05-13" }).summary, {
  projectId: "2024-9999",
  name: "ERP Cutover",
  severity: "critical",
  decisionRequired: "Approve fallback interface.",
  recommendedEscalationOwner: "CIO",
});
assert.equal(buildProjectIntelligence(projects, { today: "2026-05-13" }).decisionDebtAnalysis.summary.decisionDebtScore, 45);
assert.equal(buildProjectIntelligence(projects, { today: "2026-05-13" }).aiEscalationPacks.length, 1);
assert.deepEqual(buildEvidenceGapDetector(projects, { today: "2026-05-13" }).summary, {
  projectsReviewed: 2,
  projectsWithGaps: 1,
  totalGaps: 3,
});
assert.deepEqual(buildExecutiveQuestionGenerator(projects, { today: "2026-05-13" }).items[0].questions, [
  "What decision is needed to unblock ERP Cutover?",
  "Who owns the mitigation for ERP Cutover and by when?",
  "What is the recovery date for the overdue finish milestone?",
  "Which option reduces the highest delivery risk this week?",
]);
assert.deepEqual(buildDecisionOptionScoring(projects[0], {
  options: [
    { title: "Approve fallback interface", timeGainDays: 10, riskReduction: 40, effort: 20 },
    { title: "Wait for vendor", timeGainDays: 0, riskReduction: 10, effort: 5 },
  ],
}).options.map((item) => item.score), [80, 15]);
assert.deepEqual(buildPortfolioConstraintRadar([
  { ...projects[0], vendorName: "Contoso", dependencyName: "Vendor API", ownerName: "Alex" },
  { ...projects[1], vendorName: "Contoso", dependencyName: "Vendor API", ownerName: "Alex" },
]).summary, {
  constraints: 3,
  affectedProjects: 2,
});
assert.deepEqual(buildCommitmentTracker(projects, { today: "2026-05-13" }).summary, {
  commitments: 2,
  open: 2,
});
assert.deepEqual(
  buildRiskNarrativeDrift(
    [{ projectId: "2024-9999", risks: ["Vendor interface not ready."], detectedAt: "2026-05-06" }],
    [{ projectId: "2024-9999", risks: ["Vendor API still not ready."], detectedAt: "2026-05-13" }]
  ).summary,
  { comparedProjects: 1, driftItems: 1 }
);
assert.deepEqual(buildEscalationReadinessScore(projects[0], { today: "2026-05-13" }).summary, {
  score: 80,
  level: "ready",
  missing: ["options"],
});
assert.deepEqual(
  buildGovernanceReplay(
    [{ riskLedger: [] }, buildProjectIntelligence(projects, { today: "2026-05-13" })]
  ).summary,
  { snapshots: 2, firstWarningIndex: 1, missedWarningWindows: 0 }
);
assert.deepEqual(buildPmoPolicySimulator(projects, {
  policies: [{ id: "red_requires_sponsor_action", severity: "critical" }],
  today: "2026-05-13",
}).summary, {
  policies: 1,
  violations: 0,
});
assert.deepEqual(buildCrossProjectDependencyIntelligence([
  { ...projects[0], dependencyName: "Vendor API" },
  { ...projects[1], dependencyName: "Vendor API" },
], { today: "2026-05-13" }).summary, {
  sharedDependencies: 1,
  dependenciesWithRisk: 1,
});
assert.deepEqual(buildReportQualityBenchmark(projects, { today: "2026-05-13" }).summary, {
  projectsReviewed: 2,
  averageScore: 72,
  lowestProjectId: "2024-9999",
});
assert.deepEqual(buildHumanConfirmationAnalytics([
  { outcome: "accepted" },
  { outcome: "edited" },
  { outcome: "rejected" },
  { outcome: "accepted" },
]).summary, {
  total: 4,
  accepted: 2,
  edited: 1,
  rejected: 1,
  adoptionRate: 75,
});
assert.equal(buildProjectIntelligence(projects, { today: "2026-05-13" }).evidenceGapDetector.summary.totalGaps, 3);
assert.equal(buildProjectIntelligence(projects, { today: "2026-05-13" }).executiveQuestionGenerator.items.length, 1);

const criticalSafetyGate = buildProjectSafetyGate(projects[0], {
  today: "2026-05-20",
  proposedStatusText: "Deployment blocked by vendor decision.",
  draft: { fields: { tpg_title: "Deployment blocked by vendor decision." }, emailStatusUpdate: true },
  projectManagerVerified: false,
  auditEntry: null,
});
assert.equal(new Set(criticalSafetyGate.gates.map((item) => item.domain)).size, 8);
assert.equal(criticalSafetyGate.gates.length >= 60, true);
assert.equal(criticalSafetyGate.safetyLevel, "critical");
assert.equal(criticalSafetyGate.managementAttention, "ceo");
assert.equal(criticalSafetyGate.writebackRisk, "blocked_until_confirmation");
assert.equal(criticalSafetyGate.gates.find((item) => item.checkId === "status_truth.kv_validity").evidenceCodes.includes("kv_blocked"), true);
assert.equal(criticalSafetyGate.gates.find((item) => item.checkId === "writeback.email_status_update").status, "fail");
assert.equal(criticalSafetyGate.gates.find((item) => item.checkId === "writeback.project_manager_verified").status, "fail");
assert.equal(criticalSafetyGate.gates.find((item) => item.checkId === "decision_governance.decision_sla").status, "fail");
assert.equal(criticalSafetyGate.requiredEvidence.includes("recordUrl"), true);
assert.equal(criticalSafetyGate.recommendedActions.includes("Confirm project, status text, target fields, and email setting before save."), true);

const healthySafetyGate = buildProjectSafetyGate(projects[1], { today: "2026-05-13", projectManagerVerified: true });
assert.equal(["safe", "watch"].includes(healthySafetyGate.safetyLevel), true);
assert.equal(healthySafetyGate.managementAttention === "none" || healthySafetyGate.managementAttention === "pmo", true);

const safetySuite = buildProjectSafetyGateSuite(projects, {
  today: "2026-05-20",
  proposedStatusText: "Deployment blocked by vendor decision.",
  draft: { fields: { tpg_title: "Deployment blocked by vendor decision." }, emailStatusUpdate: true },
  projectManagerVerified: false,
});
assert.equal(safetySuite.summary.projectsReviewed, 2);
assert.equal(safetySuite.summary.criticalProjects >= 1, true);
assert.equal(safetySuite.summary.ceoAttention >= 1, true);
assert.equal(safetySuite.topFindings.length > 0, true);
assert.equal(buildProjectIntelligence(projects, { today: "2026-05-13" }).projectSafetyGates.summary.projectsReviewed, 2);

const expectedPmoCheckIds = [
  "steering_readiness",
  "pmo_policy_compliance",
  "portfolio_priority_drift",
  "milestone_integrity",
  "baseline_drift",
  "risk_aging",
  "action_aging",
  "decision_aging",
  "owner_accountability",
  "due_date_accountability",
  "single_point_of_failure",
  "vendor_concentration_risk",
  "resource_contention",
  "status_quality_trend",
  "false_green",
  "false_red",
  "pm_coaching_trigger",
  "escalation_fatigue",
  "management_attention_overload",
  "governance_exception_aging",
  "audit_completeness",
  "evidence_traceability",
  "report_comparability",
  "portfolio_heatmap_consistency",
  "pmo_intervention_recommendation",
];
const pmoProjectControls = buildPmoProjectControls(
  { ...projects[0], vendorName: "Contoso", ownerName: "Alex", dependencyName: "Vendor API", priorityLabel: "Low" },
  [
    { ...projects[0], vendorName: "Contoso", ownerName: "Alex", dependencyName: "Vendor API", priorityLabel: "Low" },
    { ...projects[1], vendorName: "Contoso", ownerName: "Alex", dependencyName: "Vendor API", priorityLabel: "High" },
  ],
  {
    today: "2026-05-20",
    auditEntry: null,
    previousSnapshots: [
      { projectId: "2024-9999", finish: "2026-04-15", riskCodes: ["red_kpi"], sponsorActions: "CIO to escalate vendor.", decisions: "Approve fallback interface." },
      { projectId: "2024-9999", finish: "2026-04-25", riskCodes: ["red_kpi"], sponsorActions: "CIO to escalate vendor.", decisions: "Approve fallback interface." },
    ],
  }
);
assert.deepEqual(pmoProjectControls.checks.map((item) => item.checkId), expectedPmoCheckIds);
assert.equal(["critical", "attention"].includes(pmoProjectControls.pmoLevel), true);
assert.equal(pmoProjectControls.checks.find((item) => item.checkId === "single_point_of_failure").status, "warning");
assert.equal(pmoProjectControls.checks.find((item) => item.checkId === "portfolio_priority_drift").status, "warning");
assert.equal(pmoProjectControls.checks.find((item) => item.checkId === "pmo_intervention_recommendation").recommendation, "prepare_steering");

const pmoControlTower = buildPmoControlTower([
  { ...projects[0], vendorName: "Contoso", ownerName: "Alex", dependencyName: "Vendor API", priorityLabel: "Low" },
  { ...projects[1], vendorName: "Contoso", ownerName: "Alex", dependencyName: "Vendor API", priorityLabel: "High" },
], { today: "2026-05-20", auditEntry: null });
assert.equal(pmoControlTower.summary.projectsReviewed, 2);
assert.equal(pmoControlTower.summary.checksPerProject, 25);
assert.equal(pmoControlTower.summary.projectsNeedingPmo >= 1, true);
assert.equal(pmoControlTower.portfolioFindings.length > 0, true);
assert.equal(buildProjectIntelligence(projects, { today: "2026-05-13" }).pmoControlTower.summary.checksPerProject, 25);

console.log("project intelligence tests passed");
