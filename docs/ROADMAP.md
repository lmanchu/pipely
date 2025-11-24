# Pipely - 開發進度追蹤

**最後更新**: 2025-11-24
**開發方式**: Claude Code + Google Antigravity 協作

---

## 已完成 (Phase 1 MVP)

### 核心功能
- [x] Gmail Add-on 側邊欄 UI
- [x] Contact 自動提取（從 Email header）
- [x] 公司名稱推測（從 email domain）
- [x] "Add to Pipeline" 一鍵新增 Deal
- [x] Deal 詳情頁面
- [x] Stage 更新功能
- [x] Pipeline 總覽（按階段分組）

### 資料庫 (Google Sheets)
- [x] 自動建立 Spreadsheet
- [x] Deals Sheet（含所有欄位）
- [x] Contacts Sheet
- [x] Activities Sheet
- [x] Settings Sheet（含預設值）

### Slack 整合
- [x] Incoming Webhook 支援
- [x] 新 Deal 通知格式（Block Kit）
- [x] Stage 變更通知格式

### 部署
- [x] Apps Script 專案建立
- [x] clasp 部署設定
- [x] Gmail Add-on 測試版安裝
- [x] OAuth scopes 設定（含 userinfo.email 修復）

### 文件與版控
- [x] PRD v1.1（Google Sheets 架構）
- [x] README.md
- [x] GitHub repo: https://github.com/lmanchu/pipely
- [x] 初始 commit (v1.0.0)

---

## 待完成 (Phase 2+)

### Slack 整合（進階）
- [ ] 設定 Slack Incoming Webhook（需要用戶操作）
- [ ] 測試通知功能
- [ ] Slack App（如需 slash commands）

### 功能優化
- [ ] Deal 刪除功能
- [ ] Contact 編輯功能
- [ ] Notes 新增到現有 Deal
- [ ] Tags 支援
- [ ] Due Date 提醒

### UI 優化
- [ ] 更好的 Pipeline 視圖（可能需要 Web UI）
- [ ] 搜尋功能
- [ ] 篩選功能（by stage, by owner）

### 團隊協作
- [ ] 測試多人共享 Google Sheet
- [ ] Owner 指派功能
- [ ] 團隊權限管理

### 自動化
- [ ] 3 天未更新提醒
- [ ] 自動標記 Hot Lead
- [ ] Email 關鍵字觸發

### 上線準備
- [ ] Landing Page (GitHub Pages)
- [ ] Chrome Web Store / Google Workspace Marketplace
- [ ] Product Hunt 發布
- [ ] 定價方案實作

---

## 技術筆記

### 檔案結構
```
/Users/lman/gemini/pipely/
├── src/
│   ├── Code.gs          # 主程式入口
│   ├── Cards.gs         # UI 元件 (Card Service)
│   ├── Sheets.gs        # Google Sheets CRUD
│   ├── Gmail.gs         # Email 解析
│   ├── Slack.gs         # Slack Webhook
│   └── appsscript.json  # OAuth scopes & triggers
├── .clasp.json          # Script ID: 1CqjJpbBvK_MLy4GkRcNtMhIZwyrS0hHUs8X7Tyn-Rm4tAmBxLuyz4peg
├── package.json
├── .gitignore
└── README.md
```

### 重要指令
```bash
# 部署更新
cd /Users/lman/gemini/pipely
clasp push --force

# 開啟 Apps Script 編輯器
clasp open

# 查看 logs
clasp logs
```

### 已知問題（已修復）
1. ~~`Session.getActiveUser()` 需要 `userinfo.email` scope~~ ✅ 已修復

### Google Sheet 位置
- 名稱: "Pipely CRM Database"
- 自動建立於用戶的 Google Drive
- Script Property: `PIPELY_SPREADSHEET_ID`

---

## 下次開發建議

1. **優先**: 設定 Slack Webhook 並測試通知
2. **其次**: 新增 Deal 刪除和 Notes 功能
3. **🆕 Phase 3**: Contact Enrichment (Rapportive 功能)
4. **之後**: 考慮 Landing Page 和公開發布

---

## 🆕 Phase 3: Contact Enrichment 研究筆記 (2025-11-23)

### 背景
- **Rapportive** 是經典的 Gmail 聯絡人豐富化工具，2012 年被 LinkedIn 收購
- 現已整合為 **LinkedIn Sales Navigator for Gmail**
- 核心功能：在 Gmail 側邊欄顯示聯絡人的社交資料

### 競品分析

| 工具 | 定價 | 特色 |
|------|------|------|
| LinkedIn Sales Navigator for Gmail | 免費 | 僅 LinkedIn 資料 |
| Clearbit Connect | $6K/年起 | 最完整但貴 |
| Discoverly | 免費 | 含 Facebook/Twitter |
| FullContact | $8.33/月起 | 含 AngelList |
| ContactOut | Freemium | LinkedIn → Email |

### Pipely 實作方案

**Free Tier (零成本)**:
- Gravatar API → 頭像
- Clearbit Logo API → 公司 Logo
- Email domain → 公司名稱
- LinkedIn URL 猜測

**Pro Tier (API 整合)**:
- GetProspect / Lusha 免費額度
- 職位、地點、驗證 LinkedIn

**Team Tier (完整版)**:
- Proxycurl / PDL
- 公司融資、員工數、決策者

### 技術實作重點

1. **Gravatar**: MD5 hash email → avatar URL
2. **Clearbit Logo**: domain → logo URL (免費)
3. **快取**: Contacts Sheet 儲存，避免重複查詢
4. **UI**: Card 頂部顯示頭像 + 公司 Logo

### 預估開發時間
- Free Tier: 1-2 天
- Pro Tier: 3-5 天（含 API 整合）
- Team Tier: 1 週

---

## 🆕 Phase 3.4-3.6: Company Enrichment + Account Map 研究筆記 (2025-11-23)

### 新增功能概述

**F3.4 Company Enrichment**
- 從 Email Domain 自動查詢公司資料
- LLM (Ollama/Gemini) 生成公司洞察總結
- 新增 Accounts Sheet 儲存公司資料

**F3.5 Account Map (Org Chart)**
- 同一 Domain 的 Contacts 自動建立組織架構圖
- Job Title → Job Level 自動分類
- 關係標記: Decision Maker, Champion, Blocker, Economic Buyer

**F3.6 技術參考**
- 參考原始 Rapportive API 模式 (https://github.com/jordan-wright/rapportive)
- 雖然 API 已失效，但架構設計可參考

### Company Enrichment API 比較

| Provider | 免費額度 | 資料範圍 | 推薦度 |
|----------|----------|----------|--------|
| Abstract API | 500 req/月 | 基本公司資料 | ⭐⭐⭐⭐⭐ 首選 |
| The Companies API | 100 req/月 | 完整資料 | ⭐⭐⭐⭐ |
| Clearbit Logo | 無限 | 僅 Logo | ⭐⭐⭐⭐⭐ 免費 |
| Gravatar | 無限 | 僅頭像 | ⭐⭐⭐⭐⭐ 免費 |

### 新增 Google Sheet

**Accounts Sheet** (5th sheet):
- Primary Key: domain
- 欄位: company_name, industry, employee_count, location, ai_summary, funding_stage...
- 快取機制: 30 天過期

**Contacts Sheet 擴展**:
- avatar_url, job_title, job_level, relationship

### 開發優先順序 (更新)

```
Phase 3.1: Contact Enrichment (頭像、LinkedIn)     - 1-2 天
Phase 3.4: Company Enrichment (公司資料 + AI 總結)  - 2-3 天 ← 新增
Phase 3.5: Account Map (Org Chart 視圖)            - 3-5 天 ← 新增
Phase 3.2: Pro Tier API 整合                       - 2-3 天
```

### 價值定位升級

**之前**: Gmail CRM (Contact-level)
**之後**: Account-Based Sales Intelligence Platform

差異化:
- 比 Streak 多了 Account-level 視圖 + AI 總結
- 比 HubSpot Free 多了自動 Company Enrichment
- 比 LinkedIn Sales Navigator 多了 CRM + LLM 洞察

---

## 🆕 Phase 3.3: Social Profile Discovery (Sherlock) 研究筆記 (2025-11-24)

### 背景
- **Sherlock** 是開源 OSINT 工具，可從 username 搜尋 400+ 社交平台
- GitHub: https://github.com/sherlock-project/sherlock
- 由 Perplexity 推薦作為 Contact Enrichment 補充方案

### 核心價值

**現有方案的限制**:
- Gravatar: 只有頭像，需完整 email
- Clearbit Logo: 只有公司 logo
- Pro Tier API (Lusha/Proxycurl): 主要 LinkedIn 資料

**Sherlock 填補的缺口**:
- 從 username → 400+ 平台的社交足跡
- Twitter、GitHub、Instagram、Medium 等完整發現
- 免費開源、本地執行、隱私安全

### 支援平台 (400+ 包含)
- 專業: LinkedIn, GitHub, AngelList, Crunchbase
- 社交: Twitter, Instagram, Facebook, TikTok
- 內容: Medium, Dev.to, Substack, YouTube
- 開發: Stack Overflow, GitLab, Bitbucket

### 技術評估

| 面向 | 評估 |
|------|------|
| **優點** | 免費開源、400+ 平台、本地執行、隱私安全 |
| **缺點** | 需 Python、查詢較慢 (30-60秒)、rate limit |
| **適合** | 後台批次處理、Pro Tier "Deep Enrichment" |
| **不適合** | Gmail Add-on 即時查詢 |

### 建議整合方式

**Option A**: 本地批次腳本 (Free Tier)
```bash
sherlock johnsmith --csv --output ~/pipely-enrichment/
```

**Option B**: Pro Tier 功能 (建議)
- 手動觸發 "Deep Enrichment" 按鈕
- 背景執行，完成後 Slack 通知

### 安裝指令
```bash
# pipx (推薦)
pipx install sherlock-project

# Docker
docker pull sherlock/sherlock
```

### 開發優先順序 (更新)

```
Phase 3.1: Contact Enrichment (頭像、LinkedIn)     - 1-2 天
Phase 3.3: Social Profile Discovery (Sherlock)    - 1-2 天 ← 新增
Phase 3.4: Company Enrichment (公司資料 + AI 總結)  - 2-3 天
Phase 3.5: Account Map (Org Chart 視圖)            - 3-5 天
Phase 3.2: Pro Tier API 整合                       - 2-3 天
```

---

## 協作記錄

| 日期 | 工作內容 | 參與者 |
|------|----------|--------|
| 2025-11-23 | PRD 撰寫、架構設計 | Lman + Iris |
| 2025-11-23 | 程式碼生成 | Antigravity (Gemini 3 Pro) |
| 2025-11-23 | 部署、Debug、GitHub 發布 | Iris (Claude Code) |
| 2025-11-24 | Phase 3.3 Sherlock OSINT 研究 | Lman + Iris |
