# Pipely - Gmail Add-on CRM

Pipely is a lightweight CRM that runs directly inside Gmail. It allows you to manage deals, contacts, and pipelines without leaving your inbox.

## Features

- **Contextual Sidebar**: Automatically shows contact details and deal status when you open an email.
- **Pipeline Management**: View and update deal stages directly from the add-on.
- **Slack Integration**: Get notified in Slack when new deals are created or stages are updated.
- **Google Sheets Backend**: All data is stored in a Google Sheet for easy access and reporting.

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

- `src/Code.gs`: Main entry point and trigger handlers.
- `src/Cards.gs`: UI builders for the add-on.
- `src/Sheets.gs`: Database operations using Google Sheets.
- `src/Gmail.gs`: Email parsing utilities.
- `src/Slack.gs`: Slack notification integration.
- `appsscript.json`: Manifest file.
