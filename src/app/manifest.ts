import type { MetadataRoute } from 'next';
import { siteConfig } from '@/config/site';

// Web App Manifest (PWA) — генерируется кодом. Связывается в layout через metadata.manifest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.name,
    short_name: 'Эвакуация24',
    description: siteConfig.description,
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0f172a',
    lang: 'ru-RU',
    categories: ['business', 'travel', 'auto'],
    icons: [
      {
        src: '/icon',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
