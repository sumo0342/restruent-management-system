/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: { ignoreBuildErrors: false },
  experimental: {
    serverComponentsExternalPackages: ["pdfkit"],
  },
};
export default nextConfig;

