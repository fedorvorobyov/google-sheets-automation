# Google Sheets Budget Tracker

Automated budget tracking system built with Google Apps Script. Fetches exchange rates, categorizes expenses, generates dashboards, and sends email alerts — all inside Google Sheets.

## Features

- **Multi-currency support** — auto-fetches exchange rates from two APIs (exchangerate-api.com + frankfurter.app fallback) with 6-hour caching
- **Budget tracking** — aggregates spending per category, compares against configurable limits
- **Live dashboard** — color-coded summary sheet (green/yellow/red) regenerated on demand
- **Email alerts** — per-category notifications when spending exceeds threshold + weekly digest
- **Custom menu** — "Budget Tools" menu integrated into Google Sheets UI
- **Zero-config setup** — `initializeSpreadsheet()` creates all sheets with defaults on first run

## Spreadsheet Structure

```
Transactions                                          Dashboard
+---------+-----------+----------+------+-------+---+ +----------+-------+--------+-----------+--------+
| Date    | Descript. | Category | USD  | Local | C | | Category | Total | Budget | Remaining | Status |
+---------+-----------+----------+------+-------+---+ +----------+-------+--------+-----------+--------+
| 2024-01 | Coffee    | Food     | 5.41 | 500   |RUB| | Food     | $520  | $5,000 | $4,480    | OK     |
| 2024-01 | Taxi      | Transport| 100  | 85    |EUR| | Marketing| $4,350| $5,000 | $650      |Warning |
+---------+-----------+----------+------+-------+---+ +----------+-------+--------+-----------+--------+

Settings
+------------------+--------------+
| Parameter        | Value        |
+------------------+--------------+
| Base Currency    | USD          |
| Alert Email      | user@mail.com|
| Budget Limit     | 5000         |
| Alert Threshold  | 80%          |
+------------------+--------------+
```

## Project Structure

```
google-sheets-automation/
├── src/
│   ├── Main.js              # onOpen trigger, menu, sheet initialization
│   ├── Utils.js             # Formatting helpers, Settings reader
│   ├── CurrencyService.js   # Dual API fetch, caching, rate conversion
│   ├── BudgetTracker.js     # Category totals, budget status logic
│   ├── Dashboard.js         # Summary generation with color formatting
│   ├── AlertService.js      # Email alerts and weekly summary
│   └── appsscript.json      # GAS manifest (V8 runtime, OAuth scopes)
├── tests/
│   ├── mocks/gas.js         # GAS global mocks (SpreadsheetApp, MailApp, etc.)
│   ├── Main.test.js
│   ├── Utils.test.js
│   ├── CurrencyService.test.js
│   ├── BudgetTracker.test.js
│   ├── Dashboard.test.js
│   └── AlertService.test.js
├── jest.config.js
├── package.json
├── .clasp.json.example
└── .gitignore
```

## How It Works

### Menu (manual)

```
Google Sheets → Budget Tools →
  ├── Update Exchange Rates    → fetches rates, converts Amount (Local) → Amount (USD)
  ├── Refresh Dashboard        → regenerates category summary with colors
  ├── Check Budget Alerts      → shows UI alert for over-budget categories
  └── Add Transaction          → (coming soon)
```

### Triggers (automatic)

| Trigger | Action |
|---------|--------|
| Daily | Update exchange rates |
| Weekly | Send email summary digest |
| On threshold exceed | Per-category budget alert email |

### Email Alert Example

```
Subject: Budget Alert: Category "Marketing" at 87%

Hi,

Your spending in "Marketing" has reached 87% of the budget limit.

  Spent:     $4,350.00
  Budget:    $5,000.00
  Remaining: $650.00

Review your budget: https://docs.google.com/spreadsheets/d/.../edit

— Budget Tracker Automation
```

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (for running tests)
- [clasp](https://github.com/google/clasp) (for deploying to Google Apps Script)

### Installation

```bash
# Clone the repo
git clone https://github.com/<your-username>/google-sheets-automation.git
cd google-sheets-automation

# Install dependencies
npm install

# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

### Deploy to Google Sheets

```bash
# Login to clasp
clasp login

# Create a new Apps Script project bound to your spreadsheet
clasp create --type sheets --rootDir src

# Or use an existing project — copy .clasp.json.example to .clasp.json
# and replace YOUR_SCRIPT_ID_HERE with your script ID

# Push code
clasp push

# Open the spreadsheet — the "Budget Tools" menu appears on reload
clasp open
```

## Testing

143 unit tests with 100% line coverage across all modules.

```
$ npm test

PASS tests/Main.test.js            (16 tests)
PASS tests/Utils.test.js           (34 tests)
PASS tests/CurrencyService.test.js (37 tests)
PASS tests/BudgetTracker.test.js   (23 tests)
PASS tests/Dashboard.test.js       (11 tests)
PASS tests/AlertService.test.js    (22 tests)

Tests:       143 passed, 143 total
```

```
$ npm run test:coverage

File                | Lines |
--------------------|-------|
Main.js             |  100% |
Utils.js            |  100% |
CurrencyService.js  |  100% |
BudgetTracker.js    |  100% |
Dashboard.js        |  100% |
AlertService.js     |  100% |
```

Google Apps Script doesn't support `import/export`, so each module uses a compatibility pattern for Jest:

```js
// At end of each src/*.js file:
if (typeof module !== 'undefined') {
  module.exports = { functionName };
}
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Google Sheets                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │Transact. │  │Dashboard │  │ Settings │      │
│  └────┬─────┘  └────▲─────┘  └────┬─────┘      │
│       │              │             │             │
├───────┼──────────────┼─────────────┼─────────────┤
│       │         Main.js            │             │
│       │     onOpen() + menu        │             │
│       │              │             │             │
│  ┌────▼──────┐ ┌─────┴──────┐ ┌───▼────────┐   │
│  │ Currency  │ │  Budget    │ │   Utils    │   │
│  │ Service   │ │  Tracker   │ │getSetting()│   │
│  │           │ │            │ │formatCurr()│   │
│  └─────┬─────┘ └─────┬──────┘ └────────────┘   │
│        │              │                          │
│   ┌────▼──────┐ ┌─────▼──────┐                  │
│   │ External  │ │  Dashboard │                  │
│   │ APIs      │ │  + Alert   │                  │
│   │ (cached)  │ │  Service   │                  │
│   └───────────┘ └────────────┘                  │
├─────────────────────────────────────────────────┤
│  exchangerate-api.com  │  frankfurter.app       │
│  (primary)             │  (fallback)            │
└─────────────────────────────────────────────────┘
```

## Tech Stack

- **Runtime**: Google Apps Script (V8)
- **Language**: JavaScript (ES5-compatible for GAS)
- **APIs**: exchangerate-api.com, frankfurter.app
- **Testing**: Jest 30 with custom GAS mocks
- **Deploy**: clasp (Google Apps Script CLI)
- **Services**: SpreadsheetApp, MailApp, CacheService, UrlFetchApp

## License

ISC
