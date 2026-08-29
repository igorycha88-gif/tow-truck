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
};

export default nextConfig;
