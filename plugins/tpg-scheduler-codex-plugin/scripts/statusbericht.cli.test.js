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
assert.match(output, /## Maximum USPs/);
assert.match(output, /PMO Safety Radar/);
assert.match(output, /## PMO USPs/);
assert.match(output, /PMO Command Queue/);
assert.match(output, /## Logic Assurance/);
assert.match(output, /Assurance level:/);

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
assert.equal(parsed.maximumUsps.summary.uspCount, 12);
assert.equal(parsed.maximumUsps.usps.find((usp) => usp.id === "executive_no_surprise_brief").implementationStatus, "implemented");
assert.equal(parsed.pmoUsps.summary.uspCount, 15);
assert.equal(parsed.pmoUsps.usps.find((usp) => usp.id === "pmo_command_queue").implementationStatus, "implemented");
assert.equal(parsed.logicValidation.checks.length, 15);
assert.equal(parsed.logicAssuranceUsps.summary.uspCount, 12);
assert.equal(parsed.boardPack.logicAssurance.checks.length, 15);

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
const executiveExceptionOutput = execFileSync(
  process.execPath,
  [scriptPath, "--pmo-report", fixturePath, "--pmo-report-type", "executive_exception", "--json", "--allow-sample"],
  { encoding: "utf8" }
);
const executiveException = JSON.parse(executiveExceptionOutput);
assert.equal(executiveException.reportType, "executive_exception");
assert.equal(Array.isArray(executiveException.rows), true);
assert.equal(Array.isArray(executiveException.dataGaps), true);
const statusSuggestionOutput = execFileSync(
  process.execPath,
  [scriptPath, "--status-suggestion-report", fixturePath, "--today", "2026-05-13", "--json", "--allow-sample"],
  { encoding: "utf8" }
);
const statusSuggestion = JSON.parse(statusSuggestionOutput);
assert.equal(statusSuggestion.reportType, "status_suggestion");
assert.equal(statusSuggestion.summary.canAutoSave, false);
assert.equal(statusSuggestion.rows.some((row) => row.proposedStatusText && row.requiresReview), true);
assert.equal(statusSuggestion.rows.some((row) => row.statusType === "critical_escalation"), true);
assert.throws(
  () => execFileSync(process.execPath, [scriptPath, "--board-pack", fixturePath, "--json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }),
  /Sample or synthetic project data is not accepted for production runs/
);
const boardPackOutput = execFileSync(
  process.execPath,
  [scriptPath, "--board-pack", fixturePath, "--today", "2026-05-13", "--json", "--allow-sample"],
  { encoding: "utf8" }
);
const boardPack = JSON.parse(boardPackOutput);
assert.equal(boardPack.packType, "full_board_pack");
assert.equal(boardPack.source, "offline_reviewed_snapshot");
assert.equal(boardPack.safety.canAutoSave, false);
assert.equal(Array.isArray(boardPack.executive.topRisks), true);
assert.equal(Array.isArray(boardPack.pmo.workQueue), true);
assert.equal(Array.isArray(boardPack.projectLeader.statusSuggestions), true);
assert.equal(boardPack.logicAssurance.checks.length, 15);

const suiteJsonOutput = execFileSync(
  process.execPath,
  [scriptPath, "--pmo-suite", fixturePath, "--json", "--allow-sample"],
  { encoding: "utf8" }
);
const suiteJson = JSON.parse(suiteJsonOutput);
assert.equal(suiteJson.summary.reportCount, 12);
assert.equal(suiteJson.reports.map((report) => report.reportType).includes("audit_writeback_safety"), true);

const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "tpg-pmo-report-"));
const reviewedSnapshotPath = path.join(outputDir, "reviewed-d365-snapshot.json");
fs.writeFileSync(reviewedSnapshotPath, JSON.stringify({
  exportType: "tpg_pmo_project_export",
  version: "1.0",
  source: "dataverse_web_api",
  generatedAt: "2026-06-08T10:00:00.000Z",
  organizationUrl: "https://posp365.crm4.dynamics.com",
  projects: JSON.parse(fs.readFileSync(fixturePath, "utf8")),
}), "utf8");
assert.throws(
  () => execFileSync(process.execPath, [scriptPath, "--pmo-suite", reviewedSnapshotPath, "--json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }),
  /offline fallback only/
);
const dataverseSuiteOutput = execFileSync(
  process.execPath,
  [scriptPath, "--pmo-suite", reviewedSnapshotPath, "--json", "--allow-offline-input"],
  { encoding: "utf8" }
);
const dataverseSuiteJson = JSON.parse(dataverseSuiteOutput);
assert.equal(dataverseSuiteJson.summary.reportCount, 12);
assert.equal(dataverseSuiteJson.summary.projectsReviewed, 2);
const monthlyStatusOutput = execFileSync(
  process.execPath,
  [
    scriptPath,
    "--monthly-status-plan",
    reviewedSnapshotPath,
    "--month",
    "2026-06",
    "--status-text",
    "kv",
    "--project-manager-verified",
    "--reviewed",
    "--json",
    "--allow-offline-input",
  ],
  { encoding: "utf8" }
);
const monthlyStatusJson = JSON.parse(monthlyStatusOutput);
assert.equal(monthlyStatusJson.reportType, "monthly_status_writeback");
assert.equal(monthlyStatusJson.reportMonth, "2026-06");
assert.equal(monthlyStatusJson.summary.draftsReady, 2);
assert.equal(monthlyStatusJson.summary.canAutoSave, false);
assert.match(monthlyStatusJson.reports[0].writeback.confirmationText, /CONFIRM MONTHLY STATUS WRITEBACK/);
const docxPath = path.join(outputDir, "pmo-status.docx");
const xlsxPath = path.join(outputDir, "pmo-status.xlsx");
const suiteDocxPath = path.join(outputDir, "pmo-suite.docx");
const suiteXlsxPath = path.join(outputDir, "pmo-suite.xlsx");
const suggestionDocxPath = path.join(outputDir, "status-suggestions.docx");
const suggestionXlsxPath = path.join(outputDir, "status-suggestions.xlsx");
const boardDocxPath = path.join(outputDir, "board-pack.docx");
const boardXlsxPath = path.join(outputDir, "board-pack.xlsx");
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
const suiteFileOutput = execFileSync(
  process.execPath,
  [
    scriptPath,
    "--pmo-suite",
    fixturePath,
    "--docx",
    suiteDocxPath,
    "--xlsx",
    suiteXlsxPath,
    "--json",
    "--allow-sample",
  ],
  { encoding: "utf8" }
);
const suiteFileJson = JSON.parse(suiteFileOutput);
assert.equal(fs.existsSync(suiteDocxPath), true);
assert.equal(fs.existsSync(suiteXlsxPath), true);
assert.equal(suiteFileJson.writtenFiles.docx, path.resolve(suiteDocxPath));
assert.equal(suiteFileJson.writtenFiles.xlsx, path.resolve(suiteXlsxPath));
const suggestionFileOutput = execFileSync(
  process.execPath,
  [
    scriptPath,
    "--status-suggestion-report",
    fixturePath,
    "--docx",
    suggestionDocxPath,
    "--xlsx",
    suggestionXlsxPath,
    "--json",
    "--allow-sample",
  ],
  { encoding: "utf8" }
);
const suggestionFileJson = JSON.parse(suggestionFileOutput);
assert.equal(fs.existsSync(suggestionDocxPath), true);
assert.equal(fs.existsSync(suggestionXlsxPath), true);
assert.equal(suggestionFileJson.writtenFiles.docx, path.resolve(suggestionDocxPath));
assert.equal(suggestionFileJson.writtenFiles.xlsx, path.resolve(suggestionXlsxPath));
const boardPackFileOutput = execFileSync(
  process.execPath,
  [
    scriptPath,
    "--board-pack",
    fixturePath,
    "--today",
    "2026-05-13",
    "--docx",
    boardDocxPath,
    "--json",
    "--allow-sample",
  ],
  { encoding: "utf8" }
);
const boardPackFileJson = JSON.parse(boardPackFileOutput);
assert.equal(fs.existsSync(boardDocxPath), true);
assert.equal(boardPackFileJson.writtenFiles.docx, path.resolve(boardDocxPath));
const boardPackXlsxOutput = execFileSync(
  process.execPath,
  [
    scriptPath,
    "--board-pack",
    fixturePath,
    "--today",
    "2026-05-13",
    "--xlsx",
    boardXlsxPath,
    "--json",
    "--allow-sample",
  ],
  { encoding: "utf8" }
);
const boardPackXlsxJson = JSON.parse(boardPackXlsxOutput);
assert.equal(fs.existsSync(boardXlsxPath), true);
assert.equal(boardPackXlsxJson.writtenFiles.xlsx, path.resolve(boardXlsxPath));
assert.deepEqual([...fs.readFileSync(docxPath).subarray(0, 2)].map((byte) => String.fromCharCode(byte)).join(""), "PK");
assert.deepEqual([...fs.readFileSync(xlsxPath).subarray(0, 2)].map((byte) => String.fromCharCode(byte)).join(""), "PK");
assert.equal(pmoFileJson.writtenFiles.docx, path.resolve(docxPath));
assert.equal(pmoFileJson.writtenFiles.xlsx, path.resolve(xlsxPath));

Promise.all([
  JSZip.loadAsync(fs.readFileSync(docxPath)),
  JSZip.loadAsync(fs.readFileSync(xlsxPath)),
  JSZip.loadAsync(fs.readFileSync(boardDocxPath)),
  JSZip.loadAsync(fs.readFileSync(boardXlsxPath)),
]).then(async ([docxZip, xlsxZip, boardDocxZip, boardXlsxZip]) => {
  const docXml = await docxZip.file("word/document.xml").async("string");
  const boardDocXml = await boardDocxZip.file("word/document.xml").async("string");
  const sheetXml = await xlsxZip.file("xl/worksheets/sheet3.xml").async("string");
  const sheetRelsXml = await xlsxZip.file("xl/worksheets/_rels/sheet3.xml.rels").async("string");
  const stylesXml = await xlsxZip.file("xl/styles.xml").async("string");
  const boardWorkbookXml = await boardXlsxZip.file("xl/workbook.xml").async("string");
  const boardProjectLinksXml = await boardXlsxZip.file("xl/worksheets/sheet8.xml").async("string");
  const boardProjectLinksRels = await boardXlsxZip.file("xl/worksheets/_rels/sheet8.xml.rels").async("string");
  assert.match(docXml, /PMO Executive Status Report/);
  assert.match(docXml, /Executive attention/);
  assert.match(docXml, /Filter Scope/);
  assert.match(docXml, /Status Legend/);
  assert.match(docXml, /Project Spotlight/);
  assert.equal((docXml.match(/w:shd/g) || []).length >= 12, true);
  assert.match(docXml, /w:shd/);
  assert.match(boardDocXml, /Full Board Pack/);
  assert.match(boardDocXml, /Executive Summary/);
  assert.match(boardDocXml, /PMO Work Queue/);
  assert.match(boardDocXml, /Status Suggestions/);
  assert.match(boardDocXml, /Evidence And Data Gaps/);
  assert.match(boardDocXml, /Logic Assurance/);
  assert.match(boardWorkbookXml, /Executive Dashboard/);
  assert.match(boardWorkbookXml, /PMO Control/);
  assert.match(boardWorkbookXml, /Project Leader Queue/);
  assert.match(boardWorkbookXml, /Steering Agenda/);
  assert.match(boardWorkbookXml, /Risks/);
  assert.match(boardWorkbookXml, /Decisions/);
  assert.match(boardWorkbookXml, /Status Suggestions/);
  assert.match(boardWorkbookXml, /Project Links/);
  assert.match(boardWorkbookXml, /Evidence/);
  assert.match(boardWorkbookXml, /Data Gaps/);
  assert.match(boardWorkbookXml, /Logic Assurance/);
  assert.match(boardProjectLinksXml, /Open Project/);
  assert.match(boardProjectLinksXml, /<hyperlinks>/);
  assert.match(boardProjectLinksRels, /TargetMode="External"/);
  assert.match(sheetXml, /<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"\/>/);
  assert.match(sheetXml, /autoFilter ref="A1:J3"/);
  assert.match(sheetXml, /Project Link/);
  assert.match(sheetXml, /Open Project/);
  assert.match(sheetXml, /<hyperlinks>/);
  assert.match(sheetXml, /<hyperlink ref="J2" r:id="rId1"\/>/);
  assert.match(sheetRelsXml, /TargetMode="External"/);
  assert.match(sheetRelsXml, /tpg_project/);
  assert.match(stylesXml, /FF0563C1/);
  assert.match(stylesXml, /FF1F4E79/);
}).then(() => {
  console.log("statusbericht cli tests passed");
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
