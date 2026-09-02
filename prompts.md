# PROMPT 03 — Favicons + Offline Cache

Continue the existing New Tab extension.

Before coding:
- read AGENTS.md
- inspect the current implementation
- preserve all working functionality from Prompt 01 and Prompt 02
- do not rebuild working architecture unnecessarily

Goal:
Implement favicon discovery, caching, and offline persistence for pins.

Pins should show the site's favicon when available.

Example:

[ favicon  github ]

## Favicon Behavior

When a pin is created or its URL changes:

1. normalize the URL
2. extract hostname/origin
3. discover/fetch a favicon
4. validate the response
5. cache the image locally
6. associate the cached favicon with the domain

Do not refetch favicons on every new-tab render.

Deduplicate requests for pins using the same domain.

## Storage

Use:
- chrome.storage.local for pin/group/preferences metadata
- IndexedDB for favicon binary data

Create a focused favicon cache/data layer.

Do NOT access IndexedDB directly from arbitrary React components.

Suggested responsibility split:

storage/
├── state storage
└── favicon cache

## Rendering Priority

When rendering a pin:

1. use cached favicon immediately if available
2. otherwise show local fallback
3. refresh/fetch asynchronously when needed

Do not block rendering while waiting for favicon network requests.

## Offline

Cached favicons must remain visible while offline.

Opening a new tab without network should still render:

- clock
- date
- search
- groups
- pins
- cached favicons

No network dependency should prevent the page from being usable.

## Fallback

If no favicon exists or fetching fails, show a restrained fallback.

Preferred:

[g] github

using the first meaningful character of the pin label.

A small generic globe icon is also acceptable.

Keep fallback styling consistent with the current TUI/Omarchy design.

Do not create colorful avatar-style fallback circles.

## Security

Treat favicon responses as untrusted.

Do not inject remote SVG markup directly using innerHTML.

Prefer safe image/blob URLs.

Clean up temporary object URLs when necessary.

Validate that fetched responses are appropriate image content before caching.

## URL Changes

If a pin URL changes to a different domain:

- update favicon metadata
- fetch/cache favicon for the new domain
- stop associating the pin with the previous domain favicon

Do not unnecessarily delete a shared cached favicon if other pins still use that domain.

## Cache Reuse

Pins from the same hostname should reuse the same cached favicon.

Example:

github.com/user/repo-a
github.com/user/repo-b

should share the favicon for:

github.com

Do not duplicate the same binary image for every pin.

## Cache Failures

Handle gracefully:

- network failure
- 404 favicon
- invalid image
- IndexedDB unavailable
- corrupted cached entry

None of these should crash the page.

Fallback should always remain available.

## Visual Style

Preserve the current compact pin design.

Favicons should be small and secondary.

Do not make them visually dominant.

Keep:
- compact rectangular pins
- thin borders
- lowercase labels
- flex-wrap layout
- translucent category hierarchy

Do not alter drag-and-drop behavior from Prompt 02.

## Cleanup

If a pin is deleted:
- remove its metadata normally
- do NOT immediately delete a shared domain favicon unless cleanup logic can safely determine it is unused

Avoid complicated garbage collection in this prompt.

Simple shared cache reuse is more important.

## Do NOT Implement

Do not add:
- weather
- geolocation
- module framework
- AI categorization
- cloud sync
- online bookmark metadata service
- automatic title scraping
- bookmark import/export unless already planned elsewhere

Keep scope focused on favicon caching.

## Validation

Run:
- typecheck
- lint if configured
- tests if configured
- production build

Verify manually:

1. new pin shows favicon when available
2. favicon remains after reload
3. favicon remains visible offline
4. same-domain pins reuse cached favicon
5. failed favicon uses fallback
6. invalid URL does not crash favicon handling
7. changing pin URL refreshes favicon correctly
8. deleting pins does not break shared favicon cache
9. favicon loading does not block initial render
10. Prompt 02 dragging/locking still works
11. visual layout remains unchanged except for favicon support

At completion report:

- Implemented
- Modified Files
- Validation
- Cache/Storage Changes
- Known Limitations

Do not automatically continue to Prompt 04.