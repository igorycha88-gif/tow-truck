import { ImageResponse } from 'next/og';

// Apple touch icon (180×180) — генерируется кодом. Без скруглений (Apple добавит сам).
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 120,
          fontWeight: 800,
          color: '#ffffff',
          background: '#0f172a',
        }}
      >
        <span style={{ color: '#f97316' }}>Э</span>
      </div>
    ),
    { ...size },
  );
}
