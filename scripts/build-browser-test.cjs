// Test-only bundle of the real reset implementation. Never served by Next.js.
/* eslint-disable @typescript-eslint/no-require-imports -- Node/CommonJS setup loads Next's bundled webpack, outside the application module graph. */
const path = require("node:path");
const { mkdir } = require("node:fs/promises");
const { webpack } = require("next/dist/compiled/webpack/webpack");
module.exports = async function () {
  const root = path.resolve(__dirname, "..");
  const output = path.join(root, "node_modules/.cache/dealpatch-browser-test");
  await mkdir(output, { recursive: true });
  await new Promise((resolve, reject) => {
    webpack({
      mode: "production", target: "web", context: root,
      entry: "./lib/db/workspace.ts",
      output: { path: output, filename: "reset.js", library: { name: "DealPatchReleaseTest", type: "window" } },
      resolve: { extensions: [".ts", ".js", ".json"] },
      module: { rules: [{ test: /\.ts$/, exclude: /node_modules/, use: path.join(__dirname, "typescript-test-loader.cjs") }] },
      optimization: { minimize: false }, devtool: false,
    }, (error, stats) => {
      if (error) reject(error);
      else if (stats.hasErrors()) reject(new Error(stats.toString({ all: false, errors: true })));
      else resolve();
    });
  });
};
