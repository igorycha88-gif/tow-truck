import { ImageResponse } from 'next/og';

// Favicon/icon — генерируется кодом при сборке (Next.js App Router metadata icons).
// Цвета: primary #0f172a (тёмно-синий), accent #f97316 (оранжевый) — из globals.css.
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
          fontWeight: 800,
          color: '#ffffff',
          background: '#0f172a',
          borderRadius: 6,
        }}
      >
        <span style={{ color: '#f97316' }}>Э</span>
      </div>
    ),
    { ...size },
  );
}
