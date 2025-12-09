/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    env: {
        API_URL: process.env.API_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:8000' : ''),
    },
}

module.exports = nextConfig

