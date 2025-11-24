/**
 * Sheets.gs
 * Handles all Google Sheets database operations for Pipely.
 */

// Script Property key for storing the Spreadsheet ID
const PROP_SPREADSHEET_ID = 'PIPELY_SPREADSHEET_ID';

/**
 * Gets the Pipely spreadsheet or creates it if it doesn't exist.
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet} The Pipely spreadsheet.
 */
function getOrCreateSpreadsheet() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty(PROP_SPREADSHEET_ID);

  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch (e) {
      console.warn('Spreadsheet not found with ID: ' + id + '. Creating a new one.');
    }
  }

  const ss = SpreadsheetApp.create('Pipely CRM Database');
  initializeSheets(ss);
  props.setProperty(PROP_SPREADSHEET_ID, ss.getId());
  return ss;
}

/**
 * Initializes the spreadsheet with required sheets and headers.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss The spreadsheet to initialize.
 */
function initializeSheets(ss) {
  const sheets = [
    {
      name: 'Deals',
      headers: ['deal_id', 'title', 'contact_email', 'stage', 'value', 'currency', 'owner_email', 'due_date', 'notes', 'tags', 'email_thread_id', 'created_at', 'updated_at']
    },
    {
      name: 'Contacts',
      headers: ['email', 'name', 'company', 'phone', 'linkedin', 'notes', 'created_at', 'avatar_url', 'company_logo_url', 'linkedin_guess_url', 'enriched_at']
    },
    {
      name: 'Activities',
      headers: ['activity_id', 'deal_id', 'type', 'content', 'user_email', 'created_at']
    },
    {
      name: 'Settings',
      headers: ['key', 'value']
    }
  ];

  sheets.forEach(sheetConfig => {
    let sheet = ss.getSheetByName(sheetConfig.name);
    if (!sheet) {
      sheet = ss.insertSheet(sheetConfig.name);
      // Remove default Sheet1 if it exists and we just created the first custom sheet
      if (ss.getSheets().length > 1 && ss.getSheetByName('Sheet1')) {
        ss.deleteSheet(ss.getSheetByName('Sheet1'));
      }
    }
    
    // Set headers if the sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(sheetConfig.headers);
      sheet.getRange(1, 1, 1, sheetConfig.headers.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
  });
  
  // Initialize default settings if empty
  const settingsSheet = ss.getSheetByName('Settings');
  if (settingsSheet.getLastRow() <= 1) {
    settingsSheet.appendRow(['pipeline_stages', 'Lead,Qualified,Proposal,Negotiation,Closed Won,Closed Lost']);
    settingsSheet.appendRow(['default_currency', 'USD']);
    settingsSheet.appendRow(['slack_webhook_url', '']);
  }
}

/**
 * Gets all deals, optionally filtered.
 * @param {Object} filter Optional filter criteria (not fully implemented in this lightweight version).
 * @returns {Array<Object>} List of deal objects.
 */
function getDeals(filter) {
  const ss = getOrCreateSpreadsheet();
  const sheet = ss.getSheetByName('Deals');
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  
  const deals = data.map(row => {
    const deal = {};
    headers.forEach((header, index) => {
      deal[header] = row[index];
    });
    return deal;
  });

  // Basic filtering could go here
  return deals;
}

/**
 * Creates a new deal.
 * @param {Object} data Deal data.
 * @returns {Object} The created deal object.
 */
function createDeal(data) {
  const ss = getOrCreateSpreadsheet();
  const sheet = ss.getSheetByName('Deals');
  
  const dealId = 'D' + Math.floor(Date.now() / 1000);
  const now = new Date();
  
  const row = [
    dealId,
    data.title || '',
    data.contact_email || '',
    data.stage || 'Lead',
    data.value || 0,
    data.currency || 'USD',
    Session.getActiveUser().getEmail(),
    data.due_date || '',
    data.notes || '',
    data.tags || '',
    data.email_thread_id || '',
    now,
    now
  ];
  
  sheet.appendRow(row);
  
  // Return the object representation
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const deal = {};
  headers.forEach((header, index) => {
    deal[header] = row[index];
  });
  
  return deal;
}

/**
 * Updates an existing deal.
 * @param {string} dealId The ID of the deal to update.
 * @param {Object} data The data to update.
 * @returns {Object|null} The updated deal object or null if not found.
 */
function updateDeal(dealId, data) {
  const ss = getOrCreateSpreadsheet();
  const sheet = ss.getSheetByName('Deals');
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idIndex = headers.indexOf('deal_id');
  
  // Find the row (1-based index)
  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (values[i][idIndex] === dealId) {
      rowIndex = i + 1;
      break;
    }
  }
  
  if (rowIndex === -1) return null;
  
  const now = new Date();
  
  // Update fields
  Object.keys(data).forEach(key => {
    const colIndex = headers.indexOf(key);
    if (colIndex !== -1) {
      sheet.getRange(rowIndex, colIndex + 1).setValue(data[key]);
    }
  });
  
  // Always update updated_at
  const updatedAtIndex = headers.indexOf('updated_at');
  if (updatedAtIndex !== -1) {
    sheet.getRange(rowIndex, updatedAtIndex + 1).setValue(now);
  }
  
  // Return updated object
  const updatedRow = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
  const deal = {};
  headers.forEach((header, index) => {
    deal[header] = updatedRow[index];
  });
  
  return deal;
}

/**
 * Finds a contact by email.
 * @param {string} email The email to search for.
 * @returns {Object|null} The contact object or null if not found.
 */
function getContactByEmail(email) {
  const ss = getOrCreateSpreadsheet();
  const sheet = ss.getSheetByName('Contacts');
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  const emailIndex = headers.indexOf('email');
  
  for (let i = 0; i < data.length; i++) {
    if (data[i][emailIndex] === email) {
      const contact = {};
      headers.forEach((header, index) => {
        contact[header] = data[i][index];
      });
      return contact;
    }
  }
  
  return null;
}

/**
 * Creates or updates a contact.
 * @param {Object} data Contact data.
 * @returns {Object} The contact object.
 */
function createOrUpdateContact(data) {
  const existing = getContactByEmail(data.email);
  if (existing) {
    // If contact exists but hasn't been enriched, enrich it now
    if (!existing.enriched_at && data.email) {
      updateContactEnrichment(data.email);
    }
    return existing;
  }

  const ss = getOrCreateSpreadsheet();
  const sheet = ss.getSheetByName('Contacts');
  const now = new Date();

  // Enrich contact data
  const enriched = enrichContact(data);

  // Use enriched company if original is empty
  const company = data.company || enriched.company_guess || '';

  const row = [
    data.email,
    data.name || '',
    company,
    data.phone || '',
    data.linkedin || enriched.linkedin_guess_url || '',
    data.notes || '',
    now,
    enriched.avatar_url || '',
    enriched.company_logo_url || '',
    enriched.linkedin_guess_url || '',
    now  // enriched_at
  ];

  sheet.appendRow(row);

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const contact = {};
  headers.forEach((header, index) => {
    contact[header] = row[index];
  });

  return contact;
}

/**
 * Updates enrichment data for an existing contact.
 * @param {string} email The contact email.
 * @returns {boolean} True if updated successfully.
 */
function updateContactEnrichment(email) {
  const ss = getOrCreateSpreadsheet();
  const sheet = ss.getSheetByName('Contacts');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const emailIndex = headers.indexOf('email');

  // Find the row
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][emailIndex] === email) {
      rowIndex = i + 1;  // 1-based for sheet operations
      break;
    }
  }

  if (rowIndex === -1) return false;

  // Get current contact data
  const nameIndex = headers.indexOf('name');
  const name = data[rowIndex - 1][nameIndex];

  // Enrich
  const enriched = enrichContact({ email: email, name: name });
  const now = new Date();

  // Update enrichment columns
  const fieldsToUpdate = {
    'avatar_url': enriched.avatar_url,
    'company_logo_url': enriched.company_logo_url,
    'linkedin_guess_url': enriched.linkedin_guess_url,
    'enriched_at': now
  };

  Object.keys(fieldsToUpdate).forEach(field => {
    const colIndex = headers.indexOf(field);
    if (colIndex !== -1) {
      sheet.getRange(rowIndex, colIndex + 1).setValue(fieldsToUpdate[field]);
    }
  });

  return true;
}

/**
 * Gets a setting value.
 * @param {string} key The setting key.
 * @returns {string|null} The setting value.
 */
function getSetting(key) {
  const ss = getOrCreateSpreadsheet();
  const sheet = ss.getSheetByName('Settings');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      return data[i][1];
    }
  }
  return null;
}
