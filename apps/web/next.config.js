/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@zod-monaco/core",
    "@zod-monaco/monaco",
  ],
};

export default nextConfig;
