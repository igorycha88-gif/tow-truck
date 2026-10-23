import { ICON_SIZES, renderIcon } from '@/lib/seo/og-icon';

// /icon-512 — логотип организации 512×512 для JSON-LD logo/image (Google
// LocalBusiness: ≥112×112) и PWA manifest (EV-T7). Статический, immutable.

export const dynamic = 'force-static';

export function GET(): Response {
  const image = renderIcon(ICON_SIZES['icon-512']);
  return new Response(image.body, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
