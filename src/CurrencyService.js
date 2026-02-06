/**
 * CurrencyService — fetch exchange rates via API, cache, and convert amounts.
 */

var getSetting = (typeof require !== 'undefined')
  ? require('./Utils').getSetting
  : getSetting;
var SHEET_NAMES = (typeof require !== 'undefined')
  ? require('./Utils').SHEET_NAMES
  : SHEET_NAMES;

var EXCHANGE_RATE_API_URL = 'https://v6.exchangerate-api.com/v6/FREE_API_KEY/latest/';
var FRANKFURTER_API_URL = 'https://api.frankfurter.app/latest?from=';
var CACHE_KEY_PREFIX = 'exchange_rates_';
var CACHE_TTL = 21600; // 6 hours in seconds

// Column indices in Transactions sheet (0-based)
var COL_AMOUNT_USD = 3;
var COL_AMOUNT_LOCAL = 4;
var COL_CURRENCY = 5;

/**
 * Fetch rates from exchangerate-api.com (primary).
 * @param {string} baseCurrency
 * @returns {Object|null} rates object or null on failure
 */
function fetchRatesFromPrimary_(baseCurrency) {
  try {
    var url = EXCHANGE_RATE_API_URL + baseCurrency;
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) {
      Logger.log('Primary API returned HTTP ' + response.getResponseCode());
      return null;
    }
    var data = JSON.parse(response.getContentText());
    if (data.result !== 'success') {
      Logger.log('Primary API returned result: ' + data.result);
      return null;
    }
    return data.conversion_rates;
  } catch (e) {
    Logger.log('Primary API error: ' + e.message);
    return null;
  }
}

/**
 * Fetch rates from frankfurter.app (fallback).
 * @param {string} baseCurrency
 * @returns {Object|null} rates object or null on failure
 */
function fetchRatesFromFallback_(baseCurrency) {
  try {
    var url = FRANKFURTER_API_URL + baseCurrency;
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) {
      Logger.log('Fallback API returned HTTP ' + response.getResponseCode());
      return null;
    }
    var data = JSON.parse(response.getContentText());
    var rates = data.rates;
    if (!rates) {
      Logger.log('Fallback API: no rates in response');
      return null;
    }
    rates[baseCurrency] = 1;
    return rates;
  } catch (e) {
    Logger.log('Fallback API error: ' + e.message);
    return null;
  }
}

/**
 * Try primary API, then fallback.
 * @param {string} baseCurrency
 * @returns {Object|null}
 */
function fetchExchangeRates_(baseCurrency) {
  var rates = fetchRatesFromPrimary_(baseCurrency);
  if (rates) return rates;
  Logger.log('Primary API failed, trying fallback...');
  rates = fetchRatesFromFallback_(baseCurrency);
  if (rates) return rates;
  Logger.log('All exchange rate APIs failed');
  return null;
}

/**
 * Get cached rates.
 * @param {string} baseCurrency
 * @returns {Object|null}
 */
function getCachedRates_(baseCurrency) {
  try {
    var cache = CacheService.getScriptCache();
    var cached = cache.get(CACHE_KEY_PREFIX + baseCurrency);
    if (cached) return JSON.parse(cached);
  } catch (e) {
    Logger.log('Cache read error: ' + e.message);
  }
  return null;
}

/**
 * Store rates in cache.
 * @param {string} baseCurrency
 * @param {Object} rates
 */
function cacheRates_(baseCurrency, rates) {
  try {
    var cache = CacheService.getScriptCache();
    cache.put(CACHE_KEY_PREFIX + baseCurrency, JSON.stringify(rates), CACHE_TTL);
  } catch (e) {
    Logger.log('Cache write error: ' + e.message);
  }
}

/**
 * Get rates with cache-first strategy.
 * @param {string} baseCurrency
 * @returns {Object|null}
 */
function getExchangeRates_(baseCurrency) {
  var rates = getCachedRates_(baseCurrency);
  if (rates) {
    Logger.log('Using cached exchange rates');
    return rates;
  }
  rates = fetchExchangeRates_(baseCurrency);
  if (rates) {
    cacheRates_(baseCurrency, rates);
  }
  return rates;
}

/**
 * Get exchange rate between two currencies.
 * @param {string} from — base currency code
 * @param {string} to — target currency code
 * @returns {number|null} rate or null if unavailable
 */
function getExchangeRate(from, to) {
  from = String(from).trim().toUpperCase();
  to = String(to).trim().toUpperCase();
  if (from === to) return 1;
  var rates = getExchangeRates_(from);
  if (!rates) {
    Logger.log('Could not fetch rates for ' + from);
    return null;
  }
  if (rates[to] !== undefined) return rates[to];
  Logger.log('Rate not found for ' + to);
  return null;
}

/**
 * Update Amount (USD) in Transactions based on Amount (Local) and Currency.
 * Called from menu "Update Exchange Rates".
 */
function updateExchangeRates() {
  var baseCurrency = getSetting('Base Currency') || 'USD';
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAMES.TRANSACTIONS);
  if (!sheet) {
    Logger.log('Transactions sheet not found');
    return;
  }
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    Logger.log('No transactions to update');
    return;
  }
  var rates = getExchangeRates_(baseCurrency);
  if (!rates) {
    Logger.log('Cannot update: exchange rates unavailable');
    return;
  }
  var updated = 0;
  for (var i = 1; i < data.length; i++) {
    var amountLocal = data[i][COL_AMOUNT_LOCAL];
    var currency = String(data[i][COL_CURRENCY] || '').trim().toUpperCase();
    if (!amountLocal || amountLocal === '' || !currency) continue;
    amountLocal = Number(amountLocal);
    if (isNaN(amountLocal)) continue;
    var amountBase;
    if (currency === baseCurrency.toUpperCase()) {
      amountBase = amountLocal;
    } else {
      var rate = rates[currency];
      if (!rate) {
        Logger.log('No rate for currency: ' + currency + ' (row ' + (i + 1) + ')');
        continue;
      }
      // rate = how many units of `currency` per 1 `baseCurrency`
      // so: amountBase = amountLocal / rate
      amountBase = amountLocal / rate;
    }
    sheet.getRange(i + 1, COL_AMOUNT_USD + 1).setValue(Math.round(amountBase * 100) / 100);
    updated++;
  }
  Logger.log('Updated ' + updated + ' exchange rates');
}

if (typeof module !== 'undefined') {
  module.exports = {
    updateExchangeRates: updateExchangeRates,
    getExchangeRate: getExchangeRate,
    fetchRatesFromPrimary_: fetchRatesFromPrimary_,
    fetchRatesFromFallback_: fetchRatesFromFallback_,
    fetchExchangeRates_: fetchExchangeRates_,
    getCachedRates_: getCachedRates_,
    cacheRates_: cacheRates_,
    getExchangeRates_: getExchangeRates_,
    EXCHANGE_RATE_API_URL: EXCHANGE_RATE_API_URL,
    FRANKFURTER_API_URL: FRANKFURTER_API_URL,
    CACHE_TTL: CACHE_TTL,
  };
}
