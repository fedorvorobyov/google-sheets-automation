/**
 * Main — entry point, onOpen trigger, menu, sheet initialization.
 */

var SHEET_NAMES = (typeof require !== 'undefined')
  ? require('./Utils').SHEET_NAMES
  : { TRANSACTIONS: 'Transactions', DASHBOARD: 'Dashboard', SETTINGS: 'Settings' };

var DEFAULT_SETTINGS = [
  ['Base Currency', 'USD'],
  ['Alert Email', ''],
  ['Budget Limit', 5000],
  ['Alert Threshold', '80%'],
];

var SHEET_HEADERS = {};
SHEET_HEADERS['Transactions'] = ['Date', 'Description', 'Category', 'Amount (USD)', 'Amount (Local)', 'Currency'];
SHEET_HEADERS['Dashboard'] = ['Category', 'Total', 'Budget', 'Remaining', 'Status'];
SHEET_HEADERS['Settings'] = ['Parameter', 'Value'];

/**
 * Trigger: runs when the spreadsheet is opened.
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Budget Tools')
    .addItem('Update Exchange Rates', 'updateExchangeRates')
    .addItem('Refresh Dashboard', 'refreshDashboard')
    .addItem('Check Budget Alerts', 'checkBudgetAlerts')
    .addSeparator()
    .addItem('Add Transaction', 'showAddTransactionSidebar')
    .addToUi();
  initializeSpreadsheet();
}

/**
 * Create a sheet if it doesn't exist, set headers and freeze row 1.
 * @param {Spreadsheet} ss
 * @param {string} name
 * @param {string[]} headers
 * @param {Array[]} [defaultData] — rows to insert after header
 * @returns {Sheet}
 */
function ensureSheet_(ss, name, headers, defaultData) {
  var sheet = ss.getSheetByName(name);
  if (sheet) return sheet;
  sheet = ss.insertSheet(name);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  if (defaultData && defaultData.length > 0) {
    sheet.getRange(2, 1, defaultData.length, defaultData[0].length).setValues(defaultData);
  }
  return sheet;
}

/**
 * Create Transactions, Dashboard, Settings sheets if missing.
 */
function initializeSpreadsheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, SHEET_NAMES.TRANSACTIONS, SHEET_HEADERS['Transactions']);
  ensureSheet_(ss, SHEET_NAMES.DASHBOARD, SHEET_HEADERS['Dashboard']);
  ensureSheet_(ss, SHEET_NAMES.SETTINGS, SHEET_HEADERS['Settings'], DEFAULT_SETTINGS);
}

/**
 * Placeholder for Add Transaction sidebar.
 */
function showAddTransactionSidebar() {
  SpreadsheetApp.getUi().alert('Coming soon: Add Transaction form');
}

if (typeof module !== 'undefined') {
  module.exports = {
    onOpen: onOpen,
    initializeSpreadsheet: initializeSpreadsheet,
    showAddTransactionSidebar: showAddTransactionSidebar,
    ensureSheet_: ensureSheet_,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    SHEET_HEADERS: SHEET_HEADERS,
  };
}
