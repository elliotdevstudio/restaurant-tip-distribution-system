/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  eslint: {
    // Ignore ESLint errors during production builds
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig