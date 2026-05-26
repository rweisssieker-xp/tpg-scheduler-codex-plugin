# Architecture

## Overview

The plugin separates browser workflow guidance from deterministic project intelligence logic.

- The skill file describes how Codex should operate inside the in-app Browser.
- `scripts/statusbericht.js` exposes CLI commands, Dataverse helper snippets, URL builders, and public exports.
- `scripts/lib/project-intelligence.js` contains pure functions for risk, decision, governance, and AI/KI intelligence features.
- Tests validate normalization, CLI behavior, and project intelligence outputs without requiring Dynamics access.
- `scripts/validate-plugin.js` validates plugin metadata, documentation presence, skill naming, and write-safety wording.
- `assets/icon.svg` provides a lightweight public plugin asset for repository and marketplace use.

## Core Modules

### Skill

`plugins/tpg-scheduler-codex-plugin/skills/status-report/SKILL.md` is the operating guide for Codex. It defines safety gates, Dynamics navigation rules, Dataverse read preferences, and write-confirmation requirements.

### CLI And Browser Snippet

`scripts/statusbericht.js` provides:

- offline intelligence commands
- Dataverse browser-context snippet generation
- Dynamics URL builders
- status update draft helpers
- public exports for project intelligence functions
- plugin validation checks

### Project Intelligence

`scripts/lib/project-intelligence.js` provides evidence-backed helper functions, including:

- risk and status quality evaluation
- decision closure and SLA tracking
- governance exceptions
- risk trend and forecast intelligence
- escalation packs
- trust contracts
- safe writeback simulation
- evidence gap detection
- executive question generation
- decision option scoring
- portfolio constraint and dependency intelligence
- commitment tracking
- narrative drift detection
- governance replay and PMO policy simulation
- report quality benchmarking
- human confirmation analytics

## Safety Boundaries

The plugin does not directly automate CRM writes from Node.js. Browser-based CRM actions must remain confirmation-gated. Generated content is advisory until reviewed by the user.

## Testing Strategy

The repository uses Node-based tests:

```powershell
cd plugins/tpg-scheduler-codex-plugin
npm test
```

The tests cover:

- status normalization
- status draft construction
- Dataverse URL/snippet generation
- project intelligence evidence rules
- AI/KI helper outputs
- CLI JSON/export behavior
