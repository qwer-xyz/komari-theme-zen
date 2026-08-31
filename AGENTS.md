<!-- SPDX-License-Identifier: MIT -->

# AGENTS instructions

## Naming

Write **Komari Zen** for the theme name in prose. Use the literal package or
manifest names only when referring to code, files, commands, or artifacts:

- Package name: `komari-theme-zen`
- Theme short name: `Zen`
- Theme manifest: `komari-theme.json`
- Release artifact: `zen-theme-v*.zip`
- Upstream monitor product: **Komari Monitor** or **Komari**

Use **node** for monitored servers in UI copy unless existing translations use
another term. Do not introduce mixed terminology such as server, instance, VPS,
and host in the same UI surface unless mapping existing Komari API fields.

## Environment Setup

- Use Node.js compatible with the committed lockfile and Vite 6.
- Install dependencies with `npm install`.
- For local development against a real Komari backend, copy `.env.example` to
  `.env.development` and set:

  ```bash
  VITE_API_TARGET=https://your-komari-server.example.com
  ```

- Do not commit `.env.development`, credentials, temporary access keys, or
  screenshots containing private node names/IPs.
- The dev server proxies `/api` and `/themes` to `VITE_API_TARGET`; do not add
  ad-hoc hard-coded backend URLs in source files.

## Commands

- **Start development server:** `npm run dev`
- **Type-check:** `npm run lint`
- **Build theme:** `npm run build`
- **Generate world map data:** `npm run generate:map`
- **Preview production build:** `npm run preview`
- **Clean build output:** `npm run clean`
- **Pack release zip:** `npm run pack`

Run `npm run lint` after TypeScript or React changes. Run `npm run build` after
changes that affect routing, styling, theme settings, generated assets, or the
theme manifest.

## Repository Structure

Key paths:

- `komari-theme.json` - Komari theme manifest and managed theme settings.
- `preview.png` - release preview image used by Komari.
- `src/main.tsx` - React bootstrap, public-info prefetch, `temp_key` cookie
  handling, router/provider setup.
- `src/App.tsx` - route definitions for dashboard and node detail pages.
- `src/layouts/AppLayout.tsx` - global shell, header, footer, loading/error
  states.
- `src/pages/` - route pages:
  - `DashboardPage.tsx` - node table/card dashboard.
  - `InstancePage.tsx` - single-node detail route.
- `src/components/` - UI components, modals, charts, maps, node cards/tables.
- `src/components/detail/` - detail-page history and latency panels.
- `src/contexts/` - Komari public info, RPC2, node list, live data providers.
- `src/hooks/` - data loading, theme preferences, records, charts, view state.
- `src/lib/` - data transforms, formatting, theme/color/font utilities,
  i18n, sanitization, map helpers.
- `src/lib/i18n/locales/` - UI translations.
- `src/assets/world-map-data.json` - generated map data; do not edit by hand.
- `public/assets/flags/` - country and region flags.
- `public/assets/logo/` - OS/provider logo assets.
- `scripts/generate-world-map.mjs` - build-time map data generator.

## Architecture Boundaries

1. This repository is a **Komari Monitor theme**, not a standalone monitoring
   backend.
2. Runtime data comes from Komari endpoints:
   - `/api/public`
   - `/api/rpc2`
   - `/api/recent/:uuid`
   - `/api/records/load`
   - RPC methods such as `common:getNodes`, `common:getNodesLatestStatus`,
     `common:getRecords`, and `common:getVersion`
3. Do not introduce a second data model that conflicts with Komari. Normalize
   backend data in mappers such as `src/lib/komariMapper.ts` and transform
   helpers such as `src/lib/recordTransform.ts`.
4. Prefer RPC2 for Komari data when an existing hook/context already uses it.
   Keep HTTP fallbacks consistent with existing hooks.
5. Theme settings must flow from `komari-theme.json` through
   `useThemeSettings()` and related theme/color/font helpers. Do not read raw
   `theme_settings` directly in UI components unless adding a new parser at the
   theme-settings boundary.
6. Keep routing limited to public theme surfaces unless the user explicitly asks
   for a new route. Admin work belongs in Komari, not in this theme.
7. Treat `src/assets/world-map-data.json` as generated. Change
   `scripts/generate-world-map.mjs` and regenerate it instead.

## UI Design Standards

Komari Zen is a theme project. UI quality is the primary product surface.

- Preserve the existing Zen visual language: minimalist, data-dense, quiet,
  technical, and readable. Avoid marketing-page patterns, oversized decorative
  heroes, ornamental gradients, floating section cards, and unrelated visual
  decoration.
- Keep the first screen useful. The dashboard should show operational node
  status immediately, not introductory copy.
- Use semantic theme tokens from `src/index.css`, `zenSemantics`,
  `zenMotion`, typography helpers, color scheme helpers, and font scheme
  helpers. Avoid one-off hard-coded colors unless the value is genuinely local
  to a chart or asset.
- Design every component for light mode, dark mode, custom color presets, and
  custom font presets.
- Preserve responsive behavior across mobile, tablet, and desktop. Compact
  mobile layouts must remain readable and tappable; desktop layouts should stay
  dense enough for repeated monitoring use.
- Text must not overflow or overlap in Chinese, Traditional Chinese, Japanese,
  Indonesian, or English. When changing UI copy, check the longest translation,
  not only the current locale.
- Do not add visible instructional text that explains the UI itself unless it is
  an existing pattern or a necessary empty/error/loading state.
- Use familiar controls:
  - icons for compact commands,
  - tabs or segmented controls for modes,
  - switches for binary theme settings,
  - menus/selects for option sets,
  - sortable headers for table sorting.
- Prefer `lucide-react` icons when an icon is needed. Reuse existing assets from
  `public/assets/` before adding new ones.
- Cards are for repeated node items, modals, and framed tools. Do not put cards
  inside cards or style whole page sections as floating cards.
- Keep motion subtle and functional. Respect `prefers-reduced-motion` and use
  existing motion utilities when possible.
- Preserve table and card feature parity. A metric that appears in one primary
  dashboard mode should be intentionally handled in the other mode.
- Offline nodes must remain visibly distinct without destroying layout or
  making labels unreadable.
- Charts must remain legible with sparse, missing, or zero data. Null gaps
  should not be silently converted into misleading values.
- Modals must be keyboard dismissible where the existing modal pattern supports
  it, must not trap users on small screens, and must fit within the viewport.
- Custom footer HTML is admin-configured but still must pass through the
  existing sanitizer. Do not render raw admin HTML outside the sanitizer path.

## Theme Manifest Standards

When adding or changing a theme setting:

1. Add or update the setting in `komari-theme.json`.
2. Parse it in `useThemeSettings()` or the relevant color/font/theme parser.
3. Provide a stable default that preserves existing behavior.
4. Keep option labels understandable in both English and Simplified Chinese in
   the manifest.
5. Update UI translations if the setting changes visible copy.
6. Verify that missing, malformed, or old `theme_settings` values degrade
   gracefully.

Do not rename existing setting keys unless a migration path exists. Existing
Komari installations store settings by key.

## Internationalization

- All user-visible UI copy belongs in `src/lib/i18n/locales/`.
- Update every locale file when adding a new message key.
- Keep message keys semantic and stable; do not name them after a temporary
  layout.
- Avoid mixing languages in one UI surface except for established technical
  abbreviations such as CPU, RAM, RX, TX, TCP, UDP, and GB.
- Avoid changing translations opportunistically while working on unrelated UI.

## Data and Formatting Standards

- Use existing helpers in `src/lib/formatUnits.ts`, `billingDisplay.ts`,
  `latencyDisplay.ts`, `recordTransform.ts`, and `residualValue.ts` before
  adding new formatting logic.
- Treat Komari numeric fields defensively. Backend values may be missing,
  strings, percentages, bytes, or zero.
- Keep byte/GB, speed, traffic, billing-cycle, and latency formatting
  consistent between dashboard and detail pages.
- Do not expose private remarks or private-looking backend data in new public UI
  surfaces without confirming the intended visibility.
- Any new external network request must be optional, cached or bounded when
  practical, and safe to fail without breaking the dashboard.

## Coding Standards

- Use React + TypeScript + Vite + Tailwind CSS v4 patterns already present in
  the repository.
- Prefer local helpers and existing hooks over new abstractions.
- Keep components focused. Put API access in contexts/hooks, transforms in
  `src/lib/`, and presentation in components.
- Use `@/` imports for source modules when it improves readability.
- Avoid broad refactors while making UI fixes. Keep diffs close to the user
  request.
- Comments should explain non-obvious reasoning, not restate JSX or simple
  assignments.
- Do not hand-edit generated files when a generation script exists.
- Do not add new runtime dependencies for small UI work. If a dependency is
  justified, explain why existing React/Tailwind/lucide utilities are not enough.
- Keep accessibility in mind: meaningful button labels/titles, keyboard-friendly
  interactions, visible focus where applicable, and no color-only critical state
  without a text/icon cue.

## Testing and Verification

Core data, cache, theme, sanitizer, and RPC behavior has a small Node regression
suite. Browser verification remains especially important for UI changes:

1. Run `npm run lint`.
2. Run `npm test`.
3. Run `npm run build` for changes that affect production output.
4. Start `npm run dev` when visual behavior changed.
5. Check at least one mobile viewport and one desktop viewport.
6. Check light and dark theme behavior.
7. Check loading, empty, offline, and data-present states when practical.
8. For dashboard changes, verify both list and card view modes.
9. For detail-page changes, verify an online node and the offline-node fallback.
10. For theme-setting changes, verify default settings and the configured value.
11. For map changes, run `npm run generate:map` and verify the generated data is
    intentional.

If a real Komari backend is unavailable, use code review and type/build checks,
and state clearly that live visual verification was not performed.

## Commits and PRs

Use Conventional Commits for commit titles. Keep the lowercase type prefix in
English and write the summary and optional body in Chinese:

```text
<type>(optional-scope): <中文摘要>
```

Use `feat` for user-visible features, `fix` for bug fixes, and the closest
standard type such as `refactor`, `style`, `docs`, `test`, `build`, `ci`, or
`chore` for other changes. Write the Chinese summary in the imperative mood and
focus on user-visible impact. When a body is useful, write it in Chinese and
use concise bullet points that describe the actual changes.

- Good: `feat: 优化移动端节点卡片间距`
- Good: `fix: 修复延迟图表空状态显示`
- Good: `feat(settings): 添加 Zen 主题配色预设`
- Bad: `update: 更新文件`
- Bad: `refactor: 修改组件`

Do not add `Co-authored-by` lines for agents.

Before opening a PR:

1. Review the full diff and remove unrelated changes.
2. Confirm `komari-theme.json` version/setting changes are intentional.
3. Run relevant checks from the Testing and Verification section.
4. Include screenshots or a short visual summary for UI changes when possible.
5. Mention any unverified live-Komari behavior.

## Boundaries

- **Ask first**
  - Major redesigns of the dashboard, detail page, or theme identity.
  - New runtime dependencies.
  - New external services or telemetry.
  - Changes that expose more backend data to public users.
  - Renaming theme setting keys or release artifact names.

- **Never**
  - Commit secrets, cookies, tokens, private node IPs, or private screenshots.
  - Replace Komari's backend contract with hard-coded/demo data in production
    code.
  - Render unsanitized custom HTML.
  - Break existing theme settings without a compatibility path.
  - Use destructive git operations unless explicitly requested.

## References

- `README.md`
- `komari-theme.json`
- `vite.config.ts`
- `src/main.tsx`
- `src/layouts/AppLayout.tsx`
- `src/components/NodeTable.tsx`
- `src/components/NodeDetail.tsx`
- `src/hooks/useThemeSettings.ts`
- `src/lib/komariMapper.ts`
- `src/lib/recordTransform.ts`
- `src/index.css`
