/**
 * Utils — formatting helpers and Settings reader.
 */

/** Sheet name constants used across all modules. */
var SHEET_NAMES = {
  TRANSACTIONS: 'Transactions',
  DASHBOARD: 'Dashboard',
  SETTINGS: 'Settings',
};

/**
 * Format a number as currency string.
 * @param {number} amount
 * @param {string} [symbol='$']
 * @returns {string} e.g. "$1,234.56"
 */
function formatCurrency(amount, symbol) {
  symbol = symbol || '$';
  var num = Number(amount);
  if (isNaN(num)) num = 0;
  var negative = num < 0;
  var abs = Math.abs(num).toFixed(2);
  var parts = abs.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  var formatted = symbol + parts.join('.');
  return negative ? '-' + formatted : formatted;
}

/**
 * Format a Date object.
 * @param {Date} date
 * @param {string} [format='yyyy-MM-dd']
 * @returns {string}
 */
function formatDate(date, format) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '';
  format = format || 'yyyy-MM-dd';
  var timeZone = Session.getScriptTimeZone();
  return Utilities.formatDate(date, timeZone, format);
}

/**
 * Format a fraction as percent string.
 * @param {number} value — fraction (0.8 = 80%)
 * @returns {string} e.g. "80%"
 */
function formatPercent(value) {
  var num = Number(value);
  if (isNaN(num) || num < 0) return '0%';
  var pct = Math.round(num * 1000) / 10;
  return pct % 1 === 0 ? pct.toFixed(0) + '%' : pct.toFixed(1) + '%';
}

/**
 * Read a setting value from the Settings sheet.
 * @param {string} key — parameter name (e.g. "Base Currency")
 * @returns {*} value or null if not found
 * @throws {Error} if Settings sheet does not exist
 */
function getSetting(key) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAMES.SETTINGS);
  if (!sheet) {
    throw new Error('Settings sheet not found. Run "Initialize Spreadsheet" first.');
  }
  var data = sheet.getDataRange().getValues();
  var trimmedKey = key.trim();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === trimmedKey) {
      return data[i][1];
    }
  }
  return null;
}

/**
 * Read a setting as number, with optional default.
 * Handles "80%" → 0.8 conversion.
 * @param {string} key
 * @param {number} [defaultValue=0]
 * @returns {number}
 */
function getSettingAsNumber(key, defaultValue) {
  defaultValue = defaultValue !== undefined ? defaultValue : 0;
  var raw = getSetting(key);
  if (raw === null || raw === '') return defaultValue;
  var str = String(raw).trim();
  if (str.endsWith('%')) {
    var pct = parseFloat(str.replace('%', ''));
    return isNaN(pct) ? defaultValue : pct / 100;
  }
  var num = parseFloat(str);
  return isNaN(num) ? defaultValue : num;
}

if (typeof module !== 'undefined') {
  module.exports = {
    SHEET_NAMES: SHEET_NAMES,
    formatCurrency: formatCurrency,
    formatDate: formatDate,
    formatPercent: formatPercent,
    getSetting: getSetting,
    getSettingAsNumber: getSettingAsNumber,
  };
}
