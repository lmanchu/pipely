<p align="center">
  <img src="assets/logo.png" alt="Pipely Logo" width="400">
</p>

<h1 align="center">Pipely</h1>

<p align="center">
  <strong>Pipeline in your inbox</strong><br>
  A lightweight CRM that runs directly inside Gmail
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#setup">Setup</a> •
  <a href="#usage">Usage</a> •
  <a href="docs/PRD.md">Roadmap</a>
</p>

---

Pipely lets you manage deals, contacts, and pipelines without leaving your inbox. Built on Google Sheets for transparency and zero backend costs.

## Features

- **Contextual Sidebar**: Automatically shows contact details and deal status when you open an email
- **Contact Enrichment**: Auto-fetch Gravatar avatars, company logos (Clearbit), and LinkedIn profile guesses
- **Pipeline Management**: View and update deal stages directly from the add-on
- **Slack Integration**: Get notified in Slack when new deals are created or stages are updated
- **Google Sheets Backend**: All data is stored in a Google Sheet for easy access and reporting
- **Zero Cost**: No backend servers, everything runs on Google's free tier

## Prerequisites

- A Google Account
- Node.js and npm (for clasp)
- A Slack Workspace (optional, for notifications)

## Setup

1.  **Install dependencies**
    ```bash
    npm install -g @google/clasp
    ```

2.  **Login to Google**
    ```bash
    clasp login
    ```

3.  **Create the project**
    ```bash
    clasp create --type addons --title "Pipely CRM" --rootDir ./src
    ```

4.  **Push the code**
    ```bash
    clasp push
    ```

5.  **Deploy**
    - Go to [Apps Script Dashboard](https://script.google.com/home)
    - Open the "Pipely CRM" project
    - Click "Deploy" > "Test deployments"
    - Select "Gmail Add-on" and install it for your account

## Configuration

### Google Sheets
The first time you run the add-on, it will automatically create a Google Sheet named "Pipely CRM Database" in your Drive.
You can find the ID of this sheet in the Script Properties (Project Settings > Script Properties > `PIPELY_SPREADSHEET_ID`).

### Slack Webhook
To enable Slack notifications:
1.  Create an Incoming Webhook in your Slack workspace.
2.  Open the "Pipely CRM Database" Google Sheet.
3.  Go to the **Settings** tab.
4.  Paste your webhook URL into the `value` column for `slack_webhook_url`.

## Usage

- **Viewing Contacts**: Open any email in Gmail. The Pipely sidebar will show the sender's contact info.
- **Creating Deals**: Click "Add to Pipeline" in the sidebar to create a new deal for the contact.
- **Managing Pipeline**: Open the add-on from the right-side panel (without opening an email) to view your entire pipeline.
- **Updating Stages**: Click on any deal to view details and update its stage.

## Project Structure

```
pipely/
├── assets/
│   └── logo.png          # Brand assets
├── docs/
│   ├── PRD.md            # Product Requirements & Roadmap
│   └── ROADMAP.md        # Development progress
├── src/
│   ├── Code.gs           # Main entry point and trigger handlers
│   ├── Cards.gs          # UI builders for the add-on
│   ├── Sheets.gs         # Database operations using Google Sheets
│   ├── Gmail.gs          # Email parsing utilities
│   ├── Slack.gs          # Slack notification integration
│   ├── Enrichment.gs     # Contact enrichment (Gravatar, Clearbit, LinkedIn)
│   └── appsscript.json   # Manifest file
└── README.md
```

## Roadmap

See [docs/PRD.md](docs/PRD.md) for the full product roadmap.

**Coming Soon:**
- Phase 3.3: Social Profile Discovery (Sherlock OSINT)
- Phase 3.4: Company Enrichment with AI summaries
- Phase 3.5: Account Map / Org Chart visualization
