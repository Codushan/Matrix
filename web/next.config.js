/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    appDir: true,
  },
  env: {
    API_URL: process.env.API_URL || 'http://localhost:8000',
  },
}

module.exports = nextConfig


