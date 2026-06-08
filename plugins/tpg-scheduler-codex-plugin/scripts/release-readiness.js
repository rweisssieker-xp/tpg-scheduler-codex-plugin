"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const repoRoot = path.resolve(root, "..", "..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function listTrackedFiles() {
  return execFileSync("git", ["ls-files"], { cwd: repoRoot, encoding: "utf8" })
    .split(/\r?\n/)
    .filter(Boolean);
}

const trackedFiles = listTrackedFiles();
const pkg = readJson("plugins/tpg-scheduler-codex-plugin/package.json");
const licenseText = read("LICENSE");
const gitignore = read(".gitignore");
const ciWorkflow = read(".github/workflows/ci.yml");
const releaseWorkflow = read(".github/workflows/release.yml");

assert.equal(pkg.private, true, "package must remain private because the repository uses an all-rights-reserved license");
assert.equal(pkg.license, "UNLICENSED", "package license must match the all-rights-reserved LICENSE file");
assert.match(licenseText, /All rights reserved\./, "LICENSE must state all-rights-reserved terms");
assert.match(gitignore, /^reports\/$/m, "reports/ must stay ignored for generated local artifacts");
assert.match(ciWorkflow, /actions\/checkout@v5/);
assert.match(ciWorkflow, /actions\/setup-node@v5/);
assert.match(releaseWorkflow, /actions\/checkout@v5/);
assert.match(releaseWorkflow, /actions\/setup-node@v5/);
assert.match(releaseWorkflow, /actions\/upload-artifact@v5/);

for (const trackedFile of trackedFiles) {
  const normalized = trackedFile.replace(/\\/g, "/");
  assert.equal(normalized.startsWith("reports/"), false, `${trackedFile} must not be tracked`);
  assert.equal(/real[-_ ]?dataverse|real[-_ ]?project[-_ ]?export|crm[-_ ]?export/i.test(normalized), false, `${trackedFile} looks like a real CRM export`);
}

const textFileExtensions = new Set([".md", ".json", ".js", ".yml", ".yaml", ".toml", ".txt"]);
const secretPatterns = [
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/,
  /-----BEGIN (RSA |EC |OPENSSH |PRIVATE )?PRIVATE KEY-----/,
  /client_secret["'\s:=]+[A-Za-z0-9._~+/=-]{12,}/i,
  /access_token["'\s:=]+[A-Za-z0-9._~+/=-]{20,}/i,
  /refresh_token["'\s:=]+[A-Za-z0-9._~+/=-]{20,}/i,
];

for (const trackedFile of trackedFiles) {
  const extension = path.extname(trackedFile).toLowerCase();
  if (!textFileExtensions.has(extension)) {
    continue;
  }
  const content = read(trackedFile);
  for (const pattern of secretPatterns) {
    assert.equal(pattern.test(content), false, `${trackedFile} contains a possible secret pattern`);
  }
}

const statusApiSample = readJson("examples/status-api-max.sample.json");
assert.equal(statusApiSample.monthlyWritebackQueue.summary.canAutoSave, false);
assert.equal(statusApiSample.createPlan.canAutoSave, false);
assert.match(statusApiSample.createPlan.confirmationText, /^CONFIRM DATAVERSE STATUS CREATE/);

console.log("release readiness checks passed");
