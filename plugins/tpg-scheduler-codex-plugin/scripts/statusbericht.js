#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const JSZip = require("jszip");
const {
  AlignmentType,
  BorderStyle,
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
const PMO_PROJECT_EXPORT_TYPE = "tpg_pmo_project_export";
const PMO_PROJECT_EXPORT_VERSION = "1.0";
const STATUS_API_FEATURE_VERSION = "1.0";
const STATUS_UPDATE_ENTITY_LOGICAL_NAME_CANDIDATES = [
  "tpg_statusupdate",
  "tpg_projectstatusupdate",
  "gbl_statusupdate",
];
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

function buildDataverseQuery(selectColumns = PROJECT_DEFAULT_SELECT_COLUMNS, filter = PROJECT_ACTIVE_STATE_FILTER, top, orderBy) {
  const parts = [];
  if (selectColumns?.length) {
    parts.push(`$select=${selectColumns.join(",")}`);
  }
  if (filter) {
    parts.push(`$filter=${filter}`);
  }
  if (top) {
    parts.push(`$top=${Number(top)}`);
  }
  if (orderBy) {
    parts.push(`$orderby=${orderBy}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

function buildProjectRecordApiUrl(projectId, selectColumns = PROJECT_DEFAULT_SELECT_COLUMNS) {
  const id = normalizeGuid(projectId);
  if (!id) {
    throw new Error("projectId is required");
  }
  return buildDataverseUrl(`${PROJECT_ENTITY_SET_NAME}(${id})${buildDataverseQuery(selectColumns, null)}`);
}

function buildActiveProjectsApiUrl(selectColumns = PROJECT_DEFAULT_SELECT_COLUMNS, options = {}) {
  return buildDataverseUrl(`${PROJECT_ENTITY_SET_NAME}${buildDataverseQuery(
    selectColumns,
    options.filter || PROJECT_ACTIVE_STATE_FILTER,
    options.top,
    options.orderBy || "modifiedon desc"
  )}`);
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

function buildPmoProjectExport(projects, options = {}) {
  const normalizedProjects = (projects || []).map((project) => (
    project?.raw && project.raw[PROJECT_PRIMARY_ID_ATTRIBUTE] ? mapProjectDataverseRow(project.raw) : project
  ));
  return {
    exportType: PMO_PROJECT_EXPORT_TYPE,
    version: PMO_PROJECT_EXPORT_VERSION,
    source: "dataverse_web_api",
    generatedAt: options.generatedAt || new Date().toISOString(),
    organizationUrl: options.organizationUrl || DATAVERSE_ORG_URL,
    apiVersion: options.apiVersion || DATAVERSE_API_VERSION,
    entityLogicalName: options.entityLogicalName || PROJECT_ENTITY_LOGICAL_NAME,
    entitySetName: options.entitySetName || PROJECT_ENTITY_SET_NAME,
    filter: options.filter || PROJECT_ACTIVE_STATE_FILTER,
    selectColumns: options.selectColumns || PROJECT_DEFAULT_SELECT_COLUMNS,
    orderBy: options.orderBy || "modifiedon desc",
    projectCount: normalizedProjects.length,
    projects: normalizedProjects,
    safety: {
      readOnlyExport: true,
      crmWritesIncluded: false,
      requiresExplicitSaveConfirmationForWriteback: true,
      mockDataAllowed: false,
    },
  };
}

function unwrapProjectInput(parsed) {
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (parsed && typeof parsed === "object" && Array.isArray(parsed.projects)) {
    return parsed.projects;
  }
  throw new Error("Project intelligence input must be a JSON array of projects or an offline Dataverse snapshot with a projects array.");
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

function normalizeReportMonth(value, options = {}) {
  const source = value || options.today || new Date().toISOString().slice(0, 10);
  const match = String(source).match(/^(\d{4})-(\d{2})/);
  if (!match) {
    throw new Error("report month must use YYYY-MM or a date starting with YYYY-MM.");
  }
  return `${match[1]}-${match[2]}`;
}

function getMonthBounds(reportMonth) {
  const normalized = normalizeReportMonth(reportMonth);
  const [year, month] = normalized.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return {
    reportMonth: normalized,
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
  };
}

function buildMonthlyStatusReportDraft(project = {}, statusText = "", options = {}) {
  const month = getMonthBounds(options.reportMonth || options.month || options.reportDate || options.today);
  const normalizedStatusText = normalizeStatusInput(statusText || options.statusText || "");
  const draft = buildStatusUpdateDraft(normalizedStatusText, {
    ...options,
    reportDate: options.reportDate || month.periodEnd,
  });
  const safetyGate = projectIntelligence.buildProjectSafetyGate(project, {
    ...options,
    draft,
    generatedContent: Boolean(options.generatedContent),
    reviewed: Boolean(options.reviewed),
    requiresSubmittedTo: true,
    submittedTo: draft.submittedTo,
  });
  const simulation = projectIntelligence.buildSafeWritebackSimulation(project, draft);
  const projectLabel = project.name || project.projectId || project.id || "unknown project";
  const confirmationText = [
    `CONFIRM MONTHLY STATUS WRITEBACK`,
    `Project: ${projectLabel}`,
    `Month: ${month.reportMonth}`,
    `Report Date: ${draft.fields[STATUS_UPDATE_FIELDS.reportDate]}`,
    `Email Status Update: ${draft.emailStatusUpdate ? "Yes" : "No"}`,
  ].join(" | ");
  return {
    projectId: project.projectId || project.id || null,
    name: project.name || null,
    recordUrl: project.recordUrl || (project.id ? buildDynamicsProjectRecordUrl(project.id) : null),
    reportMonth: month.reportMonth,
    periodStart: month.periodStart,
    periodEnd: month.periodEnd,
    statusRequired: !normalizedStatusText,
    statusText: normalizedStatusText,
    draft,
    safetyLevel: safetyGate.safetyLevel,
    writebackRisk: safetyGate.writebackRisk,
    safetyGate,
    simulation,
    writeback: {
      mode: "quick_create_confirmation_gated",
      canStageInQuickCreate: Boolean(normalizedStatusText) && simulation.changes.length > 0,
      canAutoSave: false,
      requiresProjectManagerVerification: true,
      requiresExplicitSaveConfirmation: true,
      confirmationText,
      blockers: [
        ...simulation.blockers,
        ...(!normalizedStatusText ? ["Monthly status text is missing."] : []),
        ...(safetyGate.writebackRisk === "blocked_until_confirmation" ? ["Safety gate requires explicit writeback confirmation."] : []),
      ],
      steps: [
        "Open the verified project record.",
        "Open Status Update tab and choose New Status Update.",
        "Stage the prepared fields in Quick Create: Status Update.",
        "Verify Submitted To and Email Status Update.",
        "Save only after the exact confirmation text matches the project, month, status text, and email setting.",
      ],
    },
  };
}

function buildMonthlyStatusReportRun(projects = [], options = {}) {
  const month = getMonthBounds(options.reportMonth || options.month || options.reportDate || options.today);
  const statusByProjectId = options.statusByProjectId || {};
  const activeProjects = (projects || []).filter(isActiveProjectCandidate);
  const reports = activeProjects.map((project) => {
    const keyCandidates = [project.projectId, project.id, project.projectNumber, project.name].filter(Boolean);
    const statusText = keyCandidates.map((key) => statusByProjectId[key]).find((value) => value != null)
      ?? options.defaultStatusText
      ?? "";
    return buildMonthlyStatusReportDraft(project, statusText, { ...options, reportMonth: month.reportMonth });
  });
  const byWritebackRisk = reports.reduce((summary, report) => {
    summary[report.writebackRisk] = (summary[report.writebackRisk] || 0) + 1;
    return summary;
  }, {});
  return {
    reportType: "monthly_status_writeback",
    title: "Monthly Project Status Writeback Plan",
    generatedAt: options.generatedAt || new Date().toISOString(),
    reportMonth: month.reportMonth,
    periodStart: month.periodStart,
    periodEnd: month.periodEnd,
    summary: {
      projectsReviewed: activeProjects.length,
      draftsReady: reports.filter((report) => !report.statusRequired).length,
      statusInputsMissing: reports.filter((report) => report.statusRequired).length,
      blockedUntilConfirmation: reports.filter((report) => report.writebackRisk === "blocked_until_confirmation").length,
      byWritebackRisk,
      writebackMode: "quick_create_confirmation_gated",
      canAutoSave: false,
    },
    reports,
    nextSteps: reports.some((report) => report.statusRequired)
      ? ["Collect missing monthly status text from project leaders before staging."]
      : ["Open each verified project and stage the prepared Quick Create status update after review."],
  };
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashPayload(value) {
  return crypto.createHash("sha256").update(stableJson(value)).digest("hex");
}

function buildStatusReportIdempotencyKey(project = {}, draft = {}, options = {}) {
  const reportMonth = normalizeReportMonth(options.reportMonth || draft.reportMonth || draft.fields?.[STATUS_UPDATE_FIELDS.reportDate] || options.today);
  const payload = {
    projectId: project.projectId || project.id || draft.projectId || null,
    reportMonth,
    statusSummary: draft.fields?.[STATUS_UPDATE_FIELDS.statusSummary] || draft.statusText || "",
    reportDate: draft.fields?.[STATUS_UPDATE_FIELDS.reportDate] || null,
  };
  return `status:${payload.projectId || "unknown"}:${reportMonth}:${hashPayload(payload).slice(0, 16)}`;
}

function buildStructuredStatusUpdateDraft(input = {}, options = {}) {
  const statusText = input.statusSummary || input.currentStatus || input.accomplishedActivities || input.statusText || "";
  return buildStatusUpdateDraft(statusText, {
    ...options,
    reportDate: input.reportDate || options.reportDate,
    accomplishedActivities: input.accomplishedActivities ?? input.currentStatus ?? statusText,
    missedActivities: input.missedActivities,
    plannedActivities: input.plannedActivities ?? input.nextSteps,
    sponsorActions: input.sponsorActions,
    obstaclesAndMeasures: input.obstaclesAndMeasures ?? input.risks,
    decisions: input.decisions,
    submittedTo: input.submittedTo || options.submittedTo,
    emailStatusUpdate: input.emailStatusUpdate ?? options.emailStatusUpdate,
  });
}

function getStatusUpdateReportMonth(update = {}) {
  return normalizeReportMonth(
    update.reportMonth
      || update[STATUS_UPDATE_FIELDS.reportDate]
      || update.reportDate
      || update.createdon
      || update.createdOn
      || update.modifiedon
  );
}

function buildStatusUpdateDuplicateCheck(existingUpdates = [], draft = {}, options = {}) {
  const reportMonth = normalizeReportMonth(options.reportMonth || draft.reportMonth || draft.fields?.[STATUS_UPDATE_FIELDS.reportDate] || options.today);
  const projectId = normalizeGuid(options.projectId || options.projectGuid || draft.projectGuid || "");
  const projectBusinessId = String(options.projectBusinessId || draft.projectId || "").toLowerCase();
  const matches = (existingUpdates || []).filter((update) => {
    let updateMonth = null;
    try {
      updateMonth = getStatusUpdateReportMonth(update);
    } catch {
      return false;
    }
    const updateProjectGuid = normalizeGuid(update._tpg_project_value || update.projectGuid || update.projectIdGuid || "");
    const updateProjectBusinessId = String(update.projectId || update.tpg_projectnum || "").toLowerCase();
    const sameProject = projectId
      ? updateProjectGuid === projectId
      : projectBusinessId
        ? updateProjectBusinessId === projectBusinessId
        : true;
    return sameProject && updateMonth === reportMonth;
  });
  return {
    projectId: options.projectBusinessId || draft.projectId || null,
    projectGuid: projectId || null,
    reportMonth,
    duplicateFound: matches.length > 0,
    duplicateCount: matches.length,
    matches,
    recommendedAction: matches.length ? "review_existing_status_update_before_writeback" : "safe_to_stage_new_status_update",
  };
}

function validateMonthlyStatusDraft(project = {}, monthlyDraft = {}, options = {}) {
  const requiredFields = [
    STATUS_UPDATE_FIELDS.reportDate,
    STATUS_UPDATE_FIELDS.statusSummary,
    STATUS_UPDATE_FIELDS.accomplishedActivities,
  ];
  const fields = monthlyDraft.draft?.fields || monthlyDraft.fields || {};
  const missingFields = requiredFields.filter((field) => !fields[field]);
  const blockers = [
    ...missingFields.map((field) => `Missing required draft field: ${field}`),
    ...(!project.recordUrl ? ["Project record URL is missing."] : []),
    ...(monthlyDraft.writeback?.blockers || []),
  ];
  const duplicateCheck = buildStatusUpdateDuplicateCheck(options.existingUpdates || [], {
    ...monthlyDraft,
    fields,
    projectId: project.projectId,
  }, {
    projectId: project.id,
    projectBusinessId: project.projectId,
    reportMonth: monthlyDraft.reportMonth || options.reportMonth,
  });
  if (duplicateCheck.duplicateFound) {
    blockers.push("Monthly status update already exists for this project/month.");
  }
  return {
    projectId: project.projectId || project.id || null,
    name: project.name || null,
    reportMonth: duplicateCheck.reportMonth,
    valid: blockers.length === 0,
    blockers,
    duplicateCheck,
    idempotencyKey: buildStatusReportIdempotencyKey(project, fields ? { fields } : monthlyDraft.draft, {
      reportMonth: duplicateCheck.reportMonth,
    }),
  };
}

function buildStatusWritebackQueue(monthlyRun = {}, options = {}) {
  const reports = monthlyRun.reports || [];
  const items = reports.map((report, index) => {
    const validation = validateMonthlyStatusDraft({
      id: report.projectId,
      projectId: report.projectId,
      name: report.name,
      recordUrl: report.recordUrl,
    }, report, {
      reportMonth: report.reportMonth || monthlyRun.reportMonth,
      existingUpdates: options.existingUpdatesByProjectId?.[report.projectId] || [],
    });
    const status = validation.valid ? "proposed" : "blocked";
    return {
      queueId: `monthly-status:${monthlyRun.reportMonth || report.reportMonth}:${report.projectId || index}`,
      status,
      projectId: report.projectId || null,
      name: report.name || null,
      reportMonth: report.reportMonth || monthlyRun.reportMonth,
      idempotencyKey: validation.idempotencyKey,
      validation,
      draft: report.draft,
      confirmationText: report.writeback?.confirmationText || null,
      canAutoSave: false,
    };
  });
  return {
    queueType: "monthly_status_writeback",
    version: STATUS_API_FEATURE_VERSION,
    reportMonth: monthlyRun.reportMonth || null,
    generatedAt: options.generatedAt || new Date().toISOString(),
    summary: {
      total: items.length,
      proposed: items.filter((item) => item.status === "proposed").length,
      blocked: items.filter((item) => item.status === "blocked").length,
      canAutoSave: false,
    },
    items,
  };
}

function buildStatusWritebackAuditEvent(action, payload = {}, options = {}) {
  return {
    eventType: "status_writeback_audit",
    version: STATUS_API_FEATURE_VERSION,
    at: options.at || new Date().toISOString(),
    actor: options.actor || "Codex",
    action,
    projectId: payload.projectId || payload.project?.projectId || null,
    reportMonth: payload.reportMonth || null,
    idempotencyKey: payload.idempotencyKey || null,
    outcome: payload.outcome || "not_saved",
    confirmationText: payload.confirmationText || null,
    evidence: payload.evidence || [],
  };
}

function buildStatusUpdateHistoryQuery(project = {}, options = {}) {
  const projectGuid = normalizeGuid(options.projectGuid || project.id || "");
  const month = options.reportMonth ? getMonthBounds(options.reportMonth) : null;
  const filters = [];
  if (projectGuid) {
    filters.push(`_${STATUS_UPDATE_FIELDS.project}_value eq ${projectGuid}`);
  }
  if (month) {
    filters.push(`${STATUS_UPDATE_FIELDS.reportDate} ge ${month.periodStart} and ${STATUS_UPDATE_FIELDS.reportDate} le ${month.periodEnd}`);
  }
  return {
    entityLogicalName: options.entityLogicalName || null,
    entitySetName: options.entitySetName || null,
    selectColumns: options.selectColumns || [
      STATUS_UPDATE_FIELDS.reportDate,
      STATUS_UPDATE_FIELDS.statusSummary,
      STATUS_UPDATE_FIELDS.accomplishedActivities,
      STATUS_UPDATE_FIELDS.plannedActivities,
      STATUS_UPDATE_FIELDS.obstaclesAndMeasures,
      STATUS_UPDATE_FIELDS.decisions,
      STATUS_UPDATE_FIELDS.emailStatusUpdate,
    ],
    filter: filters.join(" and "),
    orderBy: `${STATUS_UPDATE_FIELDS.reportDate} desc`,
    top: options.top || 50,
  };
}

function buildDeltaProjectsApiUrl(options = {}) {
  const modifiedSince = options.modifiedSince || options.since;
  if (!modifiedSince) {
    throw new Error("modifiedSince is required for a delta project API URL.");
  }
  const filter = `${PROJECT_ACTIVE_STATE_FILTER} and modifiedon gt ${modifiedSince}`;
  return buildActiveProjectsApiUrl(options.selectColumns || PROJECT_DEFAULT_SELECT_COLUMNS, {
    filter,
    top: options.top,
    orderBy: options.orderBy || "modifiedon desc",
  });
}

function buildStatusUpdateWritebackPayload(project = {}, draft = {}, metadata = {}, options = {}) {
  const entityLogicalName = options.entityLogicalName || metadata.entityLogicalName;
  const projectLookupBinding = options.projectLookupBinding || metadata.projectLookupBinding;
  const submittedToBinding = options.submittedToBinding || metadata.submittedToBinding;
  const projectGuid = normalizeGuid(options.projectGuid || project.id || "");
  const fields = { ...(draft.fields || {}) };
  if (projectLookupBinding && projectGuid) {
    fields[`${projectLookupBinding}@odata.bind`] = `/${PROJECT_ENTITY_SET_NAME}(${projectGuid})`;
  }
  if (submittedToBinding && options.submittedToId) {
    fields[`${submittedToBinding}@odata.bind`] = `/${options.submittedToEntitySet || "systemusers"}(${normalizeGuid(options.submittedToId)})`;
  }
  if (draft.emailStatusUpdate != null) {
    fields[STATUS_UPDATE_FIELDS.emailStatusUpdate] = Boolean(draft.emailStatusUpdate);
  }
  const blockers = [];
  if (!entityLogicalName) blockers.push("Status Update entity logical name is missing.");
  if (!projectLookupBinding) blockers.push("Project lookup binding field is missing.");
  if (!projectGuid) blockers.push("Project GUID is missing.");
  if (!fields[STATUS_UPDATE_FIELDS.reportDate]) blockers.push("Report Date is missing.");
  if (!fields[STATUS_UPDATE_FIELDS.statusSummary]) blockers.push("Status Summary is missing.");
  return {
    entityLogicalName: entityLogicalName || null,
    payload: fields,
    blockers,
    canCreate: blockers.length === 0,
  };
}

function buildStatusUpdateCreateRecordPlan(project = {}, draft = {}, metadata = {}, options = {}) {
  const writebackPayload = buildStatusUpdateWritebackPayload(project, draft, metadata, options);
  const reportMonth = normalizeReportMonth(options.reportMonth || draft.fields?.[STATUS_UPDATE_FIELDS.reportDate] || options.today);
  const idempotencyKey = buildStatusReportIdempotencyKey(project, draft, { reportMonth });
  return {
    operation: "Xrm.WebApi.createRecord",
    version: STATUS_API_FEATURE_VERSION,
    projectId: project.projectId || project.id || null,
    reportMonth,
    idempotencyKey,
    entityLogicalName: writebackPayload.entityLogicalName,
    payload: writebackPayload.payload,
    blockers: writebackPayload.blockers,
    canCreateAfterConfirmation: writebackPayload.canCreate,
    canAutoSave: false,
    confirmationText: `CONFIRM DATAVERSE STATUS CREATE | Project: ${project.name || project.projectId || project.id || "unknown project"} | Month: ${reportMonth} | Idempotency: ${idempotencyKey}`,
  };
}

function buildStatusUpdateAttachmentPlan(project = {}, reportArtifact = {}, options = {}) {
  return {
    operation: "attach_status_report_artifact",
    version: STATUS_API_FEATURE_VERSION,
    projectId: project.projectId || project.id || null,
    reportMonth: options.reportMonth || reportArtifact.reportMonth || null,
    artifactName: reportArtifact.name || reportArtifact.path || null,
    artifactType: reportArtifact.type || path.extname(reportArtifact.path || "").replace(".", "") || "unknown",
    target: options.target || "annotation_or_link",
    canAutoAttach: false,
    blockers: [
      ...(!reportArtifact.path && !reportArtifact.url ? ["Artifact path or URL is missing."] : []),
      ...(!options.confirmed ? ["Attachment requires explicit confirmation."] : []),
    ],
  };
}

function mapDataverseError(error = {}) {
  const message = String(error.message || error.error?.message || error.statusText || error);
  const code = error.errorCode || error.status || error.code || null;
  let category = "unknown";
  if (/privilege|permission|access|401|403/i.test(message)) category = "permission";
  else if (/required|missing|null/i.test(message)) category = "required_field";
  else if (/duplicate|alternate key|idempot/i.test(message)) category = "duplicate";
  else if (/lookup|bind|navigation/i.test(message)) category = "lookup_binding";
  else if (/plugin|business process|validation/i.test(message)) category = "business_rule";
  return {
    category,
    code,
    message,
    userMessage: {
      permission: "Dataverse permission is missing for this status operation.",
      required_field: "A required Status Update field is missing or empty.",
      duplicate: "A matching status update may already exist.",
      lookup_binding: "A Dataverse lookup binding is invalid or incomplete.",
      business_rule: "A Dynamics business rule or plugin rejected the operation.",
      unknown: "Dataverse returned an unmapped error.",
    }[category],
  };
}

function buildDataversePermissionProbePlan(options = {}) {
  return {
    operation: "dataverse_permission_probe",
    version: STATUS_API_FEATURE_VERSION,
    readProbe: {
      entityLogicalName: PROJECT_ENTITY_LOGICAL_NAME,
      query: buildDataverseQuery([PROJECT_PRIMARY_ID_ATTRIBUTE], PROJECT_ACTIVE_STATE_FILTER, 1),
    },
    writeProbe: {
      entityLogicalName: options.statusUpdateEntityLogicalName || null,
      safeMode: "metadata_only_no_create",
      requiredPrivileges: ["Read", "Create"],
    },
  };
}

function buildStatusApiEnvelope(payload = {}, options = {}) {
  return {
    api: "tpg_status_api",
    version: STATUS_API_FEATURE_VERSION,
    generatedAt: options.generatedAt || new Date().toISOString(),
    schemaVersion: options.schemaVersion || "2026-06",
    payload,
  };
}

function getDataverseBrowserSnippet() {
  return String.raw`(() => {
  const constants = ${JSON.stringify({
    DATAVERSE_ORG_URL,
    DATAVERSE_API_VERSION,
    DYNAMICS_APP_ID,
    PROJECT_LIST_URL,
    PROJECT_ENTITY_LOGICAL_NAME,
    PROJECT_ENTITY_SET_NAME,
    PROJECT_PRIMARY_ID_ATTRIBUTE,
    PROJECT_PRIMARY_NAME_ATTRIBUTE,
    PMO_PROJECT_EXPORT_TYPE,
    PMO_PROJECT_EXPORT_VERSION,
    STATUS_API_FEATURE_VERSION,
    STATUS_UPDATE_ENTITY_LOGICAL_NAME_CANDIDATES,
    PROJECT_DEFAULT_SELECT_COLUMNS,
    PROJECT_ACTIVE_STATE_FILTER,
    PROJECT_MANAGER_NAME,
    ACTIVE_PROJECT_STATUS_LABELS,
    STATUS_UPDATE_TAB_NAME,
    STATUS_UPDATE_SUBGRID_NAME,
    STATUS_UPDATE_FIELDS,
    UNCHANGED_STATUS_TEXT,
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

  function buildDynamicsProjectRecordUrl(projectId) {
    const id = normalizeGuid(projectId);
    return id
      ? constants.DATAVERSE_ORG_URL + "/main.aspx?appid=" + constants.DYNAMICS_APP_ID + "&forceUCI=1&pagetype=entityrecord&etn=" + constants.PROJECT_ENTITY_LOGICAL_NAME + "&id=" + id
      : null;
  }

  function buildProjectRecordApiUrl(projectId, selectColumns = constants.PROJECT_DEFAULT_SELECT_COLUMNS) {
    const id = normalizeGuid(projectId);
    return id
      ? constants.DATAVERSE_ORG_URL + "/api/data/" + constants.DATAVERSE_API_VERSION + "/" + constants.PROJECT_ENTITY_SET_NAME + "(" + id + ")" + buildQuery(selectColumns, null)
      : null;
  }

  function buildQuery(selectColumns = constants.PROJECT_DEFAULT_SELECT_COLUMNS, filter = constants.PROJECT_ACTIVE_STATE_FILTER, top, orderBy) {
    const parts = [];
    if (selectColumns.length) parts.push("$select=" + selectColumns.join(","));
    if (filter) parts.push("$filter=" + filter);
    if (top) parts.push("$top=" + Number(top));
    if (orderBy) parts.push("$orderby=" + orderBy);
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
      recordUrl: buildDynamicsProjectRecordUrl(id),
      apiUrl: buildProjectRecordApiUrl(id),
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

  function normalizeStatusInput(value) {
    const trimmed = String(value || "").trim();
    return trimmed.toLowerCase() === "kv" ? constants.UNCHANGED_STATUS_TEXT : trimmed;
  }

  function normalizeReportMonth(value) {
    const source = value || new Date().toISOString().slice(0, 10);
    const match = String(source).match(/^(\\d{4})-(\\d{2})/);
    if (!match) throw new Error("report month must use YYYY-MM or a date starting with YYYY-MM.");
    return match[1] + "-" + match[2];
  }

  function getMonthBounds(reportMonth) {
    const normalized = normalizeReportMonth(reportMonth);
    const parts = normalized.split("-").map(Number);
    const start = new Date(Date.UTC(parts[0], parts[1] - 1, 1));
    const end = new Date(Date.UTC(parts[0], parts[1], 0));
    return {
      reportMonth: normalized,
      periodStart: start.toISOString().slice(0, 10),
      periodEnd: end.toISOString().slice(0, 10),
    };
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

  function buildStatusUpdateDraft(statusText, options = {}) {
    const normalizedStatusText = normalizeStatusInput(statusText);
    const reportDate = options.reportDate || new Date().toISOString().slice(0, 10);
    const accomplishedActivities = options.accomplishedActivities ?? normalizedStatusText;
    return {
      entityLabel: "Status Update",
      fields: {
        [constants.STATUS_UPDATE_FIELDS.reportDate]: reportDate,
        [constants.STATUS_UPDATE_FIELDS.statusSummary]: normalizedStatusText,
        [constants.STATUS_UPDATE_FIELDS.accomplishedActivities]: accomplishedActivities,
        [constants.STATUS_UPDATE_FIELDS.missedActivities]: options.missedActivities || "",
        [constants.STATUS_UPDATE_FIELDS.plannedActivities]: options.plannedActivities || "",
        [constants.STATUS_UPDATE_FIELDS.sponsorActions]: options.sponsorActions || "",
        [constants.STATUS_UPDATE_FIELDS.obstaclesAndMeasures]: options.obstaclesAndMeasures || "",
        [constants.STATUS_UPDATE_FIELDS.decisions]: options.decisions || "",
      },
      submittedTo: options.submittedTo || null,
      emailStatusUpdate: options.emailStatusUpdate ?? false,
      requiresExplicitSaveConfirmation: true,
      requiresSubmittedToWhenEmpty: true,
    };
  }

  function buildMonthlyStatusReportDraft(project = {}, statusText = "", options = {}) {
    const month = getMonthBounds(options.reportMonth || options.month || options.reportDate || options.today);
    const normalizedStatusText = normalizeStatusInput(statusText || options.statusText || "");
    const draft = buildStatusUpdateDraft(normalizedStatusText, { ...options, reportDate: options.reportDate || month.periodEnd });
    const simulation = {
      projectId: project.projectId || null,
      name: project.name || null,
      changes: Object.entries(draft.fields || {}).map(([field, nextValue]) => ({ field, nextValue })),
      blockers: [
        ...(draft.emailStatusUpdate ? ["Email Status Update is enabled."] : []),
        ...(!normalizedStatusText ? ["Monthly status text is missing."] : []),
      ],
      confirmations: ["Confirm project, status text, target fields, and email setting before save."],
      canAutoSave: false,
    };
    const projectLabel = project.name || project.projectId || project.id || "unknown project";
    return {
      projectId: project.projectId || project.id || null,
      name: project.name || null,
      recordUrl: project.recordUrl || (project.id ? buildDynamicsProjectRecordUrl(project.id) : null),
      reportMonth: month.reportMonth,
      periodStart: month.periodStart,
      periodEnd: month.periodEnd,
      statusRequired: !normalizedStatusText,
      statusText: normalizedStatusText,
      draft,
      simulation,
      writeback: {
        mode: "quick_create_confirmation_gated",
        canStageInQuickCreate: Boolean(normalizedStatusText),
        canAutoSave: false,
        requiresProjectManagerVerification: true,
        requiresExplicitSaveConfirmation: true,
        confirmationText: "CONFIRM MONTHLY STATUS WRITEBACK | Project: " + projectLabel + " | Month: " + month.reportMonth + " | Report Date: " + draft.fields[constants.STATUS_UPDATE_FIELDS.reportDate] + " | Email Status Update: " + (draft.emailStatusUpdate ? "Yes" : "No"),
        blockers: simulation.blockers,
      },
    };
  }

  function buildMonthlyStatusReportRun(projects = [], options = {}) {
    const month = getMonthBounds(options.reportMonth || options.month || options.reportDate || options.today);
    const statusByProjectId = options.statusByProjectId || {};
    const reports = (projects || []).filter(isActiveProjectCandidate).map((project) => {
      const keys = [project.projectId, project.id, project.projectNumber, project.name].filter(Boolean);
      const statusText = keys.map((key) => statusByProjectId[key]).find((value) => value != null) ?? options.defaultStatusText ?? "";
      return buildMonthlyStatusReportDraft(project, statusText, { ...options, reportMonth: month.reportMonth });
    });
    return {
      reportType: "monthly_status_writeback",
      title: "Monthly Project Status Writeback Plan",
      generatedAt: options.generatedAt || new Date().toISOString(),
      reportMonth: month.reportMonth,
      periodStart: month.periodStart,
      periodEnd: month.periodEnd,
      summary: {
        projectsReviewed: reports.length,
        draftsReady: reports.filter((report) => !report.statusRequired).length,
        statusInputsMissing: reports.filter((report) => report.statusRequired).length,
        writebackMode: "quick_create_confirmation_gated",
        canAutoSave: false,
      },
      reports,
    };
  }

  function stableJson(value) {
    if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
    if (value && typeof value === "object") {
      return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + stableJson(value[key])).join(",") + "}";
    }
    return JSON.stringify(value);
  }

  function hashString(value) {
    let hash = 0;
    const text = String(value || "");
    for (let index = 0; index < text.length; index += 1) {
      hash = ((hash << 5) - hash) + text.charCodeAt(index);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, "0");
  }

  function buildStatusReportIdempotencyKey(project = {}, draft = {}, options = {}) {
    const reportMonth = normalizeReportMonth(options.reportMonth || draft.reportMonth || draft.fields?.[constants.STATUS_UPDATE_FIELDS.reportDate] || options.today);
    const payload = {
      projectId: project.projectId || project.id || draft.projectId || null,
      reportMonth,
      statusSummary: draft.fields?.[constants.STATUS_UPDATE_FIELDS.statusSummary] || draft.statusText || "",
      reportDate: draft.fields?.[constants.STATUS_UPDATE_FIELDS.reportDate] || null,
    };
    return "status:" + (payload.projectId || "unknown") + ":" + reportMonth + ":" + hashString(stableJson(payload));
  }

  function buildStructuredStatusUpdateDraft(input = {}, options = {}) {
    const statusText = input.statusSummary || input.currentStatus || input.accomplishedActivities || input.statusText || "";
    return buildStatusUpdateDraft(statusText, {
      ...options,
      reportDate: input.reportDate || options.reportDate,
      accomplishedActivities: input.accomplishedActivities ?? input.currentStatus ?? statusText,
      missedActivities: input.missedActivities,
      plannedActivities: input.plannedActivities ?? input.nextSteps,
      sponsorActions: input.sponsorActions,
      obstaclesAndMeasures: input.obstaclesAndMeasures ?? input.risks,
      decisions: input.decisions,
      submittedTo: input.submittedTo || options.submittedTo,
      emailStatusUpdate: input.emailStatusUpdate ?? options.emailStatusUpdate,
    });
  }

  function buildStatusUpdateDuplicateCheck(existingUpdates = [], draft = {}, options = {}) {
    const reportMonth = normalizeReportMonth(options.reportMonth || draft.reportMonth || draft.fields?.[constants.STATUS_UPDATE_FIELDS.reportDate] || options.today);
    const projectId = normalizeGuid(options.projectId || options.projectGuid || draft.projectGuid || "");
    const projectBusinessId = String(options.projectBusinessId || draft.projectId || "").toLowerCase();
    const matches = (existingUpdates || []).filter((update) => {
      const date = update.reportMonth || update[constants.STATUS_UPDATE_FIELDS.reportDate] || update.reportDate || update.createdon || update.modifiedon;
      if (!date || normalizeReportMonth(date) !== reportMonth) return false;
      const updateProjectGuid = normalizeGuid(update._tpg_project_value || update.projectGuid || update.projectIdGuid || "");
      const updateProjectBusinessId = String(update.projectId || update.tpg_projectnum || "").toLowerCase();
      return projectId ? updateProjectGuid === projectId : projectBusinessId ? updateProjectBusinessId === projectBusinessId : true;
    });
    return {
      reportMonth,
      duplicateFound: matches.length > 0,
      duplicateCount: matches.length,
      matches,
      recommendedAction: matches.length ? "review_existing_status_update_before_writeback" : "safe_to_stage_new_status_update",
    };
  }

  function validateMonthlyStatusDraft(project = {}, monthlyDraft = {}, options = {}) {
    const fields = monthlyDraft.draft?.fields || monthlyDraft.fields || {};
    const missingFields = [
      constants.STATUS_UPDATE_FIELDS.reportDate,
      constants.STATUS_UPDATE_FIELDS.statusSummary,
      constants.STATUS_UPDATE_FIELDS.accomplishedActivities,
    ].filter((field) => !fields[field]);
    const duplicateCheck = buildStatusUpdateDuplicateCheck(options.existingUpdates || [], { ...monthlyDraft, fields, projectId: project.projectId }, {
      projectId: project.id,
      projectBusinessId: project.projectId,
      reportMonth: monthlyDraft.reportMonth || options.reportMonth,
    });
    const blockers = [
      ...missingFields.map((field) => "Missing required draft field: " + field),
      ...(!project.recordUrl ? ["Project record URL is missing."] : []),
      ...(monthlyDraft.writeback?.blockers || []),
      ...(duplicateCheck.duplicateFound ? ["Monthly status update already exists for this project/month."] : []),
    ];
    return {
      projectId: project.projectId || project.id || null,
      reportMonth: duplicateCheck.reportMonth,
      valid: blockers.length === 0,
      blockers,
      duplicateCheck,
      idempotencyKey: buildStatusReportIdempotencyKey(project, { fields }, { reportMonth: duplicateCheck.reportMonth }),
    };
  }

  function buildStatusWritebackQueue(monthlyRun = {}, options = {}) {
    const reports = monthlyRun.reports || [];
    const items = reports.map((report, index) => {
      const validation = validateMonthlyStatusDraft({ id: report.projectId, projectId: report.projectId, name: report.name, recordUrl: report.recordUrl }, report, {
        reportMonth: report.reportMonth || monthlyRun.reportMonth,
        existingUpdates: options.existingUpdatesByProjectId?.[report.projectId] || [],
      });
      return {
        queueId: "monthly-status:" + (monthlyRun.reportMonth || report.reportMonth) + ":" + (report.projectId || index),
        status: validation.valid ? "proposed" : "blocked",
        projectId: report.projectId || null,
        reportMonth: report.reportMonth || monthlyRun.reportMonth,
        idempotencyKey: validation.idempotencyKey,
        validation,
        draft: report.draft,
        confirmationText: report.writeback?.confirmationText || null,
        canAutoSave: false,
      };
    });
    return {
      queueType: "monthly_status_writeback",
      version: constants.STATUS_API_FEATURE_VERSION,
      reportMonth: monthlyRun.reportMonth || null,
      generatedAt: options.generatedAt || new Date().toISOString(),
      summary: {
        total: items.length,
        proposed: items.filter((item) => item.status === "proposed").length,
        blocked: items.filter((item) => item.status === "blocked").length,
        canAutoSave: false,
      },
      items,
    };
  }

  function buildStatusUpdateWritebackPayload(project = {}, draft = {}, metadata = {}, options = {}) {
    const entityLogicalName = options.entityLogicalName || metadata.entityLogicalName;
    const projectLookupBinding = options.projectLookupBinding || metadata.projectLookupBinding;
    const projectGuid = normalizeGuid(options.projectGuid || project.id || "");
    const fields = { ...(draft.fields || {}) };
    if (projectLookupBinding && projectGuid) fields[projectLookupBinding + "@odata.bind"] = "/" + constants.PROJECT_ENTITY_SET_NAME + "(" + projectGuid + ")";
    if (draft.emailStatusUpdate != null) fields[constants.STATUS_UPDATE_FIELDS.emailStatusUpdate] = Boolean(draft.emailStatusUpdate);
    const blockers = [];
    if (!entityLogicalName) blockers.push("Status Update entity logical name is missing.");
    if (!projectLookupBinding) blockers.push("Project lookup binding field is missing.");
    if (!projectGuid) blockers.push("Project GUID is missing.");
    if (!fields[constants.STATUS_UPDATE_FIELDS.reportDate]) blockers.push("Report Date is missing.");
    if (!fields[constants.STATUS_UPDATE_FIELDS.statusSummary]) blockers.push("Status Summary is missing.");
    return { entityLogicalName: entityLogicalName || null, payload: fields, blockers, canCreate: blockers.length === 0 };
  }

  function buildStatusUpdateCreateRecordPlan(project = {}, draft = {}, metadata = {}, options = {}) {
    const writebackPayload = buildStatusUpdateWritebackPayload(project, draft, metadata, options);
    const reportMonth = normalizeReportMonth(options.reportMonth || draft.fields?.[constants.STATUS_UPDATE_FIELDS.reportDate] || options.today);
    const idempotencyKey = buildStatusReportIdempotencyKey(project, draft, { reportMonth });
    return {
      operation: "Xrm.WebApi.createRecord",
      version: constants.STATUS_API_FEATURE_VERSION,
      projectId: project.projectId || project.id || null,
      reportMonth,
      idempotencyKey,
      entityLogicalName: writebackPayload.entityLogicalName,
      payload: writebackPayload.payload,
      blockers: writebackPayload.blockers,
      canCreateAfterConfirmation: writebackPayload.canCreate,
      canAutoSave: false,
      confirmationText: "CONFIRM DATAVERSE STATUS CREATE | Project: " + (project.name || project.projectId || project.id || "unknown project") + " | Month: " + reportMonth + " | Idempotency: " + idempotencyKey,
    };
  }

  function mapDataverseError(error = {}) {
    const message = String(error.message || error.error?.message || error.statusText || error);
    const code = error.errorCode || error.status || error.code || null;
    let category = "unknown";
    if (/privilege|permission|access|401|403/i.test(message)) category = "permission";
    else if (/required|missing|null/i.test(message)) category = "required_field";
    else if (/duplicate|alternate key|idempot/i.test(message)) category = "duplicate";
    else if (/lookup|bind|navigation/i.test(message)) category = "lookup_binding";
    else if (/plugin|business process|validation/i.test(message)) category = "business_rule";
    return { category, code, message };
  }

  async function retrieveAllRecords(entityLogicalName, query, options = {}) {
    const xrm = getXrm();
    const entities = [];
    let response = await xrm.WebApi.retrieveMultipleRecords(entityLogicalName, query, options.maxPageSize);
    entities.push(...(response.entities || []));
    while (response.nextLink) {
      response = await xrm.WebApi.retrieveMultipleRecords(entityLogicalName, response.nextLink, options.maxPageSize);
      entities.push(...(response.entities || []));
    }
    return entities;
  }

  async function retrieveActiveProjects(options = {}) {
    const query = buildQuery(
      options.selectColumns || constants.PROJECT_DEFAULT_SELECT_COLUMNS,
      options.filter || constants.PROJECT_ACTIVE_STATE_FILTER,
      options.top,
      options.orderBy || "modifiedon desc"
    );
    const entities = await retrieveAllRecords(constants.PROJECT_ENTITY_LOGICAL_NAME, query, options);
    return entities.map(mapProject);
  }

  async function retrieveProjectDelta(options = {}) {
    if (!options.modifiedSince && !options.since) {
      throw new Error("modifiedSince is required for retrieveProjectDelta.");
    }
    const filter = constants.PROJECT_ACTIVE_STATE_FILTER + " and modifiedon gt " + (options.modifiedSince || options.since);
    return retrieveActiveProjects({ ...options, filter, orderBy: options.orderBy || "modifiedon desc" });
  }

  async function retrievePmoProjectPortfolio(options = {}) {
    return retrieveActiveProjects({
      ...options,
      filter: options.filter || constants.PROJECT_ACTIVE_STATE_FILTER,
      selectColumns: options.selectColumns || constants.PROJECT_DEFAULT_SELECT_COLUMNS,
      orderBy: options.orderBy || "modifiedon desc",
    });
  }

  function buildPmoProjectExport(projects, options = {}) {
    return {
      exportType: constants.PMO_PROJECT_EXPORT_TYPE,
      version: constants.PMO_PROJECT_EXPORT_VERSION,
      source: "dataverse_web_api",
      generatedAt: options.generatedAt || new Date().toISOString(),
      organizationUrl: constants.DATAVERSE_ORG_URL,
      apiVersion: constants.DATAVERSE_API_VERSION,
      entityLogicalName: constants.PROJECT_ENTITY_LOGICAL_NAME,
      entitySetName: constants.PROJECT_ENTITY_SET_NAME,
      filter: options.filter || constants.PROJECT_ACTIVE_STATE_FILTER,
      selectColumns: options.selectColumns || constants.PROJECT_DEFAULT_SELECT_COLUMNS,
      orderBy: options.orderBy || "modifiedon desc",
      projectCount: (projects || []).length,
      projects: projects || [],
      safety: {
        readOnlyExport: true,
        crmWritesIncluded: false,
        requiresExplicitSaveConfirmationForWriteback: true,
        mockDataAllowed: false,
      },
    };
  }

  async function exportActiveProjectsForPmoReports(options = {}) {
    const projects = await retrievePmoProjectPortfolio(options);
    return buildPmoProjectExport(projects, options);
  }

  async function retrieveProjectIntelligenceFromD365(options = {}) {
    const projects = await retrievePmoProjectPortfolio(options);
    return buildProjectIntelligence(projects, options);
  }

  async function retrieveBatchProjectPreviewFromD365(options = {}) {
    const projects = await retrievePmoProjectPortfolio(options);
    return buildBatchProjectPreview(projects, options);
  }

  async function retrieveMonthlyStatusPlanFromD365(options = {}) {
    const projects = await retrievePmoProjectPortfolio(options);
    return buildMonthlyStatusReportRun(projects, {
      ...options,
      reportMonth: options.reportMonth || options.month,
      defaultStatusText: options.defaultStatusText || options.statusText || "",
    });
  }

  function plannedProgressPercent(project = {}, options = {}) {
    const start = parseDateOnly(project.start);
    const finish = parseDateOnly(project.finish);
    const today = parseDateOnly(options.today || new Date().toISOString().slice(0, 10));
    if (!start || !finish || !today || finish <= start) return null;
    if (today <= start) return 0;
    if (today >= finish) return 100;
    return Math.round(((today.getTime() - start.getTime()) / (finish.getTime() - start.getTime())) * 100);
  }

  function daysUntilDate(dateText, todayText) {
    const target = parseDateOnly(dateText);
    const today = parseDateOnly(todayText);
    if (!target || !today) return null;
    return Math.round((target.getTime() - today.getTime()) / 86400000);
  }

  function buildStatusReportSuggestion(project = {}, options = {}) {
    const today = options.today || new Date().toISOString().slice(0, 10);
    const quality = evaluateProjectStatusQuality(project, options);
    const progress = Number(project.progress);
    const plannedProgress = plannedProgressPercent(project, options);
    const finishDays = daysUntilDate(project.finish, today);
    const statusText = normalizeText(project.currentStatusText || project.lastStatusUpdate);
    const riskText = normalizeText(project.obstaclesAndMeasures || project.risks || "");
    const decisionText = normalizeText(project.decisions || "");
    const sponsorText = normalizeText(project.sponsorActions || "");
    const reasonCodes = new Set((quality.evidence || []).map((item) => item.code));
    const dataGaps = [];
    if (!project.projectId && !project.id) dataGaps.push({ field: "projectId", message: "Project ID is missing." });
    if (!project.name) dataGaps.push({ field: "name", message: "Project name is missing." });
    if (!project.overallKpiLabel) dataGaps.push({ field: "overallKpiLabel", message: "Overall KPI is missing." });
    if (!Number.isFinite(progress)) dataGaps.push({ field: "progress", message: "Progress is missing or invalid." });
    if (!project.finish) dataGaps.push({ field: "finish", message: "Finish date is missing." });
    if (!project.start) dataGaps.push({ field: "start", message: "Start date is missing; planned progress cannot be calculated." });
    if (!statusText) dataGaps.push({ field: "lastStatusUpdate", message: "Last status text is missing." });
    if (plannedProgress != null && Number.isFinite(progress) && progress + 15 < plannedProgress) reasonCodes.add("progress_behind_plan");
    if (finishDays != null && finishDays <= 14 && finishDays >= 0) reasonCodes.add("finish_near");
    if (riskText) reasonCodes.add("risk_or_blocker_present");
    if (decisionText) reasonCodes.add("decision_required");
    if (sponsorText) reasonCodes.add("sponsor_action_present");

    let statusType = "stable_plan";
    let proposedStatusText = "Das Projekt laeuft planmaessig. Die geplanten Aktivitaeten werden fortgefuehrt; aktuell sind keine wesentlichen Abweichungen bei Termin, Umfang oder Qualitaet erkennbar. Naechster Schritt ist die weitere Umsetzung der geplanten Arbeitspakete bis zum naechsten Berichtstermin.";
    let recommendedAction = "review_and_use";
    if (dataGaps.length >= 4) {
      statusType = "insufficient_data";
      proposedStatusText = "Ein belastbarer Statusbericht kann auf Basis der vorhandenen Projektdaten noch nicht automatisch erstellt werden. Vor Managementnutzung muessen fehlende Pflichtinformationen, Planungsdaten und der aktuelle Projektstatus ergaenzt werden.";
      recommendedAction = "collect_missing_data";
    } else if (project.overallKpiLabel === "Red" || quality.severity === "critical") {
      statusType = "critical_escalation";
      proposedStatusText = "Das Projekt befindet sich in einem kritischen Zustand. Wesentliche Risiken oder Blocker gefaehrden Termin, Umfang oder Nutzen." + (riskText ? " Aktueller Risikohinweis: " + riskText + "." : "") + (decisionText ? " Benoetigte Entscheidung: " + decisionText + "." : " Eine Managemententscheidung und ein Recovery-Plan sind erforderlich.") + " Naechster Schritt ist die kurzfristige Eskalation mit klarer Entscheidung zu Prioritaet, Ressourcen oder Scope.";
      recommendedAction = "escalate_management";
    } else if (reasonCodes.has("overdue_finish")) {
      statusType = "overdue_recovery";
      proposedStatusText = "Das geplante Finish-Datum ist ueberschritten. Der aktuelle Fortschritt liegt bei " + (Number.isFinite(progress) ? progress + "%" : "unbekannt") + "; dadurch besteht ein Termin- und Steuerungsrisiko." + (riskText ? " Ursache bzw. Blocker: " + riskText + "." : "") + " Naechster Schritt ist die Aktualisierung des Recovery-Plans inklusive Owner, neuem Zieltermin und Managemententscheidung.";
      recommendedAction = "prepare_recovery_plan";
    } else if (project.overallKpiLabel === "Yellow" || reasonCodes.has("progress_behind_plan") || reasonCodes.has("finish_near")) {
      statusType = "watch_schedule_risk";
      proposedStatusText = "Das Projekt ist weiterhin aktiv, weist jedoch Steuerungsbedarf auf." + (Number.isFinite(progress) ? " Der aktuelle Fortschritt liegt bei " + progress + "%" : "") + (plannedProgress != null ? " gegenueber einem erwarteten Planfortschritt von ca. " + plannedProgress + "%" : "") + "." + (riskText ? " Aktuelles Risiko bzw. Blocker: " + riskText + "." : "") + " Naechster Schritt ist die Abstimmung konkreter Gegenmassnahmen und die Bewertung der Auswirkungen auf den Gesamttermin.";
      recommendedAction = "define_mitigation";
    } else if (Number.isFinite(progress) && progress >= 90 && isActiveProjectCandidate(project)) {
      statusType = "closure_preparation";
      proposedStatusText = "Das Projekt befindet sich in der Abschlussphase. Der aktuelle Fortschritt liegt bei " + progress + "%; die wesentlichen Arbeitspakete sind weitgehend abgeschlossen. Naechster Schritt ist die finale Validierung, Abnahmevorbereitung und Klaerung offener Restpunkte.";
      recommendedAction = "prepare_closure";
    } else if (decisionText || sponsorText) {
      statusType = "decision_or_sponsor_action";
      proposedStatusText = "Das Projekt benoetigt eine verbindliche Klaerung fuer den naechsten Umsetzungsschritt." + (decisionText ? " Offene Entscheidung: " + decisionText + "." : "") + (sponsorText ? " Sponsor Action: " + sponsorText + "." : "") + " Ohne Klaerung besteht Risiko fuer Verzug, Nacharbeit oder Prioritaetskonflikte. Naechster Schritt ist die Entscheidung bzw. Nachverfolgung im Steering.";
      recommendedAction = "track_decision";
    } else if (statusText && quality.severity === "ok") {
      statusType = "stable_or_kv";
      proposedStatusText = "Status unveraendert seit letztem Bericht. Es gab keine wesentlichen Aenderungen bei Fortschritt, Risiken oder Terminen. Die naechsten geplanten Aktivitaeten werden gemaess bestehender Planung fortgefuehrt.";
      recommendedAction = "review_kv_allowed";
    }

    const canUseKv = statusType === "stable_or_kv" && !riskText && !decisionText && !sponsorText;
    return {
      projectId: project.projectId || project.id || null,
      name: project.name || null,
      statusType,
      proposedStatusText,
      canUseKv,
      requiresReview: true,
      canAutoSave: false,
      recommendedAction,
      qualityScore: quality.score,
      planning: { start: project.start || null, finish: project.finish || null, progress: Number.isFinite(progress) ? progress : null, plannedProgress, finishDays },
      sourceSignals: { projectStatusLabel: project.projectStatusLabel || null, overallKpiLabel: project.overallKpiLabel || null, qualitySeverity: quality.severity },
      reasonCodes: [...reasonCodes],
      dataGaps,
      evidence: quality.evidence || [],
      recordUrl: project.recordUrl || null,
    };
  }

  function buildStatusSuggestionReport(projects, options = {}) {
    const rows = (projects || []).filter(isActiveProjectCandidate).map((project) => buildStatusReportSuggestion(project, options));
    return {
      reportType: "status_suggestion",
      title: "Automatic Status Suggestion Report",
      generatedAt: options.generatedAt || new Date().toISOString(),
      source: "dataverse_web_api",
      summary: {
        projectsReviewed: (projects || []).length,
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
        { title: "Safety", text: "CRM writeback remains confirmation-gated." },
      ],
      rows,
      evidence: rows.flatMap((row) => row.evidence.map((item) => ({ ...item, projectId: row.projectId }))),
      dataGaps: rows.flatMap((row) => row.dataGaps.map((gap) => ({ ...gap, projectId: row.projectId, name: row.name }))),
    };
  }

  async function retrieveStatusSuggestionReportFromD365(options = {}) {
    const projects = await retrievePmoProjectPortfolio(options);
    return buildStatusSuggestionReport(projects, options);
  }

  function buildBoardPack(projects, options = {}) {
    const sourceProjects = projects || [];
    const intelligence = buildProjectIntelligence(sourceProjects, options);
    const statusSuggestions = buildStatusSuggestionReport(sourceProjects, options);
    const risks = buildRiskLedgerEntries(sourceProjects, options);
    const decisions = buildDecisionClosureItems(sourceProjects, options);
    const projectSpotlights = buildBatchProjectPreview(sourceProjects, options).map((project) => ({
      projectId: project.projectId || null,
      name: project.name || null,
      projectStatusLabel: project.projectStatusLabel || null,
      overallKpiLabel: project.overallKpiLabel || null,
      progress: project.progress ?? null,
      finish: project.finish || null,
      safetyLevel: intelligence.projectSafetyGates?.projects?.find((item) => item.projectId === project.projectId)?.safetyLevel || null,
      managementAttention: intelligence.projectSafetyGates?.projects?.find((item) => item.projectId === project.projectId)?.managementAttention || null,
      pmoLevel: intelligence.pmoControlTower?.projects?.find((item) => item.projectId === project.projectId)?.pmoLevel || null,
      recordUrl: project.recordUrl || null,
    }));
    return {
      packType: "full_board_pack",
      source: options.source || "d365_api",
      generatedAt: options.generatedAt || new Date().toISOString(),
      today: options.today || new Date().toISOString().slice(0, 10),
      executive: {
        summary: {
          projectsReviewed: sourceProjects.length,
          criticalProjects: intelligence.projectSafetyGates?.summary?.criticalProjects || 0,
          unsafeProjects: intelligence.projectSafetyGates?.summary?.unsafeProjects || 0,
          ceoAttention: intelligence.projectSafetyGates?.summary?.ceoAttention || 0,
          cioAttention: intelligence.projectSafetyGates?.summary?.cioAttention || 0,
          topRisks: risks.length,
          openDecisions: decisions.length,
        },
        topRisks: risks.slice(0, 10),
        topDecisions: decisions.slice(0, 10),
        questions: intelligence.executiveQuestionGenerator?.items || [],
        noSurpriseForecast: intelligence.noSurpriseForecast || null,
      },
      pmo: {
        summary: intelligence.pmoControlTower?.summary || {},
        workQueue: intelligence.pmoUsps?.commandQueue || [],
        controlFindings: intelligence.pmoControlTower?.portfolioFindings || [],
        reportSuiteSummary: intelligence.pmoReportSuite?.summary || {},
      },
      projectLeader: {
        summary: statusSuggestions.summary,
        statusSuggestions: statusSuggestions.rows,
        queue: buildProjectNudges(sourceProjects, options),
      },
      steeringAgenda: buildSteeringAgenda(sourceProjects, options),
      decisionLog: decisions,
      riskRegister: risks,
      statusSuggestions: statusSuggestions.rows,
      projectSpotlights,
      evidenceLedger: [
        ...risks.map((item) => ({ evidenceType: "risk", projectId: item.projectId, name: item.name, code: item.evidenceCode, field: item.field, value: item.value ?? null, message: item.message || null, recordUrl: item.recordUrl || null })),
        ...(intelligence.pmoUsps?.evidenceLedger || []).map((item) => ({ evidenceType: "pmo_usp", ...item })),
      ],
      dataGaps: [
        ...(intelligence.evidenceGapDetector?.gaps || []),
        ...(statusSuggestions.dataGaps || []),
        ...sourceProjects.filter((project) => !project.recordUrl).map((project) => ({ projectId: project.projectId || project.id || null, name: project.name || null, field: "recordUrl", message: "Project record URL is missing; Excel project hyperlink cannot be created." })),
        ...(options.statusMetadataResolved === false ? [{ projectId: null, name: null, field: "statusUpdateMetadata", message: "Status Update metadata could not be resolved; status history is unavailable." }] : []),
      ],
      accessIssues: options.accessIssues || [],
      safety: { advisoryOnly: true, canAutoSave: false, crmWritesIncluded: false },
    };
  }

  async function retrieveBoardPackFromD365(options = {}) {
    const projects = await retrievePmoProjectPortfolio(options);
    let statusMetadata = null;
    const accessIssues = [];
    try {
      statusMetadata = await discoverStatusUpdateMetadata(options);
    } catch (error) {
      accessIssues.push({ area: "status_metadata", error: mapDataverseError(error) });
    }
    return buildBoardPack(projects, {
      ...options,
      source: "d365_api",
      statusMetadataResolved: Boolean(statusMetadata?.found),
      accessIssues,
    });
  }

  async function retrieveStatusUpdates(project = {}, options = {}) {
    const entityLogicalName = options.entityLogicalName;
    if (!entityLogicalName) throw new Error("Status Update entity logical name is required.");
    const projectGuid = normalizeGuid(options.projectGuid || project.id || "");
    const month = options.reportMonth ? getMonthBounds(options.reportMonth) : null;
    const filters = [];
    if (projectGuid) filters.push("_" + constants.STATUS_UPDATE_FIELDS.project + "_value eq " + projectGuid);
    if (month) filters.push(constants.STATUS_UPDATE_FIELDS.reportDate + " ge " + month.periodStart + " and " + constants.STATUS_UPDATE_FIELDS.reportDate + " le " + month.periodEnd);
    const query = buildQuery(
      options.selectColumns || [
        constants.STATUS_UPDATE_FIELDS.reportDate,
        constants.STATUS_UPDATE_FIELDS.statusSummary,
        constants.STATUS_UPDATE_FIELDS.accomplishedActivities,
        constants.STATUS_UPDATE_FIELDS.plannedActivities,
        constants.STATUS_UPDATE_FIELDS.obstaclesAndMeasures,
        constants.STATUS_UPDATE_FIELDS.decisions,
        constants.STATUS_UPDATE_FIELDS.emailStatusUpdate,
      ],
      filters.join(" and "),
      options.top || 50,
      options.orderBy || constants.STATUS_UPDATE_FIELDS.reportDate + " desc"
    );
    return retrieveAllRecords(entityLogicalName, query, options);
  }

  async function discoverStatusUpdateMetadata(options = {}) {
    const xrm = getXrm();
    const candidates = options.entityLogicalName
      ? [options.entityLogicalName]
      : (options.candidates || constants.STATUS_UPDATE_ENTITY_LOGICAL_NAME_CANDIDATES);
    const attempts = [];
    for (const candidate of candidates) {
      try {
        const metadata = await xrm.Utility.getEntityMetadata(candidate, Object.values(constants.STATUS_UPDATE_FIELDS));
        return {
          found: true,
          entityLogicalName: candidate,
          entitySetName: metadata.EntitySetName || metadata.entitySetName || null,
          primaryIdAttribute: metadata.PrimaryIdAttribute || metadata.primaryIdAttribute || null,
          attributes: metadata.Attributes || metadata.attributes || null,
          privileges: metadata.Privileges || metadata.privileges || null,
          projectLookupBinding: options.projectLookupBinding || constants.STATUS_UPDATE_FIELDS.project,
          raw: metadata,
        };
      } catch (error) {
        attempts.push({ candidate, error: mapDataverseError(error) });
      }
    }
    return { found: false, attempts, projectLookupBinding: options.projectLookupBinding || constants.STATUS_UPDATE_FIELDS.project };
  }

  async function probeDataversePermissions(options = {}) {
    const result = {
      projectRead: { ok: false, error: null },
      statusMetadata: { ok: false, metadata: null, error: null },
      writeProbeMode: "metadata_only_no_create",
    };
    try {
      await retrieveAllRecords(constants.PROJECT_ENTITY_LOGICAL_NAME, buildQuery([constants.PROJECT_PRIMARY_ID_ATTRIBUTE], constants.PROJECT_ACTIVE_STATE_FILTER, 1), { maxPageSize: 1 });
      result.projectRead.ok = true;
    } catch (error) {
      result.projectRead.error = mapDataverseError(error);
    }
    try {
      const metadata = await discoverStatusUpdateMetadata(options);
      result.statusMetadata.ok = Boolean(metadata.found);
      result.statusMetadata.metadata = metadata;
    } catch (error) {
      result.statusMetadata.error = mapDataverseError(error);
    }
    result.canAttemptCreateAfterConfirmation = result.projectRead.ok && result.statusMetadata.ok;
    return result;
  }

  async function createStatusUpdateWithConfirmation(project = {}, draft = {}, options = {}) {
    const xrm = getXrm();
    const metadata = options.metadata || await discoverStatusUpdateMetadata(options);
    const plan = buildStatusUpdateCreateRecordPlan(project, draft, metadata, options);
    if (plan.blockers.length) {
      return { saved: false, plan, blockers: plan.blockers };
    }
    if (options.confirmationText !== plan.confirmationText) {
      return { saved: false, plan, blockers: ["Confirmation text does not match exactly."] };
    }
    try {
      const response = await xrm.WebApi.createRecord(plan.entityLogicalName, plan.payload);
      return {
        saved: true,
        id: normalizeGuid(response.id),
        entityType: response.entityType || plan.entityLogicalName,
        plan,
        auditEvent: {
          eventType: "status_writeback_audit",
          at: new Date().toISOString(),
          action: "dataverse_createRecord",
          outcome: "saved",
          projectId: plan.projectId,
          reportMonth: plan.reportMonth,
          idempotencyKey: plan.idempotencyKey,
          confirmationText: plan.confirmationText,
        },
      };
    } catch (error) {
      return { saved: false, plan, error: mapDataverseError(error) };
    }
  }

  function escapeODataString(value) {
    return String(value || "").replace(/'/g, "''");
  }

  function compactEvidenceLedger(intelligence = {}) {
    const ledger = [];
    for (const item of intelligence.riskLedger || []) {
      ledger.push({
        evidenceType: "risk",
        projectId: item.projectId || null,
        name: item.name || null,
        code: item.evidenceCode || null,
        field: item.field || null,
        value: item.value ?? null,
        message: item.message || null,
        recordUrl: item.recordUrl || null,
      });
    }
    for (const item of intelligence.pmoUsps?.evidenceLedger || []) {
      ledger.push({
        evidenceType: "pmo_usp",
        projectId: item.projectId || null,
        name: item.name || null,
        code: item.evidenceCode || item.code || null,
        field: item.field || null,
        value: item.value ?? null,
        message: item.message || null,
        recordUrl: item.recordUrl || null,
      });
    }
    return ledger;
  }

  async function discoverProjectFieldMetadataFromD365(options = {}) {
    const xrm = getXrm();
    const attributes = options.attributes || constants.PROJECT_DEFAULT_SELECT_COLUMNS;
    const metadata = await xrm.Utility.getEntityMetadata(constants.PROJECT_ENTITY_LOGICAL_NAME, attributes);
    const rawAttributes = metadata.Attributes || metadata.attributes || [];
    const fields = Array.isArray(rawAttributes)
      ? rawAttributes.map((attribute) => ({
        logicalName: attribute.LogicalName || attribute.logicalName || attribute.Name || attribute.name || null,
        displayName: attribute.DisplayName?.UserLocalizedLabel?.Label || attribute.displayName || null,
        attributeType: attribute.AttributeType || attribute.attributeType || null,
        requiredLevel: attribute.RequiredLevel?.Value || attribute.requiredLevel || null,
        isValidForRead: attribute.IsValidForRead ?? attribute.isValidForRead ?? null,
        isValidForUpdate: attribute.IsValidForUpdate ?? attribute.isValidForUpdate ?? null,
      }))
      : [];
    return {
      feature: "live_d365_field_discovery",
      source: "dataverse_metadata_api",
      entityLogicalName: constants.PROJECT_ENTITY_LOGICAL_NAME,
      entitySetName: metadata.EntitySetName || metadata.entitySetName || constants.PROJECT_ENTITY_SET_NAME,
      primaryIdAttribute: metadata.PrimaryIdAttribute || metadata.primaryIdAttribute || constants.PROJECT_PRIMARY_ID_ATTRIBUTE,
      primaryNameAttribute: metadata.PrimaryNameAttribute || metadata.primaryNameAttribute || constants.PROJECT_PRIMARY_NAME_ATTRIBUTE,
      fields,
      requestedAttributes: attributes,
      generatedAt: options.generatedAt || new Date().toISOString(),
    };
  }

  async function resolveStatusUpdateEntityFromD365(options = {}) {
    const metadata = await discoverStatusUpdateMetadata(options);
    return {
      feature: "status_update_entity_resolver",
      source: "dataverse_metadata_api",
      resolved: Boolean(metadata.found),
      metadata,
      blockers: metadata.found ? [] : ["Status Update entity metadata could not be resolved from configured candidates."],
    };
  }

  async function buildLivePmoControlCenterFromD365(options = {}) {
    const projects = await retrievePmoProjectPortfolio(options);
    const intelligence = buildProjectIntelligence(projects, options);
    return {
      feature: "pmo_live_control_center",
      source: "dataverse_web_api",
      generatedAt: options.generatedAt || new Date().toISOString(),
      summary: {
        projectsReviewed: projects.length,
        criticalProjects: intelligence.calibrationReport?.summary?.criticalProjects || 0,
        warningProjects: intelligence.calibrationReport?.summary?.warningProjects || 0,
        safetyLevels: intelligence.projectSafetyGates?.summary?.bySafetyLevel || {},
        managementAttention: intelligence.projectSafetyGates?.summary?.byManagementAttention || {},
        pmoCommandItems: intelligence.pmoUsps?.commandQueue?.length || 0,
      },
      topRisks: (intelligence.riskLedger || []).slice(0, options.topRisks || 15),
      commandQueue: intelligence.pmoUsps?.commandQueue || [],
      steeringAgenda: intelligence.steeringAgenda || [],
      dataGaps: [
        ...(intelligence.evidenceGapDetector?.gaps || []),
        ...(intelligence.pmoUsps?.dataGaps || []),
      ],
      intelligence,
    };
  }

  async function retrieveMonthlyPmSelfServiceFlowFromD365(options = {}) {
    const metadata = await discoverStatusUpdateMetadata(options);
    const projects = await retrievePmoProjectPortfolio(options);
    const projectByBusinessId = new Map(projects.map((project) => [project.projectId, project]));
    const run = buildMonthlyStatusReportRun(projects, {
      ...options,
      reportMonth: options.reportMonth || options.month,
      defaultStatusText: options.defaultStatusText || options.statusText || "",
    });
    const reports = [];
    for (const report of run.reports || []) {
      let existingUpdates = [];
      const sourceProject = projectByBusinessId.get(report.projectId) || { id: report.projectId, projectId: report.projectId };
      if (metadata.found && report.projectId) {
        try {
          existingUpdates = await retrieveStatusUpdates(sourceProject, {
            ...options,
            entityLogicalName: metadata.entityLogicalName,
            reportMonth: run.reportMonth,
          });
        } catch (error) {
          existingUpdates = [{ retrievalError: mapDataverseError(error) }];
        }
      }
      reports.push({
        ...report,
        duplicateCheck: buildStatusUpdateDuplicateCheck(existingUpdates.filter((item) => !item.retrievalError), report, {
          projectId: sourceProject.id,
          projectBusinessId: sourceProject.projectId || report.projectId,
          reportMonth: run.reportMonth,
        }),
        statusHistoryReadError: existingUpdates.find((item) => item.retrievalError)?.retrievalError || null,
      });
    }
    return {
      feature: "monthly_pm_self_service_flow",
      source: "dataverse_web_api",
      reportMonth: run.reportMonth,
      metadata,
      summary: {
        total: reports.length,
        statusInputsMissing: reports.filter((report) => report.statusRequired).length,
        duplicatesFound: reports.filter((report) => report.duplicateCheck?.duplicateFound).length,
        canAutoSave: false,
      },
      reports,
      writebackQueue: buildStatusWritebackQueue({ ...run, reports }, options),
    };
  }

  async function simulateStatusWritebackFromD365(project = {}, draft = {}, options = {}) {
    const resolvedProject = typeof project === "string" ? await retrieveProject(project) : project;
    const metadata = options.metadata || await discoverStatusUpdateMetadata(options);
    const plan = buildStatusUpdateCreateRecordPlan(resolvedProject, draft, metadata, options);
    let duplicateCheck = null;
    if (metadata.found && (options.checkDuplicate ?? true)) {
      const existingUpdates = await retrieveStatusUpdates(resolvedProject, {
        ...options,
        entityLogicalName: metadata.entityLogicalName,
        reportMonth: plan.reportMonth,
      });
      duplicateCheck = buildStatusUpdateDuplicateCheck(existingUpdates, draft, {
        projectId: resolvedProject.id,
        projectBusinessId: resolvedProject.projectId,
        reportMonth: plan.reportMonth,
      });
      if (duplicateCheck.duplicateFound) {
        plan.blockers.push("Monthly status update already exists for this project/month.");
        plan.canCreateAfterConfirmation = false;
      }
    }
    return {
      feature: "d365_api_writeback_dry_run",
      source: "dataverse_web_api",
      mode: "dry_run_no_create",
      canAutoSave: false,
      project: resolvedProject,
      metadata,
      plan,
      duplicateCheck,
    };
  }

  async function resolveSubmittedToCandidatesFromD365(options = {}) {
    const search = escapeODataString(options.search || options.name || "");
    const filter = search ? "contains(fullname,'" + search + "') and isdisabled eq false" : "isdisabled eq false";
    const users = await retrieveAllRecords("systemuser", buildQuery(
      ["systemuserid", "fullname", "domainname", "internalemailaddress", "isdisabled"],
      filter,
      options.top || 10,
      "fullname asc"
    ), options);
    return {
      feature: "submitted_to_resolver",
      source: "dataverse_web_api",
      search: options.search || options.name || "",
      candidates: users.map((user) => ({
        id: normalizeGuid(user.systemuserid),
        name: user.fullname || null,
        domainName: user.domainname || null,
        emailPresent: Boolean(user.internalemailaddress),
        disabled: Boolean(user.isdisabled),
        bind: user.systemuserid ? "/systemusers(" + normalizeGuid(user.systemuserid) + ")" : null,
      })),
    };
  }

  async function retrieveStatusHistoryTimelineFromD365(project = {}, options = {}) {
    const resolvedProject = typeof project === "string" ? await retrieveProject(project) : project;
    const metadata = options.metadata || await discoverStatusUpdateMetadata(options);
    if (!metadata.found) {
      return {
        feature: "status_history_timeline",
        source: "dataverse_web_api",
        project: resolvedProject,
        timeline: [],
        blockers: ["Status Update entity metadata could not be resolved."],
      };
    }
    const updates = await retrieveStatusUpdates(resolvedProject, {
      ...options,
      entityLogicalName: metadata.entityLogicalName,
      top: options.top || 24,
    });
    return {
      feature: "status_history_timeline",
      source: "dataverse_web_api",
      project: resolvedProject,
      timeline: updates.map((update) => ({
        reportDate: update[constants.STATUS_UPDATE_FIELDS.reportDate] || update.createdon || null,
        summary: update[constants.STATUS_UPDATE_FIELDS.statusSummary] || null,
        accomplishedActivities: update[constants.STATUS_UPDATE_FIELDS.accomplishedActivities] || null,
        plannedActivities: update[constants.STATUS_UPDATE_FIELDS.plannedActivities] || null,
        obstaclesAndMeasures: update[constants.STATUS_UPDATE_FIELDS.obstaclesAndMeasures] || null,
        decisions: update[constants.STATUS_UPDATE_FIELDS.decisions] || null,
        emailStatusUpdate: update[constants.STATUS_UPDATE_FIELDS.emailStatusUpdate] ?? null,
        raw: update,
      })),
      blockers: [],
    };
  }

  async function checkDuplicateStatusUpdateFromD365(project = {}, draft = {}, options = {}) {
    const timeline = await retrieveStatusHistoryTimelineFromD365(project, {
      ...options,
      reportMonth: options.reportMonth || draft.reportMonth,
    });
    const updates = (timeline.timeline || []).map((item) => item.raw || item);
    return {
      feature: "duplicate_status_prevention",
      source: "dataverse_web_api",
      project: timeline.project,
      duplicateCheck: buildStatusUpdateDuplicateCheck(updates, draft, {
        projectId: timeline.project?.id,
        projectBusinessId: timeline.project?.projectId,
        reportMonth: options.reportMonth || draft.reportMonth,
      }),
      blockers: timeline.blockers || [],
    };
  }

  async function retrieveExecutiveSteeringPackFromD365(options = {}) {
    const projects = await retrievePmoProjectPortfolio(options);
    const intelligence = buildProjectIntelligence(projects, options);
    return {
      feature: "executive_steering_pack_from_live_api",
      source: "dataverse_web_api",
      generatedAt: options.generatedAt || new Date().toISOString(),
      onePagerMarkdown: buildExecutiveOnePager(projects, options),
      agenda: intelligence.steeringAgenda || [],
      executiveQuestions: intelligence.executiveQuestionGenerator?.items || [],
      topRisks: (intelligence.riskLedger || []).slice(0, options.topRisks || 10),
      openDecisions: intelligence.decisionClosureItems || [],
      dataGaps: intelligence.evidenceGapDetector?.gaps || [],
      pmoReport: intelligence.pmoReportSuite?.reports?.find((report) => report.reportType === "executive_exception") || null,
    };
  }

  async function retrievePmoDataGapWorklistFromD365(options = {}) {
    const projects = await retrievePmoProjectPortfolio(options);
    const intelligence = buildProjectIntelligence(projects, options);
    const gaps = [
      ...(intelligence.evidenceGapDetector?.gaps || []),
      ...(intelligence.pmoUsps?.dataGaps || []),
      ...((intelligence.projectSafetyGates?.projects || []).flatMap((project) =>
        (project.requiredEvidence || []).map((gap) => ({ ...gap, projectId: project.projectId, name: project.name }))
      )),
    ];
    return {
      feature: "pmo_data_gap_worklist",
      source: "dataverse_web_api",
      summary: {
        projectsReviewed: projects.length,
        totalGaps: gaps.length,
        criticalGaps: gaps.filter((gap) => /critical|blocked|required/i.test(gap.severity || gap.message || gap.code || "")).length,
      },
      worklist: gaps.map((gap, index) => ({
        id: "gap:" + index,
        projectId: gap.projectId || null,
        name: gap.name || null,
        field: gap.field || gap.sourceField || null,
        code: gap.code || gap.evidenceCode || "data_gap",
        action: gap.recommendedAction || "Collect missing D365 evidence before management use.",
        owner: gap.owner || "PMO",
        recordUrl: gap.recordUrl || gap.source?.recordUrl || null,
      })),
    };
  }

  async function routeCioCfoRiskFromD365(options = {}) {
    const projects = await retrievePmoProjectPortfolio(options);
    const intelligence = buildProjectIntelligence(projects, options);
    const items = (intelligence.projectSafetyGates?.projects || []).flatMap((project) => {
      const text = JSON.stringify(project).toLowerCase();
      const route = project.managementAttention === "ceo"
        ? "CEO"
        : /budget|funding|financial|cost/.test(text)
          ? "CFO"
          : project.managementAttention === "cio" || /dependency|resource|red|blocked|interface|vendor/.test(text)
            ? "CIO"
            : project.managementAttention === "pmo"
              ? "PMO"
              : "none";
      return route === "none" ? [] : [{
        projectId: project.projectId,
        name: project.name,
        route,
        safetyLevel: project.safetyLevel,
        reason: project.gates?.find((gate) => gate.severity === "critical" || gate.status === "fail")?.message || project.recommendedActions?.[0] || "Management attention required.",
        recordUrl: project.recordUrl || null,
      }];
    });
    return {
      feature: "cio_cfo_risk_routing",
      source: "dataverse_web_api",
      summary: {
        total: items.length,
        cio: items.filter((item) => item.route === "CIO").length,
        cfo: items.filter((item) => item.route === "CFO").length,
        ceo: items.filter((item) => item.route === "CEO").length,
        pmo: items.filter((item) => item.route === "PMO").length,
      },
      items,
    };
  }

  async function retrievePowerBiReadyPortfolioFromD365(options = {}) {
    const projects = await retrievePmoProjectPortfolio(options);
    const intelligence = buildProjectIntelligence(projects, options);
    return {
      feature: "power_bi_ready_api_output",
      source: "dataverse_web_api",
      generatedAt: options.generatedAt || new Date().toISOString(),
      tables: {
        projects,
        safetyGates: intelligence.projectSafetyGates?.projects || [],
        pmoCommandQueue: intelligence.pmoUsps?.commandQueue || [],
        riskLedger: intelligence.riskLedger || [],
        decisions: intelligence.decisionClosureItems || [],
        evidenceLedger: compactEvidenceLedger(intelligence),
        dataGaps: [
          ...(intelligence.evidenceGapDetector?.gaps || []),
          ...(intelligence.pmoUsps?.dataGaps || []),
        ],
      },
      measures: {
        projectCount: projects.length,
        criticalProjects: intelligence.calibrationReport?.summary?.criticalProjects || 0,
        warningProjects: intelligence.calibrationReport?.summary?.warningProjects || 0,
        pmoCommandItems: intelligence.pmoUsps?.commandQueue?.length || 0,
      },
    };
  }

  async function probeD365PermissionsDetailed(options = {}) {
    const base = await probeDataversePermissions(options);
    const result = {
      feature: "d365_permission_probe",
      source: "dataverse_web_api",
      base,
      projectMetadata: null,
      submittedToLookupRead: { ok: false, error: null },
      currentUser: null,
    };
    try {
      result.projectMetadata = await discoverProjectFieldMetadataFromD365(options);
    } catch (error) {
      result.projectMetadata = { error: mapDataverseError(error) };
    }
    try {
      await retrieveAllRecords("systemuser", buildQuery(["systemuserid", "fullname"], "isdisabled eq false", 1, "fullname asc"), { maxPageSize: 1 });
      result.submittedToLookupRead.ok = true;
    } catch (error) {
      result.submittedToLookupRead.error = mapDataverseError(error);
    }
    try {
      const settings = getXrm().Utility.getGlobalContext?.().userSettings;
      result.currentUser = settings ? { userId: normalizeGuid(settings.userId), userName: settings.userName || null } : null;
    } catch (error) {
      result.currentUser = { error: mapDataverseError(error) };
    }
    result.summary = {
      projectRead: Boolean(base.projectRead?.ok),
      statusMetadataResolved: Boolean(base.statusMetadata?.ok),
      projectMetadataResolved: Boolean(result.projectMetadata && !result.projectMetadata.error),
      submittedToLookupRead: result.submittedToLookupRead.ok,
      canAttemptCreateAfterConfirmation: Boolean(base.canAttemptCreateAfterConfirmation),
      canAutoSave: false,
    };
    return result;
  }

  async function buildAuditEvidencePackFromD365(options = {}) {
    const projects = await retrievePmoProjectPortfolio(options);
    const intelligence = buildProjectIntelligence(projects, options);
    return {
      feature: "audit_evidence_pack",
      source: "dataverse_web_api",
      generatedAt: options.generatedAt || new Date().toISOString(),
      safetyPosture: "advisory_only_confirmation_gated",
      projectCount: projects.length,
      evidenceLedger: compactEvidenceLedger(intelligence),
      safetyGates: intelligence.projectSafetyGates || null,
      writebackSimulations: intelligence.safeWritebackSimulationPro || intelligence.safeWritebackSimulation || null,
      trustContract: intelligence.trustContract || null,
      auditEvents: intelligence.auditTrail || [],
      dataGaps: [
        ...(intelligence.evidenceGapDetector?.gaps || []),
        ...(intelligence.pmoUsps?.dataGaps || []),
      ],
    };
  }

  async function pilotStatusWritebackFromD365(project = {}, draft = {}, options = {}) {
    const dryRun = await simulateStatusWritebackFromD365(project, draft, options);
    if (!options.enableCreate) {
      return {
        feature: "safe_api_writeback_pilot_mode",
        mode: "pilot_dry_run_only",
        saved: false,
        canAutoSave: false,
        dryRun,
        blockers: ["Pilot mode did not receive enableCreate=true; no Dataverse create was attempted."],
      };
    }
    const saveResult = await createStatusUpdateWithConfirmation(dryRun.project, draft, {
      ...options,
      metadata: dryRun.metadata,
    });
    return {
      feature: "safe_api_writeback_pilot_mode",
      mode: "confirmation_gated_create",
      canAutoSave: false,
      dryRun,
      saveResult,
    };
  }

  async function copyPmoProjectExportToClipboard(options = {}) {
    const payload = await exportActiveProjectsForPmoReports(options);
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    return {
      copied: true,
      exportType: payload.exportType,
      source: payload.source,
      projectCount: payload.projectCount,
      generatedAt: payload.generatedAt,
    };
  }

  async function downloadPmoProjectExport(options = {}) {
    const payload = await exportActiveProjectsForPmoReports(options);
    const day = payload.generatedAt.slice(0, 10);
    const filename = options.filename || "tpg-pmo-project-export-" + day + ".json";
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return {
      downloaded: true,
      filename,
      exportType: payload.exportType,
      source: payload.source,
      projectCount: payload.projectCount,
      generatedAt: payload.generatedAt,
    };
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
    buildPmoProjectExport,
    buildAuditEvidencePackFromD365,
    buildBoardPack,
    retrieveProjectIntelligenceFromD365,
    retrieveStatusSuggestionReportFromD365,
    retrieveBoardPackFromD365,
    retrieveBatchProjectPreviewFromD365,
    retrieveMonthlyStatusPlanFromD365,
    retrieveMonthlyPmSelfServiceFlowFromD365,
    buildLivePmoControlCenterFromD365,
    buildMonthlyStatusReportDraft,
    buildMonthlyStatusReportRun,
    buildStatusReportSuggestion,
    buildStatusSuggestionReport,
    buildStatusReportIdempotencyKey,
    buildStatusUpdateDraft,
    buildStatusUpdateCreateRecordPlan,
    buildStatusUpdateDuplicateCheck,
    buildStatusUpdateWritebackPayload,
    buildStatusWritebackQueue,
    buildStructuredStatusUpdateDraft,
    createStatusUpdateWithConfirmation,
    copyPmoProjectExportToClipboard,
    checkDuplicateStatusUpdateFromD365,
    discoverProjectFieldMetadataFromD365,
    discoverStatusUpdateMetadata,
    downloadPmoProjectExport,
    exportActiveProjectsForPmoReports,
    mapDataverseError,
    pilotStatusWritebackFromD365,
    probeDataversePermissions,
    probeD365PermissionsDetailed,
    resolveStatusUpdateEntityFromD365,
    resolveSubmittedToCandidatesFromD365,
    retrieveAllRecords,
    retrieveExecutiveSteeringPackFromD365,
    retrievePmoDataGapWorklistFromD365,
    retrievePmoProjectPortfolio,
    retrievePowerBiReadyPortfolioFromD365,
    retrieveActiveProjects,
    retrieveProjectDelta,
    retrieveProject,
    retrieveStatusUpdates,
    retrieveStatusHistoryTimelineFromD365,
    routeCioCfoRiskFromD365,
    simulateStatusWritebackFromD365,
    validateMonthlyStatusDraft,
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
  In the authenticated Dynamics browser console:
    await TPGProjectAssist.retrieveProjectIntelligenceFromD365({ today: "YYYY-MM-DD" })
    await TPGProjectAssist.retrieveStatusSuggestionReportFromD365({ today: "YYYY-MM-DD" })
    await TPGProjectAssist.retrieveBoardPackFromD365({ today: "YYYY-MM-DD" })
    await TPGProjectAssist.retrieveMonthlyStatusPlanFromD365({ month: "YYYY-MM", statusText: "kv" })
    await TPGProjectAssist.retrieveBatchProjectPreviewFromD365({ today: "YYYY-MM-DD" })

Offline fallback for tests or reviewed local snapshots only:
  node ./scripts/statusbericht.js --intelligence <snapshot.json> --allow-offline-input --json
  node ./scripts/statusbericht.js --intelligence <snapshot.json> --allow-offline-input --exports

PMO report with filters:
  Productive PMO report data should come from the D365 API helpers above.
  File-based report commands require --allow-offline-input.
  Status suggestion report offline fallback:
    node ./scripts/statusbericht.js --status-suggestion-report <snapshot.json> --allow-offline-input --json
  Board Pack offline fallback:
    node ./scripts/statusbericht.js --board-pack <snapshot.json> --allow-offline-input --json
    node ./scripts/statusbericht.js --board-pack <snapshot.json> --allow-offline-input --docx reports/board-pack.docx --xlsx reports/board-pack.xlsx

Monthly project-leader status writeback plan:
  Productive monthly status plans should use retrieveMonthlyStatusPlanFromD365().
  File-based monthly plan commands require --allow-offline-input.

Sample and fixture inputs are rejected by default. They are reserved for automated tests and documentation fixtures.
`);
}

function printDataverseSnippet() {
  console.log(getDataverseBrowserSnippet());
}

function readProjectsInput(inputPath, options = {}) {
  const allowSample = options.allowSample ?? process.argv.includes("--allow-sample");
  const allowOfflineInput = options.allowOfflineInput ?? process.argv.includes("--allow-offline-input");
  if (isSampleInputPath(inputPath) && !allowSample) {
    throw new Error("Sample or synthetic project data is not accepted for production runs. Use live D365 API data or pass --allow-sample for tests.");
  }
  if (!allowOfflineInput && !allowSample) {
    throw new Error("File-based project input is an offline fallback only. Use authenticated D365 API helpers in the browser, or pass --allow-offline-input for a reviewed local snapshot.");
  }
  const raw = inputPath && inputPath !== "-"
    ? fs.readFileSync(inputPath, "utf8")
    : fs.readFileSync(0, "utf8");
  const parsed = JSON.parse(raw);
  return unwrapProjectInput(parsed);
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

  lines.push("", "## Maximum USPs", "");
  if (!intelligence.maximumUsps?.usps?.length) {
    lines.push("- No maximum USP layer available.");
  } else {
    lines.push(`- Implemented USPs: ${intelligence.maximumUsps.summary.implemented}/${intelligence.maximumUsps.summary.uspCount}`);
    lines.push(`- Best MVP USP: ${intelligence.maximumUsps.summary.bestMvpUsp}`);
    lines.push(`- Bold follow-up USP: ${intelligence.maximumUsps.summary.boldFollowUpUsp}`);
    for (const usp of intelligence.maximumUsps.usps.slice(0, 12)) {
      lines.push(`- ${usp.title} (${usp.readiness}, score=${usp.uspScore}): ${usp.concreteBenefit}`);
    }
  }

  lines.push("", "## PMO USPs", "");
  if (!intelligence.pmoUsps?.usps?.length) {
    lines.push("- No PMO USP layer available.");
  } else {
    lines.push(`- Implemented PMO USPs: ${intelligence.pmoUsps.summary.implemented}/${intelligence.pmoUsps.summary.uspCount}`);
    lines.push(`- Critical work items: ${intelligence.pmoUsps.summary.criticalWorkItems}`);
    lines.push(`- Executive attention items: ${intelligence.pmoUsps.summary.executiveAttentionItems}`);
    lines.push(`- Data gaps: ${intelligence.pmoUsps.summary.dataGaps}`);
    for (const usp of intelligence.pmoUsps.usps.slice(0, 15)) {
      lines.push(`- ${usp.title}: ${usp.concreteBenefit}`);
    }
  }

  lines.push("", "## Logic Assurance", "");
  if (!intelligence.logicValidation?.summary) {
    lines.push("- No logic assurance layer available.");
  } else {
    lines.push(`- Assurance level: ${intelligence.logicValidation.assuranceLevel}`);
    lines.push(`- Checks: ${intelligence.logicValidation.summary.checkCount}`);
    lines.push(`- Findings: ${intelligence.logicValidation.summary.findings}`);
    lines.push(`- Data gaps: ${intelligence.logicValidation.summary.dataGaps}`);
    for (const check of intelligence.logicValidation.checks.filter((item) => item.status !== "pass").slice(0, 10)) {
      lines.push(`- ${check.id}: ${check.status}, findings=${check.findings}, gaps=${check.dataGaps}`);
    }
  }
  if (intelligence.logicAssuranceUsps?.usps?.length) {
    lines.push(`- Logic Assurance USPs: ${intelligence.logicAssuranceUsps.summary.implemented}/${intelligence.logicAssuranceUsps.summary.uspCount}`);
  }

  return `${lines.join("\n")}\n`;
}

function buildPmoReportOptions() {
  return {
    today: getArgValue("--today") || undefined,
    reportType: getArgValue("--pmo-report-type") || "pmo_status",
    projectStatusLabels: getArgValue("--project-status") || undefined,
    lastStatusBefore: getArgValue("--last-status-before") || undefined,
    lastStatusAfter: getArgValue("--last-status-after") || undefined,
    lastStatusOn: getArgValue("--last-status-on") || undefined,
    lastStatusContains: getArgValue("--last-status-contains") || undefined,
    lastStatusMissing: process.argv.includes("--last-status-missing"),
  };
}

function isPmoReportSuite(report) {
  return Array.isArray(report?.reports);
}

function isPmoStatusReport(report) {
  return Boolean(report?.pmoControlTower && report?.projectSafetyGates && report?.projects);
}

function officeReportTitle(report) {
  return isPmoReportSuite(report) ? "PMO Report Suite" : report.title || "PMO Executive Status Report";
}

function officeReportFilters(report) {
  const filters = report.filters || {};
  return {
    projectStatusLabels: Array.isArray(filters.projectStatusLabels) ? filters.projectStatusLabels : [],
    lastStatusBefore: filters.lastStatusBefore || null,
    lastStatusAfter: filters.lastStatusAfter || null,
    lastStatusOn: filters.lastStatusOn || null,
    lastStatusContains: filters.lastStatusContains || null,
    lastStatusMissing: Boolean(filters.lastStatusMissing),
  };
}

function officeProjectRows(report) {
  if (isPmoReportSuite(report)) {
    return report.reports.map((item) => ({
      projectId: item.reportType,
      name: item.title,
      projectStatusLabel: "report",
      lastStatusReportDate: item.generatedAt?.slice(0, 10) || "",
      pmoLevel: item.rows.length ? "populated" : "empty",
      pmoScore: item.rows.length,
      intervention: `${item.dataGaps.length} data gap(s)`,
      safetyLevel: item.dataGaps.length ? "watch" : "controlled",
      managementAttention: item.summary.ceoAttention ? "ceo" : item.summary.cioAttention ? "cio" : "pmo",
      recordUrl: "",
    }));
  }
  if (isPmoStatusReport(report)) {
    return report.projects;
  }
  return (report.rows || []).map((row) => ({
    projectId: row.projectId || row.type || "",
    name: row.name || row.title || row.action || row.Project || "",
    projectStatusLabel: row.status || row.priority || row.type || "",
    lastStatusReportDate: row.dueDate || row.detectedAt || "",
    pmoLevel: row.pmoLevel || row.severity || row.safetyLevel || "",
    pmoScore: row.pmoScore ?? row.score ?? "",
    intervention: row.intervention || row.action || row.recommendation || "",
    safetyLevel: row.safetyLevel || row.managementAttention || "",
    managementAttention: row.managementAttention || "",
    recordUrl: row.recordUrl || "",
  }));
}

function officeSummary(report) {
  if (isPmoReportSuite(report)) {
    return {
      projectsTotal: report.summary.projectsReviewed,
      projectsMatched: report.summary.reportCount,
      projectsFilteredOut: 0,
      missingLastStatusReports: 0,
      unparsableLastStatusReports: 0,
      oldestLastStatusReport: null,
      newestLastStatusReport: null,
      statusCounts: Object.fromEntries(report.reports.map((item) => [item.reportType, item.rows.length])),
    };
  }
  if (isPmoStatusReport(report)) {
    return report.summary;
  }
  return {
    projectsTotal: report.summary.projectsReviewed || 0,
    projectsMatched: (report.rows || []).length,
    projectsFilteredOut: 0,
    missingLastStatusReports: report.dataGaps?.length || 0,
    unparsableLastStatusReports: 0,
    oldestLastStatusReport: null,
    newestLastStatusReport: null,
    statusCounts: { [report.reportType]: (report.rows || []).length },
  };
}

function officePmoControlTower(report) {
  if (isPmoStatusReport(report)) {
    return report.pmoControlTower;
  }
  const rows = officeProjectRows(report);
  return {
    summary: {
      projectsNeedingPmo: rows.filter((row) => !["controlled", "safe", "none"].includes(String(row.safetyLevel || row.pmoLevel).toLowerCase())).length,
      criticalProjects: rows.filter((row) => /critical|ceo|red/i.test(`${row.safetyLevel} ${row.pmoLevel} ${row.managementAttention}`)).length,
    },
    portfolioFindings: isPmoReportSuite(report)
      ? report.reports.flatMap((item) => item.dataGaps.map((gap) => ({ projectId: item.reportType, name: item.title, checkId: gap.field, severity: "warning", recommendation: gap.message }))).slice(0, 50)
      : (report.dataGaps || []).map((gap) => ({ projectId: gap.projectId, name: gap.name, checkId: gap.field, severity: "warning", recommendation: gap.message })),
  };
}

function toOfficeReport(report) {
  return {
    ...report,
    title: officeReportTitle(report),
    generatedAt: report.generatedAt || new Date().toISOString(),
    filters: officeReportFilters(report),
    summary: officeSummary(report),
    projects: officeProjectRows(report),
    pmoControlTower: officePmoControlTower(report),
  };
}

function formatPmoStatusReportMarkdown(report) {
  report = toOfficeReport(report);
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
    `# ${isPmoStatusReport(report) ? "PMO Status Report" : report.title || "PMO Status Report"}`,
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

const DOCX_COLORS = Object.freeze({
  navy: "1F4E79",
  darkBlue: "17365D",
  accent: "5B9BD5",
  blue: "D9EAF7",
  lightBlue: "EEF5FB",
  green: "E2F0D9",
  yellow: "FFF2CC",
  red: "F4CCCC",
  gray: "F2F2F2",
  darkGray: "595959",
  white: "FFFFFF",
});

function docxBorders(color = "D9E2F3") {
  return {
    top: { style: BorderStyle.SINGLE, size: 1, color },
    bottom: { style: BorderStyle.SINGLE, size: 1, color },
    left: { style: BorderStyle.SINGLE, size: 1, color },
    right: { style: BorderStyle.SINGLE, size: 1, color },
  };
}

function levelColor(value) {
  const normalized = String(value || "").toLowerCase();
  if (["critical", "red", "ceo", "executive_governance"].some((token) => normalized.includes(token))) {
    return DOCX_COLORS.red;
  }
  if (["attention", "unsafe", "watch", "warning", "pmo_review", "pmo_intervention"].some((token) => normalized.includes(token))) {
    return DOCX_COLORS.yellow;
  }
  if (["safe", "controlled", "none", "green"].some((token) => normalized.includes(token))) {
    return DOCX_COLORS.green;
  }
  return DOCX_COLORS.white;
}

function textCell(value, options = {}) {
  return new TableCell({
    shading: { fill: options.fill || DOCX_COLORS.white },
    margins: { top: 90, bottom: 90, left: 120, right: 120 },
    borders: docxBorders(),
    children: [new Paragraph({
      alignment: options.alignment || AlignmentType.LEFT,
      children: [new TextRun({
        text: String(value ?? ""),
        bold: Boolean(options.bold),
        color: options.color || "1F1F1F",
        size: options.size || 20,
      })],
    })],
  });
}

function buildDocxTable(headers, rows, options = {}) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: headers.map((header) => new TableCell({
          shading: { fill: options.headerFill || DOCX_COLORS.navy },
          margins: { top: 110, bottom: 110, left: 120, right: 120 },
          borders: docxBorders("B7C9E2"),
          children: [new Paragraph({
            children: [new TextRun({ text: header, bold: true, color: DOCX_COLORS.white, size: 20 })],
          })],
        })),
      }),
      ...rows.map((row, rowIndex) => new TableRow({
        children: headers.map((header) => {
          const value = row[header];
          const highlight = /level|attention|intervention|severity|status/i.test(header) ? levelColor(value) : null;
          return textCell(value, {
            fill: highlight || (rowIndex % 2 === 0 ? DOCX_COLORS.white : DOCX_COLORS.lightBlue),
            alignment: /score|count|total|matched|filtered|missing|unparsable/i.test(header) ? AlignmentType.CENTER : AlignmentType.LEFT,
          });
        }),
      })),
    ],
  });
}

function buildDocxKpiCards(report) {
  const cards = [
    { label: "Projects total", value: report.summary.projectsTotal, fill: DOCX_COLORS.navy },
    { label: "Matched", value: report.summary.projectsMatched, fill: DOCX_COLORS.accent },
    { label: "Need PMO", value: report.pmoControlTower.summary.projectsNeedingPmo, fill: "FFC000" },
    { label: "Critical", value: report.pmoControlTower.summary.criticalProjects, fill: "C00000" },
  ];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: cards.map((card) => new TableCell({
          shading: { fill: card.fill },
          borders: docxBorders(DOCX_COLORS.white),
          margins: { top: 220, bottom: 220, left: 160, right: 160 },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: String(card.value), bold: true, color: DOCX_COLORS.white, size: 36 })],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: card.label, bold: true, color: DOCX_COLORS.white, size: 18 })],
            }),
          ],
        })),
      }),
    ],
  });
}

function buildDocxCallout(title, body, fill = DOCX_COLORS.blue) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { fill },
            borders: docxBorders("A9C4E4"),
            margins: { top: 180, bottom: 180, left: 220, right: 220 },
            children: [
              new Paragraph({ children: [new TextRun({ text: title, bold: true, color: DOCX_COLORS.darkBlue, size: 24 })] }),
              new Paragraph({ children: [new TextRun({ text: body, color: "1F1F1F", size: 20 })] }),
            ],
          }),
        ],
      }),
    ],
  });
}

function filterSummaryText(report) {
  const filters = [];
  if (report.filters.projectStatusLabels.length) {
    filters.push(`Status ${report.filters.projectStatusLabels.join(", ")}`);
  }
  if (report.filters.lastStatusBefore) filters.push(`last status before ${report.filters.lastStatusBefore}`);
  if (report.filters.lastStatusAfter) filters.push(`last status after ${report.filters.lastStatusAfter}`);
  if (report.filters.lastStatusOn) filters.push(`last status on ${report.filters.lastStatusOn}`);
  if (report.filters.lastStatusContains) filters.push(`last status contains "${report.filters.lastStatusContains}"`);
  if (report.filters.lastStatusMissing) filters.push("missing last status report");
  return filters.length ? filters.join("; ") : "No filters applied";
}

function buildDocxStatusLegend() {
  return buildDocxTable(["Signal", "Meaning"], [
    { Signal: "Critical", Meaning: "Immediate executive or PMO action required" },
    { Signal: "Watch", Meaning: "Visible management attention recommended" },
    { Signal: "Controlled", Meaning: "No material PMO intervention signal" },
  ], { headerFill: DOCX_COLORS.darkGray });
}

function buildDocxProjectSpotlight(report) {
  const rows = report.projects.slice(0, 5).map((project) => ({
    Project: `${project.name || "Unnamed project"} (${project.projectId || "no id"})`,
    Signal: `${project.pmoLevel || "n/a"} / ${project.safetyLevel || "n/a"}`,
    Action: project.intervention || "none",
  }));
  if (!rows.length) {
    rows.push({ Project: "No matching projects", Signal: "n/a", Action: "n/a" });
  }
  return buildDocxTable(["Project", "Signal", "Action"], rows, { headerFill: "7030A0" });
}

async function buildPmoStatusReportDocxBuffer(report) {
  report = toOfficeReport(report);
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
        new Paragraph({
          alignment: AlignmentType.CENTER,
          shading: { fill: DOCX_COLORS.navy },
          spacing: { after: 120 },
          children: [new TextRun({ text: report.title || "PMO Executive Status Report", bold: true, color: DOCX_COLORS.white, size: 38 })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          shading: { fill: DOCX_COLORS.darkBlue },
          spacing: { after: 240 },
          children: [new TextRun({ text: "Portfolio governance view with filtered project status evidence", color: DOCX_COLORS.white, size: 20 })],
        }),
        new Paragraph({ text: `Generated: ${report.generatedAt}`, alignment: AlignmentType.RIGHT, spacing: { after: 180 } }),
        buildDocxCallout(
          "Executive attention",
          `${report.pmoControlTower.summary.projectsNeedingPmo} project(s) need PMO attention; ${report.pmoControlTower.summary.criticalProjects} critical project(s) detected.`,
          report.pmoControlTower.summary.criticalProjects ? DOCX_COLORS.red : DOCX_COLORS.blue
        ),
        new Paragraph({ text: "Portfolio Snapshot", heading: HeadingLevel.HEADING_1 }),
        buildDocxKpiCards(report),
        new Paragraph({ text: "Filter Scope", heading: HeadingLevel.HEADING_1 }),
        buildDocxCallout("Applied filter set", filterSummaryText(report), DOCX_COLORS.lightBlue),
        buildDocxTable(["Filter", "Value"], filterRows),
        new Paragraph({ text: "Status Legend", heading: HeadingLevel.HEADING_1 }),
        buildDocxStatusLegend(),
        new Paragraph({ text: "Project Spotlight", heading: HeadingLevel.HEADING_1 }),
        buildDocxProjectSpotlight(report),
        new Paragraph({ text: "Summary", heading: HeadingLevel.HEADING_1 }),
        buildDocxTable(["Metric", "Value"], summaryRows),
        new Paragraph({ text: "Projects", heading: HeadingLevel.HEADING_1 }),
        buildDocxTable(["Project ID", "Name", "Status", "Last Status Report", "PMO Level", "PMO Score", "Intervention", "Safety Level", "Management Attention"], projectRows),
      ],
    }],
  });
  return Packer.toBuffer(document);
}

async function buildBoardPackDocxBuffer(boardPack) {
  const executiveRows = Object.entries(boardPack.executive.summary || {}).map(([key, value]) => ({
    Metric: key,
    Value: typeof value === "object" ? JSON.stringify(value) : value,
  }));
  const riskRows = (boardPack.executive.topRisks || []).slice(0, 10).map((risk) => ({
    Project: `${risk.name || ""} (${risk.projectId || ""})`,
    Signal: risk.evidenceCode || risk.status || "",
    Detail: risk.message || risk.value || "",
  }));
  const decisionRows = (boardPack.decisionLog || []).slice(0, 10).map((decision) => ({
    Project: `${decision.name || ""} (${decision.projectId || ""})`,
    Owner: decision.owner || "",
    Decision: decision.decision || "",
  }));
  const pmoRows = (boardPack.pmo.workQueue || []).slice(0, 15).map((item) => ({
    Project: `${item.name || ""} (${item.projectId || ""})`,
    Priority: item.priority || item.severity || "",
    Action: item.action || item.recommendedAction || item.title || "",
  }));
  const suggestionRows = (boardPack.statusSuggestions || []).slice(0, 15).map((item) => ({
    Project: `${item.name || ""} (${item.projectId || ""})`,
    Type: item.statusType || "",
    Suggestion: item.proposedStatusText || "",
  }));
  const gapRows = (boardPack.dataGaps || []).slice(0, 25).map((gap) => ({
    Project: `${gap.name || ""} (${gap.projectId || ""})`,
    Field: gap.field || "",
    Message: gap.message || "",
  }));
  const assuranceRows = (boardPack.logicAssurance?.checks || []).map((check) => ({
    Check: check.id || "",
    Status: check.status || "",
    Findings: check.findings ?? "",
    "Data Gaps": check.dataGaps ?? "",
  }));
  const document = new Document({
    sections: [{
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          shading: { fill: DOCX_COLORS.navy },
          spacing: { after: 120 },
          children: [new TextRun({ text: "Full Board Pack", bold: true, color: DOCX_COLORS.white, size: 40 })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          shading: { fill: DOCX_COLORS.darkBlue },
          spacing: { after: 240 },
          children: [new TextRun({ text: "D365 API-first steering pack for Executive, PMO, and Project Leader review", color: DOCX_COLORS.white, size: 20 })],
        }),
        new Paragraph({ text: `Generated: ${boardPack.generatedAt}`, alignment: AlignmentType.RIGHT, spacing: { after: 180 } }),
        buildDocxCallout("Safety", "Advisory only. No CRM writes are included. canAutoSave is false.", DOCX_COLORS.lightBlue),
        new Paragraph({ text: "Executive Summary", heading: HeadingLevel.HEADING_1 }),
        buildDocxTable(["Metric", "Value"], executiveRows),
        new Paragraph({ text: "Top Risks", heading: HeadingLevel.HEADING_1 }),
        buildDocxTable(["Project", "Signal", "Detail"], riskRows.length ? riskRows : [{ Project: "No risks", Signal: "", Detail: "" }]),
        new Paragraph({ text: "Open Decisions", heading: HeadingLevel.HEADING_1 }),
        buildDocxTable(["Project", "Owner", "Decision"], decisionRows.length ? decisionRows : [{ Project: "No decisions", Owner: "", Decision: "" }]),
        new Paragraph({ text: "PMO Work Queue", heading: HeadingLevel.HEADING_1 }),
        buildDocxTable(["Project", "Priority", "Action"], pmoRows.length ? pmoRows : [{ Project: "No PMO work items", Priority: "", Action: "" }], { headerFill: "7030A0" }),
        new Paragraph({ text: "Status Suggestions", heading: HeadingLevel.HEADING_1 }),
        buildDocxTable(["Project", "Type", "Suggestion"], suggestionRows.length ? suggestionRows : [{ Project: "No suggestions", Type: "", Suggestion: "" }]),
        new Paragraph({ text: "Evidence And Data Gaps", heading: HeadingLevel.HEADING_1 }),
        buildDocxTable(["Project", "Field", "Message"], gapRows.length ? gapRows : [{ Project: "No data gaps", Field: "", Message: "" }]),
        new Paragraph({ text: "Logic Assurance", heading: HeadingLevel.HEADING_1 }),
        buildDocxCallout(
          "Assurance level",
          `${boardPack.logicAssurance?.assuranceLevel || "not_available"}; ${(boardPack.logicAssurance?.summary?.findings ?? 0)} finding(s), ${(boardPack.logicAssurance?.summary?.dataGaps ?? 0)} data gap(s).`,
          boardPack.logicAssurance?.assuranceLevel === "unsafe" ? DOCX_COLORS.red : DOCX_COLORS.lightBlue
        ),
        buildDocxTable(["Check", "Status", "Findings", "Data Gaps"], assuranceRows.length ? assuranceRows : [{ Check: "No logic assurance checks", Status: "", Findings: "", "Data Gaps": "" }]),
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

function xlsxStyleIndex(value, rowIndex) {
  if (rowIndex === 0) {
    return 1;
  }
  const normalized = String(value || "").toLowerCase();
  if (normalized === "open project" || normalized.startsWith("http")) {
    return 6;
  }
  if (["critical", "red", "ceo", "executive_governance"].some((token) => normalized.includes(token))) {
    return 4;
  }
  if (["attention", "unsafe", "watch", "warning", "pmo_review", "pmo_intervention"].some((token) => normalized.includes(token))) {
    return 3;
  }
  if (["safe", "controlled", "none", "green"].some((token) => normalized.includes(token))) {
    return 2;
  }
  return rowIndex % 2 === 0 ? 5 : 0;
}

function buildWorksheetXml(rows, options = {}) {
  const columnCount = rows[0]?.length || 1;
  const hyperlinks = options.hyperlinks || [];
  const hyperlinkByRef = new Map(hyperlinks.map((item, index) => [item.ref, { ...item, id: item.id || `rId${index + 1}` }]));
  const colXml = Array.from({ length: columnCount }, (_, index) => {
    const width = options.widths?.[index] || 18;
    return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
  }).join("");
  const rowXml = rows.map((row, rowIndex) => {
    const cellXml = row.map((cell, cellIndex) => {
      const ref = `${xlsxColumnName(cellIndex)}${rowIndex + 1}`;
      const style = hyperlinkByRef.has(ref) ? 6 : options.styleForCell ? options.styleForCell(cell, rowIndex, cellIndex, row) : xlsxStyleIndex(cell, rowIndex);
      return `<c r="${ref}" t="inlineStr" s="${style}"><is><t>${xmlEscape(cell)}</t></is></c>`;
    }).join("");
    return `<row r="${rowIndex + 1}" ht="${rowIndex === 0 ? 26 : 30}" customHeight="1">${cellXml}</row>`;
  }).join("");
  const autoFilter = options.autoFilter ? `<autoFilter ref="A1:${xlsxColumnName(columnCount - 1)}${Math.max(rows.length, 1)}"/>` : "";
  const hyperlinkXml = hyperlinks.length
    ? `<hyperlinks>${hyperlinks.map((item, index) => `<hyperlink ref="${item.ref}" r:id="${item.id || `rId${index + 1}`}"/>`).join("")}</hyperlinks>`
    : "";
  const relationshipsNamespace = hyperlinks.length ? ` xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"` : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"${relationshipsNamespace}>
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="20"/>
<cols>${colXml}</cols>
<sheetData>${rowXml}</sheetData>
${autoFilter}
${hyperlinkXml}
<pageMargins left="0.35" right="0.35" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>
</worksheet>`;
}

function buildWorksheetRelationshipsXml(hyperlinks = []) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${hyperlinks.map((item, index) => `<Relationship Id="${item.id || `rId${index + 1}`}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xmlEscape(item.target)}" TargetMode="External"/>`).join("")}
</Relationships>`;
}

function objectRows(headers, rows) {
  return [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ""))];
}

function rowsFromObjects(headers, rows) {
  return [headers, ...(rows || []).map((row) => headers.map((header) => row[header] ?? ""))];
}

function buildWorkbookStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="3">
<font><sz val="10"/><name val="Aptos"/></font>
<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font>
<font><u/><sz val="10"/><color rgb="FF0563C1"/><name val="Aptos"/></font>
</fonts>
<fills count="7">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF1F4E79"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE2F0D9"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF4CCCC"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF7FBFF"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FFD9E2F3"/></left><right style="thin"><color rgb="FFD9E2F3"/></right><top style="thin"><color rgb="FFD9E2F3"/></top><bottom style="thin"><color rgb="FFD9E2F3"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="7">
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="2" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

async function buildPmoStatusReportXlsxBuffer(report) {
  report = toOfficeReport(report);
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
  const projectHeaders = ["Project ID", "Name", "Status", "Last Status Report", "PMO Level", "PMO Score", "Intervention", "Safety Level", "Management Attention", "Project Link"];
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
    "Project Link": project.recordUrl ? "Open Project" : "",
  })));
  const projectHyperlinks = report.projects
    .map((project, index) => project.recordUrl ? { ref: `J${index + 2}`, target: project.recordUrl, id: `rId${index + 1}` } : null)
    .filter(Boolean);
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
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
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
<Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);
  zip.folder("xl").file("styles.xml", buildWorkbookStylesXml());
  const worksheets = zip.folder("xl").folder("worksheets");
  worksheets.file("sheet1.xml", buildWorksheetXml(summaryRows, { widths: [28, 36], autoFilter: true }));
  worksheets.file("sheet2.xml", buildWorksheetXml(filtersRows, { widths: [28, 42], autoFilter: true }));
  worksheets.file("sheet3.xml", buildWorksheetXml(projectRows, { widths: [16, 34, 18, 18, 16, 12, 34, 16, 22, 18], autoFilter: true, hyperlinks: projectHyperlinks }));
  worksheets.file("sheet4.xml", buildWorksheetXml(findingRows, { widths: [16, 34, 28, 14, 42], autoFilter: true }));
  if (projectHyperlinks.length) {
    worksheets.folder("_rels").file("sheet3.xml.rels", buildWorksheetRelationshipsXml(projectHyperlinks));
  }
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

async function buildBoardPackXlsxBuffer(boardPack) {
  const zip = new JSZip();
  const sheets = [
    {
      name: "Executive Dashboard",
      rows: [
        ["Metric", "Value"],
        ["Generated", boardPack.generatedAt],
        ["Projects reviewed", boardPack.executive.summary.projectsReviewed],
        ["Critical projects", boardPack.executive.summary.criticalProjects],
        ["Unsafe projects", boardPack.executive.summary.unsafeProjects],
        ["CEO attention", boardPack.executive.summary.ceoAttention],
        ["CIO attention", boardPack.executive.summary.cioAttention],
        ["Top risks", boardPack.executive.summary.topRisks],
        ["Open decisions", boardPack.executive.summary.openDecisions],
      ],
      widths: [28, 42],
    },
    {
      name: "PMO Control",
      rows: rowsFromObjects(["Project ID", "Name", "Check ID", "Severity", "Recommendation"], (boardPack.pmo.controlFindings || []).map((item) => ({
        "Project ID": item.projectId || "",
        Name: item.name || "",
        "Check ID": item.checkId || "",
        Severity: item.severity || "",
        Recommendation: item.recommendation || "",
      }))),
      widths: [16, 34, 30, 14, 44],
    },
    {
      name: "Project Leader Queue",
      rows: rowsFromObjects(["Project ID", "Name", "Status Type", "Can Use KV", "Recommended Action", "Suggestion"], (boardPack.projectLeader.statusSuggestions || []).map((item) => ({
        "Project ID": item.projectId || "",
        Name: item.name || "",
        "Status Type": item.statusType || "",
        "Can Use KV": item.canUseKv ? "Yes" : "No",
        "Recommended Action": item.recommendedAction || "",
        Suggestion: item.proposedStatusText || "",
      }))),
      widths: [16, 34, 24, 14, 24, 80],
    },
    {
      name: "Steering Agenda",
      rows: rowsFromObjects(["Project ID", "Name", "Priority", "Agenda Item", "Owner", "Due Date"], (boardPack.steeringAgenda || []).map((item) => ({
        "Project ID": item.projectId || "",
        Name: item.name || "",
        Priority: item.priority || "",
        "Agenda Item": item.agendaItem || "",
        Owner: item.owner || "",
        "Due Date": item.dueDate || "",
      }))),
      widths: [16, 34, 16, 60, 22, 16],
    },
    {
      name: "Risks",
      rows: rowsFromObjects(["Project ID", "Name", "Status", "Evidence Code", "Field", "Value", "Message"], (boardPack.riskRegister || []).map((item) => ({
        "Project ID": item.projectId || "",
        Name: item.name || "",
        Status: item.status || "",
        "Evidence Code": item.evidenceCode || "",
        Field: item.field || "",
        Value: item.value ?? "",
        Message: item.message || "",
      }))),
      widths: [16, 34, 16, 24, 22, 36, 60],
    },
    {
      name: "Decisions",
      rows: rowsFromObjects(["Project ID", "Name", "Decision", "Owner", "Due Date", "Status"], (boardPack.decisionLog || []).map((item) => ({
        "Project ID": item.projectId || "",
        Name: item.name || "",
        Decision: item.decision || "",
        Owner: item.owner || "",
        "Due Date": item.dueDate || "",
        Status: item.status || "",
      }))),
      widths: [16, 34, 60, 22, 16, 16],
    },
    {
      name: "Status Suggestions",
      rows: rowsFromObjects(["Project ID", "Name", "Status Type", "Quality Score", "Can Use KV", "Text"], (boardPack.statusSuggestions || []).map((item) => ({
        "Project ID": item.projectId || "",
        Name: item.name || "",
        "Status Type": item.statusType || "",
        "Quality Score": item.qualityScore ?? "",
        "Can Use KV": item.canUseKv ? "Yes" : "No",
        Text: item.proposedStatusText || "",
      }))),
      widths: [16, 34, 24, 14, 14, 90],
    },
    {
      name: "Project Links",
      rows: rowsFromObjects(["Project ID", "Name", "Status", "KPI", "Progress", "Safety", "PMO", "Project Link"], (boardPack.projectSpotlights || []).map((item) => ({
        "Project ID": item.projectId || "",
        Name: item.name || "",
        Status: item.projectStatusLabel || "",
        KPI: item.overallKpiLabel || "",
        Progress: item.progress ?? "",
        Safety: item.safetyLevel || "",
        PMO: item.pmoLevel || "",
        "Project Link": item.recordUrl ? "Open Project" : "",
      }))),
      widths: [16, 34, 18, 12, 12, 16, 16, 18],
      hyperlinks: (boardPack.projectSpotlights || []).map((item, index) => item.recordUrl ? { ref: `H${index + 2}`, target: item.recordUrl, id: `rId${index + 1}` } : null).filter(Boolean),
    },
    {
      name: "Evidence",
      rows: rowsFromObjects(["Type", "Project ID", "Name", "Code", "Field", "Value", "Message"], (boardPack.evidenceLedger || []).map((item) => ({
        Type: item.evidenceType || "",
        "Project ID": item.projectId || "",
        Name: item.name || "",
        Code: item.code || "",
        Field: item.field || "",
        Value: item.value ?? "",
        Message: item.message || "",
      }))),
      widths: [18, 16, 34, 24, 22, 36, 60],
    },
    {
      name: "Data Gaps",
      rows: rowsFromObjects(["Project ID", "Name", "Field", "Message"], (boardPack.dataGaps || []).map((item) => ({
        "Project ID": item.projectId || "",
        Name: item.name || "",
        Field: item.field || "",
        Message: item.message || "",
      }))),
      widths: [16, 34, 28, 70],
    },
    {
      name: "Logic Assurance",
      rows: rowsFromObjects(["Check", "Status", "Findings", "Data Gaps"], (boardPack.logicAssurance?.checks || []).map((item) => ({
        Check: item.id || "",
        Status: item.status || "",
        Findings: item.findings ?? "",
        "Data Gaps": item.dataGaps ?? "",
      }))),
      widths: [34, 14, 12, 14],
    },
  ];
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("\n")}
</Types>`);
  zip.folder("_rels").file(".rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);
  zip.folder("xl").file("workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>
${sheets.map((sheet, index) => `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("\n")}
</sheets>
</workbook>`);
  zip.folder("xl").folder("_rels").file("workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("\n")}
<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);
  zip.folder("xl").file("styles.xml", buildWorkbookStylesXml());
  const worksheets = zip.folder("xl").folder("worksheets");
  sheets.forEach((sheet, index) => {
    worksheets.file(`sheet${index + 1}.xml`, buildWorksheetXml(sheet.rows, { widths: sheet.widths, autoFilter: true, hyperlinks: sheet.hyperlinks || [] }));
    if (sheet.hyperlinks?.length) {
      worksheets.folder("_rels").file(`sheet${index + 1}.xml.rels`, buildWorksheetRelationshipsXml(sheet.hyperlinks));
    }
  });
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

async function writePmoReportFiles(reportOrSuite, options = {}) {
  return writePmoStatusReportFiles(reportOrSuite, options);
}

async function writeBoardPackFiles(boardPack, options = {}) {
  const writtenFiles = {};
  if (options.docxPath) {
    ensureParentDirectory(options.docxPath);
    fs.writeFileSync(options.docxPath, await buildBoardPackDocxBuffer(boardPack));
    writtenFiles.docx = path.resolve(options.docxPath);
  }
  if (options.xlsxPath) {
    ensureParentDirectory(options.xlsxPath);
    fs.writeFileSync(options.xlsxPath, await buildBoardPackXlsxBuffer(boardPack));
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
  const options = buildPmoReportOptions();
  const report = options.reportType === "pmo_status"
    ? projectIntelligence.buildPmoStatusReport(projects, options)
    : projectIntelligence.buildPmoReport(options.reportType, projects, options);
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

async function printPmoReportSuite() {
  const inputPath = getArgValue("--pmo-suite");
  if (!inputPath) {
    throw new Error("--pmo-suite requires a JSON file path or '-' for stdin.");
  }
  const projects = readProjectsInput(inputPath);
  const suite = projectIntelligence.buildPmoReportSuite(projects, buildPmoReportOptions());
  const writtenFiles = await writePmoReportFiles(suite, {
    docxPath: getArgValue("--docx"),
    xlsxPath: getArgValue("--xlsx"),
  });
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ ...suite, writtenFiles }, null, 2));
    return;
  }
  console.log([
    "# PMO Report Suite",
    "",
    `Reports: ${suite.summary.reportCount}`,
    `Projects reviewed: ${suite.summary.projectsReviewed}`,
    `Data gaps: ${suite.summary.totalDataGaps}`,
    "",
    ...suite.reports.map((report) => `- ${report.title} (${report.reportType}): ${report.rows.length} row(s), ${report.dataGaps.length} data gap(s)`),
    "",
    Object.keys(writtenFiles).length ? `Files written:\n${Object.entries(writtenFiles).map(([type, outputPath]) => `- ${type}: ${outputPath}`).join("\n")}` : "",
  ].filter(Boolean).join("\n"));
}

async function printStatusSuggestionReport() {
  const inputPath = getArgValue("--status-suggestion-report");
  if (!inputPath) {
    throw new Error("--status-suggestion-report requires a JSON file path or '-' for stdin.");
  }
  const projects = readProjectsInput(inputPath);
  const report = projectIntelligence.buildStatusSuggestionReport(projects, buildPmoReportOptions());
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

function formatBoardPackMarkdown(boardPack, writtenFiles = {}) {
  return [
    "# Full Board Pack",
    "",
    `Source: ${boardPack.source}`,
    `Projects reviewed: ${boardPack.executive.summary.projectsReviewed}`,
    `Critical projects: ${boardPack.executive.summary.criticalProjects}`,
    `Open decisions: ${boardPack.executive.summary.openDecisions}`,
    `PMO work items: ${boardPack.pmo.workQueue.length}`,
    `Status suggestions: ${boardPack.projectLeader.statusSuggestions.length}`,
    `Data gaps: ${boardPack.dataGaps.length}`,
    "",
    "## Files",
    "",
    ...(Object.keys(writtenFiles).length ? Object.entries(writtenFiles).map(([type, outputPath]) => `- ${type}: ${outputPath}`) : ["- No files written."]),
    "",
  ].join("\n");
}

async function printBoardPack() {
  const inputPath = getArgValue("--board-pack");
  if (!inputPath) {
    throw new Error("--board-pack requires a JSON file path or '-' for stdin.");
  }
  const projects = readProjectsInput(inputPath);
  const boardPack = projectIntelligence.buildBoardPack(projects, {
    ...buildPmoReportOptions(),
    source: "offline_reviewed_snapshot",
  });
  const writtenFiles = await writeBoardPackFiles(boardPack, {
    docxPath: getArgValue("--docx"),
    xlsxPath: getArgValue("--xlsx"),
  });
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ ...boardPack, writtenFiles }, null, 2));
    return;
  }
  console.log(formatBoardPackMarkdown(boardPack, writtenFiles));
}

function formatMonthlyStatusReportRunMarkdown(run) {
  return [
    "# Monthly Project Status Writeback Plan",
    "",
    `Month: ${run.reportMonth}`,
    `Period: ${run.periodStart} to ${run.periodEnd}`,
    `Projects reviewed: ${run.summary.projectsReviewed}`,
    `Drafts ready: ${run.summary.draftsReady}`,
    `Missing status inputs: ${run.summary.statusInputsMissing}`,
    `Blocked until confirmation: ${run.summary.blockedUntilConfirmation}`,
    "",
    "## Project Drafts",
    "",
    ...run.reports.map((report) => [
      `- ${report.name || report.projectId || "Unnamed project"} (${report.projectId || "n/a"})`,
      `  Month: ${report.reportMonth}`,
      `  Status required: ${report.statusRequired ? "yes" : "no"}`,
      `  Safety: ${report.safetyLevel}`,
      `  Writeback risk: ${report.writebackRisk}`,
      `  Mode: ${report.writeback.mode}`,
      `  Confirmation: ${report.writeback.confirmationText}`,
    ].join("\n")),
    "",
    "No automatic CRM save is included. Stage in Quick Create and save only after explicit confirmation.",
  ].join("\n");
}

function printMonthlyStatusReportRun() {
  const inputPath = getArgValue("--monthly-status-plan");
  if (!inputPath) {
    throw new Error("--monthly-status-plan requires a JSON file path or '-' for stdin.");
  }
  const projects = readProjectsInput(inputPath);
  const run = buildMonthlyStatusReportRun(projects, {
    today: getArgValue("--today") || undefined,
    reportMonth: getArgValue("--month") || getArgValue("--report-month") || undefined,
    defaultStatusText: getArgValue("--status-text") || undefined,
    submittedTo: getArgValue("--submitted-to") || undefined,
    projectManagerVerified: process.argv.includes("--project-manager-verified"),
    reviewed: process.argv.includes("--reviewed"),
    generatedContent: process.argv.includes("--generated-content"),
    emailStatusUpdate: process.argv.includes("--email-status-update"),
  });
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(run, null, 2));
    return;
  }
  console.log(formatMonthlyStatusReportRunMarkdown(run));
}

async function main() {
  try {
    if (process.argv.includes("--help") || process.argv.includes("-h")) {
      printHelp();
    } else if (process.argv.includes("--dataverse")) {
      printDataverseSnippet();
    } else if (process.argv.includes("--board-pack")) {
      await printBoardPack();
    } else if (process.argv.includes("--pmo-suite")) {
      await printPmoReportSuite();
    } else if (process.argv.includes("--status-suggestion-report")) {
      await printStatusSuggestionReport();
    } else if (process.argv.includes("--monthly-status-plan")) {
      printMonthlyStatusReportRun();
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
  PMO_PROJECT_EXPORT_TYPE,
  PMO_PROJECT_EXPORT_VERSION,
  MAXIMUM_USP_IDS: projectIntelligence.MAXIMUM_USP_IDS,
  PMO_USP_IDS: projectIntelligence.PMO_USP_IDS,
  LOGIC_ASSURANCE_USP_IDS: projectIntelligence.LOGIC_ASSURANCE_USP_IDS,
  LOGIC_VALIDATION_CHECK_IDS: projectIntelligence.LOGIC_VALIDATION_CHECK_IDS,
  STATUS_API_FEATURE_VERSION,
  STATUS_UPDATE_ENTITY_LOGICAL_NAME_CANDIDATES,
  PROJECT_ACTIVE_STATE_FILTER,
  PROJECT_MANAGER_NAME,
  PROJECT_DEFAULT_SELECT_COLUMNS,
  ACTIVE_PROJECT_STATUS_LABELS,
  PMO_REPORT_TYPES: projectIntelligence.PMO_REPORT_TYPES,
  STATUS_UPDATE_FIELDS,
  STATUS_UPDATE_REQUIRED_FIELDS,
  STATUS_UPDATE_SUBGRID_NAME,
  STATUS_UPDATE_TAB_NAME,
  UNCHANGED_STATUS_TEXT,
  buildActiveProjectsApiUrl,
  buildBatchProjectPreview,
  buildDataverseQuery,
  buildDataversePermissionProbePlan,
  buildDataverseUrl,
  buildDeltaProjectsApiUrl,
  buildDynamicsProjectRecordUrl,
  buildMonthlyStatusReportDraft,
  buildMonthlyStatusReportRun,
  buildPmoProjectExport,
  buildProjectRecordApiUrl,
  buildStatusApiEnvelope,
  buildStatusReportIdempotencyKey,
  buildStatusReportSuggestion: projectIntelligence.buildStatusReportSuggestion,
  buildStatusSuggestionReport: projectIntelligence.buildStatusSuggestionReport,
  buildStatusUpdateAttachmentPlan,
  buildStatusUpdateCreateRecordPlan,
  buildStatusUpdateDuplicateCheck,
  buildStatusUpdateHistoryQuery,
  buildStatusUpdateWritebackPayload,
  buildStatusUpdateDraft,
  buildStatusWritebackAuditEvent,
  buildStatusWritebackQueue,
  buildStructuredStatusUpdateDraft,
  buildPmoStatusReportDocxBuffer,
  buildPmoStatusReportXlsxBuffer,
  buildBoardPackDocxBuffer,
  buildBoardPackXlsxBuffer,
  formatProjectIntelligenceMarkdown,
  formatMonthlyStatusReportRunMarkdown,
  formatPmoStatusReportMarkdown,
  writePmoStatusReportFiles,
  writePmoReportFiles,
  writeBoardPackFiles,
  buildAuditEntry: projectIntelligence.buildAuditEntry,
  buildAiEscalationPack: projectIntelligence.buildAiEscalationPack,
  buildAudienceReport: projectIntelligence.buildAudienceReport,
  buildAutonomousPmoWatchtower: projectIntelligence.buildAutonomousPmoWatchtower,
  buildBoardPack: projectIntelligence.buildBoardPack,
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
  buildLogicAssuranceUspLayer: projectIntelligence.buildLogicAssuranceUspLayer,
  buildLogicValidationReport: projectIntelligence.buildLogicValidationReport,
  buildLogicValidationSuite: projectIntelligence.buildLogicValidationSuite,
  buildManagementActionExportRows: projectIntelligence.buildManagementActionExportRows,
  buildMaximumUspLayer: projectIntelligence.buildMaximumUspLayer,
  buildPmoUspLayer: projectIntelligence.buildPmoUspLayer,
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
  buildPmoReport: projectIntelligence.buildPmoReport,
  buildPmoReportSuite: projectIntelligence.buildPmoReportSuite,
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
  unwrapProjectInput,
  isSampleInputPath,
  isActiveProjectCandidate,
  mapProjectDataverseRow,
  mapDataverseError,
  normalizeStatusInput,
  normalizeGuid,
};
