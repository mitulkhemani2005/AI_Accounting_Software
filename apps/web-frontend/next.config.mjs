/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1",
    NEXT_PUBLIC_AI_URL: process.env.NEXT_PUBLIC_AI_URL || "http://localhost:8001",
  }
};

export default nextConfig;
