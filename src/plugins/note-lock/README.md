# Note Lock (Casual Privacy)

A client-side password screen for casual privacy with optional navigation and search/feed filtering; not encryption or secure access control.

![Note Lock (Casual Privacy) in a Digital Garden](screenshot.png)

## Installation

In Obsidian: Settings > Digital Garden > Plugins > Manage plugins > Browse & install. Until listed in the community gallery, use Install from GitHub with `koltensaccount/garden-plugin-note-lock`. A garden with current plugin support is required. Installation is file copying only; no setup scripts or dependencies need to run on the garden. Save settings and let the site rebuild.

## Usage

The simplest workflow needs no paths or JSON:

1. Set **Shared password for selected notes** in the Digital Garden plugin manager. Leave the advanced URL setting as `{}`.
2. In each Obsidian note you want to lock, add a property named `lock`, change its type to **Checkbox**, and check it.
3. Publish the note and let the site rebuild. Uncheck `lock` and republish to remove the lock.

Equivalent note frontmatter:

```yaml
lock: true
```

The checkbox is read from Digital Garden's exported `dg-note-properties` metadata as well as legacy top-level frontmatter. It must be a real boolean, not the text "true". Configuring the shared password alone does not lock any notes, including the homepage.

For different passwords, the advanced JSON setting accepts exact published paths, not vault filenames. Copy the browser URL's path after opening the published note. Example: `{"/private-note/":"different passphrase"}`. A valid but wrong path does not lock a different note. Invalid JSON/entries are ignored with build warnings, rather than locking every page. Dot segments and encoded path separators are rejected; only an exact `/` intentionally selects the homepage. Because invalid overrides are ignored, use the checkbox workflow when you want a note to remain visibly locked even if settings are incomplete.

Keep the garden source private: configured passwords are stored there. The client receives salted PBKDF2 verifiers, but content is still present in HTML, embeds, attachments and older caches. Optional search/feed filtering removes known locked entries, not every possible disclosure. Do not use sensitive/reused passwords. A selected note without a usable shared password shows **Lock needs setup**, not an unusable password field. Show file browser while locked is off by default. Head-time CSS hides note content and the TOC until successful unlock, including when runtime assets are delayed or JavaScript is disabled; JavaScript is required to enter a password.

## Settings

Successful unlocks are remembered per published note in this browser using localStorage, without storing the typed password. Unchanged site rebuilds retain access; changing that note's effective password requires entering it again after the updated page is loaded. Notes with different passwords remain independent, and unlocking one shared-password note does not unlock all others. Clearing site storage, private browsing or blocked storage may require entering passwords again. Anyone using the same browser profile can read remembered notes, so avoid unlocking on shared/public devices. A note's public PBKDF2 salt is stable and note-specific to support this behavior. Saved markers are client-side convenience, not secure authentication; hover previews remain blocked even after unlocking.

| Key | Setting | Default |
| --- | --- | --- |
| `showFileBrowser` | Show file browser while locked | false |
| `defaultPassword` | Shared password for selected notes | "" |
| `notePasswords` | Different passwords by URL (advanced, optional) | "{}" |
| `excludeLockedFromSearch` | Exclude locked notes from search | true |
| `excludeLockedFromFeed` | Exclude locked notes from RSS | true |

## Compatibility and Accessibility

Locked notes show a generic notice instead of Digital Garden hover previews. Public previews and normal click-to-open/password entry still work. This also blocks the core preview cache and heading-fragment links. Update the plugin, rebuild the entire site, and reload already-open pages; old tabs may retain old preview content. Third-party preview implementations and direct HTML/attachment access are not secure access boundaries.

Works alone and with the other reading plugins. Shared footer controls use the neutral `dg-nav-tools` convention, with a floating fallback when navigation is absent. Each plugin ships the helper it needs; none imports another plugin. Current Digital Garden uses full-document navigation. Initialization is idempotent. Native controls, accessible labels, focus outlines and appropriate ARIA states are retained. Print styles remain separate from screen preferences. Browser storage failures fall back safely.

## Development

Node 22+; `npm ci`, `npm run check`, `npm test`. Tests use Node's test runner and Playwright's driver with an installed Chrome/Edge browser (`CHROME_PATH` overrides discovery). CI uses Ubuntu's Chrome. Browser tests never invoke an OS print dialog. The plugin files are ready to copy directly into `src/plugins/note-lock/` in a current test garden. Real upstream integration and combination checks are reported in `VALIDATION.md`.

## License

MIT, copyright 2026 Kolten Bendickson.
