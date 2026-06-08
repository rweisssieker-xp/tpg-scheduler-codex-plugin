"use strict";

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

function git(args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
}

function fileExists(relativePath) {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function buildReleaseManifest(options = {}) {
  const pkg = readJson("plugins/tpg-scheduler-codex-plugin/package.json");
  const plugin = readJson("plugins/tpg-scheduler-codex-plugin/.codex-plugin/plugin.json");
  const head = git(["rev-parse", "HEAD"]);
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  const trackedFiles = git(["ls-files"]).split(/\r?\n/).filter(Boolean);
  const schemaFiles = trackedFiles.filter((file) => file.startsWith("schemas/") && file.endsWith(".schema.json"));
  const exampleFiles = trackedFiles.filter((file) => file.startsWith("examples/"));
  const skillFiles = trackedFiles.filter((file) => file.endsWith("/SKILL.md") || file.startsWith("skills/"));
  const workflowFiles = trackedFiles.filter((file) => file.startsWith(".github/workflows/"));
  const docs = [
    "README.md",
    "docs/USAGE.md",
    "docs/ARCHITECTURE.md",
    "docs/DYNAMICS_E2E_RUNBOOK.md",
    "docs/VALIDATION.md",
    "docs/EXAMPLES.md",
    "docs/SCHEMA.md",
    "docs/RELEASE.md",
    "docs/PUBLICATION.md",
    "docs/PRIVACY.md",
    "SECURITY.md",
    "CHANGELOG.md",
  ];
  return {
    manifestType: "tpg_scheduler_release_evidence",
    version: "1.0",
    generatedAt: options.generatedAt || new Date().toISOString(),
    repository: pkg.repository.url.replace(/\.git$/, ""),
    package: {
      name: pkg.name,
      version: pkg.version,
      private: pkg.private,
      license: pkg.license,
    },
    plugin: {
      name: plugin.name,
      displayName: plugin.interface?.displayName || null,
      skillsPath: plugin.skills,
      apps: plugin.apps,
      mcpServers: plugin.mcpServers,
    },
    git: {
      branch,
      head,
      shortHead: head.slice(0, 7),
      cleanWorkingTreeRequired: true,
    },
    safetyPosture: {
      confirmationGatedCrmWrites: true,
      nodeWritesCrmData: false,
      directBrowserCreateRequiresExactConfirmation: true,
      productiveSampleDataBlocked: true,
      generatedReportsIgnored: true,
    },
    checks: [
      "npm test",
      "npm run validate",
      "npm run release:check",
      "npm audit --audit-level=moderate",
      "GitHub Actions CI on main",
      "Dynamics E2E smoke test before release tags",
    ],
    workflows: workflowFiles,
    schemas: schemaFiles,
    examples: exampleFiles,
    skills: skillFiles,
    documentation: docs.map((file) => ({ file, present: fileExists(file) })),
    releaseArtifacts: {
      validationWorkflow: ".github/workflows/release.yml",
      githubSourceArchive: true,
      automaticCrmInstaller: false,
      includesStatusApiSchemas: schemaFiles.some((file) => file.includes("status-")),
      includesSyntheticExamplesOnly: true,
    },
  };
}

if (require.main === module) {
  console.log(JSON.stringify(buildReleaseManifest(), null, 2));
}

module.exports = {
  buildReleaseManifest,
};
