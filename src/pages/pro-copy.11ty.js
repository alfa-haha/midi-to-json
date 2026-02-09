const proCopy = require("../_data/proCopy.js");

module.exports = class ProCopyJson {
  data() {
    return {
      permalink: "pro-copy.json",
      eleventyExcludeFromCollections: true
    };
  }

  render() {
    return JSON.stringify(proCopy);
  }
};

