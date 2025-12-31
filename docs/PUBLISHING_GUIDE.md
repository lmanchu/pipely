# Pipely - Google Workspace Marketplace Publishing Guide

## 準備狀態 ✅

已完成的項目：
- [x] Privacy Policy: https://lmanchu.github.io/pipely/privacy.html
- [x] Terms of Service: https://lmanchu.github.io/pipely/terms.html
- [x] Landing Page: https://lmanchu.github.io/pipely/
- [x] 128x128 Icon: `/assets/icon-128.png`
- [x] Marketplace Listing Content: `/docs/MARKETPLACE_LISTING.md`

## 待完成步驟

### Step 1: 建立 GCP 專案

1. 前往 [Google Cloud Console](https://console.cloud.google.com)
2. 點擊專案選擇器 → **新增專案**
3. 專案名稱：`pipely`
4. 記下**專案編號** (Project Number)，例如：`123456789012`

### Step 2: 設定 OAuth Consent Screen

1. 在 GCP Console 中，前往 **APIs & Services** → **OAuth consent screen**
2. 選擇 **External** (如果要公開發布)
3. 填寫以下資訊：
   - **App name**: Pipely
   - **User support email**: support@irisgo.ai
   - **App logo**: 上傳 icon-128.png
   - **App home page**: https://lmanchu.github.io/pipely/
   - **Privacy Policy URL**: https://lmanchu.github.io/pipely/privacy.html
   - **Terms of Service URL**: https://lmanchu.github.io/pipely/terms.html
   - **Developer contact email**: support@irisgo.ai

4. 在 **Scopes** 頁面，新增以下 scopes：
   - `https://www.googleapis.com/auth/gmail.addons.execute`
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/spreadsheets`
   - `https://www.googleapis.com/auth/script.external_request`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/tasks`

5. 點擊 **Save and Continue**

### Step 3: 啟用必要的 APIs

在 GCP Console 中，前往 **APIs & Services** → **Library**，啟用：
- Gmail API
- Google Sheets API
- Google Tasks API

### Step 4: 連結 GCP 專案到 Apps Script

1. 前往 Apps Script 專案設定：
   https://script.google.com/home/projects/1CqjJpbBvK_MLy4GkRcNtMhIZwyrS0hHUs8X7Tyn-Rm4tAmBxLuyz4peg/settings

2. 在 **Google Cloud Platform (GCP) 專案** 區段
3. 點擊 **變更專案**
4. 輸入 Step 1 記下的**專案編號**
5. 點擊 **設定專案**

### Step 5: OAuth 驗證申請（因為使用敏感 scopes）

由於 Pipely 使用 `gmail.readonly` 等敏感 scope，需要 Google 驗證：

1. 在 OAuth consent screen 頁面，點擊 **Publish App**
2. 點擊 **Prepare for Verification**
3. 填寫驗證表單：
   - 說明為什麼需要這些權限
   - 提供展示影片（可選）
   - 確認 Privacy Policy 和 Terms of Service
4. 提交驗證申請

**注意**：驗證可能需要 3-5 個工作天

### Step 6: 設定 Workspace Marketplace SDK

1. 在 GCP Console，啟用 **Google Workspace Marketplace SDK**
2. 前往 **APIs & Services** → **Google Workspace Marketplace SDK** → **App Configuration**
3. 填寫以下資訊：

**Application Info**:
- App Name: Pipely
- Short Description (80 chars):
  ```
  Turn Gmail into a lightweight CRM. Track deals, contacts & pipeline from inbox.
  ```
- Detailed Description: (見 MARKETPLACE_LISTING.md)
- Icons: 上傳 icon-128.png
- Screenshots: 上傳截圖

**OAuth 2.0 scopes**:
複製貼上所有 scopes（與 Step 2 相同）

**Extensions**:
- Type: Gmail Add-on
- Script ID: `1CqjJpbBvK_MLy4GkRcNtMhIZwyrS0hHUs8X7Tyn-Rm4tAmBxLuyz4peg`

**Visibility**:
- 選擇 Public (公開) 或 Private (組織內部)

**Store Listing**:
- Category: Productivity
- Terms of Service URL: https://lmanchu.github.io/pipely/terms.html
- Privacy Policy URL: https://lmanchu.github.io/pipely/privacy.html
- Support URL: https://github.com/lmanchu/pipely/issues

### Step 7: 發布審核

1. 確認所有設定正確
2. 點擊 **Publish**
3. 等待 Google 審核（通常 1-3 天）

---

## 重要注意事項

### 敏感 Scopes 驗證
因為使用 `gmail.readonly`，必須通過 Google OAuth 驗證：
- 需要準備隱私政策
- 需要說明為何需要這些權限
- 可能需要提供展示影片

### 定價
Marketplace 不收取上架費用，但需要：
- Google Cloud 帳戶（有免費額度）
- 遵守 Marketplace 政策

### 後續維護
- 定期更新 add-on
- 回覆用戶評論
- 監控錯誤報告

---

## 快速連結

- [Apps Script Project](https://script.google.com/home/projects/1CqjJpbBvK_MLy4GkRcNtMhIZwyrS0hHUs8X7Tyn-Rm4tAmBxLuyz4peg/edit)
- [GCP Console](https://console.cloud.google.com)
- [Marketplace SDK](https://console.cloud.google.com/apis/api/appsmarket-component.googleapis.com)
- [OAuth Consent Screen](https://console.cloud.google.com/apis/credentials/consent)

---

**最後更新**: 2026-01-01
