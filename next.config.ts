import type { NextConfig } from "next";

// Export a static site bundle so Netlify can host it with a free manual deploy.
// Supabase handles menu, authentication, and order data from the browser.
const nextConfig: NextConfig = { output: "export" };

export default nextConfig;
