import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Next.js 16, gelistirme sunucusuna localhost disi origin'lerden gelen
  // _next/* isteklerini varsayilan olarak engelliyor. Tailscale uzerinden
  // erisim icin IP ve MagicDNS adreslerini izin listesine ekliyoruz.
  allowedDevOrigins: [
    "100.68.244.55",
    "desktop-itjb07o.tail0e2acb.ts.net",
    "dentsoft.tail0e2acb.ts.net",
  ],
};

export default nextConfig;