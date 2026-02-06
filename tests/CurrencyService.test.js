const {
  updateExchangeRates,
  getExchangeRate,
  fetchRatesFromPrimary_,
  fetchRatesFromFallback_,
  fetchExchangeRates_,
  getCachedRates_,
  cacheRates_,
  getExchangeRates_,
  EXCHANGE_RATE_API_URL,
  FRANKFURTER_API_URL,
  CACHE_TTL,
} = require('../src/CurrencyService');

function mockFetchResponse(code, body) {
  return {
    getResponseCode: jest.fn(() => code),
    getContentText: jest.fn(() => typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

const SAMPLE_PRIMARY_RESPONSE = {
  result: 'success',
  base_code: 'USD',
  conversion_rates: { EUR: 0.85, GBP: 0.73, RUB: 92.5, USD: 1 },
};

const SAMPLE_FALLBACK_RESPONSE = {
  base: 'USD',
  date: '2024-01-15',
  rates: { EUR: 0.85, GBP: 0.73 },
};

beforeEach(() => {
  UrlFetchApp.fetch.mockReset();
  Logger.log.mockClear();
  CacheService.getScriptCache().get.mockReset();
  CacheService.getScriptCache().put.mockReset();
  CacheService.getScriptCache()._reset();
});

// --- fetchRatesFromPrimary_ ---

describe('fetchRatesFromPrimary_', () => {
  test('returns conversion_rates on success', () => {
    UrlFetchApp.fetch.mockReturnValue(mockFetchResponse(200, SAMPLE_PRIMARY_RESPONSE));
    const result = fetchRatesFromPrimary_('USD');
    expect(result).toEqual(SAMPLE_PRIMARY_RESPONSE.conversion_rates);
    expect(UrlFetchApp.fetch).toHaveBeenCalledWith(
      EXCHANGE_RATE_API_URL + 'USD',
      { muteHttpExceptions: true }
    );
  });

  test('returns null on HTTP error', () => {
    UrlFetchApp.fetch.mockReturnValue(mockFetchResponse(500, 'Server Error'));
    expect(fetchRatesFromPrimary_('USD')).toBeNull();
    expect(Logger.log).toHaveBeenCalledWith(expect.stringContaining('HTTP 500'));
  });

  test('returns null on invalid JSON', () => {
    UrlFetchApp.fetch.mockReturnValue(mockFetchResponse(200, 'not json'));
    expect(fetchRatesFromPrimary_('USD')).toBeNull();
  });

  test('returns null when result is not success', () => {
    UrlFetchApp.fetch.mockReturnValue(
      mockFetchResponse(200, { result: 'error', 'error-type': 'invalid-key' })
    );
    expect(fetchRatesFromPrimary_('USD')).toBeNull();
  });

  test('returns null on network error', () => {
    UrlFetchApp.fetch.mockImplementation(() => { throw new Error('Network error'); });
    expect(fetchRatesFromPrimary_('USD')).toBeNull();
    expect(Logger.log).toHaveBeenCalledWith(expect.stringContaining('Network error'));
  });
});

// --- fetchRatesFromFallback_ ---

describe('fetchRatesFromFallback_', () => {
  test('returns rates with base currency added', () => {
    UrlFetchApp.fetch.mockReturnValue(mockFetchResponse(200, SAMPLE_FALLBACK_RESPONSE));
    const result = fetchRatesFromFallback_('USD');
    expect(result.EUR).toBe(0.85);
    expect(result.GBP).toBe(0.73);
    expect(result.USD).toBe(1);
  });

  test('uses correct fallback URL', () => {
    UrlFetchApp.fetch.mockReturnValue(mockFetchResponse(200, SAMPLE_FALLBACK_RESPONSE));
    fetchRatesFromFallback_('EUR');
    expect(UrlFetchApp.fetch).toHaveBeenCalledWith(
      FRANKFURTER_API_URL + 'EUR',
      { muteHttpExceptions: true }
    );
  });

  test('returns null on HTTP error', () => {
    UrlFetchApp.fetch.mockReturnValue(mockFetchResponse(404, 'Not Found'));
    expect(fetchRatesFromFallback_('USD')).toBeNull();
  });

  test('returns null when no rates in response', () => {
    UrlFetchApp.fetch.mockReturnValue(mockFetchResponse(200, { base: 'USD' }));
    expect(fetchRatesFromFallback_('USD')).toBeNull();
  });

  test('returns null on exception', () => {
    UrlFetchApp.fetch.mockImplementation(() => { throw new Error('Timeout'); });
    expect(fetchRatesFromFallback_('USD')).toBeNull();
  });
});

// --- fetchExchangeRates_ ---

describe('fetchExchangeRates_', () => {
  test('returns primary rates when primary succeeds', () => {
    UrlFetchApp.fetch.mockReturnValue(mockFetchResponse(200, SAMPLE_PRIMARY_RESPONSE));
    const result = fetchExchangeRates_('USD');
    expect(result).toEqual(SAMPLE_PRIMARY_RESPONSE.conversion_rates);
    expect(UrlFetchApp.fetch).toHaveBeenCalledTimes(1);
  });

  test('falls back when primary fails', () => {
    UrlFetchApp.fetch
      .mockReturnValueOnce(mockFetchResponse(500, 'Error'))
      .mockReturnValueOnce(mockFetchResponse(200, SAMPLE_FALLBACK_RESPONSE));
    const result = fetchExchangeRates_('USD');
    expect(result.EUR).toBe(0.85);
    expect(UrlFetchApp.fetch).toHaveBeenCalledTimes(2);
    expect(Logger.log).toHaveBeenCalledWith(expect.stringContaining('fallback'));
  });

  test('returns null when both fail', () => {
    UrlFetchApp.fetch.mockReturnValue(mockFetchResponse(500, 'Error'));
    expect(fetchExchangeRates_('USD')).toBeNull();
    expect(Logger.log).toHaveBeenCalledWith(expect.stringContaining('All exchange rate APIs failed'));
  });
});

// --- Caching ---

describe('getCachedRates_', () => {
  test('returns parsed rates from cache', () => {
    const rates = { EUR: 0.85 };
    CacheService.getScriptCache().get.mockReturnValue(JSON.stringify(rates));
    expect(getCachedRates_('USD')).toEqual(rates);
  });

  test('returns null when cache empty', () => {
    CacheService.getScriptCache().get.mockReturnValue(null);
    expect(getCachedRates_('USD')).toBeNull();
  });

  test('returns null on corrupt cache JSON', () => {
    CacheService.getScriptCache().get.mockReturnValue('not json{');
    expect(getCachedRates_('USD')).toBeNull();
  });
});

describe('cacheRates_', () => {
  test('stores rates with correct key and TTL', () => {
    const rates = { EUR: 0.85 };
    cacheRates_('USD', rates);
    expect(CacheService.getScriptCache().put).toHaveBeenCalledWith(
      'exchange_rates_USD',
      JSON.stringify(rates),
      CACHE_TTL
    );
  });

  test('does not throw if cache fails', () => {
    CacheService.getScriptCache().put.mockImplementation(() => { throw new Error('Cache full'); });
    expect(() => cacheRates_('USD', {})).not.toThrow();
  });
});

describe('getExchangeRates_', () => {
  test('returns cached rates without HTTP call', () => {
    CacheService.getScriptCache().get.mockReturnValue(JSON.stringify({ EUR: 0.85 }));
    const result = getExchangeRates_('USD');
    expect(result).toEqual({ EUR: 0.85 });
    expect(UrlFetchApp.fetch).not.toHaveBeenCalled();
  });

  test('fetches and caches when cache miss', () => {
    CacheService.getScriptCache().get.mockReturnValue(null);
    UrlFetchApp.fetch.mockReturnValue(mockFetchResponse(200, SAMPLE_PRIMARY_RESPONSE));
    const result = getExchangeRates_('USD');
    expect(result).toEqual(SAMPLE_PRIMARY_RESPONSE.conversion_rates);
    expect(CacheService.getScriptCache().put).toHaveBeenCalled();
  });

  test('returns null when both cache and API fail', () => {
    CacheService.getScriptCache().get.mockReturnValue(null);
    UrlFetchApp.fetch.mockReturnValue(mockFetchResponse(500, 'Error'));
    expect(getExchangeRates_('USD')).toBeNull();
  });
});

// --- getExchangeRate ---

describe('getExchangeRate', () => {
  beforeEach(() => {
    CacheService.getScriptCache().get.mockReturnValue(
      JSON.stringify({ EUR: 0.85, GBP: 0.73, RUB: 92.5, USD: 1 })
    );
  });

  test('returns 1 when from === to', () => {
    expect(getExchangeRate('USD', 'USD')).toBe(1);
    expect(UrlFetchApp.fetch).not.toHaveBeenCalled();
  });

  test('returns rate for known currency', () => {
    expect(getExchangeRate('USD', 'EUR')).toBe(0.85);
  });

  test('returns null for unknown currency', () => {
    expect(getExchangeRate('USD', 'XYZ')).toBeNull();
  });

  test('handles case insensitivity', () => {
    expect(getExchangeRate('usd', 'eur')).toBe(0.85);
  });

  test('returns null when API fails', () => {
    CacheService.getScriptCache().get.mockReturnValue(null);
    UrlFetchApp.fetch.mockReturnValue(mockFetchResponse(500, 'Error'));
    expect(getExchangeRate('USD', 'EUR')).toBeNull();
  });
});

// --- updateExchangeRates ---

describe('updateExchangeRates', () => {
  let mockSs;
  let txSheet;
  let settingsSheet;
  let setValueCalls;

  beforeEach(() => {
    setValueCalls = {};

    const settingsData = [
      ['Parameter', 'Value'],
      ['Base Currency', 'USD'],
    ];
    settingsSheet = _gasMocks.createMockSheet('Settings', settingsData);
    settingsSheet.getDataRange.mockReturnValue(_gasMocks.createMockRange(settingsData));

    const txData = [
      ['Date', 'Description', 'Category', 'Amount (USD)', 'Amount (Local)', 'Currency'],
      ['2024-01-01', 'Coffee', 'Food', '', 9250, 'RUB'],
      ['2024-01-02', 'Taxi', 'Transport', '', 85, 'EUR'],
      ['2024-01-03', 'Salary', 'Income', 1000, 1000, 'USD'],
    ];
    txSheet = _gasMocks.createMockSheet('Transactions', txData);
    txSheet.getDataRange.mockReturnValue(_gasMocks.createMockRange(txData));
    txSheet.getRange.mockImplementation((row, col) => {
      const range = _gasMocks.createMockRange();
      range.setValue.mockImplementation((v) => {
        setValueCalls[row + ',' + col] = v;
        return range;
      });
      return range;
    });

    mockSs = _gasMocks.createMockSpreadsheet([txSheet, settingsSheet]);
    SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(mockSs);

    // Mock exchange rates via cache
    CacheService.getScriptCache().get.mockReturnValue(
      JSON.stringify({ EUR: 0.85, GBP: 0.73, RUB: 92.5, USD: 1 })
    );
  });

  test('converts RUB correctly: 9250 / 92.5 = 100', () => {
    updateExchangeRates();
    expect(setValueCalls['2,4']).toBe(100);
  });

  test('converts EUR correctly: 85 / 0.85 = 100', () => {
    updateExchangeRates();
    expect(setValueCalls['3,4']).toBe(100);
  });

  test('keeps USD amount unchanged: 1000', () => {
    updateExchangeRates();
    expect(setValueCalls['4,4']).toBe(1000);
  });

  test('skips rows with empty Amount (Local)', () => {
    const txData = [
      ['Date', 'Description', 'Category', 'Amount (USD)', 'Amount (Local)', 'Currency'],
      ['2024-01-01', 'Coffee', 'Food', '', '', 'RUB'],
    ];
    txSheet.getDataRange.mockReturnValue(_gasMocks.createMockRange(txData));
    updateExchangeRates();
    expect(Object.keys(setValueCalls).length).toBe(0);
  });

  test('skips rows with empty Currency', () => {
    const txData = [
      ['Date', 'Description', 'Category', 'Amount (USD)', 'Amount (Local)', 'Currency'],
      ['2024-01-01', 'Coffee', 'Food', '', 500, ''],
    ];
    txSheet.getDataRange.mockReturnValue(_gasMocks.createMockRange(txData));
    updateExchangeRates();
    expect(Object.keys(setValueCalls).length).toBe(0);
  });

  test('skips unknown currency and logs', () => {
    const txData = [
      ['Date', 'Description', 'Category', 'Amount (USD)', 'Amount (Local)', 'Currency'],
      ['2024-01-01', 'Item', 'Other', '', 100, 'XYZ'],
    ];
    txSheet.getDataRange.mockReturnValue(_gasMocks.createMockRange(txData));
    updateExchangeRates();
    expect(Object.keys(setValueCalls).length).toBe(0);
    expect(Logger.log).toHaveBeenCalledWith(expect.stringContaining('No rate for currency: XYZ'));
  });

  test('does nothing when API fails', () => {
    CacheService.getScriptCache().get.mockReturnValue(null);
    UrlFetchApp.fetch.mockReturnValue(mockFetchResponse(500, 'Error'));
    updateExchangeRates();
    expect(Object.keys(setValueCalls).length).toBe(0);
  });

  test('handles missing Transactions sheet', () => {
    mockSs = _gasMocks.createMockSpreadsheet([settingsSheet]);
    SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(mockSs);
    expect(() => updateExchangeRates()).not.toThrow();
    expect(Logger.log).toHaveBeenCalledWith('Transactions sheet not found');
  });

  test('handles header-only Transactions', () => {
    const txData = [
      ['Date', 'Description', 'Category', 'Amount (USD)', 'Amount (Local)', 'Currency'],
    ];
    txSheet.getDataRange.mockReturnValue(_gasMocks.createMockRange(txData));
    updateExchangeRates();
    expect(Object.keys(setValueCalls).length).toBe(0);
  });

  test('reads Base Currency from Settings', () => {
    const settingsDataEUR = [
      ['Parameter', 'Value'],
      ['Base Currency', 'EUR'],
    ];
    settingsSheet.getDataRange.mockReturnValue(_gasMocks.createMockRange(settingsDataEUR));
    CacheService.getScriptCache().get.mockReturnValue(
      JSON.stringify({ USD: 1.18, RUB: 108.5 })
    );
    const txData = [
      ['Date', 'Description', 'Category', 'Amount (EUR)', 'Amount (Local)', 'Currency'],
      ['2024-01-01', 'Item', 'Other', '', 118, 'USD'],
    ];
    txSheet.getDataRange.mockReturnValue(_gasMocks.createMockRange(txData));
    updateExchangeRates();
    expect(setValueCalls['2,4']).toBe(100);
  });

  test('rounds to 2 decimal places', () => {
    CacheService.getScriptCache().get.mockReturnValue(
      JSON.stringify({ EUR: 0.85, RUB: 92.5, USD: 1, GBP: 0.73 })
    );
    const txData = [
      ['Date', 'Description', 'Category', 'Amount (USD)', 'Amount (Local)', 'Currency'],
      ['2024-01-01', 'Item', 'Other', '', 100, 'GBP'],
    ];
    txSheet.getDataRange.mockReturnValue(_gasMocks.createMockRange(txData));
    updateExchangeRates();
    // 100 / 0.73 = 136.986... -> 136.99
    expect(setValueCalls['2,4']).toBe(136.99);
  });
});
