/**
 * Cards.gs
 * Builds CardService UI components for Pipely.
 */

/**
 * Builds the contact card showing sender info and existing deals.
 * @param {Object} contact The contact object.
 * @param {Array<Object>} deals List of existing deals for this contact.
 * @returns {GoogleAppsScript.Card_Service.Card} The contact card.
 */
function buildContactCard(contact, deals) {
  // Enrich contact with avatar, logo, and LinkedIn
  const enriched = enrichContact(contact);
  const domain = enriched.domain;

  // Build header section with avatar
  const headerSection = CardService.newCardSection();

  // Add avatar image (Gravatar)
  if (enriched.avatar_url) {
    headerSection.addWidget(
      CardService.newImage()
        .setImageUrl(enriched.avatar_url)
        .setAltText(contact.name || 'Avatar')
    );
  }

  // Contact name with company logo inline (if available)
  const displayName = contact.name || 'Unknown';
  const displayCompany = contact.company || enriched.company_guess || 'Unknown';

  headerSection
    .addWidget(CardService.newKeyValue()
      .setTopLabel('Name')
      .setContent(displayName)
      .setIcon(CardService.Icon.PERSON))
    .addWidget(CardService.newKeyValue()
      .setTopLabel('Email')
      .setContent(contact.email)
      .setIcon(CardService.Icon.EMAIL));

  // Company section with logo
  if (enriched.company_logo_url && domain) {
    headerSection.addWidget(
      CardService.newDecoratedText()
        .setTopLabel('Company')
        .setText(displayCompany)
        .setStartIcon(CardService.newIconImage()
          .setIconUrl(enriched.company_logo_url)
          .setAltText(displayCompany))
    );
  } else {
    headerSection.addWidget(CardService.newKeyValue()
      .setTopLabel('Company')
      .setContent(displayCompany)
      .setIcon(CardService.Icon.MEMBERSHIP));
  }

  // Add LinkedIn button if we have a guess
  if (enriched.linkedin_guess_url) {
    headerSection.addWidget(
      CardService.newTextButton()
        .setText('View LinkedIn (guess)')
        .setOpenLink(CardService.newOpenLink()
          .setUrl(enriched.linkedin_guess_url)
          .setOpenAs(CardService.OpenAs.OVERLAY))
    );
  }

  const section = headerSection;

  const card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Pipely CRM'))
    .addSection(section);

  // Add Company Insights section if domain is not freemail
  if (domain && !isFreemailDomain(domain)) {
    const companySection = buildCompanyInsightsSection(domain);
    if (companySection) {
      card.addSection(companySection);
    }

    // Add Account Map section
    const accountMapSection = buildAccountMapSection(domain);
    if (accountMapSection) {
      card.addSection(accountMapSection);
    }
  }

  if (deals && deals.length > 0) {
    const dealsSection = CardService.newCardSection().setHeader('Active Deals');
    deals.forEach(deal => {
      dealsSection.addWidget(CardService.newKeyValue()
        .setTopLabel(deal.stage)
        .setContent(deal.title)
        .setBottomLabel(`${deal.currency} ${deal.value}`)
        .setOnClickAction(CardService.newAction()
          .setFunctionName('onDealClick')
          .setParameters({ dealId: deal.deal_id })));
    });
    card.addSection(dealsSection);
  } else {
    const action = CardService.newAction()
      .setFunctionName('onAddDealClick')
      .setParameters({ 
        email: contact.email,
        name: contact.name,
        company: contact.company
      });
      
    const button = CardService.newTextButton()
      .setText('Add to Pipeline')
      .setOnClickAction(action);
      
    card.addSection(CardService.newCardSection().addWidget(button));
  }

  return card.build();
}

/**
 * Builds the company insights section with AI summary.
 * @param {string} domain The company domain.
 * @returns {GoogleAppsScript.Card_Service.CardSection|null} The company section or null.
 */
function buildCompanyInsightsSection(domain) {
  try {
    // Try to get or enrich company data
    let companyData = getAccountByDomain(domain);

    // If no cached data, try to enrich (but don't block UI)
    if (!companyData) {
      companyData = enrichCompany(domain);
    }

    if (!companyData || !companyData.company_name) {
      return null;
    }

    const section = CardService.newCardSection()
      .setHeader('Company Insights')
      .setCollapsible(true)
      .setNumUncollapsibleWidgets(2);

    // Company info
    if (companyData.industry) {
      section.addWidget(CardService.newKeyValue()
        .setTopLabel('Industry')
        .setContent(companyData.industry));
    }

    if (companyData.employee_count) {
      section.addWidget(CardService.newKeyValue()
        .setTopLabel('Employees')
        .setContent(String(companyData.employee_count)));
    }

    if (companyData.location) {
      section.addWidget(CardService.newKeyValue()
        .setTopLabel('Location')
        .setContent(companyData.location));
    }

    if (companyData.founded_year) {
      section.addWidget(CardService.newKeyValue()
        .setTopLabel('Founded')
        .setContent(String(companyData.founded_year)));
    }

    // AI Summary (the key feature!)
    if (companyData.ai_summary) {
      section.addWidget(CardService.newTextParagraph()
        .setText('<b>AI Insights:</b>\n' + companyData.ai_summary));
    }

    // View website button
    if (companyData.website) {
      section.addWidget(CardService.newTextButton()
        .setText('Visit Website')
        .setOpenLink(CardService.newOpenLink()
          .setUrl(companyData.website)
          .setOpenAs(CardService.OpenAs.OVERLAY)));
    }

    // LinkedIn company page
    if (companyData.linkedin_url) {
      section.addWidget(CardService.newTextButton()
        .setText('LinkedIn Company Page')
        .setOpenLink(CardService.newOpenLink()
          .setUrl(companyData.linkedin_url)
          .setOpenAs(CardService.OpenAs.OVERLAY)));
    }

    return section;
  } catch (e) {
    console.warn('Failed to build company insights:', e.message);
    return null;
  }
}

/**
 * Builds a form to add a new deal.
 * @param {string} email Contact email.
 * @param {string} name Contact name.
 * @param {string} company Contact company.
 * @returns {GoogleAppsScript.Card_Service.Card} The add deal form.
 */
function buildAddDealForm(email, name, company) {
  const inputTitle = CardService.newTextInput()
    .setFieldName('title')
    .setTitle('Deal Title')
    .setValue(`Deal with ${company || name}`);

  const inputValue = CardService.newTextInput()
    .setFieldName('value')
    .setTitle('Value')
    .setValue('0');

  const stages = getSetting('pipeline_stages').split(',');
  const inputStage = CardService.newSelectionInput()
    .setFieldName('stage')
    .setTitle('Stage')
    .setType(CardService.SelectionInputType.DROPDOWN);
    
  stages.forEach(stage => {
    inputStage.addItem(stage, stage, stage === stages[0]);
  });

  const inputNotes = CardService.newTextInput()
    .setFieldName('notes')
    .setTitle('Notes')
    .setMultiline(true);

  const saveAction = CardService.newAction()
    .setFunctionName('onSaveDeal')
    .setParameters({ email: email, name: name, company: company });

  const saveButton = CardService.newTextButton()
    .setText('Save Deal')
    .setOnClickAction(saveAction);

  const section = CardService.newCardSection()
    .addWidget(inputTitle)
    .addWidget(inputValue)
    .addWidget(inputStage)
    .addWidget(inputNotes)
    .addWidget(saveButton);

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('New Deal'))
    .addSection(section)
    .build();
}

/**
 * Builds a card showing deal details.
 * @param {Object} deal The deal object.
 * @returns {GoogleAppsScript.Card_Service.Card} The deal detail card.
 */
function buildDealCard(deal) {
  const stages = getSetting('pipeline_stages').split(',');

  // Stage update section
  const stageSelect = CardService.newSelectionInput()
    .setFieldName('new_stage')
    .setTitle('Update Stage')
    .setType(CardService.SelectionInputType.DROPDOWN);

  stages.forEach(stage => {
    stageSelect.addItem(stage, stage, stage === deal.stage);
  });

  const updateAction = CardService.newAction()
    .setFunctionName('onUpdateStage')
    .setParameters({ dealId: deal.deal_id, oldStage: deal.stage });

  const updateButton = CardService.newTextButton()
    .setText('Update Stage')
    .setOnClickAction(updateAction);

  // Main info section
  const infoSection = CardService.newCardSection()
    .addWidget(CardService.newKeyValue().setTopLabel('Title').setContent(deal.title))
    .addWidget(CardService.newKeyValue().setTopLabel('Value').setContent(`${deal.currency} ${deal.value}`))
    .addWidget(CardService.newKeyValue().setTopLabel('Contact').setContent(deal.contact_email || '-'))
    .addWidget(stageSelect)
    .addWidget(updateButton);

  // Tags section
  const tagsSection = CardService.newCardSection()
    .setHeader('Tags');

  const currentTags = deal.tags ? deal.tags.split(',').map(t => t.trim()).filter(t => t) : [];
  if (currentTags.length > 0) {
    tagsSection.addWidget(CardService.newTextParagraph()
      .setText(currentTags.map(t => `[${t}]`).join(' ')));
  }

  const tagsInput = CardService.newTextInput()
    .setFieldName('new_tags')
    .setTitle('Edit Tags (comma separated)')
    .setValue(deal.tags || '');

  const updateTagsAction = CardService.newAction()
    .setFunctionName('onUpdateTags')
    .setParameters({ dealId: deal.deal_id });

  const updateTagsButton = CardService.newTextButton()
    .setText('Update Tags')
    .setOnClickAction(updateTagsAction);

  tagsSection
    .addWidget(tagsInput)
    .addWidget(updateTagsButton);

  // Notes section
  const notesSection = CardService.newCardSection()
    .setHeader('Notes');

  if (deal.notes) {
    notesSection.addWidget(CardService.newTextParagraph()
      .setText(deal.notes));
  }

  const notesInput = CardService.newTextInput()
    .setFieldName('additional_notes')
    .setTitle('Add Notes')
    .setMultiline(true);

  const updateNotesAction = CardService.newAction()
    .setFunctionName('onUpdateNotes')
    .setParameters({ dealId: deal.deal_id, existingNotes: deal.notes || '' });

  const updateNotesButton = CardService.newTextButton()
    .setText('Add Notes')
    .setOnClickAction(updateNotesAction);

  notesSection
    .addWidget(notesInput)
    .addWidget(updateNotesButton);

  // Delete section (danger zone)
  const deleteSection = CardService.newCardSection()
    .setHeader('Danger Zone')
    .setCollapsible(true)
    .setNumUncollapsibleWidgets(0);

  const deleteAction = CardService.newAction()
    .setFunctionName('onDeleteDeal')
    .setParameters({ dealId: deal.deal_id, dealTitle: deal.title });

  const deleteButton = CardService.newTextButton()
    .setText('Delete Deal')
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setBackgroundColor('#dc3545')
    .setOnClickAction(deleteAction);

  deleteSection.addWidget(CardService.newTextParagraph()
    .setText('This action cannot be undone.'));
  deleteSection.addWidget(deleteButton);

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Deal Details'))
    .addSection(infoSection)
    .addSection(tagsSection)
    .addSection(notesSection)
    .addSection(deleteSection)
    .build();
}

/**
 * Builds the Account Map section showing org chart for a domain.
 * @param {string} domain The company domain.
 * @returns {GoogleAppsScript.Card_Service.CardSection|null} The account map section or null.
 */
function buildAccountMapSection(domain) {
  try {
    const contacts = getContactsByDomain(domain);

    if (contacts.length === 0) {
      return null;
    }

    const section = CardService.newCardSection()
      .setHeader(`Account Map (${contacts.length})`)
      .setCollapsible(true)
      .setNumUncollapsibleWidgets(Math.min(contacts.length, 3));

    // Group contacts by job level
    const byLevel = {};
    contacts.forEach(contact => {
      const level = contact.job_level || 'Unknown';
      if (!byLevel[level]) byLevel[level] = [];
      byLevel[level].push(contact);
    });

    // Display in order: C-Level, VP, Director, Manager, Individual, Unknown
    const levelOrder = ['C-Level', 'VP', 'Director', 'Manager', 'Individual', 'Unknown'];

    levelOrder.forEach(level => {
      if (byLevel[level] && byLevel[level].length > 0) {
        byLevel[level].forEach(contact => {
          // Build contact display
          const name = contact.name || contact.email.split('@')[0];
          const title = contact.job_title || '';
          const relationship = contact.relationship || '';

          // Create relationship badge
          let badge = '';
          if (relationship === 'Decision Maker') badge = ' [DM]';
          else if (relationship === 'Economic Buyer') badge = ' [EB]';
          else if (relationship === 'Champion') badge = ' [CH]';
          else if (relationship === 'Blocker') badge = ' [BL]';
          else if (relationship === 'Influencer') badge = ' [IN]';

          const displayText = title ? `${name}${badge}` : `${name}${badge}`;
          const bottomLabel = title ? `${level} - ${title}` : level;

          // Use DecoratedText for avatar if available
          if (contact.avatar_url) {
            section.addWidget(
              CardService.newDecoratedText()
                .setText(displayText)
                .setBottomLabel(bottomLabel)
                .setStartIcon(CardService.newIconImage()
                  .setIconUrl(contact.avatar_url)
                  .setAltText(name))
                .setOnClickAction(CardService.newAction()
                  .setFunctionName('onContactClick')
                  .setParameters({ email: contact.email }))
            );
          } else {
            section.addWidget(
              CardService.newKeyValue()
                .setContent(displayText)
                .setBottomLabel(bottomLabel)
                .setIcon(CardService.Icon.PERSON)
                .setOnClickAction(CardService.newAction()
                  .setFunctionName('onContactClick')
                  .setParameters({ email: contact.email }))
            );
          }
        });
      }
    });

    // Add "Add Contact" button
    section.addWidget(
      CardService.newTextButton()
        .setText('+ Add Contact to Account')
        .setOnClickAction(CardService.newAction()
          .setFunctionName('onAddContactToAccount')
          .setParameters({ domain: domain }))
    );

    return section;
  } catch (e) {
    console.warn('Failed to build account map:', e.message);
    return null;
  }
}

/**
 * Builds a contact detail card with edit capabilities.
 * @param {Object} contact The contact object.
 * @returns {GoogleAppsScript.Card_Service.Card} The contact detail card.
 */
function buildContactDetailCard(contact) {
  const card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Contact Details'));

  // Avatar section
  const infoSection = CardService.newCardSection();

  if (contact.avatar_url) {
    infoSection.addWidget(
      CardService.newImage()
        .setImageUrl(contact.avatar_url)
        .setAltText(contact.name || 'Avatar')
    );
  }

  infoSection
    .addWidget(CardService.newKeyValue()
      .setTopLabel('Name')
      .setContent(contact.name || '-')
      .setIcon(CardService.Icon.PERSON))
    .addWidget(CardService.newKeyValue()
      .setTopLabel('Email')
      .setContent(contact.email)
      .setIcon(CardService.Icon.EMAIL))
    .addWidget(CardService.newKeyValue()
      .setTopLabel('Company')
      .setContent(contact.company || '-')
      .setIcon(CardService.Icon.MEMBERSHIP));

  card.addSection(infoSection);

  // Job info section (editable)
  const jobSection = CardService.newCardSection()
    .setHeader('Role Information');

  // Job Title input
  const jobTitleInput = CardService.newTextInput()
    .setFieldName('job_title')
    .setTitle('Job Title')
    .setValue(contact.job_title || '');

  // Job Level dropdown
  const jobLevelSelect = CardService.newSelectionInput()
    .setFieldName('job_level')
    .setTitle('Job Level')
    .setType(CardService.SelectionInputType.DROPDOWN);

  ['C-Level', 'VP', 'Director', 'Manager', 'Individual', 'Unknown'].forEach(level => {
    jobLevelSelect.addItem(level, level, level === (contact.job_level || 'Unknown'));
  });

  // Relationship dropdown
  const relationshipSelect = CardService.newSelectionInput()
    .setFieldName('relationship')
    .setTitle('Relationship')
    .setType(CardService.SelectionInputType.DROPDOWN);

  ['Decision Maker', 'Economic Buyer', 'Champion', 'Influencer', 'Blocker', 'User', 'Unknown'].forEach(rel => {
    relationshipSelect.addItem(rel, rel, rel === (contact.relationship || 'Unknown'));
  });

  const updateAction = CardService.newAction()
    .setFunctionName('onUpdateContactRole')
    .setParameters({ email: contact.email });

  const updateButton = CardService.newTextButton()
    .setText('Update Role')
    .setOnClickAction(updateAction);

  jobSection
    .addWidget(jobTitleInput)
    .addWidget(jobLevelSelect)
    .addWidget(relationshipSelect)
    .addWidget(updateButton);

  card.addSection(jobSection);

  // LinkedIn section
  if (contact.linkedin || contact.linkedin_guess_url) {
    const linkedinUrl = contact.linkedin || contact.linkedin_guess_url;
    const linkedinSection = CardService.newCardSection();
    linkedinSection.addWidget(
      CardService.newTextButton()
        .setText('View LinkedIn')
        .setOpenLink(CardService.newOpenLink()
          .setUrl(linkedinUrl)
          .setOpenAs(CardService.OpenAs.OVERLAY))
    );
    card.addSection(linkedinSection);
  }

  return card.build();
}

/**
 * Builds the pipeline overview card.
 * @param {Array<Object>} deals List of all deals.
 * @returns {GoogleAppsScript.Card_Service.Card} The pipeline card.
 */
function buildPipelineCard(deals) {
  const stages = getSetting('pipeline_stages').split(',');
  const card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Pipeline Overview'));

  stages.forEach(stage => {
    const stageDeals = deals.filter(d => d.stage === stage);
    if (stageDeals.length > 0) {
      const section = CardService.newCardSection()
        .setHeader(`${stage} (${stageDeals.length})`)
        .setCollapsible(true)
        .setNumUncollapsibleWidgets(3);
        
      stageDeals.forEach(deal => {
        section.addWidget(CardService.newKeyValue()
          .setContent(deal.title)
          .setBottomLabel(`${deal.currency} ${deal.value}`)
          .setOnClickAction(CardService.newAction()
            .setFunctionName('onDealClick')
            .setParameters({ dealId: deal.deal_id })));
      });
      
      card.addSection(section);
    }
  });
  
  if (deals.length === 0) {
    card.addSection(CardService.newCardSection()
      .addWidget(CardService.newTextParagraph().setText('No active deals found.')));
  }

  return card.build();
}
