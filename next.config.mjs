/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [],
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  // geoip-lite читает GeoLite2-данные с диска (node_modules/geoip-lite/data) —
  // бандлить его в серверные чанки нельзя (ENOENT на data/*.dat).
  serverExternalPackages: ['geoip-lite'],
  // 301-редиректы удалённых посадочных (ЧТЗ_SEO_v3_кодовая_реализация, TASK-V3-01):
  // джип-страница убрана по решению владельца 30.09 — трафик и вес ведём на «Эвакуатор с лебёдкой».
  async redirects() {
    return [
      {
        source: '/evakuator-dzhip-s-lebedkoj',
        destination: '/evakuator-s-lebedkoj',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
