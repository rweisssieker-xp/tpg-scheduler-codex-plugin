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

assert.equal(plugin.name, "tpg-scheduler-codex-plugin");
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
  "CONTRIBUTING.md",
  "SECURITY.md",
  "CHANGELOG.md",
  "LICENSE",
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
  "CONTRIBUTING.md",
  "SECURITY.md",
  "CHANGELOG.md",
  "plugins/tpg-scheduler-codex-plugin/README.md",
].map(assertFile).join("\n");

assert.equal(/Erstelle|Starte|Bereite|Statusbericht|Projektleiter/.test(publicDocs), false, "public docs should use en-US wording");

console.log("plugin validation passed");
