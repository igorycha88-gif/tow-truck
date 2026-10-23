import { ImageResponse } from 'next/og';

// Рендер квадратной иконки-логотипа для произвольного размера (EV-T7).
// Используется route-хендлерами /icon-192 и /icon-512 (PWA manifest + JSON-LD logo,
// где Google требует ≥112×112). Экспорт ICON_SIZES — для unit-теста логотипа.

export const ICON_SIZES = {
  'icon-192': { width: 192, height: 192 },
  'icon-512': { width: 512, height: 512 },
} as const;

export type IconSizeKey = keyof typeof ICON_SIZES;

export function renderIcon(size: { width: number; height: number }): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: Math.round(size.width * 0.62),
          fontWeight: 800,
          color: '#ffffff',
          background: '#0f172a',
          borderRadius: Math.round(size.width * 0.08),
        }}
      >
        <span style={{ color: '#f97316' }}>Э</span>
      </div>
    ),
    { ...size },
  );
}
