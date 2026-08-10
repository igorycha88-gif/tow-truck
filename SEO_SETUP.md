# SEO: инструкция по настройке (Яндекс и Google)

> После реализации технической SEO (см. `требования/ЧТЗ_SEO_Яндекс_Google.md`)
> в коде всё уже встроено. Осталась **внешняя настройка** в кабинетах поисковиков
> и аналитики. Эта инструкция — пошаговая.

---

## Что уже сделано в коде (не требует действий)

- Полная микроразметка schema.org `@graph`: `Organization`, `WebSite`, `AutoWrecker`
  (с `geo`, `address`, `aggregateRating`, `sameAs`), `Service` по каждой услуге,
  `FAQPage`, `BreadcrumbList`.
- `sitemap.xml` (динамический) + `robots.txt` + canonical на каждой странице.
- OG/Twitter Cards + динамическая OG-картинка (`/opengraph-image`).
- Favicon, apple-touch-icon, Web App Manifest (`/manifest.webmanifest`).
- Кастомная 404 с `noindex`. FAQ-блок на главной.
- Поддержка `verification` мета-тегов (Яндекс + Google) через ENV.
- noscript-пиксель Метрики.

---

## Шаг 0. Подготовка (домен и HTTPS)

1. Зарегистрируйте домен (текущий: `эвакуация.online`).
2. Подключите SSL-сертификат (Let's Encrypt — см. `deploy/nginx/setup-ssl.sh`).
3. Выберите **главное зеркало**: `https://эвакуация.online` (без `www`).
4. Пропишите главное зеркало в `.env`:
   ```env
   NEXT_PUBLIC_SITE_URL="https://эвакуация.online"
   ```

---

## Шаг 1. Получить координаты вашей базы

Для микроразметки `GeoCoordinates` нужны широта/долгота вашей диспетчерской/парка.

1. Откройте [Яндекс.Карты](https://yandex.ru/maps), найдите адрес базы.
2. Правый клик → «Что здесь?» → скопируйте координаты `55.7558, 37.6173`.
3. Пропишите в `.env`:
   ```env
   NEXT_PUBLIC_LATITUDE="55.7558"
   NEXT_PUBLIC_LONGITUDE="37.6173"
   ```

По умолчанию (если не заполнить) — центр Москвы.

---

## Шаг 2. Yandex.Метрика (счётчик)

1. Зайдите в [metrika.yandex.ru](https://metrika.yandex.ru) → «Добавить счётчик».
2. URL: `https://эвакуация.online`. Примите условия.
3. **Дополнительно** поставьте галки:
   - Вебвизор (запись сессий)
   - Карта кликов
   - Карта скролла
   - Точная ставка отказа
   - Отслеживание внешних ссылок
4. Скопируйте **номер счётчика** (число, например `98765432`).
5. Пропишите в `.env`:
   ```env
   NEXT_PUBLIC_METRIKA_ID="98765432"
   ```
6. **Создайте цели** (Конверсии → Цели):
   - `Звонок` — JavaScript-событие, идентификатор `click_phone` (или тип «Клик по номеру телефона»).
   - `Заявка` — JavaScript-событие «Отправка формы» → URL `/api/orders` (тип «Посещение страниц»).
   - `WhatsApp` / `Telegram` — клики по соответствующим ссылкам.
7. Перезапустите сайт — счётчик сразу появятся в <head>.

> Код Метрики и `<noscript>` уже встроены в `src/app/layout.tsx`.

---

## Шаг 3. Yandex.Webmaster

1. Зайдите в [webmaster.yandex.ru](https://webmaster.yandex.ru) → «Добавить сайт».
2. Введите `https://эвакуация.online`.
3. **Проверка прав** → выберите «HTML-тег»:
   - Вы увидите тег вида
     `<meta name="yandex-verification" content="a1b2c3d4e5" />`.
   - Скопируйте **только значение** `content` (`a1b2c3d4e5`).
   - Пропишите в `.env`:
     ```env
     NEXT_PUBLIC_YANDEX_VERIFICATION="a1b2c3d4e5"
     ```
4. Нажмите «Проверить» в Webmaster — должно подтвердиться.
5. **Укажите регион**: Настройки → Регион сайта → «Москва» и «Московская область».
6. **Sitemap**: индексирование → Файлы sitemap → добавьте `https://эвакуация.online/sitemap.xml`.
7. **Главное зеркало**: индексирование → Главное зеркало → выберите `https://эвакуация.online`.
8. **Переобход**: индексирование → «Запустить переобход» главной страницы.

---

## Шаг 4. Google Search Console

1. Зайдите в [search.google.com/search-console](https://search.google.com/search-console).
2. Добавьте property типа **Префикс URL** → `https://эвакуация.online`.
3. **Проверка прав** → выберите «HTML-тег»:
   - Скопируйте **только значение** `content` из
     `<meta name="google-site-verification" content="..." />`.
   - Пропишите в `.env`:
     ```env
     NEXT_PUBLIC_GOOGLE_VERIFICATION="GOOGLE_TOKEN_ЗНАЧЕНИЕ"
     ```
4. Нажмите «Подтвердить» в GSC.
5. **Sitemap**: Sitemaps → добавьте `https://эвакуация.online/sitemap.xml`.
6. (Опц.) Настройки → **Пользовательские URL** для поисковой выдачи.

---

## Шаг 5. Яндекс.Бизнес (Организации на Картах)

> Это **отдельный** источник трафика — Яндекс.Карты + Яндекс.Поиск показывают
> карточку компании. Очень важно для локального SEO.

1. Зайдите в [business.yandex.ru](https://business.yandex.ru) → «Добавить организацию».
2. Заполните:
   - Название: `Эвакуация Москва и МО` (как на сайте).
   - Категория: `Эвакуация автомобилей` / `Услуги эвакуатора`.
   - Телефон, сайт, режим работы (24/7).
   - Точный адрес, координаты (как в Шаге 1).
   - Фото техники, лицензии, реквизиты.
   - Услуги и цены (из `src/config/services.ts`).
3. Пройдите модерацию (до нескольких дней).
4. Получите ссылку на карточку организации → добавьте её в `.env`:
   ```env
   NEXT_PUBLIC_YANDEX_MAPS_URL="https://yandex.ru/maps/org/..."
   ```
   (эта ссылка попадёт в `sameAs` микроразметки — повышает доверие поисковиков).

---

## Шаг 6. Google Business Profile

1. Зайдите в [business.google.com](https://business.google.com) → «Добавить бизнес».
2. Категория: `Towing service` / `Auto wrecker service`.
3. Заполните те же данные (телефон, сайт, часы, фото).
4. Подтвердите по почте/телефону/видео.

---

## Шаг 7. Ссылки на мессенджеры (опционально, но полезно)

Если есть корпоративный WhatsApp/Telegram — добавьте в `.env`:
```env
NEXT_PUBLIC_WHATSAPP="79017054540"
NEXT_PUBLIC_TELEGRAM="https://t.me/your_evakuator"
```
Они попадут в `sameAs` микроразметки и в футер/контакты сайта.

---

## Шаг 8. Финальная проверка

После деплоя прогоните сайт через инструменты:

| Инструмент | URL | Что проверить |
|------------|-----|---------------|
| **Яндекс.Вебмастер → Проверка страницы** | webmaster.yandex.ru | Микроразметка читается, нет ошибок |
| **Rich Results Test (Google)** | [search.google.com/test/rich-results](https://search.google.com/test/rich-results) | `FAQ`, `LocalBusiness`, `Service`, `BreadcrumbList` валидны |
| **Schema.org Validator** | [validator.schema.org](https://validator.schema.org) | Полная структура `@graph` без warning'ов |
| **PageSpeed Insights** | [pagespeed.web.dev](https://pagespeed.web.dev) | Core Web Vitals (LCP < 2.5s, CLS < 0.1) |
| **Open Graph Debugger** | [developers.facebook.com/tools/debug](https://developers.facebook.com/tools/debug/) | OG-картинка показывается |
| **Метрика → Вебвизор** | metrika.yandex.ru | Сессии пишутся |

### Что вводить в Rich Results Test
- URL главной: `https://эвакуация.online/` → должны детектиться: `LocalBusiness`, `FAQPage`, `Service`.
- URL услуги (после реализации отдельных страниц) → `Service`.

---

## Шаг 9. Поддержание SEO (регулярно)

- **Контент**: добавляйте страницы услуг (`/uslugi/light_vehicle` и т.д.) с уникальными
  текстами «эвакуатор [район/шоссе]». Это долгосрочная работа.
- **Отзывы**: реальные отзывы на Яндекс.Картах и сайте → `aggregateRating`.
- **Core Web Vitals**: следите за LCP (тяжёлые фото техники — через `next/image`).
- **Sitemap**: при добавлении страниц — они автоматически попадут в `sitemap.ts` (если
  дописать их в массив).
- **Переобход**: после крупных изменений — жмите «Переобход» в Webmaster/GSC.

---

## Чек-лист внедрения ( ✓ отмечать по факту )

- [ ] `.env` заполнен: `NEXT_PUBLIC_SITE_URL` (https), `NEXT_PUBLIC_METRIKA_ID`
- [ ] `NEXT_PUBLIC_YANDEX_VERIFICATION` + `NEXT_PUBLIC_GOOGLE_VERIFICATION`
- [ ] `NEXT_PUBLIC_LATITUDE` / `NEXT_PUBLIC_LONGITUDE`
- [ ] `NEXT_PUBLIC_YANDEX_MAPS_URL` (карточка организации)
- [ ] `NEXT_PUBLIC_WHATSAPP` / `NEXT_PUBLIC_TELEGRAM` (если есть)
- [ ] Сайт задеплоен, HTTPS работает, редирект www → без-www
- [ ] Yandex.Webmaster: права подтверждены, sitemap добавлен, регион указан
- [ ] Google Search Console: права подтверждены, sitemap добавлен
- [ ] Yandex.Метрика: счётчик онлайн, цели созданы
- [ ] Яндекс.Бизнес: карточка прошла модерацию
- [ ] Google Business Profile: подтверждён
- [ ] Rich Results Test: главная — без ошибок, все типы размечены
- [ ] PageSpeed Insights: LCP < 2.5s, CLS < 0.1

---

## Что НЕ входит в техническую SEO (отдельные задачи)

- Страницы услуг (`/uslugi/[slug]`) с посадочным локальным SEO
- Страница зоны покрытия с картой
- Страница цен и отзывов
- Блог/статьи («эвакуатор на Новорижском шоссе» и т.п.)
- Google Analytics (gtag) — в РФ Метрика приоритетна

Эти элементы дадут основной рост позиций после запуска технической базы.
