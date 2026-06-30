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
        linear-gradient(180deg, rgba(18, 21, 18, 0.98), var(--admin-bg)),
        repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.025) 0 1px, transparent 1px 80px);
      color: var(--admin-text);
    }
    .admin-app {
      min-height: 100vh;
      display: grid;
      grid-template-columns: 236px minmax(0, 1fr);
    }
    .admin-nav {
      position: sticky;
      top: 0;
      height: 100vh;
      padding: 18px 14px;
      border-right: 1px solid var(--admin-border);
      background: color-mix(in srgb, var(--admin-surface) 92%, black);
    }
    .admin-nav-title {
      margin: 0 0 18px;
      font-size: 16px;
      font-weight: 800;
    }
    .admin-nav a {
      display: block;
      padding: 9px 10px;
      border-radius: 7px;
      color: var(--admin-muted);
      font-size: 13px;
      font-weight: 700;
      text-decoration: none;
    }
    .admin-nav a:hover,
    .admin-nav a:focus-visible {
      background: var(--admin-surface-hover);
      color: var(--admin-text);
      outline: 0;
    }
    .admin-content {
      min-width: 0;
      padding: 20px;
    }
    .admin-topbar {
      position: sticky;
      top: 0;
      z-index: 10;
      display: grid;
      grid-template-columns: minmax(260px, 1fr) auto auto;
      gap: 10px;
      align-items: end;
      margin: -20px -20px 18px;
      padding: 14px 20px;
      border-bottom: 1px solid var(--admin-border);
      background: color-mix(in srgb, var(--admin-surface) 96%, black);
    }
    .topbar-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: 8px;
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
      border-radius: 8px;
      background: color-mix(in srgb, var(--admin-surface) 96%, black);
      min-width: 0;
      overflow: hidden;
    }
    .section + .section {
      margin-top: 14px;
    }
    .section-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 13px 14px;
      border-bottom: 1px solid var(--admin-border);
      background: color-mix(in srgb, var(--admin-surface) 92%, black);
    }
    .section-head h2 {
      margin-bottom: 0;
    }
    .section-body {
      padding: 14px;
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
      grid-template-columns: minmax(300px, 380px) minmax(0, 1fr);
      gap: 14px;
      align-items: start;
    }
    .event-list {
      display: grid;
      gap: 8px;
      max-height: calc(100vh - 250px);
      overflow: auto;
    }
    .event-row {
      width: 100%;
      display: grid;
      gap: 6px;
      padding: 11px;
      border: 1px solid var(--admin-soft-border);
      border-radius: 8px;
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
      border-radius: 8px;
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
      gap: 12px;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    }
    .panel {
      border: 1px solid var(--admin-border);
      border-radius: 8px;
      background: var(--admin-surface);
      padding: 14px;
      min-width: 0;
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
      border-radius: 6px;
      padding: 8px 10px;
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
      border-radius: 6px;
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
      border-radius: 6px;
      background: var(--admin-surface);
      color: var(--admin-text);
      padding: 8px 10px;
      font: inherit;
      font-size: 13px;
      cursor: pointer;
      min-height: 36px;
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
      min-height: 18px;
      font-size: 13px;
      color: var(--admin-muted);
    }
    .message.error {
      color: var(--admin-danger);
    }
    .metric {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
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
      text-align: right;
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
      border-radius: 8px;
      background: color-mix(in srgb, var(--admin-surface) 94%, black);
    }

    .hub-events-sidebar {
      overflow: hidden;
      grid-row: 2;
    }

    .hub-event-editor-panel {
      grid-row: 1;
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
      gap: 11px;
      padding: 12px;
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
      .admin-nav-title {
        flex: 0 0 auto;
        margin: 0 10px 0 0;
      }
      .admin-nav a {
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
      .hub-events-workspace,
      .hub-events-editor-grid,
      .hub-events-footer {
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
      <div class="admin-nav-title">Stellive Hub Admin</div>
      <a href="#overview-section">Overview</a>
      <a href="#hub-events-section">Hub events</a>
      <a href="#operations-section">Operations</a>
      <a href="#adapters-section">Adapters</a>
    </nav>
    <main class="admin-content stack">
      <div class="admin-topbar">
        <div class="field">
            <label class="has-tooltip" data-tooltip="Store the internal API bearer token in this browser only." title="Store the internal API bearer token in this browser only." for="internal-token">Internal API bearer token</label>
          <input id="internal-token" type="password" autocomplete="off" spellcheck="false" placeholder="Required for /v1/internal/* requests">
        </div>
        <div class="refresh-controls">
              <button class="has-tooltip" data-tooltip="Refresh adapter, secret, feature flag, and job status." title="Refresh adapter, secret, feature flag, and job status." id="refresh" type="button">Refresh</button>
          <label class="switch-control">
            <span>Auto refresh</span>
            <input id="auto-refresh" class="auto-refresh-input" type="checkbox">
            <span class="auto-refresh-switch" aria-hidden="true"></span>
          </label>
          <span id="auto-refresh-status" class="auto-refresh-status pill disabled" aria-live="polite">Off</span>
        </div>
        <div class="topbar-actions">
          ${renderAdminThemeControl()}
          <form class="logout-form" method="post" action="/admin/logout">
            <button class="logout-button" type="submit">Log out</button>
          </form>
        </div>
      </div>

      <div class="admin-page-head">
        <div>
          <h1>Stellive Hub Admin</h1>
          <p class="subtle">Internal diagnostics and bounded maintenance actions.</p>
        </div>
        <div id="message" class="message">Enter the internal API token, then refresh.</div>
      </div>

      <section id="overview-section" class="section">
        <div class="section-head">
          <h2>Overview</h2>
        </div>
        <div class="section-body">
          <section id="overview" class="grid" aria-live="polite"></section>
        </div>
      </section>

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
              <div class="field">
                <label for="hub-event-search">Search</label>
                <input id="hub-event-search" type="search" autocomplete="off" spellcheck="false">
              </div>
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
        </div>
        <div class="bottom-actions" aria-label="Hub event mobile actions">
          <button type="button" data-mobile-hub-event-action="validate">Validate</button>
          <button type="button" data-mobile-hub-event-action="save-draft">Save draft</button>
          <button type="button" data-mobile-hub-event-action="delete">Delete</button>
        </div>
        </div>
      </section>

      <section id="operations-section" class="section">
        <div class="section-head">
          <h2>Operations</h2>
        </div>
        <div class="section-body split">
          <div class="panel">
            <h2>Schedulers and jobs</h2>
            <div class="action-controls">
              <button id="drain" type="button">Drain jobs</button>
              <button id="renew-youtube" type="button">Renew YouTube</button>
              <button id="poll-chzzk" type="button">Poll CHZZK</button>
              <button class="has-tooltip" data-tooltip="Recalculate special day calendar status." title="Recalculate special day calendar status." id="recalculate-special-days" type="button">Recalculate special days</button>
            </div>
          </div>
          <div class="panel">
            <h2>Run state</h2>
            <p class="subtle">Actions use the active admin session and do not expose stored server secrets.</p>
          </div>
        </div>
      </section>

      <section id="adapters-section" class="section">
        <div class="section-head">
          <h2>Adapters</h2>
        </div>
        <div class="section-body split">
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
            <h2>Secrets and feature flags</h2>
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
    const adaptersRoot = document.getElementById("adapters");
    const secretsRoot = document.getElementById("secrets");
    const featureFlagsRoot = document.getElementById("feature-flags");
    const messageRoot = document.getElementById("message");
    const tokenInput = document.getElementById("internal-token");
    const autoRefreshInput = document.getElementById("auto-refresh");
    const autoRefreshStatusRoot = document.getElementById("auto-refresh-status");
    const logoutForm = document.querySelector(".logout-form");
    const buttons = Array.from(document.querySelectorAll("button"));
    const internalTokenStorageKey = "stellive.admin.internalApiToken";
    const autoRefreshIntervalMs = 5000;
    let autoRefreshTimer = null;
    let refreshInFlight = false;
    let actionInFlight = false;
    let uptimeValueRoot = null;
    let uptimeBaseSeconds = null;
    let uptimeBaseTimestamp = 0;
    let uptimeTimerId = null;

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

    function setAutoRefreshStatus(text) {
      autoRefreshStatusRoot.textContent = text;
      autoRefreshStatusRoot.className = "auto-refresh-status pill " + (
        text === "Off" ? "disabled" : text === "Retrying" ? "verify-required" : "enabled"
      );
    }

    function requireToken() {
      const token = tokenInput.value.trim();
      if (!token) {
        throw new Error("internal_api_token_required");
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
      section.className = "panel";

      const heading = document.createElement("h2");
      heading.textContent = title;
      section.appendChild(heading);

      for (const [key, value] of rows) {
        section.appendChild(createMetricRow(key, value));
      }

      return section;
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
        createOverviewPanel("Service", [
          ["name", data.service.name],
          ["environment", data.service.environment],
          ["uptime", createUptimeNode(data.service.uptimeSeconds)]
        ]),
        createOverviewPanel("Database", [
          ["status", createPill(data.database.status)],
          ["reason", data.database.reason]
        ]),
        createOverviewPanel("Queue", Object.entries(data.queue).map(([key, value]) => [key, value == null ? "-" : String(value)])),
        createOverviewPanel(
          "Recent delivery",
          Object.entries(data.recentDelivery).map(([key, value]) => [key, String(value)])
        )
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
    const hubEventSearch = document.getElementById("hub-event-search");
    const hubEventPaginationStatus = document.getElementById("hub-event-pagination-status");
    const hubEventPrevPage = document.getElementById("hub-event-prev-page");
    const hubEventNextPage = document.getElementById("hub-event-next-page");
    const hubEventPageLimit = 10;
    const hubEventPageState = {
      currentCursor: "",
      previousCursors: [],
      nextCursor: "",
      page: 1
    };
    let hubEventSearchTimer = 0;
    let selectedHubEventId = "";

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
      params.set("limit", String(hubEventPageLimit));
      if (cursor) params.set("cursor", cursor);
      if (hubEventStateFilter.value) params.set("publicationState", hubEventStateFilter.value);
      if (hubEventStatusFilter.value) params.set("status", hubEventStatusFilter.value);
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
