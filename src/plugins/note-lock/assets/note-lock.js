(function () {
  "use strict";
  function boot() {
    var configElement = document.getElementById("dg-note-lock-config");
    if (!configElement) return;
    var initialContent = document.querySelector("main.content, .content");
    if (initialContent && initialContent.dgNoteLockInitialized) return;
    if (initialContent) initialContent.dgNoteLockInitialized = true;
    var payload;
    try { payload = JSON.parse(configElement.textContent); } catch (_) { payload = {}; }
    var allowNavigation = payload.showFileBrowser === true;
    document.documentElement.classList.add("dg-note-locked");
    document.documentElement.classList.toggle("dg-note-lock-navigation", allowNavigation);
    var content = document.querySelector("main.content, .content");
    if (content) content.inert = true;
    var dialog = document.createElement("dialog");
    dialog.className = "dg-note-lock";
    dialog.setAttribute("aria-labelledby", "dg-note-lock-title");
    dialog.innerHTML = '<form class="dg-note-lock-form">' +
      '<div class="dg-note-lock-symbol"><i data-lucide="lock-keyhole"></i><span aria-hidden="true">&#128274;</span></div>' +
      '<h1 id="dg-note-lock-title">Locked note</h1><p class="dg-note-lock-caption">Enter the password to open this note.</p>' +
      '<label for="dg-note-lock-password">Password</label>' +
      '<div class="dg-note-lock-entry"><input id="dg-note-lock-password" type="password" autocomplete="current-password" required aria-describedby="dg-note-lock-status">' +
      '<button type="button" class="dg-note-lock-reveal" title="Show password" aria-label="Show password" aria-pressed="false"><i data-lucide="eye"></i><span aria-hidden="true">&#9673;</span></button>' +
      '<button type="submit" class="dg-note-lock-submit" title="Open note" aria-label="Open note"><i data-lucide="arrow-right"></i><span aria-hidden="true">&rarr;</span></button></div>' +
      '<p id="dg-note-lock-status" role="status" aria-live="polite"></p><a class="dg-note-lock-home" href="/">Back to garden</a></form>';
    document.body.appendChild(dialog);
    dialog.addEventListener("cancel", function (event) { event.preventDefault(); });
    dialog.setAttribute("aria-modal", String(!allowNavigation));
    if (allowNavigation) dialog.show();
    else dialog.showModal();
    var navigationObserver;
    var resizeQueued = false;
    function updateNavigationLayout() {
      resizeQueued = false;
      if (!dialog.isConnected) return;
      var left = 0;
      var top = 0;
      var tree = document.querySelector(".filetree-wrapper");
      var treeBox = tree && tree.getBoundingClientRect();
      // Mobile drawers keep their native overlay behavior rather than squeezing the form.
      if (window.innerWidth >= 1000 && treeBox && treeBox.width > 0 && getComputedStyle(tree).visibility !== "hidden") left = treeBox.right;
      document.querySelectorAll(".navbar").forEach(function (nav) {
        var rect = nav.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && getComputedStyle(nav).visibility !== "hidden") top = Math.max(top, rect.bottom);
      });
      document.documentElement.style.setProperty("--dg-note-lock-left-edge", Math.max(0, Math.min(left, window.innerWidth - 100)) + "px");
      document.documentElement.style.setProperty("--dg-note-lock-top-edge", Math.max(0, Math.min(top, window.innerHeight - 100)) + "px");
    }
    function scheduleNavigationLayout() {
      if (resizeQueued) return;
      resizeQueued = true;
      window.requestAnimationFrame(updateNavigationLayout);
    }
    if (allowNavigation) {
      updateNavigationLayout();
      window.addEventListener("resize", scheduleNavigationLayout, { passive: true });
      if (window.ResizeObserver) {
        navigationObserver = new ResizeObserver(scheduleNavigationLayout);
        document.querySelectorAll(".filetree-wrapper, .navbar").forEach(function (nav) { navigationObserver.observe(nav); });
      }
    }
    if (window.lucide) window.lucide.createIcons();
    var input = dialog.querySelector("input");
    var submit = dialog.querySelector(".dg-note-lock-submit");
    var status = dialog.querySelector('[role="status"]');
    var reveal = dialog.querySelector(".dg-note-lock-reveal");
    if (payload.configurationError) {
      dialog.querySelector("h1").textContent = "Lock needs setup";
      dialog.querySelector(".dg-note-lock-caption").textContent = "No usable password is configured for this note.";
      dialog.querySelector(".dg-note-lock-entry").remove();
      dialog.querySelector("label").remove();
      status.textContent = "The garden owner needs to correct this note's lock settings.";
      return;
    }
    input.focus();
    reveal.addEventListener("click", function () {
      var visible = input.type === "password";
      input.type = visible ? "text" : "password";
      reveal.setAttribute("aria-pressed", String(visible));
      reveal.title = visible ? "Hide password" : "Show password";
      reveal.setAttribute("aria-label", reveal.title);
      input.focus();
    });
    input.addEventListener("input", function () { input.removeAttribute("aria-invalid"); status.textContent = ""; });
    function bytes(base64) {
      return Uint8Array.from(atob(base64), function (character) { return character.charCodeAt(0); });
    }
    function preventPrint(event) {
      if (document.documentElement.classList.contains("dg-note-locked") && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "p") {
        event.preventDefault();
        event.stopImmediatePropagation();
        status.textContent = "Open this note before printing.";
      }
    }
    document.addEventListener("keydown", preventPrint, true);
    var busy = false;
    var storageKey = "dgNoteLock.unlock:" + location.pathname;
    var marker = JSON.stringify([payload.version, payload.iterations, payload.salt, payload.verifier]);
    function unlock() {
        input.value = "";
        document.documentElement.classList.add("dg-note-unlocked");
        document.documentElement.classList.remove("dg-note-locked", "dg-note-lock-navigation");
        if (navigationObserver) navigationObserver.disconnect();
        window.removeEventListener("resize", scheduleNavigationLayout);
        document.documentElement.style.removeProperty("--dg-note-lock-left-edge");
        document.documentElement.style.removeProperty("--dg-note-lock-top-edge");
        if (content) content.inert = false;
        document.removeEventListener("keydown", preventPrint, true);
        dialog.close();
        dialog.remove();
        if (content) {
          var originalTabIndex = content.getAttribute("tabindex");
          content.setAttribute("tabindex", "-1");
          content.focus();
          if (originalTabIndex === null) content.removeAttribute("tabindex");
          else content.setAttribute("tabindex", originalTabIndex);
        }
        document.dispatchEvent(new CustomEvent("dg:note-unlocked"));
    }
    try {
      if (payload.version === 1 && payload.iterations === 600000 && bytes(payload.salt).length === 16 && bytes(payload.verifier).length === 32 && localStorage.getItem(storageKey) === marker) {
        unlock();
        return;
      }
      localStorage.removeItem(storageKey);
    } catch (_) {}
    dialog.querySelector("form").addEventListener("submit", async function (event) {
      event.preventDefault();
      if (busy) return;
      busy = true;
      submit.disabled = true;
      status.textContent = "Checking password...";
      try {
        if (!window.crypto || !window.crypto.subtle) throw new Error("crypto-unavailable");
        var config = JSON.parse(configElement.textContent);
        if (config.version !== 1 || config.iterations !== 600000) throw new Error("invalid-config");
        var salt = bytes(config.salt);
        var expected = bytes(config.verifier);
        if (salt.length !== 16 || expected.length !== 32) throw new Error("invalid-config");
        var key = await crypto.subtle.importKey("raw", new TextEncoder().encode(input.value), "PBKDF2", false, ["deriveBits"]);
        var derived = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt, iterations: config.iterations }, key, 256));
        var difference = 0;
        for (var index = 0; index < expected.length; index++) difference |= expected[index] ^ derived[index];
        if (difference !== 0) {
          input.setAttribute("aria-invalid", "true");
          status.textContent = "That password did not match.";
          input.focus();
          input.select();
          return;
        }
        try { localStorage.setItem(storageKey, marker); } catch (_) {}
        unlock();
      } catch (error) {
        status.textContent = error.message === "crypto-unavailable" ? "Password entry requires HTTPS and a modern browser." : "This lock could not be checked. Reload the page or contact the garden owner.";
      } finally {
        busy = false;
        submit.disabled = false;
      }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
