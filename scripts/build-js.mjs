import esbuild from "esbuild";

const isProd = process.env.NODE_ENV === "production";

const entryPoints = {
  "midi-to-csv": "src/static/js/midi-to-csv/main.js",
  "midi-inspector": "src/static/js/midi-inspector/main.js",
};

async function buildOne(name, entryPoint) {
  const outfile = `src/static/js/${name}.bundle.js`;
  await esbuild.build({
    entryPoints: [entryPoint],
    outfile,
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    sourcemap: !isProd,
    minify: isProd,
    charset: "utf8",
    logLevel: "info",
    define: {
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "development"),
    },
  });
}

async function main() {
  for (const [name, entryPoint] of Object.entries(entryPoints)) {
    await buildOne(name, entryPoint);
  }
}

await main();
