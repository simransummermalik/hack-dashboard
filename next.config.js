/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: false,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
    // Keep the Postgres driver out of the serverless function bundle —
    // bundling it has caused hung/timed-out connections in production for
    // some deployments (the socket/TLS internals don't survive bundling
    // cleanly).
    serverComponentsExternalPackages: ["postgres"],
  },
};

module.exports = nextConfig;
