/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@repo-analyzer/analyzer', '@repo-analyzer/github-client'],
};

export default nextConfig;
