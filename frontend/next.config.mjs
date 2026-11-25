import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./lib/i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true
  },
  typescript: {
    ignoreBuildErrors: false
  },
  images: {
    unoptimized: true
  },
  webpack: (config) => {
    config.ignoreWarnings = [
      { module: /next-intl/ },
      /Parsing of .* for build dependencies failed/
    ];
    return config;
  },
  transpilePackages: ['dexie', 'dexie-react-hooks']
};

export default withNextIntl(nextConfig);