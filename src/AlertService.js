/**
 * AlertService — email notifications on budget exceed.
 */

var getSetting = (typeof require !== 'undefined')
  ? require('./Utils').getSetting
  : getSetting;
var formatCurrency = (typeof require !== 'undefined')
  ? require('./Utils').formatCurrency
  : formatCurrency;
var getOverBudgetCategories = (typeof require !== 'undefined')
  ? require('./BudgetTracker').getOverBudgetCategories
  : getOverBudgetCategories;
var getBudgetSummary = (typeof require !== 'undefined')
  ? require('./BudgetTracker').getBudgetSummary
  : getBudgetSummary;

/**
 * Send an email alert.
 * @param {string} to — recipient email
 * @param {string} subject
 * @param {string} body
 */
function sendAlert(to, subject, body) {
  if (!to) {
    Logger.log('No alert email configured');
    return false;
  }
  try {
    MailApp.sendEmail(to, subject, body);
    Logger.log('Alert sent to ' + to + ': ' + subject);
    return true;
  } catch (e) {
    Logger.log('Failed to send alert: ' + e.message);
    return false;
  }
}

/**
 * Build alert email body for an over-budget category.
 * @param {Object} alert — { category, total, budget, remaining, percent }
 * @returns {string}
 */
function buildAlertBody(alert) {
  var url = SpreadsheetApp.getActiveSpreadsheet().getUrl();
  return 'Hi,\n\n' +
    'Your spending in "' + alert.category + '" has reached ' + alert.percent + '% of the budget limit.\n\n' +
    '  Spent:     ' + formatCurrency(alert.total) + '\n' +
    '  Budget:    ' + formatCurrency(alert.budget) + '\n' +
    '  Remaining: ' + formatCurrency(alert.remaining) + '\n\n' +
    'Review your budget: ' + url + '\n\n' +
    '— Budget Tracker Automation';
}

/**
 * Build weekly summary email body.
 * @param {Array<Object>} summary — from getBudgetSummary()
 * @returns {string}
 */
function buildWeeklySummaryBody(summary) {
  var url = SpreadsheetApp.getActiveSpreadsheet().getUrl();
  var body = 'Weekly Budget Summary\n' +
    '====================\n\n';
  if (summary.length === 0) {
    body += 'No transactions recorded this period.\n';
  } else {
    for (var i = 0; i < summary.length; i++) {
      var s = summary[i];
      body += s.category + ': ' + formatCurrency(s.total) + ' / ' + formatCurrency(s.budget) +
        ' (' + s.status + ')\n';
    }
  }
  body += '\nView spreadsheet: ' + url + '\n\n';
  body += '— Budget Tracker Automation';
  return body;
}

/**
 * Send alerts for all over-budget categories.
 * Called from trigger or menu.
 */
function sendBudgetAlerts() {
  var email = getSetting('Alert Email');
  if (!email) {
    Logger.log('Alert Email not configured in Settings');
    return;
  }
  var alerts = getOverBudgetCategories();
  if (alerts.length === 0) {
    Logger.log('No budget alerts to send');
    return;
  }
  var sent = 0;
  for (var i = 0; i < alerts.length; i++) {
    var a = alerts[i];
    var subject = 'Budget Alert: Category "' + a.category + '" at ' + a.percent + '%';
    var body = buildAlertBody(a);
    if (sendAlert(email, subject, body)) sent++;
  }
  Logger.log('Sent ' + sent + ' budget alert(s)');
}

/**
 * Send weekly summary email.
 * Called from weekly trigger.
 */
function sendWeeklySummary() {
  var email = getSetting('Alert Email');
  if (!email) {
    Logger.log('Alert Email not configured in Settings');
    return;
  }
  var summary = getBudgetSummary();
  var body = buildWeeklySummaryBody(summary);
  sendAlert(email, 'Weekly Budget Summary', body);
}

if (typeof module !== 'undefined') {
  module.exports = {
    sendAlert: sendAlert,
    buildAlertBody: buildAlertBody,
    buildWeeklySummaryBody: buildWeeklySummaryBody,
    sendBudgetAlerts: sendBudgetAlerts,
    sendWeeklySummary: sendWeeklySummary,
  };
}
