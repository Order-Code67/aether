# engineering-fpv.ru

Статический многостраничный сайт для выкладки в ISPmanager (reg.ru).

## Структура

```
site/
  index.html              — главная
  equipment/index.html    — оборудование
  software/index.html     — программы
  about/index.html        — о компании
  news/index.html         — список новостей
  news/post.html          — страница новости (?id=...)
  data/equipment.json     — карточки оборудования
  data/software.json      — карточки программ
  data/news.json          — новости
  assets/css/site.css
  assets/js/site.js
```

## Как добавить оборудование / программу

Откройте `data/equipment.json` или `data/software.json` и добавьте объект в `items`:

```json
{
  "id": "unique-id",
  "title": "Название",
  "summary": "Короткое описание",
  "tag": "метка",
  "price": "цена или «по запросу»",
  "status": "в наличии",
  "link": "https://..."
}
```

Пустой `link` оставьте пустой строкой — карточка останется без перехода.

## Как добавить новость

В `data/news.json`:

```json
{
  "id": "short-slug",
  "date": "2026-10-18",
  "title": "Заголовок",
  "summary": "Анонс для списка",
  "body": "Абзац один.\n\nАбзац два."
}
```

Страница откроется по адресу `news/post.html?id=short-slug`.

## Локальный просмотр

Из папки `site`:

```bash
python -m http.server 8765
```

Откройте http://127.0.0.1:8765/ (нужен HTTP-сервер: JSON грузится через `fetch`).

## Выкладка на reg.ru

1. ISPmanager → WWW-домены → `engineering-fpv.ru`
2. Откройте каталог сайта (`public_html` / корень домена)
3. Загрузите **содержимое** папки `site` (не саму папку `site` как единственную вложенность)
4. Проверьте `https://engineering-fpv.ru/`

Текст «О компании» правится в `about/index.html`.
