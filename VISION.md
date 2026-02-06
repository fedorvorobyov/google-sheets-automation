# Google Sheets Automation — Vision

## Проблема
Малый бизнес живёт в Google Sheets. Владельцы тратят часы на:
- Ручное обновление курсов валют
- Подсчёт бюджета / расходов
- Отслеживание просроченных платежей
- Формирование отчётов

На фрилансе Google Apps Script — востребованная ниша с мало конкуренцией.

## Идея проекта
**Budget Tracker** — автоматизация финансовой таблицы в Google Sheets:
- Курсы валют подтягиваются автоматически через API
- Расходы категоризируются и считаются
- Email-алерты при превышении бюджета
- Дашборд со сводкой обновляется по расписанию

## Что умеет

| Фича | Зачем в портфолио |
|-------|-------------------|
| Fetch курсов валют через API | Работа с внешними API из Apps Script |
| Автоматический пересчёт сумм | Показывает бизнес-логику |
| Email-алерты при превышении лимита | Триггеры + MailApp |
| Дашборд-сводка (итоги по категориям) | Автоматическая генерация отчётов |
| Триггеры по расписанию (daily/weekly) | Показывает знание cron-подобных задач |
| Меню в Google Sheets UI | Кастомизация интерфейса |
| Настройки через отдельный лист | Гибкость без правки кода |

## Структура таблицы (Sheets)

```
Sheet 1: "Transactions"
| Date | Description | Category | Amount (USD) | Amount (Local) | Currency |

Sheet 2: "Dashboard"
| Category | Total | Budget | Remaining | Status |
| (auto-generated summary row per category)

Sheet 3: "Settings"
| Parameter       | Value        |
| Base Currency   | USD          |
| Alert Email     | user@mail.com|
| Budget Limit    | 5000         |
| Alert Threshold | 80%          |
```

## Структура проекта

```
google-sheets-automation/
├── src/
│   ├── Main.js              # Entry point, меню, onOpen trigger
│   ├── CurrencyService.js   # Fetch курсов валют через API
│   ├── BudgetTracker.js     # Логика подсчёта бюджета
│   ├── Dashboard.js         # Генерация дашборда
│   ├── AlertService.js      # Email-уведомления
│   └── Utils.js             # Форматирование, хелперы
├── assets/
│   └── screenshot.png       # Скриншот таблицы для README
├── .gitignore
└── README.md
```

## Как это работает

### Ручной запуск (через меню)
```
Google Sheets → меню "Budget Tools" →
  ├── Update Exchange Rates
  ├── Refresh Dashboard
  ├── Check Budget Alerts
  └── Add Transaction (sidebar form)
```

### Автоматически (триггеры)
- **Ежедневно:** обновление курсов валют
- **Еженедельно:** email-отчёт со сводкой расходов
- **При изменении:** пересчёт дашборда при добавлении транзакции

## Пример email-алерта

```
Subject: ⚠ Budget Alert: Category "Marketing" at 87%

Hi,

Your spending in "Marketing" has reached 87% of the budget limit.

  Spent:    $4,350.00
  Budget:   $5,000.00
  Remaining: $650.00

Review your budget: [link to spreadsheet]

— Budget Tracker Automation
```

## API для курсов валют
Используем бесплатный `exchangerate-api.com` (1500 запросов/мес бесплатно).
Запасной вариант: `frankfurter.app` (полностью бесплатный, без ключа).

## Почему это хорошо для портфолио
- Google Apps Script — отдельная ниша, меньше конкуренция
- Заказчики из малого бизнеса платят $50-200 за такие скрипты
- Показывает: API интеграция, триггеры, email, UI-кастомизация
- Код на JavaScript — понятен широкой аудитории
- Реально полезный инструмент, а не учебный пример
