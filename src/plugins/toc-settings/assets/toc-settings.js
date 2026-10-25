(function () {
  "use strict";
  function boot() {
    var toc = document.querySelector("#page-panel .toc-container");
    if (!toc || toc.dgConfigured) return;
    toc.dgConfigured = true;
    var config = window.DG_TOC_SETTINGS || {};
    var presets = {
      fontSize: { key: "textSize", values: { Small: 13, Medium: 15, Large: 18 } },
      buffer: { key: "noteSpacing", values: { Narrow: 10, Comfortable: 20, Wide: 36 } },
      itemSpacing: { key: "headingSpacing", values: { Compact: 2, Comfortable: 5, Spacious: 8 } },
      maxHeight: { key: "listHeight", values: { Short: 45, Medium: 70, Tall: 85 } }
    };
    Object.keys(presets).forEach(function (key) {
      var preset = presets[key];
      var value = preset.values[config[preset.key]];
      if (value !== undefined) config[key] = value;
    });
    function number(key, fallback, min, max) {
      var value = Number(config[key]);
      return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
    }
    // Garden defaults live on body, so root variables would be shadowed.
    var root = document.body.style;
    root.setProperty("--dg-toc-buffer", number("buffer", 20, 0, 80) + "px");
    root.setProperty("--dg-toc-font-size", number("fontSize", 15, 10, 28) + "px");
    root.setProperty("--dg-toc-line-height", number("lineHeight", 1.5, 1, 2.5));
    root.setProperty("--dg-toc-item-padding", number("itemSpacing", 5, 0, 20) + "px 0");
    root.setProperty("--dg-toc-indent", number("indent", 14, 0, 40) + "px");
    root.setProperty("--dg-toc-max-height", number("maxHeight", 70, 20, 90) + "vh");
    var panel = document.getElementById("page-panel");
    panel.classList.add("dg-toc-configured");
    panel.classList.toggle("dg-toc-hide-title", config.showTitle === false);
    panel.classList.toggle("dg-toc-no-highlight", config.highlightActive === false);
    var headings = [];
    toc.querySelectorAll('a[href^="#"]').forEach(function (link) {
      var id;
      try { id = decodeURIComponent(link.hash.slice(1)); } catch (_) { return; }
      var heading = document.getElementById(id);
      if (!heading || !/^H[1-6]$/.test(heading.tagName)) return;
      headings.push({ link: link, level: Number(heading.tagName.slice(1)), target: heading });
    });
    var firstLevel = headings.length ? Math.min.apply(null, headings.map(function (heading) { return heading.level; })) : 1;
    var depth = config.detail === "Main headings" ? firstLevel : config.detail === "Main + subheadings" ? firstLevel + 1 : 6;
    headings.forEach(function (heading) {
      heading.link.hidden = heading.level > depth;
    });
    var branches = [];
    if (config.collapsible !== false) toc.querySelectorAll("li").forEach(function (item) {
      var children = item.querySelector(":scope > ol, :scope > ul");
      var link = item.querySelector(":scope > a");
      if (!children || !link || !children.querySelector("a:not([hidden])")) return;
      var button = document.createElement("button");
      button.type = "button";
      button.className = "dg-toc-branch";
      button.title = "Collapse subheadings";
      button.setAttribute("aria-label", "Toggle subheadings under " + link.textContent.trim());
      button.setAttribute("aria-expanded", "true");
      button.innerHTML = '<i data-lucide="chevron-down"></i><span aria-hidden="true">&#9662;</span>';
      item.insertBefore(button, link);
      function expand(open) {
        children.hidden = !open;
        button.setAttribute("aria-expanded", String(open));
        button.title = open ? "Collapse subheadings" : "Expand subheadings";
      }
      button.addEventListener("click", function () { expand(children.hidden); });
      branches.push({ children: children, expand: expand });
    });
    if (window.lucide) window.lucide.createIcons();
    var queued = false;
    var lastActive;
    function updateActive() {
      queued = false;
      panel.classList.toggle("dg-toc-desktop", getComputedStyle(panel).flexDirection !== "column");
      var current = headings.find(function (heading) { return heading.link.classList.contains("toc-active"); });
      if (!current) return;
      var owner = current.target.closest("[data-dg-fold-hidden]");
      while (owner) {
        var ancestor = document.getElementById(owner.getAttribute("data-dg-fold-owner"));
        var match = headings.find(function (heading) { return heading.target === ancestor; });
        if (!match) break;
        current = match;
        owner = ancestor.closest("[data-dg-fold-hidden]");
      }
      if (current.link.hidden) {
        var previous = headings.slice(0, headings.indexOf(current) + 1).filter(function (heading) { return !heading.link.hidden; });
        current = previous[previous.length - 1];
      }
      if (!current) return;
      headings.forEach(function (heading) { if (heading.link.classList.contains("toc-active") !== (heading === current)) heading.link.classList.toggle("toc-active", heading === current); });
      if (current !== lastActive && !document.documentElement.classList.contains("dg-note-locked")) {
        branches.forEach(function (branch) { if (branch.children.contains(current.link)) branch.expand(true); });
        if (config.followActive !== false && !toc.matches(":hover, :focus-within")) {
          var box = current.link.getBoundingClientRect();
          var viewport = toc.getBoundingClientRect();
          if (box.top < viewport.top || box.bottom > viewport.bottom) toc.scrollTop += box.top - viewport.top - toc.clientHeight / 3;
        }
        lastActive = current;
      }
    }
    function scheduleActive() {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(updateActive);
    }
    // Core owns scroll tracking. Observe its class changes and map filtered/folded targets.
    new MutationObserver(scheduleActive).observe(toc, { subtree: true, attributes: true, attributeFilter: ["class"] });
    window.addEventListener("resize", scheduleActive, { passive: true });
    document.addEventListener("dg:note-unlocked", scheduleActive);
    document.addEventListener("dg:fold-change", scheduleActive);
    scheduleActive();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
