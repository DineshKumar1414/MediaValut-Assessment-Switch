# Submission

Keep this tight. Bullet points are fine. We read this before we read your code,
and a clear account of your reasoning carries real weight — including where you
chose not to do something.

## Video walkthrough

Paste your Loom (or equivalent) link here. 5–10 minutes.

**Link:**

---

## How to run it

Anything we need to know beyond `npm install && npm run dev`.

## Time spent

Roughly, and how you split it.

---

## Baseline defects found

| # | Defect | Where | Fixed / left / out of scope |
| --- | --- | --- | --- |
| 1 | Bulk update sends >50 ids in one call | `App.tsx` | |
| 2 | | | |

---

## Key decisions

For each significant choice: what you did, what you rejected, and why. Three to
six of these is about right.

**Data fetching and caching**

**Stale response handling**

Search input is debounced by 300 ms: it keeps ordinary typing to one request once
the user pauses, while still feeling immediate for an internal asset search. Each
committed query is a TanStack Query key; a changed key cancels the request through
its `AbortSignal`, cannot render an older key's data, and starts a fresh cursor
chain. TanStack Query also de-duplicates concurrent subscribers to the same key.

**Virtualization approach**

The asset list uses TanStack Virtual with a small overscan window, so only visible
cards and nearby rows exist in the DOM. Cursor pages are appended as the virtual
range approaches the end; thumbnail boxes reserve their aspect ratio and replace
both declared and unexpected missing thumbnails with a stable placeholder.

**Optimistic updates and rollback**

Bulk updates optimistically patch every cached asset, split ids into batches of 50,
and run at most three batches at once. `207` results restore only failed ids and
show the asset names and reasons. Only random `conflict` failures are offered for
retry, using the originally requested status; legal-hold failures remain visible
but are not retried.

**Retry and backoff policy**

The API layer retries only network errors and HTTP 429, 500, and 503, at most
three total attempts. It uses exponential backoff plus jitter and gives
`Retry-After` precedence. Typed `ApiError` status/code values ensure 400, 409,
and 422 never retry. Offline requests fail immediately; reconnecting re-enables
the assets query.

**Single-asset conflicts**

On `409 version_conflict`, the detail panel refetches and displays the latest
asset instead of retrying the stale write. This deliberately asks the reviewer to
review the current status before choosing another change; silently reapplying an
old intent could overwrite a collaborator's decision.

**Virtualization approach**

**Optimistic updates and rollback**

**Retry and backoff policy**

**State placement and URL sync**

---

## Performance

Fill in real measurements, not estimates. Say which machine and browser.

| Metric | Before | After | How measured |
| --- | --- | --- | --- |
| Rendered DOM nodes at 5,000 rows loaded | | | |
| Cards re-rendered when toggling one selection | | | |
| Longest task during sustained scroll | | | |
| Requests fired while typing a 6-character query | | | |
| Production bundle, gzipped | | | |

What was the actual bottleneck, and how did you find it?

---

## Accessibility

- The asset grid uses a roving tabindex: one card is tabbable, arrow keys move
  focus, Enter opens its details, Space changes selection, and Shift+arrow adds
  the next card to the current range. The grid exposes `grid`/`row`/`gridcell`
  roles, `aria-selected`, named selection checkboxes, and decorative thumbnails
  with empty alt text. Opening detail moves focus to its labelled panel; Escape
  and Close return it to the originating card (or the search field if filtered out).
- Tested with keyboard-only navigation in the browser and by inspecting the
  rendered ARIA attributes. I did not run a screen reader, so this is not claimed
  as a screen-reader pass.
- Known gap: arrow navigation follows the virtualized list order rather than a
  multi-column visual grid, because the current layout is a one-column review list.

---

## Interface decisions

Three or four sentences: what you were optimising for, and the decisions that
follow from it. Then briefly:

The interface is optimised for long review sessions: compact controls, generous
card spacing, and metadata that can be scanned without opening every asset. A
small token set defines the surface, border, accent, and status treatments, while
the numbered status pills communicate workflow order in addition to colour. Empty,
loading, offline, error, and partial-failure states each say what happened and
what the reviewer can do next. Neutral navy text on white or pale surfaces and
the selected blue treatment were chosen to maintain AA-level text contrast.

Contrast was checked with WCAG relative-luminance calculations: primary text on
white is 16.27:1, secondary text is 6.39:1, error text is 7.02:1, and each status
pill text/background pair is at least 6.46:1. These exceed WCAG AA for normal text.

- **Visual system.** Your colour, spacing and type decisions, and where they live.
- **Status treatment.** How the four statuses read as a progression, and how they
  stay distinguishable without relying on colour.
- **States.** What you did with loading, empty, error, offline and partial
  failure.
- **Contrast.** What you checked against, and with what.
- **Copy.** Any user-facing message you rewrote and why.

Screenshots in the repo are welcome — link them here.

---

## Trade-offs and cuts

What you deliberately did not do, and what you would do with another day.

## Optional work completed

- **Live updates:** an `EventSource` subscribes to `asset.updated` and reconciles
  newer server versions into loaded cache pages. Optimistic bulk-write ids are
  protected until their requests settle, and events do not reorder the list, so
  they cannot interrupt the reviewer’s scroll position.
- **Tests:** `npm test` runs focused Vitest coverage for 50-id chunking, the
  three-worker concurrency ceiling, and partial-result reconciliation.
- **Library stats:** the header fetches `/api/stats` independently through the
  query cache. Its slow response never blocks the search, filters, or asset grid.

## Critique of the API

What you would change about the backend contract, and what it forced you to do in
the client that you would rather not have.

## Anything you would like us to look at

Code you are proud of, or a decision you are unsure about and want to discuss.
