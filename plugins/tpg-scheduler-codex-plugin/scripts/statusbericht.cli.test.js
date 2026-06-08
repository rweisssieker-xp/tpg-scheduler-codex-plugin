const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const JSZip = require("jszip");

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

const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "tpg-pmo-report-"));
const docxPath = path.join(outputDir, "pmo-status.docx");
const xlsxPath = path.join(outputDir, "pmo-status.xlsx");
const pmoFileOutput = execFileSync(
  process.execPath,
  [
    scriptPath,
    "--pmo-report",
    fixturePath,
    "--project-status",
    "In Progress",
    "--docx",
    docxPath,
    "--xlsx",
    xlsxPath,
    "--json",
    "--allow-sample",
  ],
  { encoding: "utf8" }
);
const pmoFileJson = JSON.parse(pmoFileOutput);
assert.equal(fs.existsSync(docxPath), true);
assert.equal(fs.existsSync(xlsxPath), true);
assert.deepEqual([...fs.readFileSync(docxPath).subarray(0, 2)].map((byte) => String.fromCharCode(byte)).join(""), "PK");
assert.deepEqual([...fs.readFileSync(xlsxPath).subarray(0, 2)].map((byte) => String.fromCharCode(byte)).join(""), "PK");
assert.equal(pmoFileJson.writtenFiles.docx, path.resolve(docxPath));
assert.equal(pmoFileJson.writtenFiles.xlsx, path.resolve(xlsxPath));

Promise.all([
  JSZip.loadAsync(fs.readFileSync(docxPath)),
  JSZip.loadAsync(fs.readFileSync(xlsxPath)),
]).then(async ([docxZip, xlsxZip]) => {
  const docXml = await docxZip.file("word/document.xml").async("string");
  const sheetXml = await xlsxZip.file("xl/worksheets/sheet3.xml").async("string");
  const stylesXml = await xlsxZip.file("xl/styles.xml").async("string");
  assert.match(docXml, /PMO Executive Status Report/);
  assert.match(docXml, /w:shd/);
  assert.match(sheetXml, /<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"\/>/);
  assert.match(sheetXml, /autoFilter ref="A1:J3"/);
  assert.match(stylesXml, /FF1F4E79/);
}).then(() => {
  console.log("statusbericht cli tests passed");
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
