/** @type {import('next').NextConfig} */

const isProd = process.env.NODE_ENV === "production";

const nextConfig = {
  output: "export",
  reactStrictMode: true,
  trailingSlash: true,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_SITE_URL: isProd ? "https://videomaker.codelove.in" : "http://localhost:3010",
  },
};

export default nextConfig;
