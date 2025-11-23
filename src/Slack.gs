/**
 * Slack.gs
 * Handles Slack notifications for Pipely.
 */

/**
 * Sends a notification to Slack.
 * @param {string} webhookUrl The Slack Incoming Webhook URL.
 * @param {Object} message The message payload (blocks or text).
 */
function sendSlackNotification(webhookUrl, message) {
  if (!webhookUrl) {
    console.log('No Slack webhook URL configured. Skipping notification.');
    return;
  }
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(message)
  };
  
  try {
    UrlFetchApp.fetch(webhookUrl, options);
  } catch (e) {
    console.error('Failed to send Slack notification: ' + e.toString());
  }
}

/**
 * Formats a message for a new deal.
 * @param {Object} deal The deal object.
 * @param {Object} contact The contact object.
 * @returns {Object} Slack message payload.
 */
function formatNewDealMessage(deal, contact) {
  return {
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🎉 New Deal Created!",
          emoji: true
        }
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Title:*\n${deal.title}`
          },
          {
            type: "mrkdwn",
            text: `*Value:*\n${deal.currency} ${deal.value}`
          },
          {
            type: "mrkdwn",
            text: `*Contact:*\n${contact.name} (${contact.company})`
          },
          {
            type: "mrkdwn",
            text: `*Stage:*\n${deal.stage}`
          }
        ]
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Created by ${deal.owner_email}`
          }
        ]
      }
    ]
  };
}

/**
 * Formats a message for a deal stage change.
 * @param {Object} deal The deal object.
 * @param {string} oldStage The previous stage.
 * @param {string} newStage The new stage.
 * @returns {Object} Slack message payload.
 */
function formatStageChangeMessage(deal, oldStage, newStage) {
  return {
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🔄 *Deal Updated: ${deal.title}*`
        }
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*From:*\n${oldStage}`
          },
          {
            type: "mrkdwn",
            text: `*To:*\n${newStage}`
          }
        ]
      }
    ]
  };
}
