/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for production Docker deployments.
  // This produces a self-contained build that doesn't need node_modules.
  output: 'standalone',

  async rewrites() {
    // In development, proxy API calls to the backend.
    // In production, nginx handles this routing, so rewrites are only
    // needed for local dev.
    return [
      { source: '/api/:path*', destination: 'http://localhost:3000/api/:path*' },
    ];
  },
};
module.exports = nextConfig;
