/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {},
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.fbcdn.net", pathname: "/**" },
      { protocol: "https", hostname: "**.facebook.com", pathname: "/**" },
      { protocol: "https", hostname: "**.scontent*.fbcdn.net", pathname: "/**" },
    ],
  },
};

module.exports = nextConfig;
