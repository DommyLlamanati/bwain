(function () {
  "use strict";
  function boot() {
    var registry = document.getElementById("dg-note-lock-preview-paths");
    var wrapper = document.getElementById("tooltip-wrapper");
    var content = document.getElementById("tooltip-content");
    if (!registry || !wrapper || !content || wrapper.dgLockPreviewGuard) return;
    var paths;
    try { paths = new Set(JSON.parse(registry.textContent)); } catch (_) { return; }
    wrapper.dgLockPreviewGuard = true;
    document.addEventListener("mouseenter", function (event) {
      var link = event.target instanceof Element && event.target.closest("a.internal-link, .backlink-card a");
      if (!link) return;
      var url;
      try { url = new URL(link.href, location.href); } catch (_) { return; }
      if (url.origin !== location.origin || !paths.has(url.pathname.replace(/\/+$/, "") || "/")) return;
      // Capture before core's target listener, including its cached/fragment previews.
      event.stopImmediatePropagation();
      if (typeof window.opacityTimeout !== "undefined") clearTimeout(window.opacityTimeout);
      if (typeof window.contentTimeout !== "undefined") clearTimeout(window.contentTimeout);
      var title = document.createElement("strong");
      title.textContent = "Locked note";
      var message = document.createElement("p");
      message.textContent = "Open this note to enter its password. Preview is unavailable.";
      content.replaceChildren(title, message);
      wrapper.style.display = "block";
      wrapper.style.opacity = "1";
      if (typeof window.positionTooltip === "function") window.positionTooltip(link);
    }, true);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
