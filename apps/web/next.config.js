/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@zod-monaco/core",
    "@zod-monaco/monaco",
    "@zod-monaco/react",
  ],
};

export default nextConfig;
