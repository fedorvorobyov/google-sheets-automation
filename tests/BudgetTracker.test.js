const {
  getCategoryTotals,
  getBudgetLimit,
  getAlertThreshold,
  getStatus,
  getBudgetSummary,
  getOverBudgetCategories,
  checkBudgetAlerts,
  STATUS_OK,
  STATUS_WARNING,
  STATUS_OVER,
} = require('../src/BudgetTracker');

function setupSheets(txData, settingsData) {
  settingsData = settingsData || [
    ['Parameter', 'Value'],
    ['Budget Limit', 5000],
    ['Alert Threshold', '80%'],
  ];
  const settingsSheet = _gasMocks.createMockSheet('Settings', settingsData);
  settingsSheet.getDataRange.mockReturnValue(_gasMocks.createMockRange(settingsData));

  const txSheet = _gasMocks.createMockSheet('Transactions', txData);
  txSheet.getDataRange.mockReturnValue(_gasMocks.createMockRange(txData));

  const mockSs = _gasMocks.createMockSpreadsheet([txSheet, settingsSheet]);
  SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(mockSs);
  return { txSheet, settingsSheet, mockSs };
}

beforeEach(() => {
  Logger.log.mockClear();
});

// --- getStatus ---

describe('getStatus', () => {
  test('returns OK when under threshold', () => {
    expect(getStatus(3000, 5000, 0.8)).toBe(STATUS_OK);
  });

  test('returns Warning at threshold', () => {
    expect(getStatus(4000, 5000, 0.8)).toBe(STATUS_WARNING);
  });

  test('returns Warning between threshold and budget', () => {
    expect(getStatus(4500, 5000, 0.8)).toBe(STATUS_WARNING);
  });

  test('returns Over Budget at exactly 100%', () => {
    expect(getStatus(5000, 5000, 0.8)).toBe(STATUS_OVER);
  });

  test('returns Over Budget when exceeding', () => {
    expect(getStatus(6000, 5000, 0.8)).toBe(STATUS_OVER);
  });

  test('returns OK when budget is 0', () => {
    expect(getStatus(100, 0, 0.8)).toBe(STATUS_OK);
  });

  test('returns OK when budget is negative', () => {
    expect(getStatus(100, -500, 0.8)).toBe(STATUS_OK);
  });

  test('returns OK when spent is 0', () => {
    expect(getStatus(0, 5000, 0.8)).toBe(STATUS_OK);
  });
});

// --- getCategoryTotals ---

describe('getCategoryTotals', () => {
  test('sums amounts by category', () => {
    const txData = [
      ['Date', 'Description', 'Category', 'Amount (USD)', 'Amount (Local)', 'Currency'],
      ['2024-01-01', 'Coffee', 'Food', 5, 500, 'RUB'],
      ['2024-01-02', 'Lunch', 'Food', 15, 1500, 'RUB'],
      ['2024-01-03', 'Taxi', 'Transport', 20, 20, 'USD'],
    ];
    setupSheets(txData);
    const totals = getCategoryTotals();
    expect(totals['Food']).toBe(20);
    expect(totals['Transport']).toBe(20);
  });

  test('returns empty object for empty transactions', () => {
    const txData = [
      ['Date', 'Description', 'Category', 'Amount (USD)', 'Amount (Local)', 'Currency'],
    ];
    setupSheets(txData);
    expect(getCategoryTotals()).toEqual({});
  });

  test('skips rows with empty category', () => {
    const txData = [
      ['Date', 'Description', 'Category', 'Amount (USD)', 'Amount (Local)', 'Currency'],
      ['2024-01-01', 'Item', '', 100, 100, 'USD'],
      ['2024-01-02', 'Food', 'Food', 50, 50, 'USD'],
    ];
    setupSheets(txData);
    const totals = getCategoryTotals();
    expect(totals['']).toBeUndefined();
    expect(totals['Food']).toBe(50);
  });

  test('skips rows with non-numeric amount', () => {
    const txData = [
      ['Date', 'Description', 'Category', 'Amount (USD)', 'Amount (Local)', 'Currency'],
      ['2024-01-01', 'Item', 'Food', 'abc', 100, 'USD'],
      ['2024-01-02', 'Other', 'Food', 50, 50, 'USD'],
    ];
    setupSheets(txData);
    expect(getCategoryTotals()['Food']).toBe(50);
  });

  test('returns empty object when Transactions sheet missing', () => {
    const settingsData = [['Parameter', 'Value'], ['Budget Limit', 5000]];
    const settingsSheet = _gasMocks.createMockSheet('Settings', settingsData);
    settingsSheet.getDataRange.mockReturnValue(_gasMocks.createMockRange(settingsData));
    const mockSs = _gasMocks.createMockSpreadsheet([settingsSheet]);
    SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(mockSs);
    expect(getCategoryTotals()).toEqual({});
  });

  test('rounds totals to 2 decimal places', () => {
    const txData = [
      ['Date', 'Description', 'Category', 'Amount (USD)', 'Amount (Local)', 'Currency'],
      ['2024-01-01', 'A', 'Food', 10.111, 10, 'USD'],
      ['2024-01-02', 'B', 'Food', 10.222, 10, 'USD'],
    ];
    setupSheets(txData);
    expect(getCategoryTotals()['Food']).toBe(20.33);
  });
});

// --- getBudgetLimit / getAlertThreshold ---

describe('getBudgetLimit', () => {
  test('reads from Settings', () => {
    const settingsData = [['Parameter', 'Value'], ['Budget Limit', 3000]];
    const settingsSheet = _gasMocks.createMockSheet('Settings', settingsData);
    settingsSheet.getDataRange.mockReturnValue(_gasMocks.createMockRange(settingsData));
    const mockSs = _gasMocks.createMockSpreadsheet([settingsSheet]);
    SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(mockSs);
    expect(getBudgetLimit()).toBe(3000);
  });
});

describe('getAlertThreshold', () => {
  test('reads percentage from Settings', () => {
    const settingsData = [['Parameter', 'Value'], ['Alert Threshold', '90%']];
    const settingsSheet = _gasMocks.createMockSheet('Settings', settingsData);
    settingsSheet.getDataRange.mockReturnValue(_gasMocks.createMockRange(settingsData));
    const mockSs = _gasMocks.createMockSpreadsheet([settingsSheet]);
    SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(mockSs);
    expect(getAlertThreshold()).toBe(0.9);
  });
});

// --- getBudgetSummary ---

describe('getBudgetSummary', () => {
  test('returns sorted summary with correct fields', () => {
    const txData = [
      ['Date', 'Description', 'Category', 'Amount (USD)', 'Amount (Local)', 'Currency'],
      ['2024-01-01', 'A', 'Transport', 200, 200, 'USD'],
      ['2024-01-02', 'B', 'Food', 4500, 4500, 'USD'],
    ];
    setupSheets(txData);
    const summary = getBudgetSummary();
    expect(summary).toHaveLength(2);
    // Sorted: Food, Transport
    expect(summary[0].category).toBe('Food');
    expect(summary[0].total).toBe(4500);
    expect(summary[0].budget).toBe(5000);
    expect(summary[0].remaining).toBe(500);
    expect(summary[0].status).toBe(STATUS_WARNING);

    expect(summary[1].category).toBe('Transport');
    expect(summary[1].total).toBe(200);
    expect(summary[1].remaining).toBe(4800);
    expect(summary[1].status).toBe(STATUS_OK);
  });

  test('returns empty array when no transactions', () => {
    const txData = [
      ['Date', 'Description', 'Category', 'Amount (USD)', 'Amount (Local)', 'Currency'],
    ];
    setupSheets(txData);
    expect(getBudgetSummary()).toEqual([]);
  });
});

// --- getOverBudgetCategories ---

describe('getOverBudgetCategories', () => {
  test('returns categories at or over threshold', () => {
    const txData = [
      ['Date', 'Description', 'Category', 'Amount (USD)', 'Amount (Local)', 'Currency'],
      ['2024-01-01', 'A', 'Food', 4000, 4000, 'USD'],
      ['2024-01-02', 'B', 'Transport', 100, 100, 'USD'],
      ['2024-01-03', 'C', 'Marketing', 5500, 5500, 'USD'],
    ];
    setupSheets(txData);
    const alerts = getOverBudgetCategories();
    expect(alerts).toHaveLength(2);
    const names = alerts.map((a) => a.category);
    expect(names).toContain('Food');
    expect(names).toContain('Marketing');
    expect(names).not.toContain('Transport');
  });

  test('includes percent field', () => {
    const txData = [
      ['Date', 'Description', 'Category', 'Amount (USD)', 'Amount (Local)', 'Currency'],
      ['2024-01-01', 'A', 'Food', 4350, 4350, 'USD'],
    ];
    setupSheets(txData);
    const alerts = getOverBudgetCategories();
    expect(alerts[0].percent).toBe(87);
  });

  test('returns empty when all under threshold', () => {
    const txData = [
      ['Date', 'Description', 'Category', 'Amount (USD)', 'Amount (Local)', 'Currency'],
      ['2024-01-01', 'A', 'Food', 100, 100, 'USD'],
    ];
    setupSheets(txData);
    expect(getOverBudgetCategories()).toHaveLength(0);
  });
});

// --- checkBudgetAlerts ---

describe('checkBudgetAlerts', () => {
  let mockUi;

  beforeEach(() => {
    mockUi = _gasMocks.createMockUi();
    SpreadsheetApp.getUi.mockReturnValue(mockUi);
  });

  test('shows "within budget" when no alerts', () => {
    const txData = [
      ['Date', 'Description', 'Category', 'Amount (USD)', 'Amount (Local)', 'Currency'],
      ['2024-01-01', 'A', 'Food', 100, 100, 'USD'],
    ];
    setupSheets(txData);
    checkBudgetAlerts();
    expect(mockUi.alert).toHaveBeenCalledWith('All categories are within budget.');
  });

  test('shows alert message with over-budget categories', () => {
    const txData = [
      ['Date', 'Description', 'Category', 'Amount (USD)', 'Amount (Local)', 'Currency'],
      ['2024-01-01', 'A', 'Food', 4500, 4500, 'USD'],
    ];
    setupSheets(txData);
    checkBudgetAlerts();
    const msg = mockUi.alert.mock.calls[0][0];
    expect(msg).toContain('Food');
    expect(msg).toContain('90%');
    expect(msg).toContain('Budget alerts');
  });
});
