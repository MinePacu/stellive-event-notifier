# External API Chart Tooltip Design

## Goal

Add an admin-console styled tooltip to each daily external API chart bar. The tooltip must show the date, total calls, and per-source call counts without changing the existing chart data or API response.

## Interaction

- Show the tooltip when a daily bar receives pointer hover or keyboard focus.
- Hide it on pointer leave, blur, or Escape.
- Keep each bar focusable and retain its existing accessible label and fallback `title` text.
- Position one shared tooltip inside the chart card and clamp its horizontal position so it does not overflow the card.

## Content

- Header: full date for the selected bar.
- Summary: total calls for that date.
- Rows: known sources (`youtube`, `chzzk`, `fcm`, `websub`, `other`) plus any dynamically returned source.
- Sort rows by call count descending, then source name; include zero-count rows.
- Reuse the existing source color classes so tooltip markers match the stacked bar and legend.

## Visual Style

- Use the selected compact-list design.
- Reuse the console surface, border, text, muted text, and source color variables.
- Use a compact 10px radius, subtle shadow, and no animation beyond a short opacity transition.
- Keep the tooltip readable in Light, System, Dark, and Black themes.

## Implementation

- Add a single `#external-api-tooltip` element beside `#external-api-chart` inside `.external-api-chart-card`.
- Extend `renderExternalApiChart()` to attach the date and source counts to each bar and bind hover/focus events.
- Add small helpers to render, position, and hide the shared tooltip.
- Do not add API routes, persistence, dependencies, or chart libraries.

## Tests

- Assert the tooltip DOM hook and `role="tooltip"` are present in `/admin` HTML.
- Assert tooltip interaction/render helpers are included.
- Run the focused admin route test and TypeScript build.
- Verify hover and keyboard focus in the rendered admin console when authentication is available.
