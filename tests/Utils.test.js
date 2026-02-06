const {
  SHEET_NAMES,
  formatCurrency,
  formatDate,
  formatPercent,
  getSetting,
  getSettingAsNumber,
} = require('../src/Utils');

describe('SHEET_NAMES', () => {
  test('contains expected sheet names', () => {
    expect(SHEET_NAMES.TRANSACTIONS).toBe('Transactions');
    expect(SHEET_NAMES.DASHBOARD).toBe('Dashboard');
    expect(SHEET_NAMES.SETTINGS).toBe('Settings');
  });
});

describe('formatCurrency', () => {
  test('formats standard number', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });

  test('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  test('formats negative number', () => {
    expect(formatCurrency(-500)).toBe('-$500.00');
  });

  test('handles null', () => {
    expect(formatCurrency(null)).toBe('$0.00');
  });

  test('handles undefined', () => {
    expect(formatCurrency(undefined)).toBe('$0.00');
  });

  test('formats large number with commas', () => {
    expect(formatCurrency(1000000)).toBe('$1,000,000.00');
  });

  test('rounds to 2 decimal places', () => {
    expect(formatCurrency(1234.567)).toBe('$1,234.57');
  });

  test('handles non-numeric string', () => {
    expect(formatCurrency('abc')).toBe('$0.00');
  });

  test('uses custom symbol', () => {
    expect(formatCurrency(100, '€')).toBe('€100.00');
  });
});

describe('formatDate', () => {
  beforeEach(() => {
    Utilities.formatDate.mockClear();
    Session.getScriptTimeZone.mockClear();
  });

  test('calls Utilities.formatDate with correct args', () => {
    const date = new Date(2024, 0, 15);
    formatDate(date);
    expect(Utilities.formatDate).toHaveBeenCalledWith(
      date,
      'Europe/Moscow',
      'yyyy-MM-dd'
    );
  });

  test('passes custom format', () => {
    const date = new Date(2024, 5, 1);
    formatDate(date, 'dd/MM/yyyy');
    expect(Utilities.formatDate).toHaveBeenCalledWith(
      date,
      'Europe/Moscow',
      'dd/MM/yyyy'
    );
  });

  test('returns empty string for null', () => {
    expect(formatDate(null)).toBe('');
    expect(Utilities.formatDate).not.toHaveBeenCalled();
  });

  test('returns empty string for invalid date', () => {
    expect(formatDate(new Date('invalid'))).toBe('');
    expect(Utilities.formatDate).not.toHaveBeenCalled();
  });

  test('returns empty string for non-Date', () => {
    expect(formatDate('2024-01-15')).toBe('');
  });
});

describe('formatPercent', () => {
  test('formats standard fraction', () => {
    expect(formatPercent(0.8)).toBe('80%');
  });

  test('formats overspend (>1)', () => {
    expect(formatPercent(1.2)).toBe('120%');
  });

  test('formats zero', () => {
    expect(formatPercent(0)).toBe('0%');
  });

  test('handles null', () => {
    expect(formatPercent(null)).toBe('0%');
  });

  test('handles negative as 0%', () => {
    expect(formatPercent(-0.5)).toBe('0%');
  });

  test('formats fractional percent', () => {
    expect(formatPercent(0.875)).toBe('87.5%');
  });

  test('formats 100%', () => {
    expect(formatPercent(1)).toBe('100%');
  });
});

describe('getSetting', () => {
  let mockSs;
  let mockSheet;

  beforeEach(() => {
    const settingsData = [
      ['Parameter', 'Value'],
      ['Base Currency', 'USD'],
      ['Alert Email', 'user@mail.com'],
      ['Budget Limit', 5000],
      ['Alert Threshold', '80%'],
    ];
    mockSheet = _gasMocks.createMockSheet('Settings', settingsData);
    mockSheet.getDataRange.mockReturnValue(
      _gasMocks.createMockRange(settingsData)
    );
    mockSs = _gasMocks.createMockSpreadsheet([mockSheet]);
    SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(mockSs);
  });

  test('returns value for existing key', () => {
    expect(getSetting('Base Currency')).toBe('USD');
  });

  test('returns numeric value', () => {
    expect(getSetting('Budget Limit')).toBe(5000);
  });

  test('returns null for non-existing key', () => {
    expect(getSetting('Nonexistent')).toBeNull();
  });

  test('throws if Settings sheet missing', () => {
    const emptySs = _gasMocks.createMockSpreadsheet();
    SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(emptySs);
    expect(() => getSetting('Base Currency')).toThrow('Settings sheet not found');
  });

  test('trims key with spaces', () => {
    expect(getSetting('  Base Currency  ')).toBe('USD');
  });

  test('returns null for empty sheet (header only)', () => {
    const headerOnly = [['Parameter', 'Value']];
    mockSheet.getDataRange.mockReturnValue(
      _gasMocks.createMockRange(headerOnly)
    );
    expect(getSetting('Base Currency')).toBeNull();
  });
});

describe('getSettingAsNumber', () => {
  let mockSs;

  beforeEach(() => {
    const settingsData = [
      ['Parameter', 'Value'],
      ['Budget Limit', 5000],
      ['Alert Threshold', '80%'],
      ['Empty Param', ''],
      ['Text Param', 'abc'],
    ];
    const mockSheet = _gasMocks.createMockSheet('Settings', settingsData);
    mockSheet.getDataRange.mockReturnValue(
      _gasMocks.createMockRange(settingsData)
    );
    mockSs = _gasMocks.createMockSpreadsheet([mockSheet]);
    SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(mockSs);
  });

  test('returns number for numeric setting', () => {
    expect(getSettingAsNumber('Budget Limit')).toBe(5000);
  });

  test('converts percentage to fraction', () => {
    expect(getSettingAsNumber('Alert Threshold')).toBe(0.8);
  });

  test('returns default for missing key', () => {
    expect(getSettingAsNumber('Missing', 42)).toBe(42);
  });

  test('returns default for empty value', () => {
    expect(getSettingAsNumber('Empty Param', 10)).toBe(10);
  });

  test('returns default for non-numeric value', () => {
    expect(getSettingAsNumber('Text Param', 99)).toBe(99);
  });

  test('returns 0 as default when not specified', () => {
    expect(getSettingAsNumber('Missing')).toBe(0);
  });
});
