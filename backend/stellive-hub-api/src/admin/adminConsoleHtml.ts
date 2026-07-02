import {
  renderAdminThemeBehaviorScript,
  renderAdminThemeControl,
  renderAdminThemeInitScript,
  renderAdminThemeStyle
} from "./adminThemeHtml.js";

export function renderAdminConsoleHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Stellive Hub Admin</title>
  ${renderAdminThemeInitScript()}
    <style>
      ${renderAdminThemeStyle()}
      .card-body {
        padding: 20px;
      }
      .events-card-body,
      .validation-panel,
      .audit-log-panel {
        padding: 20px;
      }
      .table-scroll {
        width: 100%;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }
      .has-tooltip {
        position: relative;
      }
      .has-tooltip::after {
        content: attr(data-tooltip);
        position: absolute;
        z-index: 20;
        left: 50%;
        bottom: calc(100% + 10px);
        transform: translateX(-50%);
        max-width: min(280px, calc(100vw - 32px));
        width: max-content;
        padding: 8px 10px;
        border: 1px solid var(--admin-border);
        border-radius: 8px;
        background: var(--admin-surface);
        color: var(--admin-text);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.28);
        font-size: 12px;
        line-height: 1.35;
        opacity: 0;
        pointer-events: none;
        transition: opacity 120ms ease, transform 120ms ease;
      }
      .has-tooltip:hover::after,
      .has-tooltip:focus-visible::after,
      .has-tooltip:focus-within::after {
        opacity: 1;
        transform: translateX(-50%) translateY(-2px);
      }
    :root {
      font-family: ui-sans-serif, "Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
      background: var(--admin-bg);
      color: var(--admin-text);
    }
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      min-height: 100vh;
      background:
        radial-gradient(circle at 14% 12%, color-mix(in srgb, var(--admin-accent) 18%, transparent), transparent 30%),
        radial-gradient(circle at 82% 4%, color-mix(in srgb, var(--admin-primary) 14%, transparent), transparent 27%),
        linear-gradient(135deg, color-mix(in srgb, var(--admin-bg) 88%, white), var(--admin-bg));
      color: var(--admin-text);
      font-size: 14px;
      line-height: 1.45;
    }
    .admin-app {
      width: min(100% - 28px, 1480px);
      min-height: calc(100vh - 28px);
      margin: 14px auto;
      display: grid;
      grid-template-columns: 244px minmax(0, 1fr);
      border: 1px solid color-mix(in srgb, var(--admin-border) 72%, transparent);
      border-radius: 28px;
      background: color-mix(in srgb, var(--admin-surface) 76%, transparent);
      box-shadow: 0 24px 70px rgba(34, 48, 78, 0.12);
      overflow: hidden;
    }
    @media (min-width: 1600px) {
      .admin-app {
        width: min(100% - 48px, 1760px);
        grid-template-columns: 248px minmax(0, 1fr);
      }
    }
    @media (min-width: 2200px) {
      .admin-app {
        width: min(100% - 64px, 1920px);
      }
    }
    .admin-nav {
      position: static;
      min-height: 100%;
      padding: 26px 18px;
      border-right: 1px solid var(--admin-border);
      background: color-mix(in srgb, var(--admin-surface) 84%, transparent);
      display: grid;
      grid-template-rows: auto auto 1fr;
      gap: 24px;
    }
    .admin-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 8px;
    }
    .admin-brand-mark {
      width: 32px;
      height: 32px;
      border: 1px solid color-mix(in srgb, var(--admin-primary) 26%, var(--admin-border) 74%);
      border-radius: 11px 15px 11px 15px;
      background: color-mix(in srgb, var(--admin-primary) 18%, var(--admin-accent) 18%);
      transform: rotate(-12deg);
    }
    .admin-brand-title {
      font-size: 17px;
      font-weight: 900;
      letter-spacing: -0.02em;
      color: var(--admin-primary);
    }
    .admin-nav-links {
      display: grid;
      gap: 7px;
      align-content: start;
    }
    .admin-nav button {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      border: 0;
      min-height: 42px;
      padding: 0 12px;
      border-radius: 15px;
      background: transparent;
      color: var(--admin-muted);
      font: inherit;
      font-size: 13px;
      font-weight: 700;
      text-align: left;
      text-decoration: none;
      cursor: pointer;
    }
    .admin-nav-dot {
      width: 6px;
      height: 6px;
      margin-left: auto;
      border-radius: 999px;
      background: var(--admin-primary);
      opacity: 0;
    }
    .admin-nav button[aria-current="page"] .admin-nav-dot {
      opacity: 1;
    }
    .admin-nav button:hover,
    .admin-nav button:focus-visible {
      background: var(--admin-surface-hover);
      color: var(--admin-text);
      outline: 0;
    }
    .admin-nav button[aria-current="page"] {
      background: color-mix(in srgb, var(--admin-primary) 10%, transparent);
      color: var(--admin-primary);
      box-shadow: none;
    }
    .admin-content {
      min-width: 0;
      padding: 24px 28px 30px;
    }
    .admin-topbar {
      position: static;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto auto;
      gap: 16px;
      align-items: center;
      margin: 0 0 18px;
      padding: 0;
      border-bottom: 0;
      background: transparent;
    }
    .admin-tabs {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      overflow-x: auto;
      padding-bottom: 2px;
    }
    .admin-tabs button {
      flex: 0 0 auto;
      min-height: 34px;
      border: 0;
      border-bottom: 2px solid transparent;
      border-radius: 0;
      padding: 7px 10px;
      background: transparent;
      box-shadow: none;
      color: var(--admin-muted);
      font-size: 13px;
      font-weight: 750;
    }
    .admin-tabs button:hover,
    .admin-tabs button:focus-visible {
      background: color-mix(in srgb, var(--admin-surface-hover) 62%, transparent);
      color: var(--admin-text);
    }
    .admin-tabs button[aria-current="page"] {
      border-bottom-color: var(--admin-primary);
      color: var(--admin-primary);
    }
    .page {
      display: none;
    }
    .page.active {
      display: block;
    }
    .topbar-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: 8px;
    }
    .admin-sidebar-card {
      align-self: end;
      padding: 16px;
      border: 1px solid var(--admin-soft-border);
      border-radius: 20px;
      background: color-mix(in srgb, var(--admin-surface) 88%, var(--admin-accent) 12%);
    }
    .admin-sidebar-card strong {
      display: block;
      color: var(--admin-text);
      font-size: 15px;
      line-height: 1.2;
    }
    .admin-sidebar-card span {
      display: block;
      margin-top: 6px;
      color: var(--admin-muted);
      font-size: 12px;
    }
    .admin-page-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 16px;
    }
    .admin-page-head h1 {
      margin-top: 2px;
    }
    .section {
      border: 1px solid var(--admin-border);
      border-radius: 20px;
      background: color-mix(in srgb, var(--admin-surface) 93%, transparent);
      min-width: 0;
      overflow: hidden;
      box-shadow: 0 12px 28px rgba(34, 48, 78, 0.08);
    }
    .section + .section {
      margin-top: 14px;
    }
    .section-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 16px 18px 10px;
      border-bottom: 1px solid var(--admin-border);
      background: transparent;
    }
    .section-head h2 {
      margin-bottom: 0;
    }
    .section-body {
      padding: 14px 18px 18px;
    }
    :root[data-theme="dark"] body {
      background:
        radial-gradient(circle at 14% 12%, rgba(112, 214, 190, 0.16), transparent 30%),
        radial-gradient(circle at 82% 4%, rgba(170, 184, 255, 0.18), transparent 27%),
        linear-gradient(135deg, #101827, var(--admin-bg));
    }
    :root[data-theme="dark"] .admin-app {
      background: rgba(17, 25, 42, 0.78);
      border-color: rgba(170, 184, 255, 0.12);
      box-shadow: 0 32px 88px rgba(2, 6, 23, 0.48);
    }
    :root[data-theme="dark"] .admin-nav {
      background: rgba(20, 31, 51, 0.58);
    }
    :root[data-theme="dark"] .admin-sidebar-card {
      background: linear-gradient(160deg, #1d2a45, #141f33);
      border-color: var(--admin-border);
    }
    :root[data-theme="dark"] .admin-nav button,
    :root[data-theme="dark"] .admin-tabs button {
      background: transparent;
      box-shadow: none;
      color: var(--admin-muted);
    }
    :root[data-theme="dark"] .admin-nav button:hover,
    :root[data-theme="dark"] .admin-tabs button:hover {
      background: rgba(255, 255, 255, 0.035);
      color: var(--admin-text);
    }
    :root[data-theme="dark"] .admin-nav button[aria-current="page"] {
      background: transparent;
      color: var(--admin-primary);
      box-shadow: inset 2px 0 0 var(--admin-primary);
    }
    :root[data-theme="dark"] .admin-tabs button[aria-current="page"] {
      background: transparent;
      border-bottom-color: var(--admin-primary);
      color: var(--admin-primary);
    }
    :root[data-theme="dark"] .admin-content {
      background:
        radial-gradient(circle at 78% 10%, rgba(112, 214, 190, 0.08), transparent 28%),
        transparent;
    }
    :root[data-theme="dark"] .section,
    :root[data-theme="dark"] .panel,
    :root[data-theme="dark"] .hub-events-sidebar,
    :root[data-theme="dark"] .hub-events-section {
      background: linear-gradient(180deg, rgba(24, 36, 58, 0.96), rgba(18, 28, 46, 0.96));
      border-color: var(--admin-border);
      box-shadow: 0 16px 34px rgba(2, 6, 23, 0.34);
    }
    .split {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }
    .status {
      display: inline-flex;
      align-items: center;
      min-height: 22px;
      padding: 0 9px;
      border-radius: 7px;
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
      background: var(--admin-pill-bg);
      color: var(--admin-pill-text);
    }
    .event-layout {
      display: grid;
      grid-template-columns: 1fr;
      gap: 18px;
      align-items: start;
    }
    .event-list {
      display: grid;
      gap: 10px;
      max-height: min(680px, calc(100vh - 260px));
      overflow: auto;
    }
    .event-row {
      width: 100%;
      display: grid;
      gap: 6px;
      padding: 14px;
      border: 1px solid var(--admin-soft-border);
      border-radius: 16px;
      background: color-mix(in srgb, var(--admin-surface) 88%, black);
      text-align: left;
      cursor: pointer;
    }
    .event-row:hover,
    .event-row.active {
      border-color: var(--admin-primary);
      background: var(--admin-surface-hover);
    }
    .event-row-main {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
    }
    .event-title {
      min-width: 0;
      font-weight: 800;
      overflow-wrap: anywhere;
    }
    .event-meta,
    .event-updated {
      color: var(--admin-muted);
      font-size: 12px;
      overflow-wrap: anywhere;
    }
    .editor {
      min-width: 0;
    }
    .form-section {
      border: 1px solid var(--admin-border);
      border-radius: 16px;
      background: color-mix(in srgb, var(--admin-surface) 94%, black);
      overflow: hidden;
    }
    .form-section h3,
    .form-section-title {
      margin: 0;
      padding: 10px 12px;
      border-bottom: 1px solid var(--admin-border);
      font-size: 14px;
      font-weight: 800;
    }
    .metadata-note {
      display: grid;
      gap: 4px;
      padding: 10px;
      border: 1px solid var(--admin-soft-border);
      border-radius: 8px;
      background: color-mix(in srgb, var(--admin-surface) 88%, black);
      color: var(--admin-muted);
      font-size: 12px;
    }
    .metadata-note strong {
      color: var(--admin-text);
      font-size: 13px;
    }
    .bottom-actions {
      display: none;
    }
    header {
      border-bottom: 1px solid var(--admin-border);
      background: var(--admin-surface);
      padding: 16px 20px;
    }
    .header-inner {
      max-width: 1180px;
      margin: 0 auto;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
    }
    .header-copy {
      min-width: 0;
    }
    .header-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      flex: 0 0 auto;
      flex-wrap: wrap;
    }
    .logout-form {
      margin: 0;
      flex: 0 0 auto;
    }
    main {
      max-width: 1180px;
      margin: 0 auto;
      padding: 20px;
    }
    h1, h2 {
      margin: 0;
      letter-spacing: 0;
    }
    h1 {
      font-size: 20px;
      font-weight: 700;
    }
    h2 {
      font-size: 15px;
      font-weight: 700;
      margin-bottom: 12px;
    }
    p {
      margin: 0;
    }
    .subtle {
      margin-top: 4px;
      color: var(--admin-muted);
      font-size: 13px;
    }
    .stack {
      display: grid;
      gap: 12px;
    }
    .grid {
      display: grid;
      gap: 14px;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      align-items: start;
    }
    .panel {
      border: 1px solid var(--admin-border);
      border-radius: 20px;
      background: color-mix(in srgb, var(--admin-surface) 94%, transparent);
      padding: 16px;
      min-width: 0;
    }
    .overview-card {
      display: grid;
      gap: 8px;
      min-height: 0;
      align-self: start;
    }
    .overview-card h2 {
      margin-bottom: 2px;
    }
    .overview-card .metric {
      padding: 6px 0;
    }
    .overview-primary {
      font-size: 1.35rem;
      font-weight: 850;
      line-height: 1.1;
      color: var(--admin-text);
    }
    .toolbar {
      display: grid;
      gap: 10px;
      grid-template-columns: minmax(260px, 1.8fr) auto auto;
      align-items: end;
    }
    .field {
      display: grid;
      gap: 6px;
      min-width: 0;
    }
    .field label {
      font-size: 12px;
      font-weight: 600;
      color: var(--admin-label);
    }
    input {
      width: 100%;
      min-width: 0;
      border: 1px solid var(--admin-input-border);
      border-radius: 13px;
      padding: 10px 12px;
      font: inherit;
      font-size: 13px;
      background: var(--admin-surface);
      color: var(--admin-text);
    }
    .refresh-controls,
    .action-controls {
      align-items: center;
      display: inline-flex;
      gap: 8px;
    }
    .action-controls {
      justify-content: flex-end;
    }
    .switch-control {
      align-items: center;
      border: 1px solid var(--admin-input-border);
      border-radius: 13px;
      background: var(--admin-surface);
      color: var(--admin-label);
      display: inline-flex;
      gap: 8px;
      min-height: 36px;
      padding: 0 10px;
      white-space: nowrap;
    }
    .auto-refresh-input {
      height: 1px;
      position: absolute;
      opacity: 0;
      width: 1px;
    }
    .auto-refresh-switch {
      align-items: center;
      background: var(--admin-hover);
      border: 1px solid var(--admin-input-border);
      border-radius: 999px;
      display: inline-flex;
      height: 16px;
      padding: 2px;
      width: 30px;
    }
    .auto-refresh-switch::before {
      background: var(--admin-muted);
      border-radius: 999px;
      content: "";
      display: block;
      height: 10px;
      transition: margin-left 0.15s ease, background 0.15s ease;
      width: 10px;
    }
    .auto-refresh-input:checked + .auto-refresh-switch::before {
      background: var(--admin-accent);
      margin-left: 14px;
    }
    .auto-refresh-input:focus-visible + .auto-refresh-switch {
      outline: 2px solid var(--admin-accent);
      outline-offset: 2px;
    }
    .auto-refresh-status {
      min-width: 48px;
      text-align: center;
      white-space: nowrap;
    }
    button {
      border: 1px solid var(--admin-input-border);
      border-radius: 13px;
      background: var(--admin-surface);
      color: var(--admin-text);
      padding: 8px 10px;
      font: inherit;
      font-size: 13px;
      cursor: pointer;
      min-height: 38px;
      white-space: nowrap;
    }
    button:hover {
      background: var(--admin-surface-hover);
    }
    input:focus-visible,
    button:focus-visible {
      outline: 2px solid var(--admin-primary);
      outline-offset: 2px;
    }
    .logout-button {
      min-height: 32px;
      padding: 6px 10px;
      color: var(--admin-label);
    }
    button:disabled {
      cursor: wait;
      opacity: 0.7;
    }
    .message {
      display: inline-flex;
      align-items: center;
      width: fit-content;
      max-width: 100%;
      min-height: 0;
      margin-bottom: 12px;
      padding: 6px 10px;
      border: 1px solid var(--admin-soft-border);
      border-radius: 8px;
      background: color-mix(in srgb, var(--admin-surface) 92%, var(--admin-primary) 8%);
      font-size: 13px;
      color: var(--admin-muted);
    }
    .message:empty {
      display: none;
    }
    .message.error {
      color: var(--admin-danger);
      border-color: color-mix(in srgb, var(--admin-danger) 40%, var(--admin-border) 60%);
      background: color-mix(in srgb, var(--admin-surface) 88%, var(--admin-danger) 12%);
    }
    .metric {
      display: grid;
      gap: 5px;
      padding: 8px 0;
      border-top: 1px solid var(--admin-soft-border);
      font-size: 13px;
    }
    .metric:first-of-type {
      border-top: 0;
      padding-top: 0;
    }
    .metric:last-of-type {
      padding-bottom: 0;
    }
    .metric-key {
      color: var(--admin-muted);
    }
    .metric-value {
      text-align: left;
      font-weight: 750;
      word-break: break-word;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      min-height: 22px;
      padding: 0 9px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
      background: var(--admin-pill-bg);
      color: var(--admin-pill-text);
    }
    .pill.ok,
    .pill.enabled,
    .pill.configured {
      background: var(--admin-pill-ok-bg);
      color: var(--admin-pill-ok-text);
    }
    .pill.disabled,
    .pill.missing {
      background: var(--admin-pill-neutral-bg);
      color: var(--admin-pill-neutral-text);
    }
    .pill.degraded,
    .pill.failed,
    .pill.rate-limited {
      background: var(--admin-pill-danger-bg);
      color: var(--admin-pill-danger-text);
    }
    .pill.verify-required {
      background: var(--admin-pill-warning-bg);
      color: var(--admin-pill-warning-text);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th,
    td {
      border-top: 1px solid var(--admin-soft-border);
      padding: 8px 6px;
      vertical-align: top;
      text-align: left;
      word-break: break-word;
    }
    th {
      color: var(--admin-muted);
      font-weight: 700;
    }
    th:first-child,
    td:first-child {
      padding-left: 0;
    }
    th:last-child,
    td:last-child {
      padding-right: 0;
    }
    .empty {
      color: var(--admin-muted);
      font-style: italic;
    }
    .hub-events-workspace {
      display: grid;
      grid-template-columns: 1fr;
      gap: 16px;
      align-items: start;
    }

    .hub-events-toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 8px 0 14px;
    }

    .hub-events-sidebar,
    .hub-events-editor,
    .hub-events-section {
      border: 1px solid var(--admin-border);
      border-radius: 16px;
      background: color-mix(in srgb, var(--admin-surface) 94%, black);
    }

    .hub-events-sidebar {
      overflow: hidden;
    }

    .hub-event-editor-panel {
      width: 100%;
      max-width: 1280px;
    }

    .hub-event-list-panel {
      width: 100%;
      max-width: 1280px;
    }

    .hub-events-sidebar-header,
    .hub-events-section-title {
      padding: 10px 12px;
      border-bottom: 1px solid var(--admin-border);
      font-weight: 700;
    }

    .hub-events-filters {
      display: grid;
      gap: 10px;
      padding: 12px;
      border-bottom: 1px solid var(--admin-border);
    }

    .hub-events-filter-row,
    .hub-events-two {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .hub-events-three {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }

    .hub-events-list {
      padding: 12px;
    }

    .hub-events-list th:first-child,
    .hub-events-list td:first-child {
      width: 34px;
      text-align: center;
    }

    .hub-events-editor {
      padding: 0;
      border: 0;
      background: transparent;
      overflow: visible;
    }

    .hub-events-editor-grid {
      display: grid;
      grid-template-columns: minmax(420px, 1.25fr) minmax(360px, 1fr);
      gap: 16px;
    }

    .hub-event-form-wide .form-section:first-of-type {
      grid-column: 1 / -1;
    }

    .hub-events-section-body {
      display: grid;
      gap: 13px;
      padding: 14px;
    }

    .hub-events-footer {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
      margin-top: 14px;
    }

    .hub-event-pagination {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 10px 12px 12px;
      border-top: 1px solid var(--admin-border);
    }

    .hub-event-pagination-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .settings-grid,
    .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }

    .settings-layout {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr);
      gap: 14px;
      align-items: start;
    }

    .settings-column {
      display: grid;
      gap: 14px;
      align-content: start;
    }

    .settings-stack,
    .activity-list,
    .summary-list {
      display: grid;
      gap: 10px;
    }

    .settings-row,
    .summary-row,
    .activity-item,
    .security-item {
      display: grid;
      gap: 6px;
      padding: 14px;
      border: 1px solid var(--admin-soft-border);
      border-radius: 16px;
      background: color-mix(in srgb, var(--admin-surface) 94%, var(--admin-bg) 6%);
    }

    .summary-row {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 12px;
    }

    .settings-title,
    .activity-title,
    .summary-title {
      font-weight: 750;
      color: var(--admin-text);
    }

    .settings-description,
    .activity-description,
    .summary-description {
      color: var(--admin-muted);
      line-height: 1.5;
    }

    .token-input-card {
      display: grid;
      gap: 14px;
      border-color: color-mix(in srgb, var(--admin-primary) 24%, var(--admin-border) 76%);
    }

    .credential-input-wrap {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 8px;
      border: 1px solid var(--admin-input-border);
      border-radius: 15px;
      background: var(--admin-surface);
      padding: 0 10px;
    }

    .credential-input-wrap input {
      border: 0;
      border-radius: 0;
      padding-left: 0;
      padding-right: 0;
      background: transparent;
    }

    .credential-input-wrap input:focus-visible {
      outline: 0;
    }

    .credential-icon,
    .credential-input-badge {
      color: var(--admin-muted);
      font-size: 12px;
      font-weight: 750;
      white-space: nowrap;
    }

    .credential-input-badge {
      color: var(--admin-primary);
    }

    .status-table {
      margin-top: 8px;
      border: 1px solid var(--admin-soft-border);
      border-radius: 14px;
      overflow: hidden;
    }

    .status-table td:last-child {
      text-align: right;
      font-weight: 700;
    }

    .security-grid {
      display: grid;
      gap: 10px;
    }

    .credential-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }

    .credential-badge {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      padding: 0 9px;
      border: 1px solid color-mix(in srgb, var(--admin-primary) 22%, var(--admin-border) 78%);
      border-radius: 999px;
      color: var(--admin-primary);
      background: color-mix(in srgb, var(--admin-primary) 7%, transparent);
      font-size: 12px;
      font-weight: 750;
      white-space: nowrap;
    }

    .settings-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .security-notes {
      margin: 0;
      padding-left: 18px;
      color: var(--admin-muted);
      line-height: 1.6;
    }

    .image-policy-help {
      display: grid;
      gap: 8px;
      padding: 10px;
      border: 1px solid var(--admin-soft-border);
      border-radius: 8px;
      background: color-mix(in srgb, var(--admin-surface) 90%, var(--admin-accent) 10%);
    }

    .policy-help-grid {
      display: grid;
      gap: 8px;
      color: var(--admin-muted);
      font-size: 0.86rem;
      line-height: 1.45;
    }

    @media (max-width: 1040px) {
      .admin-app {
        grid-template-columns: 1fr;
      }
      .admin-nav {
        position: sticky;
        top: 0;
        z-index: 12;
        height: auto;
        display: flex;
        align-items: center;
        gap: 8px;
        overflow-x: auto;
        padding: 10px 12px;
        border-right: 0;
        border-bottom: 1px solid var(--admin-border);
      }
      .admin-brand {
        flex: 0 0 auto;
        margin: 0 10px 0 0;
      }
      .admin-brand-mark,
      .admin-sidebar-card {
        display: none;
      }
      .admin-nav-links {
        display: flex;
        gap: 8px;
        flex: 0 0 auto;
      }
      .admin-nav button {
        flex: 0 0 auto;
      }
      .admin-topbar {
        position: static;
        margin-top: 0;
        grid-template-columns: 1fr;
      }
      .split,
      .event-layout {
        grid-template-columns: 1fr;
      }
      .grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .hub-events-workspace,
      .hub-events-editor-grid,
      .hub-events-footer,
      .settings-layout {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 760px) {
      .admin-content {
        padding: 12px;
      }
      .admin-topbar {
        margin: -12px -12px 12px;
        padding: 12px;
      }
      .admin-tabs {
        display: none;
      }
      .admin-page-head,
      .section-head {
        flex-direction: column;
        align-items: stretch;
      }
      .event-list {
        max-height: none;
      }
      .event-row {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 860px) {
      .toolbar {
        grid-template-columns: 1fr 1fr;
      }
      .field {
        grid-column: 1 / -1;
      }
    }
    @media (max-width: 640px) {
      body {
        overflow-x: hidden;
      }
      .header-inner {
        flex-direction: column;
        align-items: stretch;
      }
      main,
      .admin-app,
      .admin-content,
      .admin-topbar,
      .section,
      .shell,
      .panel,
      .card,
      .hub-events-workspace {
        width: 100%;
        max-width: 100%;
      }
      main {
        padding: 12px;
      }
      .grid,
      .toolbar,
      .hub-events-workspace,
      .hub-event-actions,
      .hub-events-editor-grid,
      .hub-events-footer,
      .settings-grid,
      .dashboard-grid,
      .hub-events-filter-row,
      .hub-events-two,
      .hub-events-three {
        grid-template-columns: 1fr;
      }
      .toolbar,
      .hub-event-actions {
        display: flex;
        flex-wrap: wrap;
      }
      .topbar-actions,
      .refresh-controls,
      .action-controls,
      .hub-events-toolbar {
        width: 100%;
        justify-content: flex-start;
        flex-wrap: wrap;
      }
      .bottom-actions {
        position: sticky;
        bottom: 0;
        z-index: 9;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
        margin: 12px -14px -14px;
        padding: 10px 14px;
        border-top: 1px solid var(--admin-border);
        background: color-mix(in srgb, var(--admin-surface) 96%, black);
      }
      .bottom-actions button {
        width: 100%;
      }
      input,
      select,
      textarea,
      button {
        max-width: 100%;
      }
      .table-scroll {
        width: 100%;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }
      .has-tooltip::after {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="admin-app">
    <nav class="admin-nav" aria-label="Admin console sections">
      <div class="admin-brand">
        <div class="admin-brand-mark" aria-hidden="true"></div>
        <div class="admin-brand-title">Stellive Hub Admin</div>
      </div>
      <div class="admin-nav-links">
        <button type="button" data-page-target="dashboard" aria-current="page">Dashboard<span class="admin-nav-dot" aria-hidden="true"></span></button>
        <button type="button" data-page-target="hub-events">Hub events<span class="admin-nav-dot" aria-hidden="true"></span></button>
        <button type="button" data-page-target="operations">Operations<span class="admin-nav-dot" aria-hidden="true"></span></button>
        <button type="button" data-page-target="audit">Audit<span class="admin-nav-dot" aria-hidden="true"></span></button>
        <button type="button" data-page-target="settings">Settings<span class="admin-nav-dot" aria-hidden="true"></span></button>
      </div>
      <div class="admin-sidebar-card">
        <strong>Session active</strong>
        <span>Internal API access is configured in Settings only.</span>
      </div>
    </nav>
    <main class="admin-content stack">
      <div class="admin-topbar">
        <div>
          <strong id="admin-current-page-title">Dashboard</strong>
          <p id="admin-current-page-description" class="subtle">Admin session and internal token are separate.</p>
          <nav class="admin-tabs" aria-label="Quick page tabs">
            <button type="button" data-page-target="dashboard" aria-current="page">Dashboard</button>
            <button type="button" data-page-target="hub-events">Hub events</button>
            <button type="button" data-page-target="operations">Operations</button>
            <button type="button" data-page-target="audit">Audit</button>
            <button type="button" data-page-target="settings">Settings</button>
          </nav>
        </div>
        <div class="refresh-controls">
              <button class="has-tooltip" data-tooltip="Refresh adapter, secret, feature flag, and job status." title="Refresh adapter, secret, feature flag, and job status." id="refresh" type="button">Refresh</button>
        </div>
        <div class="topbar-actions">
          ${renderAdminThemeControl()}
          <form class="logout-form" method="post" action="/admin/logout">
            <button class="logout-button" type="submit">Log out</button>
          </form>
        </div>
      </div>

      <div id="message" class="message" aria-live="polite"></div>

      <section class="page active" id="page-dashboard" data-admin-page="dashboard">
      <section id="overview-section" class="section">
        <div class="section-head">
          <div>
            <h2>Dashboard</h2>
            <p class="subtle">Health, Database, Uptime, Queue, Events, and service status.</p>
          </div>
        </div>
        <div class="section-body">
          <section id="overview" class="grid" aria-live="polite"></section>
        </div>
      </section>

      <section id="adapters-section" class="section">
        <div class="section-head">
          <h2>System status</h2>
        </div>
        <div class="section-body split">
          <div class="panel">
            <h2>Service overview</h2>
            <div id="service-overview-summary" class="summary-list" aria-live="polite"></div>
            <div class="table-scroll">
              <table class="status-table">
                <tbody id="service-overview-status"></tbody>
              </table>
            </div>
          </div>
          <div class="panel">
            <h2>Recent activity</h2>
            <div id="dashboard-recent-activity" class="activity-list" aria-live="polite"></div>
          </div>
          <div class="panel">
            <h2>Adapter health</h2>
            <div class="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Status</th>
                    <th>Reason</th>
                    <th>Last checked</th>
                  </tr>
                </thead>
                <tbody id="adapters"></tbody>
              </table>
            </div>
          </div>
          <div class="panel">
            <h2>Configuration readiness</h2>
            <div class="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>State</th>
                  </tr>
                </thead>
                <tbody id="secrets"></tbody>
              </table>
            </div>
            <div class="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody id="feature-flags"></tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
      </section>

      <section class="page" id="page-hub-events" data-admin-page="hub-events">
      <section id="hub-events-section" class="section stack" data-admin-section="hub-events">
        <div class="section-head">
          <div>
            <h2>Hub events</h2>
            <p class="subtle">Goods and event schedule publishing controls.</p>
          </div>
          <div class="hub-events-toolbar action-controls">
                <button class="has-tooltip" data-tooltip="Refresh Hub event list." title="Refresh Hub event list." id="hub-event-refresh" type="button">Refresh events</button>
                <button class="has-tooltip" data-tooltip="Validate the current Hub event form without saving." title="Validate the current Hub event form without saving." id="hub-event-validate" type="button">Validate</button>
            <button data-hub-event-action="save-draft" id="hub-event-save-draft" type="button">Save draft</button>
            <button data-hub-event-action="publish" id="hub-event-publish" type="button">Publish</button>
            <button data-hub-event-action="cancel" id="hub-event-cancel" type="button">Cancel</button>
            <button data-hub-event-action="deactivate" id="hub-event-deactivate" type="button">Deactivate</button>
            <button data-hub-event-action="delete" id="hub-event-delete" type="button">Delete</button>
          </div>
        </div>
        <div class="section-body">
        <div class="event-layout hub-events-workspace">
          <div class="editor hub-event-editor-panel hub-events-editor">
          <form id="hub-event-form" class="hub-event-form-wide hub-events-editor-grid">
            <input id="hub-event-id" type="hidden">
            <div class="form-section hub-events-section">
              <h3 class="form-section-title hub-events-section-title">Basic information</h3>
              <div class="hub-events-section-body">
                <div class="field"><label for="hub-event-title">Title</label><input id="hub-event-title" name="title" autocomplete="off"></div>
                <div class="field"><label for="hub-event-summary">Summary</label><textarea id="hub-event-summary" name="summary" rows="3"></textarea></div>
                <div class="hub-events-three">
                  <div class="field"><label for="hub-event-category">Category</label><select id="hub-event-category" name="category"><option value="online_goods">Online goods</option><option value="online_collab">Online collab</option><option value="offline_concert">Offline concert</option><option value="offline_collab">Offline collab</option><option value="offline_popup">Offline popup</option><option value="ticketing">Ticketing</option></select></div>
                  <div class="field"><label for="hub-event-participation-mode">Participation mode</label><select id="hub-event-participation-mode" name="participationMode"><option value="online">Online</option><option value="offline">Offline</option><option value="hybrid">Hybrid</option></select></div>
                  <div class="field"><label for="hub-event-status">Status</label><select id="hub-event-status" name="status"><option value="announced">Announced</option><option value="upcoming">Upcoming</option><option value="open">Open</option><option value="closing_soon">Closing soon</option><option value="ended">Ended</option><option value="cancelled">Cancelled</option></select></div>
                </div>
                <div class="field"><label for="hub-event-generation">Generation</label><input id="hub-event-generation" name="generationId" autocomplete="off" value="official" placeholder="official, gen1, gen2, gen3"><p class="subtle">Examples: official, gen1, gen2, gen3. Use the member's matching generation for member-scoped events.</p></div>
                <div class="field"><label for="hub-event-member">Member</label><input id="hub-event-member" name="memberId" autocomplete="off" placeholder="akane-lize"><p class="subtle">Example: akane-lize. Leave blank for generation-wide or official events.</p></div>
              </div>
            </div>
            <div class="form-section hub-events-section">
              <h3 class="form-section-title hub-events-section-title">Source and thumbnail</h3>
              <div class="hub-events-section-body">
                <div class="hub-events-two">
                  <div class="field"><label for="hub-event-source-type">Source type</label><select id="hub-event-source-type" name="sourceType"><option value="official">Official</option><option value="member">Member</option><option value="official_collab">Official collab</option></select></div>
                  <div class="field"><label for="hub-event-image-policy-state">Image policy state</label><select id="hub-event-image-policy-state" name="imagePolicyState"><option value="none">None</option><option value="official_runtime_url">Official runtime URL</option><option value="third_party_allowed">Third-party allowed</option><option value="verify_required">Verify required</option><option value="blocked">Blocked</option></select></div>
                </div>
                <div class="field"><label for="hub-event-source-url">Source URL</label><input id="hub-event-source-url" name="sourceUrl" type="url" autocomplete="off"></div>
                <div class="field"><label for="hub-event-source-label">Source label</label><input id="hub-event-source-label" name="sourceLabel" autocomplete="off"></div>
                <div class="image-policy-help" aria-label="Source and image metadata help">
                  <strong>No bundled image</strong>
                  <div class="policy-help-grid">
                    <span><strong>Source type:</strong> official means official notices or sources; member means member-owned sources; official_collab means official collaboration or partner sources.</span>
                    <span><strong>Image policy state:</strong> none stores no image metadata and requires image URL/source label/source URL to stay blank; official_runtime_url and third_party_allowed require image URL, source label, and source URL; verify_required can be saved but is not treated as display-ready; blocked is not display-ready.</span>
                    <span><strong>Common:</strong> Metadata only. No uploads or copied assets. No base64, local path, logo/poster/profile image asset fields. Displayable images require HTTPS. sourceUrl, purchaseUrl, ticketUrl must be HTTPS when filled.</span>
                  </div>
                </div>
                <div class="field"><label for="hub-event-image-url">Image URL</label><input id="hub-event-image-url" name="imageUrl" type="url" autocomplete="off"></div>
                <div class="field"><label for="hub-event-image-source-label">Image source label</label><input id="hub-event-image-source-label" name="imageSourceLabel" autocomplete="off"></div>
                <div class="field"><label for="hub-event-image-source-url">Image source URL</label><input id="hub-event-image-source-url" name="imageSourceUrl" type="url" autocomplete="off"></div>
              </div>
            </div>
            <div class="form-section hub-events-section">
              <h3 class="form-section-title hub-events-section-title">Schedule</h3>
              <div class="hub-events-section-body">
                <div class="field"><label for="hub-event-announced-at">Announced at</label><input id="hub-event-announced-at" name="announcedAt" type="datetime-local"></div>
                <div class="field"><label for="hub-event-starts-at">Starts at</label><input id="hub-event-starts-at" name="startsAt" type="datetime-local"></div>
                <div class="field"><label for="hub-event-ends-at">Ends at</label><input id="hub-event-ends-at" name="endsAt" type="datetime-local"></div>
              </div>
            </div>
            <div class="form-section hub-events-section">
              <h3 class="form-section-title hub-events-section-title">Links and venue</h3>
              <div class="hub-events-section-body">
                <div class="field"><label for="hub-event-purchase-url">Purchase URL</label><input id="hub-event-purchase-url" name="purchaseUrl" type="url" autocomplete="off"></div>
                <div class="field"><label for="hub-event-ticket-url">Ticket URL</label><input id="hub-event-ticket-url" name="ticketUrl" type="url" autocomplete="off"></div>
                <div class="field"><label for="hub-event-venue-name">Venue name</label><input id="hub-event-venue-name" name="venueName" autocomplete="off"></div>
                <div class="field"><label for="hub-event-venue-address">Venue address</label><input id="hub-event-venue-address" name="venueAddress" autocomplete="off"></div>
                <label class="switch-control"><input id="hub-event-notification-eligible" name="notificationEligible" type="checkbox" checked> Notification eligible</label>
              </div>
            </div>
          </form>
          <div class="hub-events-footer">
            <div class="hub-events-section panel validation-panel"><h3>Validation</h3><ul id="hub-event-validation" class="message-list"></ul></div>
            <div class="hub-events-section panel audit-log-panel"><h3>Audit log</h3><ul id="hub-event-audit-log" class="message-list"></ul></div>
          </div>
          </div>
          <div class="hub-event-list-panel hub-events-sidebar events-card">
            <div class="card-body events-card-body">
              <h3>Events</h3>
              <p class="subtle">Filter and select existing Hub events.</p>
            </div>
            <div class="hub-events-filters">
              <div class="hub-events-filter-row">
                <div class="field">
                  <label class="has-tooltip" data-tooltip="Filter the events list by publication state." title="Filter the events list by publication state." for="hub-event-state-filter">Publication state</label>
                  <select id="hub-event-state-filter">
                    <option value="">All</option>
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="inactive">Inactive</option>
                    <option value="deleted">Deleted</option>
                  </select>
                </div>
                <div class="field">
                  <label class="has-tooltip" data-tooltip="Filter the events list by public-facing status." title="Filter the events list by public-facing status." for="hub-event-status-filter">Public status</label>
                  <select id="hub-event-status-filter">
                    <option value="">All</option>
                    <option value="announced">Announced</option>
                    <option value="upcoming">Upcoming</option>
                    <option value="open">Open</option>
                    <option value="closing_soon">Closing soon</option>
                    <option value="ended">Ended</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
              <div class="hub-events-filter-row">
                <div class="field">
                  <label for="hub-event-category-filter">Category</label>
                  <select id="hub-event-category-filter">
                    <option value="">All</option>
                    <option value="online_goods">Online goods</option>
                    <option value="online_collab">Online collab</option>
                    <option value="offline_concert">Offline concert</option>
                    <option value="offline_collab">Offline collab</option>
                    <option value="offline_popup">Offline popup</option>
                    <option value="ticketing">Ticketing</option>
                  </select>
                </div>
                <div class="field">
                  <label for="hub-event-participation-mode-filter">Participation mode</label>
                  <select id="hub-event-participation-mode-filter">
                    <option value="">All</option>
                    <option value="online">Online</option>
                    <option value="offline">Offline</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </div>
              </div>
              <div class="hub-events-filter-row">
                <div class="field">
                  <label for="hub-event-generation-filter">Generation</label>
                  <input id="hub-event-generation-filter" autocomplete="off" placeholder="official, gen1, gen2, gen3">
                </div>
                <div class="field">
                  <label for="hub-event-member-filter">Member</label>
                  <input id="hub-event-member-filter" autocomplete="off" placeholder="akane-lize">
                </div>
              </div>
              <div class="field">
                <label for="hub-event-search">Search</label>
                <input id="hub-event-search" type="search" autocomplete="off" spellcheck="false">
              </div>
              <label class="switch-control"><input id="hub-event-include-deleted" type="checkbox"> Include deleted</label>
            </div>
            <div id="hub-event-list" class="event-list hub-events-list" role="list" aria-label="Hub events"></div>
            <div class="hub-event-pagination" aria-label="Hub events pagination">
              <span id="hub-event-pagination-status" class="subtle">Page 1</span>
              <div class="hub-event-pagination-actions">
                <button id="hub-event-prev-page" type="button">Previous</button>
                <button id="hub-event-next-page" type="button">Next</button>
              </div>
            </div>
          </div>
        </div>
        <div class="bottom-actions" aria-label="Hub event mobile actions">
          <button type="button" data-mobile-hub-event-action="validate">Validate</button>
          <button type="button" data-mobile-hub-event-action="save-draft">Save draft</button>
          <button type="button" data-mobile-hub-event-action="delete">Delete</button>
        </div>
        </div>
      </section>
      </section>

      <section class="page" id="page-operations" data-admin-page="operations">
      <section id="operations-section" class="section">
        <div class="section-head">
          <div>
            <h2>Operations</h2>
            <p class="subtle">Internal maintenance actions use the token saved in Settings.</p>
          </div>
        </div>
        <div class="section-body settings-layout">
          <div class="panel">
            <h2>Schedulers and jobs</h2>
            <div class="summary-list">
              <div class="summary-row">
                <div>
                  <div class="summary-title">Notification queue</div>
                  <div class="summary-description">Run a bounded drain for queued notification jobs.</div>
                </div>
                <button id="drain" type="button">Drain jobs</button>
              </div>
              <div class="summary-row">
                <div>
                  <div class="summary-title">YouTube scheduler</div>
                  <div class="summary-description">Renew official upload webhook subscriptions.</div>
                </div>
                <button id="renew-youtube" type="button">Renew YouTube</button>
              </div>
              <div class="summary-row">
                <div>
                  <div class="summary-title">CHZZK live status</div>
                  <div class="summary-description">Poll current member live state through the internal adapter.</div>
                </div>
                <button id="poll-chzzk" type="button">Poll CHZZK</button>
              </div>
              <div class="summary-row">
                <div>
                  <div class="summary-title">Special day status</div>
                  <div class="summary-description">Recalculate derived calendar status for hub events.</div>
                </div>
                <button class="has-tooltip" data-tooltip="Recalculate special day calendar status." title="Recalculate special day calendar status." id="recalculate-special-days" type="button">Recalculate special days</button>
              </div>
            </div>
          </div>
          <div class="panel">
            <h2>Run state</h2>
            <table class="status-table">
              <tbody>
                <tr><td>Admin session</td><td>Required</td></tr>
                <tr><td>Internal bearer token</td><td>Settings only</td></tr>
                <tr><td>Secret exposure</td><td>Never shown</td></tr>
                <tr><td>Action result</td><td>Shown in console status</td></tr>
              </tbody>
            </table>
            <div class="security-item">
              <div class="settings-title">Credential boundary</div>
              <div class="settings-description">Operations reads the Settings token at request time. The token field is not duplicated on this page.</div>
            </div>
          </div>
        </div>
      </section>
      </section>

      <section class="page" id="page-audit" data-admin-page="audit">
      <section id="audit-section" class="section">
        <div class="section-head">
          <div>
            <h2>Audit</h2>
            <p class="subtle">Recent operator-facing results and hub event audit details.</p>
          </div>
        </div>
        <div class="section-body">
          <div class="panel" id="admin-audit-activity">
            <h2>Recent activity</h2>
            <div class="activity-list">
              <div class="activity-item">
                <div class="activity-title">Admin session</div>
                <div class="activity-description">Login and logout are handled by the existing admin session route.</div>
              </div>
              <div class="activity-item">
                <div class="activity-title">Hub event changes</div>
                <div class="activity-description">Validate, save draft, publish, cancel, deactivate, and delete results appear in the Hub events audit log after an event is selected.</div>
              </div>
              <div class="activity-item">
                <div class="activity-title">Adapter refresh</div>
                <div class="activity-description">Dashboard refresh updates adapter health, secrets, feature flags, queue, and delivery counters.</div>
              </div>
              <div class="activity-item">
                <div class="activity-title">Internal operations</div>
                <div class="activity-description">Scheduler and queue action results are reported in the console status without logging token values.</div>
              </div>
            </div>
          </div>
        </div>
      </section>
      </section>

      <section class="page" id="page-settings" data-admin-page="settings">
      <section id="settings-section" class="section">
        <div class="section-head">
          <div>
            <h2>Settings</h2>
            <p class="subtle">Console credentials, theme, refresh, and page-size preferences.</p>
          </div>
        </div>
        <div class="section-body settings-layout">
          <div class="settings-column">
          <div class="token-input-card panel">
            <div class="credential-head">
              <div>
                <h2>Internal API bearer token</h2>
                <p class="subtle">Used only for /v1/internal/* requests. It is stored in this browser session and is not saved on the server.</p>
              </div>
              <span class="credential-badge">session only</span>
            </div>
            <div class="field">
              <label class="has-tooltip" data-tooltip="Store the internal API bearer token in this browser session only." title="Store the internal API bearer token in this browser session only." for="internal-token">Internal API bearer token</label>
              <div class="credential-input-wrap">
                <span class="credential-icon" aria-hidden="true">lock</span>
                <input id="internal-token" type="password" autocomplete="off" spellcheck="false" placeholder="Required for /v1/internal/* requests">
                <span class="credential-input-badge">private</span>
              </div>
            </div>
            <div class="settings-actions">
              <button id="internal-token-save" type="button">Use token</button>
              <button id="internal-token-test" type="button">Test connection</button>
              <button id="internal-token-clear" type="button">Clear</button>
            </div>
            <p id="settings-token-status" class="message" aria-live="polite"></p>
          </div>
          <div class="panel">
            <h2>Security notes</h2>
            <div class="security-grid">
              <div class="security-item">
                <div class="settings-title">Admin session first</div>
                <div class="settings-description">The session opens the console. It does not replace internal API authorization.</div>
              </div>
              <div class="security-item">
                <div class="settings-title">Internal token later</div>
                <div class="settings-description">The bearer token is read from sessionStorage for /v1/internal/* calls only.</div>
              </div>
              <div class="security-item">
                <div class="settings-title">No bundled assets</div>
                <div class="settings-description">Uploads, base64, local paths, copied assets, logos, profile images, screenshots, and fan art are not accepted.</div>
              </div>
            </div>
          </div>
          </div>
          <div class="settings-column">
          <div class="panel">
            <h2>Console preferences</h2>
            <div class="settings-stack">
              <div class="settings-row">
                <div class="settings-title">Theme</div>
                <div class="settings-description">Choose the console color mode for this browser.</div>
                ${renderAdminThemeControl()}
              </div>
              <div class="settings-row">
                <div class="settings-title">Auto refresh</div>
                <label class="switch-control">
                  <span>Refresh Dashboard status</span>
                  <input id="auto-refresh" class="auto-refresh-input" type="checkbox">
                  <span class="auto-refresh-switch" aria-hidden="true"></span>
                </label>
                <span id="auto-refresh-status" class="auto-refresh-status pill disabled" aria-live="polite">Off</span>
              </div>
              <div class="settings-row">
                <div class="settings-title">Hub event page size</div>
                <div class="field">
                  <label for="hub-event-page-size">Events per page</label>
                  <select id="hub-event-page-size">
                    <option value="10">10</option>
                    <option value="15">15</option>
                    <option value="25">25</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          <div class="panel">
            <h2>Recommended routing</h2>
            <div class="security-grid">
              <div class="security-item">
                <div class="settings-title">Dashboard</div>
                <div class="settings-description">Use for health, uptime, queue, delivery, adapter, and configuration review.</div>
              </div>
              <div class="security-item">
                <div class="settings-title">Operations</div>
                <div class="settings-description">Use only after a Settings token is active for this browser session.</div>
              </div>
            </div>
          </div>
          </div>
        </div>
      </section>
      </section>
    </main>
  </div>
  ${renderAdminThemeBehaviorScript()}
  <script>
    const endpoints = {
      overview: "/v1/internal/admin/overview",
      drainJobs: "/v1/internal/jobs/notifications/drain",
      renewYoutube: "/v1/internal/schedulers/youtube/renew-subscriptions",
        pollChzzk: "/v1/internal/schedulers/chzzk/live-status",
        hubEvents: "/v1/admin/hub-events",
        recalculateSpecialDays: "/v1/admin/hub-events/special-days/recalculate-status"
      };

    const overviewRoot = document.getElementById("overview");
    const serviceOverviewSummaryRoot = document.getElementById("service-overview-summary");
    const serviceOverviewStatusRoot = document.getElementById("service-overview-status");
    const dashboardRecentActivityRoot = document.getElementById("dashboard-recent-activity");
    const adaptersRoot = document.getElementById("adapters");
    const secretsRoot = document.getElementById("secrets");
    const featureFlagsRoot = document.getElementById("feature-flags");
    const messageRoot = document.getElementById("message");
    const currentPageTitleRoot = document.getElementById("admin-current-page-title");
    const currentPageDescriptionRoot = document.getElementById("admin-current-page-description");
    const tokenInput = document.getElementById("internal-token");
    const autoRefreshInput = document.getElementById("auto-refresh");
    const autoRefreshStatusRoot = document.getElementById("auto-refresh-status");
    const logoutForm = document.querySelector(".logout-form");
    const buttons = Array.from(document.querySelectorAll("button"));
    const pageButtons = Array.from(document.querySelectorAll("[data-page-target]"));
    const pages = Array.from(document.querySelectorAll("[data-admin-page]"));
    const internalTokenSaveButton = document.getElementById("internal-token-save");
    const internalTokenTestButton = document.getElementById("internal-token-test");
    const internalTokenClearButton = document.getElementById("internal-token-clear");
    const settingsTokenStatusRoot = document.getElementById("settings-token-status");
    const internalTokenStorageKey = "stellive.admin.internalApiToken";
    const autoRefreshIntervalMs = 5000;
    let autoRefreshTimer = null;
    let refreshInFlight = false;
    let actionInFlight = false;
    let uptimeValueRoot = null;
    let uptimeBaseSeconds = null;
    let uptimeBaseTimestamp = 0;
    let uptimeTimerId = null;
    const pageCopy = {
      dashboard: ["Dashboard", "Admin session and internal token are separate."],
      "hub-events": ["Hub events", "Create, validate, publish, and review Hub events."],
      operations: ["Operations", "Run bounded internal maintenance actions."],
      audit: ["Audit", "Review operator-facing activity and event audit results."],
      settings: ["Settings", "Manage credentials and console preferences."]
    };

    function readStoredInternalToken() {
      try {
        return window.sessionStorage.getItem(internalTokenStorageKey) || "";
      } catch (_error) {
        return "";
      }
    }

    function persistInternalToken() {
      try {
        const token = tokenInput.value;
        if (token.trim()) {
          window.sessionStorage.setItem(internalTokenStorageKey, token);
        } else {
          window.sessionStorage.removeItem(internalTokenStorageKey);
        }
      } catch (_error) {
        // Some browser privacy modes can reject sessionStorage access.
      }
    }

    function clearStoredInternalToken() {
      try {
        window.sessionStorage.removeItem(internalTokenStorageKey);
      } catch (_error) {
        // Logout should continue even if browser storage is unavailable.
      }
    }

    const storedInternalToken = readStoredInternalToken();
    if (storedInternalToken) {
      tokenInput.value = storedInternalToken;
    }

    function setBusy(isBusy) {
      for (const button of buttons) {
        button.disabled = isBusy;
      }
    }

    function setMessage(text, isError) {
      messageRoot.textContent = text;
      messageRoot.className = isError ? "message error" : "message";
    }

    function setSettingsTokenStatus(text, isError) {
      settingsTokenStatusRoot.textContent = text;
      settingsTokenStatusRoot.className = isError ? "message error" : "message";
    }

    function setAutoRefreshStatus(text) {
      autoRefreshStatusRoot.textContent = text;
      autoRefreshStatusRoot.className = "auto-refresh-status pill " + (
        text === "Off" ? "disabled" : text === "Retrying" ? "verify-required" : "enabled"
      );
    }

    function setActivePage(pageName) {
      const nextPage = pageName || "dashboard";
      const copy = pageCopy[nextPage] || pageCopy.dashboard;
      currentPageTitleRoot.textContent = copy[0];
      currentPageDescriptionRoot.textContent = copy[1];
      if (!messageRoot.classList.contains("error")) {
        setMessage("", false);
      }
      pages.forEach(function (page) {
        page.classList.toggle("active", page.getAttribute("data-admin-page") === nextPage);
      });
      pageButtons.forEach(function (button) {
        const isCurrent = button.getAttribute("data-page-target") === nextPage;
        if (isCurrent) {
          button.setAttribute("aria-current", "page");
        } else {
          button.removeAttribute("aria-current");
        }
      });
    }

    function requireToken() {
      const token = (tokenInput?.value || "").trim() || readStoredInternalToken().trim();
      if (!token) {
        throw new Error("Internal API bearer token is required. Add it in Settings.");
      }
      return token;
    }

    function createPill(value) {
      const span = document.createElement("span");
      span.className = "pill " + String(value).replaceAll("_", "-");
      span.textContent = String(value);
      return span;
    }

    function createMetricRow(key, valueNode) {
      const row = document.createElement("div");
      row.className = "metric";

      const label = document.createElement("span");
      label.className = "metric-key";
      label.textContent = key;

      const value = document.createElement("div");
      value.className = "metric-value";
      if (valueNode instanceof Node) {
        value.appendChild(valueNode);
      } else {
        value.textContent = String(valueNode);
      }

      row.append(label, value);
      return row;
    }

    function createOverviewPanel(title, rows) {
      const section = document.createElement("section");
      section.className = "panel overview-card";

      const heading = document.createElement("h2");
      heading.textContent = title;
      section.appendChild(heading);

      for (const [key, value] of rows) {
        section.appendChild(createMetricRow(key, value));
      }

      return section;
    }

    function createActivityItem(title, description) {
      const item = document.createElement("div");
      item.className = "activity-item";
      const titleNode = document.createElement("div");
      titleNode.className = "activity-title";
      titleNode.textContent = title;
      const descriptionNode = document.createElement("div");
      descriptionNode.className = "activity-description";
      descriptionNode.textContent = description;
      item.append(titleNode, descriptionNode);
      return item;
    }

    function createSummaryRow(title, value, description) {
      const row = document.createElement("div");
      row.className = "summary-row";
      const text = document.createElement("div");
      const titleNode = document.createElement("div");
      titleNode.className = "summary-title";
      titleNode.textContent = title;
      const descriptionNode = document.createElement("div");
      descriptionNode.className = "summary-description";
      descriptionNode.textContent = description;
      const valueNode = document.createElement("strong");
      valueNode.textContent = value == null || value === "" ? "-" : String(value);
      text.append(titleNode, descriptionNode);
      row.append(text, valueNode);
      return row;
    }

    function countStates(values) {
      const entries = Object.values(values || {});
      if (entries.length === 0) return "No data";
      const configured = entries.filter(function (value) { return value === "configured"; }).length;
      const missing = entries.filter(function (value) { return value === "missing"; }).length;
      return configured + " configured / " + missing + " missing";
    }

    function summarizeAdapters(adapters) {
      const rows = Array.isArray(adapters) ? adapters : [];
      if (rows.length === 0) return "No diagnostics";
      const ready = rows.filter(function (adapter) { return adapter.status === "enabled" || adapter.status === "ready"; }).length;
      const disabled = rows.filter(function (adapter) { return adapter.status === "disabled"; }).length;
      return ready + " ready / " + disabled + " disabled / " + rows.length + " total";
    }

    function formatQueueState(queue) {
      const queued = queue && queue.queued != null ? queue.queued : 0;
      const locked = queue && queue.locked != null ? queue.locked : 0;
      const failed = queue && queue.failed != null ? queue.failed : 0;
      return queued + " queued / " + locked + " locked / " + failed + " failed";
    }

    function formatDeliveryState(recentDelivery) {
      const sent = recentDelivery && recentDelivery.sent != null ? recentDelivery.sent : 0;
      const skipped = recentDelivery && recentDelivery.skipped != null ? recentDelivery.skipped : 0;
      const failed = recentDelivery && recentDelivery.failed != null ? recentDelivery.failed : 0;
      return sent + " sent / " + skipped + " skipped / " + failed + " failed";
    }

    function formatUptime(seconds) {
      const totalSeconds = Math.floor(Number(seconds));
      if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
        return "-";
      }

      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const remainingSeconds = totalSeconds % 60;

      if (days > 0) {
        return hours > 0 ? days + "d " + hours + "h" : days + "d";
      }
      if (hours > 0) {
        return minutes > 0 ? hours + "h " + minutes + "m" : hours + "h";
      }
      if (minutes > 0) {
        return minutes + "m " + remainingSeconds + "s";
      }
      return remainingSeconds + "s";
    }

    function renderUptimeTick() {
      if (!uptimeValueRoot || uptimeBaseSeconds == null) {
        return;
      }

      const elapsedSeconds = Math.floor((Date.now() - uptimeBaseTimestamp) / 1000);
      uptimeValueRoot.textContent = formatUptime(uptimeBaseSeconds + elapsedSeconds);
    }

    function bindUptime(seconds) {
      const parsedSeconds = Math.floor(Number(seconds));
      if (!Number.isFinite(parsedSeconds) || parsedSeconds < 0) {
        uptimeBaseSeconds = null;
        uptimeBaseTimestamp = 0;
        if (uptimeValueRoot) {
          uptimeValueRoot.textContent = "-";
        }
        return;
      }

      uptimeBaseSeconds = parsedSeconds;
      uptimeBaseTimestamp = Date.now();
      renderUptimeTick();
      if (uptimeTimerId == null) {
        uptimeTimerId = window.setInterval(renderUptimeTick, 1000);
      }
    }

    function createUptimeNode(seconds) {
      const span = document.createElement("span");
      uptimeValueRoot = span;
      bindUptime(seconds);
      return span;
    }

    function renderOverview(data) {
      overviewRoot.replaceChildren(
        createOverviewPanel("Health", [
          ["status", createPill(data.database.status)],
          ["service", data.service.name]
        ]),
        createOverviewPanel("Database", [
          ["status", createPill(data.database.status)],
          ["reason", data.database.reason]
        ]),
        createOverviewPanel("Uptime", [
          ["service uptime", createUptimeNode(data.service.uptimeSeconds)]
        ]),
        createOverviewPanel("Queue", [
          ["queued", data.queue.queued == null ? "-" : String(data.queue.queued)],
          ["failed", data.queue.failed == null ? "-" : String(data.queue.failed)]
        ]),
        createOverviewPanel("Events", [
          ["sent", data.recentDelivery.sent == null ? "-" : String(data.recentDelivery.sent)],
          ["failed", data.recentDelivery.failed == null ? "-" : String(data.recentDelivery.failed)]
        ])
      );
      renderServiceOverview(data);
      renderDashboardRecentActivity(data);
    }

    function renderServiceOverview(data) {
      serviceOverviewSummaryRoot.replaceChildren(
        createSummaryRow("Service", data.service.name, "API process is responding."),
        createSummaryRow("Environment", data.service.environment, "Admin console session is active."),
        createSummaryRow("Uptime", formatUptime(data.service.uptimeSeconds), "Since latest service start."),
        createSummaryRow("Queue state", formatQueueState(data.queue), "Queued, locked, and failed jobs."),
        createSummaryRow("Delivery state", formatDeliveryState(data.recentDelivery), "Sent, skipped, and failed delivery counters.")
      );
      renderTableRows(
        serviceOverviewStatusRoot,
        [
          ["Database", createPill(data.database.status), data.database.reason || "-"],
          ["Uptime", formatUptime(data.service.uptimeSeconds), "Live tick shown above"],
          ["Secrets", countStates(data.secrets), "Configuration only, values hidden"],
          ["Push / delivery", formatDeliveryState(data.recentDelivery), "Recent delivery counters"],
          ["Adapter summary", summarizeAdapters(data.adapters), "Adapter diagnostics"]
        ],
        (row) => row,
        "No service overview available."
      );
    }

    function renderDashboardRecentActivity(data) {
      dashboardRecentActivityRoot.replaceChildren(
        createActivityItem("Overview refreshed", "Latest status loaded from the internal overview endpoint."),
        createActivityItem("Queue state", formatQueueState(data.queue)),
        createActivityItem("Delivery state", formatDeliveryState(data.recentDelivery)),
        createActivityItem("Adapter diagnostics", summarizeAdapters(data.adapters)),
        createActivityItem("Secrets readiness", countStates(data.secrets))
      );
    }

    function renderTableRows(root, rows, buildCells, emptyText) {
      root.replaceChildren();
      if (rows.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = buildCells([]).length || 1;
        cell.className = "empty";
        cell.textContent = emptyText;
        row.appendChild(cell);
        root.appendChild(row);
        return;
      }

      for (const item of rows) {
        const row = document.createElement("tr");
        for (const cellContent of buildCells(item)) {
          const cell = document.createElement("td");
          if (cellContent instanceof Node) {
            cell.appendChild(cellContent);
          } else {
            cell.textContent = String(cellContent);
          }
          row.appendChild(cell);
        }
        root.appendChild(row);
      }
    }

    function formatLastCheckedAt(value) {
      if (!value || value === "1970-01-01T00:00:00.000Z") {
        return "Not checked yet";
      }

      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return "-";
      }

      return date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "short"
      });
    }

    function renderAdapters(adapters) {
      renderTableRows(
        adaptersRoot,
        adapters,
        (adapter) => [adapter.source, createPill(adapter.status), adapter.reason, formatLastCheckedAt(adapter.lastCheckedAt)],
        "No adapter diagnostics available."
      );
    }

    function renderSecrets(secrets) {
      const rows = Object.entries(secrets).sort(([left], [right]) => left.localeCompare(right));
      renderTableRows(secretsRoot, rows, ([key, value]) => [key, createPill(value)], "No secrets evaluated.");
    }

    function renderFeatureFlags(featureFlags) {
      const rows = Object.entries(featureFlags).sort(([left], [right]) => left.localeCompare(right));
      renderTableRows(
        featureFlagsRoot,
        rows,
        ([key, value]) => [key, typeof value === "boolean" ? createPill(value ? "enabled" : "disabled") : String(value)],
        "No feature flags available."
      );
    }

    async function api(path, init) {
      const token = requireToken();
      const response = await fetch(path, {
        ...init,
        headers: {
          authorization: "Bearer " + token,
          "content-type": "application/json",
          ...(init && init.headers ? init.headers : {})
        }
      });
      const contentType = response.headers.get("content-type") || "";
      const payload = contentType.includes("application/json") ? await response.json() : await response.text();
      if (!response.ok) {
        const reason = payload && typeof payload === "object" && "error" in payload ? payload.error : "request_failed";
        throw new Error(String(reason));
      }
      return payload;
    }

    async function refreshDashboard(options) {
      const source = options && options.source === "auto" ? "auto" : "manual";
      if (actionInFlight) {
        if (source === "auto") {
          setAutoRefreshStatus("Paused while busy");
        }
        return;
      }
      if (refreshInFlight) {
        if (source === "auto") {
          setAutoRefreshStatus("Paused while busy");
        }
        return;
      }

      refreshInFlight = true;
      if (source === "manual") {
        setBusy(true);
        setMessage("Loading overview...", false);
      } else {
        setAutoRefreshStatus("Every 5s");
      }

      try {
        const overview = await api(endpoints.overview);
        renderOverview(overview);
        renderAdapters(overview.adapters || []);
        renderSecrets(overview.secrets || {});
        renderFeatureFlags(overview.featureFlags || {});
        if (source === "manual") {
          setMessage("Overview refreshed.", false);
        }
        if (autoRefreshInput.checked) {
          setAutoRefreshStatus("Every 5s");
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "unknown_error", true);
        if (source === "auto" && autoRefreshInput.checked) {
          setAutoRefreshStatus("Retrying");
        }
      } finally {
        refreshInFlight = false;
        setBusy(false);
      }
    }

    function startAutoRefresh() {
      if (autoRefreshTimer) {
        return;
      }
      setAutoRefreshStatus("Every 5s");
      autoRefreshTimer = window.setInterval(function () {
        refreshDashboard({ source: "auto" });
      }, autoRefreshIntervalMs);
    }

    function stopAutoRefresh() {
      if (autoRefreshTimer) {
        window.clearInterval(autoRefreshTimer);
        autoRefreshTimer = null;
      }
      setAutoRefreshStatus("Off");
    }

    async function runAction(label, path, init) {
      actionInFlight = true;
      setBusy(true);
      setMessage(label + " in progress...", false);
      try {
        const result = await api(path, init);
        const status = result && typeof result === "object" && "status" in result ? result.status : "ok";
        setMessage(label + " completed (" + status + ").", false);
        actionInFlight = false;
        await refreshDashboard({ source: "manual" });
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "unknown_error", true);
      } finally {
        actionInFlight = false;
        setBusy(false);
      }
    }

    const hubEventFields = {
      id: document.getElementById("hub-event-id"),
      title: document.getElementById("hub-event-title"),
      summary: document.getElementById("hub-event-summary"),
      category: document.getElementById("hub-event-category"),
      participationMode: document.getElementById("hub-event-participation-mode"),
      status: document.getElementById("hub-event-status"),
      generationId: document.getElementById("hub-event-generation"),
      memberId: document.getElementById("hub-event-member"),
      sourceUrl: document.getElementById("hub-event-source-url"),
      sourceLabel: document.getElementById("hub-event-source-label"),
      sourceType: document.getElementById("hub-event-source-type"),
      imagePolicyState: document.getElementById("hub-event-image-policy-state"),
      imageUrl: document.getElementById("hub-event-image-url"),
      imageSourceLabel: document.getElementById("hub-event-image-source-label"),
      imageSourceUrl: document.getElementById("hub-event-image-source-url"),
      announcedAt: document.getElementById("hub-event-announced-at"),
      startsAt: document.getElementById("hub-event-starts-at"),
      endsAt: document.getElementById("hub-event-ends-at"),
      purchaseUrl: document.getElementById("hub-event-purchase-url"),
      ticketUrl: document.getElementById("hub-event-ticket-url"),
      venueName: document.getElementById("hub-event-venue-name"),
      venueAddress: document.getElementById("hub-event-venue-address"),
      notificationEligible: document.getElementById("hub-event-notification-eligible")
    };
    const hubEventListRoot = document.getElementById("hub-event-list");
    const hubEventValidationRoot = document.getElementById("hub-event-validation");
    const hubEventAuditRoot = document.getElementById("hub-event-audit-log");
    const hubEventStateFilter = document.getElementById("hub-event-state-filter");
    const hubEventStatusFilter = document.getElementById("hub-event-status-filter");
    const hubEventCategoryFilter = document.getElementById("hub-event-category-filter");
    const hubEventParticipationModeFilter = document.getElementById("hub-event-participation-mode-filter");
    const hubEventGenerationFilter = document.getElementById("hub-event-generation-filter");
    const hubEventMemberFilter = document.getElementById("hub-event-member-filter");
    const hubEventIncludeDeleted = document.getElementById("hub-event-include-deleted");
    const hubEventSearch = document.getElementById("hub-event-search");
    const hubEventPaginationStatus = document.getElementById("hub-event-pagination-status");
    const hubEventPrevPage = document.getElementById("hub-event-prev-page");
    const hubEventNextPage = document.getElementById("hub-event-next-page");
    const hubEventPageSize = document.getElementById("hub-event-page-size");
    const hubEventPageState = {
      currentCursor: "",
      previousCursors: [],
      nextCursor: "",
      page: 1
    };
    let hubEventSearchTimer = 0;
    let selectedHubEventId = "";

    function getHubEventPageLimit() {
      const parsed = Number.parseInt(hubEventPageSize?.value || "10", 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
    }

    function toIsoFromLocal(value) {
      if (!value) return undefined;
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
    }

    function toLocalDateTime(value) {
      if (!value) return "";
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return "";
      return new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    }

    function setSelectedHubEventId(id) {
      selectedHubEventId = id || "";
      hubEventListRoot.querySelectorAll('input[data-hub-event-select="true"]').forEach(function (checkbox) {
        checkbox.checked = checkbox.getAttribute("data-hub-event-id") === selectedHubEventId;
      });
      hubEventListRoot.querySelectorAll(".event-row").forEach(function (row) {
        row.classList.toggle("active", row.getAttribute("data-hub-event-id") === selectedHubEventId);
      });
    }

    function collectHubEventInput() {
      const input = {};
      Object.entries(hubEventFields).forEach(function ([key, element]) {
        if (!element || key === "id") return;
        if (["imagePolicyState", "imageUrl", "imageSourceLabel", "imageSourceUrl"].includes(key)) return;
        if (key === "notificationEligible") {
          input[key] = element.checked;
          return;
        }
      if (["announcedAt", "startsAt", "endsAt"].includes(key)) {
        const iso = toIsoFromLocal(element.value);
        input[key] = iso || null;
        return;
      }
        const value = element.value.trim();
        if (value) input[key] = value;
      });
      const imagePolicyState = hubEventFields.imagePolicyState.value;
      const imageUrl = hubEventFields.imageUrl.value.trim();
      const imageSourceLabel = hubEventFields.imageSourceLabel.value.trim();
      const imageSourceUrl = hubEventFields.imageSourceUrl.value.trim();
      const hasImageMetadata = Boolean(imageUrl || imageSourceLabel || imageSourceUrl);
      if (imagePolicyState === "none") {
        if (hasImageMetadata) {
          throw new Error("image_policy_state_none_with_metadata");
        }
        input.image = null;
      } else {
        const image = { policyState: imagePolicyState };
        if (imageUrl) image.url = imageUrl;
        if (imageSourceLabel) image.sourceLabel = imageSourceLabel;
        if (imageSourceUrl) image.sourceUrl = imageSourceUrl;
        input.image = image;
      }
      return input;
    }

    async function adminApi(path, init) {
      const headers = init && init.body ? { "content-type": "application/json" } : undefined;
      const response = await fetch(path, {
        credentials: "same-origin",
        headers: headers,
        ...init
      });
      const contentType = response.headers.get("content-type") || "";
      const payload = contentType.includes("application/json") ? await response.json() : await response.text();
      if (!response.ok) {
        const reason = payload && typeof payload === "object" && "error" in payload ? payload.error : "request_failed";
        throw new Error(String(reason));
      }
      return payload;
    }

    function renderHubEventValidation(result) {
      const errors = result && result.errors ? result.errors : [];
      hubEventValidationRoot.replaceChildren();
      if (errors.length === 0) {
        const item = document.createElement("li");
        item.textContent = result && result.valid === false ? "Validation failed." : "No validation errors.";
        hubEventValidationRoot.appendChild(item);
        return;
      }
      errors.forEach(function (error) {
        const item = document.createElement("li");
        item.textContent = [error.field, error.reason, error.message].filter(Boolean).join(" - ");
        hubEventValidationRoot.appendChild(item);
      });
    }

    function bindHubEventForm(event) {
      hubEventFields.id.value = event.id || "";
      hubEventFields.title.value = event.title || "";
      hubEventFields.summary.value = event.summary || "";
      hubEventFields.category.value = event.category || "online_goods";
      hubEventFields.participationMode.value = event.participationMode || "online";
      hubEventFields.status.value = event.status || "announced";
      hubEventFields.generationId.value = event.generationId || "official";
      hubEventFields.memberId.value = event.memberId || "";
      hubEventFields.sourceUrl.value = event.sourceUrl || "";
      hubEventFields.sourceLabel.value = event.sourceLabel || "";
      hubEventFields.sourceType.value = event.sourceType || "official";
      hubEventFields.imagePolicyState.value = event.image?.policyState || "none";
      hubEventFields.imageUrl.value = event.image?.url || "";
      hubEventFields.imageSourceLabel.value = event.image?.sourceLabel || "";
      hubEventFields.imageSourceUrl.value = event.image?.sourceUrl || "";
      hubEventFields.announcedAt.value = toLocalDateTime(event.announcedAt);
      hubEventFields.startsAt.value = toLocalDateTime(event.startsAt);
      hubEventFields.endsAt.value = toLocalDateTime(event.endsAt);
      hubEventFields.purchaseUrl.value = event.purchaseUrl || "";
      hubEventFields.ticketUrl.value = event.ticketUrl || "";
      hubEventFields.venueName.value = event.venueName || "";
      hubEventFields.venueAddress.value = event.venueAddress || "";
      hubEventFields.notificationEligible.checked = event.notificationEligible !== false;
    }

    function renderHubEvents(events) {
      hubEventListRoot.replaceChildren();
      if (!events.length) {
        const empty = document.createElement("div");
        empty.className = "empty event-row";
        empty.textContent = "No hub events found.";
        hubEventListRoot.appendChild(empty);
        return;
      }
      events.forEach(function (event) {
        const row = document.createElement("div");
        row.className = "event-row";
        row.dataset.hubEventId = event.id;
        row.setAttribute("role", "button");
        row.tabIndex = 0;
        if (event.id === selectedHubEventId) {
          row.classList.add("active");
        }

        const main = document.createElement("div");
        main.className = "event-row-main";
        const title = document.createElement("div");
        title.className = "event-title";
        title.textContent = event.title || "Untitled event";
        const state = createPill(event.publicationState || "draft");
        state.classList.add("status");
        main.appendChild(title);
        main.appendChild(state);

        const meta = document.createElement("div");
        meta.className = "event-meta";
        meta.textContent = [
          event.category,
          event.generationId,
          event.memberId,
          event.status
        ].filter(Boolean).join(" / ") || "-";

        const updated = document.createElement("div");
        updated.className = "event-updated";
        updated.textContent = "Updated " + (formatLastCheckedAt(event.updatedAt) || "-");

        const select = document.createElement("input");
        select.type = "checkbox";
        select.dataset.hubEventSelect = "true";
        select.dataset.hubEventId = event.id;
        select.checked = event.id === selectedHubEventId;
        select.setAttribute("aria-label", "Select " + (event.title || "hub event"));
        select.addEventListener("click", function (clickEvent) {
          clickEvent.stopPropagation();
        });
        select.addEventListener("change", function () {
          if (select.checked) {
            setSelectedHubEventId(event.id);
            bindHubEventForm(event);
            loadHubEventAuditLog(event.id);
            return;
          }
          if (selectedHubEventId === event.id) {
            setSelectedHubEventId("");
          }
        });
        row.appendChild(main);
        row.appendChild(meta);
        row.appendChild(updated);
        row.appendChild(select);
        row.addEventListener("click", function () {
          setSelectedHubEventId(event.id);
          bindHubEventForm(event);
          loadHubEventAuditLog(event.id);
        });
        row.addEventListener("keydown", function (keyboardEvent) {
          if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
            keyboardEvent.preventDefault();
            setSelectedHubEventId(event.id);
            bindHubEventForm(event);
            loadHubEventAuditLog(event.id);
          }
        });
        hubEventListRoot.appendChild(row);
      });
    }

    function renderHubEventPagination(events) {
      const count = Array.isArray(events) ? events.length : 0;
      hubEventPaginationStatus.textContent = "Page " + hubEventPageState.page + " / " + count + " shown";
      hubEventPrevPage.disabled = hubEventPageState.previousCursors.length === 0;
      hubEventNextPage.disabled = !hubEventPageState.nextCursor;
    }

    async function refreshHubEvents(options) {
      const settings = options || {};
      if (settings.resetPage) {
        hubEventPageState.currentCursor = "";
        hubEventPageState.previousCursors = [];
        hubEventPageState.nextCursor = "";
        hubEventPageState.page = 1;
      }
      const cursor = typeof settings.cursor === "string" ? settings.cursor : hubEventPageState.currentCursor;
      const params = new URLSearchParams();
      params.set("limit", String(getHubEventPageLimit()));
      if (cursor) params.set("cursor", cursor);
      if (hubEventStateFilter.value) params.set("publicationState", hubEventStateFilter.value);
      if (hubEventStatusFilter.value) params.set("status", hubEventStatusFilter.value);
      if (hubEventCategoryFilter.value) params.set("category", hubEventCategoryFilter.value);
      if (hubEventParticipationModeFilter.value) params.set("participationMode", hubEventParticipationModeFilter.value);
      if (hubEventGenerationFilter.value.trim()) params.set("generationId", hubEventGenerationFilter.value.trim());
      if (hubEventMemberFilter.value.trim()) params.set("memberId", hubEventMemberFilter.value.trim());
      if (hubEventIncludeDeleted.checked) params.set("includeDeleted", "true");
      if (hubEventSearch.value.trim()) params.set("query", hubEventSearch.value.trim());
      const path = endpoints.hubEvents + (params.toString() ? "?" + params.toString() : "");
      const result = await adminApi(path);
      const items = result.items || [];
      hubEventPageState.currentCursor = cursor || "";
      hubEventPageState.nextCursor = result.nextCursor || "";
      renderHubEvents(items);
      renderHubEventPagination(items);
    }

    async function nextHubEventPage() {
      if (!hubEventPageState.nextCursor) return;
      hubEventPageState.previousCursors.push(hubEventPageState.currentCursor);
      hubEventPageState.page += 1;
      await refreshHubEvents({ cursor: hubEventPageState.nextCursor });
    }

    async function previousHubEventPage() {
      if (hubEventPageState.previousCursors.length === 0) return;
      const cursor = hubEventPageState.previousCursors.pop() || "";
      hubEventPageState.page = Math.max(1, hubEventPageState.page - 1);
      await refreshHubEvents({ cursor });
    }

    async function validateHubEvent(mode) {
      const result = await adminApi(endpoints.hubEvents + "/validate", {
        method: "POST",
        body: JSON.stringify(collectHubEventInput())
      });
      renderHubEventValidation(result);
      return result;
    }

    async function saveHubEventDraft() {
      const id = selectedHubEventId || hubEventFields.id.value;
      const input = collectHubEventInput();
      const result = id
        ? await adminApi(endpoints.hubEvents + "/" + encodeURIComponent(id), { method: "PUT", body: JSON.stringify(input) })
        : await adminApi(endpoints.hubEvents, { method: "POST", body: JSON.stringify(input) });
      bindHubEventForm(result);
      await refreshHubEvents();
    }

    async function runHubEventAction(action) {
      const id = selectedHubEventId || hubEventFields.id.value;
      if (!id) throw new Error("hub_event_required");
      await adminApi(endpoints.hubEvents + "/" + encodeURIComponent(id) + "/" + action, { method: "POST" });
      await refreshHubEvents();
      await loadHubEventAuditLog(id);
    }

    async function deleteHubEvent() {
      const id = selectedHubEventId || hubEventFields.id.value;
      if (!id) throw new Error("hub_event_required");
      await adminApi(endpoints.hubEvents + "/" + encodeURIComponent(id), { method: "DELETE" });
      setSelectedHubEventId("");
      hubEventFields.id.value = "";
      await refreshHubEvents();
    }

    async function loadHubEventAuditLog(id) {
      const result = await adminApi(endpoints.hubEvents + "/" + encodeURIComponent(id) + "/audit-log");
      hubEventAuditRoot.replaceChildren();
      (result.items || []).forEach(function (entry) {
        const item = document.createElement("li");
        item.textContent = [formatLastCheckedAt(entry.createdAt), entry.action, entry.actorId || "unknown"].join(" - ");
        hubEventAuditRoot.appendChild(item);
      });
    }

    async function runHubEventUiAction(label, action) {
      try {
        setBusy(true);
        await action();
        setMessage(label + " completed.", false);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "unknown_error", true);
      } finally {
        setBusy(false);
      }
    }

    document.getElementById("hub-event-refresh").addEventListener("click", function () {
      return runHubEventUiAction("Refresh hub events", function () { return refreshHubEvents({ resetPage: true }); });
    });
    hubEventPrevPage.addEventListener("click", function () {
      return runHubEventUiAction("Previous hub events page", previousHubEventPage);
    });
    hubEventNextPage.addEventListener("click", function () {
      return runHubEventUiAction("Next hub events page", nextHubEventPage);
    });
    hubEventStateFilter.addEventListener("change", function () {
      return runHubEventUiAction("Filter hub events", function () { return refreshHubEvents({ resetPage: true }); });
    });
    hubEventStatusFilter.addEventListener("change", function () {
      return runHubEventUiAction("Filter hub events", function () { return refreshHubEvents({ resetPage: true }); });
    });
    [hubEventCategoryFilter, hubEventParticipationModeFilter, hubEventIncludeDeleted, hubEventPageSize].forEach(function (filter) {
      filter.addEventListener("change", function () {
        return runHubEventUiAction("Filter hub events", function () { return refreshHubEvents({ resetPage: true }); });
      });
    });
    [hubEventGenerationFilter, hubEventMemberFilter].forEach(function (filter) {
      filter.addEventListener("input", function () {
        window.clearTimeout(hubEventSearchTimer);
        hubEventSearchTimer = window.setTimeout(function () {
          runHubEventUiAction("Filter hub events", function () { return refreshHubEvents({ resetPage: true }); });
        }, 250);
      });
    });
    hubEventSearch.addEventListener("input", function () {
      window.clearTimeout(hubEventSearchTimer);
      hubEventSearchTimer = window.setTimeout(function () {
        runHubEventUiAction("Search hub events", function () { return refreshHubEvents({ resetPage: true }); });
      }, 250);
    });
    document.getElementById("hub-event-validate").addEventListener("click", function () { return runHubEventUiAction("Validate hub event", function () { return validateHubEvent("publish"); }); });
    document.getElementById("hub-event-save-draft").addEventListener("click", function () { return runHubEventUiAction("Save hub event", saveHubEventDraft); });
    document.getElementById("hub-event-publish").addEventListener("click", function () { return runHubEventUiAction("Publish hub event", function () { return runHubEventAction("publish"); }); });
    document.getElementById("hub-event-cancel").addEventListener("click", function () { return runHubEventUiAction("Cancel hub event", function () { return runHubEventAction("cancel"); }); });
    document.getElementById("hub-event-deactivate").addEventListener("click", function () { return runHubEventUiAction("Deactivate hub event", function () { return runHubEventAction("deactivate"); }); });
    document.getElementById("hub-event-delete").addEventListener("click", function () { return runHubEventUiAction("Delete hub event", deleteHubEvent); });
    document.querySelectorAll("[data-mobile-hub-event-action]").forEach(function (button) {
      button.addEventListener("click", function () {
        const action = button.getAttribute("data-mobile-hub-event-action");
        if (action === "validate") {
          return runHubEventUiAction("Validate hub event", function () { return validateHubEvent("publish"); });
        }
        if (action === "save-draft") {
          return runHubEventUiAction("Save hub event", saveHubEventDraft);
        }
        if (action === "delete") {
          return runHubEventUiAction("Delete hub event", deleteHubEvent);
        }
      });
    });

    document.getElementById("refresh").addEventListener("click", function () {
      return refreshDashboard({ source: "manual" });
    });
    document.getElementById("drain").addEventListener("click", function () {
      return runAction("Drain jobs", endpoints.drainJobs, {
        method: "POST",
        body: JSON.stringify({ limit: 25 })
      });
    });
    document.getElementById("renew-youtube").addEventListener("click", function () {
      return runAction("Renew YouTube", endpoints.renewYoutube, { method: "POST" });
    });
    document.getElementById("poll-chzzk").addEventListener("click", function () {
      return runAction("Poll CHZZK", endpoints.pollChzzk, { method: "POST" });
    });
    document.getElementById("recalculate-special-days").addEventListener("click", function () {
      return runHubEventUiAction("Recalculate special days", function () {
        return adminApi(endpoints.recalculateSpecialDays, { method: "POST" });
      });
    });
    pageButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        setActivePage(button.getAttribute("data-page-target"));
      });
    });
    internalTokenSaveButton.addEventListener("click", function () {
      persistInternalToken();
      setSettingsTokenStatus(tokenInput.value.trim() ? "Token stored for this session." : "Token cleared.", false);
    });
    internalTokenTestButton.addEventListener("click", function () {
      return refreshDashboard({ source: "manual" });
    });
    internalTokenClearButton.addEventListener("click", function () {
      tokenInput.value = "";
      clearStoredInternalToken();
      setSettingsTokenStatus("Token cleared.", false);
    });
    autoRefreshInput.addEventListener("change", function () {
      if (autoRefreshInput.checked) {
        startAutoRefresh();
        refreshDashboard({ source: "auto" });
        return;
      }
      stopAutoRefresh();
    });
    window.addEventListener("beforeunload", stopAutoRefresh);
    tokenInput.addEventListener("input", persistInternalToken);
    if (logoutForm) {
      logoutForm.addEventListener("submit", clearStoredInternalToken);
    }
  </script>
</body>
</html>`;
}
