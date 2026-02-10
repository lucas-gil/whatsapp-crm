/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    domains: ['localhost', 'api.whatsapp-crm.local'],
  },
};

module.exports = nextConfig;
