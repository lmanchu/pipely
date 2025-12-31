/**
 * Code.gs
 * Main entry point for Pipely.
 */

// ============ TEAM COLLABORATION FUNCTIONS ============

/**
 * Gets the current user's email.
 * @returns {string} The current user's email.
 */
function getCurrentUserEmail() {
  return Session.getActiveUser().getEmail();
}

/**
 * Gets deals owned by the current user only.
 * @returns {Array<Object>} List of deals owned by current user.
 */
function getMyDeals() {
  const myEmail = getCurrentUserEmail();
  const allDeals = getDeals();
  return allDeals.filter(d => d.owner_email === myEmail);
}

/**
 * Assigns a deal to a new owner.
 * @param {string} dealId The deal ID.
 * @param {string} newOwnerEmail The new owner's email.
 * @returns {Object|null} The updated deal or null.
 */
function assignDeal(dealId, newOwnerEmail) {
  const deal = updateDeal(dealId, { owner_email: newOwnerEmail });

  if (deal) {
    // Send Slack notification about assignment
    const webhookUrl = getSetting('slack_webhook_url');
    if (webhookUrl) {
      const assignerEmail = getCurrentUserEmail();
      const message = {
        text: `:busts_in_silhouette: Deal assigned: *${deal.title}*`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `:busts_in_silhouette: *Deal Assigned*\n*${deal.title}*`
            }
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `From: ${assignerEmail} → To: ${newOwnerEmail}`
              }
            ]
          }
        ]
      };
      sendSlackNotification(webhookUrl, message);
    }
  }

  return deal;
}

/**
 * Gets list of team members who have access to the spreadsheet.
 * @returns {Array<Object>} List of team members with email and role.
 */
function getTeamMembers() {
  try {
    const ss = getOrCreateSpreadsheet();
    const editors = ss.getEditors();
    const viewers = ss.getViewers();
    const owner = ss.getOwner();

    const members = [];

    // Add owner
    if (owner) {
      members.push({
        email: owner.getEmail(),
        role: 'Owner',
        name: owner.getName() || owner.getEmail().split('@')[0]
      });
    }

    // Add editors
    editors.forEach(editor => {
      if (!members.find(m => m.email === editor.getEmail())) {
        members.push({
          email: editor.getEmail(),
          role: 'Editor',
          name: editor.getName() || editor.getEmail().split('@')[0]
        });
      }
    });

    // Add viewers
    viewers.forEach(viewer => {
      if (!members.find(m => m.email === viewer.getEmail())) {
        members.push({
          email: viewer.getEmail(),
          role: 'Viewer',
          name: viewer.getName() || viewer.getEmail().split('@')[0]
        });
      }
    });

    return members;
  } catch (e) {
    console.error('Error getting team members:', e);
    return [{ email: getCurrentUserEmail(), role: 'Owner', name: 'Me' }];
  }
}

/**
 * Gets dashboard data with optional filter for current user's deals only.
 * @param {boolean} myDealsOnly If true, only return current user's deals.
 * @returns {Object} Dashboard data including deals, stages, accounts, and team info.
 */
function getDashboardDataFiltered(myDealsOnly) {
  const allDeals = getDeals();
  const myEmail = getCurrentUserEmail();
  const deals = myDealsOnly
    ? allDeals.filter(d => d.owner_email === myEmail)
    : allDeals;

  const stages = getSetting('pipeline_stages').split(',');
  const teamMembers = getTeamMembers();

  // Get unique domains from deals
  const accountDomains = new Set();
  deals.forEach(deal => {
    if (deal.contact_email && deal.contact_email.includes('@')) {
      const domain = deal.contact_email.split('@')[1].toLowerCase();
      if (!isFreemailDomain(domain)) {
        accountDomains.add(domain);
      }
    }
  });

  // Build account summary
  const accounts = [];
  accountDomains.forEach(domain => {
    const accountData = getAccountByDomain(domain);
    const contacts = getContactsByDomain(domain);
    const dealCount = deals.filter(d =>
      d.contact_email && d.contact_email.toLowerCase().endsWith('@' + domain)
    ).length;

    accounts.push({
      domain: domain,
      company_name: accountData?.company_name || guessCompanyFromDomain(domain),
      logo_url: `https://logo.clearbit.com/${domain}`,
      contact_count: contacts.length,
      deal_count: dealCount
    });
  });

  return {
    deals: deals,
    allDealsCount: allDeals.length,
    myDealsCount: allDeals.filter(d => d.owner_email === myEmail).length,
    stages: stages,
    accounts: accounts,
    teamMembers: teamMembers,
    currentUserEmail: myEmail
  };
}

// ============ TEAM STATS & ACTIVITY FUNCTIONS ============

/**
 * Gets team performance statistics.
 * @returns {Object} Team stats including per-member breakdown.
 */
function getTeamStats() {
  const allDeals = getDeals();
  const teamMembers = getTeamMembers();
  const stages = getSetting('pipeline_stages').split(',');

  // Calculate stats per member
  const byMember = teamMembers.map(member => {
    const memberDeals = allDeals.filter(d => d.owner_email === member.email);
    const wonDeals = memberDeals.filter(d => d.stage === 'Won');

    return {
      email: member.email,
      name: member.name,
      role: member.role,
      dealCount: memberDeals.length,
      totalValue: memberDeals.reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0),
      wonDeals: wonDeals.length,
      wonValue: wonDeals.reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0),
      avgDealSize: memberDeals.length > 0
        ? memberDeals.reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0) / memberDeals.length
        : 0
    };
  });

  // Calculate stats per stage
  const byStage = stages.map(stage => {
    const stageDeals = allDeals.filter(d => d.stage === stage.trim());
    return {
      stage: stage.trim(),
      count: stageDeals.length,
      value: stageDeals.reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0)
    };
  });

  // Overall stats
  const totalValue = allDeals.reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0);
  const wonDeals = allDeals.filter(d => d.stage === 'Won');
  const wonValue = wonDeals.reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0);

  return {
    totalDeals: allDeals.length,
    totalValue: totalValue,
    wonDeals: wonDeals.length,
    wonValue: wonValue,
    winRate: allDeals.length > 0 ? (wonDeals.length / allDeals.length * 100).toFixed(1) : 0,
    avgDealSize: allDeals.length > 0 ? totalValue / allDeals.length : 0,
    byMember: byMember.sort((a, b) => b.totalValue - a.totalValue),
    byStage: byStage
  };
}

/**
 * Logs a deal activity to the Activity sheet.
 * @param {string} dealId The deal ID.
 * @param {string} action The action type (created, updated, stage_changed, assigned, won, lost).
 * @param {string} details Additional details about the action.
 * @param {string} dealTitle The deal title for display.
 */
function logDealActivity(dealId, action, details, dealTitle) {
  try {
    const ss = getOrCreateSpreadsheet();
    let activitySheet = ss.getSheetByName('Activity');

    // Create Activity sheet if it doesn't exist
    if (!activitySheet) {
      activitySheet = ss.insertSheet('Activity');
      activitySheet.getRange('A1:F1').setValues([['timestamp', 'deal_id', 'deal_title', 'action', 'actor', 'details']]);
      activitySheet.getRange('A1:F1').setFontWeight('bold');
      activitySheet.setFrozenRows(1);
    }

    const actor = getCurrentUserEmail();
    const timestamp = new Date().toISOString();

    activitySheet.appendRow([timestamp, dealId, dealTitle, action, actor, details]);

    // Keep only last 500 activities to prevent sheet bloat
    const lastRow = activitySheet.getLastRow();
    if (lastRow > 501) {
      activitySheet.deleteRows(2, lastRow - 501);
    }
  } catch (e) {
    console.error('Error logging activity:', e);
  }
}

/**
 * Gets deal activity history.
 * @param {number} limit Maximum number of activities to return.
 * @returns {Array<Object>} List of recent activities.
 */
function getDealActivityHistory(limit) {
  limit = limit || 50;

  try {
    const ss = getOrCreateSpreadsheet();
    const activitySheet = ss.getSheetByName('Activity');

    if (!activitySheet || activitySheet.getLastRow() <= 1) {
      return [];
    }

    const lastRow = activitySheet.getLastRow();
    const startRow = Math.max(2, lastRow - limit + 1);
    const numRows = lastRow - startRow + 1;

    const data = activitySheet.getRange(startRow, 1, numRows, 6).getValues();

    return data.map(row => ({
      timestamp: row[0],
      dealId: row[1],
      dealTitle: row[2],
      action: row[3],
      actor: row[4],
      details: row[5]
    })).reverse(); // Most recent first
  } catch (e) {
    console.error('Error getting activity history:', e);
    return [];
  }
}

/**
 * Gets team dashboard data including stats and activity.
 * @returns {Object} Complete team dashboard data.
 */
function getTeamDashboardData() {
  return {
    stats: getTeamStats(),
    recentActivity: getDealActivityHistory(30),
    teamMembers: getTeamMembers(),
    currentUserEmail: getCurrentUserEmail()
  };
}

// ============ WEB APP ENDPOINTS ============

/**
 * Serves the Dashboard web app.
 * @param {Object} e The event object.
 * @returns {GoogleAppsScript.HTML.HtmlOutput} The HTML page.
 */
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('Dashboard')
    .setTitle('Pipely Dashboard')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Gets all data for the dashboard.
 * @returns {Object} Dashboard data including deals, stages, and accounts.
 */
function getDashboardData() {
  const deals = getDeals();
  const stages = getSetting('pipeline_stages').split(',');

  // Get unique domains from deals and contacts
  const accountDomains = new Set();
  deals.forEach(deal => {
    if (deal.contact_email && deal.contact_email.includes('@')) {
      const domain = deal.contact_email.split('@')[1].toLowerCase();
      if (!isFreemailDomain(domain)) {
        accountDomains.add(domain);
      }
    }
  });

  // Build account summary
  const accounts = [];
  accountDomains.forEach(domain => {
    const accountData = getAccountByDomain(domain);
    const contacts = getContactsByDomain(domain);
    const dealCount = deals.filter(d =>
      d.contact_email && d.contact_email.toLowerCase().endsWith('@' + domain)
    ).length;

    accounts.push({
      domain: domain,
      company_name: accountData?.company_name || guessCompanyFromDomain(domain),
      logo_url: `https://logo.clearbit.com/${domain}`,
      contact_count: contacts.length,
      deal_count: dealCount
    });
  });

  return {
    deals: deals,
    stages: stages,
    accounts: accounts
  };
}

/**
 * Gets accounts data for dashboard.
 * @returns {Array<Object>} List of accounts with stats.
 */
function getAccountsData() {
  const ss = getOrCreateSpreadsheet();
  const accountSheet = ss.getSheetByName('Accounts');

  if (!accountSheet || accountSheet.getLastRow() <= 1) {
    return [];
  }

  const data = accountSheet.getDataRange().getValues();
  const headers = data.shift();
  const deals = getDeals();

  return data.map(row => {
    const account = {};
    headers.forEach((header, index) => {
      account[header] = row[index];
    });

    // Add stats
    const contacts = getContactsByDomain(account.domain);
    const dealCount = deals.filter(d =>
      d.contact_email && d.contact_email.toLowerCase().endsWith('@' + account.domain)
    ).length;

    account.contact_count = contacts.length;
    account.deal_count = dealCount;
    account.logo_url = account.logo_url || `https://logo.clearbit.com/${account.domain}`;

    return account;
  });
}

/**
 * Updates deal stage from dashboard (drag & drop).
 * @param {string} dealId The deal ID.
 * @param {string} newStage The new stage.
 * @returns {boolean} Success status.
 */
function updateDealStage(dealId, newStage) {
  const deal = updateDeal(dealId, { stage: newStage });
  return deal !== null;
}

/**
 * Updates deal from dashboard modal.
 * @param {string} dealId The deal ID.
 * @param {Object} updates The fields to update.
 * @returns {boolean} Success status.
 */
function updateDealFromDashboard(dealId, updates) {
  const deal = updateDeal(dealId, updates);
  return deal !== null;
}

/**
 * Deletes deal from dashboard.
 * @param {string} dealId The deal ID.
 * @returns {boolean} Success status.
 */
function deleteDealFromDashboard(dealId) {
  return deleteDeal(dealId);
}

// ============ GMAIL ADD-ON TRIGGERS ============

/**
 * Contextual trigger that runs when a user opens an email.
 * @param {Object} e The event object.
 * @returns {GoogleAppsScript.Card_Service.Card} The card to display.
 */
function onGmailMessage(e) {
  const contact = extractContactFromMessage(e);
  
  // Check for existing deals
  const allDeals = getDeals();
  const contactDeals = allDeals.filter(d => d.contact_email === contact.email);
  
  return buildContactCard(contact, contactDeals);
}

/**
 * Homepage trigger that runs when the user opens the add-on from the sidebar.
 * @param {Object} e The event object.
 * @returns {GoogleAppsScript.Card_Service.Card} The homepage card.
 */
function onHomepage(e) {
  const deals = getDeals();
  return buildPipelineCard(deals);
}

/**
 * Callback for "Add to Pipeline" button.
 * @param {Object} e The event object.
 * @returns {GoogleAppsScript.Card_Service.Card} The add deal form.
 */
function onAddDealClick(e) {
  const email = e.parameters.email;
  const name = e.parameters.name;
  const company = e.parameters.company;
  return buildAddDealForm(email, name, company);
}

/**
 * Callback for "Save Deal" button.
 * @param {Object} e The event object.
 * @returns {GoogleAppsScript.Card_Service.ActionResponse} Action response to pop the card.
 */
function onSaveDeal(e) {
  const form = e.formInput;
  const email = e.parameters.email;
  const name = e.parameters.name;
  const company = e.parameters.company;
  
  // Create contact if not exists
  const contact = createOrUpdateContact({
    email: email,
    name: name,
    company: company
  });
  
  // Calculate due date if specified
  const dueDateDays = parseInt(form.due_date_days) || 0;
  let dueDate = '';
  if (dueDateDays > 0) {
    const date = new Date();
    date.setDate(date.getDate() + dueDateDays);
    dueDate = Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }

  // Create deal
  const dealData = {
    title: form.title,
    value: form.value,
    stage: form.stage,
    notes: form.notes,
    contact_email: email,
    currency: getSetting('default_currency'),
    due_date: dueDate
  };

  const deal = createDeal(dealData);
  
  // Send notification
  const webhookUrl = getSetting('slack_webhook_url');
  if (webhookUrl) {
    const message = formatNewDealMessage(deal, contact);
    sendSlackNotification(webhookUrl, message);
  }
  
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText('Deal created successfully!'))
    .setNavigation(CardService.newNavigation().popCard().updateCard(buildContactCard(contact, [deal])))
    .build();
}

/**
 * Callback for clicking on a deal.
 * @param {Object} e The event object.
 * @returns {GoogleAppsScript.Card_Service.Card} The deal detail card.
 */
function onDealClick(e) {
  const dealId = e.parameters.dealId;
  const allDeals = getDeals();
  const deal = allDeals.find(d => d.deal_id === dealId);
  
  if (!deal) {
    return CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader().setTitle('Error'))
      .addSection(CardService.newCardSection().addWidget(CardService.newTextParagraph().setText('Deal not found.')))
      .build();
  }
  
  return buildDealCard(deal);
}

/**
 * Callback for updating a deal stage.
 * @param {Object} e The event object.
 * @returns {GoogleAppsScript.Card_Service.ActionResponse} Action response.
 */
function onUpdateStage(e) {
  const dealId = e.parameters.dealId;
  const oldStage = e.parameters.oldStage;
  const newStage = e.formInput.new_stage;
  
  if (oldStage === newStage) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText('No changes made.'))
      .build();
  }
  
  const deal = updateDeal(dealId, { stage: newStage });
  
  if (deal) {
    // Send notification
    const webhookUrl = getSetting('slack_webhook_url');
    if (webhookUrl) {
      const message = formatStageChangeMessage(deal, oldStage, newStage);
      sendSlackNotification(webhookUrl, message);
    }

    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText('Stage updated!'))
      .setNavigation(CardService.newNavigation().popCard().updateCard(buildDealCard(deal)))
      .build();
  } else {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText('Error updating deal.'))
      .build();
  }
}

/**
 * Callback for updating deal notes.
 * @param {Object} e The event object.
 * @returns {GoogleAppsScript.Card_Service.ActionResponse} Action response.
 */
function onUpdateNotes(e) {
  const dealId = e.parameters.dealId;
  const existingNotes = e.parameters.existingNotes || '';
  const additionalNotes = e.formInput.additional_notes;

  if (!additionalNotes || additionalNotes.trim() === '') {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText('Please enter some notes.'))
      .build();
  }

  // Append new notes with timestamp
  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
  const newNotes = existingNotes
    ? `${existingNotes}\n\n[${timestamp}]\n${additionalNotes.trim()}`
    : `[${timestamp}]\n${additionalNotes.trim()}`;

  const deal = updateDeal(dealId, { notes: newNotes });

  if (deal) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText('Notes added!'))
      .setNavigation(CardService.newNavigation().updateCard(buildDealCard(deal)))
      .build();
  } else {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText('Error updating notes.'))
      .build();
  }
}

/**
 * Callback for updating deal tags.
 * @param {Object} e The event object.
 * @returns {GoogleAppsScript.Card_Service.ActionResponse} Action response.
 */
function onUpdateTags(e) {
  const dealId = e.parameters.dealId;
  const newTags = e.formInput.new_tags || '';

  const deal = updateDeal(dealId, { tags: newTags.trim() });

  if (deal) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText('Tags updated!'))
      .setNavigation(CardService.newNavigation().updateCard(buildDealCard(deal)))
      .build();
  } else {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText('Error updating tags.'))
      .build();
  }
}

/**
 * Callback for deleting a deal.
 * @param {Object} e The event object.
 * @returns {GoogleAppsScript.Card_Service.ActionResponse} Action response.
 */
function onDeleteDeal(e) {
  const dealId = e.parameters.dealId;
  const dealTitle = e.parameters.dealTitle;

  const success = deleteDeal(dealId);

  if (success) {
    // Send notification
    const webhookUrl = getSetting('slack_webhook_url');
    if (webhookUrl) {
      const message = {
        text: `:wastebasket: Deal deleted: *${dealTitle}*`
      };
      sendSlackNotification(webhookUrl, message);
    }

    // Navigate back to pipeline overview
    const deals = getDeals();
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText('Deal deleted!'))
      .setNavigation(CardService.newNavigation().popToRoot().updateCard(buildPipelineCard(deals)))
      .build();
  } else {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText('Error deleting deal.'))
      .build();
  }
}

// ============ FOLLOW-UP CALLBACKS (Google Tasks) ============

/**
 * Callback for creating a quick follow-up task.
 * @param {Object} e The event object.
 * @returns {GoogleAppsScript.Card_Service.ActionResponse} Action response.
 */
function onCreateFollowUp(e) {
  const dealId = e.parameters.dealId;
  const action = e.parameters.action;
  const days = parseInt(e.parameters.days) || 1;

  try {
    const task = createQuickFollowUp(dealId, action, days);

    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
        .setText('Follow-up added to Google Tasks!'))
      .build();
  } catch (error) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
        .setText('Error: ' + error.message))
      .build();
  }
}

/**
 * Callback for custom follow-up form.
 * @param {Object} e The event object.
 * @returns {GoogleAppsScript.Card_Service.Card} The custom follow-up form.
 */
function onCustomFollowUp(e) {
  const dealId = e.parameters.dealId;
  const deal = getDealById(dealId);

  if (!deal) {
    return CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader().setTitle('Error'))
      .addSection(CardService.newCardSection()
        .addWidget(CardService.newTextParagraph().setText('Deal not found.')))
      .build();
  }

  // Action type dropdown
  const actionSelect = CardService.newSelectionInput()
    .setFieldName('action_type')
    .setTitle('Action Type')
    .setType(CardService.SelectionInputType.DROPDOWN)
    .addItem('Follow-up Call', 'call', true)
    .addItem('Send Email', 'email', false)
    .addItem('Schedule Meeting', 'meeting', false)
    .addItem('Send Proposal', 'proposal', false)
    .addItem('Schedule Demo', 'demo', false)
    .addItem('Check In', 'check_in', false)
    .addItem('Other', 'other', false);

  // Custom description
  const descInput = CardService.newTextInput()
    .setFieldName('custom_desc')
    .setTitle('Description (optional)')
    .setHint('Override default action description');

  // Due date selection
  const dueDateSelect = CardService.newSelectionInput()
    .setFieldName('due_days')
    .setTitle('Due Date')
    .setType(CardService.SelectionInputType.DROPDOWN)
    .addItem('Today', '0', false)
    .addItem('Tomorrow', '1', true)
    .addItem('In 2 days', '2', false)
    .addItem('In 3 days', '3', false)
    .addItem('In 1 week', '7', false)
    .addItem('In 2 weeks', '14', false)
    .addItem('In 1 month', '30', false);

  const createAction = CardService.newAction()
    .setFunctionName('onSaveCustomFollowUp')
    .setParameters({ dealId: dealId });

  const createButton = CardService.newTextButton()
    .setText('Create Task')
    .setOnClickAction(createAction);

  const section = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph()
      .setText(`<b>Deal:</b> ${deal.title}`))
    .addWidget(actionSelect)
    .addWidget(descInput)
    .addWidget(dueDateSelect)
    .addWidget(createButton);

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Custom Follow-up'))
    .addSection(section)
    .build();
}

/**
 * Callback for saving custom follow-up.
 * @param {Object} e The event object.
 * @returns {GoogleAppsScript.Card_Service.ActionResponse} Action response.
 */
function onSaveCustomFollowUp(e) {
  const dealId = e.parameters.dealId;
  const form = e.formInput;

  const actionType = form.action_type || 'other';
  const customDesc = form.custom_desc || '';
  const dueDays = parseInt(form.due_days) || 1;

  try {
    const deal = getDealById(dealId);
    if (!deal) {
      throw new Error('Deal not found');
    }

    // Use custom description if provided
    const actionMap = {
      'call': 'Follow-up call',
      'email': 'Send follow-up email',
      'meeting': 'Schedule meeting',
      'proposal': 'Send proposal',
      'demo': 'Schedule demo',
      'check_in': 'Check in',
      'other': 'Follow up'
    };

    const action = customDesc || actionMap[actionType] || 'Follow up';

    // Calculate due date
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + dueDays);
    dueDate.setHours(9, 0, 0, 0);

    createFollowUpTask(deal, action, dueDate);

    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
        .setText('Follow-up task created!'))
      .setNavigation(CardService.newNavigation().popCard())
      .build();
  } catch (error) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
        .setText('Error: ' + error.message))
      .build();
  }
}

// ============ ACCOUNT MAP CALLBACKS ============

/**
 * Callback for clicking on a contact in Account Map.
 * @param {Object} e The event object.
 * @returns {GoogleAppsScript.Card_Service.Card} The contact detail card.
 */
function onContactClick(e) {
  const email = e.parameters.email;
  const contact = getContactByEmail(email);

  if (!contact) {
    return CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader().setTitle('Error'))
      .addSection(CardService.newCardSection()
        .addWidget(CardService.newTextParagraph().setText('Contact not found.')))
      .build();
  }

  return buildContactDetailCard(contact);
}

/**
 * Callback for updating contact role information.
 * @param {Object} e The event object.
 * @returns {GoogleAppsScript.Card_Service.ActionResponse} Action response.
 */
function onUpdateContactRole(e) {
  const email = e.parameters.email;
  const jobTitle = e.formInput.job_title || '';
  const jobLevel = e.formInput.job_level || 'Unknown';
  const relationship = e.formInput.relationship || 'Unknown';

  // Auto-guess job level if job title changed and level is still Unknown
  let finalJobLevel = jobLevel;
  if (jobTitle && jobLevel === 'Unknown') {
    finalJobLevel = guessJobLevel(jobTitle);
  }

  const updates = {
    job_title: jobTitle,
    job_level: finalJobLevel,
    relationship: relationship
  };

  const contact = updateContact(email, updates);

  if (contact) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText('Contact updated!'))
      .setNavigation(CardService.newNavigation().updateCard(buildContactDetailCard(contact)))
      .build();
  } else {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText('Error updating contact.'))
      .build();
  }
}

/**
 * Callback for adding a new contact to an account.
 * @param {Object} e The event object.
 * @returns {GoogleAppsScript.Card_Service.Card} The add contact form.
 */
function onAddContactToAccount(e) {
  const domain = e.parameters.domain;

  const inputEmail = CardService.newTextInput()
    .setFieldName('email')
    .setTitle('Email')
    .setHint(`e.g., john@${domain}`);

  const inputName = CardService.newTextInput()
    .setFieldName('name')
    .setTitle('Name');

  const inputJobTitle = CardService.newTextInput()
    .setFieldName('job_title')
    .setTitle('Job Title');

  const jobLevelSelect = CardService.newSelectionInput()
    .setFieldName('job_level')
    .setTitle('Job Level')
    .setType(CardService.SelectionInputType.DROPDOWN);

  ['C-Level', 'VP', 'Director', 'Manager', 'Individual', 'Unknown'].forEach(level => {
    jobLevelSelect.addItem(level, level, level === 'Unknown');
  });

  const relationshipSelect = CardService.newSelectionInput()
    .setFieldName('relationship')
    .setTitle('Relationship')
    .setType(CardService.SelectionInputType.DROPDOWN);

  ['Decision Maker', 'Economic Buyer', 'Champion', 'Influencer', 'Blocker', 'User', 'Unknown'].forEach(rel => {
    relationshipSelect.addItem(rel, rel, rel === 'Unknown');
  });

  const saveAction = CardService.newAction()
    .setFunctionName('onSaveNewContact')
    .setParameters({ domain: domain });

  const saveButton = CardService.newTextButton()
    .setText('Add Contact')
    .setOnClickAction(saveAction);

  const section = CardService.newCardSection()
    .addWidget(inputEmail)
    .addWidget(inputName)
    .addWidget(inputJobTitle)
    .addWidget(jobLevelSelect)
    .addWidget(relationshipSelect)
    .addWidget(saveButton);

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Add Contact'))
    .addSection(section)
    .build();
}

/**
 * Callback for saving a new contact.
 * @param {Object} e The event object.
 * @returns {GoogleAppsScript.Card_Service.ActionResponse} Action response.
 */
function onSaveNewContact(e) {
  const domain = e.parameters.domain;
  const form = e.formInput;

  if (!form.email || !form.email.includes('@')) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText('Please enter a valid email.'))
      .build();
  }

  // Verify email belongs to the domain
  const emailDomain = form.email.split('@')[1].toLowerCase();
  if (emailDomain !== domain.toLowerCase()) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText(`Email must be from ${domain}`))
      .build();
  }

  // Auto-guess job level if not set
  let jobLevel = form.job_level || 'Unknown';
  if (form.job_title && jobLevel === 'Unknown') {
    jobLevel = guessJobLevel(form.job_title);
  }

  // Create the contact
  const contact = createOrUpdateContact({
    email: form.email,
    name: form.name || '',
    company: domain
  });

  // Update role info
  updateContact(form.email, {
    job_title: form.job_title || '',
    job_level: jobLevel,
    relationship: form.relationship || 'Unknown'
  });

  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText('Contact added!'))
    .setNavigation(CardService.newNavigation().popCard())
    .build();
}
