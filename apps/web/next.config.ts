import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  transpilePackages: ["@maplerun/tax-engine"],
};

export default nextConfig;
