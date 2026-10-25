# Validation

## Version 1.2.0 Remembered Unlocks

On 2026-10-09, `npm run check` and `npm test` passed: 14 tests, none skipped, using Node 22.23.3 and installed Chrome. Focused browser and configuration tests cover remembered unlock after reload/rebuild, separate note passwords, rejection of wrong passwords, changed-password invalidation, unaffected other-note unlocks and stable note-specific PBKDF2 verifiers. Existing delayed-load/TOC hiding, typing, navigation, preview blocking and discovery filtering checks remain included. No broad cross-plugin matrix was rerun for this change. Browser storage is a convenience, not an access-control boundary.

## Version 1.1.2 Preview Fix

The native link-preview iframe copies the locked note's `.content.innerHTML` without its head-time lock CSS. Note Lock now emits protected paths (no passwords) on all pages and intercepts core hover events before its listener or cache runs. A browser regression using an unchanged copy of upstream `dg-link-preview/templates/linkPreview.njk` checks checkbox locks, URL overrides, backlink hover, nested link text, heading fragments, cached private previews, public previews and direct password unlock. All 13 tests passed; the focused preview test was also rerun after the patch-version bump. This fixes normal core hover behavior, not direct HTML retrieval or third-party preview engines.

Version 1.1.1 validated on 2026-10-07, Node 22.23.3 and Google Chrome 154 (Playwright).

## Standalone

`npm ci`, `npm run check`, `npm test`: 12 tests passed, none skipped. New regressions use the actual Nunjucks head template, exported Obsidian checkbox metadata, malformed JSON/invalid paths, exact homepage selection, and keyboard typing/reveal/wrong-password recovery at desktop/mobile sizes. Ten delayed streaming-load cycles sample pre-bootstrap animation frames and assert no note-body or TOC visibility, even with theme visibility overrides. No-JavaScript pages also keep protected content hidden. Incomplete password setup shows an explicit setup message rather than a disabled entry field. Existing search/feed filtering and watch-rebuild tests remain passing.

## Version 1.1.1 integration

Five isolated real-garden builds/checks passed on upstream commit `80a33ffa6cb198ecf733e5944b4a60510970e3b0`: Note Lock alone with navigation off/on, all seven with navigation off/on, and all seven with malformed overrides. Core file browser and TOC were enabled explicitly. Each scenario exercises six page-load/unlock cycles across 1600 px and 390 px, keyboard entry, hidden note/TOC before unlock, public homepage access, exact URL overrides and mobile overflow. All-seven checks also exercise folding after unlock, print-dialog access after unlock, and blocked Ctrl+P before unlock. No browser page errors occurred. Desktop/mobile lock screenshots were visually inspected.

Other plugin versions: Resizable Panes 1.1.1, TOC Settings 1.1.0, Reading Progress 1.0.1, Appearance & Reading 1.2.0, Clean Print 1.0.1, Heading Folding 1.0.0. No Digital Garden core source edits or installed-vault plugin changes were made. The broader historical matrix below was not rerun for this patch.

## Previous upstream integration

Upstream Digital Garden commit `80a33ffa6cb198ecf733e5944b4a60510970e3b0`, registry commit `ed1b497a4cd584721edf51e7c1a3ef9481229818`. Each of seven plugins was installed and built individually, then all seven built together: eight successful `npm run build` executions on Node 22. No core source modifications were required.

Every nonempty subset of the six reading/layout plugins (63) was browser-tested against the actual compiled upstream page at 1800, 1100 and 390 px widths. The harness selects emitted runtime scripts/styles while preserving current core markup and configuration slots; it does not rebuild all 63 combinations separately. Checks cover responsive overflow, native right-sheet compatibility, single footer ownership, repeated initialization, folded-target navigation and complete print visibility. Six permutations of Appearance, Print and Resizable initialization passed; removing the Appearance contribution left the other controls usable. Note Lock additionally passed the all-seven protected-note unlock flow.

Eight separate stress scenarios passed: left-only, right-only, no panes, both collapsed across reading-width classes; reversible mouse snap and synthetic browser TouchEvents with preferred-width restoration; fold/TOC/progress/print cancellation; canvas; no headings. Console errors and uncaught page errors were asserted absent in final subset and stress runs, including the protected-note flow.

`TZ=UTC npm test` in upstream: 390 tests passed. Without UTC, upstream's two date expectations fail in America/Chicago (388 pass); core was not changed to hide this timezone issue. Generated search/Atom outputs retain the public fixture and exclude the protected fixture; `xmllint --noout dist/feed.xml` passes.

## Screenshot

`screenshot.png` is a real screenshot captured from this current upstream test garden with synthetic public demonstration notes, not a generated/mock illustration.

## Limits

Chromium/Edge was exercised, not Firefox/WebKit or physical touch hardware. Native browser `dialog`, modern layout CSS and optional relative OKLCH are used; unsupported relative colors fall back to the theme accent. Accent contrast is checked against the primary background, not every possible third-party theme surface. Current core uses full-document navigation; disabling/uninstalling is supported through rebuild and page reload, not a hot-unload API. Third-party navigation replacements may require integration checks. No security boundary is provided by Note Lock.
