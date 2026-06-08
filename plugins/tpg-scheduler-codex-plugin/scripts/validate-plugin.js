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

assert.equal(plugin.name, "tpg-scheduler-codex-plugin");
assert.equal(rootPlugin.name, plugin.name);
assert.equal(rootPlugin.skills, "./skills/");
assert.equal(rootPlugin.mcpServers, "./.mcp.json");
assert.equal(rootPlugin.apps, "./.app.json");
assert.equal(plugin.interface.displayName, "TPG-Scheduler-Codex-Plugin");
assert.match(plugin.repository, /^https:\/\/github\.com\/rweisssieker-xp\/tpg-scheduler-codex-plugin/);
assert.equal(pkg.name, plugin.name);
assert.equal(pkg.repository.url, "https://github.com/rweisssieker-xp/tpg-scheduler-codex-plugin.git");
assert.equal(fs.existsSync(path.join(root, plugin.skills)), true, "skills path must exist");
assert.equal(fs.existsSync(path.join(root, plugin.mcpServers)), true, "mcpServers path must exist");
assert.equal(fs.existsSync(path.join(root, plugin.apps)), true, "apps path must exist");

const skill = assertFile("plugins/tpg-scheduler-codex-plugin/skills/status-report/SKILL.md");
assert.match(skill, /^---\nname: status-report\n/m);
assert.match(skill, /Never save, submit, send, delete, change ownership, or change CRM state without explicit user confirmation\./);

const requiredDocs = [
  "README.md",
  "docs/USAGE.md",
  "docs/ARCHITECTURE.md",
  "docs/INSTALLATION.md",
  "docs/VALIDATION.md",
  "docs/EXAMPLES.md",
  "docs/SCHEMA.md",
  "docs/RELEASE.md",
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
  "schemas/project-intelligence.schema.json",
  "schemas/project-safety-gates.schema.json",
  "schemas/pmo-control-tower.schema.json",
  "examples/project-intelligence.sample.json",
  "plugins/tpg-scheduler-codex-plugin/README.md",
  "plugins/tpg-scheduler-codex-plugin/assets/icon.svg",
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
  "docs/PRIVACY.md",
  "docs/DYNAMICS_E2E_RUNBOOK.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "CHANGELOG.md",
  "plugins/tpg-scheduler-codex-plugin/README.md",
].map(assertFile).join("\n");

assert.equal(/Erstelle|Starte|Bereite|Statusbericht|Projektleiter/.test(publicDocs), false, "public docs should use en-US wording");

for (const schemaPath of [
  "schemas/project-intelligence.schema.json",
  "schemas/project-safety-gates.schema.json",
  "schemas/pmo-control-tower.schema.json",
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
assert.equal(sample.pmoControlTower.summary.checksPerProject, 25, "sample output must show 25 PMO checks");
assert.equal(sample.pmoControlTower.projects[0].checks.length, 25, "sample output must include 25 PMO checks for the example project");

console.log("plugin validation passed");
