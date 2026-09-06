# Quixylon AI Lab

Публичные проекты Quixylon.

| Проект | Описание | Сайт |
| --- | --- | --- |
| [Steam Status Tracker](projects/steam-status-tracker) | Личный профиль Qu’lon, ссылки и история Steam | [Открыть](https://quixylon.github.io/AI/) |

Главная страница сохраняет идею «цифровых следов»: места, где появляется автор, и переход к активности. Новый интерфейс использует самостоятельные панели, мягкий динамический фон и плавную реакцию на курсор. Компоновка адаптируется к телефону и ПК.

## Разработка

Требуется Node.js 24 или новее; установка зависимостей не нужна.

```bash
cd projects/steam-status-tracker
npm run dev
npm run check
```

`npm run dev` запускает сайт на порту 4173. Подробности устройства, данных и публикации — в [README проекта](projects/steam-status-tracker/README.md).

## Автоматизация

Один [workflow](.github/workflows/validate-site.yml) проверяет изменения, обновляет Steam и публикует GitHub Pages. API-ключ хранится в GitHub Secrets. Ошибки внешнего API сохраняют последние успешные данные. Pull request не отменяет публикацию рабочего сайта.

[Результаты обновления и проверки](docs/AUDIT-2026-09-06.md) · [Дальнейшие задачи](docs/ROADMAP.md)
