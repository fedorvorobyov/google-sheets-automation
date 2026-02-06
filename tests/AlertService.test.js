const {
  sendAlert,
  buildAlertBody,
  buildWeeklySummaryBody,
  sendBudgetAlerts,
  sendWeeklySummary,
} = require('../src/AlertService');

function setupSheets(txData, settingsData) {
  settingsData = settingsData || [
    ['Parameter', 'Value'],
    ['Budget Limit', 5000],
    ['Alert Threshold', '80%'],
    ['Alert Email', 'user@example.com'],
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
  MailApp.sendEmail.mockReset();
  Logger.log.mockClear();
});

// --- sendAlert ---

describe('sendAlert', () => {
  test('sends email via MailApp', () => {
    const result = sendAlert('user@example.com', 'Test Subject', 'Test Body');
    expect(result).toBe(true);
    expect(MailApp.sendEmail).toHaveBeenCalledWith('user@example.com', 'Test Subject', 'Test Body');
  });

  test('returns false for empty email', () => {
    expect(sendAlert('', 'Subject', 'Body')).toBe(false);
    expect(MailApp.sendEmail).not.toHaveBeenCalled();
  });

  test('returns false for null email', () => {
    expect(sendAlert(null, 'Subject', 'Body')).toBe(false);
  });

  test('returns false and logs on MailApp error', () => {
    MailApp.sendEmail.mockImplementation(() => { throw new Error('Quota exceeded'); });
    expect(sendAlert('user@example.com', 'Subject', 'Body')).toBe(false);
    expect(Logger.log).toHaveBeenCalledWith(expect.stringContaining('Quota exceeded'));
  });

  test('logs successful send', () => {
    sendAlert('user@example.com', 'Test', 'Body');
    expect(Logger.log).toHaveBeenCalledWith(expect.stringContaining('Alert sent to user@example.com'));
  });
});

// --- buildAlertBody ---

describe('buildAlertBody', () => {
  beforeEach(() => {
    const mockSs = _gasMocks.createMockSpreadsheet();
    SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(mockSs);
  });

  test('includes category name', () => {
    const body = buildAlertBody({ category: 'Marketing', total: 4350, budget: 5000, remaining: 650, percent: 87 });
    expect(body).toContain('"Marketing"');
  });

  test('includes percent', () => {
    const body = buildAlertBody({ category: 'Food', total: 4000, budget: 5000, remaining: 1000, percent: 80 });
    expect(body).toContain('80%');
  });

  test('includes formatted amounts', () => {
    const body = buildAlertBody({ category: 'Food', total: 4350, budget: 5000, remaining: 650, percent: 87 });
    expect(body).toContain('$4,350.00');
    expect(body).toContain('$5,000.00');
    expect(body).toContain('$650.00');
  });

  test('includes spreadsheet URL', () => {
    const body = buildAlertBody({ category: 'Food', total: 100, budget: 5000, remaining: 4900, percent: 2 });
    expect(body).toContain('https://docs.google.com/spreadsheets/d/mock-id/edit');
  });

  test('includes signature', () => {
    const body = buildAlertBody({ category: 'Food', total: 100, budget: 5000, remaining: 4900, percent: 2 });
    expect(body).toContain('Budget Tracker Automation');
  });
});

// --- buildWeeklySummaryBody ---

describe('buildWeeklySummaryBody', () => {
  beforeEach(() => {
    const mockSs = _gasMocks.createMockSpreadsheet();
    SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(mockSs);
  });

  test('includes header', () => {
    const body = buildWeeklySummaryBody([]);
    expect(body).toContain('Weekly Budget Summary');
  });

  test('shows "no transactions" for empty summary', () => {
    const body = buildWeeklySummaryBody([]);
    expect(body).toContain('No transactions recorded');
  });

  test('lists categories with amounts and status', () => {
    const summary = [
      { category: 'Food', total: 200, budget: 5000, remaining: 4800, status: 'OK' },
      { category: 'Transport', total: 4500, budget: 5000, remaining: 500, status: 'Warning' },
    ];
    const body = buildWeeklySummaryBody(summary);
    expect(body).toContain('Food: $200.00 / $5,000.00 (OK)');
    expect(body).toContain('Transport: $4,500.00 / $5,000.00 (Warning)');
  });

  test('includes spreadsheet URL', () => {
    const body = buildWeeklySummaryBody([]);
    expect(body).toContain('View spreadsheet:');
  });
});

// --- sendBudgetAlerts ---

describe('sendBudgetAlerts', () => {
  test('sends emails for over-budget categories', () => {
    const txData = [
      ['Date', 'Description', 'Category', 'Amount (USD)', 'Amount (Local)', 'Currency'],
      ['2024-01-01', 'A', 'Food', 4500, 4500, 'USD'],
      ['2024-01-02', 'B', 'Transport', 100, 100, 'USD'],
    ];
    setupSheets(txData);
    sendBudgetAlerts();
    expect(MailApp.sendEmail).toHaveBeenCalledTimes(1);
    expect(MailApp.sendEmail.mock.calls[0][0]).toBe('user@example.com');
    expect(MailApp.sendEmail.mock.calls[0][1]).toContain('Food');
    expect(MailApp.sendEmail.mock.calls[0][1]).toContain('90%');
  });

  test('sends multiple alerts for multiple over-budget categories', () => {
    const txData = [
      ['Date', 'Description', 'Category', 'Amount (USD)', 'Amount (Local)', 'Currency'],
      ['2024-01-01', 'A', 'Food', 4500, 4500, 'USD'],
      ['2024-01-02', 'B', 'Marketing', 5500, 5500, 'USD'],
    ];
    setupSheets(txData);
    sendBudgetAlerts();
    expect(MailApp.sendEmail).toHaveBeenCalledTimes(2);
  });

  test('does nothing when no Alert Email configured', () => {
    const txData = [
      ['Date', 'Description', 'Category', 'Amount (USD)', 'Amount (Local)', 'Currency'],
      ['2024-01-01', 'A', 'Food', 4500, 4500, 'USD'],
    ];
    setupSheets(txData, [
      ['Parameter', 'Value'],
      ['Budget Limit', 5000],
      ['Alert Threshold', '80%'],
      ['Alert Email', ''],
    ]);
    sendBudgetAlerts();
    expect(MailApp.sendEmail).not.toHaveBeenCalled();
    expect(Logger.log).toHaveBeenCalledWith('Alert Email not configured in Settings');
  });

  test('does nothing when all under budget', () => {
    const txData = [
      ['Date', 'Description', 'Category', 'Amount (USD)', 'Amount (Local)', 'Currency'],
      ['2024-01-01', 'A', 'Food', 100, 100, 'USD'],
    ];
    setupSheets(txData);
    sendBudgetAlerts();
    expect(MailApp.sendEmail).not.toHaveBeenCalled();
    expect(Logger.log).toHaveBeenCalledWith('No budget alerts to send');
  });

  test('logs number of alerts sent', () => {
    const txData = [
      ['Date', 'Description', 'Category', 'Amount (USD)', 'Amount (Local)', 'Currency'],
      ['2024-01-01', 'A', 'Food', 4500, 4500, 'USD'],
    ];
    setupSheets(txData);
    sendBudgetAlerts();
    expect(Logger.log).toHaveBeenCalledWith('Sent 1 budget alert(s)');
  });
});

// --- sendWeeklySummary ---

describe('sendWeeklySummary', () => {
  test('sends weekly summary email', () => {
    const txData = [
      ['Date', 'Description', 'Category', 'Amount (USD)', 'Amount (Local)', 'Currency'],
      ['2024-01-01', 'A', 'Food', 200, 200, 'USD'],
    ];
    setupSheets(txData);
    sendWeeklySummary();
    expect(MailApp.sendEmail).toHaveBeenCalledTimes(1);
    expect(MailApp.sendEmail.mock.calls[0][1]).toBe('Weekly Budget Summary');
    expect(MailApp.sendEmail.mock.calls[0][2]).toContain('Food');
  });

  test('does nothing when no Alert Email', () => {
    const txData = [
      ['Date', 'Description', 'Category', 'Amount (USD)', 'Amount (Local)', 'Currency'],
    ];
    setupSheets(txData, [
      ['Parameter', 'Value'],
      ['Budget Limit', 5000],
      ['Alert Threshold', '80%'],
      ['Alert Email', ''],
    ]);
    sendWeeklySummary();
    expect(MailApp.sendEmail).not.toHaveBeenCalled();
  });

  test('sends summary even with no transactions', () => {
    const txData = [
      ['Date', 'Description', 'Category', 'Amount (USD)', 'Amount (Local)', 'Currency'],
    ];
    setupSheets(txData);
    sendWeeklySummary();
    expect(MailApp.sendEmail).toHaveBeenCalledTimes(1);
    expect(MailApp.sendEmail.mock.calls[0][2]).toContain('No transactions recorded');
  });
});
