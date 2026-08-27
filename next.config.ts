import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	// Standalone bundles the server and its dependencies into .next/standalone,
	// which is what the Docker runner stage copies. Without it the production
	// image would need the full node_modules tree.
	output: "standalone",
};

export default nextConfig;
