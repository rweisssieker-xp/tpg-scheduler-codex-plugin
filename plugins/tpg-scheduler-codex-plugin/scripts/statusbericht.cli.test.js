const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const path = require("node:path");

const scriptPath = path.join(__dirname, "statusbericht.js");
const fixturePath = path.join(__dirname, "fixtures", "projects.sample.json");

assert.throws(
  () => execFileSync(process.execPath, [scriptPath, "--intelligence", fixturePath, "--today", "2026-05-13"], { encoding: "utf8" }),
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

console.log("statusbericht cli tests passed");
