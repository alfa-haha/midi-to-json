module.exports = function (eleventyConfig) {
  // Eleventy only generates the new multi-tool/pro pages under `src/`.
  // The legacy site is copied into `_site/` by `scripts/build.mjs` to keep SEO rules/content unchanged.

  eleventyConfig.addPassthroughCopy({ "src/static/js/pro.js": "js/pro.js" });
  eleventyConfig.addPassthroughCopy({ "src/static/js/midi-to-csv.bundle.js": "js/midi-to-csv.bundle.js" });
  eleventyConfig.addPassthroughCopy({ "src/static/js/midi-inspector.bundle.js": "js/midi-inspector.bundle.js" });

  return {
    dir: {
      input: "src",
      includes: "_includes",
      data: "_data",
      output: "_site"
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    templateFormats: ["njk", "md", "11ty.js"]
  };
};
