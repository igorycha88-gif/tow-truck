import { ImageResponse } from 'next/og';
import { siteConfig } from '@/config/site';
import { company } from '@/config/company';

// OG-картинка 1200×630 — генерируется кодом при сборке.
// Используется в <meta property="og:image"> и Twitter Cards.
export const alt = `${siteConfig.name} — эвакуатор 24/7`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: 80,
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#ffffff',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 40,
              fontWeight: 800,
              color: '#f97316',
              background: '#1e293b',
              borderRadius: 12,
              border: '2px solid #f97316',
            }}
          >
            Э
          </div>
          <div style={{ fontSize: 28, fontWeight: 600, color: '#f97316' }}>
            24/7 • ПОДАЧА 15–30 МИН
          </div>
        </div>

        <div
          style={{
            fontSize: 76,
            fontWeight: 800,
            lineHeight: 1.1,
            maxWidth: 1000,
            display: 'flex',
          }}
        >
          Эвакуатор в Москве и области
        </div>

        <div
          style={{
            marginTop: 24,
            fontSize: 32,
            color: '#cbd5e1',
            maxWidth: 900,
            display: 'flex',
          }}
        >
          Легковые, мото, спецтехника, после ДТП. Своя техника, фиксированные цены.
        </div>

        <div
          style={{
            marginTop: 48,
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            fontSize: 44,
            fontWeight: 700,
            color: '#f97316',
          }}
        >
          {company.phone}
        </div>
      </div>
    ),
    { ...size },
  );
}
