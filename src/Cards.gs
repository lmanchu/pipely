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

  const section = CardService.newCardSection()
    .addWidget(CardService.newKeyValue().setTopLabel('Title').setContent(deal.title))
    .addWidget(CardService.newKeyValue().setTopLabel('Value').setContent(`${deal.currency} ${deal.value}`))
    .addWidget(stageSelect)
    .addWidget(updateButton)
    .addWidget(CardService.newKeyValue().setTopLabel('Notes').setContent(deal.notes || '-').setMultiline(true));

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Deal Details'))
    .addSection(section)
    .build();
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
