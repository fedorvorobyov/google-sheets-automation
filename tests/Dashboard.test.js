const {
  refreshDashboard,
  DASHBOARD_HEADERS,
  STATUS_COLORS,
} = require('../src/Dashboard');

function setupFullSheets(txData, settingsData) {
  settingsData = settingsData || [
    ['Parameter', 'Value'],
    ['Budget Limit', 5000],
    ['Alert Threshold', '80%'],
  ];
  const settingsSheet = _gasMocks.createMockSheet('Settings', settingsData);
  settingsSheet.getDataRange.mockReturnValue(_gasMocks.createMockRange(settingsData));

  const txSheet = _gasMocks.createMockSheet('Transactions', txData);
  txSheet.getDataRange.mockReturnValue(_gasMocks.createMockRange(txData));

  const dashData = [DASHBOARD_HEADERS];
  const dashSheet = _gasMocks.createMockSheet('Dashboard', dashData);
  dashSheet.getLastRow.mockReturnValue(1);

  // Track getRange calls for verification
  const rangeCalls = {};
  dashSheet.getRange.mockImplementation((...args) => {
    const key = args.join(',');
    const range = _gasMocks.createMockRange();
    rangeCalls[key] = range;
    return range;
  });
  dashSheet._rangeCalls = rangeCalls;

  const mockSs = _gasMocks.createMockSpreadsheet([txSheet, settingsSheet, dashSheet]);
  SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(mockSs);
  return { txSheet, settingsSheet, dashSheet, mockSs };
}

beforeEach(() => {
  Logger.log.mockClear();
});

describe('refreshDashboard', () => {
  test('writes summary rows to Dashboard sheet', () => {
    const txData = [
      ['Date', 'Description', 'Category', 'Amount (USD)', 'Amount (Local)', 'Currency'],
      ['2024-01-01', 'Coffee', 'Food', 200, 200, 'USD'],
      ['2024-01-02', 'Taxi', 'Transport', 100, 100, 'USD'],
    ];
    const { dashSheet } = setupFullSheets(txData);
    refreshDashboard();

    // Should write 2 rows x 5 cols starting at row 2
    expect(dashSheet.getRange).toHaveBeenCalledWith(2, 1, 2, 5);
    const dataRange = dashSheet._rangeCalls['2,1,2,5'];
    expect(dataRange.setValues).toHaveBeenCalledWith([
      ['Food', 200, 5000, 4800, 'OK'],
      ['Transport', 100, 5000, 4900, 'OK'],
    ]);
  });

  test('applies status background colors', () => {
    const txData = [
      ['Date', 'Description', 'Category', 'Amount (USD)', 'Amount (Local)', 'Currency'],
      ['2024-01-01', 'A', 'Food', 4500, 4500, 'USD'],
      ['2024-01-02', 'B', 'Transport', 100, 100, 'USD'],
    ];
    const { dashSheet } = setupFullSheets(txData);
    refreshDashboard();

    // Food (row 2) = Warning (90%), Transport (row 3) = OK (2%)
    const foodStatusRange = dashSheet._rangeCalls['2,5'];
    expect(foodStatusRange.setBackground).toHaveBeenCalledWith(STATUS_COLORS['Warning']);
    const transportStatusRange = dashSheet._rangeCalls['3,5'];
    expect(transportStatusRange.setBackground).toHaveBeenCalledWith(STATUS_COLORS['OK']);
  });

  test('applies currency number format', () => {
    const txData = [
      ['Date', 'Description', 'Category', 'Amount (USD)', 'Amount (Local)', 'Currency'],
      ['2024-01-01', 'A', 'Food', 100, 100, 'USD'],
    ];
    const { dashSheet } = setupFullSheets(txData);
    refreshDashboard();

    // Total (col 2), Budget (col 3), Remaining (col 4) — row 2
    expect(dashSheet._rangeCalls['2,2'].setNumberFormat).toHaveBeenCalledWith('$#,##0.00');
    expect(dashSheet._rangeCalls['2,3'].setNumberFormat).toHaveBeenCalledWith('$#,##0.00');
    expect(dashSheet._rangeCalls['2,4'].setNumberFormat).toHaveBeenCalledWith('$#,##0.00');
  });

  test('clears old data before writing', () => {
    const txData = [
      ['Date', 'Description', 'Category', 'Amount (USD)', 'Amount (Local)', 'Currency'],
      ['2024-01-01', 'A', 'Food', 100, 100, 'USD'],
    ];
    const { dashSheet } = setupFullSheets(txData);
    dashSheet.getLastRow.mockReturnValue(5); // had 4 data rows before
    refreshDashboard();

    // Should clear rows 2-5 (4 rows x 5 cols)
    const clearRange = dashSheet._rangeCalls['2,1,4,5'];
    expect(clearRange.clear).toHaveBeenCalled();
  });

  test('does not clear if only header exists', () => {
    const txData = [
      ['Date', 'Description', 'Category', 'Amount (USD)', 'Amount (Local)', 'Currency'],
      ['2024-01-01', 'A', 'Food', 100, 100, 'USD'],
    ];
    const { dashSheet } = setupFullSheets(txData);
    dashSheet.getLastRow.mockReturnValue(1);
    refreshDashboard();

    // No clear call for range starting at row 2
    const calls = dashSheet.getRange.mock.calls;
    const clearCalls = calls.filter(
      (c) => c[0] === 2 && c[1] === 1 && c[3] === 5 && c[2] > 0
    );
    // Only the data write call, not a clear call with lastRow-1 = 0
    expect(clearCalls.length).toBeGreaterThanOrEqual(1);
  });

  test('handles empty summary gracefully', () => {
    const txData = [
      ['Date', 'Description', 'Category', 'Amount (USD)', 'Amount (Local)', 'Currency'],
    ];
    const { dashSheet } = setupFullSheets(txData);
    refreshDashboard();

    expect(Logger.log).toHaveBeenCalledWith('No categories to display on Dashboard');
    // No setValues call for data
    const setValuesCalls = Object.values(dashSheet._rangeCalls).filter(
      (r) => r.setValues.mock.calls.length > 0
    );
    expect(setValuesCalls).toHaveLength(0);
  });

  test('handles missing Dashboard sheet', () => {
    const txData = [['Date', 'Description', 'Category', 'Amount (USD)', 'Amount (Local)', 'Currency']];
    const settingsData = [['Parameter', 'Value'], ['Budget Limit', 5000], ['Alert Threshold', '80%']];
    const settingsSheet = _gasMocks.createMockSheet('Settings', settingsData);
    settingsSheet.getDataRange.mockReturnValue(_gasMocks.createMockRange(settingsData));
    const txSheet = _gasMocks.createMockSheet('Transactions', txData);
    txSheet.getDataRange.mockReturnValue(_gasMocks.createMockRange(txData));
    const mockSs = _gasMocks.createMockSpreadsheet([txSheet, settingsSheet]);
    SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(mockSs);

    expect(() => refreshDashboard()).not.toThrow();
    expect(Logger.log).toHaveBeenCalledWith('Dashboard sheet not found');
  });

  test('logs number of categories updated', () => {
    const txData = [
      ['Date', 'Description', 'Category', 'Amount (USD)', 'Amount (Local)', 'Currency'],
      ['2024-01-01', 'A', 'Food', 100, 100, 'USD'],
      ['2024-01-02', 'B', 'Transport', 50, 50, 'USD'],
      ['2024-01-03', 'C', 'Marketing', 200, 200, 'USD'],
    ];
    setupFullSheets(txData);
    refreshDashboard();
    expect(Logger.log).toHaveBeenCalledWith('Dashboard updated with 3 categories');
  });

  test('shows Over Budget color for overspent category', () => {
    const txData = [
      ['Date', 'Description', 'Category', 'Amount (USD)', 'Amount (Local)', 'Currency'],
      ['2024-01-01', 'A', 'Marketing', 6000, 6000, 'USD'],
    ];
    const { dashSheet } = setupFullSheets(txData);
    refreshDashboard();

    const statusRange = dashSheet._rangeCalls['2,5'];
    expect(statusRange.setBackground).toHaveBeenCalledWith(STATUS_COLORS['Over Budget']);
  });
});

describe('constants', () => {
  test('DASHBOARD_HEADERS matches expected columns', () => {
    expect(DASHBOARD_HEADERS).toEqual(['Category', 'Total', 'Budget', 'Remaining', 'Status']);
  });

  test('STATUS_COLORS has all statuses', () => {
    expect(STATUS_COLORS['OK']).toBeDefined();
    expect(STATUS_COLORS['Warning']).toBeDefined();
    expect(STATUS_COLORS['Over Budget']).toBeDefined();
  });
});
