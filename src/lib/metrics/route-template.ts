// Нормализация URL → шаблон роута для content_*-метрик (ЧТЗ §4.2):
// route — шаблон пути (не сырой URL), ≤ 100 значений, неизвестные → /other.
// Примеры: /uslugi/evakuaciya-motocikla → /uslugi/[slug],
//           /_next/static/css/abc.css → /_next/static.

const MAX_ROUTE_VALUES = 100;

const DYNAMIC_PATTERNS: Array<{ match: RegExp; template: string }> = [
  { match: /^\/_next\/static\//, template: '/_next/static' },
  { match: /^\/_next\/image$/, template: '/_next/image' },
  { match: /^\/uslugi\/[^/]+$/, template: '/uslugi/[slug]' },
  { match: /^\/otzivy\/[^/]+$/, template: '/otzivy/[slug]' },
];

const OTHER_ROUTE = '/other';

// Кеш path → template + счётчик уникальных template-значений (защита
// кардинальности метрики от скрейпа ботов по случайным путям).
const routeCache = new Map<string, string>();
const knownTemplates = new Set<string>();

export function normalizeRoute(rawPath: string): string {
  const path = stripQuery(rawPath) || '/';
  const cached = routeCache.get(path);
  if (cached) return cached;

  let template = DYNAMIC_PATTERNS.find((p) => p.match.test(path))?.template ?? path;
  template = replaceNumericSegments(template);

  if (!knownTemplates.has(template)) {
    // Слот «/other» резервируем внутри лимита: всего значений ≤ 100 (ЧТЗ §4.2).
    const otherReserved = knownTemplates.has(OTHER_ROUTE) ? 0 : 1;
    if (knownTemplates.size + otherReserved >= MAX_ROUTE_VALUES) {
      template = OTHER_ROUTE;
      knownTemplates.add(OTHER_ROUTE);
    } else {
      knownTemplates.add(template);
    }
  }

  routeCache.set(path, template);
  return template;
}

function stripQuery(rawPath: string): string {
  const qIndex = rawPath.indexOf('?');
  return qIndex === -1 ? rawPath : rawPath.slice(0, qIndex);
}

// Числовые сегменты пути схлопываем в [id]: /blog/42 → /blog/[id].
function replaceNumericSegments(path: string): string {
  return path
    .split('/')
    .map((segment) => (/^\d+$/.test(segment) ? '[id]' : segment))
    .join('/');
}

// Полный сброс кешей (для тестов).
export function __resetRouteTemplateCache(): void {
  routeCache.clear();
  knownTemplates.clear();
}
