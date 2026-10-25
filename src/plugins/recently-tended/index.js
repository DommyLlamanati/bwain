module.exports = {
  setupEleventy(eleventyConfig) {
    // Most recently updated notes, newest first. Uses the note's updated
    // or created frontmatter, falling back to the file date.
    eleventyConfig.addFilter("gpRecentlyTended", function (notes, count) {
      const dated = (notes || [])
        .filter((note) => !note.data.hide)
        .map((note) => ({
          url: note.url,
          title: note.data.title || note.fileSlug,
          when: new Date(
            note.data.updated || note.data.created || note.date
          ).getTime(),
        }))
        .filter((note) => !Number.isNaN(note.when));

      dated.sort((a, b) => b.when - a.when);

      return dated.slice(0, count || 5);
    });

    // Plain YYYY-MM-DD, reformatted client-side by the timestamps plugin
    // when it's enabled (via the .human-date convention).
    eleventyConfig.addFilter("gpDateString", function (timestamp) {
      return new Date(timestamp).toISOString().slice(0, 10);
    });
  },
};
