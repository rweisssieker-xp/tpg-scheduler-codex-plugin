# Full Board Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a D365 API-first Full Board Pack / Steering Pack that outputs management-ready JSON, Word, and Excel artifacts for Executive, PMO, and Project Leader audiences.

**Architecture:** Add a Board Pack builder in the existing project intelligence library and expose it through the existing CLI/browser helper file. Reuse existing Safety Gates, PMO Control Tower, PMO Reports, Status Suggestions, risk ledger, decision closure, evidence gaps, and Excel/Word writer patterns. Productive data is retrieved only through the authenticated Dynamics browser `Xrm.WebApi` helper; local file input remains explicit offline fallback.

**Tech Stack:** Node.js CommonJS, built-in `assert`, `fs`, `path`, `child_process`, `jszip`, `docx`, existing custom XLSX Open XML writer, Dynamics `Xrm.WebApi`.

---

## File Structure

- Modify `plugins/tpg-scheduler-codex-plugin/scripts/lib/project-intelligence.js`
  - Add `buildBoardPack(projects, options)`.
  - Add helper functions for executive, PMO, project leader, project spotlight, evidence ledger, data gaps, and source classification.
  - Include `boardPack` in `buildProjectIntelligence(...)`.
  - Export `buildBoardPack`.

- Modify `plugins/tpg-scheduler-codex-plugin/scripts/statusbericht.js`
  - Add browser snippet function `retrieveBoardPackFromD365(options)`.
  - Add CLI command `--board-pack`.
  - Add `writeBoardPackFiles(boardPack, { docxPath, xlsxPath })`.
  - Add `buildBoardPackDocxBuffer(boardPack)` and `buildBoardPackXlsxBuffer(boardPack)`.
  - Export `buildBoardPack`, `writeBoardPackFiles`, `buildBoardPackDocxBuffer`, and `buildBoardPackXlsxBuffer`.

- Modify `plugins/tpg-scheduler-codex-plugin/scripts/project-intelligence.test.js`
  - Add Board Pack unit tests.

- Modify `plugins/tpg-scheduler-codex-plugin/scripts/statusbericht.test.js`
  - Add export and browser snippet tests.

- Modify `plugins/tpg-scheduler-codex-plugin/scripts/statusbericht.cli.test.js`
  - Add CLI, DOCX, XLSX, and hyperlink tests.

- Modify `plugins/tpg-scheduler-codex-plugin/scripts/validate-plugin.js`
  - Add validation anchors for Board Pack schema, docs, and skill guidance.

- Create `schemas/board-pack.schema.json`
  - Define the public Board Pack JSON contract.

- Modify `schemas/project-intelligence.schema.json`
  - Add `boardPack` property.

- Modify `examples/project-intelligence.sample.json`
  - Add compact `boardPack` sample.

- Create `examples/board-pack.sample.json`
  - Add documentation-only synthetic Board Pack sample.

- Modify documentation:
  - `README.md`
  - `docs/ARCHITECTURE.md`
  - `docs/USAGE.md`
  - `docs/SCHEMA.md`
  - `docs/VALIDATION.md`
  - `docs/EXAMPLES.md`
  - `docs/RELEASE_NOTES_v0.1.0.md`

- Modify skills:
  - `plugins/tpg-scheduler-codex-plugin/skills/status-report/SKILL.md`
  - `plugins/tpg-scheduler-codex-plugin/skills/pmo-report-suite/SKILL.md`
  - `skills/status-report/SKILL.md`
  - `skills/pmo-report-suite/SKILL.md`

---

### Task 1: Board Pack Unit Contract

**Files:**
- Modify: `plugins/tpg-scheduler-codex-plugin/scripts/project-intelligence.test.js`
- Modify: `plugins/tpg-scheduler-codex-plugin/scripts/lib/project-intelligence.js`

- [ ] **Step 1: Write failing unit tests for `buildBoardPack`**

Add `buildBoardPack` to the destructuring import in `plugins/tpg-scheduler-codex-plugin/scripts/project-intelligence.test.js`:

```js
  buildBoardPack,
```

Add this test block after the existing `buildStatusSuggestionReport` assertions:

```js
const boardPack = buildBoardPack(projects, { today: "2026-05-13", source: "d365_api" });
assert.equal(boardPack.packType, "full_board_pack");
assert.equal(boardPack.source, "d365_api");
assert.equal(Boolean(boardPack.generatedAt), true);
assert.equal(Boolean(boardPack.executive), true);
assert.equal(Boolean(boardPack.pmo), true);
assert.equal(Boolean(boardPack.projectLeader), true);
assert.equal(Array.isArray(boardPack.steeringAgenda), true);
assert.equal(Array.isArray(boardPack.decisionLog), true);
assert.equal(Array.isArray(boardPack.riskRegister), true);
assert.equal(Array.isArray(boardPack.statusSuggestions), true);
assert.equal(Array.isArray(boardPack.projectSpotlights), true);
assert.equal(Array.isArray(boardPack.evidenceLedger), true);
assert.equal(Array.isArray(boardPack.dataGaps), true);
assert.equal(Array.isArray(boardPack.accessIssues), true);
assert.deepEqual(boardPack.safety, {
  advisoryOnly: true,
  canAutoSave: false,
  crmWritesIncluded: false,
});
assert.equal(boardPack.executive.summary.projectsReviewed, 2);
assert.equal(boardPack.projectLeader.statusSuggestions.length, 2);
assert.equal(boardPack.statusSuggestions.some((row) => row.statusType === "critical_escalation"), true);
assert.equal(buildProjectIntelligence(projects, { today: "2026-05-13" }).boardPack.packType, "full_board_pack");
```

- [ ] **Step 2: Run unit test to verify failure**

Run:

```powershell
node ./scripts/project-intelligence.test.js
```

Expected: failure similar to `ReferenceError: buildBoardPack is not defined` or `TypeError: buildBoardPack is not a function`.

- [ ] **Step 3: Implement `buildBoardPack` minimally**

In `plugins/tpg-scheduler-codex-plugin/scripts/lib/project-intelligence.js`, add these helpers after `buildStatusSuggestionReport(...)`:

```js
function compactBoardEvidence(projects = [], options = {}) {
  const risks = buildRiskLedgerEntries(projects, options).map((item) => ({
    evidenceType: "risk",
    projectId: item.projectId || null,
    name: item.name || null,
    code: item.evidenceCode || null,
    field: item.field || null,
    value: item.value ?? null,
    message: item.message || null,
    recordUrl: item.recordUrl || null,
  }));
  const gaps = buildEvidenceGapDetector(projects, options).items.flatMap((item) =>
    item.gaps.map((gap) => ({
      evidenceType: "data_gap",
      projectId: item.projectId || null,
      name: item.name || null,
      code: "data_gap",
      field: gap,
      value: null,
      message: `Missing evidence field: ${gap}`,
      recordUrl: item.recordUrl || null,
    }))
  );
  return [...risks, ...gaps];
}

function buildProjectSpotlights(projects = [], options = {}) {
  const safetyById = new Map(buildProjectSafetyGateSuite(projects, options).projects.map((item) => [item.projectId, item]));
  const pmoById = new Map(buildPmoControlTower(projects, options).projects.map((item) => [item.projectId, item]));
  return (projects || []).map((project) => {
    const projectId = project.projectId || project.id || null;
    const safety = safetyById.get(projectId) || {};
    const pmo = pmoById.get(projectId) || {};
    return {
      projectId,
      name: project.name || null,
      projectStatusLabel: project.projectStatusLabel || null,
      overallKpiLabel: project.overallKpiLabel || null,
      progress: project.progress ?? null,
      finish: project.finish || null,
      safetyLevel: safety.safetyLevel || null,
      managementAttention: safety.managementAttention || null,
      pmoLevel: pmo.pmoLevel || null,
      intervention: pmo.intervention || null,
      recordUrl: project.recordUrl || null,
    };
  });
}

function boardPackDataGap(project, field, message) {
  return {
    projectId: project?.projectId || project?.id || null,
    name: project?.name || null,
    field,
    message,
  };
}

function buildBoardPack(projects, options = {}) {
  const sourceProjects = projects || [];
  const today = options.today || new Date().toISOString().slice(0, 10);
  const safety = buildProjectSafetyGateSuite(sourceProjects, options);
  const pmoControl = buildPmoControlTower(sourceProjects, options);
  const statusSuggestionReport = buildStatusSuggestionReport(sourceProjects, options);
  const pmoSuite = buildPmoReportSuite(sourceProjects, options);
  const risks = buildRiskLedgerEntries(sourceProjects, options);
  const decisions = buildDecisionClosureItems(sourceProjects, options);
  const evidenceGaps = buildEvidenceGapDetector(sourceProjects, options);
  const executiveQuestions = buildExecutiveQuestionGenerator(sourceProjects, options);
  const noSurpriseForecast = buildNoSurpriseForecast(sourceProjects, options);
  const pmoUsps = buildPmoUspLayer(sourceProjects, options);
  const projectSpotlights = buildProjectSpotlights(sourceProjects, options);
  const missingRecordUrlGaps = sourceProjects
    .filter((project) => !project.recordUrl)
    .map((project) => boardPackDataGap(project, "recordUrl", "Project record URL is missing; Excel project hyperlink cannot be created."));
  const dataGaps = [
    ...evidenceGaps.items.flatMap((item) => item.gaps.map((gap) => boardPackDataGap(item, gap, `Missing evidence field: ${gap}`))),
    ...statusSuggestionReport.dataGaps,
    ...missingRecordUrlGaps,
    ...(options.statusMetadataResolved === false ? [boardPackDataGap(null, "statusUpdateMetadata", "Status Update metadata could not be resolved; status history is unavailable.")] : []),
  ];
  return {
    packType: "full_board_pack",
    source: options.source || "offline_reviewed_snapshot",
    generatedAt: options.generatedAt || new Date().toISOString(),
    today,
    executive: {
      summary: {
        projectsReviewed: sourceProjects.length,
        criticalProjects: safety.summary.criticalProjects,
        unsafeProjects: safety.summary.unsafeProjects,
        ceoAttention: safety.summary.ceoAttention,
        cioAttention: safety.summary.cioAttention,
        topRisks: risks.length,
        openDecisions: decisions.length,
      },
      topRisks: risks.slice(0, 10),
      topDecisions: decisions.slice(0, 10),
      questions: executiveQuestions.items || [],
      noSurpriseForecast,
    },
    pmo: {
      summary: pmoControl.summary,
      workQueue: pmoUsps.commandQueue || [],
      controlFindings: pmoControl.portfolioFindings || [],
      reportSuiteSummary: pmoSuite.summary,
    },
    projectLeader: {
      summary: statusSuggestionReport.summary,
      statusSuggestions: statusSuggestionReport.rows,
      queue: buildProjectNudges(sourceProjects, options),
    },
    steeringAgenda: buildSteeringAgenda(sourceProjects, options),
    decisionLog: decisions,
    riskRegister: risks,
    statusSuggestions: statusSuggestionReport.rows,
    projectSpotlights,
    evidenceLedger: compactBoardEvidence(sourceProjects, options),
    dataGaps,
    accessIssues: options.accessIssues || [],
    safety: {
      advisoryOnly: true,
      canAutoSave: false,
      crmWritesIncluded: false,
    },
  };
}
```

In `buildProjectIntelligence(...)`, add:

```js
    boardPack: buildBoardPack(projects, options),
```

In `module.exports`, add:

```js
  buildBoardPack,
```

- [ ] **Step 4: Run unit test to verify pass**

Run:

```powershell
node ./scripts/project-intelligence.test.js
```

Expected: `project intelligence tests passed`.

- [ ] **Step 5: Commit**

```powershell
git add plugins/tpg-scheduler-codex-plugin/scripts/lib/project-intelligence.js plugins/tpg-scheduler-codex-plugin/scripts/project-intelligence.test.js
git commit -m "Add board pack intelligence contract"
```

---

### Task 2: Browser Snippet And Public Exports

**Files:**
- Modify: `plugins/tpg-scheduler-codex-plugin/scripts/statusbericht.test.js`
- Modify: `plugins/tpg-scheduler-codex-plugin/scripts/statusbericht.js`

- [ ] **Step 1: Write failing tests for exports and D365 helper marker**

Add `buildBoardPack` to the destructuring import in `plugins/tpg-scheduler-codex-plugin/scripts/statusbericht.test.js`:

```js
  buildBoardPack,
```

Add these assertions near the existing browser snippet assertions:

```js
assert.match(getDataverseBrowserSnippet(), /retrieveBoardPackFromD365/);
assert.match(getDataverseBrowserSnippet(), /buildBoardPack/);
```

Add this type assertion near other `typeof` checks:

```js
assert.equal(typeof buildBoardPack, "function");
```

- [ ] **Step 2: Run test to verify failure**

Run:

```powershell
node ./scripts/statusbericht.test.js
```

Expected: failure because `retrieveBoardPackFromD365` or `buildBoardPack` is missing.

- [ ] **Step 3: Add browser helper**

In the browser snippet inside `plugins/tpg-scheduler-codex-plugin/scripts/statusbericht.js`, after `retrieveStatusSuggestionReportFromD365(options)`, add:

```js
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
```

Add these entries to `window.TPGProjectAssist`:

```js
    buildBoardPack,
    retrieveBoardPackFromD365,
```

In Node `module.exports`, add:

```js
  buildBoardPack: projectIntelligence.buildBoardPack,
```

- [ ] **Step 4: Run test to verify pass**

Run:

```powershell
node ./scripts/statusbericht.test.js
```

Expected: `statusbericht tests passed`.

- [ ] **Step 5: Commit**

```powershell
git add plugins/tpg-scheduler-codex-plugin/scripts/statusbericht.js plugins/tpg-scheduler-codex-plugin/scripts/statusbericht.test.js
git commit -m "Expose board pack D365 helper"
```

---

### Task 3: CLI Board Pack JSON Fallback

**Files:**
- Modify: `plugins/tpg-scheduler-codex-plugin/scripts/statusbericht.cli.test.js`
- Modify: `plugins/tpg-scheduler-codex-plugin/scripts/statusbericht.js`

- [ ] **Step 1: Write failing CLI tests**

In `plugins/tpg-scheduler-codex-plugin/scripts/statusbericht.cli.test.js`, after the status suggestion CLI test, add:

```js
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
```

- [ ] **Step 2: Run CLI test to verify failure**

Run:

```powershell
node ./scripts/statusbericht.cli.test.js
```

Expected: failure because `--board-pack` is not handled.

- [ ] **Step 3: Implement CLI command**

In `printHelp()` in `plugins/tpg-scheduler-codex-plugin/scripts/statusbericht.js`, add this under the Dataverse browser snippet examples:

```text
    await TPGProjectAssist.retrieveBoardPackFromD365({ today: "YYYY-MM-DD" })
```

Add this under PMO report help text:

```text
  Board Pack offline fallback:
    node ./scripts/statusbericht.js --board-pack <snapshot.json> --allow-offline-input --json
    node ./scripts/statusbericht.js --board-pack <snapshot.json> --allow-offline-input --docx reports/board-pack.docx --xlsx reports/board-pack.xlsx
```

Add this function before `formatMonthlyStatusReportRunMarkdown(...)`:

```js
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
```

Add this markdown formatter before `printBoardPack()`:

```js
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
```

Add this branch in `main()` before `--pmo-suite`:

```js
    } else if (process.argv.includes("--board-pack")) {
      await printBoardPack();
```

- [ ] **Step 4: Temporarily stub file writer**

Add this temporary function near `writePmoReportFiles(...)`:

```js
async function writeBoardPackFiles(boardPack, options = {}) {
  const writtenFiles = {};
  if (options.docxPath || options.xlsxPath) {
    throw new Error("Board Pack DOCX/XLSX writing is not implemented yet.");
  }
  return writtenFiles;
}
```

Add this export:

```js
  writeBoardPackFiles,
```

- [ ] **Step 5: Run CLI test to verify JSON pass**

Run:

```powershell
node ./scripts/statusbericht.cli.test.js
```

Expected: test progresses past Board Pack JSON assertions. It may still pass fully because file output is not requested in this new test.

- [ ] **Step 6: Commit**

```powershell
git add plugins/tpg-scheduler-codex-plugin/scripts/statusbericht.js plugins/tpg-scheduler-codex-plugin/scripts/statusbericht.cli.test.js
git commit -m "Add board pack CLI JSON output"
```

---

### Task 4: Board Pack DOCX Output

**Files:**
- Modify: `plugins/tpg-scheduler-codex-plugin/scripts/statusbericht.cli.test.js`
- Modify: `plugins/tpg-scheduler-codex-plugin/scripts/statusbericht.test.js`
- Modify: `plugins/tpg-scheduler-codex-plugin/scripts/statusbericht.js`

- [ ] **Step 1: Write failing DOCX tests**

In `plugins/tpg-scheduler-codex-plugin/scripts/statusbericht.test.js`, add `buildBoardPackDocxBuffer` to imports and type checks:

```js
  buildBoardPackDocxBuffer,
```

```js
assert.equal(typeof buildBoardPackDocxBuffer, "function");
```

In `plugins/tpg-scheduler-codex-plugin/scripts/statusbericht.cli.test.js`, after the existing `suggestionXlsxPath`, add:

```js
const boardDocxPath = path.join(outputDir, "board-pack.docx");
const boardXlsxPath = path.join(outputDir, "board-pack.xlsx");
```

After the suggestion file assertions, add:

```js
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
```

Inside the `Promise.all([...])` ZIP validation block, add a third `JSZip.loadAsync` for the Board Pack DOCX:

```js
  JSZip.loadAsync(fs.readFileSync(boardDocxPath)),
```

Update the `.then` signature to:

```js
]).then(async ([docxZip, xlsxZip, boardDocxZip]) => {
```

Add:

```js
  const boardDocXml = await boardDocxZip.file("word/document.xml").async("string");
  assert.match(boardDocXml, /Full Board Pack/);
  assert.match(boardDocXml, /Executive Summary/);
  assert.match(boardDocXml, /PMO Work Queue/);
  assert.match(boardDocXml, /Status Suggestions/);
  assert.match(boardDocXml, /Evidence And Data Gaps/);
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
node ./scripts/statusbericht.test.js
node ./scripts/statusbericht.cli.test.js
```

Expected: failure because `buildBoardPackDocxBuffer` or DOCX writing is missing.

- [ ] **Step 3: Implement DOCX buffer**

In `plugins/tpg-scheduler-codex-plugin/scripts/statusbericht.js`, add this function after `buildPmoStatusReportDocxBuffer(...)`:

```js
async function buildBoardPackDocxBuffer(boardPack) {
  const executiveRows = Object.entries(boardPack.executive.summary || {}).map(([Metric, Value]) => ({
    Metric,
    Value: typeof Value === "object" ? JSON.stringify(Value) : Value,
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
      ],
    }],
  });
  return Packer.toBuffer(document);
}
```

- [ ] **Step 4: Wire DOCX writing**

Replace the temporary `writeBoardPackFiles(...)` with:

```js
async function writeBoardPackFiles(boardPack, options = {}) {
  const writtenFiles = {};
  if (options.docxPath) {
    ensureParentDirectory(options.docxPath);
    fs.writeFileSync(options.docxPath, await buildBoardPackDocxBuffer(boardPack));
    writtenFiles.docx = path.resolve(options.docxPath);
  }
  if (options.xlsxPath) {
    throw new Error("Board Pack XLSX writing is not implemented yet.");
  }
  return writtenFiles;
}
```

Add exports:

```js
  buildBoardPackDocxBuffer,
```

- [ ] **Step 5: Run tests to verify DOCX pass**

Run:

```powershell
node ./scripts/statusbericht.test.js
node ./scripts/statusbericht.cli.test.js
```

Expected: both pass, unless XLSX was requested by an existing test.

- [ ] **Step 6: Commit**

```powershell
git add plugins/tpg-scheduler-codex-plugin/scripts/statusbericht.js plugins/tpg-scheduler-codex-plugin/scripts/statusbericht.test.js plugins/tpg-scheduler-codex-plugin/scripts/statusbericht.cli.test.js
git commit -m "Add board pack Word output"
```

---

### Task 5: Board Pack XLSX Output With Audience Sheets And Hyperlinks

**Files:**
- Modify: `plugins/tpg-scheduler-codex-plugin/scripts/statusbericht.cli.test.js`
- Modify: `plugins/tpg-scheduler-codex-plugin/scripts/statusbericht.test.js`
- Modify: `plugins/tpg-scheduler-codex-plugin/scripts/statusbericht.js`

- [ ] **Step 1: Write failing XLSX tests**

In `plugins/tpg-scheduler-codex-plugin/scripts/statusbericht.test.js`, add `buildBoardPackXlsxBuffer` to imports and type checks:

```js
  buildBoardPackXlsxBuffer,
```

```js
assert.equal(typeof buildBoardPackXlsxBuffer, "function");
```

In `plugins/tpg-scheduler-codex-plugin/scripts/statusbericht.cli.test.js`, after the Board Pack DOCX CLI assertion, add:

```js
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
```

Add `JSZip.loadAsync(fs.readFileSync(boardXlsxPath))` to the Promise list and update the signature:

```js
]).then(async ([docxZip, xlsxZip, boardDocxZip, boardXlsxZip]) => {
```

Add:

```js
  const boardWorkbookXml = await boardXlsxZip.file("xl/workbook.xml").async("string");
  const boardProjectLinksXml = await boardXlsxZip.file("xl/worksheets/sheet8.xml").async("string");
  const boardProjectLinksRels = await boardXlsxZip.file("xl/worksheets/_rels/sheet8.xml.rels").async("string");
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
  assert.match(boardProjectLinksXml, /Open Project/);
  assert.match(boardProjectLinksXml, /<hyperlinks>/);
  assert.match(boardProjectLinksRels, /TargetMode="External"/);
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```powershell
node ./scripts/statusbericht.test.js
node ./scripts/statusbericht.cli.test.js
```

Expected: failure because Board Pack XLSX writing is missing.

- [ ] **Step 3: Add workbook helper functions**

In `plugins/tpg-scheduler-codex-plugin/scripts/statusbericht.js`, add this helper near `objectRows(...)`:

```js
function rowsFromObjects(headers, rows) {
  return [headers, ...(rows || []).map((row) => headers.map((header) => row[header] ?? ""))];
}
```

Add this function after `buildPmoStatusReportXlsxBuffer(...)`:

```js
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
```

Extract the existing `styles.xml` string into a helper so both PMO XLSX and Board Pack XLSX can use it:

```js
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
```

Replace the existing inline `zip.folder("xl").file("styles.xml", \`...\`)` call in `buildPmoStatusReportXlsxBuffer(...)` with:

```js
  zip.folder("xl").file("styles.xml", buildWorkbookStylesXml());
```

- [ ] **Step 4: Wire XLSX writing**

Update `writeBoardPackFiles(...)`:

```js
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
```

Add export:

```js
  buildBoardPackXlsxBuffer,
```

- [ ] **Step 5: Run tests to verify pass**

Run:

```powershell
node ./scripts/statusbericht.test.js
node ./scripts/statusbericht.cli.test.js
```

Expected: both pass.

- [ ] **Step 6: Commit**

```powershell
git add plugins/tpg-scheduler-codex-plugin/scripts/statusbericht.js plugins/tpg-scheduler-codex-plugin/scripts/statusbericht.test.js plugins/tpg-scheduler-codex-plugin/scripts/statusbericht.cli.test.js
git commit -m "Add board pack Excel workbook"
```

---

### Task 6: Schemas And Examples

**Files:**
- Create: `schemas/board-pack.schema.json`
- Modify: `schemas/project-intelligence.schema.json`
- Create: `examples/board-pack.sample.json`
- Modify: `examples/project-intelligence.sample.json`
- Modify: `plugins/tpg-scheduler-codex-plugin/scripts/validate-plugin.js`

- [ ] **Step 1: Write failing validation anchors**

In `plugins/tpg-scheduler-codex-plugin/scripts/validate-plugin.js`, add `schemas/board-pack.schema.json` to the `requiredDocs` list:

```js
  "schemas/board-pack.schema.json",
```

Add it to the schema parsing loop:

```js
  "schemas/board-pack.schema.json",
```

After the `statusApiSample` assertions, add:

```js
const boardPackSchema = JSON.parse(assertFile("schemas/board-pack.schema.json"));
assert.equal(boardPackSchema.properties.packType.const, "full_board_pack", "board pack schema must define packType");
const boardPackSample = JSON.parse(assertFile("examples/board-pack.sample.json"));
assert.equal(boardPackSample.packType, "full_board_pack", "board pack sample must use full_board_pack");
assert.equal(boardPackSample.safety.canAutoSave, false, "board pack sample must be review-only");
assert.equal(Boolean(intelligenceSchema.properties.boardPack), true, "project intelligence schema must include boardPack");
```

- [ ] **Step 2: Run validation to verify failure**

Run:

```powershell
npm run validate
```

Expected: failure because schema/sample do not exist.

- [ ] **Step 3: Add Board Pack schema**

Create `schemas/board-pack.schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://github.com/rweisssieker-xp/tpg-scheduler-codex-plugin/schemas/board-pack.schema.json",
  "title": "Full Board Pack",
  "type": "object",
  "required": ["packType", "source", "generatedAt", "executive", "pmo", "projectLeader", "steeringAgenda", "decisionLog", "riskRegister", "statusSuggestions", "projectSpotlights", "evidenceLedger", "dataGaps", "accessIssues", "safety"],
  "additionalProperties": true,
  "properties": {
    "packType": { "const": "full_board_pack" },
    "source": { "type": "string" },
    "generatedAt": { "type": "string" },
    "executive": { "type": "object", "additionalProperties": true },
    "pmo": { "type": "object", "additionalProperties": true },
    "projectLeader": { "type": "object", "additionalProperties": true },
    "steeringAgenda": { "type": "array" },
    "decisionLog": { "type": "array" },
    "riskRegister": { "type": "array" },
    "statusSuggestions": { "type": "array" },
    "projectSpotlights": { "type": "array" },
    "evidenceLedger": { "type": "array" },
    "dataGaps": { "type": "array" },
    "accessIssues": { "type": "array" },
    "safety": {
      "type": "object",
      "required": ["advisoryOnly", "canAutoSave", "crmWritesIncluded"],
      "additionalProperties": true,
      "properties": {
        "advisoryOnly": { "const": true },
        "canAutoSave": { "const": false },
        "crmWritesIncluded": { "const": false }
      }
    }
  }
}
```

- [ ] **Step 4: Update project intelligence schema**

In `schemas/project-intelligence.schema.json`, add:

```json
    "boardPack": {
      "type": "object",
      "required": ["packType", "source", "executive", "pmo", "projectLeader", "safety"],
      "additionalProperties": true,
      "properties": {
        "packType": { "const": "full_board_pack" }
      }
    },
```

- [ ] **Step 5: Add Board Pack sample**

Create `examples/board-pack.sample.json`:

```json
{
  "packType": "full_board_pack",
  "source": "offline_reviewed_snapshot",
  "generatedAt": "2026-06-09T00:00:00.000Z",
  "today": "2026-06-09",
  "executive": {
    "summary": {
      "projectsReviewed": 2,
      "criticalProjects": 1,
      "unsafeProjects": 0,
      "ceoAttention": 0,
      "cioAttention": 1,
      "topRisks": 1,
      "openDecisions": 1
    },
    "topRisks": [],
    "topDecisions": [],
    "questions": [],
    "noSurpriseForecast": { "summary": { "items": 0 }, "items": [] }
  },
  "pmo": {
    "summary": { "projectsReviewed": 2, "checksPerProject": 25 },
    "workQueue": [],
    "controlFindings": [],
    "reportSuiteSummary": { "reportCount": 12 }
  },
  "projectLeader": {
    "summary": { "draftSuggestions": 2, "canAutoSave": false },
    "statusSuggestions": [],
    "queue": []
  },
  "steeringAgenda": [],
  "decisionLog": [],
  "riskRegister": [],
  "statusSuggestions": [],
  "projectSpotlights": [],
  "evidenceLedger": [],
  "dataGaps": [],
  "accessIssues": [],
  "safety": {
    "advisoryOnly": true,
    "canAutoSave": false,
    "crmWritesIncluded": false
  }
}
```

In `examples/project-intelligence.sample.json`, add a compact `boardPack` object with the same top-level shape and `safety.canAutoSave: false`.

- [ ] **Step 6: Run validation**

Run:

```powershell
npm run validate
```

Expected: `plugin validation passed`.

- [ ] **Step 7: Commit**

```powershell
git add schemas/board-pack.schema.json schemas/project-intelligence.schema.json examples/board-pack.sample.json examples/project-intelligence.sample.json plugins/tpg-scheduler-codex-plugin/scripts/validate-plugin.js
git commit -m "Add board pack schema and samples"
```

---

### Task 7: Documentation And Skills

**Files:**
- Modify: `README.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/USAGE.md`
- Modify: `docs/SCHEMA.md`
- Modify: `docs/VALIDATION.md`
- Modify: `docs/EXAMPLES.md`
- Modify: `docs/RELEASE_NOTES_v0.1.0.md`
- Modify: `plugins/tpg-scheduler-codex-plugin/skills/status-report/SKILL.md`
- Modify: `plugins/tpg-scheduler-codex-plugin/skills/pmo-report-suite/SKILL.md`
- Modify: `skills/status-report/SKILL.md`
- Modify: `skills/pmo-report-suite/SKILL.md`
- Modify: `plugins/tpg-scheduler-codex-plugin/scripts/validate-plugin.js`

- [ ] **Step 1: Add validation anchors**

In `plugins/tpg-scheduler-codex-plugin/scripts/validate-plugin.js`, add assertions:

```js
assert.match(publicDocs, /Full Board Pack|Steering Pack/, "public docs must document Board Pack");
assert.match(publicDocs, /retrieveBoardPackFromD365/, "public docs must document retrieveBoardPackFromD365");
assert.match(skill, /retrieveBoardPackFromD365/);
assert.match(pmoSkill, /retrieveBoardPackFromD365/);
assert.match(rootPmoSkill, /retrieveBoardPackFromD365/);
```

- [ ] **Step 2: Run validation to verify failure**

Run:

```powershell
npm run validate
```

Expected: failure until docs and skills are updated.

- [ ] **Step 3: Update README**

Add bullet under AI/KI Differentiators:

```markdown
- Full Board Pack / Steering Pack: creates D365 API-first JSON, Word, and Excel management packs for Executive, PMO, and Project Leader audiences with steering agenda, risks, decisions, status suggestions, evidence, data gaps, and project hyperlinks.
```

Add Quick Start line:

```js
await TPGProjectAssist.retrieveBoardPackFromD365({ today: "YYYY-MM-DD" })
```

- [ ] **Step 4: Update docs**

Add this section to `docs/USAGE.md`:

```markdown
## Full Board Pack / Steering Pack

Use the live D365 API helper for productive management packs:

```powershell
await TPGProjectAssist.retrieveBoardPackFromD365({ today: "2026-06-09" })
```

The output contains `executive`, `pmo`, and `projectLeader` sections plus steering agenda, decision log, risk register, status suggestions, project spotlights, evidence ledger, data gaps, and safety flags. The pack is advisory-only and declares `canAutoSave: false`.

Offline fallback for reviewed local snapshots:

```powershell
node ./scripts/statusbericht.js --board-pack <snapshot.json> --allow-offline-input --json
node ./scripts/statusbericht.js --board-pack <snapshot.json> --allow-offline-input --docx reports/board-pack.docx --xlsx reports/board-pack.xlsx
```
```

Add matching concise sections to:

- `docs/ARCHITECTURE.md`: Board Pack layer and D365 API-first production path.
- `docs/SCHEMA.md`: `schemas/board-pack.schema.json`.
- `docs/VALIDATION.md`: Board Pack tests.
- `docs/EXAMPLES.md`: CLI fallback examples.
- `docs/RELEASE_NOTES_v0.1.0.md`: post-release Board Pack note.

- [ ] **Step 5: Update skills**

In both `status-report` skill files, add:

```markdown
- For productive Board Packs or Steering Packs, use `TPGProjectAssist.retrieveBoardPackFromD365({ today })`; do not use file snapshots as the normal data path.
```

In both `pmo-report-suite` skill files, add:

```markdown
- For CIO/CEO/PMO management packets, prefer `TPGProjectAssist.retrieveBoardPackFromD365({ today })` because it combines Executive, PMO, Project Leader, evidence, data gaps, DOCX, XLSX, and JSON outputs.
```

- [ ] **Step 6: Run validation**

Run:

```powershell
npm run validate
```

Expected: `plugin validation passed`.

- [ ] **Step 7: Commit**

```powershell
git add README.md docs/ARCHITECTURE.md docs/USAGE.md docs/SCHEMA.md docs/VALIDATION.md docs/EXAMPLES.md docs/RELEASE_NOTES_v0.1.0.md plugins/tpg-scheduler-codex-plugin/skills/status-report/SKILL.md plugins/tpg-scheduler-codex-plugin/skills/pmo-report-suite/SKILL.md skills/status-report/SKILL.md skills/pmo-report-suite/SKILL.md plugins/tpg-scheduler-codex-plugin/scripts/validate-plugin.js
git commit -m "Document board pack workflow"
```

---

### Task 8: Full Validation, Release Notes, Push

**Files:**
- No functional files unless a previous task reveals a defect.

- [ ] **Step 1: Run full local validation**

Run:

```powershell
npm test
npm run validate
npm run release:check
npm run release:manifest
npm audit --audit-level=moderate
```

Expected:

- `statusbericht tests passed`
- `project intelligence tests passed`
- `statusbericht cli tests passed`
- `plugin validation passed`
- `release readiness checks passed`
- `found 0 vulnerabilities`

- [ ] **Step 2: Inspect git diff and status**

Run:

```powershell
git status --short --branch
git log --oneline -8
```

Expected: working tree clean after all task commits, branch ahead of `origin/main`.

- [ ] **Step 3: Push commits**

Run:

```powershell
git push origin main
```

Expected: push succeeds.

- [ ] **Step 4: Update GitHub release notes**

Run:

```powershell
gh release edit v0.1.0 --notes-file docs/RELEASE_NOTES_v0.1.0.md
```

Expected: command prints the release URL.

- [ ] **Step 5: Watch CI**

Run:

```powershell
gh run list --branch main --limit 3 --json databaseId,headSha,status,conclusion,workflowName,createdAt
```

Find the run for the pushed commit, then:

```powershell
gh run watch <databaseId> --exit-status
```

Expected: CI completes with `success`.
