/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async redirects() {
    return [
      {
        source: '/listings',
        destination: '/market',
        permanent: true,
      },
      {
        source: '/listings/new',
        destination: '/market/new',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
