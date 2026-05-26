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
  UNCHANGED_STATUS_TEXT,
  buildAiEscalationPack,
  buildAutonomousPmoWatchtower,
  buildCalibrationReport,
  buildAuditEntry,
  buildAudienceReport,
  buildBatchProjectPreview,
  buildDataCompletenessScore,
  buildDecisionDebtAnalysis,
  buildDecisionSlaCockpit,
  buildDecisionClosureItems,
  buildExecutiveOnePager,
  buildExecutiveMemoryTimeline,
  buildExportBundle,
  buildGovernanceExceptions,
  buildLiveDynamicsRunPlan,
  buildManagementActionExportRows,
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
  buildProjectTruthScore,
  buildNoSurpriseForecast,
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
