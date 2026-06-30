/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@leadhunter/types', '@leadhunter/utils', '@leadhunter/config'],
  images: {
    domains: ['lh3.googleusercontent.com', 'avatars.githubusercontent.com', 'maps.googleapis.com'],
  },
  experimental: {
    serverActions: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
