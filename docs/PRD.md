# Pipely - Product Requirements Document

**Version**: 1.4
**Date**: 2025-11-23
**Author**: Lman + Iris
**Status**: Draft
**Architecture**: Google Sheets (v1.1 簡化版)

---

## Overview

### Product Name
**Pipely** - "Pipeline in your inbox"

### One-Liner
Gmail 內建的輕量 CRM，搭配 Slack 團隊協作，讓小團隊不用離開收件匣就能管理銷售流程。

### Problem Statement
1. **Streak 太貴**: $49-129/user/month，小團隊負擔不起
2. **傳統 CRM 太複雜**: Salesforce、HubSpot 需要離開 Email 才能操作
3. **資訊分散**: Email + Slack 的客戶資訊無法統一追蹤
4. **協作困難**: 團隊成員無法即時知道 Deal 進度

### Solution
一個 Gmail Add-on，讓用戶直接在收件匣內：
- 一鍵將 Email 加入 Pipeline
- 管理 Deal 狀態（Kanban 視圖）
- 透過 Slack 與團隊即時協作

---

## Target Users

### Primary Persona: Solo Sales / BD
- 獨立創業者、Freelancer
- 每天處理 10-50 封 Email
- 需要追蹤 20-100 個潛在客戶
- 不想花錢買 Salesforce

### Secondary Persona: Small Sales Team (2-10 人)
- Startup BD 團隊
- 需要共享 Pipeline 可見性
- 已經在用 Slack 協作
- 預算有限，找 Streak 替代品

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                           Pipely                                │
│                    (全 Google 生態系架構)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   📧 Gmail Add-on          📊 Google Sheets      💬 Slack       │
│   (Apps Script)            (Database)           (Webhook)      │
│   ───────────────          ─────────────        ─────────────  │
│   • 側邊欄 UI              • Deals Sheet         • 通知推播     │
│   • Email 解析             • Contacts Sheet      • Incoming     │
│   • Contact 提取           • Activities Sheet      Webhook      │
│   • Pipeline 視圖          • Settings Sheet                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 架構優勢

| 項目 | 說明 |
|------|------|
| **零後端成本** | 不需要 Supabase/Vercel，全在 Google 內 |
| **團隊協作** | Google Sheets 原生多人編輯、權限管理 |
| **透明度** | 非技術人員也能直接看/改資料 |
| **備份** | Google 自動備份、版本歷史 |
| **整合簡單** | Apps Script 天然整合 Sheets |

### Data Flow

```
1. [Gmail] 用戶收到客戶 Email
       ↓
2. [Gmail Add-on] 一鍵 "Add to Pipeline"
       ↓
3. [Apps Script] 寫入 Google Sheets (Deals + Contacts)
       ↓
4. [Apps Script] 呼叫 Slack Webhook 通知 #sales
       ↓
5. [Slack] 團隊成員討論 / 認領
       ↓
6. [Gmail Add-on] 更新 Deal 狀態 (更新 Sheet)
       ↓
7. [Apps Script] Slack Webhook 狀態變更通知
```

---

## Core Features

### Phase 1: Gmail Core (MVP)

#### F1.1 Gmail 側邊欄 UI
- **位置**: Gmail 右側 Add-on panel
- **觸發**: 開啟 Email 時自動顯示
- **內容**:
  - 聯絡人資訊（姓名、Email、公司）
  - 現有 Deal（如有）
  - "Add to Pipeline" 按鈕
  - 快速 Notes 輸入

#### F1.2 Pipeline 視圖
- **風格**: Kanban board（類似 Trello）
- **預設階段**:
  - Lead → Contacted → Meeting → Proposal → Won/Lost
- **操作**: 拖拉移動、點擊編輯
- **篩選**: By stage, By owner, By date

#### F1.3 Contact 管理
- **自動提取**: 從 Email header 提取姓名、Email
- **公司推測**: 從 Email domain 推測公司名稱
- **手動補充**: 電話、LinkedIn、Notes
- **關聯**: 一個 Contact 可有多個 Deals

#### F1.4 Deal 管理
- **欄位**:
  - Title（預設: 聯絡人名稱）
  - Stage（Pipeline 階段）
  - Value（預估金額，選填）
  - Owner（負責人）
  - Due Date（預計成交日）
  - Notes（備註）
  - Tags（標籤）
- **Email 關聯**: 自動連結相關 Email threads

### Phase 2: Slack Integration

#### F2.1 通知推播
- **觸發事件**:
  - 新 Deal 加入 → post 到 #sales
  - Deal 階段變更 → update thread
  - Deal Won/Lost → 慶祝/檢討通知
- **格式**: Rich message with buttons

#### F2.2 Slash Commands
```
/pipely list              - 列出我的 Deals
/pipely search <keyword>  - 搜尋 Deal/Contact
/pipely update <id> <stage> - 更新 Deal 狀態
/pipely assign <id> @user - 指派負責人
/pipely note <id> <text>  - 新增 Note
```

#### F2.3 雙向同步
- Slack thread 回覆 → 自動加入 Deal notes
- @pipely 查詢 → 回傳 Deal 摘要

### Phase 3: Contact Enrichment (Rapportive 功能) 🆕

> **靈感來源**: Rapportive (被 LinkedIn 收購) - 在 Gmail 顯示聯絡人社交資料
> **研究日期**: 2025-11-23

#### F3.0 Contact Enrichment 概述

**核心價值**: 在 Gmail 側邊欄自動顯示聯絡人的完整資料，無需離開收件匣
- 頭像 (Avatar)
- LinkedIn Profile
- 職位 (Job Title)
- 公司資訊 (Company Info)
- 地點 (Location)
- 社交媒體連結

#### F3.1 Enrichment - Free Tier (零成本)

**資料來源**:
1. **Gravatar API** - Email → 頭像 (免費，無限制)
   ```
   https://www.gravatar.com/avatar/{md5(email)}?d=identicon
   ```
2. **Clearbit Logo API** - Domain → 公司 Logo (免費)
   ```
   https://logo.clearbit.com/{domain}
   ```
3. **Email Domain 推測** - 公司名稱 (已有)
4. **LinkedIn URL 猜測** - 根據姓名猜測 Profile URL
   ```
   https://linkedin.com/in/{firstname}-{lastname}
   ```

**UI 更新**:
- 側邊欄顯示頭像 (Gravatar fallback to initials)
- 公司 Logo 旁顯示公司名稱
- "View on LinkedIn" 按鈕 (猜測 URL)

#### F3.2 Enrichment - Pro Tier (API 整合)

**建議 API** (按成本排序):
| Provider | 免費額度 | 付費價格 | 資料品質 |
|----------|----------|----------|----------|
| **GetProspect** | 50 credits/月 | $49/月起 | ⭐⭐⭐⭐ |
| **Lusha** | 5 credits/月 | $29/月起 | ⭐⭐⭐⭐ |
| **Proxycurl** | 10 credits | $49/月起 | ⭐⭐⭐⭐⭐ |
| **People Data Labs** | - | $98/月 | ⭐⭐⭐⭐⭐ |

**顯示資料**:
- 職位 (Job Title)
- 公司 (Company + Industry)
- 地點 (Location)
- LinkedIn Profile (驗證 URL)
- Twitter / 其他社交

**快取機制**:
- 每個 Contact 只查詢一次
- 儲存在 Contacts Sheet
- 30 天後過期重新查詢

#### F3.3 Enrichment - Team Tier (完整版)

**額外資料**:
- 公司員工數
- 公司融資輪次
- 決策者識別
- 相關新聞

**用途**: B2B 銷售、投資人關係

#### F3.3 Social Profile Discovery (Sherlock OSINT) 🆕

> **工具**: [Sherlock Project](https://github.com/sherlock-project/sherlock)
> **核心概念**: 從 username 反查 400+ 社交媒體平台帳號

**為什麼需要這個？**
- Gravatar/Clearbit 只能取得頭像和公司 Logo
- Pro Tier API (Lusha/Proxycurl) 主要提供 LinkedIn 資料
- Sherlock 可以發現 Twitter、GitHub、Instagram、Medium 等更多足跡

**工作原理**:
```
Contact Email: john.smith@acme.com
              ↓
提取可能的 username patterns:
  - "john.smith"
  - "johnsmith"
  - "jsmith"
  - "john_smith"
              ↓
Sherlock 查詢 400+ 平台
              ↓
發現: LinkedIn ✓, Twitter ✓, GitHub ✓, Medium ✓
              ↓
儲存到 Contacts Sheet (social_profiles JSON)
```

**支援的平台** (400+ 包含):
- 專業: LinkedIn, GitHub, AngelList, Crunchbase
- 社交: Twitter, Instagram, Facebook, TikTok
- 內容: Medium, Dev.to, Substack, YouTube
- 開發: Stack Overflow, GitLab, Bitbucket
- 其他: Reddit, Discord, Telegram

**實作考量**:

| 面向 | 評估 |
|------|------|
| **優點** | 免費、開源、400+ 平台、本地執行、隱私安全 |
| **缺點** | 需 Python、查詢較慢 (30-60秒/人)、可能有 rate limit |
| **適合** | 後台批次處理、Pro Tier "Deep Enrichment" |
| **不適合** | Gmail Add-on 即時查詢 |

**整合方式**:

**Option A: 本地批次腳本** (Free Tier)
```bash
# 每晚跑一次，enrichment 新 contacts
cd ~/pipely-enrichment
sherlock johnsmith --csv --output results/
# 結果匯入 Google Sheets
```

**Option B: Pro Tier 功能** (建議)
- 用戶手動觸發 "Deep Enrichment" 按鈕
- Apps Script 呼叫雲端 Python 服務 (Cloud Run / Railway)
- 背景執行，完成後 Slack 通知

**安裝指令**:
```bash
# 方法 1: pipx (推薦)
pipx install sherlock-project

# 方法 2: Docker
docker pull sherlock/sherlock

# 使用
sherlock username1 username2 --csv
```

**Contacts Sheet 新增欄位**:
| Column | Type | Description |
|--------|------|-------------|
| social_profiles | JSON | {"twitter": "url", "github": "url", ...} |
| sherlock_checked_at | DateTime | 上次 Sherlock 查詢時間 |

#### F3.4 Company Enrichment (公司資料豐富化) 🆕

> **核心概念**: 從 Email Domain → 自動探索公司資料 → LLM 總結
> **靈感來源**: Crunchbase + Clearbit + AI Summary

**觸發時機**: 當新增 Contact 時，檢查其 email domain 是否已有公司資料

**資料來源** (按成本排序):
| Provider | 免費額度 | 付費價格 | 資料範圍 |
|----------|----------|----------|----------|
| **Abstract API** | 500 req/月 | $9/月起 | Industry, Employees, Location |
| **The Companies API** | 100 req/月 | $49/月起 | 完整公司資料 |
| **SMARTe** | 10 credits/月 | $25/月起 | Technographic insights |
| **Proxycurl** | 10 credits | $49/月起 | LinkedIn 公司資料 |
| **Crunchbase** | 網頁爬取 | Enterprise | 融資、投資人 |

**取得資料**:
```
Domain (acme.com) → Company Enrichment API
                         ↓
                  ┌──────────────────────────┐
                  │ Company Name: Acme Corp   │
                  │ Industry: Enterprise SaaS │
                  │ Employees: 500-1000       │
                  │ Location: San Francisco   │
                  │ Founded: 2015             │
                  │ Website: https://acme.com │
                  │ Description: "..."        │
                  │ Funding: Series B ($25M)  │
                  │ Revenue: $10-50M          │
                  └──────────────────────────┘
```

**LLM 總結** (Ollama / Gemini):
```
輸入: 公司基本資料 + 網站描述 + 新聞
輸出: 2-3 句話的公司洞察

範例:
"Acme Corp 是一家 B2B SaaS 公司，專注於企業工作流程自動化。
2024 年完成 Series B 融資 $25M，正在積極擴展 APAC 市場。
主要競爭對手包括 Zapier 和 Make。"
```

#### F3.5 Account Map (組織架構圖) 🆕

> **核心概念**: 同一 domain 的 Contacts 自動建立 Account Map (Org Chart)
> **價值**: 從 Contact-level CRM → Account-Based CRM

**自動建立邏輯**:
```
同一 Domain 的所有 Contacts
         ↓
根據 Job Title 推測層級
         ↓
建立 Org Chart 視圖

層級分類:
- C-Level: CEO, CTO, CFO, COO, CMO
- VP: VP of..., Vice President, SVP
- Director: Director of..., Head of...
- Manager: Manager, Lead, Sr.
- IC: Engineer, Analyst, Specialist
```

**Org Chart 視圖**:
```
┌─────────────────────────────────────────────────────────┐
│  Acme Corp (acme.com) - 5 Contacts                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│           ┌──────────────┐                              │
│           │ 👔 CEO       │ ← Decision Maker ⭐          │
│           │ john@acme    │                              │
│           └──────┬───────┘                              │
│      ┌───────────┼───────────┐                          │
│ ┌────▼────┐ ┌────▼────┐ ┌────▼────┐                    │
│ │ CTO     │ │ CFO     │ │ VP Sales│ ← Champion 💚      │
│ │ amy@    │ │ bob@    │ │ carol@  │                    │
│ └─────────┘ └─────────┘ └────┬────┘                    │
│                         ┌────▼────┐                     │
│                         │ Sales Mgr│ ← Your Contact 📧  │
│                         │ dave@    │                    │
│                         └─────────┘                     │
│                                                         │
│ 📊 Account Summary:                                     │
│ • 2 Active Deals ($55K total)                          │
│ • Last Activity: 2 days ago                            │
│ • Next Step: Proposal review with VP Sales             │
└─────────────────────────────────────────────────────────┘
```

**關係標記** (可手動設定):
| 標記 | 說明 | 圖示 |
|------|------|------|
| Decision Maker | 最終決策者 | ⭐ |
| Economic Buyer | 預算持有者 | 💰 |
| Champion | 內部支持者 | 💚 |
| Blocker | 阻礙者 | 🚫 |
| Influencer | 影響者 | 💬 |

#### F3.6 技術參考：原始 Rapportive API 模式

> **參考**: https://github.com/jordan-wright/rapportive

**原始 Rapportive 工作原理** (已失效，供參考):
```python
# 1. 取得 Session Token
STATUS_URL = 'https://rapportive.com/login_status?user_email={0}'
response = requests.get(STATUS_URL.format(email)).json()
session_token = response.get('session_token')

# 2. 查詢 Profile
URL = 'https://profiles.rapportive.com/contacts/email/{0}'
headers = {'X-Session-Token': session_token}
response = requests.get(URL.format(email), headers=headers).json()

# 3. 返回 Profile 物件
profile = {
    'name': person.get('name'),
    'occupations': [(title, company) for ...],
    'memberships': [(site_name, profile_url) for ...]
}
```

**現代替代方案** (Pipely 實作):
```javascript
// Apps Script 版本
function enrichContact(email) {
  const domain = email.split('@')[1];

  // 1. Gravatar (頭像)
  const gravatarUrl = `https://www.gravatar.com/avatar/${md5(email)}?d=identicon`;

  // 2. Clearbit Logo (公司 Logo)
  const logoUrl = `https://logo.clearbit.com/${domain}`;

  // 3. Company Enrichment API
  const companyData = fetchCompanyData(domain); // Abstract API / TheCompaniesAPI

  // 4. LLM Summary
  const summary = generateCompanySummary(companyData); // Ollama / Gemini

  // 5. 存入 Accounts Sheet
  saveToAccountsSheet(domain, companyData, summary);

  return { gravatarUrl, logoUrl, companyData, summary };
}
```

---

### Phase 4: Advanced Features

#### F4.1 自動化規則
- IF 3 天沒更新 → 提醒 Owner
- IF Deal 進入 Proposal → 通知 Manager
- IF Email 包含 "invoice" → 自動標記 Hot Lead

#### F3.2 Analytics Dashboard
- Pipeline 總覽（各階段數量、金額）
- Conversion rate（轉換率）
- Average deal cycle（平均成交週期）
- Team performance（個人業績）

#### F3.3 多 Pipeline 支援
- Sales Pipeline
- Partnership Pipeline
- Investor Pipeline
- 自訂 Pipeline

---

## Tech Stack

### 全 Google 生態系（簡化版）

| 層級 | 技術 | 說明 |
|------|------|------|
| **Frontend** | Apps Script + Card Service | Gmail 側邊欄 UI |
| **Database** | Google Sheets | 零成本、團隊協作 |
| **Auth** | Google Account | 自帶，不需額外設定 |
| **Slack** | Incoming Webhook | 單向通知，最簡單 |

### 開發工具
- **clasp**: CLI for Apps Script（本地開發 + 部署）
- **TypeScript**: 可選，提升開發體驗

### 不需要
- ~~Supabase~~ → Google Sheets
- ~~Vercel/Railway~~ → Apps Script 內建 hosting
- ~~Slack Bolt.js~~ → Incoming Webhook（MVP 階段）

### 未來擴展（如需要）
- Slack App (Bolt.js) - 如需 slash commands
- Web Dashboard - 如需獨立 UI

---

## Database Schema (Google Sheets)

### Sheet 1: Deals
| Column | Type | Description |
|--------|------|-------------|
| deal_id | String | 自動生成 (D001, D002...) |
| title | String | Deal 名稱 |
| contact_email | String | 關聯 Contact |
| stage | String | Pipeline 階段 |
| value | Number | 預估金額 |
| currency | String | 幣別 (USD, TWD) |
| owner_email | String | 負責人 |
| due_date | Date | 預計成交日 |
| notes | String | 備註 |
| tags | String | 逗號分隔標籤 |
| email_thread_id | String | Gmail Thread ID |
| created_at | DateTime | 建立時間 |
| updated_at | DateTime | 更新時間 |

**範例資料**:
| deal_id | title | contact_email | stage | value | owner_email | due_date |
|---------|-------|---------------|-------|-------|-------------|----------|
| D001 | Acme Corp | john@acme.com | Meeting | 10000 | lman@irisgo.ai | 2025-12-01 |

### Sheet 2: Contacts
| Column | Type | Description |
|--------|------|-------------|
| email | String | Primary Key |
| name | String | 聯絡人姓名 |
| company | String | 公司名稱 |
| phone | String | 電話 |
| linkedin | String | LinkedIn URL |
| notes | String | 備註 |
| created_at | DateTime | 建立時間 |

### Sheet 3: Activities
| Column | Type | Description |
|--------|------|-------------|
| activity_id | String | 自動生成 |
| deal_id | String | 關聯 Deal |
| type | String | note / stage_change / email |
| content | String | 內容 |
| user_email | String | 操作者 |
| created_at | DateTime | 時間 |

### Sheet 4: Settings
| Key | Value |
|-----|-------|
| pipeline_stages | Lead,Contacted,Meeting,Proposal,Won,Lost |
| slack_webhook_url | https://hooks.slack.com/services/... |
| slack_channel | #sales |
| default_currency | USD |

### Sheet 5: Accounts (公司資料) 🆕
| Column | Type | Description |
|--------|------|-------------|
| domain | String | Primary Key (acme.com) |
| company_name | String | 公司名稱 |
| industry | String | 產業 |
| employee_count | String | 員工數範圍 (1-10, 11-50, 51-200...) |
| location | String | 總部位置 |
| website | String | 網站 URL |
| description | String | 公司描述 (原始) |
| ai_summary | String | LLM 生成的總結 |
| funding_stage | String | 融資階段 (Seed, Series A...) |
| funding_amount | String | 融資金額 |
| revenue_range | String | 營收範圍 |
| founded_year | Number | 成立年份 |
| logo_url | String | 公司 Logo URL |
| linkedin_url | String | LinkedIn 公司頁面 |
| enriched_at | DateTime | 豐富化時間 |
| enrichment_source | String | 資料來源 (abstract, clearbit...) |

**範例資料**:
| domain | company_name | industry | employee_count | location | ai_summary |
|--------|--------------|----------|----------------|----------|------------|
| acme.com | Acme Corp | Enterprise SaaS | 500-1000 | San Francisco | "B2B SaaS 專注於..." |

### Contacts Sheet 擴展欄位 🆕
| 新增 Column | Type | Description |
|-------------|------|-------------|
| avatar_url | String | Gravatar URL |
| job_title | String | 職位 |
| job_level | String | C-Level / VP / Director / Manager / IC |
| relationship | String | Champion / Blocker / Decision Maker / Economic Buyer |
| enriched_at | DateTime | 豐富化時間 |

### 團隊協作
- **共享 Spreadsheet** → 團隊成員都能看到所有 Deals
- **Google 權限管理** → Editor / Viewer / Commenter
- **版本歷史** → File > Version history
- **手動編輯** → 不用 Add-on 也能直接改

---

## Apps Script Functions

### Core Functions (內部使用)
```javascript
// Deals
getDeals(filters)           // 取得 Deals（可篩選）
getDealById(dealId)         // 取得單一 Deal
createDeal(dealData)        // 建立 Deal
updateDeal(dealId, data)    // 更新 Deal
deleteDeal(dealId)          // 刪除 Deal

// Contacts
getContacts()               // 取得所有 Contacts
getContactByEmail(email)    // 以 Email 查詢
createOrUpdateContact(data) // 建立或更新 Contact

// Activities
addActivity(dealId, type, content)  // 新增活動記錄
getActivities(dealId)               // 取得 Deal 活動

// Settings
getSettings()               // 取得設定
updateSettings(key, value)  // 更新設定
```

### Gmail Add-on Triggers
```javascript
onGmailMessage(e)           // 開啟 Email 時觸發
onHomepage(e)               // 開啟 Add-on 時觸發
```

### Slack Integration
```javascript
sendSlackNotification(message)  // 發送 Slack 通知
formatDealForSlack(deal)        // 格式化 Deal 訊息
```

---

## Pricing Model

### Free Tier
- 50 Contacts
- 1 Pipeline
- Gmail Add-on only
- 個人使用

### Pro ($9.99/month)
- Unlimited Contacts
- 5 Pipelines
- Slack Integration
- Automation Rules (3)
- Email Support

### Team ($19.99/user/month)
- Everything in Pro
- Unlimited Pipelines
- Team Collaboration
- Analytics Dashboard
- Priority Support
- Custom Integrations

---

## Development Timeline

### Week 1-2: Gmail Add-on MVP
- [ ] Google Cloud Project 設定
- [ ] Apps Script 專案建立 (clasp)
- [ ] Google Sheets 資料庫結構
- [ ] 側邊欄 UI（Contact info, Add to Pipeline）
- [ ] 基本 Deal CRUD（讀寫 Sheets）
- [ ] Contact 自動提取

### Week 3-4: Pipeline & Slack
- [ ] Pipeline 視圖（List view，非 Kanban）
- [ ] Slack Incoming Webhook 設定
- [ ] 新 Deal 通知
- [ ] 狀態變更通知

### Week 5-6: Polish & Launch
- [ ] UI 優化
- [ ] 錯誤處理
- [ ] GitHub Pages Landing Page
- [ ] Beta Launch（unlisted）

---

## Success Metrics

### MVP (Month 1)
- 10 Beta users
- 100 Deals created
- 基本功能可用

### Growth (Month 3)
- 100 Active users
- 1,000 Deals
- 10 Paying customers

### Scale (Month 6)
- 500 Active users
- $1,000 MRR
- Product Hunt launch

---

## Competitive Analysis

| Feature | Pipely | Streak | HubSpot Free | Pipedrive |
|---------|--------|--------|--------------|-----------|
| Gmail 內建 | ✅ | ✅ | ❌ | ❌ |
| Slack 整合 | ✅ | ❌ | ✅ | ✅ |
| 免費額度 | 50 contacts | 500 contacts | 1M contacts | ❌ |
| 價格 | $9.99 | $49 | $0-45 | $14.90 |
| 複雜度 | 低 | 中 | 高 | 中 |

### 差異化
1. **價格**: 比 Streak 便宜 5x
2. **Slack 優先**: 原生 Slack 協作（Streak 沒有）
3. **簡單**: 只做核心功能，不做 feature bloat

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Google Add-on 審核慢 | 延遲上線 | 先用 unlisted 版本測試 |
| Streak 降價 | 競爭壓力 | 強調 Slack 整合差異 |
| 用戶不願離開 Streak | 獲客困難 | 提供 import 工具 |
| Sheets 效能瓶頸 | 大量資料變慢 | 10K rows 內足夠，之後考慮 BigQuery |

---

## Open Questions

1. **Gmail API vs Apps Script**: 哪個更適合複雜 UI？
2. **Mobile**: 需要 Mobile app 嗎？還是先 Web only？
3. **Import**: 要支援從 Streak/HubSpot import 嗎？
4. **AI Features**: 要加入 AI 功能嗎？（自動分類、摘要）

---

## References

### 競品與靈感
- [Streak](https://www.streak.com/) - 主要競品
- [Rapportive](https://github.com/jordan-wright/rapportive) - 原始 Rapportive Python Library (已失效，供參考)
- [LinkedIn Sales Navigator for Gmail](https://business.linkedin.com/sales-solutions/sales-navigator) - Rapportive 繼任者
- [OrgChartHub](https://orgcharthub.com/) - HubSpot Org Chart 參考

### 開發文檔
- [Gmail Add-on Docs](https://developers.google.com/workspace/add-ons)
- [Apps Script Sheets](https://developers.google.com/apps-script/reference/spreadsheet)
- [Slack Incoming Webhooks](https://api.slack.com/messaging/webhooks)
- [clasp](https://github.com/google/clasp) - Apps Script CLI

### OSINT Tools
- [Sherlock Project](https://github.com/sherlock-project/sherlock) - Username → 400+ 社交平台查詢 (免費開源)

### Enrichment API
- [Abstract API - Company Enrichment](https://www.abstractapi.com/api/company-enrichment) - 免費 500 req/月
- [The Companies API](https://www.thecompaniesapi.com/) - 完整公司資料
- [Gravatar](https://gravatar.com/) - Email → 頭像 (免費)
- [Clearbit Logo API](https://clearbit.com/logo) - Domain → Logo (免費)
- [Proxycurl](https://nubela.co/proxycurl) - LinkedIn 資料 API
- [GetProspect](https://getprospect.com/) - B2B 聯絡人資料
- [Lusha](https://www.lusha.com/) - GDPR 合規聯絡人資料

---

## Appendix

### A. Gmail Add-on Card UI 範例

```javascript
// 側邊欄卡片結構
function buildSidebarCard(contact, deals) {
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader()
      .setTitle(contact.name || contact.email)
      .setSubtitle(contact.company || ''))
    .addSection(CardService.newCardSection()
      .setHeader('Deals')
      .addWidget(buildDealsWidget(deals)))
    .addSection(CardService.newCardSection()
      .addWidget(CardService.newTextButton()
        .setText('Add to Pipeline')
        .setOnClickAction(CardService.newAction()
          .setFunctionName('addToPipeline'))))
    .build();
}
```

### B. Slack Message Format

```json
{
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*New Deal Added* :tada:\n*Acme Corp* - $10,000\nOwner: @john"
      }
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": { "type": "plain_text", "text": "View Deal" },
          "url": "https://pipely.app/deals/123"
        },
        {
          "type": "button",
          "text": { "type": "plain_text", "text": "Assign to Me" },
          "action_id": "assign_deal"
        }
      ]
    }
  ]
}
```

---

**Document History**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-23 | Lman + Iris | Initial PRD |
| 1.1 | 2025-11-23 | Lman + Iris | 改用 Google Sheets 架構，移除 Supabase |
| 1.2 | 2025-11-23 | Lman + Iris | 新增 Phase 3: Contact Enrichment (Rapportive 功能) |
| 1.3 | 2025-11-23 | Lman + Iris | 新增 F3.4 Company Enrichment + F3.5 Account Map + Accounts Sheet |
| 1.4 | 2025-11-24 | Lman + Iris | 新增 F3.3 Social Profile Discovery (Sherlock OSINT) |
