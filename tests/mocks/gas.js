/**
 * Google Apps Script global mocks for Jest.
 * Loaded via jest.config.js setupFiles.
 */

function createMockRange(data) {
  let values = data || [[]];
  let value = values[0] && values[0][0] !== undefined ? values[0][0] : '';

  const range = {
    getValue: jest.fn(() => value),
    setValue: jest.fn((v) => { value = v; return range; }),
    getValues: jest.fn(() => values),
    setValues: jest.fn((v) => { values = v; return range; }),
    setFontWeight: jest.fn(() => range),
    setBackground: jest.fn(() => range),
    setNumberFormat: jest.fn(() => range),
    getNumRows: jest.fn(() => values.length),
    getNumColumns: jest.fn(() => values[0] ? values[0].length : 0),
  };
  return range;
}

function createMockSheet(name, data) {
  const rows = data || [];

  const sheet = {
    getName: jest.fn(() => name),
    getRange: jest.fn((rowOrA1, col, numRows, numCols) => {
      return createMockRange();
    }),
    getLastRow: jest.fn(() => rows.length),
    appendRow: jest.fn((values) => { rows.push(values); }),
    setFrozenRows: jest.fn(),
    getDataRange: jest.fn(() => createMockRange(rows)),
    clear: jest.fn(),
    deleteRow: jest.fn(),
    insertRows: jest.fn(),
    _rows: rows,
  };
  return sheet;
}

function createMockMenu() {
  const menu = {
    addItem: jest.fn(() => menu),
    addSeparator: jest.fn(() => menu),
    addSubMenu: jest.fn(() => menu),
    addToUi: jest.fn(),
  };
  return menu;
}

function createMockUi() {
  const ui = {
    createMenu: jest.fn(() => createMockMenu()),
    alert: jest.fn(),
    prompt: jest.fn(),
    ButtonSet: { OK: 'OK', OK_CANCEL: 'OK_CANCEL', YES_NO: 'YES_NO' },
    Button: { OK: 'OK', CANCEL: 'CANCEL', YES: 'YES', NO: 'NO', CLOSE: 'CLOSE' },
  };
  return ui;
}

function createMockSpreadsheet(sheets) {
  const sheetMap = {};
  if (sheets) {
    sheets.forEach((s) => { sheetMap[s.getName()] = s; });
  }

  const ss = {
    getSheetByName: jest.fn((name) => sheetMap[name] || null),
    insertSheet: jest.fn((name) => {
      const newSheet = createMockSheet(name);
      sheetMap[name] = newSheet;
      return newSheet;
    }),
    getActiveSheet: jest.fn(() => {
      const keys = Object.keys(sheetMap);
      return keys.length > 0 ? sheetMap[keys[0]] : createMockSheet('Sheet1');
    }),
    getUrl: jest.fn(() => 'https://docs.google.com/spreadsheets/d/mock-id/edit'),
    getId: jest.fn(() => 'mock-id'),
    _sheetMap: sheetMap,
  };
  return ss;
}

// Set up globals
const mockSs = createMockSpreadsheet();
const mockUi = createMockUi();

global.SpreadsheetApp = {
  getActiveSpreadsheet: jest.fn(() => mockSs),
  getUi: jest.fn(() => mockUi),
};

global.Logger = {
  log: jest.fn(),
};

global.Utilities = {
  formatDate: jest.fn((date, timeZone, format) => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  }),
  formatString: jest.fn((template, ...args) => {
    let result = template;
    args.forEach((arg, i) => { result = result.replace('%s', arg); });
    return result;
  }),
};

global.Session = {
  getScriptTimeZone: jest.fn(() => 'Europe/Moscow'),
};

global.MailApp = {
  sendEmail: jest.fn(),
  getRemainingDailyQuota: jest.fn(() => 100),
};

global.UrlFetchApp = {
  fetch: jest.fn(() => ({
    getResponseCode: jest.fn(() => 200),
    getContentText: jest.fn(() => '{}'),
  })),
};

function createMockCache() {
  const store = {};
  const cache = {
    get: jest.fn((key) => store[key] || null),
    put: jest.fn((key, value, ttl) => { store[key] = value; }),
    getAll: jest.fn((keys) => {
      const result = {};
      keys.forEach((k) => { if (store[k]) result[k] = store[k]; });
      return result;
    }),
    putAll: jest.fn((values, ttl) => { Object.assign(store, values); }),
    remove: jest.fn((key) => { delete store[key]; }),
    _store: store,
    _reset: () => { Object.keys(store).forEach((k) => delete store[k]); },
  };
  return cache;
}

const mockCache = createMockCache();

global.CacheService = {
  getScriptCache: jest.fn(() => mockCache),
};

global.ScriptApp = {
  newTrigger: jest.fn(() => ({
    timeBased: jest.fn(() => ({
      everyDays: jest.fn(() => ({
        atHour: jest.fn(() => ({
          create: jest.fn(),
        })),
        create: jest.fn(),
      })),
      everyWeeks: jest.fn(() => ({
        onWeekDay: jest.fn(() => ({
          create: jest.fn(),
        })),
      })),
    })),
  })),
  getProjectTriggers: jest.fn(() => []),
  deleteTrigger: jest.fn(),
};

// Export factories for custom mock setups in tests
global._gasMocks = {
  createMockRange,
  createMockSheet,
  createMockMenu,
  createMockUi,
  createMockSpreadsheet,
  createMockCache,
};
