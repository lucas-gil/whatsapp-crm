/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    domains: ['localhost', 'api.whatsapp-crm.local'],
  },
};

module.exports = nextConfig;
