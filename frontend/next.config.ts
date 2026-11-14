import type { NextConfig } from "next";
const backend = process.env.BACKEND_URL ?? "http://localhost:3001";
const config: NextConfig = { async rewrites() { return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }]; } };
export default config;
