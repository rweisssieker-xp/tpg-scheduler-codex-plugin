"use strict";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const child of Object.values(value)) {
    deepFreeze(child);
  }
  return value;
}

const SETTINGS_VERSION = "1.0";

const PROJECT_PRIMARY_ID_ATTRIBUTE = "tpg_projectid";
const PROJECT_PRIMARY_NAME_ATTRIBUTE = "tpg_subject";

const STATUS_UPDATE_FIELDS = {
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
};

const TPG_PLUGIN_SETTINGS = deepFreeze({
  settingsVersion: SETTINGS_VERSION,
  dynamics: {
    orgUrl: "https://posp365.crm4.dynamics.com",
    appId: "1a66513c-266c-ef11-bfe2-6045bd8d5d87",
    apiVersion: "v9.2",
    projectListUrl:
      "https://posp365.crm4.dynamics.com/main.aspx?appid=1a66513c-266c-ef11-bfe2-6045bd8d5d87&forceUCI=1&pagetype=entitylist&etn=tpg_project&viewid=40761dc9-c0d4-ef11-a72e-7c1e52862247&viewType=4230",
  },
  project: {
    entityLogicalName: "tpg_project",
    entitySetName: "tpg_projects",
    primaryIdAttribute: PROJECT_PRIMARY_ID_ATTRIBUTE,
    primaryNameAttribute: PROJECT_PRIMARY_NAME_ATTRIBUTE,
    activeStateFilter: "statecode eq 0",
    activeStatusLabels: ["Created", "Planning", "In Progress"],
    defaultSelectColumns: [
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
    ],
    knownOptionLabels: {
      tpg_projectstatus: {
        926720004: "Closed",
      },
      tpg_overallkpi: {
        926720002: "Green",
      },
    },
  },
  statusUpdate: {
    entityLogicalNameCandidates: [
      "tpg_statusupdate",
      "tpg_projectstatusupdate",
      "gbl_statusupdate",
    ],
    tabName: "tab_status",
    subgridName: "status_grid",
    fields: STATUS_UPDATE_FIELDS,
    requiredFields: [
      STATUS_UPDATE_FIELDS.reportDate,
      STATUS_UPDATE_FIELDS.project,
      STATUS_UPDATE_FIELDS.statusSummary,
      STATUS_UPDATE_FIELDS.owner,
      STATUS_UPDATE_FIELDS.submittedTo,
    ],
  },
  pmoExport: {
    type: "tpg_pmo_project_export",
    version: "1.0",
  },
  statusApi: {
    version: "1.0",
  },
  workflow: {
    projectManagerName: "Reiner Weisssieker",
    unchangedStatusText: "Status unverändert seit letztem Bericht (keine inhaltlichen Änderungen)",
  },
  safety: {
    readOnlyExport: true,
    crmWritesIncluded: false,
    requiresExplicitSaveConfirmationForWriteback: true,
    mockDataAllowed: false,
  },
});

module.exports = {
  SETTINGS_VERSION,
  TPG_PLUGIN_SETTINGS,
  PROJECT_LIST_URL: TPG_PLUGIN_SETTINGS.dynamics.projectListUrl,
  DATAVERSE_ORG_URL: TPG_PLUGIN_SETTINGS.dynamics.orgUrl,
  DYNAMICS_APP_ID: TPG_PLUGIN_SETTINGS.dynamics.appId,
  DATAVERSE_API_VERSION: TPG_PLUGIN_SETTINGS.dynamics.apiVersion,
  PROJECT_ENTITY_LOGICAL_NAME: TPG_PLUGIN_SETTINGS.project.entityLogicalName,
  PROJECT_ENTITY_SET_NAME: TPG_PLUGIN_SETTINGS.project.entitySetName,
  PROJECT_PRIMARY_ID_ATTRIBUTE: TPG_PLUGIN_SETTINGS.project.primaryIdAttribute,
  PROJECT_PRIMARY_NAME_ATTRIBUTE: TPG_PLUGIN_SETTINGS.project.primaryNameAttribute,
  PMO_PROJECT_EXPORT_TYPE: TPG_PLUGIN_SETTINGS.pmoExport.type,
  PMO_PROJECT_EXPORT_VERSION: TPG_PLUGIN_SETTINGS.pmoExport.version,
  STATUS_API_FEATURE_VERSION: TPG_PLUGIN_SETTINGS.statusApi.version,
  STATUS_UPDATE_ENTITY_LOGICAL_NAME_CANDIDATES: TPG_PLUGIN_SETTINGS.statusUpdate.entityLogicalNameCandidates,
  PROJECT_DEFAULT_SELECT_COLUMNS: TPG_PLUGIN_SETTINGS.project.defaultSelectColumns,
  PROJECT_ACTIVE_STATE_FILTER: TPG_PLUGIN_SETTINGS.project.activeStateFilter,
  PROJECT_MANAGER_NAME: TPG_PLUGIN_SETTINGS.workflow.projectManagerName,
  ACTIVE_PROJECT_STATUS_LABELS: TPG_PLUGIN_SETTINGS.project.activeStatusLabels,
  STATUS_UPDATE_TAB_NAME: TPG_PLUGIN_SETTINGS.statusUpdate.tabName,
  STATUS_UPDATE_SUBGRID_NAME: TPG_PLUGIN_SETTINGS.statusUpdate.subgridName,
  STATUS_UPDATE_FIELDS: TPG_PLUGIN_SETTINGS.statusUpdate.fields,
  STATUS_UPDATE_REQUIRED_FIELDS: TPG_PLUGIN_SETTINGS.statusUpdate.requiredFields,
  PROJECT_KNOWN_OPTION_LABELS: TPG_PLUGIN_SETTINGS.project.knownOptionLabels,
  UNCHANGED_STATUS_TEXT: TPG_PLUGIN_SETTINGS.workflow.unchangedStatusText,
};
