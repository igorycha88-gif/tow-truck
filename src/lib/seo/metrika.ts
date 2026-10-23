import { logger } from '@/lib/logger';

// Yandex.Метрика: построение сниппета счётчика (см. ЧТЗ_Яндекс_Метрика.md).
// ID берётся из NEXT_PUBLIC_METRIKA_ID и валидируется (только цифры) перед
// подстановкой в инлайн-скрипт — защита от XSS/HTML-инъекций.
// Используется в root layout (Server Component): сниппет рендерится в HTML.

const METRIKA_TAG_URL = 'https://mc.yandex.ru/metrika/tag.js';
const METRIKA_WATCH_URL = 'https://mc.yandex.ru/watch';
const METRIKA_ID_RE = /^\d{1,12}$/;

export function isValidMetrikaId(id: string): boolean {
  return typeof id === 'string' && METRIKA_ID_RE.test(id.trim());
}

export function metrikaInitScript(id: string): string {
  const clean = (id ?? '').trim();
  if (!isValidMetrikaId(clean)) {
    logger.warn('Yandex.Метрика: невалидный NEXT_PUBLIC_METRIKA_ID, счётчик отключён', {
      operation: 'metrika.init',
      provided: clean || null,
    });
    return '';
  }
  const tagSrc = `${METRIKA_TAG_URL}?id=${clean}`;
  return `(function(m,e,t,r,i,k,a){
    m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
    m[i].l=1*new Date();
    for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
    k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
})(window, document, "script", "${tagSrc}", "ym");
ym(${clean}, "init", {defer:true, ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});`;
}

// Опции искусственного просмотра (справка Метрики для SPA):
// referer — предыдущий URL (внутренний переход) или document.referrer на входе,
// title — заголовок страницы на момент hit.
export type MetrikaHitOptions = {
  referer?: string;
  title?: string;
};

// Отправка просмотра в Яндекс.Метрику (EV-T13 + ЧТЗ_Яндекс_SEO_доработка
// 2026-10, TASK-Я-01). init с defer:true НЕ отправляет просмотр сам —
// все просмотры (включая первый) идут через hit отсюда, ровно один на URL.
export function metrikaRouteHit(
  id: string,
  url: string,
  options: MetrikaHitOptions = {},
): void {
  const clean = (id ?? '').trim();
  if (!isValidMetrikaId(clean)) return;
  const w = (globalThis as unknown as {
    window?: { ym?: (...args: unknown[]) => void };
  }).window;
  if (!w || typeof w.ym !== 'function') return;
  const hitOptions: MetrikaHitOptions = {};
  if (options.referer) hitOptions.referer = options.referer;
  if (options.title) hitOptions.title = options.title;
  w.ym(Number(clean), 'hit', url, hitOptions);
  logger.debug('Метрика: отправлен hit просмотра', {
    operation: 'metrika.hit',
    url,
    hasReferer: Boolean(hitOptions.referer),
  });
}

export function metrikaNoscriptSrc(id: string): string {
  const clean = (id ?? '').trim();
  if (!isValidMetrikaId(clean)) return '';
  return `${METRIKA_WATCH_URL}/${clean}`;
}
