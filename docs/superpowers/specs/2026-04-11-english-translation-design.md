# English Translation Design

Date: 2026-04-11
Project: `D:\CodeWorkSpace\yui.web`

## Goal

Implement a complete English presentation for the current website so that all user-facing text has an English version. This includes shared UI copy, page-specific copy, static HTML text, dynamic runtime messages, blog article bodies, the skill page, and the 404 page.

## Scope

Pages to review and translate:

1. `/index.html`
2. `/projects/index.html`
3. `/travel/index.html`
4. `/music/index.html`
5. `/anime/index.html`
6. `/resume/index.html`
7. `/blog/index.html`
8. `/blog/article.html`
9. `/blog/ai-image-video.html`
10. `/blog/vibe-coding.html`
11. `/skill/index.html`
12. `/404.html`

Code paths involved:

1. `js/lang.js` for shared and page-level translations
2. Individual HTML files for static default copy
3. Inline scripts that render language-specific labels at runtime

## Current State

The site already contains a language toggle with `zh`, `en`, and `ja` in `js/lang.js`. However, English coverage is incomplete because:

1. Some pages still contain hard-coded Chinese text outside the `data-i18n` system.
2. Some dynamic labels are generated directly inside page scripts.
3. Full blog article bodies are still written directly in Chinese HTML.
4. `skill/index.html` does not appear to be connected to the current translation system.
5. `404.html` is only partially translated.

## Options Considered

### Option 1: Only patch missing English keys in `js/lang.js`

Pros:

1. Smallest code change
2. Fastest to implement

Cons:

1. Leaves hard-coded Chinese on multiple pages
2. Does not cover article bodies, `skill/index.html`, or `404.html`
3. Fails the requirement to translate all text

### Option 2: Translate all user-facing defaults while preserving the existing language system

Pros:

1. Covers both data-driven and hard-coded copy
2. Keeps the current language toggle behavior intact
3. Meets the requirement with moderate implementation risk

Cons:

1. Requires page-by-page review
2. Needs careful checking of inline script branches

### Option 3: Refactor the entire site into a fully centralized i18n architecture

Pros:

1. Cleanest long-term architecture
2. Most consistent content management model

Cons:

1. Much larger than the requested change
2. Higher regression risk
3. Not necessary to satisfy the current goal

## Recommended Approach

Use Option 2.

We will keep the existing `zh/en/ja` toggle structure and complete the English experience by translating every remaining hard-coded Chinese string page by page. Where a page is not integrated with the shared translation system, we will translate the default page content directly.

## Implementation Design

### 1. Complete translation coverage in `js/lang.js`

Update the English entries so every `data-i18n` and `data-i18n-placeholder` key used by the site has a valid English string.

This includes:

1. Shared navigation and footer content
2. Homepage labels
3. Section labels for projects, travel, music, anime, resume, and blog pages
4. Article chrome such as back links, author role, related articles, tag labels, and share labels

### 2. Translate hard-coded HTML defaults

Review each page and translate any remaining Chinese text that is rendered directly in HTML instead of via `data-i18n`.

This includes:

1. Homepage cards and article previews
2. Project cards and category labels
3. Blog titles, excerpts, and article metadata
4. Resume entries where content is embedded directly
5. Footer and button copy not yet connected to the translation system
6. `404.html`

### 3. Translate runtime-generated strings

Review inline scripts and update English branches so dynamically rendered text is fully English when the active language is `en`.

This includes:

1. Load-more button labels
2. Empty-state or end-of-list messages
3. Copy/share success and failure toasts
4. Count labels such as "Showing"

### 4. Translate article body content

Translate the full body content of:

1. `/blog/ai-image-video.html`
2. `/blog/vibe-coding.html`

Where article images or tags include Chinese alt text or labels, translate those too.

### 5. Translate the standalone skill page

Translate `/skill/index.html` directly in the page because it is not currently managed by `js/lang.js`.

### 6. Final verification sweep

Run a repository-wide scan for Chinese characters in the translated pages and translation layer, then manually spot-check the remaining results for acceptable exceptions such as filenames, image paths, or proper nouns that should stay unchanged.

## Risks And Guardrails

### Risk 1: Incomplete English coverage

Guardrail:

Use both structural review and text search. Do not rely only on `data-i18n`.

### Risk 2: Breaking the existing Chinese or Japanese behavior

Guardrail:

Limit changes to text content unless a page requires a small logic fix for language rendering. Preserve the current toggle API and page structure.

### Risk 3: Mixed-language rendering in dynamic sections

Guardrail:

Inspect inline scripts in pages with load-more, share, or empty-state behavior and update all language branches consistently.

## Testing Plan

1. Scan translated files for remaining Chinese text in user-facing areas.
2. Check that `js/lang.js` still initializes and toggles without syntax errors.
3. Manually verify representative pages:
   - homepage
   - one collection page such as anime or music
   - blog index
   - both full article pages
   - skill page
   - 404 page
4. Confirm that English-specific runtime messages appear correctly for buttons, toasts, and list states.

## Out Of Scope

1. Full i18n architecture refactor
2. Content rewriting beyond translation and light English naturalization
3. Visual redesign unrelated to the translation task
