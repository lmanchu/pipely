/**
 * Reminders.gs
 * Time-based trigger functions for deal due date reminders.
 */

/**
 * Sets up the daily reminder trigger.
 * Run this once manually to create the trigger.
 */
function setupDailyReminderTrigger() {
  // Delete existing triggers first
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'checkDueDeals') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Create new daily trigger at 9 AM
  ScriptApp.newTrigger('checkDueDeals')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();

  console.log('Daily reminder trigger set up for 9 AM');
}

/**
 * Removes the daily reminder trigger.
 */
function removeDailyReminderTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'checkDueDeals') {
      ScriptApp.deleteTrigger(trigger);
      console.log('Daily reminder trigger removed');
    }
  });
}

/**
 * Main function called by the daily trigger.
 * Checks for deals due today, tomorrow, or overdue.
 */
function checkDueDeals() {
  const deals = getDeals();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = Utilities.formatDate(tomorrow, Session.getScriptTimeZone(), 'yyyy-MM-dd');

  // Categorize deals
  const overdueDeals = [];
  const dueTodayDeals = [];
  const dueTomorrowDeals = [];
  const staleDeals = [];

  deals.forEach(deal => {
    // Skip closed deals
    if (deal.stage === 'Won' || deal.stage === 'Lost') return;

    // Check due date
    if (deal.due_date) {
      if (deal.due_date < todayStr) {
        overdueDeals.push(deal);
      } else if (deal.due_date === todayStr) {
        dueTodayDeals.push(deal);
      } else if (deal.due_date === tomorrowStr) {
        dueTomorrowDeals.push(deal);
      }
    }

    // Check for stale deals (no activity in 3+ days)
    if (deal.updated_at) {
      const updatedDate = new Date(deal.updated_at);
      const daysSinceUpdate = Math.floor((today - updatedDate) / (1000 * 60 * 60 * 24));
      if (daysSinceUpdate >= 3 && !deal.due_date) {
        staleDeals.push({ ...deal, daysSinceUpdate });
      }
    }
  });

  // Send Slack notifications
  const webhookUrl = getSetting('slack_webhook_url');
  if (!webhookUrl) {
    console.log('No Slack webhook configured, skipping notifications');
    return;
  }

  // Send overdue notification
  if (overdueDeals.length > 0) {
    sendSlackNotification(webhookUrl, formatOverdueMessage(overdueDeals));
  }

  // Send due today notification
  if (dueTodayDeals.length > 0) {
    sendSlackNotification(webhookUrl, formatDueTodayMessage(dueTodayDeals));
  }

  // Send due tomorrow notification
  if (dueTomorrowDeals.length > 0) {
    sendSlackNotification(webhookUrl, formatDueTomorrowMessage(dueTomorrowDeals));
  }

  // Send stale deals notification (max 5)
  if (staleDeals.length > 0) {
    const topStale = staleDeals.sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate).slice(0, 5);
    sendSlackNotification(webhookUrl, formatStaleMessage(topStale));
  }

  console.log(`Checked ${deals.length} deals: ${overdueDeals.length} overdue, ${dueTodayDeals.length} due today, ${dueTomorrowDeals.length} due tomorrow, ${staleDeals.length} stale`);
}

/**
 * Formats overdue deals message for Slack.
 * @param {Array<Object>} deals The overdue deals.
 * @returns {Object} Slack message payload.
 */
function formatOverdueMessage(deals) {
  const dealsList = deals.map(d =>
    `- *${d.title}* (${d.stage}) - Due: ${d.due_date} - ${d.currency} ${d.value}`
  ).join('\n');

  return {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `:warning: ${deals.length} Overdue Deal${deals.length > 1 ? 's' : ''}`,
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: dealsList
        }
      }
    ]
  };
}

/**
 * Formats deals due today message for Slack.
 * @param {Array<Object>} deals The deals due today.
 * @returns {Object} Slack message payload.
 */
function formatDueTodayMessage(deals) {
  const dealsList = deals.map(d =>
    `- *${d.title}* (${d.stage}) - ${d.currency} ${d.value}`
  ).join('\n');

  return {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `:calendar: ${deals.length} Deal${deals.length > 1 ? 's' : ''} Due Today`,
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: dealsList
        }
      }
    ]
  };
}

/**
 * Formats deals due tomorrow message for Slack.
 * @param {Array<Object>} deals The deals due tomorrow.
 * @returns {Object} Slack message payload.
 */
function formatDueTomorrowMessage(deals) {
  const dealsList = deals.map(d =>
    `- *${d.title}* (${d.stage}) - ${d.currency} ${d.value}`
  ).join('\n');

  return {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `:soon: ${deals.length} Deal${deals.length > 1 ? 's' : ''} Due Tomorrow`,
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: dealsList
        }
      }
    ]
  };
}

/**
 * Formats stale deals message for Slack.
 * @param {Array<Object>} deals The stale deals with daysSinceUpdate.
 * @returns {Object} Slack message payload.
 */
function formatStaleMessage(deals) {
  const dealsList = deals.map(d =>
    `- *${d.title}* (${d.stage}) - No update in ${d.daysSinceUpdate} days`
  ).join('\n');

  return {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `:hourglass: ${deals.length} Stale Deal${deals.length > 1 ? 's' : ''} Need Attention`,
          emoji: true
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: dealsList
        }
      }
    ]
  };
}

/**
 * Test function to manually trigger the reminder check.
 */
function testCheckDueDeals() {
  checkDueDeals();
}
