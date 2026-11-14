import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  // Swagger usa __dirname para encontrar sus assets: conservar resolución nativa.
  serverExternalPackages: ["swagger-ui-dist"],
  outputFileTracingIncludes: {
    "/api/docs/assets/*": [
      "./node_modules/swagger-ui-dist/swagger-ui.css",
      "./node_modules/swagger-ui-dist/swagger-ui-bundle.js",
    ],
  },
};
export default nextConfig;
