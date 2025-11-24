/**
 * Enrichment.gs
 * Contact enrichment functions for Pipely (Phase 3.1 - Free Tier)
 *
 * Features:
 * - Gravatar avatar lookup (free, unlimited)
 * - Clearbit company logo (free, unlimited)
 * - LinkedIn URL guess based on name
 */

/**
 * MD5 hash function for Gravatar.
 * Apps Script doesn't have built-in MD5, so we use Utilities.
 * @param {string} input The string to hash.
 * @returns {string} The MD5 hash in lowercase hex.
 */
function md5(input) {
  const rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, input);
  let hash = '';
  for (let i = 0; i < rawHash.length; i++) {
    let byte = rawHash[i];
    if (byte < 0) byte += 256;
    let hex = byte.toString(16);
    if (hex.length === 1) hex = '0' + hex;
    hash += hex;
  }
  return hash;
}

/**
 * Gets Gravatar URL for an email address.
 * @param {string} email The email address.
 * @param {number} size The image size (default 80px).
 * @returns {string} The Gravatar URL.
 */
function getGravatarUrl(email, size) {
  size = size || 80;
  const cleanEmail = email.toLowerCase().trim();
  const hash = md5(cleanEmail);
  // d=identicon provides a unique geometric pattern as fallback
  return `https://www.gravatar.com/avatar/${hash}?d=identicon&s=${size}`;
}

/**
 * Gets Clearbit Logo URL for a domain.
 * @param {string} domain The company domain (e.g., 'acme.com').
 * @param {number} size The image size (default 80px).
 * @returns {string} The Clearbit Logo URL.
 */
function getClearbitLogoUrl(domain, size) {
  size = size || 80;
  // Clearbit returns a transparent 1x1 pixel if logo not found
  return `https://logo.clearbit.com/${domain}?size=${size}`;
}

/**
 * Extracts domain from email address.
 * @param {string} email The email address.
 * @returns {string} The domain (e.g., 'acme.com').
 */
function getDomainFromEmail(email) {
  const parts = email.split('@');
  return parts.length > 1 ? parts[1].toLowerCase() : '';
}

/**
 * Guesses LinkedIn profile URL based on name.
 * Note: This is a guess and may not always be accurate.
 * @param {string} name The person's full name.
 * @returns {string} The guessed LinkedIn URL.
 */
function guessLinkedInUrl(name) {
  if (!name) return '';

  // Convert to lowercase, replace spaces with hyphens, remove special chars
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')  // Remove special characters
    .replace(/\s+/g, '-')           // Replace spaces with hyphens
    .replace(/-+/g, '-');           // Remove multiple hyphens

  return `https://www.linkedin.com/in/${slug}`;
}

/**
 * Guesses company name from email domain.
 * Removes common TLDs and formats nicely.
 * @param {string} domain The email domain.
 * @returns {string} The guessed company name.
 */
function guessCompanyFromDomain(domain) {
  if (!domain) return '';

  // Skip common free email providers
  const freeProviders = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'me.com', 'mail.com'];
  if (freeProviders.includes(domain.toLowerCase())) {
    return '';
  }

  // Extract company name (first part of domain)
  const parts = domain.split('.');
  if (parts.length > 0) {
    // Capitalize first letter
    const name = parts[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  return '';
}

/**
 * Enriches a contact with avatar, logo, and LinkedIn guess.
 * @param {Object} contact The contact object with email and name.
 * @returns {Object} Enriched contact data.
 */
function enrichContact(contact) {
  const email = contact.email || '';
  const name = contact.name || '';
  const domain = getDomainFromEmail(email);

  const enrichedData = {
    avatar_url: getGravatarUrl(email),
    company_logo_url: domain ? getClearbitLogoUrl(domain) : '',
    linkedin_guess_url: guessLinkedInUrl(name),
    domain: domain
  };

  // If company is not set, try to guess it
  if (!contact.company && domain) {
    enrichedData.company_guess = guessCompanyFromDomain(domain);
  }

  return enrichedData;
}

/**
 * Checks if an image URL returns a valid image (not 404 or empty).
 * Useful for validating Clearbit logo responses.
 * @param {string} url The image URL to check.
 * @returns {boolean} True if valid image exists.
 */
function isValidImageUrl(url) {
  try {
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const code = response.getResponseCode();
    const contentType = response.getHeaders()['Content-Type'] || '';

    // Check for successful response and image content type
    return code === 200 && contentType.includes('image');
  } catch (e) {
    return false;
  }
}
