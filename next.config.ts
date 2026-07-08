import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // logos-sort ships a native C addon that's loaded via a try/catch require
  // of `build/Release/logos_sort_native.node`. Webpack's static analysis walks
  // that require() and fails when the .node file isn't present at build time
  // (Heroku, CI, browser bundle). Aliasing lib/native.js → our stub keeps the
  // pure-JS engine active everywhere without touching the package's source.
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "logos-sort/lib/native.js": path.resolve(
        __dirname,
        "lib/logos-sort-native-stub.js",
      ),
    };
    return config;
  },
  // Turbopack has a separate alias mechanism (it doesn't read the webpack
  // hook above). Same intent: swap the native loader for a stub.
  turbopack: {
    resolveAlias: {
      "logos-sort/lib/native.js": "./lib/logos-sort-native-stub.js",
    },
  },
};

export default nextConfig;
