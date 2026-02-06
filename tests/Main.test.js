const {
  onOpen,
  initializeSpreadsheet,
  showAddTransactionSidebar,
  ensureSheet_,
  DEFAULT_SETTINGS,
  SHEET_HEADERS,
} = require('../src/Main');

describe('onOpen', () => {
  let mockMenu;
  let mockUi;
  let mockSs;

  beforeEach(() => {
    mockMenu = _gasMocks.createMockMenu();
    mockUi = _gasMocks.createMockUi();
    mockUi.createMenu.mockReturnValue(mockMenu);
    mockSs = _gasMocks.createMockSpreadsheet();
    SpreadsheetApp.getUi.mockReturnValue(mockUi);
    SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(mockSs);
  });

  test('creates menu with title "Budget Tools"', () => {
    onOpen();
    expect(mockUi.createMenu).toHaveBeenCalledWith('Budget Tools');
  });

  test('adds all four menu items with correct names', () => {
    onOpen();
    expect(mockMenu.addItem).toHaveBeenCalledWith('Update Exchange Rates', 'updateExchangeRates');
    expect(mockMenu.addItem).toHaveBeenCalledWith('Refresh Dashboard', 'refreshDashboard');
    expect(mockMenu.addItem).toHaveBeenCalledWith('Check Budget Alerts', 'checkBudgetAlerts');
    expect(mockMenu.addItem).toHaveBeenCalledWith('Add Transaction', 'showAddTransactionSidebar');
  });

  test('adds separator before Add Transaction', () => {
    onOpen();
    expect(mockMenu.addSeparator).toHaveBeenCalled();
  });

  test('calls addToUi exactly once', () => {
    onOpen();
    expect(mockMenu.addToUi).toHaveBeenCalledTimes(1);
  });

  test('calls initializeSpreadsheet', () => {
    onOpen();
    // initializeSpreadsheet is called inside onOpen,
    // which calls getActiveSpreadsheet and getSheetByName
    expect(SpreadsheetApp.getActiveSpreadsheet).toHaveBeenCalled();
  });
});

describe('initializeSpreadsheet', () => {
  let mockSs;

  beforeEach(() => {
    mockSs = _gasMocks.createMockSpreadsheet();
    SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(mockSs);
  });

  test('creates Transactions sheet when missing', () => {
    initializeSpreadsheet();
    expect(mockSs.insertSheet).toHaveBeenCalledWith('Transactions');
  });

  test('creates Dashboard sheet when missing', () => {
    initializeSpreadsheet();
    expect(mockSs.insertSheet).toHaveBeenCalledWith('Dashboard');
  });

  test('creates Settings sheet when missing', () => {
    initializeSpreadsheet();
    expect(mockSs.insertSheet).toHaveBeenCalledWith('Settings');
  });

  test('does NOT create sheet if it already exists', () => {
    const existingSheet = _gasMocks.createMockSheet('Transactions');
    mockSs = _gasMocks.createMockSpreadsheet([existingSheet]);
    SpreadsheetApp.getActiveSpreadsheet.mockReturnValue(mockSs);
    initializeSpreadsheet();
    expect(mockSs.insertSheet).not.toHaveBeenCalledWith('Transactions');
  });

  test('sets correct headers for Transactions', () => {
    initializeSpreadsheet();
    const txSheet = mockSs.getSheetByName('Transactions');
    expect(txSheet.getRange).toHaveBeenCalledWith(1, 1, 1, 6);
  });

  test('sets correct headers for Dashboard', () => {
    initializeSpreadsheet();
    const dashSheet = mockSs.getSheetByName('Dashboard');
    expect(dashSheet.getRange).toHaveBeenCalledWith(1, 1, 1, 5);
  });

  test('freezes first row on each new sheet', () => {
    initializeSpreadsheet();
    const txSheet = mockSs.getSheetByName('Transactions');
    const dashSheet = mockSs.getSheetByName('Dashboard');
    const settingsSheet = mockSs.getSheetByName('Settings');
    expect(txSheet.setFrozenRows).toHaveBeenCalledWith(1);
    expect(dashSheet.setFrozenRows).toHaveBeenCalledWith(1);
    expect(settingsSheet.setFrozenRows).toHaveBeenCalledWith(1);
  });

  test('populates default settings data', () => {
    initializeSpreadsheet();
    const settingsSheet = mockSs.getSheetByName('Settings');
    // Default settings: 4 rows x 2 columns, starting at row 2
    expect(settingsSheet.getRange).toHaveBeenCalledWith(2, 1, 4, 2);
  });
});

describe('ensureSheet_', () => {
  test('returns existing sheet without creating', () => {
    const existing = _gasMocks.createMockSheet('MySheet');
    const ss = _gasMocks.createMockSpreadsheet([existing]);
    const result = ensureSheet_(ss, 'MySheet', ['A', 'B']);
    expect(result).toBe(existing);
    expect(ss.insertSheet).not.toHaveBeenCalled();
  });

  test('creates new sheet with headers and default data', () => {
    const ss = _gasMocks.createMockSpreadsheet();
    const result = ensureSheet_(ss, 'New', ['H1', 'H2'], [['a', 'b']]);
    expect(ss.insertSheet).toHaveBeenCalledWith('New');
    expect(result.setFrozenRows).toHaveBeenCalledWith(1);
  });
});

describe('showAddTransactionSidebar', () => {
  test('does not throw', () => {
    const mockUi = _gasMocks.createMockUi();
    SpreadsheetApp.getUi.mockReturnValue(mockUi);
    expect(() => showAddTransactionSidebar()).not.toThrow();
    expect(mockUi.alert).toHaveBeenCalled();
  });
});
