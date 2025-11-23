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
  const section = CardService.newCardSection()
    .setHeader('Contact Details')
    .addWidget(CardService.newKeyValue()
      .setTopLabel('Name')
      .setContent(contact.name || 'Unknown')
      .setIcon(CardService.Icon.PERSON))
    .addWidget(CardService.newKeyValue()
      .setTopLabel('Email')
      .setContent(contact.email)
      .setIcon(CardService.Icon.EMAIL))
    .addWidget(CardService.newKeyValue()
      .setTopLabel('Company')
      .setContent(contact.company || 'Unknown')
      .setIcon(CardService.Icon.MEMBERSHIP));

  const card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('Pipely CRM'))
    .addSection(section);

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
