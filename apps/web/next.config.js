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
    // INTERNAL_API_URL is read fresh every time `next start` boots this
    // config (it's server-side only - never inlined into the client bundle
    // the way NEXT_PUBLIC_* vars are). The desktop app sets it to
    // http://127.0.0.1:<port>/api right before starting this server, since
    // the backend's port is chosen dynamically at launch and can't be baked
    // into the client build. Falls back to NEXT_PUBLIC_API_URL for
    // dev/hosted deployments that don't set it.
    const backendUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
