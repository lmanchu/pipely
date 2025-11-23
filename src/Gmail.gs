/**
 * Gmail.gs
 * Utilities for parsing Gmail messages and extracting context.
 */

/**
 * Extracts contact information from a Gmail message event.
 * @param {Object} e The event object from the contextual trigger.
 * @returns {Object} Contact object with email, name, and company.
 */
function extractContactFromMessage(e) {
  const accessToken = e.messageMetadata.accessToken;
  const messageId = e.messageMetadata.messageId;
  GmailApp.setCurrentMessageAccessToken(accessToken);
  
  const message = GmailApp.getMessageById(messageId);
  const from = message.getFrom();
  
  // Parse "Name <email@domain.com>" or "email@domain.com"
  let name = '';
  let email = '';
  
  if (from.includes('<')) {
    const parts = from.split('<');
    name = parts[0].trim().replace(/"/g, '');
    email = parts[1].replace('>', '').trim();
  } else {
    email = from.trim();
    name = email.split('@')[0]; // Fallback name
  }
  
  const company = guessCompanyFromEmail(email);
  
  return {
    email: email,
    name: name,
    company: company
  };
}

/**
 * Guesses the company name from an email address.
 * @param {string} email The email address.
 * @returns {string} The guessed company name.
 */
function guessCompanyFromEmail(email) {
  if (!email || !email.includes('@')) return '';
  
  const domain = email.split('@')[1];
  
  // Filter out common generic domains
  const genericDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com'];
  if (genericDomains.includes(domain)) return '';
  
  const company = domain.split('.')[0];
  // Capitalize first letter
  return company.charAt(0).toUpperCase() + company.slice(1);
}

/**
 * Gets the thread ID from the event object.
 * @param {Object} e The event object.
 * @returns {string} The thread ID.
 */
function getThreadId(e) {
  // In some contexts, threadId might be directly available, 
  // but usually we need to get it via the message.
  // For optimization, we try to avoid GmailApp calls if possible,
  // but here we need it for linking.
  const accessToken = e.messageMetadata.accessToken;
  const messageId = e.messageMetadata.messageId;
  GmailApp.setCurrentMessageAccessToken(accessToken);
  
  const message = GmailApp.getMessageById(messageId);
  return message.getThread().getId();
}
