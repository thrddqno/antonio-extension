# New Tab Agent Instructions

This repository contains **New Tab**, a React Chrome extension that replaces Chrome's default new-tab page.

All coding agents working in this repository must follow these rules.

---

## Product Direction

New Tab is a minimalist personal browser start page.

The intended aesthetic is:

```text
Omarchy
+
terminal UI
+
minimal startpage
+
restrained Claude-like typography
```

The extension is NOT intended to become a generic productivity dashboard.

Prioritize:

- speed
- simplicity
- keyboard usability
- offline resilience
- local persistence
- visual restraint
- predictable interactions

---

## Core Features

The planned product includes:

- Chrome new-tab replacement
- 12-hour clock
- formatted local date
- `"What's on your mind?"`
- search
- grouped bookmark pins
- favicon caching
- draggable pins within groups
- draggable group ordering
- global layout lock/edit mode
- translucent bottom dock
- Omarchy theme support
- `colors.toml` importing

Do not add unrelated functionality without explicit instruction.

---

## Tech Stack

Preferred stack:

```text
React
TypeScript
Vite
Tailwind CSS
Chrome Extension Manifest V3
@dnd-kit
IndexedDB
chrome.storage.local
```

Use existing dependencies where reasonable before adding more.

Avoid adding libraries for functionality that can be implemented cleanly with browser APIs.

---

## Chrome Extension Rules

This extension replaces the new-tab page.

Manifest must use:

```json
"chrome_url_overrides": {
  "newtab": "index.html"
}
```

Use Manifest V3.

Request the minimum browser permissions necessary.

Do not casually add:

```text
<all_urls>
tabs
history
webRequest
```

Every permission must have a clear product need.

---

## Privacy

Prefer local processing.

Bookmark information, categories, preferences, and cached assets should remain local unless a feature explicitly requires a network request.

Do not add:

- analytics
- telemetry
- trackers
- remote logging
- advertising
- behavioral collection

without explicit instruction.

Do not send bookmark data to external categorization services.

---

## Theme

Default Omarchy palette:

```toml
accent = "#605d5b"
cursor = "#a4a4a4"
foreground = "#a4a4a4"
background = "#121212"
selection_foreground = "#121212"
selection_background = "#a4a4a4"

color0 = "#121212"
color1 = "#e19e74"
color2 = "#a5a297"
color3 = "#c6c4b0"
color4 = "#605d5b"
color5 = "#8a8575"
color6 = "#C2BBB0"
color7 = "#dbd9d3"
color8 = "#383735"
color9 = "#984b1e"
color10 = "#637380"
color11 = "#8f4445"
color12 = "#b7a798"
color13 = "#b3adad"
color14 = "#90947a"
color15 = "#a4a4a4"
```

Expose colors through semantic CSS custom properties.

Components should consume semantic tokens rather than raw hex values.

Good:

```css
color: var(--foreground);
border-color: var(--border);
```

Avoid:

```css
color: #a4a4a4;
```

inside arbitrary components.

Keep terminal colors accessible as:

```text
--color-0
...
--color-15
```

---

## UI Rules

Use monospace typography.

Favor:

- whitespace
- typography
- thin borders
- subtle opacity
- small uppercase eyebrows
- restrained pill shapes

Avoid:

- card-heavy design
- gradients
- glassmorphism everywhere
- large shadows
- excessive blur
- overly rounded containers
- Material UI aesthetics
- large colored status widgets
- random pin positioning

Do not automatically reach for:

```text
rounded-2xl
shadow-xl
backdrop-blur-3xl
bg-gradient-*
```

The translucent bottom dock is the main intentional glass-like surface.

---

## Clock

Use 12-hour local time.

Example:

```text
2:24 PM
```

Do not display seconds.

---

## Date

Format:

```text
WEDNESDAY | SEPTEMBER 2, 2026
```

Semantic pattern:

```text
DDDD | MMMM D, YYYY
```

---

## Search

The search field is a primary action.

Normal text should search.

URLs and hostnames should navigate directly.

Keyboard shortcuts:

```text
/
Ctrl+K
Cmd+K
```

focus the search input when appropriate.

Do not introduce command syntax unless explicitly requested.

---

## Pin Rules

Pins contain at minimum:

```ts
interface Pin {
  id: string;
  label: string;
  url: string;
  categoryId: string;
  order: number;
}
```

Labels are normalized to lowercase.

Pin layout must use wrapping, not a rigid fixed-width grid.

Pins should resemble compact tags/pills.

A pin's variable content width creates the organic arrangement.

Do not use random coordinates.

---

## Group Rules

Groups contain at minimum:

```ts
interface Group {
  id: string;
  name: string;
  order: number;
}
```

Group headings appear as small uppercase eyebrow text with a separator.

Do not wrap whole groups inside unnecessary cards.

---

## Dragging

Use `@dnd-kit` unless the project already contains an equally suitable solution.

Pins:

- reorder only within their current group
- cannot cross groups through dragging
- persist new order

Groups:

- reorder globally
- use a dedicated drag handle
- persist new order

Changing a pin's group is an explicit edit operation, not a drag operation.

---

## Layout Lock

Default mode is locked.

Locked mode:

- no pin dragging
- no group dragging
- no drag handles
- clean browsing experience

Edit mode:

- drag behavior enabled
- relevant edit affordances visible

Use a single global lock state.

Do not create separate lock toggles for every pin or group.

---

## Favicons

Favicons should work offline after being cached.

Preferred storage:

```text
IndexedDB
```

for binary favicon data.

Do not fetch external favicon services every time the new-tab page renders.

If favicon retrieval fails, provide a small local fallback.

The page must remain functional without favicons.

---

## Categories

Website categorization should be local-first.

Maintain a mapping:

```ts
Record<string, string>
```

representing:

```text
domain → categoryId
```

When users manually categorize a domain, remember the choice.

Unknown domains may default to:

```text
uncategorized
```

Do not introduce an AI API or backend for category classification unless explicitly instructed.

---

## Network Usage

Avoid startup network requests unless required.

Core page must render using local data first.

Ideal render sequence:

```text
local theme
↓
clock/date
↓
search
↓
stored pins/groups
↓
cached favicons

---

## Storage

Use a centralized typed storage layer.

Do not scatter raw calls to:

```ts
chrome.storage.local.get()
chrome.storage.local.set()
```

through arbitrary UI components.

Use versioned persisted state.

Example:

```ts
interface NewTabState {
  version: 1;
  groups: Group[];
  pins: Pin[];
  preferences: Preferences;
  modules: ModuleConfig[];
  knownDomainCategories: Record<string, string>;
}
```

Account for:

- missing state
- malformed state
- older schema versions
- partial writes

The new-tab page must not crash because local storage contains unexpected data.

---

## State Management

Do not introduce Redux or another heavy global state library without demonstrated need.

Prefer:

- React state
- context where appropriate
- custom hooks
- small focused stores only if complexity grows

Avoid premature abstraction.

---

## Components

Keep components focused.

Do not create enormous `App.tsx` files containing every feature.

A reasonable direction:

```text
src/
├── app/
├── components/
├── features/
│   ├── clock/
│   ├── search/
│   ├── pins/
│   ├── groups/
│   └── settings/
├── storage/
├── theme/
├── types/
└── utils/
```

This is guidance, not a mandatory exact structure.

Choose cohesion over arbitrary folder purity.

---

## TypeScript

Use strict typing.

Avoid `any`.

When external data is consumed, validate or defensively normalize it before treating it as application state.

Prefer explicit domain models.

---

## React

Avoid unnecessary effects.

Do not mirror derived state unnecessarily.

Keep persistence logic separate from pure presentation.

Use stable IDs.

Avoid using array indexes as persistent identity.

---

## Tailwind

Tailwind is for layout and utility styling.

Theme colors should primarily come from CSS custom properties.

Preferred:

```tsx
className="border border-[var(--border)] text-[var(--foreground)]"
```

Do not embed the entire Omarchy palette repeatedly in class strings.

If a style appears repeatedly, extract an appropriate component or utility.

---

## Accessibility

All interactive controls must be reachable by keyboard.

Use semantic HTML.

Provide visible focus states.

Forms need actual labels.

Icon-only buttons require accessible names.

Respect:

```css
prefers-reduced-motion
```

Do not make drag-and-drop the only way to change category membership.

---

## Motion

Keep animations subtle.

Typical duration:

```text
120–200ms
```

Use transitions primarily for:

- opacity
- border
- small transforms
- drawers
- hover state

Do not animate everything.

---

## Bottom Dock

The bottom dock is intentionally translucent.

Keep it restrained.

Suggested characteristics:

```text
fixed bottom positioning
subtle transparency
moderate backdrop blur
thin border
low visual weight
```

Do not spread the same glass effect to all other components.

---

## Settings

Settings should look like a TUI/config pane.

Use section headings and separators.

Avoid card-per-setting design.

The settings experience may eventually support:

- theme
- `colors.toml` import
- font
- search engine
- layout lock defaults

---

## Omarchy Import

A future `colors.toml` importer may support:

```text
accent
cursor
foreground
background
selection_foreground
selection_background
color0 through color15
```

The extension cannot automatically read arbitrary files from:

```text
~/.config/omarchy/
```

Do not implement filesystem assumptions that violate Chrome's sandbox.

Live Omarchy synchronization would require a separate native integration and is out of scope unless explicitly requested.

---

## Icons

The extension icon should be minimal.

Preferred visual direction:

```text
>_
```

Theme:

```text
background: #121212
foreground: #a4a4a4
accent: #605d5b
```

Required outputs should support:

```text
16
32
48
128
```

Do not spend excessive implementation time on branding unless the user requests it.

---

## Error Handling

Failures should degrade gracefully.

Examples:

### Favicon failure

Use fallback icon/initial.

### Storage failure

Keep the current in-memory state usable and report errors non-disruptively if appropriate.

### Invalid bookmark URL

Validate before saving and show a clear inline error.

---

## Performance

Opening a new tab is frequent.

Performance matters.

Avoid:

- blocking network requests
- unnecessarily large dependencies
- long entrance animations
- repeated favicon fetching
- expensive repeated parsing
- excessive rerenders

The local interface should feel effectively immediate.

---

## Testing

Where practical, cover:

- URL normalization
- search query generation
- lowercase label normalization
- storage migration/defaulting
- pin sorting
- group sorting
- category-domain mapping

For UI behavior, test important interaction logic rather than snapshotting every component.

---

## Before Completing Any Task

Run relevant validation.

Typically:

```text
typecheck
lint
tests
production build
```

Also inspect changed files for accidental unrelated edits.

Do not claim a check passed if it was not run.

---

## Agent Output

After implementation work, report concisely:

```text
Implemented
Modified Files
Validation
Known Limitations
Next Step
```

Mention concrete filenames when useful.

Do not write large celebratory summaries.

---

## Scope Discipline

If a feature is not necessary for the current prompt, do not casually implement it.

In particular, do not prematurely add:

- authentication
- accounts
- backend servers
- cloud sync
- AI classification
- browser history integration
- calendar integration
- notes
- tasks
- pomodoro timers
- RSS
- news
- stock tickers
- system monitoring

The extension should remain a focused new-tab/start-page tool.