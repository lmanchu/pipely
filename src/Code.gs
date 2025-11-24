/**
 * Code.gs
 * Main entry point for Pipely.
 */

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
  
  // Create deal
  const dealData = {
    title: form.title,
    value: form.value,
    stage: form.stage,
    notes: form.notes,
    contact_email: email,
    currency: getSetting('default_currency')
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
