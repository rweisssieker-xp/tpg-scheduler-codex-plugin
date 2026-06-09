# Installation

## Clone

```powershell
git clone https://github.com/rweisssieker-xp/tpg-scheduler-codex-plugin.git
cd tpg-scheduler-codex-plugin
```

## Validate

```powershell
cd plugins/tpg-scheduler-codex-plugin
npm run validate
npm test
```

## Use In Codex

The plugin root is:

```text
plugins/tpg-scheduler-codex-plugin
```

The primary skill is:

```text
status-report
```

Use the skill when drafting or reviewing Dynamics 365 TPG project status reports. The workflow requires the Codex in-app Browser for Dynamics navigation and does not launch a separate browser process.

## Compatibility Scripts

Preferred script names:

```powershell
npm run status-report:help
npm run status-report:dataverse
node ./scripts/statusbericht.js --intelligence <snapshot.json> --allow-offline-input
node ./scripts/statusbericht.js --pmo-report <snapshot.json> --allow-offline-input
```

Compatibility aliases:

```powershell
npm run statusbericht:help
npm run statusbericht:dataverse
node ./scripts/statusbericht.js --intelligence <snapshot.json> --allow-offline-input
node ./scripts/statusbericht.js --pmo-report <snapshot.json> --allow-offline-input
```

No npm command runs sample or fixture data as an active workflow. Test fixtures are reserved for automated tests and documentation.
