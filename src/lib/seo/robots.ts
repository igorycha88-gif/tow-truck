import { absoluteUrl } from '@/lib/seo/url';

// robots.txt по правилам Яндекса и Google (ЧТЗ_SEO_Техническая_корректировка
// 2026-10, TASK-EV-T2):
// - только ASCII/Punycode (кириллица в robots.txt запрещена Яндексом);
// - директива Host НЕ используется (Яндекс не поддерживает с 2018; главное
//   зеркало закрепляется 301-редиректом и «Переездом сайта» в Вебмастере);
// - Clean-param для Яндекса — склейка дублей с utm/yclid/service и др.
//   (canonical для Яндекса — подсказка, Clean-param — основной механизм);
// - /api/, /metrics/, /grafana/ закрыты (служебные, дополнительно к auth в nginx);
// - /opengraph-image, /icon, /apple-icon, /manifest.webmanifest, /_next/static/
//   НЕ закрываются — нужны для превью и рендеринга.

const DISALLOW = ['/api/', '/metrics/', '/grafana/'];

const CLEAN_PARAMS = [
  'utm_source&utm_medium&utm_campaign&utm_content&utm_term',
  'yclid&gclid&ysclid&_openstat&from&service',
];

/** Тело robots.txt. Отдаётся через src/app/robots.txt/route.ts. */
export function buildRobotsTxt(): string {
  const lines: string[] = [
    'User-Agent: *',
    'Allow: /',
    ...DISALLOW.map((d) => `Disallow: ${d}`),
    '',
    'User-Agent: Yandex',
    'Allow: /',
    ...DISALLOW.map((d) => `Disallow: ${d}`),
    ...CLEAN_PARAMS.map((p) => `Clean-param: ${p}`),
    '',
    `Sitemap: ${absoluteUrl('/sitemap.xml')}`,
  ];
  return lines.join('\n');
}
