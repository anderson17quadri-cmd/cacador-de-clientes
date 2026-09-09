/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  ...(process.env.NEXT_STANDALONE === 'true' ? { output: 'standalone' } : {}),
  transpilePackages: ['@leadhunter/types', '@leadhunter/utils', '@leadhunter/config'],
  images: {
    domains: ['lh3.googleusercontent.com', 'avatars.githubusercontent.com', 'maps.googleapis.com'],
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
