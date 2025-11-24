/**
 * Tasks.gs
 * Google Tasks integration for Pipely follow-up actions.
 */

// ============ GOOGLE TASKS API ============

/**
 * Gets all task lists for the current user.
 * @returns {Array<Object>} List of task lists.
 */
function getTaskLists() {
  try {
    const response = Tasks.Tasklists.list();
    return response.items || [];
  } catch (e) {
    console.error('Error getting task lists:', e);
    return [];
  }
}

/**
 * Gets or creates the Pipely task list.
 * @returns {Object} The Pipely task list.
 */
function getPipelyTaskList() {
  const taskLists = getTaskLists();

  // Find existing Pipely list
  const existing = taskLists.find(list => list.title === 'Pipely Follow-ups');
  if (existing) {
    return existing;
  }

  // Create new list
  try {
    const newList = Tasks.Tasklists.insert({
      title: 'Pipely Follow-ups'
    });
    return newList;
  } catch (e) {
    console.error('Error creating task list:', e);
    // Fall back to default list
    return taskLists[0] || null;
  }
}

/**
 * Creates a follow-up task for a deal.
 * @param {Object} deal The deal object.
 * @param {string} action The follow-up action description.
 * @param {Date} dueDate Optional due date.
 * @returns {Object|null} The created task or null.
 */
function createFollowUpTask(deal, action, dueDate) {
  const taskList = getPipelyTaskList();
  if (!taskList) {
    throw new Error('Could not access Google Tasks');
  }

  // Build task title
  const title = `[${deal.stage}] ${deal.title}: ${action}`;

  // Build notes with deal details
  const notes = [
    `Deal: ${deal.title}`,
    `Contact: ${deal.contact_email || 'N/A'}`,
    `Value: ${deal.currency || 'USD'} ${deal.value || 0}`,
    `Stage: ${deal.stage}`,
    '',
    `Created from Pipely CRM`
  ].join('\n');

  // Create task
  const task = {
    title: title,
    notes: notes,
    status: 'needsAction'
  };

  // Add due date if provided
  if (dueDate) {
    // Google Tasks API expects RFC 3339 format
    task.due = dueDate.toISOString();
  }

  try {
    const created = Tasks.Tasks.insert(task, taskList.id);
    return created;
  } catch (e) {
    console.error('Error creating task:', e);
    throw e;
  }
}

/**
 * Creates a quick follow-up task with preset actions.
 * @param {string} dealId The deal ID.
 * @param {string} actionType The action type (call, email, meeting, other).
 * @param {number} daysFromNow Days until due (default: 1).
 * @returns {Object} The created task.
 */
function createQuickFollowUp(dealId, actionType, daysFromNow) {
  const deal = getDealById(dealId);
  if (!deal) {
    throw new Error('Deal not found');
  }

  // Map action types to descriptions
  const actionMap = {
    'call': 'Follow-up call',
    'email': 'Send follow-up email',
    'meeting': 'Schedule meeting',
    'proposal': 'Send proposal',
    'demo': 'Schedule demo',
    'check_in': 'Check in',
    'other': 'Follow up'
  };

  const action = actionMap[actionType] || actionMap['other'];

  // Calculate due date
  const days = daysFromNow || 1;
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + days);
  dueDate.setHours(9, 0, 0, 0); // Set to 9 AM

  return createFollowUpTask(deal, action, dueDate);
}

/**
 * Gets pending tasks for a deal (by searching notes).
 * @param {string} dealId The deal ID.
 * @returns {Array<Object>} List of tasks.
 */
function getTasksForDeal(dealId) {
  const deal = getDealById(dealId);
  if (!deal) return [];

  const taskList = getPipelyTaskList();
  if (!taskList) return [];

  try {
    const response = Tasks.Tasks.list(taskList.id, {
      showCompleted: false,
      maxResults: 100
    });

    const tasks = response.items || [];

    // Filter by deal title in task title
    return tasks.filter(task =>
      task.title && task.title.includes(deal.title)
    );
  } catch (e) {
    console.error('Error getting tasks:', e);
    return [];
  }
}

/**
 * Marks a task as complete.
 * @param {string} taskId The task ID.
 * @returns {boolean} Success status.
 */
function completeTask(taskId) {
  const taskList = getPipelyTaskList();
  if (!taskList) return false;

  try {
    Tasks.Tasks.patch({
      status: 'completed'
    }, taskList.id, taskId);
    return true;
  } catch (e) {
    console.error('Error completing task:', e);
    return false;
  }
}

// ============ FOLLOW-UP PRESETS ============

/**
 * Common follow-up action presets.
 */
const FOLLOW_UP_PRESETS = [
  { id: 'call_tomorrow', label: 'Call tomorrow', action: 'call', days: 1 },
  { id: 'email_today', label: 'Email today', action: 'email', days: 0 },
  { id: 'meeting_3days', label: 'Schedule meeting (3 days)', action: 'meeting', days: 3 },
  { id: 'proposal_week', label: 'Send proposal (1 week)', action: 'proposal', days: 7 },
  { id: 'check_in_2weeks', label: 'Check in (2 weeks)', action: 'check_in', days: 14 }
];

/**
 * Gets follow-up presets for UI.
 * @returns {Array<Object>} List of presets.
 */
function getFollowUpPresets() {
  return FOLLOW_UP_PRESETS;
}
