/**
 * Dashboard — generate summary by categories on the Dashboard sheet.
 */

var getBudgetSummary = (typeof require !== 'undefined')
  ? require('./BudgetTracker').getBudgetSummary
  : getBudgetSummary;
var SHEET_NAMES = (typeof require !== 'undefined')
  ? require('./Utils').SHEET_NAMES
  : SHEET_NAMES;
var formatCurrency = (typeof require !== 'undefined')
  ? require('./Utils').formatCurrency
  : formatCurrency;

var DASHBOARD_HEADERS = ['Category', 'Total', 'Budget', 'Remaining', 'Status'];

var STATUS_COLORS = {
  'OK': '#d9ead3',
  'Warning': '#fff2cc',
  'Over Budget': '#f4cccc',
};

/**
 * Write the budget summary to the Dashboard sheet.
 * Clears existing data (except header) and writes fresh rows.
 */
function refreshDashboard() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAMES.DASHBOARD);
  if (!sheet) {
    Logger.log('Dashboard sheet not found');
    return;
  }
  var summary = getBudgetSummary();

  // Clear data rows (keep header in row 1)
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, DASHBOARD_HEADERS.length).clear();
  }

  if (summary.length === 0) {
    Logger.log('No categories to display on Dashboard');
    return;
  }

  // Build data rows
  var rows = [];
  for (var i = 0; i < summary.length; i++) {
    var s = summary[i];
    rows.push([s.category, s.total, s.budget, s.remaining, s.status]);
  }

  // Write all rows at once
  var dataRange = sheet.getRange(2, 1, rows.length, DASHBOARD_HEADERS.length);
  dataRange.setValues(rows);

  // Apply formatting per row
  for (var i = 0; i < summary.length; i++) {
    var rowNum = i + 2;
    var color = STATUS_COLORS[summary[i].status] || '#ffffff';
    sheet.getRange(rowNum, 5).setBackground(color);
    // Currency format for Total, Budget, Remaining columns
    sheet.getRange(rowNum, 2).setNumberFormat('$#,##0.00');
    sheet.getRange(rowNum, 3).setNumberFormat('$#,##0.00');
    sheet.getRange(rowNum, 4).setNumberFormat('$#,##0.00');
  }

  Logger.log('Dashboard updated with ' + summary.length + ' categories');
}

if (typeof module !== 'undefined') {
  module.exports = {
    refreshDashboard: refreshDashboard,
    DASHBOARD_HEADERS: DASHBOARD_HEADERS,
    STATUS_COLORS: STATUS_COLORS,
  };
}
