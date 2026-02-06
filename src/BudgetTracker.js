/**
 * BudgetTracker — budget calculation logic by category.
 */

var getSetting = (typeof require !== 'undefined')
  ? require('./Utils').getSetting
  : getSetting;
var getSettingAsNumber = (typeof require !== 'undefined')
  ? require('./Utils').getSettingAsNumber
  : getSettingAsNumber;
var SHEET_NAMES = (typeof require !== 'undefined')
  ? require('./Utils').SHEET_NAMES
  : SHEET_NAMES;

// Column indices in Transactions (0-based)
var TX_COL_CATEGORY = 2;
var TX_COL_AMOUNT_USD = 3;

/**
 * Status thresholds.
 */
var STATUS_OK = 'OK';
var STATUS_WARNING = 'Warning';
var STATUS_OVER = 'Over Budget';

/**
 * Calculate totals per category from Transactions sheet.
 * @returns {Object} e.g. { "Food": 350, "Transport": 120 }
 */
function getCategoryTotals() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAMES.TRANSACTIONS);
  if (!sheet) {
    Logger.log('Transactions sheet not found');
    return {};
  }
  var data = sheet.getDataRange().getValues();
  var totals = {};
  for (var i = 1; i < data.length; i++) {
    var category = String(data[i][TX_COL_CATEGORY] || '').trim();
    var amount = Number(data[i][TX_COL_AMOUNT_USD]);
    if (!category || isNaN(amount)) continue;
    totals[category] = (totals[category] || 0) + amount;
  }
  // Round each total to 2 decimals
  for (var cat in totals) {
    totals[cat] = Math.round(totals[cat] * 100) / 100;
  }
  return totals;
}

/**
 * Get budget limit from Settings.
 * @returns {number}
 */
function getBudgetLimit() {
  return getSettingAsNumber('Budget Limit', 5000);
}

/**
 * Get alert threshold as fraction (0-1) from Settings.
 * @returns {number}
 */
function getAlertThreshold() {
  return getSettingAsNumber('Alert Threshold', 0.8);
}

/**
 * Determine status based on spending vs budget.
 * @param {number} spent
 * @param {number} budget
 * @param {number} threshold — fraction (e.g. 0.8)
 * @returns {string} STATUS_OK | STATUS_WARNING | STATUS_OVER
 */
function getStatus(spent, budget, threshold) {
  if (budget <= 0) return STATUS_OK;
  var ratio = spent / budget;
  if (ratio >= 1) return STATUS_OVER;
  if (ratio >= threshold) return STATUS_WARNING;
  return STATUS_OK;
}

/**
 * Build budget summary for all categories.
 * @returns {Array<Object>} [{ category, total, budget, remaining, status }, ...]
 */
function getBudgetSummary() {
  var totals = getCategoryTotals();
  var budget = getBudgetLimit();
  var threshold = getAlertThreshold();
  var summary = [];
  var categories = Object.keys(totals).sort();
  for (var i = 0; i < categories.length; i++) {
    var cat = categories[i];
    var spent = totals[cat];
    var remaining = Math.round((budget - spent) * 100) / 100;
    summary.push({
      category: cat,
      total: spent,
      budget: budget,
      remaining: remaining,
      status: getStatus(spent, budget, threshold),
    });
  }
  return summary;
}

/**
 * Get categories that exceed the alert threshold.
 * @returns {Array<Object>} [{ category, total, budget, remaining, status, percent }, ...]
 */
function getOverBudgetCategories() {
  var summary = getBudgetSummary();
  var threshold = getAlertThreshold();
  var alerts = [];
  for (var i = 0; i < summary.length; i++) {
    var item = summary[i];
    if (item.budget <= 0) continue;
    var percent = item.total / item.budget;
    if (percent >= threshold) {
      item.percent = Math.round(percent * 1000) / 10;
      alerts.push(item);
    }
  }
  return alerts;
}

/**
 * Check budget alerts — called from menu "Check Budget Alerts".
 * Shows alert in UI with categories that are at or over threshold.
 */
function checkBudgetAlerts() {
  var alerts = getOverBudgetCategories();
  var ui = SpreadsheetApp.getUi();
  if (alerts.length === 0) {
    ui.alert('All categories are within budget.');
    return;
  }
  var msg = 'Budget alerts:\n\n';
  for (var i = 0; i < alerts.length; i++) {
    var a = alerts[i];
    msg += a.category + ': ' + a.percent + '% of budget ($' + a.total + ' / $' + a.budget + ')\n';
  }
  ui.alert(msg);
}

if (typeof module !== 'undefined') {
  module.exports = {
    getCategoryTotals: getCategoryTotals,
    getBudgetLimit: getBudgetLimit,
    getAlertThreshold: getAlertThreshold,
    getStatus: getStatus,
    getBudgetSummary: getBudgetSummary,
    getOverBudgetCategories: getOverBudgetCategories,
    checkBudgetAlerts: checkBudgetAlerts,
    STATUS_OK: STATUS_OK,
    STATUS_WARNING: STATUS_WARNING,
    STATUS_OVER: STATUS_OVER,
  };
}
