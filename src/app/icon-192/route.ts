import { ICON_SIZES, renderIcon } from '@/lib/seo/og-icon';

// /icon-192.png-эквивалент для PWA manifest (EV-T7). Статический, immutable.

export const dynamic = 'force-static';

export function GET(): Response {
  const image = renderIcon(ICON_SIZES['icon-192']);
  return new Response(image.body, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
