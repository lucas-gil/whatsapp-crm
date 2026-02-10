/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    domains: ['localhost', 'api.whatsapp-crm.local'],
  },
  swcMinify: true,
  compress: true,
  productionBrowserSourceMaps: false,
};

module.exports = nextConfig;
