module.exports = function (eleventyConfig) {
  // Keep existing static site files as-is (SEO rules/content unchanged), while Eleventy generates new pages.
  eleventyConfig.addPassthroughCopy("css");
  eleventyConfig.addPassthroughCopy("js");
  eleventyConfig.addPassthroughCopy("images");
  eleventyConfig.addPassthroughCopy("img");
  eleventyConfig.addPassthroughCopy("blog");
  eleventyConfig.addPassthroughCopy("en");
  eleventyConfig.addPassthroughCopy("zh");
  eleventyConfig.addPassthroughCopy("de");
  eleventyConfig.addPassthroughCopy("ja");

  eleventyConfig.addPassthroughCopy("index.html");
  eleventyConfig.addPassthroughCopy("terms.html");
  eleventyConfig.addPassthroughCopy("privacy-policy.html");
  eleventyConfig.addPassthroughCopy("robots.txt");
  eleventyConfig.addPassthroughCopy("sitemap.xml");
  eleventyConfig.addPassthroughCopy(".htaccess");

  return {
    dir: {
      input: "src",
      includes: "_includes",
      data: "_data",
      output: "_site"
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    templateFormats: ["njk", "md"]
  };
};
