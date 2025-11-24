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
