/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Permite usar server actions desde componentes cliente
    serverActions: { allowedOrigins: ['localhost:3000'] },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'www.lider.cl' },
      { protocol: 'https', hostname: 'www.tottus.cl' },
      { protocol: 'https', hostname: 'www.jumbo.cl' },
    ],
  },
}

module.exports = nextConfig
