/**
 * Code.gs
 * Main entry point for Pipely.
 */

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
