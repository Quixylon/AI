# Steam Status Tracker

Статический сайт профиля Qu’lon и трекер одного публичного Steam-профиля. Интерфейс хранится в `public`, данные Steam — в JSON, а секретный Steam API key используется только серверной автоматизацией GitHub Actions.

## Текущее состояние

Сайт активен и публикуется через GitHub Pages:

```text
https://quixylon.github.io/AI/
https://quixylon.github.io/AI/tracker/
```

Workflow `Steam Status Tracker` запускается при изменении сайта, вручную и по расписанию примерно раз в пять минут.

## Как работает публикация

1. Workflow получает свежий статус Steam.
2. Изменённые данные сохраняются в `status.json` и `history.json`.
3. Выполняется `npm run check`.
4. Каталог `public` загружается как единственный артефакт GitHub Pages.
5. Отдельный deploy-job публикует этот артефакт.

Временные страницы, маркеры деплоя, конкурирующие workflow и генерация `profile-v2` не используются.

## Проверка проекта

Для полной локальной проверки требуется Node.js 20 или новее:

```bash
cd projects/steam-status-tracker
npm run check
```

Проверка:

- проверяет синтаксис всех JavaScript-файлов;
- разбирает `bio.json`, `status.json` и `history.json`;
- проверяет локальные ссылки из HTML и CSS;
- проверяет обязательные файлы проекта;
- запрещает возвращение временных страниц, старого `profile-v2` и генераторных payload-файлов;
- проверяет последовательность и целостность истории Steam;
- проверяет наличие HTTPS-ссылки на Discord.

## Структура

```text
steam-status-tracker/
├── public/
│   ├── data/
│   │   ├── bio.json
│   │   ├── history.json
│   │   └── status.json
│   ├── tracker/
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── scripts/
│   ├── update-steam-status.mjs
│   └── validate-project.mjs
├── package.json
└── README.md
```

Workflow публикации находится в:

```text
.github/workflows/steam-status-pages.yml
```

## Настройка GitHub

В репозитории должны быть сохранены:

```text
Secret: STEAM_API_KEY
Variable: STEAM_ID64
```

`STEAM_ID64` можно не задавать, если используется vanity-адрес `quixylon`. В `Settings → Pages` источником публикации должен быть выбран **GitHub Actions**.

## Данные и приватность

- публично хранятся только данные публичного Steam-профиля и история активности;
- отсутствие ключа или временная ошибка Steam API не стирают последнюю успешную запись;
- счётчик посетителей использует случайный идентификатор браузера в `localStorage`;
- Discord-ссылка ведёт напрямую на профиль;
- сайт не загружает содержимое guns.lol через сторонние прокси.
