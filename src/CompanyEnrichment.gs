/**
 * CompanyEnrichment.gs
 * Company data enrichment with LLM summary (Phase 3.4)
 *
 * Supports:
 * - Cloud: Gemini API (recommended)
 * - Local: Ollama (for privacy-conscious users)
 *
 * Model Recommendations:
 * - Cloud: Gemini 1.5 Flash (free tier: 15 RPM)
 * - Local: llama3.2:3b (8GB RAM) or qwen2.5:7b (16GB RAM)
 */

// ============ CONFIGURATION ============

/**
 * LLM Provider configuration
 * Users can change this in Settings sheet
 */
const LLM_CONFIG = {
  // Default provider: 'gemini', 'openai', 'ollama'
  provider: 'gemini',

  // Gemini settings
  gemini: {
    model: 'gemini-1.5-flash',
    apiKey: '' // Set via Settings sheet or Script Properties
  },

  // OpenAI settings (alternative)
  openai: {
    model: 'gpt-4o-mini',
    apiKey: ''
  },

  // Ollama settings (local)
  ollama: {
    model: 'llama3.2:3b', // Recommended: llama3.2:3b (8GB) or qwen2.5:7b (16GB)
    endpoint: 'http://localhost:11434/api/generate'
  }
};

// ============ COMPANY DATA ENRICHMENT ============

/**
 * Fetches company data from domain using free APIs.
 * @param {string} domain The company domain (e.g., 'acme.com').
 * @returns {Object} Company data object.
 */
function fetchCompanyData(domain) {
  if (!domain || isFreemailDomain(domain)) {
    return null;
  }

  // Check cache first (Accounts sheet)
  const cached = getAccountByDomain(domain);
  if (cached && cached.enriched_at) {
    // Check if cache is still valid (30 days)
    const cacheAge = Date.now() - new Date(cached.enriched_at).getTime();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    if (cacheAge < thirtyDays) {
      return cached;
    }
  }

  // Try to fetch from Clearbit (Logo only - free)
  const logoUrl = `https://logo.clearbit.com/${domain}`;

  // Build basic company data from domain
  const companyData = {
    domain: domain,
    company_name: guessCompanyFromDomain(domain),
    logo_url: logoUrl,
    website: `https://${domain}`,
    enriched_at: new Date().toISOString(),
    enrichment_source: 'domain_guess'
  };

  // Try Abstract API if key is available
  const abstractApiKey = getSettingOrProperty('abstract_api_key');
  if (abstractApiKey) {
    try {
      const abstractData = fetchFromAbstractAPI(domain, abstractApiKey);
      if (abstractData) {
        Object.assign(companyData, abstractData);
        companyData.enrichment_source = 'abstract_api';
      }
    } catch (e) {
      console.warn('Abstract API error:', e.message);
    }
  }

  return companyData;
}

/**
 * Fetches company data from Abstract API.
 * Free tier: 500 requests/month
 * @param {string} domain The company domain.
 * @param {string} apiKey Abstract API key.
 * @returns {Object|null} Company data or null.
 */
function fetchFromAbstractAPI(domain, apiKey) {
  const url = `https://companyenrichment.abstractapi.com/v1/?api_key=${apiKey}&domain=${domain}`;

  try {
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const code = response.getResponseCode();

    if (code !== 200) {
      console.warn('Abstract API returned:', code);
      return null;
    }

    const data = JSON.parse(response.getContentText());

    return {
      company_name: data.name || '',
      industry: data.industry || '',
      employee_count: data.employees_count || '',
      location: [data.city, data.country].filter(Boolean).join(', '),
      founded_year: data.year_founded || '',
      linkedin_url: data.linkedin_url || '',
      description: data.description || ''
    };
  } catch (e) {
    console.error('Abstract API fetch error:', e);
    return null;
  }
}

/**
 * Checks if domain is a free email provider.
 * @param {string} domain The domain to check.
 * @returns {boolean} True if free email provider.
 */
function isFreemailDomain(domain) {
  const freeProviders = [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
    'icloud.com', 'me.com', 'mail.com', 'protonmail.com',
    'qq.com', '163.com', 'live.com', 'msn.com'
  ];
  return freeProviders.includes(domain.toLowerCase());
}

// ============ LLM SUMMARY GENERATION ============

/**
 * Generates AI summary for company data.
 * @param {Object} companyData The company data object.
 * @returns {string} AI-generated summary (2-3 sentences).
 */
function generateCompanySummary(companyData) {
  if (!companyData || !companyData.company_name) {
    return '';
  }

  const provider = getSettingOrProperty('llm_provider') || LLM_CONFIG.provider;

  const prompt = buildCompanySummaryPrompt(companyData);

  try {
    switch (provider) {
      case 'gemini':
        return callGeminiAPI(prompt);
      case 'openai':
        return callOpenAIAPI(prompt);
      case 'ollama':
        return callOllamaAPI(prompt);
      default:
        console.warn('Unknown LLM provider:', provider);
        return '';
    }
  } catch (e) {
    console.error('LLM summary error:', e);
    return '';
  }
}

/**
 * Builds prompt for company summary.
 * @param {Object} data Company data.
 * @returns {string} The prompt.
 */
function buildCompanySummaryPrompt(data) {
  return `You are a B2B sales intelligence assistant. Based on the following company information, write a concise 2-3 sentence summary that would help a sales person understand:
1. What the company does
2. Their size/stage
3. Any relevant insights for sales outreach

Company Information:
- Name: ${data.company_name || 'Unknown'}
- Domain: ${data.domain || 'Unknown'}
- Industry: ${data.industry || 'Unknown'}
- Employees: ${data.employee_count || 'Unknown'}
- Location: ${data.location || 'Unknown'}
- Founded: ${data.founded_year || 'Unknown'}
- Description: ${data.description || 'No description available'}

Write ONLY the summary, no introduction or labels. Keep it under 100 words.`;
}

/**
 * Calls Gemini API for text generation.
 * Model: gemini-1.5-flash (recommended)
 * Free tier: 15 requests per minute
 * @param {string} prompt The prompt.
 * @returns {string} Generated text.
 */
function callGeminiAPI(prompt) {
  const apiKey = getSettingOrProperty('gemini_api_key');
  if (!apiKey) {
    throw new Error('Gemini API key not configured. Set gemini_api_key in Settings.');
  }

  const model = LLM_CONFIG.gemini.model;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      maxOutputTokens: 150,
      temperature: 0.7
    }
  };

  const response = UrlFetchApp.fetch(url, {
    method: 'POST',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  if (code !== 200) {
    const error = JSON.parse(response.getContentText());
    throw new Error(`Gemini API error: ${error.error?.message || code}`);
  }

  const result = JSON.parse(response.getContentText());
  return result.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/**
 * Calls OpenAI API for text generation.
 * Model: gpt-4o-mini (recommended for cost)
 * @param {string} prompt The prompt.
 * @returns {string} Generated text.
 */
function callOpenAIAPI(prompt) {
  const apiKey = getSettingOrProperty('openai_api_key');
  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Set openai_api_key in Settings.');
  }

  const url = 'https://api.openai.com/v1/chat/completions';

  const payload = {
    model: LLM_CONFIG.openai.model,
    messages: [
      { role: 'user', content: prompt }
    ],
    max_tokens: 150,
    temperature: 0.7
  };

  const response = UrlFetchApp.fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  if (code !== 200) {
    const error = JSON.parse(response.getContentText());
    throw new Error(`OpenAI API error: ${error.error?.message || code}`);
  }

  const result = JSON.parse(response.getContentText());
  return result.choices?.[0]?.message?.content || '';
}

/**
 * Calls local Ollama API for text generation.
 * Requires Ollama running locally with a model installed.
 *
 * Recommended models:
 * - llama3.2:3b (8GB RAM, fast)
 * - qwen2.5:7b (16GB RAM, better quality, good for Chinese)
 * - mistral:7b (16GB RAM, balanced)
 *
 * Note: Apps Script cannot directly call localhost.
 * This requires a proxy service or webhook relay.
 *
 * @param {string} prompt The prompt.
 * @returns {string} Generated text.
 */
function callOllamaAPI(prompt) {
  // Ollama endpoint - requires external proxy for Apps Script
  const endpoint = getSettingOrProperty('ollama_endpoint') || LLM_CONFIG.ollama.endpoint;
  const model = getSettingOrProperty('ollama_model') || LLM_CONFIG.ollama.model;

  // Note: Direct localhost calls don't work from Apps Script
  // Users need to set up a proxy (e.g., ngrok, Cloudflare Tunnel)
  // or use a cloud relay service

  if (endpoint.includes('localhost')) {
    console.warn('Ollama localhost not accessible from Apps Script. Use a proxy URL.');
    return '[Ollama requires proxy setup - see documentation]';
  }

  const payload = {
    model: model,
    prompt: prompt,
    stream: false,
    options: {
      temperature: 0.7,
      num_predict: 150
    }
  };

  try {
    const response = UrlFetchApp.fetch(endpoint, {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const code = response.getResponseCode();
    if (code !== 200) {
      throw new Error(`Ollama API error: ${code}`);
    }

    const result = JSON.parse(response.getContentText());
    return result.response || '';
  } catch (e) {
    console.error('Ollama API error:', e);
    throw e;
  }
}

// ============ ACCOUNTS SHEET OPERATIONS ============

/**
 * Gets account data by domain from Accounts sheet.
 * @param {string} domain The domain to look up.
 * @returns {Object|null} Account data or null.
 */
function getAccountByDomain(domain) {
  const ss = getOrCreateSpreadsheet();
  let sheet = ss.getSheetByName('Accounts');

  // Create Accounts sheet if it doesn't exist
  if (!sheet) {
    sheet = createAccountsSheet(ss);
  }

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return null; // Only headers

  const headers = data[0];
  const domainIndex = headers.indexOf('domain');

  for (let i = 1; i < data.length; i++) {
    if (data[i][domainIndex] === domain) {
      const account = {};
      headers.forEach((header, index) => {
        account[header] = data[i][index];
      });
      return account;
    }
  }

  return null;
}

/**
 * Saves or updates account data.
 * @param {Object} accountData The account data to save.
 * @returns {Object} The saved account data.
 */
function saveAccount(accountData) {
  const ss = getOrCreateSpreadsheet();
  let sheet = ss.getSheetByName('Accounts');

  if (!sheet) {
    sheet = createAccountsSheet(ss);
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const domainIndex = headers.indexOf('domain');

  // Check if account exists
  const data = sheet.getDataRange().getValues();
  let existingRow = -1;

  for (let i = 1; i < data.length; i++) {
    if (data[i][domainIndex] === accountData.domain) {
      existingRow = i + 1;
      break;
    }
  }

  // Build row data
  const row = headers.map(header => accountData[header] || '');

  if (existingRow > 0) {
    // Update existing row
    sheet.getRange(existingRow, 1, 1, row.length).setValues([row]);
  } else {
    // Append new row
    sheet.appendRow(row);
  }

  return accountData;
}

/**
 * Creates the Accounts sheet with proper headers.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss The spreadsheet.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} The created sheet.
 */
function createAccountsSheet(ss) {
  const sheet = ss.insertSheet('Accounts');
  const headers = [
    'domain',
    'company_name',
    'industry',
    'employee_count',
    'location',
    'website',
    'description',
    'ai_summary',
    'funding_stage',
    'funding_amount',
    'revenue_range',
    'founded_year',
    'logo_url',
    'linkedin_url',
    'enriched_at',
    'enrichment_source'
  ];

  sheet.appendRow(headers);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.setFrozenRows(1);

  return sheet;
}

// ============ HELPER FUNCTIONS ============

/**
 * Gets setting from Settings sheet or Script Properties.
 * @param {string} key The setting key.
 * @returns {string|null} The setting value.
 */
function getSettingOrProperty(key) {
  // Try Settings sheet first
  const sheetValue = getSetting(key);
  if (sheetValue) return sheetValue;

  // Fall back to Script Properties
  const props = PropertiesService.getScriptProperties();
  return props.getProperty(key);
}

/**
 * Enriches a company and generates AI summary.
 * Main entry point for company enrichment.
 * @param {string} domain The company domain.
 * @returns {Object} Enriched company data with AI summary.
 */
function enrichCompany(domain) {
  if (!domain || isFreemailDomain(domain)) {
    return null;
  }

  // Fetch company data
  const companyData = fetchCompanyData(domain);
  if (!companyData) return null;

  // Generate AI summary if we have enough data
  if (companyData.company_name && !companyData.ai_summary) {
    try {
      companyData.ai_summary = generateCompanySummary(companyData);
    } catch (e) {
      console.warn('Failed to generate AI summary:', e.message);
      companyData.ai_summary = '';
    }
  }

  // Save to Accounts sheet
  saveAccount(companyData);

  return companyData;
}
