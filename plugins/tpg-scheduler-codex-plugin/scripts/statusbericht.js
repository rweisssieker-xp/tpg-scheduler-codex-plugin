#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const JSZip = require("jszip");
const {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} = require("docx");
const projectIntelligence = require("./lib/project-intelligence");

const PROJECT_LIST_URL =
  "https://posp365.crm4.dynamics.com/main.aspx?appid=1a66513c-266c-ef11-bfe2-6045bd8d5d87&forceUCI=1&pagetype=entitylist&etn=tpg_project&viewid=40761dc9-c0d4-ef11-a72e-7c1e52862247&viewType=4230";
const DATAVERSE_ORG_URL = "https://posp365.crm4.dynamics.com";
const DYNAMICS_APP_ID = "1a66513c-266c-ef11-bfe2-6045bd8d5d87";
const DATAVERSE_API_VERSION = "v9.2";
const PROJECT_ENTITY_LOGICAL_NAME = "tpg_project";
const PROJECT_ENTITY_SET_NAME = "tpg_projects";
const PROJECT_PRIMARY_ID_ATTRIBUTE = "tpg_projectid";
const PROJECT_PRIMARY_NAME_ATTRIBUTE = "tpg_subject";
const PROJECT_DEFAULT_SELECT_COLUMNS = [
  PROJECT_PRIMARY_ID_ATTRIBUTE,
  "tpg_projectnum",
  "gbl_projectnumber",
  PROJECT_PRIMARY_NAME_ATTRIBUTE,
  "tpg_projectstatus",
  "tpg_lifecyclephase",
  "tpg_overallkpi",
  "tpg_progress",
  "tpg_start",
  "tpg_finish",
  "gbl_laststatusupdate",
  "_ownerid_value",
];
const PROJECT_ACTIVE_STATE_FILTER = "statecode eq 0";
const PROJECT_MANAGER_NAME = "Reiner Weisssieker";
const ACTIVE_PROJECT_STATUS_LABELS = ["Created", "Planning", "In Progress"];
const STATUS_UPDATE_TAB_NAME = "tab_status";
const STATUS_UPDATE_SUBGRID_NAME = "status_grid";
const STATUS_UPDATE_FIELDS = Object.freeze({
  reportDate: "tpg_reportdate",
  project: "tpg_project",
  statusSummary: "tpg_title",
  owner: "ownerid",
  submittedTo: "tpg_submittedto",
  emailStatusUpdate: "tpg_emailstatusupdate",
  accomplishedActivities: "tpg_accomplishedactivities",
  missedActivities: "tpg_missedactivities",
  plannedActivities: "tpg_plannedactivities",
  sponsorActions: "tpg_sponsoractions",
  obstaclesAndMeasures: "gbl_obstaclesandmeasures",
  decisions: "gbl_decisions",
});
const STATUS_UPDATE_REQUIRED_FIELDS = [
  STATUS_UPDATE_FIELDS.reportDate,
  STATUS_UPDATE_FIELDS.project,
  STATUS_UPDATE_FIELDS.statusSummary,
  STATUS_UPDATE_FIELDS.owner,
  STATUS_UPDATE_FIELDS.submittedTo,
];
const PROJECT_KNOWN_OPTION_LABELS = Object.freeze({
  tpg_projectstatus: {
    926720004: "Closed",
  },
  tpg_overallkpi: {
    926720002: "Green",
  },
});
const UNCHANGED_STATUS_TEXT =
  "Status unverändert seit letztem Bericht (keine inhaltlichen Änderungen)";

function normalizeStatusInput(value) {
  const trimmed = String(value || "").trim();
  if (trimmed.toLowerCase() === "kv") {
    return UNCHANGED_STATUS_TEXT;
  }
  return trimmed;
}

function normalizeGuid(value) {
  return String(value || "").trim().replace(/[{}]/g, "").toLowerCase();
}

function buildDynamicsProjectRecordUrl(projectId) {
  const id = normalizeGuid(projectId);
  if (!id) {
    throw new Error("projectId is required");
  }
  return `${DATAVERSE_ORG_URL}/main.aspx?appid=${DYNAMICS_APP_ID}&forceUCI=1&pagetype=entityrecord&etn=${PROJECT_ENTITY_LOGICAL_NAME}&id=${id}`;
}

function buildDataverseUrl(pathAndQuery) {
  const path = String(pathAndQuery || "").replace(/^\/+/, "");
  return `${DATAVERSE_ORG_URL}/api/data/${DATAVERSE_API_VERSION}/${path}`;
}

function buildProjectRecordApiUrl(projectId, selectColumns = PROJECT_DEFAULT_SELECT_COLUMNS) {
  const id = normalizeGuid(projectId);
  if (!id) {
    throw new Error("projectId is required");
  }
  const select = selectColumns.length ? `?$select=${selectColumns.join(",")}` : "";
  return buildDataverseUrl(`${PROJECT_ENTITY_SET_NAME}(${id})${select}`);
}

function buildActiveProjectsApiUrl(selectColumns = PROJECT_DEFAULT_SELECT_COLUMNS) {
  const select = selectColumns.length ? `$select=${selectColumns.join(",")}` : "";
  const filter = `$filter=${PROJECT_ACTIVE_STATE_FILTER}`;
  return buildDataverseUrl(`${PROJECT_ENTITY_SET_NAME}?${[select, filter].filter(Boolean).join("&")}`);
}

function formatOptionLabel(attributeName, value, formattedValue) {
  if (formattedValue) {
    return formattedValue;
  }
  return PROJECT_KNOWN_OPTION_LABELS[attributeName]?.[value] || null;
}

function getFormattedValue(row, attributeName) {
  return row?.[`${attributeName}@OData.Community.Display.V1.FormattedValue`] || null;
}

function mapProjectDataverseRow(row) {
  if (!row || typeof row !== "object") {
    throw new Error("row must be an object");
  }
  const id = normalizeGuid(row[PROJECT_PRIMARY_ID_ATTRIBUTE]);
  const projectStatusLabel = formatOptionLabel(
    "tpg_projectstatus",
    row.tpg_projectstatus,
    getFormattedValue(row, "tpg_projectstatus")
  );
  const overallKpiLabel = formatOptionLabel("tpg_overallkpi", row.tpg_overallkpi, getFormattedValue(row, "tpg_overallkpi"));
  return {
    id,
    recordUrl: id ? buildDynamicsProjectRecordUrl(id) : null,
    apiUrl: id ? buildProjectRecordApiUrl(id) : null,
    projectId: row.tpg_projectnum || null,
    projectNumber: row.gbl_projectnumber ?? null,
    name: row[PROJECT_PRIMARY_NAME_ATTRIBUTE] || null,
    projectStatus: row.tpg_projectstatus ?? null,
    projectStatusLabel,
    lifecyclePhase: row.tpg_lifecyclephase || null,
    overallKpi: row.tpg_overallkpi ?? null,
    overallKpiLabel,
    progress: row.tpg_progress ?? null,
    start: row.tpg_start || null,
    finish: row.tpg_finish || null,
    lastStatusUpdate: row.gbl_laststatusupdate || null,
    ownerId: normalizeGuid(row._ownerid_value),
    ownerName: getFormattedValue(row, "_ownerid_value"),
    raw: row,
  };
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

function evaluateProjectStatusQuality(project, options = {}) {
  const warnings = [];
  let score = 100;
  const today = parseDateOnly(options.today || new Date().toISOString().slice(0, 10));
  const finish = parseDateOnly(project?.finish);
  const progress = Number(project?.progress);
  const projectStatusLabel = project?.projectStatusLabel || "";
  const overallKpiLabel = project?.overallKpiLabel || "";

  if (!project?.lastStatusUpdate) {
    warnings.push("No last status update is available.");
    score -= 25;
  }
  if (overallKpiLabel === "Red") {
    warnings.push("Overall KPI is Red.");
    score -= 35;
  } else if (overallKpiLabel === "Yellow") {
    warnings.push("Overall KPI is Yellow.");
    score -= 20;
  }
  if (finish && today && finish < today) {
    warnings.push("Finish date is in the past.");
    score -= 25;
  }
  if (Number.isFinite(progress) && progress >= 90 && projectStatusLabel === "In Progress") {
    warnings.push(`Progress is ${progress}% but the project is still In Progress.`);
    score -= 15;
  }

  const normalizedScore = Math.max(0, score);
  const severity = normalizedScore < 50 ? "critical" : warnings.length ? "warning" : "ok";
  return {
    score: normalizedScore,
    severity,
    recommendedAction: severity === "ok" ? "collect_status" : "needs_attention",
    warnings,
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
      recordUrl: project.recordUrl || (project.id ? buildDynamicsProjectRecordUrl(project.id) : null),
      projectStatusLabel: project.projectStatusLabel || null,
      overallKpiLabel: project.overallKpiLabel || null,
      progress: project.progress ?? null,
      finish: project.finish || null,
      lastStatusUpdate: project.lastStatusUpdate || null,
      quality: evaluateProjectStatusQuality(project, options),
    }))
    .sort((left, right) => {
      const severityDelta = severityRank[left.quality.severity] - severityRank[right.quality.severity];
      if (severityDelta !== 0) {
        return severityDelta;
      }
      return left.quality.score - right.quality.score;
    });
}

function buildStatusUpdateDraft(statusText, options = {}) {
  const normalizedStatusText = normalizeStatusInput(statusText);
  const reportDate = options.reportDate || new Date().toISOString().slice(0, 10);
  const accomplishedActivities = options.accomplishedActivities ?? normalizedStatusText;
  return {
    entityLabel: "Status Update",
    fields: {
      [STATUS_UPDATE_FIELDS.reportDate]: reportDate,
      [STATUS_UPDATE_FIELDS.statusSummary]: normalizedStatusText,
      [STATUS_UPDATE_FIELDS.accomplishedActivities]: accomplishedActivities,
      [STATUS_UPDATE_FIELDS.missedActivities]: options.missedActivities || "",
      [STATUS_UPDATE_FIELDS.plannedActivities]: options.plannedActivities || "",
      [STATUS_UPDATE_FIELDS.sponsorActions]: options.sponsorActions || "",
      [STATUS_UPDATE_FIELDS.obstaclesAndMeasures]: options.obstaclesAndMeasures || "",
      [STATUS_UPDATE_FIELDS.decisions]: options.decisions || "",
    },
    submittedTo: options.submittedTo || null,
    emailStatusUpdate: options.emailStatusUpdate ?? false,
    requiresExplicitSaveConfirmation: true,
    requiresSubmittedToWhenEmpty: true,
  };
}

function getDataverseBrowserSnippet() {
  return String.raw`(() => {
  const constants = ${JSON.stringify({
    PROJECT_ENTITY_LOGICAL_NAME,
    PROJECT_ENTITY_SET_NAME,
    PROJECT_PRIMARY_ID_ATTRIBUTE,
    PROJECT_PRIMARY_NAME_ATTRIBUTE,
    PROJECT_DEFAULT_SELECT_COLUMNS,
    PROJECT_ACTIVE_STATE_FILTER,
    PROJECT_MANAGER_NAME,
    ACTIVE_PROJECT_STATUS_LABELS,
    STATUS_UPDATE_TAB_NAME,
    STATUS_UPDATE_SUBGRID_NAME,
    STATUS_UPDATE_FIELDS,
  })};

  function normalizeGuid(value) {
    return String(value || "").trim().replace(/[{}]/g, "").toLowerCase();
  }

  function getXrm() {
    const xrm = window.Xrm || window.parent?.Xrm;
    if (!xrm?.WebApi) {
      throw new Error("Xrm.WebApi is not available. Open Dynamics and sign in first.");
    }
    return xrm;
  }

  function formatted(row, attributeName) {
    return row?.[attributeName + "@OData.Community.Display.V1.FormattedValue"] || null;
  }

  function buildQuery(selectColumns = constants.PROJECT_DEFAULT_SELECT_COLUMNS, filter = constants.PROJECT_ACTIVE_STATE_FILTER, top) {
    const parts = [];
    if (selectColumns.length) parts.push("$select=" + selectColumns.join(","));
    if (filter) parts.push("$filter=" + filter);
    if (top) parts.push("$top=" + Number(top));
    return "?" + parts.join("&");
  }

  function mapProject(row) {
    const id = normalizeGuid(row[constants.PROJECT_PRIMARY_ID_ATTRIBUTE]);
    return {
      id,
      projectId: row.tpg_projectnum || null,
      projectNumber: row.gbl_projectnumber ?? null,
      name: row[constants.PROJECT_PRIMARY_NAME_ATTRIBUTE] || null,
      projectStatus: row.tpg_projectstatus ?? null,
      projectStatusLabel: formatted(row, "tpg_projectstatus"),
      lifecyclePhase: row.tpg_lifecyclephase || null,
      overallKpi: row.tpg_overallkpi ?? null,
      overallKpiLabel: formatted(row, "tpg_overallkpi"),
      progress: row.tpg_progress ?? null,
      start: row.tpg_start || null,
      finish: row.tpg_finish || null,
      lastStatusUpdate: row.gbl_laststatusupdate || null,
      ownerId: normalizeGuid(row._ownerid_value),
      ownerName: formatted(row, "_ownerid_value"),
      raw: row,
    };
  }

  function parseDateOnly(value) {
    if (!value) return null;
    const match = String(value).match(/^(\\d{4})-(\\d{2})-(\\d{2})/);
    if (!match) return null;
    return new Date(match[1] + "-" + match[2] + "-" + match[3] + "T00:00:00.000Z");
  }

  function isActiveProjectCandidate(project) {
    if (!project) return false;
    if (!project.projectStatusLabel) return true;
    return constants.ACTIVE_PROJECT_STATUS_LABELS.includes(project.projectStatusLabel);
  }

  function normalizeText(value) {
    return String(value || "").trim().replace(/\\s+/g, " ");
  }

  function evidence(code, field, value, message) {
    return { code, field, value, message };
  }

  function detectStatusDelta(project, options = {}) {
    const lastStatus = normalizeText(project?.lastStatusUpdate);
    const proposedStatus = normalizeText(options.proposedStatusText ?? project?.currentStatusText);
    const reasons = [];
    if (!lastStatus && !proposedStatus) {
      return { changeType: "missing", recommendedInput: "real_status", reasons: ["No last or proposed status is available."] };
    }
    if (lastStatus && proposedStatus && lastStatus.toLowerCase() === proposedStatus.toLowerCase()) {
      return { changeType: "unchanged", recommendedInput: "kv", reasons: ["Proposed status matches the last status update."] };
    }
    if (!lastStatus) reasons.push("No last status update is available.");
    else if (!proposedStatus) reasons.push("No proposed status is available.");
    else reasons.push("Proposed status differs from the last status update.");
    if (project?.overallKpiLabel === "Red") reasons.push("Overall KPI is Red.");
    if (project?.decisions) reasons.push("Decision text is present.");
    if (project?.obstaclesAndMeasures) reasons.push("Obstacle text is present.");
    return {
      changeType: "changed",
      recommendedInput: project?.decisions ? "decision" : project?.obstaclesAndMeasures ? "risk" : "real_status",
      reasons,
    };
  }

  function evaluateProjectStatusQuality(project, options = {}) {
    const warnings = [];
    const evidenceItems = [];
    let score = 100;
    const today = parseDateOnly(options.today || new Date().toISOString().slice(0, 10));
    const finish = parseDateOnly(project?.finish);
    const progress = Number(project?.progress);
    const projectStatusLabel = project?.projectStatusLabel || "";
    const overallKpiLabel = project?.overallKpiLabel || "";

    if (!project?.lastStatusUpdate) {
      warnings.push("No last status update is available.");
      evidenceItems.push(evidence("stale_status", "lastStatusUpdate", project?.lastStatusUpdate || null, "No last status update is available."));
      score -= 25;
    }
    if (overallKpiLabel === "Red") {
      warnings.push("Overall KPI is Red.");
      evidenceItems.push(evidence("red_kpi", "overallKpiLabel", overallKpiLabel, "Overall KPI is Red."));
      score -= 35;
    } else if (overallKpiLabel === "Yellow") {
      warnings.push("Overall KPI is Yellow.");
      evidenceItems.push(evidence("yellow_kpi", "overallKpiLabel", overallKpiLabel, "Overall KPI is Yellow."));
      score -= 20;
    }
    if (finish && today && finish < today) {
      warnings.push("Finish date is in the past.");
      evidenceItems.push(evidence("overdue_finish", "finish", project.finish, "Finish date is in the past."));
      score -= 25;
    }
    if (Number.isFinite(progress) && progress >= 90 && projectStatusLabel === "In Progress") {
      warnings.push("Progress is " + progress + "% but the project is still In Progress.");
      evidenceItems.push(evidence("high_progress_not_closed", "progress", project.progress, "Progress is " + progress + "% but the project is still In Progress."));
      score -= 15;
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
        projectStatusLabel: project.projectStatusLabel || null,
        overallKpiLabel: project.overallKpiLabel || null,
        progress: project.progress ?? null,
        finish: project.finish || null,
        lastStatusUpdate: project.lastStatusUpdate || null,
        quality: evaluateProjectStatusQuality(project, options),
        delta: detectStatusDelta(project, options),
      }))
      .sort((left, right) => {
        const severityDelta = severityRank[left.quality.severity] - severityRank[right.quality.severity];
        if (severityDelta !== 0) return severityDelta;
        return left.quality.score - right.quality.score;
      });
  }

  function buildPortfolioRiskList(projects, options = {}) {
    return buildBatchProjectPreview(projects, options)
      .filter((item) => item.quality.severity !== "ok")
      .map((item) => ({
        projectId: item.projectId,
        name: item.name,
        riskLevel: item.quality.severity,
        score: Math.min(100, 100 - item.quality.score + item.quality.warnings.length * 10),
        reasons: item.quality.warnings,
      }))
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
      }));
  }

  function buildProjectNudges(projects, options = {}) {
    return buildBatchProjectPreview(projects, options)
      .filter((item) => item.quality.severity !== "ok")
      .map((item) => ({
        projectId: item.projectId,
        name: item.name,
        priority: item.quality.severity === "critical" ? "high" : "medium",
        prompt: item.quality.severity === "critical"
          ? "Bitte echten Status mit Risiko, Maßnahme und Management-Entscheidung erfassen; kv ist hier nicht belastbar."
          : "Bitte Status konkretisieren; mindestens Änderung, nächster Schritt oder Begründung für kv ergänzen.",
      }));
  }

  function buildSteeringAgenda(projects, options = {}) {
    const today = options.today || new Date().toISOString().slice(0, 10);
    const previewByProjectId = new Map(buildBatchProjectPreview(projects, options).map((item) => [item.projectId, item]));
    return extractDecisionRadar(projects).map((item) => {
      const sourceProject = (projects || []).find((project) => project.projectId === item.projectId) || {};
      const preview = previewByProjectId.get(item.projectId);
      const evidenceItems = preview?.quality?.evidence || [];
      return {
        projectId: item.projectId,
        name: item.name,
        priority: preview?.quality?.severity || "warning",
        agendaItem: item.managementAsk,
        owner: sourceProject.decisionOwner || sourceProject.ownerName || "CIO",
        dueDate: sourceProject.decisionDueDate || today,
        reasonCodes: evidenceItems.map((evidenceItem) => evidenceItem.code),
        recordUrl: item.recordUrl || null,
      };
    });
  }

  function buildDecisionClosureItems(projects, options = {}) {
    return buildSteeringAgenda(projects, options).map((item) => ({
      id: item.projectId + "::decision::" + item.agendaItem,
      projectId: item.projectId,
      name: item.name,
      decision: item.agendaItem,
      owner: item.owner,
      dueDate: item.dueDate,
      status: "open",
      blockedProject: item.priority === "critical",
      evidenceCodes: item.reasonCodes,
      recordUrl: item.recordUrl,
    }));
  }

  function buildRiskLedgerEntries(projects, options = {}) {
    const today = options.today || new Date().toISOString().slice(0, 10);
    return buildBatchProjectPreview(projects, options).flatMap((item) =>
      (item.quality.evidence || []).map((evidenceItem) => ({
        id: item.projectId + "::" + evidenceItem.code + "::" + today,
        projectId: item.projectId,
        name: item.name,
        status: "open",
        detectedAt: today,
        lastSeenAt: today,
        evidenceCode: evidenceItem.code,
        field: evidenceItem.field,
        value: evidenceItem.value,
        message: evidenceItem.message,
        recordUrl: item.recordUrl || null,
        source: evidenceItem.source || null,
      }))
    );
  }

  function buildNudgeDrafts(projects, options = {}) {
    return buildProjectNudges(projects, options).map((nudge) => ({
      channel: "manual_review",
      toRole: "Projektleiter",
      projectId: nudge.projectId,
      name: nudge.name,
      subject: "Statusupdate benoetigt: " + nudge.name,
      body: nudge.prompt,
      sendAutomatically: false,
    }));
  }

  function buildCalibrationReport(projects, options = {}) {
    const preview = buildBatchProjectPreview(projects, options);
    return {
      summary: {
        projectsReviewed: preview.length,
        warningProjects: preview.filter((item) => item.quality.severity === "warning").length,
        criticalProjects: preview.filter((item) => item.quality.severity === "critical").length,
        missingRecordUrls: preview.filter((item) => !item.recordUrl).length,
        missingLastStatus: preview.filter((item) => !item.lastStatusUpdate).length,
      },
    };
  }

  function buildLiveDynamicsRunPlan(options = {}) {
    return {
      today: options.today || new Date().toISOString().slice(0, 10),
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
    const risks = buildPortfolioRiskList(projects, options);
    const decisions = extractDecisionRadar(projects);
    return [
      "# Project Portfolio One-Pager",
      "",
      "Date: " + today,
      "",
      "## Top Risks",
      "",
      ...(risks.length ? risks.slice(0, 10).map((risk) => "- " + risk.name + " (" + risk.projectId + "): " + risk.reasons.join(" ")) : ["- No critical portfolio risks detected."]),
      "",
      "## Decisions And Sponsor Actions",
      "",
      ...(decisions.length ? decisions.slice(0, 10).map((item) => "- " + item.name + " (" + item.projectId + "): " + item.managementAsk) : ["- No open decisions or sponsor actions detected."]),
      "",
    ].join("\n");
  }

  function buildProjectIntelligence(projects, options = {}) {
    return {
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
      executiveOnePager: buildExecutiveOnePager(projects, options),
    };
  }

  async function retrieveActiveProjects(options = {}) {
    const xrm = getXrm();
    const query = buildQuery(options.selectColumns || constants.PROJECT_DEFAULT_SELECT_COLUMNS, options.filter || constants.PROJECT_ACTIVE_STATE_FILTER, options.top);
    const response = await xrm.WebApi.retrieveMultipleRecords(constants.PROJECT_ENTITY_LOGICAL_NAME, query);
    return response.entities.map(mapProject);
  }

  async function retrieveProject(projectId, selectColumns = constants.PROJECT_DEFAULT_SELECT_COLUMNS) {
    const xrm = getXrm();
    const id = normalizeGuid(projectId);
    const response = await xrm.WebApi.retrieveRecord(constants.PROJECT_ENTITY_LOGICAL_NAME, id, buildQuery(selectColumns, null));
    return mapProject(response);
  }

  function readCurrentProjectForm() {
    const xrm = getXrm();
    const formContext = xrm.Page;
    if (!formContext?.data?.entity?.attributes) {
      throw new Error("Current Dynamics form context is not available.");
    }
    return {
      entityName: formContext.data.entity.getEntityName(),
      id: normalizeGuid(formContext.data.entity.getId()),
      primaryValue: formContext.data.entity.getPrimaryAttributeValue?.() || null,
      attributes: formContext.data.entity.attributes.get().map((attribute) => ({
        name: attribute.getName(),
        value: attribute.getValue(),
        type: attribute.getAttributeType?.(),
        requiredLevel: attribute.getRequiredLevel?.(),
      })),
    };
  }

  function verifyCurrentProjectManager(expectedName = constants.PROJECT_MANAGER_NAME) {
    const form = readCurrentProjectForm();
    const owner = form.attributes.find((attribute) => attribute.name === "ownerid")?.value?.[0];
    return {
      ok: owner?.name === expectedName,
      expectedName,
      actualName: owner?.name || null,
      owner,
    };
  }

  function readQuickCreateStatusUpdateFields() {
    const dialog = [...document.querySelectorAll('[role="dialog"], [aria-label*="Quick Create"]')]
      .find((element) => (element.innerText || "").includes("Quick Create: Status Update"));
    if (!dialog) {
      throw new Error("Quick Create: Status Update dialog is not open.");
    }
    return Object.fromEntries(
      Object.values(constants.STATUS_UPDATE_FIELDS).map((fieldName) => {
        const root = dialog.querySelector('[data-id="' + fieldName + '"]');
        const input = dialog.querySelector('[data-id^="' + fieldName + '.fieldControl"] input, [data-id^="' + fieldName + '.fieldControl"] textarea');
        return [fieldName, {
          present: Boolean(root || input),
          ariaLabel: input?.getAttribute("aria-label") || null,
          value: input?.value || null,
          dataId: input?.getAttribute("data-id") || root?.getAttribute("data-id") || null,
        }];
      })
    );
  }

  window.TPGProjectAssist = {
    constants,
    retrieveActiveProjects,
    retrieveProject,
    buildBatchProjectPreview,
    buildExecutiveOnePager,
    buildPortfolioRiskList,
    buildProjectIntelligence,
    buildProjectNudges,
    buildSteeringAgenda,
    buildDecisionClosureItems,
    buildRiskLedgerEntries,
    buildNudgeDrafts,
    buildCalibrationReport,
    buildLiveDynamicsRunPlan,
    buildAuditEntry,
    detectStatusDelta,
    evaluateProjectStatusQuality,
    extractDecisionRadar,
    readCurrentProjectForm,
    verifyCurrentProjectManager,
    readQuickCreateStatusUpdateFields,
  };

  return window.TPGProjectAssist;
})()`;
}

function printHelp() {
  console.log(`TPG-Scheduler-Codex-Plugin

This plugin is intentionally driven by Codex's in-app Browser plugin.
It does not launch Playwright, Edge, Chromium, Selenium, or another browser process.

Browser workflow:
  1. Use the statusbericht skill.
  2. Codex opens the Dynamics project view in the in-app Browser.
  3. Codex uses the "MR Active Projects - RW" view and keeps only records where Project Manager is Reiner Weisssieker.
  4. For each project, Codex asks for status input.
  5. Codex can build a project intelligence pack: batch preview, delta, risk list, decision radar, nudges, audit entries, and executive one-pager.
  6. "kv" becomes:
     ${UNCHANGED_STATUS_TEXT}
  7. Codex stages a Quick Create Status Update and asks before saving.
  8. Codex never saves while Email Status Update is Yes unless explicitly confirmed.

Project list:
  ${PROJECT_LIST_URL}

Dataverse project entity:
  Logical name: ${PROJECT_ENTITY_LOGICAL_NAME}
  Entity set:   ${PROJECT_ENTITY_SET_NAME}
  Primary id:   ${PROJECT_PRIMARY_ID_ATTRIBUTE}
  Primary name: ${PROJECT_PRIMARY_NAME_ATTRIBUTE}

Dataverse active projects API:
  ${buildActiveProjectsApiUrl()}

Dataverse browser snippet:
  npm run statusbericht:dataverse

Offline intelligence:
  node ./scripts/statusbericht.js --intelligence <real-project-export.json>
  node ./scripts/statusbericht.js --intelligence <real-project-export.json> --json
  node ./scripts/statusbericht.js --intelligence <real-project-export.json> --exports

PMO report with filters:
  node ./scripts/statusbericht.js --pmo-report <real-project-export.json> --project-status "In Progress" --last-status-before YYYY-MM-DD
  node ./scripts/statusbericht.js --pmo-report <real-project-export.json> --project-status "In Progress,Planning" --last-status-contains "vendor" --json
  node ./scripts/statusbericht.js --pmo-report <real-project-export.json> --project-status "In Progress" --docx reports/pmo-status.docx --xlsx reports/pmo-status.xlsx

Sample and fixture inputs are rejected by default. They are reserved for automated tests and documentation fixtures.
`);
}

function printDataverseSnippet() {
  console.log(getDataverseBrowserSnippet());
}

function readProjectsInput(inputPath) {
  if (isSampleInputPath(inputPath) && !process.argv.includes("--allow-sample")) {
    throw new Error("Sample or synthetic project data is not accepted for production runs. Use live Dynamics data or an explicit real project JSON export.");
  }
  const raw = inputPath && inputPath !== "-"
    ? fs.readFileSync(inputPath, "utf8")
    : fs.readFileSync(0, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("Project intelligence input must be a JSON array of projects.");
  }
  return parsed;
}

function isSampleInputPath(inputPath) {
  if (!inputPath || inputPath === "-") {
    return false;
  }
  const normalized = String(inputPath).replace(/\\/g, "/").toLowerCase();
  return normalized.includes("/fixtures/") || normalized.includes("/examples/") || normalized.includes(".sample.");
}

function getArgValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return null;
  }
  return process.argv[index + 1] || null;
}

function formatProjectIntelligenceMarkdown(intelligence) {
  const lines = [
    intelligence.executiveOnePager.trimEnd(),
    "",
    "## Project Leader Queue",
    "",
  ];

  for (const item of intelligence.preview) {
    lines.push(
      `- ${item.name} (${item.projectId || "no project id"}): ${item.quality.recommendedAction}, ${item.quality.severity}, delta=${item.delta.recommendedInput}`
    );
    for (const warning of item.quality.warnings) {
      lines.push(`  - ${warning}`);
    }
  }

  lines.push("", "## Steering Agenda", "");
  if (!intelligence.steeringAgenda?.length) {
    lines.push("- No steering agenda items detected.");
  } else {
    for (const item of intelligence.steeringAgenda) {
      lines.push(`- ${item.name} (${item.priority}): ${item.agendaItem} [owner=${item.owner}, due=${item.dueDate}]`);
    }
  }

  lines.push("", "## Evidence", "");
  const evidenceRows = intelligence.preview.flatMap((item) =>
    (item.quality.evidence || []).map((evidenceItem) => ({
      projectName: item.name,
      code: evidenceItem.code,
      field: evidenceItem.field,
      value: evidenceItem.value,
    }))
  );
  if (!evidenceRows.length) {
    lines.push("- No evidence warnings detected.");
  } else {
    for (const row of evidenceRows) {
      lines.push(`- ${row.projectName}: ${row.code} (${row.field}=${row.value ?? "n/a"})`);
    }
  }

  lines.push("", "## Nudges", "");
  if (!intelligence.nudges.length) {
    lines.push("- No nudges needed.");
  } else {
    for (const nudge of intelligence.nudges) {
      lines.push(`- ${nudge.name} (${nudge.priority}): ${nudge.prompt}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function buildPmoReportOptions() {
  return {
    today: getArgValue("--today") || undefined,
    projectStatusLabels: getArgValue("--project-status") || undefined,
    lastStatusBefore: getArgValue("--last-status-before") || undefined,
    lastStatusAfter: getArgValue("--last-status-after") || undefined,
    lastStatusOn: getArgValue("--last-status-on") || undefined,
    lastStatusContains: getArgValue("--last-status-contains") || undefined,
    lastStatusMissing: process.argv.includes("--last-status-missing"),
  };
}

function formatPmoStatusReportMarkdown(report) {
  const filterLines = [];
  if (report.filters.projectStatusLabels.length) {
    filterLines.push(`- Project status: ${report.filters.projectStatusLabels.join(", ")}`);
  }
  if (report.filters.lastStatusBefore) {
    filterLines.push(`- Last status before: ${report.filters.lastStatusBefore}`);
  }
  if (report.filters.lastStatusAfter) {
    filterLines.push(`- Last status after: ${report.filters.lastStatusAfter}`);
  }
  if (report.filters.lastStatusOn) {
    filterLines.push(`- Last status on: ${report.filters.lastStatusOn}`);
  }
  if (report.filters.lastStatusContains) {
    filterLines.push(`- Last status contains: ${report.filters.lastStatusContains}`);
  }
  if (report.filters.lastStatusMissing) {
    filterLines.push("- Last status missing: yes");
  }
  const lines = [
    "# PMO Status Report",
    "",
    "## Filters",
    "",
    ...(filterLines.length ? filterLines : ["- No filters applied."]),
    "",
    "## Summary",
    "",
    `- Projects total: ${report.summary.projectsTotal}`,
    `- Projects matched: ${report.summary.projectsMatched}`,
    `- Projects filtered out: ${report.summary.projectsFilteredOut}`,
    `- Missing last status reports: ${report.summary.missingLastStatusReports}`,
    `- Unparsable last status reports: ${report.summary.unparsableLastStatusReports}`,
    `- Oldest last status report: ${report.summary.oldestLastStatusReport || "n/a"}`,
    `- Newest last status report: ${report.summary.newestLastStatusReport || "n/a"}`,
    "",
    "## Projects",
    "",
  ];

  if (!report.projects.length) {
    lines.push("- No projects match the selected filters.");
  } else {
    for (const project of report.projects) {
      lines.push(`- ${project.name || "Unnamed project"} (${project.projectId || "no project id"}): status=${project.projectStatusLabel || "n/a"}, lastStatusReport=${project.lastStatusReportDate || "n/a"}, pmo=${project.pmoLevel || "n/a"}, safety=${project.safetyLevel || "n/a"}`);
    }
  }

  lines.push("", "## PMO Attention", "");
  lines.push(`- Projects needing PMO: ${report.pmoControlTower.summary.projectsNeedingPmo}`);
  lines.push(`- Critical projects: ${report.pmoControlTower.summary.criticalProjects}`);
  return `${lines.join("\n")}\n`;
}

function ensureParentDirectory(outputPath) {
  const directory = path.dirname(path.resolve(outputPath));
  fs.mkdirSync(directory, { recursive: true });
}

function textCell(value) {
  return new TableCell({
    children: [new Paragraph(String(value ?? ""))],
  });
}

function buildDocxTable(headers, rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: headers.map((header) => new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: header, bold: true })] })],
        })),
      }),
      ...rows.map((row) => new TableRow({
        children: headers.map((header) => textCell(row[header])),
      })),
    ],
  });
}

async function buildPmoStatusReportDocxBuffer(report) {
  const filterRows = [
    { Filter: "Project status", Value: report.filters.projectStatusLabels.join(", ") || "All" },
    { Filter: "Last status before", Value: report.filters.lastStatusBefore || "" },
    { Filter: "Last status after", Value: report.filters.lastStatusAfter || "" },
    { Filter: "Last status on", Value: report.filters.lastStatusOn || "" },
    { Filter: "Last status contains", Value: report.filters.lastStatusContains || "" },
    { Filter: "Last status missing", Value: report.filters.lastStatusMissing ? "Yes" : "No" },
  ];
  const summaryRows = Object.entries(report.summary).map(([key, value]) => ({
    Metric: key,
    Value: typeof value === "object" ? JSON.stringify(value) : value,
  }));
  const projectRows = report.projects.map((project) => ({
    "Project ID": project.projectId || "",
    Name: project.name || "",
    Status: project.projectStatusLabel || "",
    "Last Status Report": project.lastStatusReportDate || "",
    "PMO Level": project.pmoLevel || "",
    "PMO Score": project.pmoScore ?? "",
    Intervention: project.intervention || "",
    "Safety Level": project.safetyLevel || "",
    "Management Attention": project.managementAttention || "",
  }));

  const document = new Document({
    sections: [{
      children: [
        new Paragraph({ text: "PMO Status Report", heading: HeadingLevel.TITLE }),
        new Paragraph({ text: `Generated: ${report.generatedAt}` }),
        new Paragraph({ text: "Filters", heading: HeadingLevel.HEADING_1 }),
        buildDocxTable(["Filter", "Value"], filterRows),
        new Paragraph({ text: "Summary", heading: HeadingLevel.HEADING_1 }),
        buildDocxTable(["Metric", "Value"], summaryRows),
        new Paragraph({ text: "Projects", heading: HeadingLevel.HEADING_1 }),
        buildDocxTable(["Project ID", "Name", "Status", "Last Status Report", "PMO Level", "PMO Score", "Intervention", "Safety Level", "Management Attention"], projectRows),
      ],
    }],
  });
  return Packer.toBuffer(document);
}

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function xlsxColumnName(index) {
  let value = index + 1;
  let name = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function buildWorksheetXml(rows) {
  const rowXml = rows.map((row, rowIndex) => {
    const cellXml = row.map((cell, cellIndex) => {
      const ref = `${xlsxColumnName(cellIndex)}${rowIndex + 1}`;
      return `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(cell)}</t></is></c>`;
    }).join("");
    return `<row r="${rowIndex + 1}">${cellXml}</row>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowXml}</sheetData></worksheet>`;
}

function objectRows(headers, rows) {
  return [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ""))];
}

async function buildPmoStatusReportXlsxBuffer(report) {
  const zip = new JSZip();
  const summaryRows = [
    ["Metric", "Value"],
    ["Generated", report.generatedAt],
    ["Projects total", report.summary.projectsTotal],
    ["Projects matched", report.summary.projectsMatched],
    ["Projects filtered out", report.summary.projectsFilteredOut],
    ["Missing last status reports", report.summary.missingLastStatusReports],
    ["Unparsable last status reports", report.summary.unparsableLastStatusReports],
    ["Oldest last status report", report.summary.oldestLastStatusReport || ""],
    ["Newest last status report", report.summary.newestLastStatusReport || ""],
    ["Status counts", JSON.stringify(report.summary.statusCounts)],
  ];
  const filtersRows = [
    ["Filter", "Value"],
    ["Project status", report.filters.projectStatusLabels.join(", ") || "All"],
    ["Last status before", report.filters.lastStatusBefore || ""],
    ["Last status after", report.filters.lastStatusAfter || ""],
    ["Last status on", report.filters.lastStatusOn || ""],
    ["Last status contains", report.filters.lastStatusContains || ""],
    ["Last status missing", report.filters.lastStatusMissing ? "Yes" : "No"],
  ];
  const projectHeaders = ["Project ID", "Name", "Status", "Last Status Report", "PMO Level", "PMO Score", "Intervention", "Safety Level", "Management Attention", "Record URL"];
  const projectRows = objectRows(projectHeaders, report.projects.map((project) => ({
    "Project ID": project.projectId || "",
    Name: project.name || "",
    Status: project.projectStatusLabel || "",
    "Last Status Report": project.lastStatusReportDate || "",
    "PMO Level": project.pmoLevel || "",
    "PMO Score": project.pmoScore ?? "",
    Intervention: project.intervention || "",
    "Safety Level": project.safetyLevel || "",
    "Management Attention": project.managementAttention || "",
    "Record URL": project.recordUrl || "",
  })));
  const findingHeaders = ["Project ID", "Name", "Check ID", "Severity", "Recommendation"];
  const findingRows = objectRows(findingHeaders, report.pmoControlTower.portfolioFindings.map((finding) => ({
    "Project ID": finding.projectId || "",
    Name: finding.name || "",
    "Check ID": finding.checkId || "",
    Severity: finding.severity || "",
    Recommendation: finding.recommendation || "",
  })));

  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/worksheets/sheet4.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`);
  zip.folder("_rels").file(".rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);
  zip.folder("xl").file("workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>
<sheet name="Summary" sheetId="1" r:id="rId1"/>
<sheet name="Filters" sheetId="2" r:id="rId2"/>
<sheet name="Projects" sheetId="3" r:id="rId3"/>
<sheet name="PMO Findings" sheetId="4" r:id="rId4"/>
</sheets>
</workbook>`);
  zip.folder("xl").folder("_rels").file("workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>
<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet4.xml"/>
</Relationships>`);
  const worksheets = zip.folder("xl").folder("worksheets");
  worksheets.file("sheet1.xml", buildWorksheetXml(summaryRows));
  worksheets.file("sheet2.xml", buildWorksheetXml(filtersRows));
  worksheets.file("sheet3.xml", buildWorksheetXml(projectRows));
  worksheets.file("sheet4.xml", buildWorksheetXml(findingRows));
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

async function writePmoStatusReportFiles(report, options = {}) {
  const writtenFiles = {};
  if (options.docxPath) {
    ensureParentDirectory(options.docxPath);
    fs.writeFileSync(options.docxPath, await buildPmoStatusReportDocxBuffer(report));
    writtenFiles.docx = path.resolve(options.docxPath);
  }
  if (options.xlsxPath) {
    ensureParentDirectory(options.xlsxPath);
    fs.writeFileSync(options.xlsxPath, await buildPmoStatusReportXlsxBuffer(report));
    writtenFiles.xlsx = path.resolve(options.xlsxPath);
  }
  return writtenFiles;
}

function printProjectIntelligence() {
  const inputPath = getArgValue("--intelligence");
  if (!inputPath) {
    throw new Error("--intelligence requires a JSON file path or '-' for stdin.");
  }
  const projects = readProjectsInput(inputPath);
  const options = {
    today: getArgValue("--today") || undefined,
    audience: getArgValue("--audience") || "CEO/CIO",
  };
  const intelligence = projectIntelligence.buildProjectIntelligence(projects, options);
  if (process.argv.includes("--exports")) {
    console.log(JSON.stringify(projectIntelligence.buildExportBundle(projects, options), null, 2));
    return;
  }
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(intelligence, null, 2));
    return;
  }
  console.log(formatProjectIntelligenceMarkdown(intelligence));
}

async function printPmoStatusReport() {
  const inputPath = getArgValue("--pmo-report");
  if (!inputPath) {
    throw new Error("--pmo-report requires a JSON file path or '-' for stdin.");
  }
  const projects = readProjectsInput(inputPath);
  const report = projectIntelligence.buildPmoStatusReport(projects, buildPmoReportOptions());
  const writtenFiles = await writePmoStatusReportFiles(report, {
    docxPath: getArgValue("--docx"),
    xlsxPath: getArgValue("--xlsx"),
  });
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ ...report, writtenFiles }, null, 2));
    return;
  }
  const fileLines = Object.keys(writtenFiles).length
    ? `\nFiles written:\n${Object.entries(writtenFiles).map(([type, outputPath]) => `- ${type}: ${outputPath}`).join("\n")}\n`
    : "";
  console.log(`${formatPmoStatusReportMarkdown(report)}${fileLines}`);
}

async function main() {
  try {
    if (process.argv.includes("--help") || process.argv.includes("-h")) {
      printHelp();
    } else if (process.argv.includes("--dataverse")) {
      printDataverseSnippet();
    } else if (process.argv.includes("--pmo-report")) {
      await printPmoStatusReport();
    } else if (process.argv.includes("--intelligence")) {
      printProjectIntelligence();
    } else {
      console.log("Use `npm run statusbericht:help` for the Codex Browser workflow.");
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  DATAVERSE_API_VERSION,
  DATAVERSE_ORG_URL,
  DYNAMICS_APP_ID,
  PROJECT_LIST_URL,
  PROJECT_ENTITY_LOGICAL_NAME,
  PROJECT_ENTITY_SET_NAME,
  PROJECT_PRIMARY_ID_ATTRIBUTE,
  PROJECT_PRIMARY_NAME_ATTRIBUTE,
  PROJECT_ACTIVE_STATE_FILTER,
  PROJECT_MANAGER_NAME,
  PROJECT_DEFAULT_SELECT_COLUMNS,
  ACTIVE_PROJECT_STATUS_LABELS,
  STATUS_UPDATE_FIELDS,
  STATUS_UPDATE_REQUIRED_FIELDS,
  STATUS_UPDATE_SUBGRID_NAME,
  STATUS_UPDATE_TAB_NAME,
  UNCHANGED_STATUS_TEXT,
  buildActiveProjectsApiUrl,
  buildBatchProjectPreview,
  buildDataverseUrl,
  buildDynamicsProjectRecordUrl,
  buildProjectRecordApiUrl,
  buildStatusUpdateDraft,
  buildPmoStatusReportDocxBuffer,
  buildPmoStatusReportXlsxBuffer,
  formatProjectIntelligenceMarkdown,
  formatPmoStatusReportMarkdown,
  writePmoStatusReportFiles,
  buildAuditEntry: projectIntelligence.buildAuditEntry,
  buildAiEscalationPack: projectIntelligence.buildAiEscalationPack,
  buildAudienceReport: projectIntelligence.buildAudienceReport,
  buildAutonomousPmoWatchtower: projectIntelligence.buildAutonomousPmoWatchtower,
  buildCalibrationReport: projectIntelligence.buildCalibrationReport,
  buildCommitmentTracker: projectIntelligence.buildCommitmentTracker,
  buildCrossProjectDependencyIntelligence: projectIntelligence.buildCrossProjectDependencyIntelligence,
  buildDataCompletenessScore: projectIntelligence.buildDataCompletenessScore,
  buildDecisionDebtAnalysis: projectIntelligence.buildDecisionDebtAnalysis,
  buildDecisionOptionScoring: projectIntelligence.buildDecisionOptionScoring,
  buildDecisionSlaCockpit: projectIntelligence.buildDecisionSlaCockpit,
  buildDecisionClosureItems: projectIntelligence.buildDecisionClosureItems,
  buildEscalationReadinessScore: projectIntelligence.buildEscalationReadinessScore,
  buildEvidenceGapDetector: projectIntelligence.buildEvidenceGapDetector,
  buildExecutiveQuestionGenerator: projectIntelligence.buildExecutiveQuestionGenerator,
  buildExecutiveOnePager: projectIntelligence.buildExecutiveOnePager,
  buildExecutiveMemoryTimeline: projectIntelligence.buildExecutiveMemoryTimeline,
  buildExportBundle: projectIntelligence.buildExportBundle,
  buildGovernanceExceptions: projectIntelligence.buildGovernanceExceptions,
  buildGovernanceReplay: projectIntelligence.buildGovernanceReplay,
  buildHumanConfirmationAnalytics: projectIntelligence.buildHumanConfirmationAnalytics,
  buildLiveDynamicsRunPlan: projectIntelligence.buildLiveDynamicsRunPlan,
  buildManagementActionExportRows: projectIntelligence.buildManagementActionExportRows,
  buildMeetingCaptureDrafts: projectIntelligence.buildMeetingCaptureDrafts,
  buildMeetingToDynamicsPlan: projectIntelligence.buildMeetingToDynamicsPlan,
  buildNudgeDrafts: projectIntelligence.buildNudgeDrafts,
  buildPmoConfig: projectIntelligence.buildPmoConfig,
  buildPortfolioNarrativeDiff: projectIntelligence.buildPortfolioNarrativeDiff,
  buildRecoveryOptionGenerator: projectIntelligence.buildRecoveryOptionGenerator,
  buildPortfolioRiskList: projectIntelligence.buildPortfolioRiskList,
  buildProjectManagerCoach: projectIntelligence.buildProjectManagerCoach,
  buildProjectManagerQualityCoach: projectIntelligence.buildProjectManagerQualityCoach,
  buildProjectIntelligence: projectIntelligence.buildProjectIntelligence,
  buildProjectNudges: projectIntelligence.buildProjectNudges,
  buildProjectSafetyGate: projectIntelligence.buildProjectSafetyGate,
  buildProjectSafetyGateSuite: projectIntelligence.buildProjectSafetyGateSuite,
  buildProjectTruthScore: projectIntelligence.buildProjectTruthScore,
  buildPmoControlTower: projectIntelligence.buildPmoControlTower,
  buildPmoPolicySimulator: projectIntelligence.buildPmoPolicySimulator,
  buildPmoProjectControls: projectIntelligence.buildPmoProjectControls,
  buildPmoStatusReport: projectIntelligence.buildPmoStatusReport,
  buildPortfolioConstraintRadar: projectIntelligence.buildPortfolioConstraintRadar,
  buildNoSurpriseForecast: projectIntelligence.buildNoSurpriseForecast,
  buildReportQualityBenchmark: projectIntelligence.buildReportQualityBenchmark,
  buildRiskNarrativeDrift: projectIntelligence.buildRiskNarrativeDrift,
  buildRiskForecastTwin: projectIntelligence.buildRiskForecastTwin,
  buildRiskLedgerEntries: projectIntelligence.buildRiskLedgerEntries,
  buildRiskTrendIntelligence: projectIntelligence.buildRiskTrendIntelligence,
  buildRoleBasedNarrativeEngine: projectIntelligence.buildRoleBasedNarrativeEngine,
  buildSafeWritebackSimulation: projectIntelligence.buildSafeWritebackSimulation,
  buildSafeWritebackSimulationPro: projectIntelligence.buildSafeWritebackSimulationPro,
  buildSponsorActionIntelligence: projectIntelligence.buildSponsorActionIntelligence,
  buildSteeringAgenda: projectIntelligence.buildSteeringAgenda,
  buildTrustContract: projectIntelligence.buildTrustContract,
  buildWhatIfRecoveryPlan: projectIntelligence.buildWhatIfRecoveryPlan,
  detectStatusDelta: projectIntelligence.detectStatusDelta,
  evaluateProjectStatusQuality,
  evaluateStatusQuality: projectIntelligence.evaluateStatusQuality,
  extractDecisionRadar: projectIntelligence.extractDecisionRadar,
  formatOptionLabel,
  getDataverseBrowserSnippet,
  readProjectsInput,
  isSampleInputPath,
  isActiveProjectCandidate,
  mapProjectDataverseRow,
  normalizeStatusInput,
  normalizeGuid,
};
