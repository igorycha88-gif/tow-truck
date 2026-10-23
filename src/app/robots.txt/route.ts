import { buildRobotsTxt } from '@/lib/seo/robots';

// /robots.txt — route handler (MetadataRoute.Robots не поддерживает Clean-param,
// ЧТЗ_SEO_Техническая_корректировка 2026-10, TASK-EV-T2). Статический ответ.

export const dynamic = 'force-static';

export function GET(): Response {
  return new Response(buildRobotsTxt(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
