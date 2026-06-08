const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const path = require("node:path");

const scriptPath = path.join(__dirname, "statusbericht.js");
const fixturePath = path.join(__dirname, "fixtures", "projects.sample.json");

assert.throws(
  () => execFileSync(process.execPath, [scriptPath, "--intelligence", fixturePath, "--today", "2026-05-13"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }),
  /Sample or synthetic project data is not accepted for production runs/
);

const output = execFileSync(process.execPath, [scriptPath, "--intelligence", fixturePath, "--today", "2026-05-13", "--allow-sample"], {
  encoding: "utf8",
});

assert.match(output, /# Project Portfolio One-Pager/);
assert.match(output, /ERP Cutover/);
assert.match(output, /Approve fallback interface/);
assert.match(output, /## Project Leader Queue/);
assert.match(output, /needs_attention/);
assert.match(output, /## Steering Agenda/);
assert.match(output, /## Evidence/);
assert.match(output, /## Nudges/);

const jsonOutput = execFileSync(
  process.execPath,
  [scriptPath, "--intelligence", fixturePath, "--today", "2026-05-13", "--json", "--allow-sample"],
  { encoding: "utf8" }
);
const parsed = JSON.parse(jsonOutput);
assert.equal(parsed.portfolioRisks.length, 1);
assert.equal(parsed.decisionRadar.length, 1);
assert.equal(parsed.steeringAgenda.length, 1);
assert.equal(parsed.decisionClosureItems.length, 1);
assert.equal(parsed.riskLedger.length, 3);
assert.equal(parsed.nudges.length, 1);

const exportsOutput = execFileSync(
  process.execPath,
  [scriptPath, "--intelligence", fixturePath, "--today", "2026-05-13", "--exports", "--allow-sample"],
  { encoding: "utf8" }
);
const exportsParsed = JSON.parse(exportsOutput);
assert.match(exportsParsed.csv.managementActions, /decision_closure/);
assert.match(exportsParsed.csv.riskLedger, /red_kpi/);

const pmoReportOutput = execFileSync(
  process.execPath,
  [
    scriptPath,
    "--pmo-report",
    fixturePath,
    "--today",
    "2026-05-13",
    "--project-status",
    "In Progress",
    "--last-status-contains",
    "Vendor",
    "--allow-sample",
  ],
  { encoding: "utf8" }
);
assert.match(pmoReportOutput, /# PMO Status Report/);
assert.match(pmoReportOutput, /Project status: In Progress/);
assert.match(pmoReportOutput, /Last status contains: Vendor/);
assert.match(pmoReportOutput, /ERP Cutover/);
assert.doesNotMatch(pmoReportOutput, /CRM Rollout/);

const pmoJsonOutput = execFileSync(
  process.execPath,
  [scriptPath, "--pmo-report", fixturePath, "--project-status", "In Progress", "--json", "--allow-sample"],
  { encoding: "utf8" }
);
const pmoJson = JSON.parse(pmoJsonOutput);
assert.equal(pmoJson.filters.projectStatusLabels[0], "In Progress");
assert.equal(pmoJson.pmoControlTower.summary.projectsReviewed, 2);

console.log("statusbericht cli tests passed");
