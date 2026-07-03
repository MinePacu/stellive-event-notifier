# External API Chart Tooltip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show an admin-console styled compact tooltip with the selected date, total calls, and every API source count when a daily external API bar is hovered or focused.

**Architecture:** Keep the existing server-rendered chart and API response unchanged. Add one shared tooltip element to the chart card, populate it from each daily trend item, and position it relative to the active bar with horizontal clamping. Reuse existing source classes and theme variables.

**Tech Stack:** TypeScript server-rendered HTML, CSS, browser DOM APIs, Vitest.

---

### Task 1: Add Tooltip Contract Tests

**Files:**
- Modify: `backend/stellive-hub-api/test/adminInternalRoutes.test.ts`

- [ ] **Step 1: Write the failing HTML hook assertions**

Add assertions to `expectHubEventAdminConsoleSupport()` for:

```ts
expect(html).toContain('id="external-api-tooltip"');
expect(html).toContain('role="tooltip"');
expect(html).toContain("function showExternalApiTooltip");
expect(html).toContain('bar.addEventListener("mouseenter"');
expect(html).toContain('bar.addEventListener("focus"');
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `rtk npm test -- adminInternalRoutes`

Expected: FAIL because `external-api-tooltip` is absent.

### Task 2: Implement the Shared Compact Tooltip

**Files:**
- Modify: `backend/stellive-hub-api/src/admin/adminConsoleHtml.ts`

- [ ] **Step 1: Add the tooltip DOM and CSS**

Add `#external-api-tooltip` with `role="tooltip"` and `hidden` beside the chart. Style it with existing surface, border, text, muted, and source color variables. Use a compact list, 10px radius, subtle shadow, and no pointer events.

- [ ] **Step 2: Add rendering and positioning helpers**

Implement helpers that:

```js
function showExternalApiTooltip(bar, item, visibleSources) { /* render and position */ }
function hideExternalApiTooltip() { /* hide and clear active state */ }
function positionExternalApiTooltip(bar) { /* clamp inside chart card */ }
```

The source list must union `youtube`, `chzzk`, `fcm`, `websub`, `other`, and dynamic sources; sort by count descending then source name; and include zero counts.

- [ ] **Step 3: Bind mouse and keyboard interactions**

For every daily bar, set `tabIndex = 0`, attach `aria-describedby`, and bind `mouseenter`, `mouseleave`, `focus`, `blur`, and Escape key handling. Keep the current `title`, accessible label, and hidden accessible list.

- [ ] **Step 4: Run focused test and build**

Run:

```bash
rtk npm test -- adminInternalRoutes
rtk npm run build
rtk git diff --check
```

Expected: all commands exit 0.

### Task 3: Rendered Verification

**Files:**
- No committed artifacts.

- [ ] **Step 1: Run the internal test server build**

Run `rtk env SERVER_SSH_TARGET=minepacu@192.168.50.9 scripts/server-sync-rebuild.sh` only after local tests pass.

- [ ] **Step 2: Verify interaction behavior**

Open `/admin`, hover and keyboard-focus a non-empty daily bar, and confirm the tooltip shows the date, total, and all API rows without leaving the chart card. Confirm Escape, pointer leave, and blur hide it.

- [ ] **Step 3: Verify browser health**

Confirm no relevant console errors, no horizontal page overflow, and correct Light/Dark/Black theme contrast.
