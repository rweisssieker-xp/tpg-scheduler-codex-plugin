"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const repoRoot = path.resolve(root, "..", "..");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function assertFile(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  assert.equal(fs.existsSync(absolutePath), true, `${relativePath} must exist`);
  return fs.readFileSync(absolutePath, "utf8");
}

const plugin = readJson(".codex-plugin/plugin.json");
const pkg = readJson("package.json");
const rootPlugin = JSON.parse(fs.readFileSync(path.join(repoRoot, ".codex-plugin", "plugin.json"), "utf8"));
const ciWorkflow = fs.readFileSync(path.join(repoRoot, ".github", "workflows", "ci.yml"), "utf8");
const releaseWorkflow = fs.readFileSync(path.join(repoRoot, ".github", "workflows", "release.yml"), "utf8");

assert.equal(plugin.name, "tpg-scheduler-codex-plugin");
assert.equal(rootPlugin.name, plugin.name);
assert.equal(rootPlugin.skills, "./skills/");
assert.equal(rootPlugin.mcpServers, "./.mcp.json");
assert.equal(rootPlugin.apps, "./.app.json");
assert.equal(plugin.interface.displayName, "TPG-Scheduler-Codex-Plugin");
assert.match(plugin.repository, /^https:\/\/github\.com\/rweisssieker-xp\/tpg-scheduler-codex-plugin/);
assert.equal(pkg.name, plugin.name);
assert.equal(pkg.repository.url, "https://github.com/rweisssieker-xp/tpg-scheduler-codex-plugin.git");
assert.equal(Boolean(pkg.dependencies?.docx), true, "DOCX export dependency must be present");
assert.equal(Boolean(pkg.dependencies?.jszip), true, "XLSX zip writer dependency must be present");
assert.equal(Boolean(pkg.dependencies?.exceljs), false, "Excel export must not depend on exceljs vulnerable dependency tree");
assert.equal(/sample|fixture/.test(pkg.scripts["status-report:intelligence"]), false, "production intelligence script must not use sample data");
assert.equal(/sample|fixture/.test(pkg.scripts["statusbericht:intelligence"]), false, "legacy production intelligence script must not use sample data");
assert.equal(Object.keys(pkg.scripts).some((scriptName) => scriptName.includes("demo")), false, "npm scripts must not expose demo or mock data as active commands");
assert.equal(pkg.scripts["release:check"], "node ./scripts/release-readiness.js", "release readiness script must be available");
assert.equal(pkg.scripts["release:manifest"], "node ./scripts/release-manifest.js", "release manifest script must be available");
assert.match(ciWorkflow, /FORCE_JAVASCRIPT_ACTIONS_TO_NODE24:\s*true/, "CI must opt into Node 24 JavaScript action runtime");
assert.match(releaseWorkflow, /FORCE_JAVASCRIPT_ACTIONS_TO_NODE24:\s*true/, "release workflow must opt into Node 24 JavaScript action runtime");
assert.match(ciWorkflow, /actions\/checkout@v5/, "CI must use checkout action v5");
assert.match(ciWorkflow, /actions\/setup-node@v5/, "CI must use setup-node action v5");
assert.match(releaseWorkflow, /actions\/checkout@v5/, "release workflow must use checkout action v5");
assert.match(releaseWorkflow, /actions\/setup-node@v5/, "release workflow must use setup-node action v5");
assert.equal(/actions\/upload-artifact@/.test(releaseWorkflow), false, "release workflow must avoid upload-artifact until a Node 24 action runtime is available");
assert.equal(fs.existsSync(path.join(root, plugin.skills)), true, "skills path must exist");
assert.equal(fs.existsSync(path.join(root, plugin.mcpServers)), true, "mcpServers path must exist");
assert.equal(fs.existsSync(path.join(root, plugin.apps)), true, "apps path must exist");

const skill = assertFile("plugins/tpg-scheduler-codex-plugin/skills/status-report/SKILL.md");
assert.match(skill, /^---\nname: status-report\n/m);
assert.match(skill, /Never save, submit, send, delete, change ownership, or change CRM state without explicit user confirmation\./);
assert.match(skill, /pmo-report-suite/);
assert.match(skill, /TPGProjectAssist\.retrieveProjectIntelligenceFromD365/);
assert.match(skill, /D365 API|Dataverse Web API/);
assert.match(skill, /buildMonthlyStatusReportDraft/);
assert.match(skill, /--monthly-status-plan/);
assert.match(skill, /createStatusUpdateWithConfirmation/);
assert.match(skill, /buildStatusWritebackQueue/);
assert.match(skill, /buildLivePmoControlCenterFromD365/);
assert.match(skill, /retrieveMonthlyPmSelfServiceFlowFromD365/);
assert.match(skill, /retrieveStatusSuggestionReportFromD365/);
const pmoSkill = assertFile("plugins/tpg-scheduler-codex-plugin/skills/pmo-report-suite/SKILL.md");
const rootPmoSkill = assertFile("skills/pmo-report-suite/SKILL.md");
assert.match(pmoSkill, /^---\nname: pmo-report-suite\n/m);
assert.match(rootPmoSkill, /^---\nname: pmo-report-suite\n/m);
assert.match(pmoSkill, /retrieveProjectIntelligenceFromD365|D365 API|Dataverse Web API/);
assert.match(rootPmoSkill, /retrieveProjectIntelligenceFromD365|D365 API|Dataverse Web API/);
assert.match(pmoSkill, /buildLivePmoControlCenterFromD365/);
assert.match(rootPmoSkill, /buildLivePmoControlCenterFromD365/);
assert.match(pmoSkill, /retrievePowerBiReadyPortfolioFromD365/);
assert.match(rootPmoSkill, /retrievePowerBiReadyPortfolioFromD365/);
assert.match(pmoSkill, /status-suggestion-report/);
assert.match(rootPmoSkill, /retrieveStatusSuggestionReportFromD365/);
for (const reportType of [
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
]) {
  assert.match(pmoSkill, new RegExp(reportType), `pmo-report-suite skill must document ${reportType}`);
}

const requiredDocs = [
  "README.md",
  "docs/USAGE.md",
  "docs/ARCHITECTURE.md",
  "docs/INSTALLATION.md",
  "docs/VALIDATION.md",
  "docs/EXAMPLES.md",
  "docs/SCHEMA.md",
  "docs/RELEASE.md",
  "docs/RELEASE_NOTES_v0.1.0.md",
  "docs/PUBLICATION.md",
  "docs/PRIVACY.md",
  "docs/DYNAMICS_E2E_RUNBOOK.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "CHANGELOG.md",
  "LICENSE",
  ".app.json",
  ".mcp.json",
  ".github/CODEOWNERS",
  ".github/dependabot.yml",
  ".github/workflows/ci.yml",
  ".github/workflows/release.yml",
  "skills/status-report/SKILL.md",
  "skills/pmo-report-suite/SKILL.md",
  "schemas/project-intelligence.schema.json",
  "schemas/project-safety-gates.schema.json",
  "schemas/pmo-control-tower.schema.json",
  "schemas/status-api-envelope.schema.json",
  "schemas/status-writeback-queue.schema.json",
  "schemas/status-update-create-plan.schema.json",
  "schemas/status-writeback-audit-event.schema.json",
  "schemas/status-update-duplicate-check.schema.json",
  "examples/project-intelligence.sample.json",
  "examples/status-api-max.sample.json",
  "plugins/tpg-scheduler-codex-plugin/README.md",
  "plugins/tpg-scheduler-codex-plugin/skills/pmo-report-suite/SKILL.md",
  "plugins/tpg-scheduler-codex-plugin/assets/icon.svg",
  "plugins/tpg-scheduler-codex-plugin/scripts/release-readiness.js",
  "plugins/tpg-scheduler-codex-plugin/scripts/release-manifest.js",
];
for (const doc of requiredDocs) {
  assertFile(doc);
}

const publicDocs = [
  "README.md",
  "docs/USAGE.md",
  "docs/ARCHITECTURE.md",
  "docs/INSTALLATION.md",
  "docs/VALIDATION.md",
  "docs/EXAMPLES.md",
  "docs/SCHEMA.md",
  "docs/RELEASE.md",
  "docs/RELEASE_NOTES_v0.1.0.md",
  "docs/PUBLICATION.md",
  "docs/PRIVACY.md",
  "docs/DYNAMICS_E2E_RUNBOOK.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "CHANGELOG.md",
  "plugins/tpg-scheduler-codex-plugin/README.md",
].map(assertFile).join("\n");

assert.equal(/Erstelle|Starte|Bereite|Statusbericht|Projektleiter/.test(publicDocs), false, "public docs should use en-US wording");
for (const d365ApiFeature of [
  "discoverProjectFieldMetadataFromD365",
  "buildLivePmoControlCenterFromD365",
  "resolveStatusUpdateEntityFromD365",
  "retrieveMonthlyPmSelfServiceFlowFromD365",
  "simulateStatusWritebackFromD365",
  "resolveSubmittedToCandidatesFromD365",
  "retrieveStatusHistoryTimelineFromD365",
  "checkDuplicateStatusUpdateFromD365",
  "retrieveExecutiveSteeringPackFromD365",
  "retrievePmoDataGapWorklistFromD365",
  "routeCioCfoRiskFromD365",
  "retrievePowerBiReadyPortfolioFromD365",
  "probeD365PermissionsDetailed",
  "buildAuditEvidencePackFromD365",
  "pilotStatusWritebackFromD365",
  "retrieveStatusSuggestionReportFromD365",
]) {
  assert.match(publicDocs, new RegExp(d365ApiFeature), `public docs must document ${d365ApiFeature}`);
}

for (const schemaPath of [
  "schemas/project-intelligence.schema.json",
  "schemas/project-safety-gates.schema.json",
  "schemas/pmo-control-tower.schema.json",
  "schemas/status-api-envelope.schema.json",
  "schemas/status-writeback-queue.schema.json",
  "schemas/status-update-create-plan.schema.json",
  "schemas/status-writeback-audit-event.schema.json",
  "schemas/status-update-duplicate-check.schema.json",
]) {
  const schema = JSON.parse(assertFile(schemaPath));
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema", `${schemaPath} must use JSON Schema 2020-12`);
  assert.equal(typeof schema.title, "string", `${schemaPath} must have a title`);
  assert.equal(schema.type, "object", `${schemaPath} must describe an object`);
  assert.equal(Boolean(schema.properties), true, `${schemaPath} must define properties`);
}

const intelligenceSchema = JSON.parse(assertFile("schemas/project-intelligence.schema.json"));
assert.equal(Boolean(intelligenceSchema.properties.projectSafetyGates), true, "project intelligence schema must include projectSafetyGates");
assert.equal(Boolean(intelligenceSchema.properties.pmoControlTower), true, "project intelligence schema must include pmoControlTower");
assert.equal(Boolean(intelligenceSchema.properties.maximumUsps), true, "project intelligence schema must include maximumUsps");
assert.equal(Boolean(intelligenceSchema.properties.pmoUsps), true, "project intelligence schema must include pmoUsps");
assert.equal(Boolean(intelligenceSchema.properties.pmoStatusReport), true, "project intelligence schema must include pmoStatusReport");
assert.equal(Boolean(intelligenceSchema.properties.statusSuggestionReport), true, "project intelligence schema must include statusSuggestionReport");
assert.equal(Boolean(intelligenceSchema.properties.pmoReportSuite), true, "project intelligence schema must include pmoReportSuite");

const safetySchema = JSON.parse(assertFile("schemas/project-safety-gates.schema.json"));
assert.deepEqual(safetySchema.properties.projects.items.required, [
  "projectId",
  "name",
  "safetyScore",
  "safetyLevel",
  "managementAttention",
  "writebackRisk",
  "gates",
  "requiredEvidence",
  "recommendedActions",
]);

const pmoSchema = JSON.parse(assertFile("schemas/pmo-control-tower.schema.json"));
assert.equal(pmoSchema.properties.summary.properties.checksPerProject.const, 25);

const sample = JSON.parse(assertFile("examples/project-intelligence.sample.json"));
assert.equal(Boolean(sample.projectSafetyGates?.summary), true, "sample output must include projectSafetyGates.summary");
assert.equal(Boolean(sample.pmoControlTower?.summary), true, "sample output must include pmoControlTower.summary");
assert.equal(sample.maximumUsps?.summary?.uspCount, 12, "sample output must include the 12 maximum USPs");
assert.equal(sample.maximumUsps?.usps?.length, 12, "sample output must include 12 maximum USP entries");
assert.equal(sample.pmoUsps?.summary?.uspCount, 15, "sample output must include the 15 PMO USPs");
assert.equal(sample.pmoUsps?.usps?.length, 15, "sample output must include 15 PMO USP entries");
assert.equal(sample.pmoControlTower.summary.checksPerProject, 25, "sample output must show 25 PMO checks");
assert.equal(sample.pmoControlTower.projects[0].checks.length, 25, "sample output must include 25 PMO checks for the example project");

const statusApiSample = JSON.parse(assertFile("examples/status-api-max.sample.json"));
assert.equal(statusApiSample.apiEnvelope.api, "tpg_status_api", "status API sample must include API envelope");
assert.equal(statusApiSample.monthlyWritebackQueue.summary.canAutoSave, false, "status writeback queue must not allow auto-save");
assert.equal(statusApiSample.createPlan.operation, "Xrm.WebApi.createRecord", "status API sample must include create plan");
assert.equal(statusApiSample.createPlan.canAutoSave, false, "create plan must remain confirmation-gated");
assert.equal(statusApiSample.duplicateFound.duplicateFound, true, "status API sample must include duplicate-found example");
assert.equal(statusApiSample.auditEvent.eventType, "status_writeback_audit", "status API sample must include audit event");

console.log("plugin validation passed");
