"use strict";

const UNCHANGED_STATUS_TEXT =
  "Status unverändert seit letztem Bericht (keine inhaltlichen Änderungen)";
const ACTIVE_PROJECT_STATUS_LABELS = ["Created", "Planning", "In Progress"];
const DEFAULT_PMO_CONFIG = Object.freeze({
  activeProjectStatusLabels: ACTIVE_PROJECT_STATUS_LABELS,
  progressAlmostDoneThreshold: 90,
  defaultDecisionOwner: "CIO",
  defaultNudgeChannel: "manual_review",
  decisionReviewDays: 7,
  riskStatusOpen: "open",
  blockAutomaticEmail: true,
  requireSaveConfirmation: true,
  verifyProjectManager: true,
});
const PMO_REPORT_TYPES = Object.freeze([
  "portfolio_steering",
  "decision_action_aging",
  "project_health_trend",
  "risk_issue_register",
  "dependency_constraint",
  "resource_capacity",
  "milestone_baseline_drift",
  "budget_financial_risk",
  "status_quality_compliance",
  "executive_exception",
  "pmo_work_queue",
  "audit_writeback_safety",
]);
const PMO_REPORT_TITLES = Object.freeze({
  portfolio_steering: "Portfolio Steering Report",
  decision_action_aging: "Decision & Action Aging Report",
  project_health_trend: "Project Health Trend Report",
  risk_issue_register: "Risk & Issue Register Report",
  dependency_constraint: "Dependency & Constraint Report",
  resource_capacity: "Resource & Capacity Report",
  milestone_baseline_drift: "Milestone & Baseline Drift Report",
  budget_financial_risk: "Budget & Financial Risk Report",
  status_quality_compliance: "Status Quality & Compliance Report",
  executive_exception: "Executive Exception Report",
  pmo_work_queue: "PMO Work Queue Report",
  audit_writeback_safety: "Audit & Writeback Safety Report",
});
const MAXIMUM_USP_IDS = Object.freeze([
  "pmo_safety_radar",
  "executive_no_surprise_brief",
  "status_truth_audit",
  "monthly_writeback_guard",
  "decision_debt_ledger",
  "evidence_backed_pmo_reports",
  "dependency_blast_radius",
  "project_manager_readiness_score",
  "cio_cfo_risk_split",
  "audit_safe_ai_recommendation",
  "portfolio_work_queue",
  "crm_writeback_simulation",
]);
const PMO_USP_IDS = Object.freeze([
  "pmo_command_queue",
  "steering_committee_auto_pack",
  "decision_sla_enforcement",
  "risk_aging_memory",
  "pm_quality_coaching",
  "portfolio_bottleneck_detector",
  "governance_exception_radar",
  "pmo_data_quality_score",
  "executive_attention_routing",
  "baseline_drift_watch",
  "writeback_audit_shield",
  "pmo_evidence_ledger",
  "no_surprise_portfolio_forecast",
  "dependency_blast_radius",
  "pmo_board_pack_diff",
]);

function buildPmoConfig(overrides = {}) {
  return { ...DEFAULT_PMO_CONFIG, ...overrides };
}

function parseDateOnly(value) {
  if (!value) {
    return null;
  }
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return null;
  }
  return new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`);
}

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function addDays(dateText, days) {
  const base = parseDateOnly(dateText);
  if (!base) {
    return null;
  }
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function buildEvidenceSource(project, field, value, options = {}) {
  return {
    projectId: project?.projectId || null,
    recordUrl: project?.recordUrl || null,
    field,
    value,
    observedAt: options.today || new Date().toISOString().slice(0, 10),
  };
}

function evidence(code, field, value, message, project, options) {
  return { code, field, value, message, source: buildEvidenceSource(project, field, value, options) };
}

function isActiveProjectCandidate(project) {
  if (!project) {
    return false;
  }
  if (!project.projectStatusLabel) {
    return true;
  }
  return ACTIVE_PROJECT_STATUS_LABELS.includes(project.projectStatusLabel);
}

function detectStatusDelta(project, options = {}) {
  const lastStatus = normalizeText(project?.lastStatusUpdate);
  const proposedStatus = normalizeText(options.proposedStatusText ?? project?.currentStatusText);
  const reasons = [];
  const evidenceItems = [];

  if (!lastStatus && !proposedStatus) {
    return {
      changeType: "missing",
      recommendedInput: "real_status",
      reasons: ["No last or proposed status is available."],
      evidence: [evidence("status_missing", "lastStatusUpdate", project?.lastStatusUpdate || null, "No last or proposed status is available.", project, options)],
    };
  }

  if (lastStatus && proposedStatus && lastStatus.toLowerCase() === proposedStatus.toLowerCase()) {
    reasons.push("Proposed status matches the last status update.");
    evidenceItems.push(evidence("status_unchanged", "lastStatusUpdate", project?.lastStatusUpdate, "Proposed status matches the last status update.", project, options));
    if (project?.overallKpiLabel === "Red" || project?.obstaclesAndMeasures || project?.decisions) {
      if (project?.overallKpiLabel === "Red") {
        reasons.push("Overall KPI is Red.");
        evidenceItems.push(evidence("red_kpi", "overallKpiLabel", project.overallKpiLabel, "Overall KPI is Red.", project, options));
      }
      if (project?.decisions) {
        reasons.push("Decision text is present.");
        evidenceItems.push(evidence("decision_present", "decisions", project.decisions, "Decision text is present.", project, options));
      }
      if (project?.obstaclesAndMeasures) {
        reasons.push("Obstacle text is present.");
        evidenceItems.push(evidence("obstacle_present", "obstaclesAndMeasures", project.obstaclesAndMeasures, "Obstacle text is present.", project, options));
      }
      return {
        changeType: "unchanged",
        recommendedInput: "kv_blocked",
        reasons,
        evidence: evidenceItems,
      };
    }
    return {
      changeType: "unchanged",
      recommendedInput: "kv_allowed",
      reasons,
      evidence: evidenceItems,
    };
  }

  if (!lastStatus) {
    reasons.push("No last status update is available.");
    evidenceItems.push(evidence("status_missing", "lastStatusUpdate", project?.lastStatusUpdate || null, "No last status update is available.", project, options));
  } else if (!proposedStatus) {
    reasons.push("No proposed status is available.");
    evidenceItems.push(evidence("proposed_status_missing", "currentStatusText", project?.currentStatusText || null, "No proposed status is available.", project, options));
  } else {
    reasons.push("Proposed status differs from the last status update.");
    evidenceItems.push(evidence("status_changed", "lastStatusUpdate", project?.lastStatusUpdate, "Proposed status differs from the last status update.", project, options));
  }

  if (project?.overallKpiLabel === "Red") {
    reasons.push("Overall KPI is Red.");
    evidenceItems.push(evidence("red_kpi", "overallKpiLabel", project.overallKpiLabel, "Overall KPI is Red.", project, options));
  }
  if (project?.decisions) {
    reasons.push("Decision text is present.");
    evidenceItems.push(evidence("decision_present", "decisions", project.decisions, "Decision text is present.", project, options));
  }
  if (project?.obstaclesAndMeasures) {
    reasons.push("Obstacle text is present.");
    evidenceItems.push(evidence("obstacle_present", "obstaclesAndMeasures", project.obstaclesAndMeasures, "Obstacle text is present.", project, options));
  }

  return {
    changeType: "changed",
    recommendedInput: project?.decisions ? "decision" : project?.obstaclesAndMeasures ? "risk" : "real_status",
    reasons,
    evidence: evidenceItems,
  };
}

function evaluateStatusQuality(project, options = {}) {
  const config = buildPmoConfig(options.config || {});
  const warnings = [];
  const evidenceItems = [];
  let score = 100;
  const today = parseDateOnly(options.today || new Date().toISOString().slice(0, 10));
  const finish = parseDateOnly(project?.finish);
  const progress = Number(project?.progress);
  const kpi = project?.overallKpiLabel || "";

  if (!project?.lastStatusUpdate && !project?.currentStatusText) {
    warnings.push("No status text is available.");
    evidenceItems.push(evidence("stale_status", "lastStatusUpdate", project?.lastStatusUpdate || null, "No status text is available.", project, options));
    score -= 25;
  }
  if (kpi === "Red") {
    warnings.push("Red KPI requires risk, mitigation, and management attention.");
    evidenceItems.push(evidence("red_kpi", "overallKpiLabel", kpi, "Red KPI requires risk, mitigation, and management attention.", project, options));
    score -= 35;
    if (!project?.obstaclesAndMeasures) {
      warnings.push("Red KPI has no obstacle or mitigation text.");
      evidenceItems.push(evidence("missing_mitigation", "obstaclesAndMeasures", project?.obstaclesAndMeasures || null, "Red KPI has no obstacle or mitigation text.", project, options));
      score -= 15;
    }
  } else if (kpi === "Yellow") {
    warnings.push("Yellow KPI should explain the watch item.");
    evidenceItems.push(evidence("yellow_kpi", "overallKpiLabel", kpi, "Yellow KPI should explain the watch item.", project, options));
    score -= 20;
  }
  if (finish && today && finish < today) {
    warnings.push("Finish date is in the past.");
    evidenceItems.push(evidence("overdue_finish", "finish", project.finish, "Finish date is in the past.", project, options));
    score -= 25;
  }
  if (Number.isFinite(progress) && progress >= config.progressAlmostDoneThreshold && project?.projectStatusLabel === "In Progress") {
    warnings.push(`Progress is ${progress}% but the project is still In Progress.`);
    evidenceItems.push(evidence("high_progress_not_closed", "progress", project.progress, `Progress is ${progress}% but the project is still In Progress.`, project, options));
    score -= 15;
  }
  if (project?.obstaclesAndMeasures && !project?.plannedActivities && !project?.sponsorActions) {
    warnings.push("Obstacle text exists but no next step or sponsor action is captured.");
    evidenceItems.push(evidence("missing_next_step", "plannedActivities", project?.plannedActivities || null, "Obstacle text exists but no next step or sponsor action is captured.", project, options));
    score -= 10;
  }
  if (project?.budgetStatusLabel === "Over Budget") {
    warnings.push("Budget status is Over Budget.");
    evidenceItems.push(evidence("budget_overrun", "budgetStatusLabel", project.budgetStatusLabel, "Budget status is Over Budget.", project, options));
    score -= 15;
  }
  if (project?.resourceStatusLabel === "Understaffed") {
    warnings.push("Resource status is Understaffed.");
    evidenceItems.push(evidence("resource_risk", "resourceStatusLabel", project.resourceStatusLabel, "Resource status is Understaffed.", project, options));
    score -= 10;
  }
  if (project?.dependencyStatusLabel === "Blocked") {
    warnings.push("Dependency status is Blocked.");
    evidenceItems.push(evidence("dependency_blocked", "dependencyStatusLabel", project.dependencyStatusLabel, "Dependency status is Blocked.", project, options));
    score -= 10;
  }

  const normalizedScore = Math.max(0, score);
  const severity = normalizedScore < 50 ? "critical" : warnings.length ? "warning" : "ok";
  return {
    score: normalizedScore,
    severity,
    recommendedAction: severity === "ok" ? "collect_status" : "needs_attention",
    warnings,
    evidence: evidenceItems,
  };
}

function buildBatchProjectPreview(projects, options = {}) {
  const severityRank = { critical: 0, warning: 1, ok: 2 };
  return (projects || [])
    .filter(isActiveProjectCandidate)
    .map((project) => ({
      id: project.id || null,
      projectId: project.projectId || null,
      projectNumber: project.projectNumber ?? null,
      name: project.name || null,
      recordUrl: project.recordUrl || null,
      projectStatusLabel: project.projectStatusLabel || null,
      overallKpiLabel: project.overallKpiLabel || null,
      progress: project.progress ?? null,
      finish: project.finish || null,
      lastStatusUpdate: project.lastStatusUpdate || null,
      quality: evaluateStatusQuality(project, options),
      delta: detectStatusDelta(project, options),
    }))
    .sort((left, right) => {
      const severityDelta = severityRank[left.quality.severity] - severityRank[right.quality.severity];
      if (severityDelta !== 0) {
        return severityDelta;
      }
      return left.quality.score - right.quality.score;
    });
}

function buildPortfolioRiskList(projects, options = {}) {
  return buildBatchProjectPreview(projects, options)
    .filter((item) => item.quality.severity !== "ok")
    .map((item) => {
      const score = Math.min(100, 100 - item.quality.score + item.quality.warnings.length * 10);
      return {
        projectId: item.projectId,
        name: item.name,
        riskLevel: item.quality.severity,
      score,
      reasons: item.quality.warnings,
      evidence: item.quality.evidence,
      recordUrl: item.recordUrl,
    };
    })
    .sort((left, right) => right.score - left.score);
}

function extractDecisionRadar(projects) {
  return (projects || [])
    .filter((project) => project?.decisions || project?.sponsorActions || project?.obstaclesAndMeasures)
    .map((project) => ({
      projectId: project.projectId || null,
      name: project.name || null,
      managementAsk: project.decisions || project.sponsorActions || project.obstaclesAndMeasures,
      decisions: project.decisions || "",
      sponsorActions: project.sponsorActions || "",
      obstaclesAndMeasures: project.obstaclesAndMeasures || "",
      recordUrl: project.recordUrl || null,
    }));
}

function inferDecisionOwner(project) {
  if (project?.decisionOwner) {
    return project.decisionOwner;
  }
  if (project?.sponsorActions || project?.overallKpiLabel === "Red") {
    return "CIO";
  }
  return project?.ownerName || "PMO";
}

function buildSteeringAgenda(projects, options = {}) {
  const config = buildPmoConfig(options.config || {});
  const today = options.today || new Date().toISOString().slice(0, 10);
  const qualityByProjectId = new Map(buildBatchProjectPreview(projects, options).map((item) => [item.projectId, item.quality]));
  return extractDecisionRadar(projects).map((item) => {
    const sourceProject = (projects || []).find((project) => project.projectId === item.projectId) || {};
    const quality = qualityByProjectId.get(item.projectId) || evaluateStatusQuality(sourceProject, options);
    return {
      projectId: item.projectId,
      name: item.name,
      priority: quality.severity,
      agendaItem: item.managementAsk,
      owner: inferDecisionOwner(sourceProject) || config.defaultDecisionOwner,
      dueDate: sourceProject.decisionDueDate || today,
      reasonCodes: quality.evidence.map((evidenceItem) => evidenceItem.code),
      recordUrl: item.recordUrl,
    };
  });
}

function buildDecisionClosureItems(projects, options = {}) {
  const config = buildPmoConfig(options.config || {});
  const today = options.today || new Date().toISOString().slice(0, 10);
  return buildSteeringAgenda(projects, options).map((item) => {
    const dueDate = parseDateOnly(item.dueDate);
    const todayDate = parseDateOnly(today);
    const daysUntilDue = dueDate && todayDate ? Math.round((dueDate - todayDate) / 86400000) : null;
    const slaStatus = daysUntilDue === null ? "unknown" : daysUntilDue < 0 ? "overdue" : daysUntilDue === 0 ? "due_today" : "open";
    return ({
    id: `${item.projectId}::decision::${item.agendaItem}`,
    projectId: item.projectId,
    name: item.name,
    decision: item.agendaItem,
    owner: item.owner,
    dueDate: item.dueDate,
    status: "open",
    blockedProject: item.priority === "critical",
    evidenceCodes: item.reasonCodes,
    trackingState: {
      closureStatus: "open",
      lastReviewedAt: today,
      nextReviewAt: addDays(today, config.decisionReviewDays),
    },
    sla: {
      status: slaStatus,
      daysUntilDue,
      escalationLevel: slaStatus === "overdue" ? 2 : slaStatus === "due_today" ? 1 : 0,
    },
    recordUrl: item.recordUrl,
    });
  });
}

function buildRiskLedgerEntries(projects, options = {}) {
  const today = options.today || new Date().toISOString().slice(0, 10);
  return buildBatchProjectPreview(projects, options).flatMap((item) =>
    item.quality.evidence.map((evidenceItem) => ({
      id: `${item.projectId}::${evidenceItem.code}::${today}`,
      projectId: item.projectId,
      name: item.name,
      status: "open",
      detectedAt: today,
      lastSeenAt: today,
      evidenceCode: evidenceItem.code,
      field: evidenceItem.field,
      value: evidenceItem.value,
      message: evidenceItem.message,
      recordUrl: item.recordUrl,
      source: evidenceItem.source,
    }))
  );
}

function buildProjectNudges(projects, options = {}) {
  return buildBatchProjectPreview(projects, options)
    .filter((item) => item.quality.severity !== "ok")
    .map((item) => ({
      projectId: item.projectId,
      name: item.name,
      priority: item.quality.severity === "critical" ? "high" : "medium",
      prompt:
        item.quality.severity === "critical"
          ? "Bitte echten Status mit Risiko, Maßnahme und Management-Entscheidung erfassen; kv ist hier nicht belastbar."
          : "Bitte Status konkretisieren; mindestens Änderung, nächster Schritt oder Begründung für kv ergänzen.",
    }));
}

function buildNudgeDrafts(projects, options = {}) {
  const config = buildPmoConfig(options.config || {});
  return buildProjectNudges(projects, options).map((nudge) => ({
    channel: config.defaultNudgeChannel,
    toRole: "Projektleiter",
    projectId: nudge.projectId,
    name: nudge.name,
    subject: `Statusupdate benoetigt: ${nudge.name}`,
    body: nudge.prompt,
    sendAutomatically: false,
  }));
}

function buildAuditEntry(input = {}) {
  const project = input.project || {};
  return {
    at: input.at || new Date().toISOString(),
    actor: input.actor || "Codex",
    action: input.action || "unknown",
    outcome: input.outcome || "unknown",
    projectId: project.projectId || null,
    name: project.name || null,
    proposedStatusText: input.proposedStatusText || "",
    requiresExplicitSaveConfirmation: true,
  };
}

function buildExecutiveOnePager(projects, options = {}) {
  const today = options.today || new Date().toISOString().slice(0, 10);
  const audience = options.audience || "Executive";
  const risks = buildPortfolioRiskList(projects, options);
  const decisions = extractDecisionRadar(projects);
  const preview = buildBatchProjectPreview(projects, options);
  const okCount = preview.filter((item) => item.quality.severity === "ok").length;

  const lines = [
    "# Project Portfolio One-Pager",
    "",
    `Audience: ${audience}`,
    `Date: ${today}`,
    "",
    "## Portfolio Health",
    "",
    `- Projects reviewed: ${preview.length}`,
    `- Projects OK: ${okCount}`,
    `- Projects needing attention: ${risks.length}`,
    "",
    "## Top Risks",
    "",
  ];

  if (!risks.length) {
    lines.push("- No critical portfolio risks detected.");
  } else {
    for (const risk of risks.slice(0, 10)) {
      lines.push(`- ${risk.name} (${risk.projectId}): ${risk.reasons.join(" ")}`);
    }
  }

  lines.push("", "## Decisions And Sponsor Actions", "");
  if (!decisions.length) {
    lines.push("- No open decisions or sponsor actions detected.");
  } else {
    for (const item of decisions.slice(0, 10)) {
      lines.push(`- ${item.name} (${item.projectId}): ${item.managementAsk}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(rows, columns) {
  return [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(",")),
  ].join("\n");
}

function buildManagementActionExportRows(projects, options = {}) {
  return buildDecisionClosureItems(projects, options).map((item) => ({
    type: "decision_closure",
    projectId: item.projectId,
    name: item.name,
    owner: item.owner,
    dueDate: item.dueDate,
    status: item.status,
    action: item.decision,
    evidenceCodes: item.evidenceCodes.join("|"),
    recordUrl: item.recordUrl || "",
  }));
}

function buildExportBundle(projects, options = {}) {
  const intelligence = buildProjectIntelligence(projects, { ...options, includeExports: false });
  const managementActions = buildManagementActionExportRows(projects, options);
  const riskLedger = buildRiskLedgerEntries(projects, options);
  return {
    schemaVersion: "1.0",
    json: JSON.stringify({ ...intelligence, riskLedger, managementActions }, null, 2),
    csv: {
      managementActions: toCsv(managementActions, ["type", "projectId", "name", "owner", "dueDate", "status", "action", "evidenceCodes", "recordUrl"]),
      riskLedger: toCsv(riskLedger, ["id", "projectId", "name", "status", "detectedAt", "evidenceCode", "field", "value", "recordUrl"]),
    },
  };
}

function buildCalibrationReport(projects, options = {}) {
  const preview = buildBatchProjectPreview(projects, options);
  const warningProjects = preview.filter((item) => item.quality.severity === "warning").length;
  const criticalProjects = preview.filter((item) => item.quality.severity === "critical").length;
  return {
    summary: {
      projectsReviewed: preview.length,
      warningProjects,
      criticalProjects,
      missingRecordUrls: preview.filter((item) => !item.recordUrl).length,
      missingLastStatus: preview.filter((item) => !item.lastStatusUpdate).length,
    },
    ruleHits: Object.fromEntries(
      buildRiskLedgerEntries(projects, options).reduce((map, item) => {
        map.set(item.evidenceCode, (map.get(item.evidenceCode) || 0) + 1);
        return map;
      }, new Map())
    ),
  };
}

function buildLiveDynamicsRunPlan(options = {}) {
  const today = options.today || new Date().toISOString().slice(0, 10);
  return {
    today,
    steps: [
      "Open configured Dynamics project view.",
      "Read active project candidates via Dataverse when authenticated.",
      "Open each candidate record and verify Project Manager.",
      "Build project intelligence preview with evidence links.",
      "Collect one status input per verified project.",
      "Stage Quick Create status update only after explicit confirmation.",
      "Record audit, risk ledger, and decision closure outputs.",
    ],
    safety: {
      readOnlyUntilConfirmation: true,
      verifyProjectManager: true,
      blockAutomaticEmail: true,
      requireSaveConfirmation: true,
    },
  };
}

function buildGovernanceExceptions(projects, options = {}) {
  const exceptions = [];
  for (const risk of buildPortfolioRiskList(projects, options)) {
    if (risk.riskLevel === "critical") {
      exceptions.push({
        ruleId: "critical_project_requires_attention",
        severity: "critical",
        projectId: risk.projectId,
        name: risk.name,
        evidenceCodes: risk.evidence.map((item) => item.code),
        owner: "PMO",
      });
    }
  }
  for (const item of buildDecisionClosureItems(projects, options)) {
    exceptions.push({
      ruleId: "decision_sla_required",
      severity: item.sla.status === "overdue" ? "critical" : "warning",
      projectId: item.projectId,
      name: item.name,
      evidenceCodes: item.evidenceCodes,
      owner: item.owner,
    });
  }
  return exceptions;
}

function buildRiskTrendIntelligence(previousLedger = [], currentLedger = []) {
  const previousKeys = new Set(previousLedger.map((item) => `${item.projectId}::${item.evidenceCode}`));
  const currentKeys = new Set(currentLedger.map((item) => `${item.projectId}::${item.evidenceCode}`));
  const newRisks = [...currentKeys].filter((key) => !previousKeys.has(key));
  const recurringRisks = [...currentKeys].filter((key) => previousKeys.has(key));
  const resolvedRisks = [...previousKeys].filter((key) => !currentKeys.has(key));
  return {
    summary: {
      newRisks: newRisks.length,
      recurringRisks: recurringRisks.length,
      resolvedRisks: resolvedRisks.length,
    },
    newRisks,
    recurringRisks,
    resolvedRisks,
  };
}

function extractMeetingLines(text, label) {
  const pattern = new RegExp(`^${label}:\\s*(.+)$`, "gim");
  return [...String(text || "").matchAll(pattern)].map((match) => match[1].trim());
}

function buildMeetingCaptureDrafts(meetingText, project = {}) {
  const decisions = extractMeetingLines(meetingText, "Decision");
  const risks = extractMeetingLines(meetingText, "Risk");
  const actions = extractMeetingLines(meetingText, "Action");
  return {
    projectId: project.projectId || null,
    name: project.name || null,
    decisions,
    risks,
    actions,
    statusDraft: [
      decisions.length ? `Decision: ${decisions.join(" ")}` : "",
      risks.length ? `Risk: ${risks.join(" ")}` : "",
      actions.length ? `Action: ${actions.join(" ")}` : "",
    ].filter(Boolean).join(" "),
    requiresReview: true,
  };
}

function buildPortfolioNarrativeDiff(previousIntelligence = {}, currentIntelligence = {}) {
  const previousRiskIds = new Set((previousIntelligence.portfolioRisks || []).map((item) => item.projectId));
  const currentRiskIds = new Set((currentIntelligence.portfolioRisks || []).map((item) => item.projectId));
  const newRisks = [...currentRiskIds].filter((id) => !previousRiskIds.has(id));
  const previousDecisionIds = new Set((previousIntelligence.decisionClosureItems || []).map((item) => item.id));
  const currentDecisionIds = new Set((currentIntelligence.decisionClosureItems || []).map((item) => item.id));
  const newDecisions = [...currentDecisionIds].filter((id) => !previousDecisionIds.has(id));
  return {
    summary: `${newRisks.length} new portfolio risk(s), ${newDecisions.length} new decision item(s).`,
    newRisks,
    newDecisions,
  };
}

function buildProjectManagerCoach(projects, options = {}) {
  const groups = new Map();
  for (const project of projects || []) {
    const owner = project.ownerName || "Unassigned";
    if (!groups.has(owner)) {
      groups.set(owner, { owner, projects: [] });
    }
    groups.get(owner).projects.push(project);
  }
  return {
    items: [...groups.values()].map((group) => {
      const preview = buildBatchProjectPreview(group.projects, options);
      const criticalProjects = preview.filter((item) => item.quality.severity === "critical").length;
      const kvBlocked = preview.filter((item) => item.delta.recommendedInput === "kv_blocked").length;
      return {
        owner: group.owner,
        projectsReviewed: group.projects.length,
        criticalProjects,
        kvBlocked,
        coachingHint: criticalProjects || kvBlocked
          ? "Review critical projects and avoid unchanged status when evidence indicates risk."
          : "Maintain current status quality.",
      };
    }),
  };
}

function buildWhatIfRecoveryPlan(project, options = {}) {
  const quality = evaluateStatusQuality(project, options);
  const actionByCode = {
    red_kpi: { actionId: "kpi_recovery", recommendation: "Define mitigation and owner for Red KPI." },
    overdue_finish: { actionId: "schedule_recovery", recommendation: "Rebaseline finish date or publish recovery milestone." },
    high_progress_not_closed: { actionId: "closure_recovery", recommendation: "List remaining closure tasks and blockers." },
    budget_overrun: { actionId: "budget_recovery", recommendation: "Confirm budget delta and funding decision." },
    resource_risk: { actionId: "resource_recovery", recommendation: "Assign missing capacity or reduce scope." },
    dependency_blocked: { actionId: "dependency_recovery", recommendation: "Escalate blocked dependency with due date." },
  };
  return {
    projectId: project?.projectId || null,
    name: project?.name || null,
    actions: quality.evidence.map((item) => actionByCode[item.code]).filter(Boolean),
  };
}

function buildAudienceReport(projects, options = {}) {
  const audience = options.audience || "pm";
  const intelligence = buildProjectIntelligence(projects, { ...options, includeExports: false });
  if (audience === "ceo") {
    return [
      "# CEO Portfolio Brief",
      `Projects needing attention: ${intelligence.portfolioRisks.length}`,
      `Decisions needed: ${intelligence.decisionClosureItems.length}`,
    ].join("\n");
  }
  if (audience === "cio") {
    return [
      "# CIO Risk And Decision Brief",
      `Critical risks: ${intelligence.portfolioRisks.filter((item) => item.riskLevel === "critical").length}`,
      `Open decision items: ${intelligence.decisionClosureItems.length}`,
    ].join("\n");
  }
  return formatProjectQueue(intelligence.preview);
}

function formatProjectQueue(preview) {
  return preview.map((item) => `${item.name}: ${item.quality.recommendedAction}`).join("\n");
}

function buildDataCompletenessScore(project = {}) {
  const requiredFields = ["recordUrl", "projectStatusLabel", "overallKpiLabel", "finish", "lastStatusUpdate"];
  const missingFields = requiredFields.filter((field) => !project[field]);
  return {
    projectId: project.projectId || null,
    name: project.name || null,
    score: Math.max(0, 100 - missingFields.length * 20),
    missingFields,
  };
}

function buildSafeWritebackSimulation(project = {}, draft = {}) {
  const changes = Object.entries(draft.fields || {}).map(([field, nextValue]) => ({ field, nextValue }));
  const blockers = [];
  if (draft.emailStatusUpdate) {
    blockers.push("Email Status Update is enabled.");
  }
  if (!changes.length) {
    blockers.push("No target fields are populated.");
  }
  return {
    projectId: project.projectId || null,
    name: project.name || null,
    changes,
    blockers,
    confirmations: ["Confirm project, status text, target fields, and email setting before save."],
    canAutoSave: false,
  };
}

function buildAutonomousPmoWatchtower(projects, options = {}) {
  const exceptions = buildGovernanceExceptions(projects, options);
  const agenda = buildSteeringAgenda(projects, options);
  const nudges = buildProjectNudges(projects, options);
  return {
    summary: {
      exceptions: exceptions.length,
      agendaItems: agenda.length,
      nudges: nudges.length,
      requiresHumanReview: Boolean(exceptions.length || agenda.length || nudges.length),
    },
    exceptions,
    agenda,
    nudges,
    automationMode: "advisory_only",
  };
}

function buildRiskForecastTwin(projects, options = {}) {
  const horizonDays = options.horizonDays || 14;
  return buildPortfolioRiskList(projects, options).map((risk) => {
    const drivers = risk.evidence.map((item) => item.code);
    const confidence = drivers.length >= 3 ? "high" : "medium";
    return {
      projectId: risk.projectId,
      name: risk.name,
      forecastLevel: risk.riskLevel,
      confidence,
      horizonDays,
      drivers,
      likelyImpact: risk.riskLevel === "critical"
        ? "Escalation or missed milestone likely without recovery action."
        : "Management attention recommended before the next status cycle.",
    };
  });
}

function buildMeetingToDynamicsPlan(meetingText, project = {}, options = {}) {
  const draft = buildMeetingCaptureDrafts(meetingText, project);
  const simulation = buildSafeWritebackSimulation(project, {
    fields: {
      tpg_statussummary: draft.statusDraft,
      tpg_decisions: draft.decisions.join("\n"),
      tpg_obstaclesandmeasures: draft.risks.join("\n"),
      tpg_sponsoractions: draft.actions.join("\n"),
    },
    emailStatusUpdate: Boolean(options.emailStatusUpdate),
  });
  return {
    projectId: project.projectId || null,
    name: project.name || null,
    draft,
    simulation,
    nextStep: "Review extracted fields, confirm target project, then stage manually.",
  };
}

function buildExecutiveMemoryTimeline(previousIntelligence = {}, currentIntelligence = {}, options = {}) {
  const today = options.today || new Date().toISOString().slice(0, 10);
  const diff = buildPortfolioNarrativeDiff(previousIntelligence, currentIntelligence);
  const events = [
    ...diff.newRisks.map((projectId) => ({ at: today, type: "portfolio_risk_added", projectId })),
    ...diff.newDecisions.map((id) => ({ at: today, type: "decision_added", id })),
  ];
  return {
    summary: diff.summary,
    events,
    requiresReview: events.length > 0,
  };
}

function buildDecisionSlaCockpit(projects, options = {}) {
  const items = buildDecisionClosureItems(projects, options);
  return {
    summary: {
      total: items.length,
      overdue: items.filter((item) => item.sla.status === "overdue").length,
      dueToday: items.filter((item) => item.sla.status === "due_today").length,
      upcoming: items.filter((item) => item.sla.status === "upcoming").length,
    },
    items,
  };
}

function buildProjectManagerQualityCoach(projects, options = {}) {
  const coach = buildProjectManagerCoach(projects, options);
  return {
    summary: coach.items.reduce((summary, item) => {
      summary.owners += 1;
      summary.projectsReviewed += item.projectsReviewed;
      summary.criticalProjects += item.criticalProjects;
      summary.kvBlocked += item.kvBlocked;
      return summary;
    }, { owners: 0, projectsReviewed: 0, criticalProjects: 0, kvBlocked: 0 }),
    items: coach.items.map((item) => ({
      ...item,
      recommendedIntervention: item.criticalProjects || item.kvBlocked
        ? "Run a focused status-quality review before the next steering meeting."
        : "No PMO intervention needed.",
    })),
  };
}

function buildRecoveryOptionGenerator(projects, options = {}) {
  const optionsByProject = (projects || [])
    .map((project) => {
      const plan = buildWhatIfRecoveryPlan(project, options);
      return {
        projectId: plan.projectId,
        name: plan.name,
        optionCount: plan.actions.length,
        options: plan.actions.map((action, index) => ({
          ...action,
          rank: index + 1,
          requiresDecision: /decision|funding|scope|capacity|escalate/i.test(action.recommendation),
        })),
      };
    })
    .filter((item) => item.optionCount > 0);
  return { options: optionsByProject };
}

function buildTrustContract(project = {}, options = {}) {
  const quality = evaluateStatusQuality(project, options);
  const completeness = buildDataCompletenessScore(project);
  return {
    projectId: project.projectId || null,
    name: project.name || null,
    summary: {
      evidenceItems: quality.evidence.length,
      completenessScore: completeness.score,
      writeRequiresConfirmation: true,
    },
    evidence: quality.evidence,
    missingFields: completeness.missingFields,
    safetyRules: ["human_review_required", "evidence_visible", "no_automatic_crm_save", "email_status_update_protected"],
  };
}

function buildSafeWritebackSimulationPro(project = {}, draft = {}) {
  const simulation = buildSafeWritebackSimulation(project, draft);
  return {
    ...simulation,
    riskControls: ["dry_run_first", "explicit_save_confirmation", "email_status_update_checked", "audit_entry_required"],
    auditPreview: buildAuditEntry({
      project,
      action: "writeback_simulated",
      proposedStatusText: simulation.changes.map((item) => item.nextValue).filter(Boolean).join(" "),
      outcome: "not_saved",
      actor: "Codex",
      at: draft.at,
    }),
  };
}

function buildRoleBasedNarrativeEngine(projects, options = {}) {
  const audience = options.audience || "pm";
  const risks = buildPortfolioRiskList(projects, options);
  const decisions = buildDecisionClosureItems(projects, options);
  const markdown = audience === "cio"
    ? [
      "# CIO Risk And Decision Brief",
      `Critical risks: ${risks.filter((item) => item.riskLevel === "critical").length}`,
      `Open decision items: ${decisions.length}`,
    ].join("\n")
    : buildExecutiveOnePager(projects, options);
  return {
    audience,
    markdown,
    sections: {
      watchtower: buildAutonomousPmoWatchtower(projects, options).summary,
      decisionSla: buildDecisionSlaCockpit(projects, options).summary,
      forecastCount: buildRiskForecastTwin(projects, options).length,
    },
    requiresReview: true,
  };
}

function buildDecisionDebtAnalysis(projects, options = {}) {
  const items = buildDecisionClosureItems(projects, options);
  const overdueDecisions = items.filter((item) => item.sla.status === "overdue").length;
  const dueTodayDecisions = items.filter((item) => item.sla.status === "due_today").length;
  const blockedProjects = new Set(items.filter((item) => item.blockedProject).map((item) => item.projectId)).size;
  return {
    summary: {
      openDecisions: items.length,
      overdueDecisions,
      dueTodayDecisions,
      blockedProjects,
      decisionDebtScore: Math.min(100, items.length * 30 + overdueDecisions * 25 + dueTodayDecisions * 10 + blockedProjects * 5),
    },
    items: items.map((item) => ({
      id: item.id,
      projectId: item.projectId,
      name: item.name,
      decision: item.decision,
      owner: item.owner,
      dueDate: item.dueDate,
      sla: item.sla,
      debtReason: item.blockedProject ? "Decision is attached to a blocked or critical project." : "Decision needs closure tracking.",
    })),
  };
}

function buildProjectTruthScore(project = {}, options = {}) {
  const quality = evaluateStatusQuality(project, options);
  const contradictions = quality.evidence.filter((item) => [
    "red_kpi",
    "overdue_finish",
    "high_progress_not_closed",
    "missing_mitigation",
    "missing_next_step",
    "stale_status",
  ].includes(item.code));
  const score = Math.max(0, 100 - contradictions.length * 15 - (quality.severity === "critical" ? 30 : 0));
  return {
    projectId: project.projectId || null,
    name: project.name || null,
    summary: {
      score,
      level: score < 50 ? "low_trust" : score < 75 ? "needs_review" : "trusted",
      contradictionCount: contradictions.length,
      evidenceItems: quality.evidence.length,
    },
    contradictions: contradictions.map((item) => ({
      code: item.code,
      field: item.field,
      message: item.message,
      source: item.source,
    })),
  };
}

function buildSponsorActionIntelligence(projects, options = {}) {
  const items = buildSteeringAgenda(projects, options).map((item) => {
    const project = (projects || []).find((candidate) => (candidate.projectId || candidate.id) === item.projectId) || {};
    return {
      projectId: item.projectId,
      name: item.name,
      sponsorRole: item.owner,
      action: project.sponsorActions || `Resolve management ask: ${item.agendaItem}`,
      decisionRequired: item.agendaItem,
      dueDate: item.dueDate,
      priority: item.priority,
      evidenceCodes: item.reasonCodes,
    };
  });
  return {
    summary: {
      actions: items.length,
      criticalActions: items.filter((item) => item.priority === "critical").length,
    },
    items,
  };
}

function buildNoSurpriseForecast(projects, options = {}) {
  const items = (projects || []).map((project) => {
    const quality = evaluateStatusQuality(project, options);
    const silentSignals = quality.evidence.filter((item) => [
      "missing_mitigation",
      "missing_next_step",
      "stale_status",
      "overdue_finish",
      "high_progress_not_closed",
    ].includes(item.code));
    return {
      projectId: project.projectId || project.id || null,
      name: project.name || null,
      currentKpi: project.overallKpiLabel || null,
      forecast: quality.severity === "critical" ? "likely_to_escalate" : silentSignals.length ? "silent_risk" : "stable",
      silentSignals: silentSignals.map((item) => item.code),
      evidenceCodes: quality.evidence.map((item) => item.code),
    };
  });
  return {
    summary: {
      watchedProjects: items.length,
      likelyToEscalate: items.filter((item) => item.forecast === "likely_to_escalate").length,
      silentRisks: items.filter((item) => item.silentSignals.length > 0).length,
    },
    items,
  };
}

function buildAiEscalationPack(project = {}, options = {}) {
  const quality = evaluateStatusQuality(project, options);
  return {
    summary: {
      projectId: project.projectId || project.id || null,
      name: project.name || null,
      severity: quality.severity,
      decisionRequired: project.decisions || null,
      recommendedEscalationOwner: project.sponsorActions ? (project.sponsorActions.match(/\b(CIO|CEO|PMO|Sponsor)\b/i)?.[1]?.toUpperCase() || "Sponsor") : "Sponsor",
    },
    problem: quality.warnings.join(" "),
    businessImpact: quality.severity === "critical"
      ? "Delivery confidence is materially reduced until the escalation is resolved."
      : "Management review can prevent escalation.",
    options: buildWhatIfRecoveryPlan(project, options).actions,
    evidenceCodes: quality.evidence.map((item) => item.code),
    requiresHumanReview: true,
  };
}

function buildEvidenceGapDetector(projects, options = {}) {
  const items = (projects || []).map((project) => {
    const quality = evaluateStatusQuality(project, options);
    const gaps = [];
    if (quality.evidence.some((item) => item.code === "red_kpi") && !project.obstaclesAndMeasures) {
      gaps.push("missing_mitigation");
    }
    if (quality.evidence.some((item) => item.code === "red_kpi") && !project.sponsorActions) {
      gaps.push("missing_sponsor_action");
    }
    if (quality.evidence.some((item) => item.code === "red_kpi") && !/\b(owner|cio|ceo|pmo|sponsor|lead|manager)\b/i.test(project.obstaclesAndMeasures || "")) {
      gaps.push("missing_named_mitigation_owner");
    }
    if (quality.evidence.some((item) => item.code === "red_kpi") && !/\b\d{4}-\d{2}-\d{2}\b|\bby\b|\buntil\b|\bdue\b/i.test(project.obstaclesAndMeasures || "")) {
      gaps.push("missing_mitigation_due_date");
    }
    if (quality.evidence.some((item) => item.code === "high_progress_not_closed") && !project.plannedActivities) {
      gaps.push("missing_closure_plan");
    }
    if (quality.evidence.some((item) => item.code === "overdue_finish") && !project.decisions) {
      gaps.push("missing_recovery_decision");
    }
    return { projectId: project.projectId || project.id || null, name: project.name || null, gaps, evidenceCodes: quality.evidence.map((item) => item.code) };
  }).filter((item) => item.gaps.length > 0);
  return {
    summary: {
      projectsReviewed: (projects || []).length,
      projectsWithGaps: items.length,
      totalGaps: items.reduce((sum, item) => sum + item.gaps.length, 0),
    },
    items,
  };
}

function buildExecutiveQuestionGenerator(projects, options = {}) {
  const items = buildPortfolioRiskList(projects, options).map((risk) => {
    const questions = [];
    if (risk.evidence.some((item) => item.code === "red_kpi" || item.code === "dependency_blocked")) {
      questions.push(`What decision is needed to unblock ${risk.name}?`);
    }
    questions.push(`Who owns the mitigation for ${risk.name} and by when?`);
    if (risk.evidence.some((item) => item.code === "overdue_finish")) {
      questions.push("What is the recovery date for the overdue finish milestone?");
    }
    questions.push("Which option reduces the highest delivery risk this week?");
    return { projectId: risk.projectId, name: risk.name, questions: questions.slice(0, 5), evidenceCodes: risk.evidence.map((item) => item.code) };
  });
  return { summary: { projects: items.length, questions: items.reduce((sum, item) => sum + item.questions.length, 0) }, items };
}

function buildDecisionOptionScoring(project = {}, options = {}) {
  const scored = (options.options || []).map((option) => {
    const score = Math.max(0, Math.min(100, (option.riskReduction || 0) * 2 + (option.timeGainDays || 0) * 2 - (option.effort || 0)));
    return {
      title: option.title,
      score,
      riskReduction: option.riskReduction || 0,
      timeGainDays: option.timeGainDays || 0,
      effort: option.effort || 0,
      recommendation: score >= 70 ? "prefer" : score >= 40 ? "consider" : "avoid",
    };
  }).sort((a, b) => b.score - a.score);
  return { projectId: project.projectId || project.id || null, name: project.name || null, options: scored };
}

function buildPortfolioConstraintRadar(projects) {
  const constraints = new Map();
  for (const project of projects || []) {
    for (const [type, value] of [["vendor", project.vendorName], ["dependency", project.dependencyName || project.dependencyStatusLabel], ["owner", project.ownerName]]) {
      if (!value) continue;
      const key = `${type}:${value}`;
      if (!constraints.has(key)) constraints.set(key, { type, value, projects: [] });
      constraints.get(key).projects.push({ projectId: project.projectId || project.id || null, name: project.name || null });
    }
  }
  const items = [...constraints.values()].filter((item) => item.projects.length > 1);
  return {
    summary: {
      constraints: items.length,
      affectedProjects: new Set(items.flatMap((item) => item.projects.map((project) => project.projectId))).size,
    },
    items,
  };
}

function buildCommitmentTracker(projects, options = {}) {
  const today = options.today || new Date().toISOString().slice(0, 10);
  const items = [];
  for (const project of projects || []) {
    if (project.sponsorActions) {
      items.push({ projectId: project.projectId || project.id || null, name: project.name || null, type: "sponsor_action", commitment: project.sponsorActions, status: "open", dueDate: today });
    }
    if (project.decisions) {
      items.push({ projectId: project.projectId || project.id || null, name: project.name || null, type: "decision", commitment: project.decisions, status: "open", dueDate: today });
    }
  }
  return { summary: { commitments: items.length, open: items.filter((item) => item.status === "open").length }, items };
}

function normalizeRiskText(value) {
  return normalizeText(value).toLowerCase().replace(/\b(api|interface|still|not|ready|delay|blocked|vendor)\b/g, "").trim();
}

function buildRiskNarrativeDrift(previousRisks = [], currentRisks = []) {
  const items = [];
  for (const current of currentRisks || []) {
    const previous = (previousRisks || []).find((item) => item.projectId === current.projectId);
    if (!previous) continue;
    for (const currentRisk of current.risks || []) {
      const normalizedCurrent = normalizeRiskText(currentRisk);
      const match = (previous.risks || []).find((previousRisk) => {
        const normalizedPrevious = normalizeRiskText(previousRisk);
        return normalizedCurrent === normalizedPrevious || normalizeText(currentRisk) !== normalizeText(previousRisk);
      });
      if (match) {
        items.push({ projectId: current.projectId, previousRisk: match, currentRisk, driftType: "same_risk_reworded" });
      }
    }
  }
  return { summary: { comparedProjects: currentRisks.length, driftItems: items.length }, items };
}

function buildEscalationReadinessScore(project = {}, options = {}) {
  const missing = [];
  if (!project.obstaclesAndMeasures) missing.push("problem");
  if (!project.decisions) missing.push("decision");
  if (!project.sponsorActions) missing.push("owner");
  if (!project.decisionOptions && !(options.options || []).length) missing.push("options");
  const score = Math.max(0, 100 - missing.length * 20);
  return {
    projectId: project.projectId || project.id || null,
    name: project.name || null,
    summary: { score, level: score >= 80 ? "ready" : score >= 50 ? "needs_work" : "not_ready", missing },
    evidenceCodes: evaluateStatusQuality(project, options).evidence.map((item) => item.code),
  };
}

function buildGovernanceReplay(snapshots = []) {
  const firstWarningIndex = snapshots.findIndex((snapshot) => (snapshot.riskLedger || []).length > 0 || (snapshot.portfolioRisks || []).length > 0);
  return {
    summary: {
      snapshots: snapshots.length,
      firstWarningIndex,
      missedWarningWindows: firstWarningIndex < 0 ? 0 : Math.max(0, snapshots.length - firstWarningIndex - 1),
    },
    events: snapshots.map((snapshot, index) => ({ index, riskCount: (snapshot.riskLedger || snapshot.portfolioRisks || []).length })),
  };
}

function buildPmoPolicySimulator(projects, options = {}) {
  const policies = options.policies || [];
  const violations = [];
  for (const policy of policies) {
    for (const project of projects || []) {
      if (policy.id === "red_requires_sponsor_action" && project.overallKpiLabel === "Red" && !project.sponsorActions) {
        violations.push({ policyId: policy.id, projectId: project.projectId || project.id || null, severity: policy.severity || "warning" });
      }
    }
  }
  return { summary: { policies: policies.length, violations: violations.length }, violations };
}

function buildCrossProjectDependencyIntelligence(projects, options = {}) {
  const groups = new Map();
  for (const project of projects || []) {
    const dependency = project.dependencyName || project.dependencyStatusLabel;
    if (!dependency) continue;
    if (!groups.has(dependency)) groups.set(dependency, []);
    groups.get(dependency).push(project);
  }
  const items = [...groups.entries()].filter(([, group]) => group.length > 1).map(([dependency, group]) => ({
    dependency,
    projects: group.map((project) => ({ projectId: project.projectId || project.id || null, name: project.name || null })),
    hasRisk: group.some((project) => evaluateStatusQuality(project, options).severity !== "ok"),
  }));
  return {
    summary: {
      sharedDependencies: items.length,
      dependenciesWithRisk: items.filter((item) => item.hasRisk).length,
    },
    items,
  };
}

function buildReportQualityBenchmark(projects, options = {}) {
  const items = (projects || []).map((project) => {
    const truth = buildProjectTruthScore(project, options);
    const completeness = buildDataCompletenessScore(project);
    const score = Math.round((truth.summary.score + completeness.score) / 2);
    return { projectId: project.projectId || project.id || null, name: project.name || null, score };
  }).sort((a, b) => a.score - b.score);
  const averageScore = items.length ? Math.round(items.reduce((sum, item) => sum + item.score, 0) / items.length) : 0;
  return { summary: { projectsReviewed: items.length, averageScore, lowestProjectId: items[0]?.projectId || null }, items };
}

function buildHumanConfirmationAnalytics(events = []) {
  const accepted = events.filter((item) => item.outcome === "accepted").length;
  const edited = events.filter((item) => item.outcome === "edited").length;
  const rejected = events.filter((item) => item.outcome === "rejected").length;
  const total = events.length;
  return {
    summary: {
      total,
      accepted,
      edited,
      rejected,
      adoptionRate: total ? Math.round(((accepted + edited) / total) * 100) : 0,
    },
    events,
  };
}

function makeSafetyGate(domain, checkId, title, status, severity, message, extras = {}) {
  return {
    domain,
    checkId: `${domain}.${checkId}`,
    title,
    status,
    severity,
    message,
    evidenceCodes: extras.evidenceCodes || [],
    missingFields: extras.missingFields || [],
    recommendedAction: extras.recommendedAction || null,
    source: extras.source || null,
  };
}

function gateStatus(condition, failStatus = "fail", passStatus = "pass") {
  return condition ? failStatus : passStatus;
}

function safetyPenalty(gate) {
  if (gate.severity === "critical") return 25;
  if (gate.status === "fail") return 15;
  if (gate.status === "warning") return 7;
  return 0;
}

function containsAny(value, words) {
  const text = normalizeText(value).toLowerCase();
  return words.some((word) => text.includes(word));
}

function daysUntil(dateText, todayText) {
  const target = parseDateOnly(dateText);
  const today = parseDateOnly(todayText);
  if (!target || !today) return null;
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function classifySafetyLevel(score, gates) {
  if (score < 40 || gates.some((gate) => gate.severity === "critical")) return "critical";
  if (gates.some((gate) => gate.status === "fail")) return "unsafe";
  if (score < 90 || gates.some((gate) => gate.status === "warning")) return "watch";
  return "safe";
}

function classifyManagementAttention(project, gates) {
  const hasCriticalDelivery = gates.some((gate) => gate.domain === "delivery_risk" && gate.severity === "critical");
  const hasOverdueDecision = gates.some((gate) => gate.checkId === "decision_governance.decision_sla" && gate.severity === "critical");
  const hasEscalationGap = gates.some((gate) => gate.domain === "escalation_readiness" && gate.status === "fail");
  if (hasCriticalDelivery && (hasOverdueDecision || hasEscalationGap)) return "ceo";
  if (
    project?.overallKpiLabel === "Red" ||
    project?.dependencyStatusLabel === "Blocked" ||
    project?.budgetStatusLabel === "Over Budget" ||
    project?.resourceStatusLabel === "Understaffed" ||
    gates.some((gate) => gate.checkId === "decision_governance.sponsor_action_required" && gate.status !== "pass")
  ) return "cio";
  if (gates.some((gate) => ["data_integrity", "report_quality", "status_truth"].includes(gate.domain) && gate.status !== "pass")) return "pmo";
  return "none";
}

function classifyWritebackRisk(gates) {
  if (gates.some((gate) => gate.domain === "writeback" && gate.status === "fail")) return "blocked_until_confirmation";
  if (gates.some((gate) => gate.domain === "writeback" && gate.status === "warning")) return "high";
  return "low";
}

function buildProjectSafetyGate(project = {}, options = {}) {
  const today = options.today || new Date().toISOString().slice(0, 10);
  const quality = evaluateStatusQuality(project, options);
  const delta = detectStatusDelta(project, options);
  const completeness = buildDataCompletenessScore(project);
  const truth = buildProjectTruthScore(project, options);
  const escalation = buildEscalationReadinessScore(project, options);
  const safeWriteback = buildSafeWritebackSimulation(project, options.draft || {});
  const decisions = buildDecisionClosureItems([project], options);
  const evidenceCodes = quality.evidence.map((item) => item.code);
  const statusText = normalizeText(project.currentStatusText || project.lastStatusUpdate);
  const finishDays = daysUntil(project.finish, today);
  const progress = Number(project.progress);
  const needsEscalationReview = quality.severity !== "ok" || project.overallKpiLabel === "Red" || evidenceCodes.includes("dependency_blocked") || evidenceCodes.includes("overdue_finish");
  const blockerKeywords = ["blocked", "blocker", "delay", "risk", "issue", "vendor", "escalation", "not ready"];
  const decisionKeywords = ["approve", "decision", "decide", "blocked", "escalation", "funding", "vendor"];
  const gates = [];

  const add = (...args) => gates.push(makeSafetyGate(...args));

  add("data_integrity", "project_id", "Project ID present", project.projectId || project.id ? "pass" : "fail", project.projectId || project.id ? "info" : "fail", "Project ID is required.", { missingFields: project.projectId || project.id ? [] : ["projectId"] });
  add("data_integrity", "project_name", "Project name present", project.name ? "pass" : "fail", project.name ? "info" : "fail", "Project name is required.", { missingFields: project.name ? [] : ["name"] });
  add("data_integrity", "record_url", "Record URL present", project.recordUrl ? "pass" : "warning", project.recordUrl ? "info" : "warning", "Record URL should be present for evidence traceability.", { missingFields: project.recordUrl ? [] : ["recordUrl"] });
  add("data_integrity", "project_state", "Project state present", project.projectStatusLabel ? "pass" : "warning", project.projectStatusLabel ? "info" : "warning", "Project state should be present.", { missingFields: project.projectStatusLabel ? [] : ["projectStatusLabel"] });
  add("data_integrity", "kpi_present", "KPI present", project.overallKpiLabel ? "pass" : "fail", project.overallKpiLabel ? "info" : "fail", "Overall KPI is required.", { missingFields: project.overallKpiLabel ? [] : ["overallKpiLabel"] });
  add("data_integrity", "progress_valid", "Progress valid", Number.isFinite(progress) && progress >= 0 && progress <= 100 ? "pass" : "fail", Number.isFinite(progress) && progress >= 0 && progress <= 100 ? "info" : "fail", "Progress must be between 0 and 100.", { missingFields: Number.isFinite(progress) ? [] : ["progress"] });
  add("data_integrity", "finish_date_valid", "Finish date valid", parseDateOnly(project.finish) ? "pass" : "fail", parseDateOnly(project.finish) ? "info" : "fail", "Finish date must be present and parseable.", { missingFields: parseDateOnly(project.finish) ? [] : ["finish"] });
  add("data_integrity", "last_status_present", "Last status present", project.lastStatusUpdate || project.currentStatusText ? "pass" : "fail", project.lastStatusUpdate || project.currentStatusText ? "info" : "fail", "Status text is required.", { evidenceCodes: evidenceCodes.filter((code) => code === "stale_status") });
  add("data_integrity", "active_state_consistency", "Active state consistency", isActiveProjectCandidate(project) ? "pass" : "not_applicable", "info", "Closed or inactive projects are not safety-gate candidates.");
  add("data_integrity", "project_manager_evidence", "Project manager evidence present", options.projectManagerVerified === true || project.projectManagerName || project.ownerName ? "pass" : "warning", options.projectManagerVerified === true || project.projectManagerName || project.ownerName ? "info" : "warning", "Project manager verification evidence should be present.");
  add("data_integrity", "duplicate_project_id", "Duplicate project ID", (options.duplicateProjectIds || new Set()).has(project.projectId) ? "fail" : "pass", (options.duplicateProjectIds || new Set()).has(project.projectId) ? "fail" : "info", "Project ID should be unique in the suite.");
  add("data_integrity", "source_url_for_management", "Source URL for management output", project.recordUrl ? "pass" : "warning", project.recordUrl ? "info" : "warning", "Management-facing output should include a source URL.", { missingFields: project.recordUrl ? [] : ["recordUrl"] });

  add("status_truth", "stale_status", "Status freshness", evidenceCodes.includes("stale_status") ? "fail" : "pass", evidenceCodes.includes("stale_status") ? "fail" : "info", "Status must be current and present.", { evidenceCodes: evidenceCodes.filter((code) => code === "stale_status") });
  add("status_truth", "empty_status", "Empty status", statusText ? "pass" : "fail", statusText ? "info" : "fail", "Status text must not be empty.");
  add("status_truth", "repeated_unchanged_status", "Repeated unchanged status", delta.changeType === "unchanged" ? "warning" : "pass", delta.changeType === "unchanged" ? "warning" : "info", "Repeated unchanged status should be reviewed.", { evidenceCodes: delta.evidence.map((item) => item.code) });
  add("status_truth", "kv_validity", "KV validity", delta.recommendedInput === "kv_blocked" ? "warning" : "pass", delta.recommendedInput === "kv_blocked" ? "warning" : "info", "kv is advisory-blocked by project evidence.", { evidenceCodes: delta.recommendedInput === "kv_blocked" ? ["kv_blocked", ...delta.evidence.map((item) => item.code)] : [] });
  add("status_truth", "kpi_narrative_consistency", "KPI narrative consistency", truth.summary.level === "low_trust" ? "fail" : truth.summary.level === "needs_review" ? "warning" : "pass", truth.summary.level === "low_trust" ? "fail" : truth.summary.level === "needs_review" ? "warning" : "info", "KPI and narrative should not contradict each other.", { evidenceCodes });
  add("status_truth", "green_with_blockers", "Green KPI with blocker keywords", project.overallKpiLabel === "Green" && containsAny(statusText, blockerKeywords) ? "warning" : "pass", project.overallKpiLabel === "Green" && containsAny(statusText, blockerKeywords) ? "warning" : "info", "Green KPI should not contain unresolved blocker language.");
  add("status_truth", "red_with_optimistic_text", "Red KPI with optimistic text", project.overallKpiLabel === "Red" && containsAny(statusText, ["on track", "in plan", "no issues", "all good"]) ? "fail" : "pass", project.overallKpiLabel === "Red" && containsAny(statusText, ["on track", "in plan", "no issues", "all good"]) ? "fail" : "info", "Red KPI needs a risk-aligned narrative.");
  add("status_truth", "high_progress_closure_narrative", "High progress closure narrative", Number.isFinite(progress) && progress >= buildPmoConfig(options.config || {}).progressAlmostDoneThreshold && !project.plannedActivities ? "fail" : "pass", Number.isFinite(progress) && progress >= buildPmoConfig(options.config || {}).progressAlmostDoneThreshold && !project.plannedActivities ? "fail" : "info", "High-progress active projects need a closure narrative.", { evidenceCodes: evidenceCodes.filter((code) => code === "high_progress_not_closed") });
  add("status_truth", "vague_status_text", "Status specificity", statusText && statusText.length < 20 ? "warning" : "pass", statusText && statusText.length < 20 ? "warning" : "info", "Status text should be specific enough for management review.");
  add("status_truth", "missing_next_step", "Next step present", evidenceCodes.includes("missing_next_step") || (!project.plannedActivities && !project.sponsorActions && project.obstaclesAndMeasures) ? "fail" : "pass", evidenceCodes.includes("missing_next_step") ? "fail" : "info", "Risks require a next step or sponsor action.", { evidenceCodes: evidenceCodes.filter((code) => code === "missing_next_step"), missingFields: !project.plannedActivities ? ["plannedActivities"] : [] });
  add("status_truth", "mitigation_owner", "Mitigation owner present", project.obstaclesAndMeasures && !/\b(owner|cio|ceo|pmo|sponsor|lead|manager)\b/i.test(project.obstaclesAndMeasures) ? "warning" : "pass", project.obstaclesAndMeasures && !/\b(owner|cio|ceo|pmo|sponsor|lead|manager)\b/i.test(project.obstaclesAndMeasures) ? "warning" : "info", "Mitigation should name an owner.");
  add("status_truth", "mitigation_due_date", "Mitigation due date present", project.obstaclesAndMeasures && !/\b\d{4}-\d{2}-\d{2}\b|\bby\b|\buntil\b|\bdue\b/i.test(project.obstaclesAndMeasures) ? "warning" : "pass", project.obstaclesAndMeasures && !/\b\d{4}-\d{2}-\d{2}\b|\bby\b|\buntil\b|\bdue\b/i.test(project.obstaclesAndMeasures) ? "warning" : "info", "Mitigation should include a due date.");

  add("delivery_risk", "finish_overdue", "Finish overdue", evidenceCodes.includes("overdue_finish") ? "fail" : "pass", evidenceCodes.includes("overdue_finish") ? "critical" : "info", "Overdue finish date requires recovery action.", { evidenceCodes: evidenceCodes.filter((code) => code === "overdue_finish") });
  add("delivery_risk", "finish_near_due_non_green", "Near due with non-green KPI", finishDays !== null && finishDays >= 0 && finishDays <= 14 && project.overallKpiLabel !== "Green" ? "warning" : "pass", finishDays !== null && finishDays >= 0 && finishDays <= 14 && project.overallKpiLabel !== "Green" ? "warning" : "info", "Near-due non-green projects need attention.");
  add("delivery_risk", "progress_low_near_finish", "Low progress near finish", finishDays !== null && finishDays <= 14 && Number.isFinite(progress) && progress < 70 ? "warning" : "pass", finishDays !== null && finishDays <= 14 && Number.isFinite(progress) && progress < 70 ? "warning" : "info", "Progress appears low for the remaining schedule.");
  add("delivery_risk", "progress_high_active", "High progress but active", evidenceCodes.includes("high_progress_not_closed") ? "warning" : "pass", evidenceCodes.includes("high_progress_not_closed") ? "warning" : "info", "High-progress active projects need closure control.", { evidenceCodes: evidenceCodes.filter((code) => code === "high_progress_not_closed") });
  add("delivery_risk", "no_planned_activities", "Planned activities present", project.plannedActivities ? "pass" : "warning", project.plannedActivities ? "info" : "warning", "Planned activities should be present.");
  add("delivery_risk", "blocked_dependency", "Blocked dependency", evidenceCodes.includes("dependency_blocked") ? "fail" : "pass", evidenceCodes.includes("dependency_blocked") ? "critical" : "info", "Blocked dependencies require escalation.", { evidenceCodes: evidenceCodes.filter((code) => code === "dependency_blocked") });
  add("delivery_risk", "shared_dependency", "Shared dependency risk", (options.sharedDependencyRisks || new Set()).has(project.dependencyName || project.dependencyStatusLabel) ? "warning" : "pass", (options.sharedDependencyRisks || new Set()).has(project.dependencyName || project.dependencyStatusLabel) ? "warning" : "info", "Shared dependency has cross-project risk.");
  add("delivery_risk", "vendor_interface_blocker", "Vendor or interface blocker", containsAny(`${statusText} ${project.obstaclesAndMeasures || ""}`, ["vendor", "interface", "api"]) ? "warning" : "pass", containsAny(`${statusText} ${project.obstaclesAndMeasures || ""}`, ["vendor", "interface", "api"]) ? "warning" : "info", "Vendor/interface blockers should be managed explicitly.");
  add("delivery_risk", "repeated_unresolved_risk", "Repeated unresolved risk", (options.recurringRiskKeys || new Set()).size && [...(options.recurringRiskKeys || new Set())].some((key) => key.startsWith(`${project.projectId}::`)) ? "warning" : "pass", "warning", "Repeated risks should not remain unresolved.");
  add("delivery_risk", "risk_narrative_drift", "Risk narrative drift", (options.riskNarrativeDriftProjectIds || new Set()).has(project.projectId) ? "warning" : "pass", (options.riskNarrativeDriftProjectIds || new Set()).has(project.projectId) ? "warning" : "info", "Recurring risks should not be hidden by rewording.");

  const decisionItem = decisions[0];
  add("decision_governance", "decision_missing_with_blocker_keywords", "Decision present when required", containsAny(`${statusText} ${project.obstaclesAndMeasures || ""}`, decisionKeywords) && !project.decisions ? "fail" : "pass", containsAny(`${statusText} ${project.obstaclesAndMeasures || ""}`, decisionKeywords) && !project.decisions ? "fail" : "info", "Blocker language requires a decision field.");
  add("decision_governance", "decision_owner", "Decision owner present", project.decisions && !decisionItem?.owner ? "fail" : "pass", project.decisions && !decisionItem?.owner ? "fail" : "info", "Open decisions need an owner.");
  add("decision_governance", "decision_due_date", "Decision due date present", project.decisions && !decisionItem?.dueDate ? "fail" : "pass", project.decisions && !decisionItem?.dueDate ? "fail" : "info", "Open decisions need a due date.");
  add("decision_governance", "decision_sla", "Decision SLA", decisionItem?.sla?.status === "overdue" ? "fail" : decisionItem?.sla?.status === "due_today" ? "fail" : decisionItem ? "pass" : "not_applicable", decisionItem?.sla?.status === "overdue" ? "critical" : decisionItem?.sla?.status === "due_today" ? "fail" : "info", "Decision SLA must be actively managed.", { evidenceCodes: decisionItem?.evidenceCodes || [] });
  add("decision_governance", "decision_debt_high", "Decision debt high", buildDecisionDebtAnalysis([project], options).summary.decisionDebtScore >= 60 ? "warning" : "pass", buildDecisionDebtAnalysis([project], options).summary.decisionDebtScore >= 60 ? "warning" : "info", "Decision debt should remain low.");
  add("decision_governance", "sponsor_action_required", "Sponsor action required", (project.overallKpiLabel === "Red" || evidenceCodes.includes("dependency_blocked") || evidenceCodes.includes("overdue_finish")) && !project.sponsorActions ? "fail" : "pass", (project.overallKpiLabel === "Red" || evidenceCodes.includes("dependency_blocked") || evidenceCodes.includes("overdue_finish")) && !project.sponsorActions ? "fail" : "info", "Sponsor action is required for high-risk projects.");
  add("decision_governance", "sponsor_action_follow_up", "Sponsor action follow-up", project.sponsorActions && !statusText.toLowerCase().includes(project.sponsorActions.toLowerCase().slice(0, 10)) ? "warning" : "pass", project.sponsorActions && !statusText.toLowerCase().includes(project.sponsorActions.toLowerCase().slice(0, 10)) ? "warning" : "info", "Sponsor actions should be followed up in status text.");
  add("decision_governance", "red_kpi_sponsor_action", "Red KPI sponsor action", project.overallKpiLabel === "Red" && !project.sponsorActions ? "fail" : "pass", project.overallKpiLabel === "Red" && !project.sponsorActions ? "fail" : "info", "Red KPI requires sponsor action.");
  add("decision_governance", "budget_funding_decision", "Budget funding decision", project.budgetStatusLabel === "Over Budget" && !containsAny(`${project.decisions || ""} ${project.sponsorActions || ""}`, ["budget", "funding", "scope"]) ? "warning" : "pass", project.budgetStatusLabel === "Over Budget" ? "warning" : "info", "Budget overruns need funding or scope decision.");
  add("decision_governance", "pmo_policy_violation", "PMO policy violation", buildPmoPolicySimulator([project], { ...options, policies: options.policies || [{ id: "red_requires_sponsor_action", severity: "critical" }] }).summary.violations ? "fail" : "pass", "fail", "PMO policy violations require review.");
  add("decision_governance", "governance_exception", "Governance exception", buildGovernanceExceptions([project], options).length ? "warning" : "pass", buildGovernanceExceptions([project], options).length ? "warning" : "info", "Governance exceptions require PMO review.");

  add("financial_resource", "budget_overrun", "Budget overrun", evidenceCodes.includes("budget_overrun") ? "warning" : "pass", evidenceCodes.includes("budget_overrun") ? "warning" : "info", "Budget overrun requires review.", { evidenceCodes: evidenceCodes.filter((code) => code === "budget_overrun") });
  add("financial_resource", "budget_mitigation", "Budget mitigation", project.budgetStatusLabel === "Over Budget" && !project.obstaclesAndMeasures ? "fail" : "pass", project.budgetStatusLabel === "Over Budget" && !project.obstaclesAndMeasures ? "fail" : "info", "Budget risk needs mitigation.");
  add("financial_resource", "budget_sponsor_action", "Budget sponsor action", project.budgetStatusLabel === "Over Budget" && !project.sponsorActions ? "warning" : "pass", project.budgetStatusLabel === "Over Budget" && !project.sponsorActions ? "warning" : "info", "Budget risk should have sponsor action.");
  add("financial_resource", "resource_understaffed", "Resource understaffed", evidenceCodes.includes("resource_risk") ? "warning" : "pass", evidenceCodes.includes("resource_risk") ? "warning" : "info", "Understaffed projects require capacity review.", { evidenceCodes: evidenceCodes.filter((code) => code === "resource_risk") });
  add("financial_resource", "resource_owner", "Resource owner", project.resourceStatusLabel === "Understaffed" && !project.ownerName && !project.projectManagerName ? "warning" : "pass", project.resourceStatusLabel === "Understaffed" ? "warning" : "info", "Resource risks need an owner.");
  add("financial_resource", "resource_decision_scope", "Resource decision or scope tradeoff", project.resourceStatusLabel === "Understaffed" && !containsAny(`${project.decisions || ""} ${project.sponsorActions || ""}`, ["scope", "resource", "capacity"]) ? "warning" : "pass", project.resourceStatusLabel === "Understaffed" ? "warning" : "info", "Resource risk needs capacity or scope decision.");
  add("financial_resource", "dependency_resource_combined", "Dependency plus resource risk", evidenceCodes.includes("dependency_blocked") && evidenceCodes.includes("resource_risk") ? "fail" : "pass", evidenceCodes.includes("dependency_blocked") && evidenceCodes.includes("resource_risk") ? "fail" : "info", "Combined dependency/resource risk requires escalation.");
  add("financial_resource", "budget_schedule_combined", "Budget plus schedule risk", evidenceCodes.includes("budget_overrun") && evidenceCodes.includes("overdue_finish") ? "fail" : "pass", evidenceCodes.includes("budget_overrun") && evidenceCodes.includes("overdue_finish") ? "fail" : "info", "Combined budget/schedule risk requires management review.");
  add("financial_resource", "multiple_risk_dimensions", "Multiple risk dimensions", ["budget_overrun", "resource_risk", "dependency_blocked", "overdue_finish"].filter((code) => evidenceCodes.includes(code)).length >= 3 ? "fail" : "pass", ["budget_overrun", "resource_risk", "dependency_blocked", "overdue_finish"].filter((code) => evidenceCodes.includes(code)).length >= 3 ? "fail" : "info", "Multiple active risk dimensions require portfolio attention.");

  add("escalation_readiness", "problem_clear", "Problem clearly stated", !needsEscalationReview ? "not_applicable" : project.obstaclesAndMeasures || containsAny(statusText, blockerKeywords) ? "pass" : "fail", needsEscalationReview && !(project.obstaclesAndMeasures || containsAny(statusText, blockerKeywords)) ? "fail" : "info", "Escalation needs a clear problem.");
  add("escalation_readiness", "business_impact", "Business impact present", !needsEscalationReview ? "not_applicable" : containsAny(`${statusText} ${project.obstaclesAndMeasures || ""}`, ["impact", "delay", "blocked", "overdue", "budget"]) ? "pass" : "warning", needsEscalationReview ? "warning" : "info", "Escalation should include business impact.");
  add("escalation_readiness", "decision_required", "Decision required present", !needsEscalationReview ? "not_applicable" : project.decisions ? "pass" : "fail", needsEscalationReview && !project.decisions ? "fail" : "info", "Escalation needs a required decision.");
  add("escalation_readiness", "options_present", "Options present", !needsEscalationReview ? "not_applicable" : project.decisionOptions || (options.options || []).length ? "pass" : "fail", needsEscalationReview && !(project.decisionOptions || (options.options || []).length) ? "fail" : "info", "Escalation should include options.");
  add("escalation_readiness", "owner_present", "Escalation owner present", !needsEscalationReview ? "not_applicable" : project.sponsorActions || project.ownerName || project.projectManagerName ? "pass" : "fail", needsEscalationReview && !(project.sponsorActions || project.ownerName || project.projectManagerName) ? "fail" : "info", "Escalation needs a responsible owner.");
  add("escalation_readiness", "readiness_score", "Escalation readiness score", !needsEscalationReview ? "not_applicable" : escalation.summary.score < 80 ? "fail" : "pass", needsEscalationReview && escalation.summary.score < 80 ? "fail" : "info", "Escalation readiness should be at least 80.", { missingFields: needsEscalationReview ? escalation.summary.missing : [] });
  add("escalation_readiness", "management_attention_pack", "Management attention escalation pack", !needsEscalationReview ? "not_applicable" : (project.overallKpiLabel === "Red" || evidenceCodes.includes("dependency_blocked")) && !buildAiEscalationPack(project, options).summary.decisionRequired ? "fail" : "pass", needsEscalationReview ? "fail" : "info", "Management attention needs an escalation pack.");
  add("escalation_readiness", "critical_agenda_item", "Critical agenda item", quality.severity === "critical" && !buildSteeringAgenda([project], options).length ? "fail" : "pass", "fail", "Critical projects need a management agenda item.");
  add("escalation_readiness", "executive_questions", "Executive questions present", quality.severity === "critical" && !buildExecutiveQuestionGenerator([project], options).items.length ? "fail" : "pass", "fail", "Critical projects need executive questions.");
  add("escalation_readiness", "recovery_option", "Recovery option present", quality.severity === "critical" && !buildWhatIfRecoveryPlan(project, options).actions.length ? "fail" : "pass", "fail", "Critical projects need recovery options.");

  add("report_quality", "evidence_completeness", "Evidence completeness score", completeness.score < 60 ? "warning" : "pass", completeness.score < 60 ? "warning" : "info", "Evidence completeness should stay above threshold.", { missingFields: completeness.missingFields });
  add("report_quality", "truth_score", "Project truth score", truth.summary.score < 50 ? "fail" : truth.summary.score < 75 ? "warning" : "pass", truth.summary.score < 50 ? "fail" : truth.summary.score < 75 ? "warning" : "info", "Project truth score should remain credible.");
  add("report_quality", "benchmark_bottom_quartile", "Report benchmark bottom quartile", options.bottomQuartileProjectIds?.has(project.projectId) ? "warning" : "pass", options.bottomQuartileProjectIds?.has(project.projectId) ? "warning" : "info", "Bottom-quartile report quality needs PMO coaching.");
  add("report_quality", "evidence_codes", "Evidence codes present", quality.severity !== "ok" && !evidenceCodes.length ? "fail" : "pass", "fail", "Risk findings need evidence codes.");
  add("report_quality", "source_fields", "Source fields present", quality.evidence.every((item) => item.source?.field) ? "pass" : "warning", "warning", "Evidence should include source fields.");
  add("report_quality", "audit_preview", "Audit preview present", options.auditEntry ? "pass" : "warning", options.auditEntry ? "info" : "warning", "Proposed/staged actions should include audit preview.");
  add("report_quality", "trust_contract", "Trust contract present", buildTrustContract(project, options).summary.evidenceItems || quality.severity === "ok" ? "pass" : "warning", "warning", "AI recommendation needs trust contract.");
  add("report_quality", "recommended_action", "Recommended action present", quality.recommendedAction ? "pass" : "fail", quality.recommendedAction ? "info" : "fail", "Management reports need recommended action.");
  add("report_quality", "risk_decision_action_loop", "Risk decision/action loop", quality.severity !== "ok" && !project.decisions && !project.sponsorActions && !project.plannedActivities ? "fail" : "pass", "fail", "Risks need decision or action loop.");

  add("writeback", "save_confirmation", "CRM save confirmation required", "warning", "warning", "Any CRM save requires explicit confirmation.", { recommendedAction: "Require explicit save confirmation." });
  add("writeback", "email_status_update", "Email Status Update disabled", options.draft?.emailStatusUpdate ? "fail" : "pass", options.draft?.emailStatusUpdate ? "fail" : "info", "Email Status Update must be reviewed separately.");
  add("writeback", "target_fields", "Target fields populated", options.draft && !Object.keys(options.draft.fields || {}).length ? "fail" : "pass", options.draft && !Object.keys(options.draft.fields || {}).length ? "fail" : "info", "Draft target fields must be populated.");
  add("writeback", "submitted_to", "Submitted To present", options.requiresSubmittedTo && !options.submittedTo ? "fail" : "not_applicable", options.requiresSubmittedTo && !options.submittedTo ? "fail" : "info", "Submitted To is required when Dynamics requires it.");
  add("writeback", "project_manager_verified", "Project manager verified", options.projectManagerVerified === true ? "pass" : "fail", options.projectManagerVerified === true ? "info" : "fail", "Project Manager must be verified before staging or saving.");
  add("writeback", "current_record_url", "Current record URL present", project.recordUrl ? "pass" : "warning", project.recordUrl ? "info" : "warning", "Current record URL should be available before writeback.", { missingFields: project.recordUrl ? [] : ["recordUrl"] });
  add("writeback", "generated_content_review", "Generated content reviewed", options.generatedContent && !options.reviewed ? "fail" : "pass", options.generatedContent && !options.reviewed ? "fail" : "info", "Generated CRM content requires review.");
  add("writeback", "safe_writeback_blockers", "Safe writeback simulation blockers", options.draft && safeWriteback.blockers.length ? "fail" : options.draft ? "pass" : "not_applicable", options.draft && safeWriteback.blockers.length ? "fail" : "info", "Safe writeback simulation must have no blockers.");
  add("writeback", "audit_entry", "Audit entry present", options.auditEntry ? "pass" : "warning", options.auditEntry ? "info" : "warning", "Audit entry should exist for proposed, staged, skipped, or saved actions.");
  add("writeback", "confirmation_matches", "Confirmation matches project/status/email", options.confirmationMatches === false ? "fail" : "not_applicable", options.confirmationMatches === false ? "fail" : "info", "User confirmation must match project, status text, and email setting.");

  const safetyScore = Math.max(0, 100 - gates.reduce((sum, gate) => sum + safetyPenalty(gate), 0));
  const safetyLevel = classifySafetyLevel(safetyScore, gates);
  const managementAttention = classifyManagementAttention(project, gates);
  const writebackRisk = classifyWritebackRisk(gates);
  const requiredEvidence = [...new Set(gates.flatMap((gate) => gate.missingFields))];
  const recommendedActions = [...new Set([
    ...gates.map((gate) => gate.recommendedAction).filter(Boolean),
    ...safeWriteback.confirmations,
  ])];

  return {
    projectId: project.projectId || project.id || null,
    name: project.name || null,
    safetyScore,
    safetyLevel,
    managementAttention,
    writebackRisk,
    gates,
    requiredEvidence,
    recommendedActions,
  };
}

function buildProjectSafetyGateSuite(projects, options = {}) {
  const projectIds = (projects || []).map((project) => project.projectId || project.id).filter(Boolean);
  const duplicateProjectIds = new Set(projectIds.filter((id, index) => projectIds.indexOf(id) !== index));
  const dependencySummary = buildCrossProjectDependencyIntelligence(projects, options);
  const sharedDependencyRisks = new Set(dependencySummary.items.filter((item) => item.hasRisk).map((item) => item.dependency));
  const projectsWithOptions = { ...options, duplicateProjectIds, sharedDependencyRisks };
  const projectGates = (projects || []).map((project) => buildProjectSafetyGate(project, projectsWithOptions));
  const countLevel = (level) => projectGates.filter((item) => item.safetyLevel === level).length;
  const countAttention = (attention) => projectGates.filter((item) => item.managementAttention === attention).length;
  const topFindings = projectGates
    .flatMap((project) => project.gates
      .filter((gate) => gate.status === "fail" || gate.severity === "critical")
      .map((gate) => ({
        projectId: project.projectId,
        name: project.name,
        checkId: gate.checkId,
        severity: gate.severity,
        message: gate.message,
      })))
    .slice(0, 20);
  return {
    summary: {
      projectsReviewed: projectGates.length,
      safeProjects: countLevel("safe"),
      watchProjects: countLevel("watch"),
      unsafeProjects: countLevel("unsafe"),
      criticalProjects: countLevel("critical"),
      pmoAttention: countAttention("pmo"),
      cioAttention: countAttention("cio"),
      ceoAttention: countAttention("ceo"),
    },
    projects: projectGates,
    topFindings,
  };
}

function makePmoCheck(checkId, title, status, severity, message, extras = {}) {
  return {
    checkId,
    title,
    status,
    severity,
    message,
    evidenceCodes: extras.evidenceCodes || [],
    recommendation: extras.recommendation || null,
    owner: extras.owner || "PMO",
  };
}

function pmoPenalty(check) {
  if (check.severity === "critical") return 20;
  if (check.status === "fail") return 12;
  if (check.status === "warning") return 6;
  return 0;
}

function classifyPmoLevel(score, checks) {
  if (checks.some((check) => check.severity === "critical") || score < 45) return "critical";
  if (checks.some((check) => check.status === "fail") || score < 70) return "attention";
  if (checks.some((check) => check.status === "warning") || score < 90) return "watch";
  return "controlled";
}

function findProjectSnapshots(project, options = {}) {
  const projectId = project?.projectId || project?.id || null;
  return (options.previousSnapshots || []).filter((snapshot) => snapshot.projectId === projectId || snapshot.id === projectId);
}

function buildPmoProjectControls(project = {}, projects = [], options = {}) {
  const safety = buildProjectSafetyGate(project, options);
  const quality = evaluateStatusQuality(project, options);
  const evidenceCodes = quality.evidence.map((item) => item.code);
  const decisionItems = buildDecisionClosureItems([project], options);
  const snapshots = findProjectSnapshots(project, options);
  const statusText = normalizeText(project.currentStatusText || project.lastStatusUpdate);
  const sharedVendorCount = project.vendorName ? (projects || []).filter((item) => item.vendorName === project.vendorName).length : 0;
  const sharedOwnerCount = project.ownerName ? (projects || []).filter((item) => item.ownerName === project.ownerName).length : 0;
  const sharedDependencyCount = (project.dependencyName || project.dependencyStatusLabel)
    ? (projects || []).filter((item) => (item.dependencyName || item.dependencyStatusLabel) === (project.dependencyName || project.dependencyStatusLabel)).length
    : 0;
  const highRisk = safety.safetyLevel === "critical" || safety.safetyLevel === "unsafe" || quality.severity === "critical";
  const needsDecision = Boolean(project.decisions || decisionItems.length);
  const hasOwnerGap = safety.gates.some((gate) => /owner/i.test(gate.message) && gate.status !== "pass");
  const hasDueDateGap = safety.gates.some((gate) => /due date|SLA/i.test(gate.message) && gate.status !== "pass");
  const baselineDrift = new Set(snapshots.map((snapshot) => snapshot.finish).filter(Boolean)).size > 1;
  const recurringRisk = snapshots.filter((snapshot) => (snapshot.riskCodes || []).some((code) => evidenceCodes.includes(code))).length >= 2;
  const repeatedAction = project.sponsorActions && snapshots.filter((snapshot) => snapshot.sponsorActions === project.sponsorActions).length >= 2;
  const repeatedDecision = project.decisions && snapshots.filter((snapshot) => snapshot.decisions === project.decisions).length >= 2;
  const criticalAttentionCount = (projects || []).filter((item) => evaluateStatusQuality(item, options).severity === "critical" || item.overallKpiLabel === "Red").length;
  const portfolioRiskIds = new Set(buildPortfolioRiskList(projects, options).map((item) => item.projectId));
  const agendaIds = new Set(buildSteeringAgenda(projects, options).map((item) => item.projectId));
  const safetyIds = new Set(buildProjectSafetyGateSuite(projects, options).projects.filter((item) => item.safetyLevel === "critical" || item.safetyLevel === "unsafe").map((item) => item.projectId));
  const checks = [];
  const add = (...args) => checks.push(makePmoCheck(...args));

  add("steering_readiness", "Steering readiness", highRisk && !project.decisions ? "fail" : highRisk ? "warning" : "pass", highRisk && !project.decisions ? "fail" : highRisk ? "warning" : "info", "High-risk projects need decision-ready steering content.", { recommendation: highRisk ? "prepare_steering" : null, evidenceCodes });
  add("pmo_policy_compliance", "PMO policy compliance", buildPmoPolicySimulator([project], { ...options, policies: options.policies || [{ id: "red_requires_sponsor_action", severity: "critical" }] }).summary.violations ? "fail" : "pass", "fail", "Project must comply with active PMO policies.");
  add("portfolio_priority_drift", "Portfolio priority drift", highRisk && /low/i.test(project.priorityLabel || "") ? "warning" : "pass", highRisk && /low/i.test(project.priorityLabel || "") ? "warning" : "info", "High-risk projects should not have low priority.", { recommendation: highRisk && /low/i.test(project.priorityLabel || "") ? "reprioritize" : null });
  add("milestone_integrity", "Milestone integrity", evidenceCodes.includes("overdue_finish") || evidenceCodes.includes("high_progress_not_closed") ? "fail" : "pass", evidenceCodes.includes("overdue_finish") ? "critical" : evidenceCodes.includes("high_progress_not_closed") ? "fail" : "info", "Milestones must align with schedule and progress.", { evidenceCodes: evidenceCodes.filter((code) => ["overdue_finish", "high_progress_not_closed"].includes(code)) });
  add("baseline_drift", "Baseline drift", baselineDrift ? "warning" : "pass", baselineDrift ? "warning" : "info", "Repeated finish-date movement requires PMO review.");
  add("risk_aging", "Risk aging", recurringRisk ? "warning" : "pass", recurringRisk ? "warning" : "info", "Recurring risks should not age without closure.");
  add("action_aging", "Action aging", repeatedAction ? "warning" : "pass", repeatedAction ? "warning" : "info", "Sponsor actions should not remain unchanged across cycles.");
  add("decision_aging", "Decision aging", repeatedDecision ? "warning" : "pass", repeatedDecision ? "warning" : "info", "Decisions should not repeat across cycles without closure.");
  add("owner_accountability", "Owner accountability", hasOwnerGap ? "fail" : "pass", hasOwnerGap ? "fail" : "info", "Risks, decisions, and mitigations need accountable owners.");
  add("due_date_accountability", "Due date accountability", hasDueDateGap ? "fail" : "pass", hasDueDateGap ? "fail" : "info", "Risks, decisions, and mitigations need due dates.");
  add("single_point_of_failure", "Single point of failure", sharedOwnerCount > 1 || sharedDependencyCount > 1 ? "warning" : "pass", sharedOwnerCount > 1 || sharedDependencyCount > 1 ? "warning" : "info", "Multiple projects depend on the same owner or dependency.");
  add("vendor_concentration_risk", "Vendor concentration risk", sharedVendorCount > 1 ? "warning" : "pass", sharedVendorCount > 1 ? "warning" : "info", "Vendor concentration can create portfolio risk.");
  add("resource_contention", "Resource contention", sharedOwnerCount > 1 && (project.resourceStatusLabel === "Understaffed" || highRisk) ? "warning" : "pass", sharedOwnerCount > 1 ? "warning" : "info", "Shared owners on risky projects indicate resource contention.");
  add("status_quality_trend", "Status quality trend", snapshots.length && buildProjectTruthScore(project, options).summary.level === "low_trust" ? "warning" : "pass", "warning", "Status quality trend needs PMO coaching when current truth score is low.");
  add("false_green", "False green", project.overallKpiLabel === "Green" && safety.safetyLevel !== "safe" ? "warning" : "pass", project.overallKpiLabel === "Green" && safety.safetyLevel !== "safe" ? "warning" : "info", "Green projects with safety warnings need PMO review.");
  add("false_red", "False red", project.overallKpiLabel === "Red" && !project.obstaclesAndMeasures && !project.decisions ? "warning" : "pass", project.overallKpiLabel === "Red" ? "warning" : "info", "Red projects without concrete risk evidence may indicate poor data quality.");
  add("pm_coaching_trigger", "PM coaching trigger", buildProjectTruthScore(project, options).summary.score < 60 || buildDataCompletenessScore(project).score < 80 ? "warning" : "pass", "warning", "Low quality or incomplete reporting should trigger PM coaching.", { recommendation: "coach_pm" });
  add("escalation_fatigue", "Escalation fatigue", highRisk && recurringRisk && (repeatedAction || repeatedDecision) ? "fail" : "pass", highRisk && recurringRisk ? "fail" : "info", "Repeated escalation without movement requires PMO intervention.", { recommendation: "escalate_cio" });
  add("management_attention_overload", "Management attention overload", criticalAttentionCount > 3 ? "warning" : "pass", criticalAttentionCount > 3 ? "warning" : "info", "Too many projects require executive attention; PMO should prioritize top-N.");
  add("governance_exception_aging", "Governance exception aging", buildGovernanceExceptions([project], options).length && snapshots.length >= 2 ? "warning" : "pass", "warning", "Governance exceptions should not remain open across cycles.");
  add("audit_completeness", "Audit completeness", options.auditEntry ? "pass" : "warning", options.auditEntry ? "info" : "warning", "PMO handoffs should include audit entries.");
  add("evidence_traceability", "Evidence traceability", safety.gates.some((gate) => gate.status !== "pass" && !gate.evidenceCodes.length && !gate.source) ? "warning" : "pass", "warning", "Every material finding should trace to evidence, field, or source.");
  add("report_comparability", "Report comparability", buildDataCompletenessScore(project).score < 80 ? "warning" : "pass", buildDataCompletenessScore(project).score < 80 ? "warning" : "info", "Projects need comparable core reporting fields.");
  add("portfolio_heatmap_consistency", "Portfolio heatmap consistency", (portfolioRiskIds.has(project.projectId) || safetyIds.has(project.projectId)) && !agendaIds.has(project.projectId) ? "warning" : "pass", "warning", "Risk list, safety gates, and steering agenda should align.");

  const recommendation = highRisk && project.decisions ? "prepare_steering"
    : highRisk ? "escalate_cio"
      : checks.some((check) => check.checkId === "pm_coaching_trigger" && check.status !== "pass") ? "coach_pm"
        : checks.some((check) => check.status !== "pass") ? "request_update"
          : "none";
  add("pmo_intervention_recommendation", "PMO intervention recommendation", recommendation === "none" ? "pass" : "warning", recommendation === "none" ? "info" : "warning", "Recommended PMO intervention based on project control findings.", { recommendation });

  const pmoScore = Math.max(0, 100 - checks.reduce((sum, check) => sum + pmoPenalty(check), 0));
  return {
    projectId: project.projectId || project.id || null,
    name: project.name || null,
    pmoScore,
    pmoLevel: classifyPmoLevel(pmoScore, checks),
    intervention: recommendation,
    checks,
  };
}

function buildPmoControlTower(projects, options = {}) {
  const projectControls = (projects || []).map((project) => buildPmoProjectControls(project, projects, options));
  const portfolioFindings = projectControls
    .flatMap((project) => project.checks
      .filter((check) => check.status === "fail" || check.severity === "critical")
      .map((check) => ({
        projectId: project.projectId,
        name: project.name,
        checkId: check.checkId,
        severity: check.severity,
        recommendation: check.recommendation,
      })))
    .slice(0, 25);
  return {
    summary: {
      projectsReviewed: projectControls.length,
      checksPerProject: 25,
      projectsControlled: projectControls.filter((project) => project.pmoLevel === "controlled").length,
      projectsWatching: projectControls.filter((project) => project.pmoLevel === "watch").length,
      projectsNeedingPmo: projectControls.filter((project) => project.pmoLevel === "attention" || project.pmoLevel === "critical").length,
      criticalProjects: projectControls.filter((project) => project.pmoLevel === "critical").length,
    },
    projects: projectControls,
    portfolioFindings,
  };
}

function normalizeListFilter(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeText).filter(Boolean);
  }
  return String(value || "")
    .split(",")
    .map(normalizeText)
    .filter(Boolean);
}

function getLastStatusReportDate(project) {
  const candidates = [
    project?.lastStatusReportDate,
    project?.lastStatusUpdateDate,
    project?.lastStatusDate,
    project?.gbl_laststatusupdate,
    project?.lastStatusUpdate,
  ];
  for (const candidate of candidates) {
    const parsed = parseDateOnly(candidate);
    if (parsed) {
      return parsed.toISOString().slice(0, 10);
    }
  }
  return null;
}

function matchesPmoStatusReportFilters(project, filters = {}) {
  const statusLabels = normalizeListFilter(filters.projectStatusLabels || filters.projectStatusLabel);
  if (statusLabels.length) {
    const actualStatus = normalizeText(project?.projectStatusLabel).toLowerCase();
    if (!statusLabels.map((status) => status.toLowerCase()).includes(actualStatus)) {
      return false;
    }
  }

  const lastStatusText = normalizeText(project?.lastStatusUpdate || project?.currentStatusText);
  const lastStatusReportDate = getLastStatusReportDate(project);
  if (filters.lastStatusMissing && (lastStatusText || lastStatusReportDate)) {
    return false;
  }
  if (filters.lastStatusContains && !lastStatusText.toLowerCase().includes(normalizeText(filters.lastStatusContains).toLowerCase())) {
    return false;
  }

  const reportDate = parseDateOnly(lastStatusReportDate);
  const on = parseDateOnly(filters.lastStatusOn);
  const before = parseDateOnly(filters.lastStatusBefore);
  const after = parseDateOnly(filters.lastStatusAfter);
  if (on && (!reportDate || reportDate.getTime() !== on.getTime())) {
    return false;
  }
  if (before && (!reportDate || reportDate >= before)) {
    return false;
  }
  if (after && (!reportDate || reportDate <= after)) {
    return false;
  }
  return true;
}

function buildPmoStatusReport(projects, options = {}) {
  const sourceProjects = projects || [];
  const filters = {
    projectStatusLabels: normalizeListFilter(options.projectStatusLabels || options.projectStatusLabel),
    lastStatusBefore: options.lastStatusBefore || null,
    lastStatusAfter: options.lastStatusAfter || null,
    lastStatusOn: options.lastStatusOn || null,
    lastStatusContains: options.lastStatusContains || null,
    lastStatusMissing: Boolean(options.lastStatusMissing),
  };
  const filteredProjects = sourceProjects.filter((project) => matchesPmoStatusReportFilters(project, filters));
  const pmoControlTower = buildPmoControlTower(filteredProjects, options);
  const projectSafetyGates = buildProjectSafetyGateSuite(filteredProjects, options);
  const statusCounts = {};
  for (const project of filteredProjects) {
    const status = project.projectStatusLabel || "unknown";
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  }
  const reportDates = filteredProjects.map(getLastStatusReportDate).filter(Boolean).sort();
  const missingLastStatusReports = filteredProjects.filter((project) => !normalizeText(project.lastStatusUpdate || project.currentStatusText) && !getLastStatusReportDate(project)).length;
  const unparsableLastStatusReports = filteredProjects.filter((project) => normalizeText(project.lastStatusUpdate) && !getLastStatusReportDate(project)).length;
  const controlsByProjectId = new Map(pmoControlTower.projects.map((project) => [project.projectId, project]));
  const safetyByProjectId = new Map(projectSafetyGates.projects.map((project) => [project.projectId, project]));

  return {
    generatedAt: options.generatedAt || new Date().toISOString(),
    filters,
    summary: {
      projectsTotal: sourceProjects.length,
      projectsMatched: filteredProjects.length,
      projectsFilteredOut: sourceProjects.length - filteredProjects.length,
      statusCounts,
      missingLastStatusReports,
      unparsableLastStatusReports,
      oldestLastStatusReport: reportDates[0] || null,
      newestLastStatusReport: reportDates[reportDates.length - 1] || null,
    },
    projects: filteredProjects.map((project) => {
      const projectId = project.projectId || project.id || null;
      const controls = controlsByProjectId.get(projectId) || {};
      const safety = safetyByProjectId.get(projectId) || {};
      return {
        projectId,
        name: project.name || null,
        projectStatusLabel: project.projectStatusLabel || null,
        lastStatusUpdate: project.lastStatusUpdate || null,
        lastStatusReportDate: getLastStatusReportDate(project),
        pmoLevel: controls.pmoLevel || null,
        pmoScore: controls.pmoScore ?? null,
        intervention: controls.intervention || null,
        safetyLevel: safety.safetyLevel || null,
        managementAttention: safety.managementAttention || null,
        recordUrl: project.recordUrl || null,
      };
    }),
    pmoControlTower,
    projectSafetyGates,
  };
}

function plannedProgressPercent(project = {}, options = {}) {
  const start = parseDateOnly(project.start);
  const finish = parseDateOnly(project.finish);
  const today = parseDateOnly(options.today || new Date().toISOString().slice(0, 10));
  if (!start || !finish || !today || finish <= start) {
    return null;
  }
  if (today <= start) return 0;
  if (today >= finish) return 100;
  return Math.round(((today.getTime() - start.getTime()) / (finish.getTime() - start.getTime())) * 100);
}

function buildStatusReportSuggestion(project = {}, options = {}) {
  const today = options.today || new Date().toISOString().slice(0, 10);
  const quality = evaluateStatusQuality(project, options);
  const truth = buildProjectTruthScore(project, options);
  const safety = buildProjectSafetyGate(project, options);
  const progress = Number(project.progress);
  const plannedProgress = plannedProgressPercent(project, options);
  const finishDays = daysUntil(project.finish, today);
  const statusText = normalizeText(project.currentStatusText || project.lastStatusUpdate);
  const riskText = normalizeText(project.obstaclesAndMeasures || project.risks || "");
  const decisionText = normalizeText(project.decisions || "");
  const sponsorText = normalizeText(project.sponsorActions || "");
  const plannedActivities = normalizeText(project.plannedActivities || project.nextSteps || "");
  const reasonCodes = new Set(quality.evidence.map((item) => item.code));
  const dataGaps = [];

  if (!project.projectId && !project.id) dataGaps.push(reportDataGap(project, "projectId", "Project ID is missing."));
  if (!project.name) dataGaps.push(reportDataGap(project, "name", "Project name is missing."));
  if (!project.overallKpiLabel) dataGaps.push(reportDataGap(project, "overallKpiLabel", "Overall KPI is missing."));
  if (!Number.isFinite(progress)) dataGaps.push(reportDataGap(project, "progress", "Progress is missing or invalid."));
  if (!project.finish) dataGaps.push(reportDataGap(project, "finish", "Finish date is missing."));
  if (!project.start) dataGaps.push(reportDataGap(project, "start", "Start date is missing; planned progress cannot be calculated."));
  if (!statusText) dataGaps.push(reportDataGap(project, "lastStatusUpdate", "Last status text is missing."));

  if (plannedProgress != null && Number.isFinite(progress) && progress + 15 < plannedProgress) {
    reasonCodes.add("progress_behind_plan");
  }
  if (finishDays != null && finishDays <= 14 && finishDays >= 0) {
    reasonCodes.add("finish_near");
  }
  if (riskText) reasonCodes.add("risk_or_blocker_present");
  if (decisionText) reasonCodes.add("decision_required");
  if (sponsorText) reasonCodes.add("sponsor_action_present");
  if (plannedActivities) reasonCodes.add("next_step_present");
  if (project.overallKpiLabel === "Red") reasonCodes.add("red_kpi");
  if (project.overallKpiLabel === "Yellow") reasonCodes.add("yellow_kpi");

  let statusType = "stable_plan";
  let proposedStatusText = "Das Projekt laeuft planmaessig. Die geplanten Aktivitaeten werden fortgefuehrt; aktuell sind keine wesentlichen Abweichungen bei Termin, Umfang oder Qualitaet erkennbar. Naechster Schritt ist die weitere Umsetzung der geplanten Arbeitspakete bis zum naechsten Berichtstermin.";
  let recommendedAction = "review_and_use";

  if (dataGaps.length >= 4) {
    statusType = "insufficient_data";
    proposedStatusText = "Ein belastbarer Statusbericht kann auf Basis der vorhandenen Projektdaten noch nicht automatisch erstellt werden. Vor Managementnutzung muessen fehlende Pflichtinformationen, Planungsdaten und der aktuelle Projektstatus ergaenzt werden.";
    recommendedAction = "collect_missing_data";
  } else if (project.overallKpiLabel === "Red" || quality.severity === "critical") {
    statusType = "critical_escalation";
    proposedStatusText = `Das Projekt befindet sich in einem kritischen Zustand. Wesentliche Risiken oder Blocker gefaehrden Termin, Umfang oder Nutzen.${riskText ? ` Aktueller Risikohinweis: ${riskText}.` : ""}${decisionText ? ` Benoetigte Entscheidung: ${decisionText}.` : " Eine Managemententscheidung und ein Recovery-Plan sind erforderlich."} Naechster Schritt ist die kurzfristige Eskalation mit klarer Entscheidung zu Prioritaet, Ressourcen oder Scope.`;
    recommendedAction = "escalate_management";
  } else if (reasonCodes.has("overdue_finish")) {
    statusType = "overdue_recovery";
    proposedStatusText = `Das geplante Finish-Datum ist ueberschritten. Der aktuelle Fortschritt liegt bei ${Number.isFinite(progress) ? `${progress}%` : "unbekannt"}; dadurch besteht ein Termin- und Steuerungsrisiko.${riskText ? ` Ursache bzw. Blocker: ${riskText}.` : ""} Naechster Schritt ist die Aktualisierung des Recovery-Plans inklusive Owner, neuem Zieltermin und Managemententscheidung.`;
    recommendedAction = "prepare_recovery_plan";
  } else if (project.overallKpiLabel === "Yellow" || reasonCodes.has("progress_behind_plan") || reasonCodes.has("finish_near")) {
    statusType = "watch_schedule_risk";
    proposedStatusText = `Das Projekt ist weiterhin aktiv, weist jedoch Steuerungsbedarf auf.${Number.isFinite(progress) ? ` Der aktuelle Fortschritt liegt bei ${progress}%` : ""}${plannedProgress != null ? ` gegenueber einem erwarteten Planfortschritt von ca. ${plannedProgress}%` : ""}.${riskText ? ` Aktuelles Risiko bzw. Blocker: ${riskText}.` : ""} Naechster Schritt ist die Abstimmung konkreter Gegenmassnahmen und die Bewertung der Auswirkungen auf den Gesamttermin.`;
    recommendedAction = "define_mitigation";
  } else if (Number.isFinite(progress) && progress >= 90 && isActiveProjectCandidate(project)) {
    statusType = "closure_preparation";
    proposedStatusText = `Das Projekt befindet sich in der Abschlussphase. Der aktuelle Fortschritt liegt bei ${progress}%; die wesentlichen Arbeitspakete sind weitgehend abgeschlossen. Naechster Schritt ist die finale Validierung, Abnahmevorbereitung und Klaerung offener Restpunkte.`;
    recommendedAction = "prepare_closure";
  } else if (decisionText || sponsorText) {
    statusType = "decision_or_sponsor_action";
    proposedStatusText = `Das Projekt benoetigt eine verbindliche Klaerung fuer den naechsten Umsetzungsschritt.${decisionText ? ` Offene Entscheidung: ${decisionText}.` : ""}${sponsorText ? ` Sponsor Action: ${sponsorText}.` : ""} Ohne Klaerung besteht Risiko fuer Verzug, Nacharbeit oder Prioritaetskonflikte. Naechster Schritt ist die Entscheidung bzw. Nachverfolgung im Steering.`;
    recommendedAction = "track_decision";
  } else if (statusText && quality.severity === "ok" && ["credible", "trusted"].includes(truth.summary.level)) {
    statusType = "stable_or_kv";
    proposedStatusText = "Status unveraendert seit letztem Bericht. Es gab keine wesentlichen Aenderungen bei Fortschritt, Risiken oder Terminen. Die naechsten geplanten Aktivitaeten werden gemaess bestehender Planung fortgefuehrt.";
    recommendedAction = "review_kv_allowed";
  }

  const canUseKv = statusType === "stable_or_kv" && !riskText && !decisionText && !sponsorText;
  if (!canUseKv && statusType === "stable_or_kv") {
    reasonCodes.add("kv_requires_review");
  }
  const qualityScore = Math.max(0, Math.min(100, Math.round((quality.score + truth.summary.score + safety.safetyScore) / 3)));

  return {
    projectId: project.projectId || project.id || null,
    name: project.name || null,
    statusType,
    proposedStatusText,
    canUseKv,
    requiresReview: true,
    canAutoSave: false,
    recommendedAction,
    qualityScore,
    planning: {
      start: project.start || null,
      finish: project.finish || null,
      progress: Number.isFinite(progress) ? progress : null,
      plannedProgress,
      finishDays,
    },
    sourceSignals: {
      projectStatusLabel: project.projectStatusLabel || null,
      overallKpiLabel: project.overallKpiLabel || null,
      safetyLevel: safety.safetyLevel,
      managementAttention: safety.managementAttention,
      truthLevel: truth.summary.level,
    },
    reasonCodes: [...reasonCodes],
    dataGaps,
    evidence: quality.evidence.map((item) => ({ code: item.code, field: item.field, value: item.value, message: item.message })),
    recordUrl: project.recordUrl || null,
  };
}

function buildStatusSuggestionReport(projects, options = {}) {
  const sourceProjects = projects || [];
  const statusReport = buildPmoStatusReport(sourceProjects, options);
  const filteredIds = new Set(statusReport.projects.map((project) => project.projectId || project.id));
  const filteredProjects = sourceProjects.filter((project) => filteredIds.has(project.projectId || project.id));
  const rows = filteredProjects.map((project) => buildStatusReportSuggestion(project, options));
  return {
    reportType: "status_suggestion",
    title: "Automatic Status Suggestion Report",
    generatedAt: options.generatedAt || new Date().toISOString(),
    filters: statusReport.filters,
    summary: {
      projectsReviewed: sourceProjects.length,
      projectsMatched: rows.length,
      draftSuggestions: rows.length,
      kvAllowed: rows.filter((row) => row.canUseKv).length,
      needsReview: rows.filter((row) => row.requiresReview).length,
      managementEscalations: rows.filter((row) => ["critical_escalation", "overdue_recovery"].includes(row.statusType)).length,
      dataGaps: rows.reduce((sum, row) => sum + row.dataGaps.length, 0),
      canAutoSave: false,
    },
    sections: [
      { title: "Generation logic", text: "Creates review-only status suggestions from D365 project fields, planning dates, KPI, progress, risks, decisions, sponsor actions, and safety gates." },
      { title: "Safety", text: "Suggestions are advisory only. Missing planning or evidence fields are reported as data gaps; CRM writeback remains confirmation-gated." },
    ],
    rows,
    evidence: rows.flatMap((row) => row.evidence.map((item) => ({ ...item, projectId: row.projectId }))),
    dataGaps: rows.flatMap((row) => row.dataGaps),
  };
}

function compactBoardEvidence(projects = [], options = {}) {
  const risks = buildRiskLedgerEntries(projects, options).map((item) => ({
    evidenceType: "risk",
    projectId: item.projectId || null,
    name: item.name || null,
    code: item.evidenceCode || null,
    field: item.field || null,
    value: item.value ?? null,
    message: item.message || null,
    recordUrl: item.recordUrl || null,
  }));
  const gaps = buildEvidenceGapDetector(projects, options).items.flatMap((item) =>
    item.gaps.map((gap) => ({
      evidenceType: "data_gap",
      projectId: item.projectId || null,
      name: item.name || null,
      code: "data_gap",
      field: gap,
      value: null,
      message: `Missing evidence field: ${gap}`,
      recordUrl: item.recordUrl || null,
    }))
  );
  return [...risks, ...gaps];
}

function buildProjectSpotlights(projects = [], options = {}) {
  const safetyById = new Map(buildProjectSafetyGateSuite(projects, options).projects.map((item) => [item.projectId, item]));
  const pmoById = new Map(buildPmoControlTower(projects, options).projects.map((item) => [item.projectId, item]));
  return (projects || []).map((project) => {
    const projectId = project.projectId || project.id || null;
    const safety = safetyById.get(projectId) || {};
    const pmo = pmoById.get(projectId) || {};
    return {
      projectId,
      name: project.name || null,
      projectStatusLabel: project.projectStatusLabel || null,
      overallKpiLabel: project.overallKpiLabel || null,
      progress: project.progress ?? null,
      finish: project.finish || null,
      safetyLevel: safety.safetyLevel || null,
      managementAttention: safety.managementAttention || null,
      pmoLevel: pmo.pmoLevel || null,
      intervention: pmo.intervention || null,
      recordUrl: project.recordUrl || null,
    };
  });
}

function boardPackDataGap(project, field, message) {
  return {
    projectId: project?.projectId || project?.id || null,
    name: project?.name || null,
    field,
    message,
  };
}

function buildBoardPack(projects, options = {}) {
  const sourceProjects = projects || [];
  const today = options.today || new Date().toISOString().slice(0, 10);
  const safety = buildProjectSafetyGateSuite(sourceProjects, options);
  const pmoControl = buildPmoControlTower(sourceProjects, options);
  const statusSuggestionReport = buildStatusSuggestionReport(sourceProjects, options);
  const pmoSuite = buildPmoReportSuite(sourceProjects, options);
  const risks = buildRiskLedgerEntries(sourceProjects, options);
  const decisions = buildDecisionClosureItems(sourceProjects, options);
  const evidenceGaps = buildEvidenceGapDetector(sourceProjects, options);
  const executiveQuestions = buildExecutiveQuestionGenerator(sourceProjects, options);
  const noSurpriseForecast = buildNoSurpriseForecast(sourceProjects, options);
  const pmoUsps = buildPmoUspLayer(sourceProjects, options);
  const projectSpotlights = buildProjectSpotlights(sourceProjects, options);
  const missingRecordUrlGaps = sourceProjects
    .filter((project) => !project.recordUrl)
    .map((project) => boardPackDataGap(project, "recordUrl", "Project record URL is missing; Excel project hyperlink cannot be created."));
  const dataGaps = [
    ...evidenceGaps.items.flatMap((item) => item.gaps.map((gap) => boardPackDataGap(item, gap, `Missing evidence field: ${gap}`))),
    ...statusSuggestionReport.dataGaps,
    ...missingRecordUrlGaps,
    ...(options.statusMetadataResolved === false ? [boardPackDataGap(null, "statusUpdateMetadata", "Status Update metadata could not be resolved; status history is unavailable.")] : []),
  ];
  return {
    packType: "full_board_pack",
    source: options.source || "offline_reviewed_snapshot",
    generatedAt: options.generatedAt || new Date().toISOString(),
    today,
    executive: {
      summary: {
        projectsReviewed: sourceProjects.length,
        criticalProjects: safety.summary.criticalProjects,
        unsafeProjects: safety.summary.unsafeProjects,
        ceoAttention: safety.summary.ceoAttention,
        cioAttention: safety.summary.cioAttention,
        topRisks: risks.length,
        openDecisions: decisions.length,
      },
      topRisks: risks.slice(0, 10),
      topDecisions: decisions.slice(0, 10),
      questions: executiveQuestions.items || [],
      noSurpriseForecast,
    },
    pmo: {
      summary: pmoControl.summary,
      workQueue: pmoUsps.commandQueue || [],
      controlFindings: pmoControl.portfolioFindings || [],
      reportSuiteSummary: pmoSuite.summary,
    },
    projectLeader: {
      summary: statusSuggestionReport.summary,
      statusSuggestions: statusSuggestionReport.rows,
      queue: buildProjectNudges(sourceProjects, options),
    },
    steeringAgenda: buildSteeringAgenda(sourceProjects, options),
    decisionLog: decisions,
    riskRegister: risks,
    statusSuggestions: statusSuggestionReport.rows,
    projectSpotlights,
    evidenceLedger: compactBoardEvidence(sourceProjects, options),
    dataGaps,
    accessIssues: options.accessIssues || [],
    safety: {
      advisoryOnly: true,
      canAutoSave: false,
      crmWritesIncluded: false,
    },
  };
}

function reportDataGap(project, field, message) {
  return {
    projectId: project?.projectId || project?.id || null,
    name: project?.name || null,
    field,
    message,
  };
}

function buildReportEnvelope(reportType, projects, options, summary, rows, sections = [], evidenceItems = [], dataGaps = []) {
  return {
    reportType,
    title: PMO_REPORT_TITLES[reportType],
    generatedAt: options.generatedAt || new Date().toISOString(),
    filters: {
      projectStatusLabels: normalizeListFilter(options.projectStatusLabels || options.projectStatusLabel),
      lastStatusBefore: options.lastStatusBefore || null,
      lastStatusAfter: options.lastStatusAfter || null,
      lastStatusOn: options.lastStatusOn || null,
      lastStatusContains: options.lastStatusContains || null,
      lastStatusMissing: Boolean(options.lastStatusMissing),
    },
    summary: {
      projectsReviewed: (projects || []).length,
      ...summary,
    },
    sections,
    rows,
    evidence: evidenceItems,
    dataGaps,
  };
}

function buildPmoReport(reportType, projects, options = {}) {
  if (!PMO_REPORT_TYPES.includes(reportType)) {
    throw new Error(`Unsupported PMO report type: ${reportType}`);
  }
  const sourceProjects = projects || [];
  const statusReport = buildPmoStatusReport(sourceProjects, options);
  const filteredProjects = statusReport.projects;
  const originalById = new Map(sourceProjects.map((project) => [project.projectId || project.id || null, project]));
  const originals = filteredProjects.map((project) => originalById.get(project.projectId) || project);
  const safetySuite = statusReport.projectSafetyGates;
  const pmoTower = statusReport.pmoControlTower;

  if (reportType === "portfolio_steering") {
    const risks = buildPortfolioRiskList(originals, options);
    const decisions = buildDecisionClosureItems(originals, options);
    const rows = [
      ...risks.slice(0, 10).map((risk) => ({ type: "risk", projectId: risk.projectId, name: risk.name, priority: risk.riskLevel, action: risk.reasons.join(" ") })),
      ...decisions.slice(0, 10).map((item) => ({ type: "decision", projectId: item.projectId, name: item.name, priority: item.sla?.status || item.status, action: item.decision })),
    ];
    return buildReportEnvelope(reportType, filteredProjects, options, {
      topRisks: risks.length,
      openDecisions: decisions.length,
      ceoAttention: safetySuite.summary.ceoAttention,
      cioAttention: safetySuite.summary.cioAttention,
    }, rows, [{ title: "Steering focus", text: "Top portfolio risks and management decisions for steering review." }], rows.map((row) => ({ code: row.type, projectId: row.projectId })));
  }

  if (reportType === "decision_action_aging") {
    const decisions = buildDecisionClosureItems(originals, options);
    const commitments = buildCommitmentTracker(originals, options).items || [];
    const rows = [
      ...decisions.map((item) => ({ type: "decision", projectId: item.projectId, name: item.name, owner: item.owner, dueDate: item.dueDate, status: item.sla?.status || item.status, action: item.decision })),
      ...commitments.map((item) => ({ type: item.type || "commitment", projectId: item.projectId, name: item.name, owner: item.owner || "", dueDate: item.dueDate || "", status: item.status, action: item.commitment })),
    ];
    return buildReportEnvelope(reportType, filteredProjects, options, {
      openItems: rows.length,
      overdueItems: rows.filter((row) => row.status === "overdue").length,
    }, rows, [{ title: "Aging queue", text: "Open decisions and commitments that need owner follow-up." }], rows.map((row) => ({ code: row.type, projectId: row.projectId })));
  }

  if (reportType === "project_health_trend") {
    const snapshots = options.previousSnapshots || [];
    const rows = filteredProjects.map((project) => ({ projectId: project.projectId, name: project.name, pmoLevel: project.pmoLevel, safetyLevel: project.safetyLevel, lastStatusReportDate: project.lastStatusReportDate }));
    const dataGaps = snapshots.length ? [] : [reportDataGap(null, "previousSnapshots", "Project health trend requires previousSnapshots for historical trend lines.")];
    return buildReportEnvelope(reportType, filteredProjects, options, {
      projectsWithTrend: snapshots.length ? rows.length : 0,
      historyAvailable: Boolean(snapshots.length),
    }, rows, [{ title: "Health movement", text: snapshots.length ? "Trend source snapshots are available." : "No historical snapshots were provided." }], [], dataGaps);
  }

  if (reportType === "risk_issue_register") {
    const risks = buildRiskLedgerEntries(originals, options);
    const rows = risks.map((risk) => ({ projectId: risk.projectId, name: risk.name, status: risk.status, detectedAt: risk.detectedAt, evidenceCode: risk.evidenceCode, field: risk.field, value: risk.value }));
    return buildReportEnvelope(reportType, filteredProjects, options, {
      risks: rows.length,
      openRisks: rows.filter((row) => row.status === "open").length,
    }, rows, [{ title: "Risk register", text: "Evidence-backed risks and issues by project." }], rows.map((row) => ({ code: row.evidenceCode, projectId: row.projectId, field: row.field })));
  }

  if (reportType === "dependency_constraint") {
    const dependency = buildCrossProjectDependencyIntelligence(originals, options);
    const constraints = buildPortfolioConstraintRadar(originals, options);
    const dependencyRows = (dependency.dependencies || dependency.items || []).map((item) => ({ type: "dependency", ...item }));
    const constraintRows = (constraints.items || constraints.constraints || []).map((item) => ({ type: "constraint", ...item }));
    return buildReportEnvelope(reportType, filteredProjects, options, {
      sharedDependencies: dependency.summary?.sharedDependencies || 0,
      constraints: constraintRows.length,
    }, [...dependencyRows, ...constraintRows], [{ title: "Portfolio constraints", text: "Shared dependency, vendor, interface, owner, and resource constraints." }]);
  }

  if (reportType === "resource_capacity") {
    const rows = originals.map((project) => ({
      projectId: project.projectId || project.id || null,
      name: project.name || null,
      ownerName: project.ownerName || null,
      resourceStatusLabel: project.resourceStatusLabel || null,
      pmoLevel: pmoTower.projects.find((item) => item.projectId === (project.projectId || project.id))?.pmoLevel || null,
    }));
    const dataGaps = originals.filter((project) => !project.resourceStatusLabel).map((project) => reportDataGap(project, "resourceStatusLabel", "Resource status is missing."));
    return buildReportEnvelope(reportType, filteredProjects, options, {
      resourceRisks: rows.filter((row) => row.resourceStatusLabel === "Understaffed").length,
      missingResourceStatus: dataGaps.length,
    }, rows, [{ title: "Capacity watch", text: "Resource risk, ownership concentration, and PMO capacity signals." }], [], dataGaps);
  }

  if (reportType === "milestone_baseline_drift") {
    const snapshots = options.previousSnapshots || [];
    const rows = originals.map((project) => ({ projectId: project.projectId || project.id || null, name: project.name || null, finish: project.finish || null, progress: project.progress ?? null, projectStatusLabel: project.projectStatusLabel || null }));
    const dataGaps = originals.filter((project) => !project.finish).map((project) => reportDataGap(project, "finish", "Finish date is missing."));
    if (!snapshots.length) dataGaps.push(reportDataGap(null, "previousSnapshots", "Baseline drift requires previousSnapshots."));
    return buildReportEnvelope(reportType, filteredProjects, options, {
      milestonesTracked: rows.filter((row) => row.finish).length,
      baselineHistoryAvailable: Boolean(snapshots.length),
    }, rows, [{ title: "Milestone control", text: "Milestone dates, progress, and baseline drift readiness." }], [], dataGaps);
  }

  if (reportType === "budget_financial_risk") {
    const rows = originals.map((project) => ({ projectId: project.projectId || project.id || null, name: project.name || null, budgetStatusLabel: project.budgetStatusLabel || null, budgetRisk: project.budgetRisk || null, decisions: project.decisions || null, sponsorActions: project.sponsorActions || null }));
    const dataGaps = originals.filter((project) => !project.budgetStatusLabel && !project.budgetRisk).map((project) => reportDataGap(project, "budgetStatusLabel", "Budget status or budget risk is missing."));
    return buildReportEnvelope(reportType, filteredProjects, options, {
      budgetRisks: rows.filter((row) => row.budgetStatusLabel === "Over Budget" || row.budgetRisk).length,
      missingBudgetData: dataGaps.length,
    }, rows, [{ title: "Financial risk", text: "Budget risk, funding decisions, and scope tradeoffs." }], [], dataGaps);
  }

  if (reportType === "status_quality_compliance") {
    const benchmark = buildReportQualityBenchmark(originals, options);
    const rows = originals.map((project) => {
      const quality = evaluateStatusQuality(project, options);
      return { projectId: project.projectId || project.id || null, name: project.name || null, score: quality.score, severity: quality.severity, warnings: quality.warnings.join(" ") };
    });
    return buildReportEnvelope(reportType, filteredProjects, options, {
      averageScore: benchmark.summary.averageScore,
      lowestProjectId: benchmark.summary.lowestProjectId,
      nonCompliantProjects: rows.filter((row) => row.severity !== "ok").length,
    }, rows, [{ title: "Status compliance", text: "Status completeness, specificity, evidence, and quality warnings." }], rows.flatMap((row) => row.warnings ? [{ code: "status_quality", projectId: row.projectId }] : []));
  }

  if (reportType === "executive_exception") {
    const rows = safetySuite.projects
      .filter((project) => ["critical", "unsafe"].includes(project.safetyLevel) || ["ceo", "cio"].includes(project.managementAttention))
      .map((project) => ({ projectId: project.projectId, name: project.name, safetyLevel: project.safetyLevel, managementAttention: project.managementAttention, safetyScore: project.safetyScore, action: project.recommendedActions.join(" ") }));
    return buildReportEnvelope(reportType, filteredProjects, options, {
      exceptions: rows.length,
      ceoAttention: rows.filter((row) => row.managementAttention === "ceo").length,
      cioAttention: rows.filter((row) => row.managementAttention === "cio").length,
    }, rows, [{ title: "Executive exceptions", text: "Only projects requiring CIO/CEO attention or unsafe/critical handling." }], rows.map((row) => ({ code: "executive_exception", projectId: row.projectId })));
  }

  if (reportType === "pmo_work_queue") {
    const nudges = buildProjectNudges(originals, options);
    const rows = pmoTower.projects
      .filter((project) => project.intervention !== "none" || ["attention", "critical"].includes(project.pmoLevel))
      .map((project) => ({ projectId: project.projectId, name: project.name, pmoLevel: project.pmoLevel, intervention: project.intervention, nextAction: nudges.find((nudge) => nudge.projectId === project.projectId)?.prompt || "PMO review" }));
    return buildReportEnvelope(reportType, filteredProjects, options, {
      workItems: rows.length,
      criticalProjects: pmoTower.summary.criticalProjects,
    }, rows, [{ title: "PMO queue", text: "Daily PMO review, coaching, escalation, and follow-up queue." }], rows.map((row) => ({ code: "pmo_work_queue", projectId: row.projectId })));
  }

  if (reportType === "audit_writeback_safety") {
    const confirmation = buildHumanConfirmationAnalytics(options.confirmationEvents || []);
    const rows = originals.map((project) => {
      const simulation = buildSafeWritebackSimulation(project, options.draft || {});
      return { projectId: project.projectId || project.id || null, name: project.name || null, canAutoSave: simulation.canAutoSave, blockers: simulation.blockers.join(" "), confirmationRequired: true };
    });
    const dataGaps = (options.auditTrail || []).length ? [] : [reportDataGap(null, "auditTrail", "Audit trail is missing for writeback safety review.")];
    return buildReportEnvelope(reportType, filteredProjects, options, {
      simulatedProjects: rows.length,
      blockedWritebacks: rows.filter((row) => row.blockers).length,
      confirmationEvents: confirmation.summary.total,
    }, rows, [{ title: "Writeback safety", text: "Review-only CRM writeback simulations, confirmations, and audit readiness." }], rows.map((row) => ({ code: "writeback_simulation", projectId: row.projectId })), dataGaps);
  }

  return buildReportEnvelope(reportType, filteredProjects, options, {}, [], [], [], []);
}

function buildPmoReportSuite(projects, options = {}) {
  const reports = PMO_REPORT_TYPES.map((reportType) => buildPmoReport(reportType, projects, options));
  return {
    generatedAt: options.generatedAt || new Date().toISOString(),
    filters: reports[0]?.filters || {},
    summary: {
      reportCount: reports.length,
      reportTypes: PMO_REPORT_TYPES,
      projectsReviewed: (projects || []).length,
      totalDataGaps: reports.reduce((sum, report) => sum + report.dataGaps.length, 0),
    },
    reports,
  };
}

function proofMetric(name, currentValue, target, status) {
  return { name, currentValue, target, status };
}

function uspReadiness(statuses) {
  if (statuses.includes("blocked")) return "blocked";
  if (statuses.includes("needs_data")) return "needs_data";
  if (statuses.includes("watch")) return "watch";
  return "ready";
}

function pmoUspDataGap(uspId, field, message, project = null) {
  return {
    uspId,
    projectId: project?.projectId || project?.id || null,
    name: project?.name || null,
    field,
    message,
  };
}

function pmoUspObject(input) {
  return {
    id: input.id,
    title: input.title,
    targetUser: input.targetUser,
    painSolved: input.painSolved,
    concreteBenefit: input.concreteBenefit,
    technicalMechanism: input.technicalMechanism,
    requiredData: input.requiredData || [],
    runtimeSignals: input.runtimeSignals || {},
    recommendedActions: input.recommendedActions || [],
    dataGaps: input.dataGaps || [],
    proofMetric: input.proofMetric,
    risksAndTrustControls: input.risksAndTrustControls || ["advisory_only", "human_review_required", "no_automatic_crm_write"],
    feasibility: input.feasibility || "high",
    implementationStatus: "implemented",
    advisoryOnly: true,
  };
}

function buildPmoCommandQueueFromSignals(projects, signals, options = {}) {
  const today = options.today || new Date().toISOString().slice(0, 10);
  const items = [];
  for (const row of signals.workQueue.rows || []) {
    items.push({
      id: `${row.projectId || "portfolio"}::pmo_work_queue`,
      projectId: row.projectId || null,
      name: row.name || null,
      action: row.nextAction || "PMO review",
      owner: "PMO",
      dueDate: today,
      priority: row.pmoLevel === "critical" ? "critical" : "high",
      source: "pmo_work_queue",
      evidenceCodes: ["pmo_work_queue"],
    });
  }
  for (const item of signals.decisionDebt.items || []) {
    if (["overdue", "due_today"].includes(item.sla?.status)) {
      items.push({
        id: `${item.id}::decision_sla`,
        projectId: item.projectId || null,
        name: item.name || null,
        action: `Close decision: ${item.decision}`,
        owner: item.owner || "PMO",
        dueDate: item.dueDate || today,
        priority: item.sla.status === "overdue" ? "critical" : "high",
        source: "decision_sla_enforcement",
        evidenceCodes: ["decision_sla"],
      });
    }
  }
  for (const finding of signals.safetySuite.topFindings || []) {
    items.push({
      id: `${finding.projectId || "portfolio"}::${finding.checkId}`,
      projectId: finding.projectId || null,
      name: finding.name || null,
      action: finding.message || "Review safety finding",
      owner: finding.severity === "critical" ? "CIO" : "PMO",
      dueDate: today,
      priority: finding.severity === "critical" ? "critical" : "high",
      source: "project_safety_gate",
      evidenceCodes: [finding.checkId],
    });
  }
  const rank = { critical: 0, high: 1, medium: 2, low: 3 };
  return items
    .sort((left, right) => (rank[left.priority] ?? 9) - (rank[right.priority] ?? 9))
    .slice(0, 50);
}

function buildPmoEvidenceLedgerFromSignals(projects, signals, options = {}) {
  const today = options.today || new Date().toISOString().slice(0, 10);
  return (signals.safetySuite.projects || []).flatMap((project) =>
    (project.gates || [])
      .filter((gate) => gate.status !== "pass" || gate.evidenceCodes?.length || gate.missingFields?.length)
      .map((gate) => ({
        projectId: project.projectId,
        name: project.name,
        source: "project_safety_gate",
        code: gate.checkId,
        severity: gate.severity,
        status: gate.status,
        message: gate.message,
        evidenceCodes: gate.evidenceCodes || [],
        missingFields: gate.missingFields || [],
        recordUrl: (projects || []).find((candidate) => (candidate.projectId || candidate.id) === project.projectId)?.recordUrl || null,
        observedAt: today,
      }))
  ).slice(0, 100);
}

function buildRiskAgingMemorySignals(projects, options = {}) {
  const currentRisks = buildRiskLedgerEntries(projects, options).reduce((rows, item) => {
    let row = rows.find((candidate) => candidate.projectId === item.projectId);
    if (!row) {
      row = { projectId: item.projectId, risks: [], detectedAt: item.detectedAt };
      rows.push(row);
    }
    row.risks.push(item.message || item.evidenceCode);
    return rows;
  }, []);
  const previousRisks = (options.previousSnapshots || []).flatMap((snapshot) => {
    if (Array.isArray(snapshot.riskLedger)) {
      return snapshot.riskLedger.reduce((rows, item) => {
        let row = rows.find((candidate) => candidate.projectId === item.projectId);
        if (!row) {
          row = { projectId: item.projectId, risks: [], detectedAt: item.detectedAt };
          rows.push(row);
        }
        row.risks.push(item.message || item.evidenceCode || item.risk || "");
        return rows;
      }, []);
    }
    if (Array.isArray(snapshot.risks)) return snapshot.risks;
    return [];
  });
  const drift = buildRiskNarrativeDrift(previousRisks, currentRisks);
  const recurring = currentRisks.filter((current) => previousRisks.some((previous) => previous.projectId === current.projectId)).length;
  return {
    summary: {
      currentRiskProjects: currentRisks.length,
      previousRiskProjects: previousRisks.length,
      recurringRiskProjects: recurring,
      driftItems: drift.summary.driftItems,
    },
    currentRisks,
    driftItems: drift.items,
  };
}

function buildBaselineDriftSignals(projects, options = {}) {
  const previousProjects = (options.previousSnapshots || []).flatMap((snapshot) => snapshot.projects || snapshot.preview || []);
  const items = (projects || []).map((project) => {
    const projectId = project.projectId || project.id || null;
    const previous = previousProjects.find((candidate) => (candidate.projectId || candidate.id) === projectId) || null;
    const previousProgress = Number(previous?.progress);
    const currentProgress = Number(project.progress);
    return {
      projectId,
      name: project.name || null,
      baselineAvailable: Boolean(previous),
      previousFinish: previous?.finish || null,
      currentFinish: project.finish || null,
      finishChanged: Boolean(previous?.finish && project.finish && previous.finish !== project.finish),
      progressDelta: Number.isFinite(previousProgress) && Number.isFinite(currentProgress) ? currentProgress - previousProgress : null,
    };
  });
  return {
    summary: {
      projectsReviewed: items.length,
      baselineProjects: items.filter((item) => item.baselineAvailable).length,
      finishDrifts: items.filter((item) => item.finishChanged).length,
      missingBaselines: items.filter((item) => !item.baselineAvailable).length,
    },
    items,
  };
}

function buildPmoBoardPackDiffSignals(currentPack, options = {}) {
  const previousPack = options.previousPack || null;
  if (!previousPack) {
    return {
      summary: { previousPackAvailable: false, newRisks: 0, resolvedRisks: 0, newDecisions: 0, resolvedDecisions: 0 },
      diff: null,
    };
  }
  const diff = buildPortfolioNarrativeDiff(previousPack, currentPack);
  return {
    summary: { previousPackAvailable: true, ...diff.summary },
    diff,
  };
}

function buildPmoUspLayer(projects = [], options = {}) {
  const activeProjects = (projects || []).filter(isActiveProjectCandidate);
  const safetySuite = buildProjectSafetyGateSuite(activeProjects, options);
  const pmoTower = buildPmoControlTower(activeProjects, options);
  const decisionDebt = buildDecisionDebtAnalysis(activeProjects, options);
  const decisionSla = buildDecisionSlaCockpit(activeProjects, options);
  const dependencyIntel = buildCrossProjectDependencyIntelligence(activeProjects, options);
  const noSurprise = buildNoSurpriseForecast(activeProjects, options);
  const pmCoach = buildProjectManagerQualityCoach(activeProjects, options);
  const governanceExceptions = buildGovernanceExceptions(activeProjects, options);
  const dataCompleteness = activeProjects.map(buildDataCompletenessScore);
  const evidenceGaps = buildEvidenceGapDetector(activeProjects, options);
  const pmoSuite = buildPmoReportSuite(activeProjects, options);
  const workQueue = buildPmoReport("pmo_work_queue", activeProjects, options);
  const budgetReport = buildPmoReport("budget_financial_risk", activeProjects, options);
  const milestoneReport = buildPmoReport("milestone_baseline_drift", activeProjects, options);
  const writebackReport = buildPmoReport("audit_writeback_safety", activeProjects, options);
  const executiveQuestions = buildExecutiveQuestionGenerator(activeProjects, options);
  const portfolioRisks = buildPortfolioRiskList(activeProjects, options);
  const steeringAgenda = buildSteeringAgenda(activeProjects, options);
  const riskAging = buildRiskAgingMemorySignals(activeProjects, options);
  const baselineDrift = buildBaselineDriftSignals(activeProjects, options);
  const currentPack = {
    portfolioRisks,
    decisionClosureItems: buildDecisionClosureItems(activeProjects, options),
    riskLedger: buildRiskLedgerEntries(activeProjects, options),
  };
  const boardDiff = buildPmoBoardPackDiffSignals(currentPack, options);
  const signals = { safetySuite, pmoTower, decisionDebt, decisionSla, dependencyIntel, noSurprise, pmCoach, governanceExceptions, dataCompleteness, evidenceGaps, pmoSuite, workQueue, budgetReport, milestoneReport, writebackReport, executiveQuestions, portfolioRisks, steeringAgenda, riskAging, baselineDrift, boardDiff };
  const commandQueue = buildPmoCommandQueueFromSignals(activeProjects, signals, options);
  const evidenceLedger = buildPmoEvidenceLedgerFromSignals(activeProjects, signals, options);
  const dataGaps = [
    ...pmoSuite.reports.flatMap((report) => (report.dataGaps || []).map((gap) => ({ ...gap, uspId: "evidence_backed_reports", reportType: report.reportType }))),
    ...(!options.previousSnapshots?.length ? [
      pmoUspDataGap("risk_aging_memory", "previousSnapshots", "Risk aging memory needs previousSnapshots for recurring/stale risk detection."),
      pmoUspDataGap("baseline_drift_watch", "previousSnapshots", "Baseline drift watch needs previousSnapshots for finish/progress drift."),
    ] : []),
    ...(!options.previousPack ? [pmoUspDataGap("pmo_board_pack_diff", "previousPack", "PMO board pack diff needs previousPack.")] : []),
  ];
  const executiveAttentionItems = safetySuite.summary.cioAttention + safetySuite.summary.ceoAttention;
  const criticalWorkItems = commandQueue.filter((item) => item.priority === "critical").length;
  const definitions = [
    pmoUspObject({
      id: "pmo_command_queue",
      title: "PMO Command Queue",
      targetUser: "PMO operator",
      painSolved: "PMO work is hidden across reports, findings, decisions, and nudges.",
      concreteBenefit: "Creates one prioritized queue with action, owner, due date, source, and evidence.",
      technicalMechanism: "Combines PMO Work Queue rows, overdue decision SLAs, and critical safety findings.",
      requiredData: ["PMO checks", "Safety Gates", "decisions", "ownerName"],
      runtimeSignals: { workItems: commandQueue.length, criticalWorkItems },
      recommendedActions: commandQueue.slice(0, 10).map((item) => item.action),
      proofMetric: proofMetric("pmo_command_queue_items", commandQueue.length, "All PMO interventions become queued actions", commandQueue.length ? "watch" : "ready"),
    }),
    pmoUspObject({
      id: "steering_committee_auto_pack",
      title: "Steering Committee Auto-Pack",
      targetUser: "PMO lead and steering committee",
      painSolved: "Steering preparation requires manual consolidation of risks, agenda items, questions, and data gaps.",
      concreteBenefit: "Builds an executive pack source with agenda, top risks, decisions, questions, and gaps.",
      technicalMechanism: "Combines Steering Agenda, Portfolio Risk List, Executive Questions, Decision Debt, and Evidence Gaps.",
      requiredData: ["overallKpiLabel", "lastStatusUpdate", "decisions", "sponsorActions", "obstaclesAndMeasures"],
      runtimeSignals: { agendaItems: steeringAgenda.length, topRisks: portfolioRisks.length, executiveQuestions: executiveQuestions.items.length, dataGaps: evidenceGaps.summary.totalGaps },
      recommendedActions: steeringAgenda.slice(0, 10).map((item) => item.agendaItem),
      dataGaps: evidenceGaps.items.flatMap((item) => item.gaps.map((gap) => pmoUspDataGap("steering_committee_auto_pack", gap, "Evidence gap affects steering readiness.", item))),
      proofMetric: proofMetric("steering_pack_inputs", steeringAgenda.length + portfolioRisks.length + executiveQuestions.items.length, "All steering inputs generated from project evidence", steeringAgenda.length || portfolioRisks.length ? "watch" : "ready"),
    }),
    pmoUspObject({
      id: "decision_sla_enforcement",
      title: "Decision SLA Enforcement",
      targetUser: "PMO lead and CIO",
      painSolved: "Decisions age without explicit SLA status and escalation level.",
      concreteBenefit: "Shows overdue, due-today, and upcoming decisions with owner and project impact.",
      technicalMechanism: "Uses Decision SLA Cockpit and Decision Debt Analysis.",
      requiredData: ["decisions", "decisionOwner", "decisionDueDate"],
      runtimeSignals: { ...decisionSla.summary, decisionDebtScore: decisionDebt.summary.decisionDebtScore },
      recommendedActions: decisionDebt.items.slice(0, 10).map((item) => `Close decision for ${item.name}: ${item.decision}`),
      proofMetric: proofMetric("overdue_decisions", decisionSla.summary.overdue, "No overdue decision without PMO action", decisionSla.summary.overdue ? "watch" : "ready"),
    }),
    pmoUspObject({
      id: "risk_aging_memory",
      title: "Risk Aging Memory",
      targetUser: "PMO risk manager",
      painSolved: "Recurring risks can be reworded and appear new.",
      concreteBenefit: "Identifies recurring risk projects and narrative drift across snapshots.",
      technicalMechanism: "Builds current risk ledger rows and compares them with previous snapshot risk ledgers.",
      requiredData: ["riskLedger", "previousSnapshots", "obstaclesAndMeasures", "lastStatusUpdate"],
      runtimeSignals: riskAging.summary,
      dataGaps: !options.previousSnapshots?.length ? [pmoUspDataGap("risk_aging_memory", "previousSnapshots", "Previous snapshots are required for risk aging memory.")] : [],
      recommendedActions: riskAging.driftItems.slice(0, 10).map((item) => `Review recurring risk wording for ${item.projectId}`),
      proofMetric: proofMetric("recurring_risk_projects", riskAging.summary.recurringRiskProjects, "Recurring risks are visible instead of reset", options.previousSnapshots?.length ? (riskAging.summary.recurringRiskProjects ? "watch" : "ready") : "needs_data"),
    }),
    pmoUspObject({
      id: "pm_quality_coaching",
      title: "PM Quality Coaching",
      targetUser: "PMO coach",
      painSolved: "Status-quality weaknesses are not aggregated by project manager.",
      concreteBenefit: "Creates PM coaching signals and recommended interventions by owner.",
      technicalMechanism: "Uses Project Manager Quality Coach, Status Quality, and blocked kv signals.",
      requiredData: ["ownerName", "projectManagerName", "overallKpiLabel", "lastStatusUpdate"],
      runtimeSignals: pmCoach.summary,
      recommendedActions: pmCoach.items.map((item) => item.recommendedIntervention),
      dataGaps: activeProjects.filter((project) => !project.ownerName && !project.projectManagerName).map((project) => pmoUspDataGap("pm_quality_coaching", "ownerName", "Project manager or owner is missing.", project)),
      proofMetric: proofMetric("owners_reviewed_for_coaching", pmCoach.summary.owners, "Every owner receives quality review", pmCoach.summary.owners ? "ready" : "needs_data"),
    }),
    pmoUspObject({
      id: "portfolio_bottleneck_detector",
      title: "Portfolio Bottleneck Detector",
      targetUser: "PMO lead and program manager",
      painSolved: "Shared bottlenecks are hidden inside individual project narratives.",
      concreteBenefit: "Finds vendor, dependency, owner, resource, and decision bottlenecks across projects.",
      technicalMechanism: "Combines Portfolio Constraint Radar and Cross-Project Dependency Intelligence.",
      requiredData: ["dependencyName", "vendorName", "ownerName", "resourceStatusLabel", "decisions"],
      runtimeSignals: { constraintSummary: buildPortfolioConstraintRadar(activeProjects, options).summary, dependencySummary: dependencyIntel.summary },
      recommendedActions: dependencyIntel.items.filter((item) => item.hasRisk).map((item) => `Resolve shared dependency: ${item.dependency}`),
      proofMetric: proofMetric("dependencies_with_risk", dependencyIntel.summary.dependenciesWithRisk, "Shared dependency risks have affected projects listed", dependencyIntel.summary.dependenciesWithRisk ? "watch" : "ready"),
    }),
    pmoUspObject({
      id: "governance_exception_radar",
      title: "Governance Exception Radar",
      targetUser: "PMO governance owner",
      painSolved: "Policy exceptions and missing governance evidence are found late.",
      concreteBenefit: "Lists governance exceptions with severity, evidence, and PMO action.",
      technicalMechanism: "Uses Governance Exceptions and PMO Policy Simulator.",
      requiredData: ["overallKpiLabel", "decisions", "sponsorActions", "recordUrl"],
      runtimeSignals: { exceptions: governanceExceptions.length, policyViolations: buildPmoPolicySimulator(activeProjects, { ...options, policies: options.policies || [{ id: "red_requires_sponsor_action", severity: "critical" }] }).summary.violations },
      recommendedActions: governanceExceptions.map((item) => item.recommendedAction || "Review governance exception"),
      proofMetric: proofMetric("governance_exceptions", governanceExceptions.length, "All governance exceptions visible to PMO", governanceExceptions.length ? "watch" : "ready"),
    }),
    pmoUspObject({
      id: "pmo_data_quality_score",
      title: "PMO Data Quality Score",
      targetUser: "PMO analyst",
      painSolved: "Poor project data reaches management packs without being marked.",
      concreteBenefit: "Scores management readiness and exposes missing fields and trust levels.",
      technicalMechanism: "Combines Data Completeness, Evidence Gap Detector, Project Truth Score, and Report Quality Benchmark.",
      requiredData: ["recordUrl", "projectStatusLabel", "overallKpiLabel", "finish", "lastStatusUpdate"],
      runtimeSignals: { averageScore: buildReportQualityBenchmark(activeProjects, options).summary.averageScore, projectsWithGaps: evidenceGaps.summary.projectsWithGaps, totalGaps: evidenceGaps.summary.totalGaps },
      dataGaps: dataCompleteness.flatMap((item) => item.missingFields.map((field) => pmoUspDataGap("pmo_data_quality_score", field, "Required PMO data field is missing.", item))),
      recommendedActions: evidenceGaps.items.map((item) => `Complete evidence for ${item.name || item.projectId}`),
      proofMetric: proofMetric("pmo_data_gaps", evidenceGaps.summary.totalGaps, "All missing PMO data is visible", evidenceGaps.summary.totalGaps ? "watch" : "ready"),
    }),
    pmoUspObject({
      id: "executive_attention_routing",
      title: "Executive Attention Routing",
      targetUser: "PMO lead, CIO, CFO, CEO",
      painSolved: "Escalations are routed to the wrong management level.",
      concreteBenefit: "Routes projects to PMO, CIO, CFO, or CEO with reason signals.",
      technicalMechanism: "Uses Safety Gate management attention plus budget/resource/dependency report signals.",
      requiredData: ["overallKpiLabel", "budgetStatusLabel", "resourceStatusLabel", "dependencyStatusLabel", "sponsorActions"],
      runtimeSignals: { pmo: safetySuite.summary.pmoAttention, cio: safetySuite.summary.cioAttention, ceo: safetySuite.summary.ceoAttention, budgetRisks: budgetReport.summary.budgetRisks },
      recommendedActions: safetySuite.projects.filter((item) => item.managementAttention !== "none").map((item) => `Route ${item.name || item.projectId} to ${item.managementAttention.toUpperCase()}`),
      proofMetric: proofMetric("executive_attention_items", executiveAttentionItems, "All executive attention items routed", executiveAttentionItems ? "watch" : "ready"),
    }),
    pmoUspObject({
      id: "baseline_drift_watch",
      title: "Baseline Drift Watch",
      targetUser: "PMO scheduler",
      painSolved: "Finish and progress drift are invisible without comparing snapshots.",
      concreteBenefit: "Flags finish drift, progress drift, and missing baseline data.",
      technicalMechanism: "Compares current project finish/progress against previous snapshot project rows.",
      requiredData: ["finish", "progress", "previousSnapshots"],
      runtimeSignals: baselineDrift.summary,
      dataGaps: baselineDrift.summary.missingBaselines ? [pmoUspDataGap("baseline_drift_watch", "previousSnapshots", "Previous project baselines are missing or incomplete.")] : [],
      recommendedActions: baselineDrift.items.filter((item) => item.finishChanged).map((item) => `Review baseline drift for ${item.name || item.projectId}`),
      proofMetric: proofMetric("finish_drifts", baselineDrift.summary.finishDrifts, "Every baseline drift is visible", options.previousSnapshots?.length ? (baselineDrift.summary.finishDrifts ? "watch" : "ready") : "needs_data"),
    }),
    pmoUspObject({
      id: "writeback_audit_shield",
      title: "Writeback Audit Shield",
      targetUser: "Project leader and CRM process owner",
      painSolved: "CRM writes can be staged without a clear blocker and audit preview.",
      concreteBenefit: "Shows dry-run blockers, confirmation requirements, and audit previews before save.",
      technicalMechanism: "Uses Safe Writeback Simulation Pro and audit writeback safety report.",
      requiredData: ["draft.fields", "emailStatusUpdate", "submittedTo", "projectManagerVerified", "auditTrail"],
      runtimeSignals: { ...writebackReport.summary, canAutoSave: false },
      dataGaps: writebackReport.dataGaps.map((gap) => ({ ...gap, uspId: "writeback_audit_shield" })),
      recommendedActions: ["Keep canAutoSave false.", "Require exact confirmation before CRM save."],
      proofMetric: proofMetric("can_auto_save", false, "CRM writeback never auto-saves", "ready"),
    }),
    pmoUspObject({
      id: "pmo_evidence_ledger",
      title: "PMO Evidence Ledger",
      targetUser: "PMO analyst and audit reviewer",
      painSolved: "Evidence is scattered across reports, safety gates, and status fields.",
      concreteBenefit: "Creates a ledger of evidence codes, source fields, URLs, gaps, and observed dates.",
      technicalMechanism: "Collects non-pass Safety Gate evidence and missing fields into a portfolio ledger.",
      requiredData: ["recordUrl", "Safety Gates", "evidenceCodes", "source fields"],
      runtimeSignals: { ledgerItems: evidenceLedger.length, dataGaps: dataGaps.length },
      dataGaps: evidenceLedger.filter((item) => !item.recordUrl).map((item) => pmoUspDataGap("pmo_evidence_ledger", "recordUrl", "Record URL is missing for evidence ledger.", item)),
      recommendedActions: evidenceLedger.slice(0, 10).map((item) => item.message),
      proofMetric: proofMetric("evidence_ledger_items", evidenceLedger.length, "All PMO findings have evidence ledger entries", evidenceLedger.length ? "ready" : "watch"),
    }),
    pmoUspObject({
      id: "no_surprise_portfolio_forecast",
      title: "No-Surprise Portfolio Forecast",
      targetUser: "CIO, CEO, and PMO lead",
      painSolved: "Likely escalations are detected after the reporting cycle.",
      concreteBenefit: "Identifies likely escalations and silent risks before steering.",
      technicalMechanism: "Uses No-Surprise Forecast, Safety Gates, and Escalation Readiness.",
      requiredData: ["overallKpiLabel", "finish", "lastStatusUpdate", "obstaclesAndMeasures", "decisions"],
      runtimeSignals: noSurprise.summary,
      recommendedActions: noSurprise.items.filter((item) => item.forecast !== "stable").map((item) => `Review forecast for ${item.name || item.projectId}`),
      proofMetric: proofMetric("likely_escalations", noSurprise.summary.likelyToEscalate, "No likely escalation hidden from PMO", noSurprise.summary.likelyToEscalate ? "watch" : "ready"),
    }),
    pmoUspObject({
      id: "dependency_blast_radius",
      title: "Dependency Blast Radius",
      targetUser: "PMO lead and program manager",
      painSolved: "The portfolio impact of a blocked dependency is not visible.",
      concreteBenefit: "Shows shared dependencies, affected projects, and risk drivers.",
      technicalMechanism: "Uses Cross-Project Dependency Intelligence and Safety Gate dependency findings.",
      requiredData: ["dependencyName", "dependencyStatusLabel", "obstaclesAndMeasures"],
      runtimeSignals: dependencyIntel.summary,
      recommendedActions: dependencyIntel.items.filter((item) => item.hasRisk).map((item) => `Coordinate dependency resolution for ${item.dependency}`),
      proofMetric: proofMetric("shared_dependency_risks", dependencyIntel.summary.dependenciesWithRisk, "Every shared dependency risk lists affected projects", dependencyIntel.summary.dependenciesWithRisk ? "watch" : "ready"),
    }),
    pmoUspObject({
      id: "pmo_board_pack_diff",
      title: "PMO Board Pack Diff",
      targetUser: "PMO lead and steering committee",
      painSolved: "Management packs do not clearly show what changed since the last board.",
      concreteBenefit: "Highlights new, worsened, and resolved risks or decisions between packs.",
      technicalMechanism: "Compares previousPack with the current risk and decision pack using portfolio narrative diff.",
      requiredData: ["previousPack", "current portfolioRisks", "current decisionClosureItems"],
      runtimeSignals: boardDiff.summary,
      dataGaps: !options.previousPack ? [pmoUspDataGap("pmo_board_pack_diff", "previousPack", "Previous board pack is required for diff output.")] : [],
      recommendedActions: boardDiff.diff ? ["Review new and resolved PMO board-pack deltas."] : ["Provide previousPack to enable board-pack diff."],
      proofMetric: proofMetric("previous_pack_available", Boolean(options.previousPack), "Board pack diff has a previous pack", options.previousPack ? "ready" : "needs_data"),
    }),
  ];
  const byId = new Map(definitions.map((item) => [item.id, item]));
  const usps = PMO_USP_IDS.map((id) => byId.get(id));
  return {
    layerType: "pmo_usps",
    generatedAt: options.generatedAt || new Date().toISOString(),
    summary: {
      uspCount: usps.length,
      implemented: usps.filter((item) => item.implementationStatus === "implemented").length,
      projectsReviewed: activeProjects.length,
      criticalWorkItems,
      dataGaps: dataGaps.length,
      executiveAttentionItems,
      safetyPosture: "advisory_only_confirmation_gated",
    },
    usps,
    commandQueue,
    evidenceLedger,
    dataGaps,
  };
}

function buildMaximumUspLayer(projects = [], options = {}) {
  const activeProjects = (projects || []).filter(isActiveProjectCandidate);
  const safetySuite = buildProjectSafetyGateSuite(activeProjects, options);
  const noSurprise = buildNoSurpriseForecast(activeProjects, options);
  const truthScores = activeProjects.map((project) => buildProjectTruthScore(project, options));
  const decisionDebt = buildDecisionDebtAnalysis(activeProjects, options);
  const pmoSuite = buildPmoReportSuite(activeProjects, options);
  const dependencyIntel = buildCrossProjectDependencyIntelligence(activeProjects, options);
  const pmCoach = buildProjectManagerQualityCoach(activeProjects, options);
  const budgetReport = buildPmoReport("budget_financial_risk", activeProjects, options);
  const workQueue = buildPmoReport("pmo_work_queue", activeProjects, options);
  const writebackReport = buildPmoReport("audit_writeback_safety", activeProjects, options);
  const escalationPacks = buildPortfolioRiskList(activeProjects, options).map((risk) => {
    const project = activeProjects.find((candidate) => (candidate.projectId || candidate.id) === risk.projectId);
    return buildAiEscalationPack(project, options);
  });
  const trustContracts = activeProjects.map((project) => buildTrustContract(project, options));
  const writebackSimulations = activeProjects.map((project) => buildSafeWritebackSimulationPro(project, options.draft || {}));
  const criticalOrUnsafe = safetySuite.summary.criticalProjects + safetySuite.summary.unsafeProjects;
  const managementAttention = safetySuite.summary.pmoAttention + safetySuite.summary.cioAttention + safetySuite.summary.ceoAttention;
  const totalDataGaps = pmoSuite.summary.totalDataGaps;
  const blockedWritebacks = writebackReport.summary.blockedWritebacks || 0;
  const sharedDependencyRisks = dependencyIntel.items.filter((item) => item.hasRisk).length;
  const lowTruthProjects = truthScores.filter((item) => item.summary.level !== "trusted").length;

  const definitions = [
    {
      id: "pmo_safety_radar",
      title: "PMO Safety Radar",
      targetUser: "PMO lead",
      painSolved: "PMO teams see red projects too late and cannot tell whether weak data, real delivery risk, or missing decisions are driving the issue.",
      concreteBenefit: "Ranks projects by safety level and management attention before status collection or staging.",
      technicalMechanism: "Aggregates Project Safety Gates, PMO Control Tower signals, evidence codes, and management-attention routing.",
      requiredData: ["projectStatusLabel", "overallKpiLabel", "progress", "finish", "lastStatusUpdate", "recordUrl"],
      whyDifferentiated: "Combines data-quality gates and delivery/governance checks instead of showing a passive traffic-light dashboard.",
      mvpImplementation: "Expose `maximumUsps.usps[pmo_safety_radar]` from `buildProjectIntelligence` with safety counts and top findings.",
      risksAndTrustControls: ["advisory_only", "evidence_codes_visible", "no_automatic_crm_block"],
      proofMetric: proofMetric("critical_or_unsafe_projects_identified", criticalOrUnsafe, "All unsafe/critical projects visible before PMO review", criticalOrUnsafe ? "watch" : "ready"),
      runtimeSignals: {
        safetySummary: safetySuite.summary,
        topFindings: safetySuite.topFindings.slice(0, 5),
      },
      feasibility: "high",
      uspScore: 94,
    },
    {
      id: "executive_no_surprise_brief",
      title: "Executive No-Surprise Brief",
      targetUser: "CIO and CEO",
      painSolved: "Executives get escalations after the steering window has already been lost.",
      concreteBenefit: "Surfaces projects likely to escalate, silent risks, and overdue decisions for the next management cycle.",
      technicalMechanism: "Combines No-Surprise Forecast, Decision SLA Cockpit, Safety Gates, and escalation readiness.",
      requiredData: ["overallKpiLabel", "finish", "lastStatusUpdate", "decisions", "sponsorActions", "obstaclesAndMeasures"],
      whyDifferentiated: "Turns status data into a forward-looking exception brief, not a historical report.",
      mvpImplementation: "Use `noSurpriseForecast.summary` and `decisionDebtAnalysis.summary` as the executive exception source.",
      risksAndTrustControls: ["forecast_drivers_listed", "human_review_required", "no_auto_escalation"],
      proofMetric: proofMetric("likely_escalations_detected", noSurprise.summary.likelyToEscalate, "No likely escalation hidden from executive brief", noSurprise.summary.likelyToEscalate ? "watch" : "ready"),
      runtimeSignals: {
        noSurpriseSummary: noSurprise.summary,
        decisionDebtSummary: decisionDebt.summary,
      },
      feasibility: "high",
      uspScore: 93,
    },
    {
      id: "status_truth_audit",
      title: "Status Truth Audit",
      targetUser: "PMO controller",
      painSolved: "Greenwashing, vague status text, and contradictory KPI narratives are hard to detect manually.",
      concreteBenefit: "Flags KPI/text/progress/finish contradictions and blocks risky `kv` from being treated as harmless.",
      technicalMechanism: "Runs status delta detection, project truth scores, and status-truth safety gates.",
      requiredData: ["overallKpiLabel", "lastStatusUpdate", "currentStatusText", "progress", "finish", "plannedActivities"],
      whyDifferentiated: "Audits status credibility at field level with evidence codes rather than relying on the selected KPI.",
      mvpImplementation: "Expose low-trust projects, `kv_blocked` count, and contradiction evidence in the intelligence JSON.",
      risksAndTrustControls: ["source_fields_visible", "false_positive_review", "project_leader_can_explain"],
      proofMetric: proofMetric("non_trusted_statuses", lowTruthProjects, "All non-trusted statuses visible to PMO", lowTruthProjects ? "watch" : "ready"),
      runtimeSignals: {
        lowTruthProjects,
        truthScores: truthScores.slice(0, 10),
      },
      feasibility: "high",
      uspScore: 92,
    },
    {
      id: "monthly_writeback_guard",
      title: "Monthly Writeback Guard",
      targetUser: "Project leader",
      painSolved: "Monthly status updates need to be efficient, but incorrect CRM saves are high-risk.",
      concreteBenefit: "Creates monthly writeback plans while keeping every CRM save gated by exact confirmation.",
      technicalMechanism: "Uses duplicate checks, idempotency keys, project-manager verification, safety gates, and confirmation text.",
      requiredData: ["projectId", "name", "recordUrl", "reportMonth", "statusText", "submittedTo"],
      whyDifferentiated: "Supports productive monthly status work without turning the CLI into an uncontrolled CRM writer.",
      mvpImplementation: "Use `--monthly-status-plan` and include the writeback safety gates in project intelligence.",
      risksAndTrustControls: ["exact_confirmation_text", "email_status_update_separate_risk", "canAutoSave_false"],
      proofMetric: proofMetric("writebacks_blocked_until_confirmation", safetySuite.projects.filter((item) => item.writebackRisk === "blocked_until_confirmation").length, "100% of CRM writes require confirmation", "ready"),
      runtimeSignals: {
        writebackRiskCounts: safetySuite.projects.reduce((counts, item) => {
          counts[item.writebackRisk] = (counts[item.writebackRisk] || 0) + 1;
          return counts;
        }, {}),
      },
      feasibility: "high",
      uspScore: 91,
    },
    {
      id: "decision_debt_ledger",
      title: "Decision Debt Ledger",
      targetUser: "PMO lead and CIO",
      painSolved: "Open decisions age silently and become delivery blockers without clear ownership.",
      concreteBenefit: "Shows open, due-today, overdue, and blocked-project decisions with debt score.",
      technicalMechanism: "Uses Decision Closure Items, Decision SLA Cockpit, and decision-debt scoring.",
      requiredData: ["decisions", "decisionOwner", "decisionDueDate", "sponsorActions"],
      whyDifferentiated: "Makes decision latency a measurable portfolio risk instead of free-text noise.",
      mvpImplementation: "Expose `decisionDebtAnalysis` and the `decision_action_aging` PMO report.",
      risksAndTrustControls: ["owner_default_visible", "sla_status_visible", "manual_closure_required"],
      proofMetric: proofMetric("decision_debt_score", decisionDebt.summary.decisionDebtScore, "Decision debt below 40", decisionDebt.summary.decisionDebtScore >= 40 ? "watch" : "ready"),
      runtimeSignals: {
        decisionDebtSummary: decisionDebt.summary,
        topItems: decisionDebt.items.slice(0, 10),
      },
      feasibility: "high",
      uspScore: 90,
    },
    {
      id: "evidence_backed_pmo_reports",
      title: "Evidence-Backed PMO Reports",
      targetUser: "PMO analyst and steering committee",
      painSolved: "Management reports often hide missing source data or fill gaps with manually invented assumptions.",
      concreteBenefit: "Every report carries evidence and data gaps so steering packs remain auditable.",
      technicalMechanism: "Uniform PMO report envelopes with `evidence[]`, `dataGaps[]`, filters, sections, rows, DOCX, and XLSX outputs.",
      requiredData: ["live D365 API data", "recordUrl", "status fields", "optional budget/resource/snapshot fields"],
      whyDifferentiated: "The report contract exposes missing data explicitly instead of silently degrading report quality.",
      mvpImplementation: "Use `buildPmoReportSuite` and surface total data gaps in `maximumUsps`.",
      risksAndTrustControls: ["no_mock_productive_data", "data_gaps_not_fake_values", "d365_api_required_for_production"],
      proofMetric: proofMetric("report_data_gaps_visible", totalDataGaps, "All missing optional report fields listed as data gaps", "ready"),
      runtimeSignals: {
        reportCount: pmoSuite.summary.reportCount,
        totalDataGaps,
        reportTypes: pmoSuite.summary.reportTypes,
      },
      feasibility: "high",
      uspScore: 89,
    },
    {
      id: "dependency_blast_radius",
      title: "Dependency Blast Radius",
      targetUser: "PMO lead and program manager",
      painSolved: "A blocked vendor, interface, or shared dependency can affect multiple projects before the portfolio view shows it.",
      concreteBenefit: "Identifies shared dependencies with active risk and affected projects.",
      technicalMechanism: "Groups cross-project dependencies and combines them with blocked/risk signals.",
      requiredData: ["dependencyName", "dependencyStatusLabel", "obstaclesAndMeasures", "lastStatusUpdate"],
      whyDifferentiated: "Moves from single-project risk lists to portfolio-level dependency impact.",
      mvpImplementation: "Expose `crossProjectDependencyIntelligence.items` and affected project IDs.",
      risksAndTrustControls: ["dependency_name_required", "manual_dependency_normalization", "evidence_drivers_visible"],
      proofMetric: proofMetric("shared_dependency_risks", sharedDependencyRisks, "Every shared dependency risk has affected projects listed", sharedDependencyRisks ? "watch" : "ready"),
      runtimeSignals: {
        dependencySummary: dependencyIntel.summary,
        items: dependencyIntel.items.slice(0, 10),
      },
      feasibility: "medium",
      uspScore: 88,
    },
    {
      id: "project_manager_readiness_score",
      title: "Project Manager Readiness Score",
      targetUser: "PMO coach",
      painSolved: "PMO coaching is reactive because weak status quality is not aggregated by owner.",
      concreteBenefit: "Shows which project managers need status-quality coaching before the next report cycle.",
      technicalMechanism: "Aggregates status-quality severity, blocked `kv`, and recommended interventions by project owner.",
      requiredData: ["ownerName", "projectManagerName", "lastStatusUpdate", "overallKpiLabel", "plannedActivities"],
      whyDifferentiated: "Turns status quality into a coaching queue rather than only a compliance finding.",
      mvpImplementation: "Use `projectManagerQualityCoach.summary` and per-owner interventions.",
      risksAndTrustControls: ["coaching_not_blame", "owner_data_gap_visible", "manual_review_required"],
      proofMetric: proofMetric("owners_needing_intervention", pmCoach.items.filter((item) => item.recommendedIntervention !== "No PMO intervention needed.").length, "All owners needing PMO coaching listed", "ready"),
      runtimeSignals: {
        coachSummary: pmCoach.summary,
        items: pmCoach.items.slice(0, 10),
      },
      feasibility: "high",
      uspScore: 87,
    },
    {
      id: "cio_cfo_risk_split",
      title: "CIO/CFO Risk Split",
      targetUser: "CIO, CFO, and PMO lead",
      painSolved: "Technology, budget, resource, and governance risks are mixed together and routed to the wrong owner.",
      concreteBenefit: "Separates management attention by CIO/CEO/PMO and highlights financial/resource exposure.",
      technicalMechanism: "Combines management-attention classification, budget/financial PMO report, and resource/dependency safety gates.",
      requiredData: ["overallKpiLabel", "budgetStatusLabel", "budgetRisk", "resourceStatusLabel", "dependencyStatusLabel"],
      whyDifferentiated: "Routes risk ownership instead of producing one undifferentiated red-list.",
      mvpImplementation: "Expose attention counts and budget-risk rows in the maximum USP layer.",
      risksAndTrustControls: ["missing_budget_marked_gap", "routing_is_advisory", "owner_review_required"],
      proofMetric: proofMetric("management_attention_items", managementAttention, "All PMO/CIO/CEO attention items routed", managementAttention ? "watch" : "ready"),
      runtimeSignals: {
        attentionCounts: {
          pmo: safetySuite.summary.pmoAttention,
          cio: safetySuite.summary.cioAttention,
          ceo: safetySuite.summary.ceoAttention,
        },
        budgetSummary: budgetReport.summary,
      },
      feasibility: "medium",
      uspScore: 86,
    },
    {
      id: "audit_safe_ai_recommendation",
      title: "Audit-Safe AI Recommendation",
      targetUser: "CIO, PMO, and audit reviewer",
      painSolved: "AI recommendations are hard to trust when they do not show their evidence, assumptions, and missing data.",
      concreteBenefit: "Each recommendation is backed by a trust contract, evidence count, missing fields, and human-review flag.",
      technicalMechanism: "Uses Trust Contracts, AI Escalation Packs, evidence sources, and explicit review-only controls.",
      requiredData: ["status quality evidence", "recordUrl", "missing fields", "management ask"],
      whyDifferentiated: "Treats AI output as an auditable recommendation object, not generated prose.",
      mvpImplementation: "Attach trust-contract summaries to risk and escalation recommendations.",
      risksAndTrustControls: ["trust_contract_required", "human_review_required", "evidence_visible"],
      proofMetric: proofMetric("trust_contracts_created", trustContracts.length, "One trust contract per reviewed project", trustContracts.length === activeProjects.length ? "ready" : "needs_data"),
      runtimeSignals: {
        trustContractCount: trustContracts.length,
        escalationPackCount: escalationPacks.length,
        missingFieldCount: trustContracts.reduce((sum, item) => sum + item.missingFields.length, 0),
      },
      feasibility: "high",
      uspScore: 86,
    },
    {
      id: "portfolio_work_queue",
      title: "Portfolio Work Queue",
      targetUser: "PMO operator",
      painSolved: "PMO teams need daily action lists, not another static portfolio report.",
      concreteBenefit: "Turns findings into a work queue for PMO review, coaching, escalation, and follow-up.",
      technicalMechanism: "Combines PMO Control Tower interventions, project nudges, and the `pmo_work_queue` report.",
      requiredData: ["safety gates", "PMO checks", "owner", "status text", "decision/action fields"],
      whyDifferentiated: "Connects report findings to operational next actions.",
      mvpImplementation: "Expose work queue count and next-action rows from the PMO report suite.",
      risksAndTrustControls: ["manual_review_queue", "no_auto_email", "no_auto_crm_write"],
      proofMetric: proofMetric("pmo_work_items", workQueue.summary.workItems || 0, "Every PMO intervention has a next action", (workQueue.summary.workItems || 0) ? "watch" : "ready"),
      runtimeSignals: {
        workQueueSummary: workQueue.summary,
        rows: workQueue.rows.slice(0, 10),
      },
      feasibility: "high",
      uspScore: 85,
    },
    {
      id: "crm_writeback_simulation",
      title: "CRM Writeback Simulation",
      targetUser: "Project leader and CRM process owner",
      painSolved: "Users cannot see whether a CRM save is safe until after fields are already staged.",
      concreteBenefit: "Simulates target fields, blockers, confirmation requirements, and audit preview before any save.",
      technicalMechanism: "Uses safe writeback simulations, create-plan blockers, audit preview, and `canAutoSave: false`.",
      requiredData: ["draft.fields", "emailStatusUpdate", "submittedTo", "projectManagerVerified", "recordUrl"],
      whyDifferentiated: "Makes CRM writeback a transparent dry-run flow with explicit human confirmation.",
      mvpImplementation: "Expose simulation blockers and audit previews in status API JSON and PMO audit report.",
      risksAndTrustControls: ["dry_run_first", "exact_confirmation", "audit_entry_required", "email_flag_review"],
      proofMetric: proofMetric("blocked_writeback_simulations", blockedWritebacks, "Every unsafe writeback blocked before save", "ready"),
      runtimeSignals: {
        writebackReportSummary: writebackReport.summary,
        simulationCount: writebackSimulations.length,
        simulationsWithAuditPreview: writebackSimulations.filter((item) => item.auditPreview).length,
      },
      feasibility: "high",
      uspScore: 85,
    },
  ];

  const byId = new Map(definitions.map((item) => [item.id, item]));
  const usps = MAXIMUM_USP_IDS.map((id) => {
    const item = byId.get(id);
    const readiness = uspReadiness([item.proofMetric.status]);
    return {
      ...item,
      readiness,
      implementationStatus: "implemented",
      advisoryOnly: true,
    };
  });
  return {
    layerType: "maximum_usps",
    generatedAt: options.generatedAt || new Date().toISOString(),
    summary: {
      uspCount: usps.length,
      implemented: usps.filter((item) => item.implementationStatus === "implemented").length,
      ready: usps.filter((item) => item.readiness === "ready").length,
      watch: usps.filter((item) => item.readiness === "watch").length,
      needsData: usps.filter((item) => item.readiness === "needs_data").length,
      blocked: usps.filter((item) => item.readiness === "blocked").length,
      averageUspScore: Math.round(usps.reduce((sum, item) => sum + item.uspScore, 0) / usps.length),
      bestMvpUsp: "pmo_safety_radar",
      boldFollowUpUsp: "executive_no_surprise_brief",
      safetyPosture: "advisory_only_confirmation_gated",
    },
    usps,
  };
}

function buildProjectIntelligence(projects, options = {}) {
  const result = {
    preview: buildBatchProjectPreview(projects, options),
    portfolioRisks: buildPortfolioRiskList(projects, options),
    decisionRadar: extractDecisionRadar(projects),
    steeringAgenda: buildSteeringAgenda(projects, options),
    decisionClosureItems: buildDecisionClosureItems(projects, options),
    riskLedger: buildRiskLedgerEntries(projects, options),
    nudges: buildProjectNudges(projects, options),
    nudgeDrafts: buildNudgeDrafts(projects, options),
    calibrationReport: buildCalibrationReport(projects, options),
    liveDynamicsRunPlan: buildLiveDynamicsRunPlan(options),
    governanceExceptions: buildGovernanceExceptions(projects, options),
    projectManagerCoach: buildProjectManagerCoach(projects, options),
    dataCompleteness: (projects || []).map(buildDataCompletenessScore),
    autonomousPmoWatchtower: buildAutonomousPmoWatchtower(projects, options),
    riskForecastTwin: buildRiskForecastTwin(projects, options),
    decisionSlaCockpit: buildDecisionSlaCockpit(projects, options),
    projectManagerQualityCoach: buildProjectManagerQualityCoach(projects, options),
    recoveryOptionGenerator: buildRecoveryOptionGenerator(projects, options),
    roleBasedNarrativeEngine: buildRoleBasedNarrativeEngine(projects, options),
    decisionDebtAnalysis: buildDecisionDebtAnalysis(projects, options),
    projectTruthScores: (projects || []).map((project) => buildProjectTruthScore(project, options)),
    sponsorActionIntelligence: buildSponsorActionIntelligence(projects, options),
    noSurpriseForecast: buildNoSurpriseForecast(projects, options),
    aiEscalationPacks: buildPortfolioRiskList(projects, options).map((risk) => {
      const project = (projects || []).find((candidate) => (candidate.projectId || candidate.id) === risk.projectId);
      return buildAiEscalationPack(project, options);
    }),
    evidenceGapDetector: buildEvidenceGapDetector(projects, options),
    executiveQuestionGenerator: buildExecutiveQuestionGenerator(projects, options),
    portfolioConstraintRadar: buildPortfolioConstraintRadar(projects, options),
    commitmentTracker: buildCommitmentTracker(projects, options),
    escalationReadinessScores: (projects || []).map((project) => buildEscalationReadinessScore(project, options)),
    crossProjectDependencyIntelligence: buildCrossProjectDependencyIntelligence(projects, options),
    reportQualityBenchmark: buildReportQualityBenchmark(projects, options),
    projectSafetyGates: buildProjectSafetyGateSuite(projects, options),
    pmoControlTower: buildPmoControlTower(projects, options),
    pmoStatusReport: buildPmoStatusReport(projects, options),
    statusSuggestionReport: buildStatusSuggestionReport(projects, options),
    boardPack: buildBoardPack(projects, options),
    pmoReportSuite: buildPmoReportSuite(projects, options),
    maximumUsps: buildMaximumUspLayer(projects, options),
    pmoUsps: buildPmoUspLayer(projects, options),
    executiveOnePager: buildExecutiveOnePager(projects, options),
    unchangedStatusText: UNCHANGED_STATUS_TEXT,
  };
  if (options.includeExports) {
    result.exports = buildExportBundle(projects, { ...options, includeExports: false });
  }
  return result;
}

module.exports = {
  ACTIVE_PROJECT_STATUS_LABELS,
  DEFAULT_PMO_CONFIG,
  MAXIMUM_USP_IDS,
  PMO_USP_IDS,
  PMO_REPORT_TYPES,
  UNCHANGED_STATUS_TEXT,
  buildAiEscalationPack,
  buildAutonomousPmoWatchtower,
  buildCalibrationReport,
  buildAuditEntry,
  buildAudienceReport,
  buildBatchProjectPreview,
  buildDataCompletenessScore,
  buildCommitmentTracker,
  buildCrossProjectDependencyIntelligence,
  buildDecisionDebtAnalysis,
  buildDecisionOptionScoring,
  buildDecisionSlaCockpit,
  buildDecisionClosureItems,
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
  buildMaximumUspLayer,
  buildPmoUspLayer,
  buildMeetingCaptureDrafts,
  buildMeetingToDynamicsPlan,
  buildNudgeDrafts,
  buildPmoConfig,
  buildPortfolioNarrativeDiff,
  buildRecoveryOptionGenerator,
  buildPortfolioRiskList,
  buildProjectManagerCoach,
  buildProjectManagerQualityCoach,
  buildProjectIntelligence,
  buildProjectNudges,
  buildProjectSafetyGate,
  buildProjectSafetyGateSuite,
  buildProjectTruthScore,
  buildPmoControlTower,
  buildPmoPolicySimulator,
  buildPmoProjectControls,
  buildPmoReport,
  buildPmoReportSuite,
  buildPmoStatusReport,
  buildBoardPack,
  buildStatusReportSuggestion,
  buildStatusSuggestionReport,
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
  buildEvidenceSource,
  detectStatusDelta,
  evidence,
  evaluateStatusQuality,
  extractDecisionRadar,
  isActiveProjectCandidate,
  normalizeText,
  parseDateOnly,
};
