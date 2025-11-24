# Changelog

All notable changes to Pipely will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.4.0] - 2025-11-24

### Added
- **Dashboard Web UI**: Standalone web app for pipeline management
  - Kanban-style pipeline board with drag & drop
  - Deal cards with title, contact, value, and tags
  - Click to edit deal details (title, value, stage, tags, notes)
  - Delete deals from modal
  - Accounts tab with company cards
  - Stats bar: Total Deals, Pipeline Value, Won Deals, Accounts
  - Search/filter deals
  - Responsive design for mobile
- New web app endpoints: `doGet()`, `getDashboardData()`, `getAccountsData()`
- Dashboard functions: `updateDealStage()`, `updateDealFromDashboard()`, `deleteDealFromDashboard()`

### How to Deploy Dashboard
1. Open Apps Script editor
2. Deploy > New deployment > Web app
3. Execute as: Me, Access: Anyone with Google account
4. Copy the web app URL

## [1.3.0] - 2025-11-24

### Added
- **Account Map (Phase 3.5)**: Organization chart view for company contacts
  - View all contacts from same company domain grouped by job level
  - Job levels: C-Level, VP, Director, Manager, Individual
  - Relationship markers: Decision Maker [DM], Economic Buyer [EB], Champion [CH], Influencer [IN], Blocker [BL]
  - Click contact to view/edit details
  - Add new contacts directly to account
  - Auto-guess job level from job title keywords
- New Contacts sheet columns: `job_title`, `job_level`, `relationship`
- Migration function `migrateContactsSheet()` for existing users

## [1.2.0] - 2025-11-24

### Added
- **Deal Management Enhancements**
  - Delete Deal: "Danger Zone" collapsible section with red delete button
  - Add Notes: Append timestamped notes to existing deals
  - Tags Support: Comma-separated tags for deal categorization
- Slack notification on deal deletion

### Changed
- Deal detail card now shows Contact email
- Notes displayed with timestamp history
- Tags displayed as `[tag1] [tag2]` format

## [1.1.0] - 2025-11-24

### Added
- **Company Enrichment (Phase 3.4)**: AI-powered company insights
  - Fetch company data from email domain
  - LLM integration (Gemini, OpenAI, Ollama) for AI summary generation
  - Company Insights section in Gmail sidebar
  - Accounts sheet for caching company data (30-day TTL)
- **Contact Enrichment (Phase 3.1)**
  - Gravatar avatar integration
  - Clearbit company logo
  - LinkedIn URL guessing
- LocalConfig.gs support for secure API key management
- New Gmail sidebar icon (P+funnel design)

### Changed
- Updated appsscript.json with new logo URL

## [1.0.0] - 2025-11-23

### Added
- **Core CRM Features**
  - Gmail Add-on sidebar UI
  - Contact auto-extraction from email headers
  - Company name guessing from email domain
  - "Add to Pipeline" one-click deal creation
  - Deal detail view with stage updates
  - Pipeline overview (grouped by stage)
- **Google Sheets Database**
  - Auto-created "Pipely CRM Database" spreadsheet
  - Deals, Contacts, Activities, Settings sheets
  - Configurable pipeline stages
- **Slack Integration**
  - Incoming Webhook support
  - New deal notifications (Block Kit format)
  - Stage change notifications
- **Landing Page**
  - GitHub Pages deployment
  - Ko-fi donation support
  - Formspree waitlist form

### Technical
- Apps Script project with clasp deployment
- OAuth scopes for Gmail, Sheets, external requests
- V8 runtime

---

## Migration Guide

### Upgrading to 1.3.0
If you have existing contacts, run `migrateContactsSheet()` once in Apps Script editor to add the new columns (job_title, job_level, relationship).

### Upgrading to 1.1.0
Create `src/LocalConfig.gs` (gitignored) with your API keys:
```javascript
const LOCAL_CONFIG = {
  gemini_api_key: 'your-key-here',
  abstract_api_key: '',
  openai_api_key: ''
};

function getLocalConfig(key) {
  return LOCAL_CONFIG[key] || getSettingOrProperty(key) || '';
}
```
