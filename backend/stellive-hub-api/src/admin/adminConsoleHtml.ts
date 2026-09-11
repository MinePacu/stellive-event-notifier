import {
  renderAdminThemeBehaviorScript,
  renderAdminThemeControl,
  renderAdminThemeInitScript,
  renderAdminThemeStyle
} from "./adminThemeHtml.js";
import { localizeAdminDocument, serializeAdminCatalog, t, translateAdmin, type AdminLocale } from "./adminI18n.js";
import { renderAdminLanguageHtml } from "./adminLanguageHtml.js";
import { adminIntlLocale } from "./adminLocale.js";

export function renderAdminConsoleHtml(locale: AdminLocale = "en"): string {
  const themeLabels = {
    label: translateAdmin(locale, "theme.label"),
    light: translateAdmin(locale, "theme.light"),
    system: translateAdmin(locale, "theme.system"),
    dark: translateAdmin(locale, "theme.dark"),
    black: translateAdmin(locale, "theme.black")
  };
  return localizeAdminDocument(`<!doctype html>
<html lang="${locale}">
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
    .admin-topbar,
    .topbar {
      position: static;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 16px;
      align-items: center;
      margin: 0 0 18px;
      padding: 0;
      border-bottom: 0;
      background: transparent;
    }
    .admin-topbar,
    .admin-page-head,
    .page {
      width: min(100%, 1280px);
      margin-left: auto;
      margin-right: auto;
    }
    .admin-tabs,
    .tabs {
      display: flex;
      align-items: center;
      gap: 16px;
      min-width: 0;
      overflow-x: auto;
      padding: 3px 0;
    }
    .admin-tabs button,
    .tabs button {
      flex: 0 0 auto;
      min-height: 34px;
      border: 0;
      border-bottom: 2px solid transparent;
      border-radius: 0;
      padding: 8px 2px;
      background: transparent;
      box-shadow: none;
      color: var(--admin-muted);
      font-size: 12px;
      font-weight: 780;
    }
    .admin-tabs button:hover,
    .admin-tabs button:focus-visible,
    .tabs button:hover,
    .tabs button:focus-visible {
      background: transparent;
      color: var(--admin-text);
    }
    .admin-tabs button[aria-current="page"],
    .tabs button[aria-current="page"] {
      border-bottom-color: var(--admin-primary);
      color: var(--admin-primary);
    }
    .page {
      display: none;
      min-height: 0;
    }
    .page.active {
      display: block;
    }
    .topbar-actions,
    .top-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      flex-wrap: nowrap;
      gap: 12px;
    }
    .language-control {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .language-control a {
      border-radius: 7px;
      padding: 5px 7px;
      color: var(--admin-muted);
      font-size: 12px;
      font-weight: 700;
      text-decoration: none;
    }
    .language-control a[aria-current="page"] {
      background: var(--admin-surface-hover);
      color: var(--admin-text);
    }
    .icon-button {
      display: grid;
      place-items: center;
      width: 38px;
      min-height: 38px;
      padding: 0;
      border: 1px solid var(--admin-border);
      border-radius: 14px;
      background: var(--admin-surface);
      color: var(--admin-primary);
      box-shadow: none;
      font: inherit;
      font-size: 16px;
      font-weight: 800;
      cursor: pointer;
    }
    .icon-button:hover,
    .icon-button:focus-visible {
      background: var(--admin-surface-hover);
      outline: 0;
    }
    .profile {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 180px;
      padding: 7px 10px;
      border: 1px solid var(--admin-border);
      border-radius: 17px;
      background: var(--admin-surface);
      color: var(--admin-text);
      box-shadow: none;
      text-align: left;
      cursor: pointer;
    }
    .profile:hover,
    .profile:focus-visible {
      background: var(--admin-surface-hover);
      outline: 0;
    }
    .avatar {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      flex: 0 0 auto;
      border-radius: 13px;
      background: linear-gradient(145deg, #ffd9c8, #f2a58f);
      color: #7e3020;
      font-weight: 900;
    }
    .profile small {
      display: block;
      color: var(--admin-muted);
      font-size: 10px;
      line-height: 1.1;
    }
    .profile strong {
      display: block;
      color: var(--admin-text);
      font-size: 13px;
      line-height: 1.15;
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
    .admin-page-head,
    .page-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 18px;
      margin-bottom: 16px;
    }
    .admin-page-head h1,
    .page-head h1 {
      margin: 0;
      font-size: 24px;
      line-height: 1.1;
      letter-spacing: -0.03em;
    }
    .section,
    .card {
      border: 1px solid var(--admin-border);
      border-radius: 20px;
      background: color-mix(in srgb, var(--admin-surface) 93%, transparent);
      align-self: start;
      width: 100%;
      min-width: 0;
      overflow: hidden;
      box-shadow: 0 12px 28px rgba(34, 48, 78, 0.08);
    }
    .section + .section {
      margin-top: 14px;
    }
    .section-head,
    .card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 18px 8px;
      border-bottom: 1px solid var(--admin-border);
      background: transparent;
    }
    .section-head h2 {
      margin-bottom: 0;
    }
    .section-body,
    .card-body {
      padding: 12px 18px 14px;
    }
    #overview-section .section-body:has(> #overview.is-empty) {
      padding-top: 0;
      padding-bottom: 12px;
    }
    #overview.is-empty {
      display: none;
    }
    #daily-queue-section.is-empty {
      display: none;
    }
    #external-api-section.is-empty {
      display: none;
    }
    #operations-section .section-body,
    #audit-section .section-body {
      padding-top: 12px;
      padding-bottom: 14px;
    }
    #operations-section .panel,
    #audit-section .panel {
      align-self: start;
      width: 100%;
    }
    #operations-section .settings-layout,
    #audit-section .section-body {
      width: 100%;
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
    :root[data-theme="dark"] .card,
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
      align-content: start;
      grid-auto-rows: max-content;
    }
    .grid,
    .metric-row {
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
      min-height: 92px;
      padding: 16px;
      border-radius: 18px;
      background: color-mix(in srgb, var(--admin-surface) 92%, transparent);
      box-shadow: 0 10px 24px rgba(34, 48, 78, 0.08);
      align-self: start;
    }
    .overview-card h2 {
      margin: 0;
      color: var(--admin-text);
      font-size: 24px;
      font-weight: 900;
      letter-spacing: -0.03em;
      line-height: 1.1;
    }
    .metric-label {
      color: var(--admin-muted);
      font-size: 12px;
    }
    .metric-hint {
      color: var(--admin-muted);
      font-size: 12px;
      line-height: 1.35;
    }
    .overview-primary {
      font-size: 1.35rem;
      font-weight: 850;
      line-height: 1.1;
      color: var(--admin-text);
    }
    .queue-chart-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(220px, 300px);
      gap: 14px;
      align-items: stretch;
    }
    .queue-chart-card {
      display: grid;
      gap: 12px;
      min-width: 0;
      padding: 14px;
      border: 1px solid var(--admin-soft-border);
      border-radius: 16px;
      background: color-mix(in srgb, var(--admin-surface) 94%, var(--admin-bg) 6%);
    }
    .daily-queue-chart {
      display: grid;
      grid-template-columns: repeat(14, minmax(18px, 1fr));
      gap: 8px;
      align-items: end;
      min-height: 210px;
      padding: 8px 2px 0;
    }
    .queue-bar {
      display: grid;
      grid-template-rows: minmax(150px, 1fr) auto;
      gap: 8px;
      min-width: 0;
    }
    .queue-bar-stack {
      display: flex;
      flex-direction: column-reverse;
      justify-content: flex-start;
      height: 100%;
      min-height: 150px;
      overflow: hidden;
      border: 1px solid var(--admin-soft-border);
      border-radius: 10px 10px 6px 6px;
      background: color-mix(in srgb, var(--admin-surface) 86%, var(--admin-bg) 14%);
    }
    .queue-bar-segment {
      min-height: 3px;
    }
    .queue-bar-segment.sent,
    .legend-dot.sent {
      background: var(--admin-accent);
    }
    .queue-bar-segment.queued,
    .legend-dot.queued {
      background: var(--admin-primary);
    }
    .queue-bar-segment.skipped,
    .legend-dot.skipped {
      background: #94a3b8;
    }
    .queue-bar-segment.failed,
    .legend-dot.failed {
      background: var(--admin-danger);
    }
    .queue-bar-label {
      color: var(--admin-muted);
      font-size: 11px;
      text-align: center;
      white-space: nowrap;
    }
    .queue-chart-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 12px;
      color: var(--admin-muted);
      font-size: 12px;
    }
    .queue-chart-legend span {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .legend-dot {
      width: 9px;
      height: 9px;
      border-radius: 999px;
      display: inline-block;
    }
    .queue-chart-summary {
      display: grid;
      gap: 10px;
      align-content: start;
    }
    .queue-summary-card {
      display: grid;
      gap: 4px;
      padding: 12px;
      border: 1px solid var(--admin-soft-border);
      border-radius: 14px;
      background: color-mix(in srgb, var(--admin-surface) 94%, var(--admin-bg) 6%);
    }
    .queue-summary-label {
      color: var(--admin-muted);
      font-size: 12px;
    }
    .queue-summary-value {
      color: var(--admin-text);
      font-size: 20px;
      font-weight: 850;
      line-height: 1.1;
    }
    .daily-queue-empty {
      display: grid;
      min-height: 180px;
      place-items: center;
      color: var(--admin-muted);
      text-align: center;
    }
    .external-api-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(220px, 300px);
      gap: 14px;
      align-items: stretch;
    }
    .external-api-chart-card {
      position: relative;
      display: grid;
      gap: 12px;
      min-width: 0;
      padding: 14px;
      border: 1px solid var(--admin-soft-border);
      border-radius: 16px;
      background: color-mix(in srgb, var(--admin-surface) 94%, var(--admin-bg) 6%);
    }
    .external-api-chart {
      display: grid;
      grid-template-columns: repeat(14, minmax(18px, 1fr));
      gap: 8px;
      align-items: end;
      min-height: 210px;
      padding: 8px 2px 0;
    }
    .external-api-tooltip {
      position: absolute;
      z-index: 20;
      width: min(220px, calc(100% - 20px));
      padding: 12px 14px;
      pointer-events: none;
      color: var(--admin-text);
      border: 1px solid var(--admin-border);
      border-radius: 10px;
      background: color-mix(in srgb, var(--admin-surface) 96%, var(--admin-bg) 4%);
      box-shadow: 0 6px 18px color-mix(in srgb, #000 26%, transparent);
    }
    .external-api-tooltip[hidden] {
      display: none;
    }
    .external-api-tooltip-date {
      color: var(--admin-muted);
      font-size: 12px;
    }
    .external-api-tooltip-total,
    .external-api-tooltip-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
    }
    .external-api-tooltip-total {
      margin: 4px 0 8px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--admin-soft-border);
    }
    .external-api-tooltip-total strong {
      font-size: 18px;
    }
    .external-api-tooltip-row {
      padding: 3px 0;
      font-size: 13px;
    }
    .external-api-tooltip-source {
      display: inline-flex;
      align-items: center;
      gap: 7px;
    }
    .external-api-tooltip-dot {
      width: 7px;
      height: 7px;
      flex: 0 0 7px;
      border-radius: 50%;
    }
    .external-api-chart .queue-bar:focus-visible .queue-bar-stack {
      outline: 2px solid var(--admin-primary);
      outline-offset: 2px;
    }
    .external-api-results-head,
    .external-api-filters {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: end;
      justify-content: space-between;
    }
    .external-api-filters select {
      min-width: 150px;
    }
    .api-source-youtube,
    .legend-dot.api-source-youtube {
      background: #ef4444;
    }
    .api-source-chzzk,
    .legend-dot.api-source-chzzk {
      background: var(--admin-accent);
    }
    .api-source-fcm,
    .legend-dot.api-source-fcm {
      background: #f59e0b;
    }
    .api-source-websub,
    .legend-dot.api-source-websub {
      background: var(--admin-primary);
    }
    .api-source-other,
    .legend-dot.api-source-other {
      background: #94a3b8;
    }
    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
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
    input,
    select,
    textarea {
      width: 100%;
      min-width: 0;
      border: 1px solid var(--admin-input-border);
      border-radius: 13px;
      padding: 10px 12px;
      font: inherit;
      font-size: 13px;
      background-color: var(--admin-surface);
      color: var(--admin-text);
      appearance: none;
      -webkit-appearance: none;
    }
    select {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2.5 4.5 6 8l3.5-3.5' fill='none' stroke='%239aa8bd' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 12px center;
      background-size: 12px 12px;
      padding-right: 34px;
    }
    textarea {
      min-height: 96px;
      resize: vertical;
      line-height: 1.45;
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
      color: var(--admin-label);
      cursor: pointer;
      display: inline-flex;
      gap: 8px;
      white-space: nowrap;
    }
    .switch-control input[type="checkbox"]:not(.auto-refresh-input) {
      appearance: none;
      -webkit-appearance: none;
      width: 18px;
      height: 18px;
      flex: none;
      margin: 0;
      padding: 0;
      border-radius: 6px;
      border: 1px solid var(--admin-input-border);
      background: var(--admin-surface);
      cursor: pointer;
    }
    .switch-control input[type="checkbox"]:not(.auto-refresh-input):checked {
      background: var(--admin-primary);
      border-color: var(--admin-primary);
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2.5 6.3 4.8 8.6 9.5 3.9' fill='none' stroke='%23ffffff' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: center;
      background-size: 12px 12px;
    }
    .switch-control input[type="checkbox"]:not(.auto-refresh-input):focus-visible {
      outline: 2px solid var(--admin-primary);
      outline-offset: 2px;
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
    select:focus-visible,
    textarea:focus-visible,
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
    button.is-primary {
      background: var(--admin-primary);
      border-color: var(--admin-primary);
      color: var(--admin-primary-text);
    }
    button.is-primary:hover {
      background: color-mix(in srgb, var(--admin-primary) 88%, black);
    }
    button.is-danger {
      color: var(--admin-danger);
      border-color: color-mix(in srgb, var(--admin-danger) 45%, transparent);
    }
    button.is-danger:hover {
      background: color-mix(in srgb, var(--admin-danger) 12%, transparent);
    }
    .action-overflow {
      position: relative;
      display: inline-flex;
    }
    .overflow-trigger {
      width: 38px;
      min-height: 38px;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--admin-muted);
    }
    .overflow-trigger:hover {
      color: var(--admin-text);
    }
    .overflow-trigger[aria-expanded="true"] {
      background: var(--admin-surface-hover);
      color: var(--admin-text);
    }
    .overflow-panel {
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      z-index: 40;
      min-width: 220px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 6px;
      border: 1px solid var(--admin-border);
      border-radius: 14px;
      background: var(--admin-surface);
      box-shadow: 0 16px 34px rgba(2, 6, 23, 0.34);
    }
    .overflow-panel button {
      width: 100%;
      justify-content: flex-start;
      text-align: left;
      border: 0;
      border-radius: 9px;
      background: transparent;
      min-height: 34px;
      padding: 6px 10px;
    }
    .overflow-panel button:hover {
      background: var(--admin-surface-hover);
    }
    .overflow-sep {
      height: 1px;
      margin: 6px 4px;
      background: var(--admin-soft-border);
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
    .hub-events-links-venue-section {
      grid-column: 1 / -1;
    }
    .hub-event-editor-tabs { display: flex; gap: 18px; border-bottom: 1px solid var(--admin-border); margin-bottom: 14px; }
    .hub-event-editor-tab { border: 0; border-bottom: 2px solid transparent; border-radius: 0; padding: 10px 2px; background: transparent; color: var(--admin-muted); }
    .hub-event-editor-tab[aria-selected="true"] { border-bottom-color: var(--admin-primary); color: var(--admin-text); }
    [data-hub-event-tab-panel][hidden] { display: none !important; }
    .hub-event-schedule-list { display: grid; gap: 8px; margin-top: 12px; }
    .hub-event-schedule-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: center; border: 1px solid var(--line); border-radius: 8px; padding: 12px; background: var(--surface-soft); }
    .hub-event-schedule-row.is-cancelled { opacity: .62; }
    .hub-event-schedule-summary { display: grid; gap: 5px; min-width: 0; }
    .hub-event-schedule-meta { display: flex; flex-wrap: wrap; gap: 6px; color: var(--admin-muted); font-size: 12px; }
    .hub-event-schedule-row[aria-invalid="true"] { border-color: var(--danger); }
    .hub-event-schedule-row-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .hub-event-schedule-row [aria-invalid="true"] { outline: 2px solid var(--danger); outline-offset: 1px; }
    .hub-event-schedule-flags { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 10px; }
    .hub-event-schedule-hidden { display: none !important; }
    .hub-event-schedule-dialog { width: min(620px, calc(100vw - 32px)); border: 1px solid var(--admin-border); border-radius: 10px; padding: 0; background: var(--admin-surface); color: var(--admin-text); }
    .hub-event-schedule-dialog::backdrop { background: rgba(0, 0, 0, .46); }
    .hub-event-schedule-dialog-body { display: grid; gap: 12px; padding: 18px; }
    .hub-event-schedule-dialog-head, .hub-event-schedule-dialog-actions { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .hub-event-schedule-dialog details { border-top: 1px solid var(--admin-border); padding-top: 10px; }
    .hub-event-link-editor { display: grid; gap: 8px; }
    .hub-event-link-row { display: grid; grid-template-columns: minmax(110px, .6fr) minmax(130px, .8fr) minmax(220px, 1.8fr) auto; gap: 8px; align-items: end; }
    .hub-event-link-row .field { min-width: 0; }
    .hub-event-link-remove { min-height: 38px; }
    .hub-event-link-actions { display: flex; gap: 6px; }
    .hub-event-link-actions button { min-width: 38px; min-height: 38px; }
    .hub-event-primary-choice { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; color: var(--admin-muted); }

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
    #operations-section .summary-row,
    #audit-section .activity-item {
      padding: 12px;
    }
    #audit-section .activity-list {
      gap: 8px;
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
      .event-layout,
      .queue-chart-layout,
      .external-api-layout {
        grid-template-columns: 1fr;
      }
      .grid,
      .metric-row {
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
      .hub-event-link-row {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .hub-event-link-row .field {
        grid-column: auto;
      }
      .hub-event-link-row .field:nth-child(3),
      .hub-event-link-actions {
        grid-column: 1 / -1;
      }
      .hub-event-link-actions {
        flex-wrap: wrap;
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
      .queue-chart-card,
      .external-api-chart-card {
        overflow-x: auto;
      }
      .daily-queue-chart,
      .external-api-chart {
        grid-template-columns: repeat(14, minmax(24px, 1fr));
        min-width: 520px;
        padding-bottom: 4px;
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
  <div class="shell admin-app">
    <nav class="sidebar admin-nav" aria-label="Admin console sections">
      <div class="brand admin-brand">
        <div class="brand-mark admin-brand-mark" aria-hidden="true"></div>
        <div class="brand-title admin-brand-title">Stellive Hub Admin</div>
      </div>
      <div class="nav admin-nav-links">
        <button type="button" data-page-target="dashboard" aria-current="page">${t("nav.dashboard")}<span class="dot admin-nav-dot" aria-hidden="true"></span></button>
        <button type="button" data-page-target="hub-events">Hub events<span class="dot admin-nav-dot" aria-hidden="true"></span></button>
        <button type="button" data-page-target="announcements">${t("nav.announcements")}<span class="dot admin-nav-dot" aria-hidden="true"></span></button>
        <button type="button" data-page-target="operations">${t("nav.operations")}<span class="dot admin-nav-dot" aria-hidden="true"></span></button>
        <button type="button" data-page-target="audit">${t("audit.title")}<span class="dot admin-nav-dot" aria-hidden="true"></span></button>
        <button type="button" data-page-target="settings">${t("nav.settings")}<span class="dot admin-nav-dot" aria-hidden="true"></span></button>
      </div>
      <div class="admin-sidebar-card">
        <strong>${t("settings.sessionActive")}</strong>
        <span>${t("settings.internalAccessDescription")}</span>
      </div>
    </nav>
    <main class="main admin-content stack">
      <div class="topbar admin-topbar">
        <nav class="tabs admin-tabs" aria-label="Quick page tabs">
          <button type="button" data-page-target="dashboard" aria-current="page">${t("nav.dashboard")}</button>
          <button type="button" data-page-target="hub-events">Hub events</button>
          <button type="button" data-page-target="announcements">${t("nav.announcements")}</button>
          <button type="button" data-page-target="operations">${t("nav.operations")}</button>
          <button type="button" data-page-target="audit">${t("audit.title")}</button>
          <button type="button" data-page-target="settings">${t("nav.settings")}</button>
        </nav>
        <div class="top-actions topbar-actions">
          ${renderAdminLanguageHtml(locale, "/admin")}
          <button class="icon-button has-tooltip" data-tooltip="Refresh adapter, secret, feature flag, and job status." title="Refresh adapter, secret, feature flag, and job status." id="refresh" type="button" aria-label="Refresh">&#8635;</button>
          <button class="icon-button" id="theme-toggle" type="button" aria-label="Toggle dark mode">&#9790;</button>
          <button class="icon-button" type="button" aria-label="Console status">&#9825;</button>
          <form class="logout-form" method="post" action="/admin/logout">
            <button class="profile" type="submit" aria-label="Log out">
              <span class="avatar" aria-hidden="true">A</span>
              <span>
                <small>Welcome back,</small>
                <strong>Admin</strong>
              </span>
            </button>
          </form>
        </div>
      </div>

      <div id="message" class="message" aria-live="polite"></div>
      <div class="page-head admin-page-head">
        <div>
          <h1 id="admin-current-page-title">${t("nav.dashboard")}</h1>
          <p id="admin-current-page-description" class="subtle">${t("page.dashboardDescription")}</p>
        </div>
      </div>

      <section class="page active" id="page-dashboard" data-admin-page="dashboard">
      <section id="overview-section" class="section">
        <div class="section-head">
          <div>
            <h2>${t("nav.dashboard")}</h2>
            <p class="subtle">${t("dashboard.healthDescription")}</p>
          </div>
        </div>
        <div class="section-body">
          <section id="overview" class="metric-row grid is-empty" aria-live="polite"></section>
        </div>
      </section>

      <section id="daily-queue-section" class="section is-empty">
        <div class="section-head">
          <div>
            <h2>${t("dashboard.deliveryQueue")}</h2>
            <p class="subtle">${t("dashboard.deliveryQueueDescription")}</p>
          </div>
        </div>
        <div class="section-body queue-chart-layout">
          <div class="queue-chart-card">
            <div id="daily-queue-chart" class="daily-queue-chart" aria-label="Daily client delivery queue chart"></div>
            <div class="queue-chart-legend" aria-label="Delivery status legend">
              <span><i class="legend-dot sent" aria-hidden="true"></i>${t("status.sent")}</span>
              <span><i class="legend-dot queued" aria-hidden="true"></i>${t("status.queued")}</span>
              <span><i class="legend-dot skipped" aria-hidden="true"></i>${t("status.skipped")}</span>
              <span><i class="legend-dot failed" aria-hidden="true"></i>${t("status.failed")}</span>
            </div>
          </div>
          <aside id="daily-queue-summary" class="queue-chart-summary" aria-label="Daily delivery queue summary"></aside>
          <ul id="daily-queue-accessible-list" class="visually-hidden"></ul>
        </div>
      </section>

      <section id="external-api-section" class="section is-empty">
        <div class="section-head">
          <div>
            <h2>${t("dashboard.externalApiCalls")}</h2>
            <p class="subtle">${t("dashboard.externalApiDescription")}</p>
            <p class="subtle">Tracked quotaUnits are calculated from recorded YouTube list API requests and may not match provider billing exactly.</p>
          </div>
        </div>
        <div class="section-body external-api-layout">
          <div id="external-api-chart-card" class="external-api-chart-card">
            <div id="external-api-chart" class="external-api-chart" aria-label="Daily external API call chart"></div>
            <div id="external-api-tooltip" class="external-api-tooltip" role="tooltip" hidden></div>
            <div id="external-api-legend" class="queue-chart-legend" aria-label="External API source legend"></div>
          </div>
          <aside id="external-api-summary" class="queue-chart-summary external-api-summary" aria-label="External API call summary"></aside>
          <ul id="external-api-accessible-list" class="visually-hidden"></ul>
        </div>
        <div class="section-body">
          <div class="external-api-results-head">
            <div>
              <h3>${t("dashboard.recentApiResults")}</h3>
              <p class="subtle">Sanitized results from the last 31 days only.</p>
            </div>
            <div class="external-api-filters">
              <select id="external-api-source-filter" aria-label="External API source filter">
                <option value="">All sources</option>
                <option value="youtube">YouTube</option>
                <option value="chzzk">CHZZK</option>
                <option value="fcm">FCM</option>
                <option value="websub">WebSub</option>
              </select>
              <select id="external-api-status-filter" aria-label="External API result filter">
                <option value="">All results</option>
                <option value="ok">ok</option>
                <option value="not_modified">not_modified</option>
                <option value="quota_exceeded">quota_exceeded</option>
                <option value="rate_limited">rate_limited</option>
                <option value="auth_required">auth_required</option>
                <option value="http_error">http_error</option>
                <option value="network_error">network_error</option>
                <option value="timeout">timeout</option>
                <option value="parse_error">parse_error</option>
              </select>
              <button id="external-api-results-refresh" type="button">Refresh results</button>
            </div>
          </div>
          <div class="table-scroll">
            <table class="status-table">
              <thead>
                <tr>
                  <th>${t("common.time")}</th>
                  <th>${t("common.source")}</th>
                  <th>${t("common.operation")}</th>
                  <th>${t("common.result")}</th>
                  <th>${t("common.status")}</th>
                  <th>${t("common.duration")}</th>
                  <th>${t("dashboard.quota")}</th>
                </tr>
              </thead>
              <tbody id="external-api-results"></tbody>
            </table>
          </div>
        </div>
      </section>

      <section id="adapters-section" class="section">
        <div class="section-head">
          <h2>${t("dashboard.systemStatus")}</h2>
        </div>
        <div class="section-body split">
          <div class="panel">
            <h2>${t("dashboard.serviceOverview")}</h2>
            <div id="service-overview-summary" class="summary-list" aria-live="polite"></div>
            <div class="table-scroll">
              <table class="status-table">
                <tbody id="service-overview-status"></tbody>
              </table>
            </div>
          </div>
          <div class="panel">
            <h2>${t("audit.recent")}</h2>
            <div id="dashboard-recent-activity" class="activity-list" aria-live="polite"></div>
          </div>
          <div class="panel">
            <h2>${t("dashboard.adapterHealth")}</h2>
            <div class="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>${t("common.source")}</th>
                    <th>${t("common.status")}</th>
                    <th>${t("common.reason")}</th>
                    <th>${t("dashboard.lastChecked")}</th>
                  </tr>
                </thead>
                <tbody id="adapters"></tbody>
              </table>
            </div>
          </div>
          <div class="panel">
            <h2>${t("dashboard.configuration")}</h2>
            <div class="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>${t("common.name")}</th>
                    <th>${t("common.state")}</th>
                  </tr>
                </thead>
                <tbody id="secrets"></tbody>
              </table>
            </div>
            <div class="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>${t("common.name")}</th>
                    <th>${t("common.value")}</th>
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
            <p class="subtle">${t("hubEvent.goodsControls")}</p>
          </div>
          <div class="hub-events-toolbar action-controls">
                <button class="has-tooltip" data-tooltip="Refresh Hub event list." title="Refresh Hub event list." id="hub-event-refresh" type="button">${t("hubEvent.refreshEvents")}</button>
                <button class="has-tooltip" data-tooltip="Validate the current Hub event form without saving." title="Validate the current Hub event form without saving." id="hub-event-validate" type="button">${t("hubEvent.validate")}</button>
            <button data-hub-event-action="save-draft" id="hub-event-save-draft" type="button">${t("announcement.saveDraft")}</button>
            <button class="is-primary" data-hub-event-action="publish" id="hub-event-publish" type="button">${t("announcement.publish")}</button>
            <div class="action-overflow">
              <button type="button" class="overflow-trigger" aria-haspopup="menu" aria-expanded="false" aria-label="More actions">
                <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><circle cx="8" cy="3.2" r="1.3" fill="currentColor"/><circle cx="8" cy="8" r="1.3" fill="currentColor"/><circle cx="8" cy="12.8" r="1.3" fill="currentColor"/></svg>
              </button>
              <div class="overflow-panel" role="menu" hidden>
                <button data-hub-event-action="cancel" id="hub-event-cancel" type="button">${t("common.cancel")}</button>
                <button data-hub-event-action="deactivate" id="hub-event-deactivate" type="button">${t("hubEvent.deactivate")}</button>
                <div class="overflow-sep" role="separator"></div>
                <button class="is-danger" data-hub-event-action="delete" id="hub-event-delete" type="button">${t("common.delete")}</button>
              </div>
            </div>
          </div>
        </div>
        <div class="section-body">
        <div class="event-layout hub-events-workspace">
          <div class="editor hub-event-editor-panel hub-events-editor">
          <div class="hub-event-editor-tabs" role="tablist" aria-label="Hub event editor">
            <button class="hub-event-editor-tab" data-hub-event-tab="info" role="tab" aria-selected="true" type="button">${t("hubEvent.infoTab")}</button>
            <button class="hub-event-editor-tab" id="hub-event-schedule-tab" data-hub-event-tab="schedule" role="tab" aria-selected="false" type="button">Detailed schedule (0)</button>
            <button class="hub-event-editor-tab" data-hub-event-tab="history" role="tab" aria-selected="false" type="button">${t("hubEvent.historyTab")}</button>
          </div>
          <form id="hub-event-form" class="hub-event-form-wide hub-events-editor-grid">
            <input id="hub-event-id" type="hidden">
            <div class="form-section hub-events-section">
              <h3 class="form-section-title hub-events-section-title">${t("hubEvent.basic")}</h3>
              <div class="hub-events-section-body">
                <div class="field"><label for="hub-event-title">${t("announcement.subject")}</label><input id="hub-event-title" name="title" autocomplete="off"></div>
                <div class="field"><label for="hub-event-summary">${t("announcement.summary")}</label><textarea id="hub-event-summary" name="summary" rows="3"></textarea></div>
                <div class="hub-events-three">
                  <div class="field"><label for="hub-event-category">${t("hubEvent.category")}</label><select id="hub-event-category" name="category"><option value="online_goods">${t("hubEvent.onlineGoods")}</option><option value="online_collab">${t("hubEvent.onlineCollab")}</option><option value="offline_concert">${t("hubEvent.offlineConcert")}</option><option value="offline_collab">${t("hubEvent.offlineCollab")}</option><option value="offline_popup">${t("hubEvent.offlinePopup")}</option><option value="ticketing">${t("hubEvent.ticketing")}</option></select></div>
                  <div class="field"><label for="hub-event-participation-mode">${t("hubEvent.participation")}</label><select id="hub-event-participation-mode" name="participationMode"><option value="online">Online</option><option value="offline">Offline</option><option value="hybrid">${t("hubEvent.hybrid")}</option></select></div>
                  <div class="field"><label for="hub-event-status">${t("common.status")}</label><select id="hub-event-status" name="status"><option value="announced">${t("hubEvent.announced")}</option><option value="upcoming">${t("hubEvent.upcoming")}</option><option value="open">${t("status.open")}</option><option value="closing_soon">${t("hubEvent.closingSoon")}</option><option value="ended">${t("status.ended")}</option><option value="cancelled">${t("hubEvent.scheduleCancelled")}</option></select></div>
                </div>
                <label class="switch-control"><input id="hub-event-tag-album" type="checkbox"> Album</label>
                <div class="field"><label for="hub-event-generation">${t("hubEvent.generation")}</label><input id="hub-event-generation" name="generationId" autocomplete="off" value="official" placeholder="official, gen1, gen2, gen3"><p class="subtle">Examples: official, gen1, gen2, gen3. Use the member's matching generation for member-scoped events.</p></div>
                <div class="field"><label for="hub-event-member">${t("hubEvent.member")}</label><input id="hub-event-member" name="memberId" autocomplete="off" placeholder="akane-lize"><p class="subtle">Example: akane-lize. Leave blank for generation-wide or official events.</p></div>
              </div>
            </div>
            <div class="form-section hub-events-section">
              <h3 class="form-section-title hub-events-section-title">${t("hubEvent.sourceThumbnail")}</h3>
              <div class="hub-events-section-body">
                <div class="hub-events-two">
                  <div class="field"><label for="hub-event-source-type">${t("hubEvent.sourceType")}</label><select id="hub-event-source-type" name="sourceType"><option value="official">Official</option><option value="member">${t("hubEvent.member")}</option><option value="official_collab">Official collab</option></select></div>
                  <div class="field"><label for="hub-event-image-policy-state">${t("hubEvent.imagePolicy")}</label><select id="hub-event-image-policy-state" name="imagePolicyState"><option value="none">${t("common.none")}</option><option value="official_runtime_url">Official runtime URL</option><option value="third_party_allowed">Third-party allowed</option><option value="verify_required">${t("status.verifyRequired")}</option><option value="blocked">${t("status.blocked")}</option></select></div>
                </div>
                <div class="field"><label for="hub-event-source-url">${t("hubEvent.sourceUrl")}</label><input id="hub-event-source-url" name="sourceUrl" type="url" autocomplete="off"></div>
                <div class="field"><label for="hub-event-source-label">${t("hubEvent.sourceLabel")}</label><input id="hub-event-source-label" name="sourceLabel" autocomplete="off"></div>
                <div class="image-policy-help" aria-label="Source and image metadata help">
                  <strong>No bundled image</strong>
                  <div class="policy-help-grid">
                    <span><strong>Source type:</strong> official means official notices or sources; member means member-owned sources; official_collab means official collaboration or partner sources.</span>
                    <span><strong>Image policy state:</strong> none stores no image metadata and requires image URL/source label/source URL to stay blank; official_runtime_url and third_party_allowed require image URL, source label, and source URL; verify_required can be saved but is not treated as display-ready; blocked is not display-ready.</span>
                    <span><strong>Common:</strong> Metadata only. No uploads or copied assets. No base64, local path, logo/poster/profile image asset fields. Displayable images require HTTPS. sourceUrl, purchaseUrl, ticketUrl must be HTTPS when filled.</span>
                  </div>
                </div>
                <div class="field"><label for="hub-event-image-url">${t("hubEvent.imageUrl")}</label><input id="hub-event-image-url" name="imageUrl" type="url" autocomplete="off"></div>
                <div class="field"><label for="hub-event-image-source-label">${t("hubEvent.imageSourceLabel")}</label><input id="hub-event-image-source-label" name="imageSourceLabel" autocomplete="off"></div>
                <div class="field"><label for="hub-event-image-source-url">${t("hubEvent.imageSourceUrl")}</label><input id="hub-event-image-source-url" name="imageSourceUrl" type="url" autocomplete="off"></div>
              </div>
            </div>
            <div class="form-section hub-events-section" data-hub-event-tab-panel="info">
              <h3 class="form-section-title hub-events-section-title">${t("hubEvent.schedule")}</h3>
              <div class="hub-events-section-body">
                <div class="field"><label for="hub-event-announced-at">${t("hubEvent.announcedAt")}</label><input id="hub-event-announced-at" name="announcedAt" type="datetime-local"></div>
                <input id="hub-event-schedule-mode" name="scheduleMode" type="hidden" value="single_window">
                <div id="hub-event-single-window-fields">
                  <div class="field"><label for="hub-event-starts-at">${t("hubEvent.startsAt")}</label><input id="hub-event-starts-at" name="startsAt" type="datetime-local"></div>
                  <div class="field"><label for="hub-event-ends-at">${t("hubEvent.endsAt")}</label><input id="hub-event-ends-at" name="endsAt" type="datetime-local"></div>
                </div>
              </div>
            </div>
            <div class="form-section hub-events-section hub-events-links-venue-section">
              <h3 class="form-section-title hub-events-section-title">${t("hubEvent.linksVenue")}</h3>
              <div class="hub-events-section-body">
                <div class="section-head"><div><strong><span>${t("hubEvent.relatedLinks")}</span> (<span id="hub-event-link-count">0</span>)</strong><p class="subtle">${t("hubEvent.relatedLinksHelp")}</p></div><button id="hub-event-link-add" type="button">${t("hubEvent.addLink")}</button></div>
                <div id="hub-event-links" class="hub-event-link-editor"></div>
                <div class="field"><label for="hub-event-venue-name">${t("hubEvent.venueName")}</label><input id="hub-event-venue-name" name="venueName" autocomplete="off"></div>
                <div class="field"><label for="hub-event-venue-address">${t("hubEvent.venueAddress")}</label><input id="hub-event-venue-address" name="venueAddress" autocomplete="off"></div>
                <label class="switch-control"><input id="hub-event-notification-eligible" name="notificationEligible" type="checkbox" checked> Notification eligible</label>
              </div>
            </div>
          </form>
          <section id="hub-event-timeline-fields" class="hub-events-section panel" data-hub-event-tab-panel="schedule" hidden>
            <div class="section-head">
              <div><h3>${t("hubEvent.scheduleDetail")}</h3><p class="subtle"><span>${t("hubEvent.scheduleHelp")}</span> <span>${t("hubEvent.primaryReplacementHelp")}</span></p></div>
              <button id="hub-event-schedule-add" type="button">${t("hubEvent.addSchedule")}</button>
            </div>
            <div class="hub-events-section-body"><div id="hub-event-schedule-items" class="hub-event-schedule-list"></div></div>
          </section>
          <div class="hub-events-footer">
            <div class="hub-events-section panel validation-panel"><h3>${t("hubEvent.validation")}</h3><ul id="hub-event-validation" class="message-list"></ul></div>
            <div class="hub-events-section panel audit-log-panel" data-hub-event-tab-panel="history" hidden><h3>${t("announcement.auditLog")}</h3><ul id="hub-event-audit-log" class="message-list"></ul></div>
          </div>
          <dialog id="hub-event-schedule-dialog" class="hub-event-schedule-dialog">
            <form id="hub-event-schedule-form" method="dialog" class="hub-event-schedule-dialog-body">
              <div class="hub-event-schedule-dialog-head"><h3 id="hub-event-schedule-dialog-title">${t("hubEvent.scheduleCreate")}</h3><button id="hub-event-schedule-dialog-close" type="button">${t("common.cancel")}</button></div>
              <input id="hub-event-schedule-edit-id" type="hidden">
              <div class="hub-events-two">
                <div class="field"><label for="hub-event-schedule-kind">${t("hubEvent.linkKind")}</label><select id="hub-event-schedule-kind"><option value="main_window">Main window</option><option value="announcement">Announcement</option><option value="sales_open">Sales open</option><option value="ticket_open">Ticket open</option><option value="content_reveal">Content reveal</option><option value="release">Release</option><option value="deadline">Deadline</option><option value="custom">Custom</option></select></div>
                <div class="field"><label for="hub-event-schedule-title">${t("announcement.subject")}</label><input id="hub-event-schedule-title" autocomplete="off" required maxlength="160"></div>
              </div>
              <div class="hub-events-two">
                <div class="field"><label for="hub-event-schedule-timing">${t("hubEvent.scheduleTiming")}</label><select id="hub-event-schedule-timing"><option value="point">${t("hubEvent.schedulePoint")}</option><option value="period">${t("hubEvent.schedulePeriod")}</option></select></div>
                <div class="field"><label for="hub-event-schedule-precision">${t("hubEvent.timePrecision")}</label><select id="hub-event-schedule-precision"><option value="datetime">${t("hubEvent.dateTime")}</option><option value="date">${t("hubEvent.dateOnly")}</option></select></div>
              </div>
              <div class="hub-events-two">
                <div class="field"><label id="hub-event-schedule-starts-at-label" for="hub-event-schedule-starts-at">${t("hubEvent.occursAt")}</label><input id="hub-event-schedule-starts-at" type="datetime-local" required></div>
                <div id="hub-event-schedule-ends-at-field" class="field hub-event-schedule-hidden"><label for="hub-event-schedule-ends-at">${t("hubEvent.endsAt")}</label><input id="hub-event-schedule-ends-at" type="datetime-local" disabled></div>
              </div>
              <div class="hub-event-schedule-flags"><label class="switch-control"><input id="hub-event-schedule-primary" type="radio" name="hub-event-dialog-primary"> Set as primary</label><label class="switch-control"><input id="hub-event-schedule-notification" type="checkbox" checked> Notification eligible</label></div>
              <details><summary>${t("hubEvent.additionalInfo")}</summary>
                <div class="hub-events-section-body">
                  <div class="field"><label for="hub-event-schedule-description">${t("hubEvent.scheduleDescriptionOptional")}</label><textarea id="hub-event-schedule-description" rows="3" maxlength="2000"></textarea></div>
                  <div class="field"><label for="hub-event-schedule-label">${t("hubEvent.scheduleShortLabelOptional")}</label><input id="hub-event-schedule-label" autocomplete="off" maxlength="80"><span class="subtle">${t("hubEvent.scheduleShortLabelHelp")}</span></div>
                  <div class="field"><label for="hub-event-schedule-timezone">${t("hubEvent.timezone")}</label><input id="hub-event-schedule-timezone" value="Asia/Seoul"></div>
                  <div class="section-head"><div><strong><span>${t("hubEvent.scheduleLinks")}</span> (<span id="hub-event-schedule-link-count">0</span>)</strong><p class="subtle">${t("hubEvent.scheduleLinksHelp")}</p></div><button id="hub-event-schedule-link-add" type="button">${t("hubEvent.addLink")}</button></div>
                  <div id="hub-event-schedule-links" class="hub-event-link-editor"></div>
                </div>
              </details>
              <div class="hub-event-schedule-dialog-actions"><span></span><button id="hub-event-schedule-save" type="submit">${t("hubEvent.scheduleSave")}</button></div>
            </form>
          </dialog>
          </div>
          <div class="hub-event-list-panel hub-events-sidebar events-card">
            <div class="card-body events-card-body">
              <h3>Events</h3>
              <p class="subtle">${t("hubEvent.filterHelp")}</p>
            </div>
            <div class="hub-events-filters">
              <div class="hub-events-filter-row">
                <div class="field">
                  <label class="has-tooltip" data-tooltip="Filter the events list by publication state." title="Filter the events list by publication state." for="hub-event-state-filter">${t("announcement.publicationState")}</label>
                  <select id="hub-event-state-filter">
                    <option value="">${t("common.all")}</option>
                    <option value="draft">${t("status.draft")}</option>
                    <option value="published">${t("status.published")}</option>
                    <option value="inactive">${t("status.inactive")}</option>
                    <option value="deleted">${t("status.deleted")}</option>
                  </select>
                </div>
                <div class="field">
                  <label class="has-tooltip" data-tooltip="Defaults to open events. Select Ended to review finished events." title="Defaults to open events. Select Ended to review finished events." for="hub-event-status-filter">Public status</label>
                  <select id="hub-event-status-filter">
                    <option value="open" selected>${t("status.open")}</option>
                    <option value="">${t("enum.allStatuses")}</option>
                    <option value="announced">${t("hubEvent.announced")}</option>
                    <option value="upcoming">${t("hubEvent.upcoming")}</option>
                    <option value="closing_soon">${t("hubEvent.closingSoon")}</option>
                    <option value="ended">${t("status.ended")}</option>
                    <option value="cancelled">${t("hubEvent.scheduleCancelled")}</option>
                  </select>
                </div>
              </div>
              <div class="hub-events-filter-row">
                <div class="field">
                  <label for="hub-event-category-filter">${t("hubEvent.category")}</label>
                  <select id="hub-event-category-filter">
                    <option value="">${t("common.all")}</option>
                    <option value="online_goods">${t("hubEvent.onlineGoods")}</option>
                    <option value="online_collab">${t("hubEvent.onlineCollab")}</option>
                    <option value="offline_concert">${t("hubEvent.offlineConcert")}</option>
                    <option value="offline_collab">${t("hubEvent.offlineCollab")}</option>
                    <option value="offline_popup">${t("hubEvent.offlinePopup")}</option>
                    <option value="ticketing">${t("hubEvent.ticketing")}</option>
                  </select>
                </div>
                <div class="field">
                  <label for="hub-event-participation-mode-filter">${t("hubEvent.participation")}</label>
                  <select id="hub-event-participation-mode-filter">
                    <option value="">${t("common.all")}</option>
                    <option value="online">Online</option>
                    <option value="offline">Offline</option>
                    <option value="hybrid">${t("hubEvent.hybrid")}</option>
                  </select>
                </div>
                <div class="field">
                  <label for="hub-event-tag-filter">${t("hubEvent.tags")}</label>
                  <select id="hub-event-tag-filter"><option value="">${t("common.all")}</option><option value="album">${t("hubEvent.album")}</option></select>
                </div>
              </div>
              <div class="hub-events-filter-row">
                <div class="field">
                  <label for="hub-event-generation-filter">${t("hubEvent.generation")}</label>
                  <input id="hub-event-generation-filter" autocomplete="off" placeholder="official, gen1, gen2, gen3">
                </div>
                <div class="field">
                  <label for="hub-event-member-filter">${t("hubEvent.member")}</label>
                  <input id="hub-event-member-filter" autocomplete="off" placeholder="akane-lize">
                </div>
              </div>
              <div class="field">
                <label for="hub-event-search">${t("hubEvent.search")}</label>
                <input id="hub-event-search" type="search" autocomplete="off" spellcheck="false">
              </div>
              <label class="switch-control"><input id="hub-event-include-deleted" type="checkbox"> Include deleted</label>
            </div>
            <div id="hub-event-list" class="event-list hub-events-list" role="list" aria-label="Hub events"></div>
            <div class="hub-event-pagination" aria-label="Hub events pagination">
              <span id="hub-event-pagination-status" class="subtle">${t("hubEvent.pageOne")}</span>
              <div class="hub-event-pagination-actions">
                <button id="hub-event-prev-page" type="button">${t("hubEvent.previous")}</button>
                <button id="hub-event-next-page" type="button">${t("hubEvent.next")}</button>
              </div>
            </div>
          </div>
        </div>
        <div class="bottom-actions" aria-label="Hub event mobile actions">
          <button type="button" data-mobile-hub-event-action="validate">${t("hubEvent.validate")}</button>
          <button type="button" data-mobile-hub-event-action="save-draft">${t("announcement.saveDraft")}</button>
          <button type="button" data-mobile-hub-event-action="delete">${t("common.delete")}</button>
        </div>
        </div>
      </section>
      </section>

      <section class="page" id="page-announcements" data-admin-page="announcements">
        <section class="section stack">
          <div class="section-head">
            <div><h2>${t("announcement.title")}</h2><p class="subtle">${t("announcement.description")}</p></div>
            <div class="hub-events-toolbar">
              <button id="announcement-save" type="button">${t("announcement.saveDraft")}</button>
              <button class="is-primary" id="announcement-publish" type="button">${t("announcement.publish")}</button>
              <div class="action-overflow">
                <button type="button" class="overflow-trigger" aria-haspopup="menu" aria-expanded="false" aria-label="More actions">
                  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><circle cx="8" cy="3.2" r="1.3" fill="currentColor"/><circle cx="8" cy="8" r="1.3" fill="currentColor"/><circle cx="8" cy="12.8" r="1.3" fill="currentColor"/></svg>
                </button>
                <div class="overflow-panel" role="menu" hidden>
                  <button id="announcement-new" type="button">${t("announcement.new")}</button>
                  <button id="announcement-refresh" type="button">Refresh</button>
                  <button id="announcement-resolve" type="button">${t("announcement.resolve")}</button>
                  <button id="announcement-archive" type="button">${t("announcement.archive")}</button>
                  <button id="announcement-bump" type="button">${t("announcement.bumpAttention")}</button>
                  <button id="announcement-resend" type="button">${t("announcement.resend")}</button>
                  <div class="overflow-sep" role="separator"></div>
                  <button class="is-danger" id="announcement-delete" type="button">${t("common.delete")}</button>
                </div>
              </div>
            </div>
          </div>
          <div class="section-body hub-events-workspace">
            <form id="announcement-form" class="hub-events-editor-grid">
              <input id="announcement-id" type="hidden">
              <div class="hub-events-section">
                <h3 class="hub-events-section-title">Content</h3>
                <div class="hub-events-section-body">
                  <div class="hub-events-two">
                    <div class="field"><label for="announcement-type">${t("announcement.type")}</label><select id="announcement-type"><option value="general">${t("enum.general")}</option><option value="incident">${t("enum.incident")}</option><option value="maintenance">${t("enum.maintenance")}</option><option value="version_update">${t("enum.versionUpdate")}</option></select></div>
                    <div class="field"><label for="announcement-severity">${t("announcement.severity")}</label><select id="announcement-severity"><option value="info">${t("enum.info")}</option><option value="important">${t("enum.important")}</option><option value="critical">${t("enum.critical")}</option></select></div>
                  </div>
                  <div class="field"><label for="announcement-title">${t("announcement.subject")}</label><input id="announcement-title" maxlength="120"></div>
                  <div class="field"><label for="announcement-summary">${t("announcement.summary")}</label><textarea id="announcement-summary" rows="3" maxlength="300"></textarea></div>
                  <div class="field"><label for="announcement-body">${t("announcement.body")}</label><textarea id="announcement-body" rows="10"></textarea></div>
                </div>
              </div>
              <div class="hub-events-section">
                <h3 class="hub-events-section-title">${t("announcement.targetAndAction")}</h3>
                <div class="hub-events-section-body">
                  <div class="hub-events-two">
                    <label class="switch-control"><input id="announcement-platform-android" type="checkbox" checked> Android</label>
                    <label class="switch-control"><input id="announcement-platform-ios" type="checkbox" checked> iOS</label>
                  </div>
                  <div class="hub-events-two">
                    <div class="field"><label for="announcement-min-version">${t("announcement.minimumVersion")}</label><input id="announcement-min-version" placeholder="1.0.0"></div>
                    <div class="field"><label for="announcement-max-version">${t("announcement.maximumVersion")}</label><input id="announcement-max-version" placeholder="2.0.0"></div>
                  </div>
                  <div class="field"><label for="announcement-expires-at">${t("announcement.expiresAt")}</label><input id="announcement-expires-at" type="datetime-local"></div>
                  <div class="field"><label for="announcement-action-label">${t("announcement.actionLabel")}</label><input id="announcement-action-label" maxlength="40"></div>
                  <div class="field"><label for="announcement-deep-link">${t("announcement.deepLink")}</label><input id="announcement-deep-link" placeholder="stellivehub://announcements/..."></div>
                  <div class="field"><label for="announcement-external-url">${t("announcement.externalUrl")}</label><input id="announcement-external-url" type="url"></div>
                  <label class="switch-control"><input id="announcement-pinned" type="checkbox"> Pin on home</label>
                  <label class="switch-control"><input id="announcement-push-enabled" type="checkbox" checked> Send push on publish</label>
                </div>
              </div>
            </form>
            <div class="hub-events-sidebar">
              <div class="hub-events-sidebar-header">${t("announcement.listAction")}</div>
              <div class="hub-events-filters"><div class="field"><label for="announcement-state-filter">${t("announcement.publicationState")}</label><select id="announcement-state-filter"><option value="">${t("common.all")}</option><option value="draft">${t("status.draft")}</option><option value="published">${t("status.published")}</option><option value="archived">${t("status.archived")}</option></select></div></div>
              <div id="announcement-list" class="hub-events-list" role="list"></div>
            </div>
            <div class="hub-events-footer">
              <div class="hub-events-section panel"><h3>${t("announcement.auditLog")}</h3><ul id="announcement-audit-log" class="message-list"></ul></div>
              <div class="hub-events-section panel"><h3>${t("announcement.pushAttempts")}</h3><ul id="announcement-push-attempts" class="message-list"></ul></div>
            </div>
          </div>
        </section>
      </section>

      <section class="page" id="page-operations" data-admin-page="operations">
      <section id="operations-section" class="section">
        <div class="section-head">
          <div>
            <h2>${t("nav.operations")}</h2>
            <p class="subtle">${t("operations.description")}</p>
          </div>
        </div>
        <div class="section-body settings-layout">
          <div class="panel">
            <h2>${t("operations.schedulersJobs")}</h2>
            <div class="summary-list">
              <div class="summary-row">
                <div>
                  <div class="summary-title">${t("dashboard.queue")}</div>
                  <div class="summary-description">${t("operations.drainDescription")}</div>
                </div>
                <button id="drain" type="button">Drain jobs</button>
              </div>
              <div class="summary-row">
                <div>
                  <div class="summary-title">YouTube scheduler</div>
                  <div class="summary-description">${t("operations.renewDescription")}</div>
                </div>
                <button id="renew-youtube" type="button">Renew YouTube</button>
              </div>
              <div class="summary-row">
                <div>
                  <div class="summary-title">CHZZK live status</div>
                  <div class="summary-description">${t("operations.pollDescription")}</div>
                </div>
                <button id="poll-chzzk" type="button">Poll CHZZK</button>
              </div>
              <div class="summary-row">
                <div>
                  <div class="summary-title">${t("hubEvent.specialDayStatus")}</div>
                  <div class="summary-description">${t("operations.recalculateDescription")}</div>
                </div>
                <button class="has-tooltip" data-tooltip="Recalculate special day calendar status." title="Recalculate special day calendar status." id="recalculate-special-days" type="button">Recalculate special days</button>
              </div>
              <div class="summary-row">
                <div>
                  <div class="summary-title">${t("dashboard.externalApiLogs")}</div>
                  <div class="summary-description">${t("operations.pruneDescription")}</div>
                </div>
                <button id="external-api-prune" type="button">${t("operations.pruneLogs")}</button>
              </div>
            </div>
          </div>
          <div class="panel">
            <h2>${t("operations.runState")}</h2>
            <table class="status-table">
              <tbody>
                <tr><td>${t("dashboard.adminSession")}</td><td>${t("status.required")}</td></tr>
                <tr><td>${t("operations.internalBearerToken")}</td><td>${t("settings.settingsOnly")}</td></tr>
                <tr><td>${t("settings.secretExposure")}</td><td>${t("settings.neverShown")}</td></tr>
                <tr><td>${t("common.actionResult")}</td><td>${t("settings.shownStatus")}</td></tr>
              </tbody>
            </table>
            <div class="security-item">
              <div class="settings-title">${t("settings.credentialBoundary")}</div>
              <div class="settings-description">${t("operations.tokenDescription")}</div>
            </div>
          </div>
        </div>
      </section>
      </section>

      <section class="page" id="page-audit" data-admin-page="audit">
      <section id="audit-section" class="section">
        <div class="section-head">
          <div>
            <h2>${t("audit.title")}</h2>
            <p class="subtle">Recent operator-facing results and hub event audit details.</p>
          </div>
        </div>
        <div class="section-body">
          <div class="panel" id="admin-audit-activity">
            <h2>${t("audit.recent")}</h2>
            <div class="activity-list">
              <div class="activity-item">
                <div class="activity-title">${t("dashboard.adminSession")}</div>
                <div class="activity-description">${t("dashboard.loginDescription")}</div>
              </div>
              <div class="activity-item">
                <div class="activity-title">${t("dashboard.hubEventChanges")}</div>
                <div class="activity-description">${t("hubEvent.auditDescription")}</div>
              </div>
              <div class="activity-item">
                <div class="activity-title">${t("dashboard.adapterRefresh")}</div>
                <div class="activity-description">${t("dashboard.refreshDescription")}</div>
              </div>
              <div class="activity-item">
                <div class="activity-title">${t("dashboard.internalOperations")}</div>
                <div class="activity-description">${t("dashboard.operationsDescription")}</div>
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
            <h2>${t("nav.settings")}</h2>
            <p class="subtle">${t("settings.description")}</p>
          </div>
        </div>
        <div class="section-body settings-layout">
          <div class="settings-column">
          <div class="token-input-card panel">
            <div class="credential-head">
              <div>
                <h2>${t("settings.internalToken")}</h2>
                <p class="subtle">${t("settings.internalTokenHelp")}</p>
              </div>
              <span class="credential-badge">${t("settings.sessionOnly")}</span>
            </div>
            <div class="field">
              <label class="has-tooltip" data-tooltip="Store the internal API bearer token in this browser session only." title="Store the internal API bearer token in this browser session only." for="internal-token">${t("settings.internalToken")}</label>
              <div class="credential-input-wrap">
                <span class="credential-icon" aria-hidden="true">lock</span>
                <input id="internal-token" type="password" autocomplete="off" spellcheck="false" placeholder="Required for /v1/internal/* requests">
                <span class="credential-input-badge">${t("common.private")}</span>
              </div>
            </div>
            <div class="settings-actions">
              <button id="internal-token-save" type="button">${t("settings.useToken")}</button>
              <button id="internal-token-test" type="button">${t("settings.testConnection")}</button>
              <button id="internal-token-clear" type="button">${t("common.clear")}</button>
            </div>
            <p id="settings-token-status" class="message" aria-live="polite"></p>
          </div>
          <div class="panel">
            <h2>${t("settings.securityNotes")}</h2>
            <div class="security-grid">
              <div class="security-item">
                <div class="settings-title">Admin session first</div>
                <div class="settings-description">${t("settings.sessionDescription")}</div>
              </div>
              <div class="security-item">
                <div class="settings-title">${t("settings.internalTokenLater")}</div>
                <div class="settings-description">${t("settings.bearerDescription")}</div>
              </div>
              <div class="security-item">
                <div class="settings-title">${t("settings.noBundledAssets")}</div>
                <div class="settings-description">${t("settings.assetsDescription")}</div>
              </div>
            </div>
          </div>
          </div>
          <div class="settings-column">
          <div class="panel">
            <h2>${t("settings.consolePreferences")}</h2>
            <div class="settings-stack">
              <div class="settings-row">
                <div class="settings-title">${t("theme.label")}</div>
                <div class="settings-description">${t("settings.themeDescription")}</div>
                ${renderAdminThemeControl(themeLabels)}
              </div>
              <div class="settings-row">
                <div class="settings-title">${t("dashboard.autoRefresh")}</div>
                <label class="switch-control">
                  <span>${t("settings.refreshDashboard")}</span>
                  <input id="auto-refresh" class="auto-refresh-input" type="checkbox">
                  <span class="auto-refresh-switch" aria-hidden="true"></span>
                </label>
                <span id="auto-refresh-status" class="auto-refresh-status pill disabled" aria-live="polite">Off</span>
              </div>
              <div class="settings-row">
                <div class="settings-title">${t("settings.hubEventPageSize")}</div>
                <div class="field">
                  <label for="hub-event-page-size">${t("settings.eventsPerPage")}</label>
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
            <h2>${t("settings.recommendedRouting")}</h2>
            <div class="security-grid">
              <div class="security-item">
                <div class="settings-title">${t("nav.dashboard")}</div>
                <div class="settings-description">${t("settings.dashboardRouting")}</div>
              </div>
              <div class="security-item">
                <div class="settings-title">${t("nav.operations")}</div>
                <div class="settings-description">${t("settings.operationsRouting")}</div>
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
    const adminCatalog = ${serializeAdminCatalog(locale)};
    const adminIntlLocale = ${JSON.stringify(adminIntlLocale(locale))};
    const adminTimeZone = "Asia/Seoul";
    const adminNumberFormatter = new Intl.NumberFormat(adminIntlLocale);
    function t(key, parameters) {
      const template = adminCatalog[key] || key;
      return template.replace(/\{([A-Za-z0-9_]+)\}/g, function (match, name) {
        return parameters && Object.prototype.hasOwnProperty.call(parameters, name) ? String(parameters[name]) : match;
      });
    }
    const endpoints = {
      overview: "/v1/internal/admin/overview",
      externalApiCalls: "/v1/internal/admin/external-api-calls",
      externalApiPrune: "/v1/internal/admin/external-api-calls/prune",
      drainJobs: "/v1/internal/jobs/notifications/drain",
      renewYoutube: "/v1/internal/schedulers/youtube/renew-subscriptions",
        pollChzzk: "/v1/internal/schedulers/chzzk/live-status",
        hubEvents: "/v1/admin/hub-events",
        announcements: "/v1/admin/announcements",
        recalculateSpecialDays: "/v1/admin/hub-events/special-days/recalculate-status"
      };

    const overviewRoot = document.getElementById("overview");
    const dailyQueueSectionRoot = document.getElementById("daily-queue-section");
    const dailyQueueChartRoot = document.getElementById("daily-queue-chart");
    const dailyQueueSummaryRoot = document.getElementById("daily-queue-summary");
    const dailyQueueAccessibleListRoot = document.getElementById("daily-queue-accessible-list");
    const externalApiSectionRoot = document.getElementById("external-api-section");
    const externalApiChartCardRoot = document.getElementById("external-api-chart-card");
    const externalApiChartRoot = document.getElementById("external-api-chart");
    const externalApiTooltipRoot = document.getElementById("external-api-tooltip");
    const externalApiLegendRoot = document.getElementById("external-api-legend");
    const externalApiSummaryRoot = document.getElementById("external-api-summary");
    const externalApiResultsRoot = document.getElementById("external-api-results");
    const externalApiAccessibleListRoot = document.getElementById("external-api-accessible-list");
    const externalApiSourceFilter = document.getElementById("external-api-source-filter");
    const externalApiStatusFilter = document.getElementById("external-api-status-filter");
    const externalApiResultsRefreshButton = document.getElementById("external-api-results-refresh");
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
    const autoRefreshIntervalMs = 30000;
    const autoRefreshLabel = "Every " + (autoRefreshIntervalMs / 1000) + "s";
    let autoRefreshTimer = null;
    let refreshInFlight = false;
    let actionInFlight = false;
    let uptimeValueRoot = null;
    let uptimeBaseSeconds = null;
    let uptimeBaseTimestamp = 0;
    let uptimeTimerId = null;
    const activePageStorageKey = "stellive.admin.activePage";
    const pageCopy = {
      dashboard: [t("nav.dashboard"), t("page.dashboardDescription")],
      "hub-events": [t("nav.hubEvents"), t("page.hubEventsDescription")],
      announcements: [t("nav.announcements"), t("page.announcementsDescription")],
      operations: [t("nav.operations"), t("page.operationsDescription")],
      audit: [t("nav.audit"), t("page.auditDescription")],
      settings: [t("nav.settings"), t("page.settingsDescription")]
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
      try {
        window.localStorage.setItem(activePageStorageKey, nextPage);
      } catch (_error) {
        // Page restoration is optional when browser storage is unavailable.
      }
    }

    function requireToken() {
      const token = (tokenInput?.value || "").trim() || readStoredInternalToken().trim();
      if (!token) {
        throw new Error(t("error.internalTokenRequired"));
      }
      return token;
    }

    const displayValueKeys = {
      draft: "status.draft", published: "status.published", archived: "status.archived", resolved: "status.resolved",
      enabled: "status.enabled", disabled: "status.disabled", healthy: "status.healthy", failed: "status.failed",
      open: "status.open", ended: "status.ended", cancelled: "status.cancelled", inactive: "status.inactive",
      deleted: "status.deleted", blocked: "status.blocked", queued: "status.queued", sent: "status.sent", skipped: "status.skipped",
      general: "enum.general", incident: "enum.incident", maintenance: "enum.maintenance", version_update: "enum.versionUpdate",
      info: "enum.info", important: "enum.important", critical: "enum.critical"
    };

    function displayValue(value) {
      const normalized = String(value == null ? "" : value);
      return displayValueKeys[normalized] ? t(displayValueKeys[normalized]) : normalized;
    }

    function createPill(value) {
      const span = document.createElement("span");
      span.className = "pill " + String(value).replaceAll("_", "-");
      span.textContent = displayValue(value);
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

    function createOverviewPanel(title, valueNode, hint) {
      const section = document.createElement("section");
      section.className = "panel overview-card";

      const label = document.createElement("div");
      label.className = "metric-label";
      label.textContent = title;

      const value = document.createElement("h2");
      if (valueNode instanceof Node) {
        value.appendChild(valueNode);
      } else {
        value.textContent = valueNode == null || valueNode === "" ? "-" : String(valueNode);
      }

      const detail = document.createElement("div");
      detail.className = "metric-hint";
      detail.textContent = hint || "";

      section.append(label, value, detail);

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
      const missing = queue && queue.missingJobCount != null ? queue.missingJobCount : 0;
      return queued + " queued / " + locked + " locked / " + failed + " failed / " + missing + " missing jobs";
    }

    function formatDeliveryState(recentDelivery) {
      const sent = recentDelivery && recentDelivery.sent != null ? recentDelivery.sent : 0;
      const skipped = recentDelivery && recentDelivery.skipped != null ? recentDelivery.skipped : 0;
      const failed = recentDelivery && recentDelivery.failed != null ? recentDelivery.failed : 0;
      return sent + " sent / " + skipped + " skipped / " + failed + " failed";
    }

    function numericValue(value) {
      const next = Number(value);
      return Number.isFinite(next) && next >= 0 ? next : 0;
    }

    function formatNumber(value) {
      return adminNumberFormatter.format(numericValue(value));
    }

    function shortDateLabel(dateKey) {
      const date = new Date(String(dateKey || "") + "T00:00:00+09:00");
      return Number.isNaN(date.getTime()) ? String(dateKey || "-") : new Intl.DateTimeFormat(adminIntlLocale, {
        month: "2-digit", day: "2-digit", timeZone: adminTimeZone
      }).format(date);
    }

    function formatFailureRate(totals) {
      const total = numericValue(totals && totals.total);
      if (total === 0) return "0%";
      return ((numericValue(totals.failed) / total) * 100).toFixed(1) + "%";
    }

    function createQueueSummaryCard(label, value, description) {
      const card = document.createElement("div");
      card.className = "queue-summary-card";
      const labelNode = document.createElement("div");
      labelNode.className = "queue-summary-label";
      labelNode.textContent = label;
      const valueNode = document.createElement("div");
      valueNode.className = "queue-summary-value";
      valueNode.textContent = value == null || value === "" ? "-" : typeof value === "number" ? formatNumber(value) : String(value);
      const descriptionNode = document.createElement("div");
      descriptionNode.className = "metric-hint";
      descriptionNode.textContent = description || "";
      card.append(labelNode, valueNode, descriptionNode);
      return card;
    }

    function createQueueBarSegment(status, value, maxTotal) {
      const segment = document.createElement("span");
      segment.className = "queue-bar-segment " + status;
      segment.style.height = value > 0 ? Math.max((value / maxTotal) * 100, 2) + "%" : "0";
      segment.setAttribute("aria-hidden", "true");
      return segment;
    }

    function renderDailyQueueChart(trend) {
      const items = trend && Array.isArray(trend.items) ? trend.items : [];
      const totals = trend && trend.totals ? trend.totals : { sent: 0, queued: 0, skipped: 0, failed: 0, total: 0 };
      dailyQueueSectionRoot.classList.remove("is-empty");
      dailyQueueChartRoot.replaceChildren();
      dailyQueueSummaryRoot.replaceChildren();
      dailyQueueAccessibleListRoot.replaceChildren();

      if (items.length === 0) {
        const empty = document.createElement("div");
        empty.className = "daily-queue-empty";
        empty.textContent = "No delivery attempts in the selected window.";
        dailyQueueChartRoot.appendChild(empty);
        dailyQueueSummaryRoot.append(
          createQueueSummaryCard("14d total", "0", "No delivery attempts returned."),
          createQueueSummaryCard("Failure rate", "0%", "Failed delivery attempts over total attempts.")
        );
        return;
      }

      const maxTotal = Math.max(1, ...items.map(function (item) { return numericValue(item.total); }));
      let peak = items[0];
      for (const item of items) {
        if (numericValue(item.total) > numericValue(peak.total)) {
          peak = item;
        }

        const bar = document.createElement("div");
        bar.className = "queue-bar";
        bar.setAttribute(
          "aria-label",
          item.date + ": " + formatNumber(item.sent) + " sent, " + formatNumber(item.queued) + " queued, " +
            formatNumber(item.skipped) + " skipped, " + formatNumber(item.failed) + " failed"
        );
        bar.title = bar.getAttribute("aria-label") || "";

        const stack = document.createElement("div");
        stack.className = "queue-bar-stack";
        stack.append(
          createQueueBarSegment("sent", numericValue(item.sent), maxTotal),
          createQueueBarSegment("queued", numericValue(item.queued), maxTotal),
          createQueueBarSegment("skipped", numericValue(item.skipped), maxTotal),
          createQueueBarSegment("failed", numericValue(item.failed), maxTotal)
        );

        const label = document.createElement("div");
        label.className = "queue-bar-label";
        label.textContent = shortDateLabel(item.date);
        bar.append(stack, label);
        dailyQueueChartRoot.appendChild(bar);

        const accessibleItem = document.createElement("li");
        accessibleItem.textContent = bar.getAttribute("aria-label") || "";
        dailyQueueAccessibleListRoot.appendChild(accessibleItem);
      }

      const today = items[items.length - 1] || { sent: 0, failed: 0 };
      dailyQueueSummaryRoot.append(
        createQueueSummaryCard("Today sent", numericValue(today.sent), "KST date bucket."),
        createQueueSummaryCard("Today failed", numericValue(today.failed), "Failed attempts today."),
        createQueueSummaryCard((trend.days || items.length) + "d total", numericValue(totals.total), "Sent, queued, skipped, and failed."),
        createQueueSummaryCard("Failure rate", formatFailureRate(totals), "Failed attempts over total attempts."),
        createQueueSummaryCard("Peak day", shortDateLabel(peak.date), formatNumber(peak.total) + " attempts")
      );
    }

    function apiSourceClass(source) {
      if (source === "youtube") return "api-source-youtube";
      if (source === "chzzk") return "api-source-chzzk";
      if (source === "fcm") return "api-source-fcm";
      if (source === "websub") return "api-source-websub";
      return "api-source-other";
    }

    function externalApiTooltipSources(item, visibleSources) {
      const knownSources = ["youtube", "chzzk", "fcm", "websub", "other"];
      const sources = Array.from(new Set(knownSources.concat(visibleSources || [])));
      return sources.sort(function (left, right) {
        const countDifference = numericValue(item.bySource && item.bySource[right]) - numericValue(item.bySource && item.bySource[left]);
        return countDifference || left.localeCompare(right);
      });
    }

    function positionExternalApiTooltip(bar) {
      const cardRect = externalApiChartCardRoot.getBoundingClientRect();
      const barRect = bar.getBoundingClientRect();
      const tooltipRect = externalApiTooltipRoot.getBoundingClientRect();
      const preferredLeft = barRect.left - cardRect.left + (barRect.width / 2) - (tooltipRect.width / 2);
      const maxLeft = Math.max(8, cardRect.width - tooltipRect.width - 8);
      const left = Math.min(Math.max(8, preferredLeft), maxLeft);
      const above = barRect.top - cardRect.top - tooltipRect.height - 10;
      const below = barRect.bottom - cardRect.top + 10;
      const maxTop = Math.max(8, cardRect.height - tooltipRect.height - 8);
      const top = Math.min(Math.max(8, above >= 8 ? above : below), maxTop);
      externalApiTooltipRoot.style.left = left + "px";
      externalApiTooltipRoot.style.top = top + "px";
    }

    function hideExternalApiTooltip() {
      externalApiTooltipRoot.hidden = true;
      externalApiTooltipRoot.replaceChildren();
    }

    function showExternalApiTooltip(bar, item, visibleSources) {
      const date = document.createElement("div");
      date.className = "external-api-tooltip-date";
      date.textContent = item.date || "-";

      const total = document.createElement("div");
      total.className = "external-api-tooltip-total";
      const totalLabel = document.createElement("span");
      totalLabel.textContent = "Total calls";
      const totalValue = document.createElement("strong");
      totalValue.textContent = formatNumber(item.total);
      total.append(totalLabel, totalValue);

      const rows = document.createElement("div");
      for (const source of externalApiTooltipSources(item, visibleSources)) {
        const row = document.createElement("div");
        row.className = "external-api-tooltip-row";
        const sourceLabel = document.createElement("span");
        sourceLabel.className = "external-api-tooltip-source";
        const dot = document.createElement("i");
        dot.className = "external-api-tooltip-dot " + apiSourceClass(source);
        dot.setAttribute("aria-hidden", "true");
        sourceLabel.append(dot, document.createTextNode(source));
        const count = document.createElement("strong");
        count.textContent = formatNumber(item.bySource && item.bySource[source]);
        row.append(sourceLabel, count);
        rows.appendChild(row);
      }

      externalApiTooltipRoot.replaceChildren(date, total, rows);
      externalApiTooltipRoot.hidden = false;
      positionExternalApiTooltip(bar);
    }

    function renderExternalApiChart(trend) {
      const items = trend && Array.isArray(trend.items) ? trend.items : [];
      const totals = trend && trend.totals ? trend.totals : { total: 0, ok: 0, failed: 0, rateLimited: 0, quotaExceeded: 0, quotaUnits: 0, bySource: {} };
      externalApiSectionRoot.classList.remove("is-empty");
      externalApiChartRoot.replaceChildren();
      externalApiLegendRoot.replaceChildren();
      externalApiSummaryRoot.replaceChildren();
      externalApiAccessibleListRoot.replaceChildren();
      hideExternalApiTooltip();

      const sources = Object.keys(totals.bySource || {}).sort(function (a, b) {
        return numericValue(totals.bySource[b]) - numericValue(totals.bySource[a]);
      });
      const visibleSources = sources.length > 0 ? sources : ["youtube", "chzzk", "fcm", "websub", "other"];

      for (const source of visibleSources) {
        const entry = document.createElement("span");
        const dot = document.createElement("i");
        dot.className = "legend-dot " + apiSourceClass(source);
        dot.setAttribute("aria-hidden", "true");
        entry.append(dot, document.createTextNode(source));
        externalApiLegendRoot.appendChild(entry);
      }

      if (items.length === 0) {
        const empty = document.createElement("div");
        empty.className = "daily-queue-empty";
        empty.textContent = "No external API calls in the selected window.";
        externalApiChartRoot.appendChild(empty);
      } else {
        const maxTotal = Math.max(1, ...items.map(function (item) { return numericValue(item.total); }));
        for (const item of items) {
          const bar = document.createElement("div");
          bar.className = "queue-bar";
          bar.tabIndex = 0;
          bar.setAttribute("aria-describedby", "external-api-tooltip");
          bar.setAttribute("aria-label", item.date + ": " + numericValue(item.total) + " external API calls");
          bar.title = bar.getAttribute("aria-label") || "";
          const stack = document.createElement("div");
          stack.className = "queue-bar-stack";
          for (const source of visibleSources) {
            const count = numericValue(item.bySource && item.bySource[source]);
            if (count === 0) continue;
            const segment = document.createElement("span");
            segment.className = "queue-bar-segment " + apiSourceClass(source);
            segment.style.height = Math.max((count / maxTotal) * 100, 2) + "%";
            segment.setAttribute("aria-hidden", "true");
            stack.appendChild(segment);
          }
          const label = document.createElement("div");
          label.className = "queue-bar-label";
          label.textContent = shortDateLabel(item.date);
          bar.append(stack, label);
          bar.addEventListener("mouseenter", function () {
            showExternalApiTooltip(bar, item, visibleSources);
          });
          bar.addEventListener("mouseleave", hideExternalApiTooltip);
          bar.addEventListener("focus", function () {
            showExternalApiTooltip(bar, item, visibleSources);
          });
          bar.addEventListener("blur", hideExternalApiTooltip);
          bar.addEventListener("keydown", function (event) {
            if (event.key === "Escape") {
              hideExternalApiTooltip();
              bar.blur();
            }
          });
          externalApiChartRoot.appendChild(bar);
          const accessibleItem = document.createElement("li");
          accessibleItem.textContent = bar.getAttribute("aria-label") || "";
          externalApiAccessibleListRoot.appendChild(accessibleItem);
        }
      }

      const today = items[items.length - 1] || { total: 0, rateLimited: 0, quotaUnits: 0 };
      const successRate = numericValue(totals.total) === 0 ? "0%" : ((numericValue(totals.ok) / numericValue(totals.total)) * 100).toFixed(1) + "%";
      externalApiSummaryRoot.append(
        createQueueSummaryCard("Today total", numericValue(today.total), "Outbound API calls today."),
        createQueueSummaryCard("Success rate", successRate, "ok and not_modified over total."),
        createQueueSummaryCard(
          "Tracked quota today",
          numericValue(today.quotaUnits),
          "Tracked quotaUnits from YouTube list API requests today."
        ),
        createQueueSummaryCard(
          "Tracked quota · 14 days",
          numericValue(totals.quotaUnits),
          "Tracked quotaUnits across the visible 14-day trend."
        )
      );
    }

    function renderExternalApiNotice(message) {
      externalApiResultsRoot.replaceChildren();
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 7;
      cell.className = "empty";
      cell.textContent = message;
      row.appendChild(cell);
      externalApiResultsRoot.appendChild(row);
    }

    function formatDate(value) {
      if (!value) return "-";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "-";
      return date.toLocaleString(adminIntlLocale, { timeZone: adminTimeZone });
    }

    function renderExternalApiResults(items) {
      externalApiResultsRoot.replaceChildren();
      if (!Array.isArray(items) || items.length === 0) {
        renderExternalApiNotice("No external API results in the last 31 days.");
        return;
      }
      for (const item of items) {
        const row = document.createElement("tr");
        const values = [
          formatDate(item.requestedAt),
          item.source || "-",
          item.operation || "-",
          item.resultStatus || "-",
          item.statusCode == null ? "-" : String(item.statusCode),
          item.durationMs == null ? "-" : item.durationMs + "ms",
          item.quotaUnits == null ? "0" : String(item.quotaUnits)
        ];
        for (const value of values) {
          const cell = document.createElement("td");
          cell.textContent = value;
          row.appendChild(cell);
        }
        externalApiResultsRoot.appendChild(row);
      }
    }

    async function refreshExternalApiResults() {
      try {
        requireToken();
      } catch (_error) {
        renderExternalApiNotice("Add the Internal API bearer token in Settings to load recent external API results.");
        return;
      }
      const params = new URLSearchParams({ limit: "50" });
      if (externalApiSourceFilter.value) params.set("source", externalApiSourceFilter.value);
      if (externalApiStatusFilter.value) params.set("resultStatus", externalApiStatusFilter.value);
      try {
        const result = await api(endpoints.externalApiCalls + "?" + params.toString());
        renderExternalApiResults(result.items || []);
      } catch (error) {
        renderExternalApiNotice(error instanceof Error ? error.message : t("dashboard.externalResultsError"));
      }
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
      overviewRoot.classList.remove("is-empty");
      overviewRoot.replaceChildren(
        createOverviewPanel("Health", createPill(data.database.status), data.service.name),
        createOverviewPanel("Database", data.database.status || "-", data.database.reason || "-"),
        createOverviewPanel("Uptime", createUptimeNode(data.service.uptimeSeconds), "service uptime"),
        createOverviewPanel(
          "Queue",
          data.queue.queued == null ? "-" : String(data.queue.queued),
          (data.queue.failed == null ? "0" : String(data.queue.failed)) + " failed / " +
            (data.queue.missingJobCount == null ? "0" : String(data.queue.missingJobCount)) + " missing jobs"
        ),
        createOverviewPanel(
          "Events",
          data.recentDelivery.sent == null ? "-" : String(data.recentDelivery.sent),
          (data.recentDelivery.failed == null ? "0" : String(data.recentDelivery.failed)) + " failed"
        )
      );
      renderDailyQueueChart(data.dailyDeliveryQueue);
      renderExternalApiChart(data.externalApiCalls && data.externalApiCalls.daily);
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

      return date.toLocaleString(adminIntlLocale, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "short",
        timeZone: adminTimeZone
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
        setMessage(t("dashboard.loading"), false);
      } else {
        setAutoRefreshStatus(autoRefreshLabel);
      }

      try {
        const overview = await api(endpoints.overview);
        renderOverview(overview);
        renderAdapters(overview.adapters || []);
        renderSecrets(overview.secrets || {});
        renderFeatureFlags(overview.featureFlags || {});
        if (source === "manual") {
          await refreshExternalApiResults();
        }
        if (source === "manual") {
          setMessage(t("dashboard.refreshed"), false);
        }
        if (autoRefreshInput.checked) {
          setAutoRefreshStatus(autoRefreshLabel);
        }
      } catch (error) {
        if (!overviewRoot.children.length) {
          overviewRoot.classList.add("is-empty");
        }
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
      setAutoRefreshStatus(autoRefreshLabel);
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
      setMessage(t("operations.inProgress", { action: label }), false);
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
      tags: document.getElementById("hub-event-tag-album"),
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
      scheduleMode: document.getElementById("hub-event-schedule-mode"),
      startsAt: document.getElementById("hub-event-starts-at"),
      endsAt: document.getElementById("hub-event-ends-at"),
      venueName: document.getElementById("hub-event-venue-name"),
      venueAddress: document.getElementById("hub-event-venue-address"),
      notificationEligible: document.getElementById("hub-event-notification-eligible")
    };
    const hubEventListRoot = document.getElementById("hub-event-list");
    const hubEventValidationRoot = document.getElementById("hub-event-validation");
    const hubEventAuditRoot = document.getElementById("hub-event-audit-log");
    const hubEventSingleWindowFields = document.getElementById("hub-event-single-window-fields");
    const hubEventTimelineFields = document.getElementById("hub-event-timeline-fields");
    const hubEventScheduleItemsRoot = document.getElementById("hub-event-schedule-items");
    const hubEventScheduleTab = document.getElementById("hub-event-schedule-tab");
    const hubEventScheduleDialog = document.getElementById("hub-event-schedule-dialog");
    const hubEventScheduleForm = document.getElementById("hub-event-schedule-form");
    const hubEventLinksRoot = document.getElementById("hub-event-links");
    const hubEventScheduleLinksRoot = document.getElementById("hub-event-schedule-links");
    const hubEventLinkCount = document.getElementById("hub-event-link-count");
    const hubEventScheduleLinkCount = document.getElementById("hub-event-schedule-link-count");
    const hubEventStateFilter = document.getElementById("hub-event-state-filter");
    const hubEventStatusFilter = document.getElementById("hub-event-status-filter");
    const hubEventCategoryFilter = document.getElementById("hub-event-category-filter");
    const hubEventTagFilter = document.getElementById("hub-event-tag-filter");
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
    let singleWindowScheduleItemId = "";
    let currentHubEvent = null;
    let hubEventScheduleItems = [];
    let parentDirty = false;
    let scheduleDirty = false;
    hubEventScheduleTab.textContent = t("hubEvent.scheduleTab", { count: 0 });

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

    function toScheduleDate(value, timezone) {
      if (!value) return "";
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10);
      try {
        return new Intl.DateTimeFormat("en-CA", {
          timeZone: timezone || "Asia/Seoul",
          year: "numeric",
          month: "2-digit",
          day: "2-digit"
        }).format(parsed);
      } catch (_error) {
        return String(value).slice(0, 10);
      }
    }

    function scheduleItemId() {
      if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
      return "schedule-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
    }

    function linkKindOptions(selected) {
      return [
        ["source", t("hubEvent.linkKindSource")], ["purchase", t("hubEvent.linkKindPurchase")], ["ticket", t("hubEvent.linkKindTicket")],
        ["reservation", t("hubEvent.linkKindReservation")], ["content", t("hubEvent.linkKindContent")], ["video", t("hubEvent.linkKindVideo")],
        ["map", t("hubEvent.linkKindMap")], ["custom", t("hubEvent.linkKindCustom")]
      ].map(function (entry) {
        return '<option value="' + entry[0] + '"' + (entry[0] === selected ? " selected" : "") + ">" + entry[1] + "</option>";
      }).join("");
    }

    function createLinkEditorRow(link) {
      const value = link || {};
      const row = document.createElement("div");
      row.className = "hub-event-link-row";
      if (value.id) row.dataset.linkId = value.id;

      const kindField = document.createElement("div"); kindField.className = "field";
      const kindLabel = document.createElement("label"); kindLabel.textContent = t("hubEvent.linkKind");
      const kind = document.createElement("select"); kind.dataset.linkField = "kind"; kind.innerHTML = linkKindOptions(value.kind || "source");
      kindField.append(kindLabel, kind);

      const labelField = document.createElement("div"); labelField.className = "field";
      const labelLabel = document.createElement("label"); labelLabel.textContent = t("hubEvent.linkLabel");
      const label = document.createElement("input"); label.dataset.linkField = "label"; label.maxLength = 80; label.value = value.label || ""; label.placeholder = t("hubEvent.linkOptional");
      labelField.append(labelLabel, label);

      const urlField = document.createElement("div"); urlField.className = "field";
      const urlLabel = document.createElement("label"); urlLabel.textContent = t("hubEvent.linkHttpsUrl");
      const url = document.createElement("input"); url.dataset.linkField = "url"; url.type = "url"; url.required = true; url.pattern = "https://.*"; url.value = value.url || "";
      urlField.append(urlLabel, url);

      const actions = document.createElement("div"); actions.className = "hub-event-link-actions";
      const up = document.createElement("button"); up.type = "button"; up.textContent = "↑"; up.setAttribute("aria-label", t("hubEvent.linkMoveUp"));
      const down = document.createElement("button"); down.type = "button"; down.textContent = "↓"; down.setAttribute("aria-label", t("hubEvent.linkMoveDown"));
      const remove = document.createElement("button"); remove.type = "button"; remove.className = "hub-event-link-remove"; remove.textContent = t("hubEvent.linkRemove");
      up.addEventListener("click", function () { moveLinkEditorRow(row, -1); });
      down.addEventListener("click", function () { moveLinkEditorRow(row, 1); });
      remove.addEventListener("click", function () {
        const isParentLink = row.parentElement === hubEventLinksRoot;
        row.remove();
        updateLinkEditorCount(isParentLink ? hubEventLinksRoot : hubEventScheduleLinksRoot);
        if (isParentLink) parentDirty = true;
        else scheduleDirty = true;
      });
      actions.append(up, down, remove);
      function syncCustomLabel() { label.required = kind.value === "custom"; label.placeholder = label.required ? t("hubEvent.linkCustomLabelRequired") : t("hubEvent.linkOptional"); }
      kind.addEventListener("change", syncCustomLabel);
      syncCustomLabel();
      row.append(kindField, labelField, urlField, actions);
      return row;
    }

    function updateLinkEditorCount(root) {
      const count = root.querySelectorAll(".hub-event-link-row").length;
      (root === hubEventLinksRoot ? hubEventLinkCount : hubEventScheduleLinkCount).textContent = String(count);
    }

    function moveLinkEditorRow(row, delta) {
      const root = row.parentElement;
      if (!root) return;
      const rows = Array.from(root.querySelectorAll(".hub-event-link-row"));
      const index = rows.indexOf(row);
      const nextIndex = index + delta;
      if (index < 0 || nextIndex < 0 || nextIndex >= rows.length) return;
      if (delta < 0) root.insertBefore(row, rows[nextIndex]);
      else root.insertBefore(rows[nextIndex], row);
      if (root === hubEventLinksRoot) parentDirty = true;
      else scheduleDirty = true;
    }

    function renderLinkEditor(root, links) {
      root.replaceChildren();
      (links || []).forEach(function (link) { root.appendChild(createLinkEditorRow(link)); });
      updateLinkEditorCount(root);
    }

    function collectLinkEditor(root) {
      return Array.from(root.querySelectorAll(".hub-event-link-row")).map(function (row, index) {
        const result = {
          kind: row.querySelector('[data-link-field="kind"]').value,
          url: row.querySelector('[data-link-field="url"]').value.trim(),
          sortOrder: index
        };
        const id = row.dataset.linkId;
        const label = row.querySelector('[data-link-field="label"]').value.trim();
        if (id) result.id = id;
        if (label) result.label = label;
        return result;
      });
    }

    function parentEditorLinks(event) {
      if (Array.isArray(event.links) && event.links.length) return event.links;
      return [
        event.purchaseUrl ? { kind: "purchase", url: event.purchaseUrl, sortOrder: 0 } : null,
        event.ticketUrl ? { kind: "ticket", url: event.ticketUrl, sortOrder: 1 } : null,
        event.sourceUrl ? { kind: "source", label: event.sourceLabel, url: event.sourceUrl, sortOrder: 2 } : null
      ].filter(Boolean);
    }

    function scheduleEditorLinks(item) {
      if (Array.isArray(item.links) && item.links.length) return item.links;
      const actionKinds = { sales_open: "purchase", ticket_open: "ticket", deadline: "reservation", main_window: "reservation", announcement: "source" };
      return [
        item.actionUrl ? { kind: actionKinds[item.kind] || "content", url: item.actionUrl, sortOrder: 0 } : null,
        item.sourceUrl ? { kind: "source", label: item.sourceLabel, url: item.sourceUrl, sortOrder: 1 } : null
      ].filter(Boolean);
    }

    function scheduleKindOptions(selected) {
      return [
        ["main_window", "Main window"], ["announcement", "Announcement"], ["sales_open", "Sales open"],
        ["ticket_open", "Ticket open"], ["content_reveal", "Content reveal"], ["release", "Release"],
        ["deadline", "Deadline"], ["custom", "Custom"]
      ].map(function (entry) {
        return '<option value="' + entry[0] + '"' + (entry[0] === selected ? " selected" : "") + ">" + entry[1] + "</option>";
      }).join("");
    }

    function scheduleKindLabel(kind) {
      const keys = {
        main_window: "hubEvent.kindMainWindow",
        announcement: "hubEvent.kindAnnouncement",
        sales_open: "hubEvent.kindSalesOpen",
        ticket_open: "hubEvent.kindTicketOpen",
        content_reveal: "hubEvent.kindContentReveal",
        release: "hubEvent.kindRelease",
        deadline: "hubEvent.kindDeadline",
        custom: "hubEvent.kindCustom"
      };
      return keys[kind] ? t(keys[kind]) : kind;
    }

    function setScheduleDateInputType(precision) {
      [document.getElementById("hub-event-schedule-starts-at"), document.getElementById("hub-event-schedule-ends-at")].forEach(function (input) {
        const previous = input.value;
        input.type = precision === "date" ? "date" : "datetime-local";
        if (precision === "date" && previous) input.value = previous.slice(0, 10);
      });
    }

    function setScheduleTimingUi(timing) {
      const period = timing === "period";
      const endsAtField = document.getElementById("hub-event-schedule-ends-at-field");
      const endsAtInput = document.getElementById("hub-event-schedule-ends-at");
      endsAtField.classList.toggle("hub-event-schedule-hidden", !period);
      endsAtInput.disabled = !period;
      endsAtInput.required = period;
      document.getElementById("hub-event-schedule-starts-at-label").textContent = period
        ? t("hubEvent.startsAt")
        : t("hubEvent.occursAt");
    }

    function createScheduleRow(item, effectivePrimaryId) {
      const value = item || {};
      const row = document.createElement("div");
      row.className = "hub-event-schedule-row";
      row.dataset.scheduleItemId = value.id || "";
      row.classList.toggle("is-cancelled", Boolean(value.cancelledAt));
      const summary = document.createElement("div");
      summary.className = "hub-event-schedule-summary";
      const title = document.createElement("strong");
      const displayTitle = String(value.title || "").trim() || String(value.label || "").trim();
      title.textContent = displayTitle || t("hubEvent.untitled");
      const description = String(value.description || "").trim();
      const timing = document.createElement("span");
      timing.className = "subtle";
      timing.textContent = [value.startsAt ? formatLastCheckedAt(value.startsAt) : "-", value.endsAt ? formatLastCheckedAt(value.endsAt) : ""].filter(Boolean).join(" - ");
      const meta = document.createElement("div");
      meta.className = "hub-event-schedule-meta";
      const linkCount = scheduleEditorLinks(value).length;
      [scheduleKindLabel(value.kind), value.endsAt ? t("hubEvent.schedulePeriod") : t("hubEvent.schedulePoint"), value.cancelledAt ? t("hubEvent.scheduleCancelled") : t("hubEvent.scheduleActive"), value.id === effectivePrimaryId ? t("hubEvent.schedulePrimary") : "", value.notificationEligible ? t("hubEvent.scheduleNotified") : "", linkCount ? t("hubEvent.scheduleLinkCount", { count: linkCount }) : "", value.label && String(value.label).trim() !== displayTitle ? t("hubEvent.scheduleShortLabelMeta", { label: String(value.label).trim() }) : ""].filter(Boolean).forEach(function (label) {
        const pill = document.createElement("span"); pill.textContent = label; meta.appendChild(pill);
      });
      summary.appendChild(title);
      if (description) {
        const descriptionText = document.createElement("span");
        descriptionText.className = "subtle";
        descriptionText.textContent = description;
        summary.appendChild(descriptionText);
      }
      summary.append(timing, meta);
      const actions = document.createElement("div");
      actions.className = "hub-event-schedule-row-actions";
      const primaryChoice = document.createElement("label"); primaryChoice.className = "hub-event-primary-choice";
      const primary = document.createElement("input"); primary.type = "radio"; primary.name = "hub-event-primary-schedule"; primary.checked = value.id === effectivePrimaryId; primary.disabled = Boolean(value.cancelledAt);
      primary.setAttribute("aria-label", t("hubEvent.setPrimaryAria", { title: displayTitle || t("hubEvent.untitled") }));
      primary.addEventListener("change", function () { if (primary.checked) runHubEventUiAction(t("hubEvent.schedulePrimary"), function () { return setPrimaryScheduleItem(value.id); }); });
      primaryChoice.append(primary, document.createTextNode(t("hubEvent.schedulePrimary")));
      const edit = document.createElement("button"); edit.type = "button"; edit.textContent = t("common.edit");
      edit.addEventListener("click", function () { openScheduleDialog({ ...value, isPrimary: value.id === effectivePrimaryId }); });
      const up = document.createElement("button"); up.type = "button"; up.textContent = "↑"; up.setAttribute("aria-label", t("hubEvent.moveUp"));
      up.addEventListener("click", function () { return runHubEventUiAction(t("hubEvent.moveUp"), function () { return reorderScheduleItem(value.id, -1); }); });
      const down = document.createElement("button"); down.type = "button"; down.textContent = "↓"; down.setAttribute("aria-label", t("hubEvent.moveDown"));
      down.addEventListener("click", function () { return runHubEventUiAction(t("hubEvent.moveDown"), function () { return reorderScheduleItem(value.id, 1); }); });
      const lifecycle = document.createElement("button"); lifecycle.type = "button";
      lifecycle.textContent = value.cancelledAt ? t("hubEvent.scheduleRestore") : t("hubEvent.scheduleCancel");
      lifecycle.addEventListener("click", function () {
        return runHubEventUiAction(lifecycle.textContent, function () { return value.cancelledAt ? restoreScheduleItem(value.id) : cancelScheduleItem(value.id); });
      });
      actions.append(primaryChoice, edit, up, down, lifecycle);
      row.append(summary, actions);
      return row;
    }

    function renderScheduleItems(items) {
      hubEventScheduleItems = (items || []).slice();
      hubEventScheduleItemsRoot.replaceChildren();
      const primaryItems = hubEventScheduleItems.filter(function (item) { return item.isPrimary && !item.cancelledAt; }).sort(function (left, right) {
        return (left.sortOrder || 0) - (right.sortOrder || 0)
          || new Date(left.startsAt || 0).getTime() - new Date(right.startsAt || 0).getTime()
          || new Date(left.createdAt || 0).getTime() - new Date(right.createdAt || 0).getTime()
          || String(left.id || "").localeCompare(String(right.id || ""));
      });
      const effectivePrimaryId = primaryItems[0]?.id || "";
      if (primaryItems.length > 1) {
        const warning = document.createElement("p"); warning.className = "message error"; warning.textContent = t("hubEvent.duplicatePrimaryWarning"); hubEventScheduleItemsRoot.appendChild(warning);
      }
      if (hubEventScheduleItems.length === 0) {
        const empty = document.createElement("p"); empty.className = "subtle"; empty.textContent = t("hubEvent.scheduleEmpty"); hubEventScheduleItemsRoot.appendChild(empty);
      } else {
        hubEventScheduleItems.forEach(function (item) { hubEventScheduleItemsRoot.appendChild(createScheduleRow(item, effectivePrimaryId)); });
      }
      hubEventScheduleTab.textContent = t("hubEvent.scheduleTab", { count: hubEventScheduleItems.length });
    }

    function updateScheduleModeUi() {
      const active = hubEventScheduleItems.filter(function (item) { return !item.cancelledAt; });
      const timeline = active.length >= 2 || active.some(function (item) { return item.kind !== "main_window"; });
      hubEventFields.scheduleMode.value = timeline ? "timeline" : "single_window";
      hubEventFields.startsAt.readOnly = timeline;
      hubEventFields.endsAt.readOnly = timeline;
    }

    function collectScheduleItems() {
      return hubEventScheduleItems.slice();
    }

    function openScheduleDialog(item) {
      const value = item || {};
      const precision = value.timePrecision || "datetime";
      const timing = value.endsAt ? "period" : "point";
      document.getElementById("hub-event-schedule-dialog-title").textContent = value.id ? t("hubEvent.scheduleEdit") : t("hubEvent.scheduleCreate");
      document.getElementById("hub-event-schedule-edit-id").value = value.id || "";
      document.getElementById("hub-event-schedule-kind").value = value.kind || "custom";
      const title = String(value.title || "").trim() || String(value.label || "").trim();
      document.getElementById("hub-event-schedule-title").value = title;
      document.getElementById("hub-event-schedule-label").value = value.label && String(value.label).trim() !== title ? String(value.label).trim() : "";
      document.getElementById("hub-event-schedule-description").value = value.description || "";
      document.getElementById("hub-event-schedule-timing").value = timing;
      document.getElementById("hub-event-schedule-precision").value = precision;
      setScheduleDateInputType(precision);
      document.getElementById("hub-event-schedule-starts-at").value = precision === "date" ? toScheduleDate(value.startsAt, value.timezone) : toLocalDateTime(value.startsAt);
      document.getElementById("hub-event-schedule-ends-at").value = precision === "date" ? toScheduleDate(value.endsAt, value.timezone) : toLocalDateTime(value.endsAt);
      document.getElementById("hub-event-schedule-timezone").value = value.timezone || "Asia/Seoul";
      renderLinkEditor(hubEventScheduleLinksRoot, scheduleEditorLinks(value));
      document.getElementById("hub-event-schedule-notification").checked = value.notificationEligible !== false;
      document.getElementById("hub-event-schedule-primary").checked = value.isPrimary === true || (!value.id && !hubEventScheduleItems.some(function (item) { return !item.cancelledAt; }));
      setScheduleTimingUi(timing);
      hubEventScheduleDialog.showModal();
    }

    function collectScheduleDialogInput() {
      const value = function (id) { return document.getElementById(id).value.trim(); };
      const precision = value("hub-event-schedule-precision");
      const timing = value("hub-event-schedule-timing");
      const startsValue = value("hub-event-schedule-starts-at");
      const endsValue = value("hub-event-schedule-ends-at");
      const title = value("hub-event-schedule-title");
      return {
        kind: value("hub-event-schedule-kind"),
        title: title,
        label: value("hub-event-schedule-label") || title,
        description: value("hub-event-schedule-description") || null,
        startsAt: precision === "date" ? startsValue : (toIsoFromLocal(startsValue) || null),
        endsAt: timing === "period"
          ? (precision === "date" ? (endsValue || null) : (toIsoFromLocal(endsValue) || null))
          : null,
        timePrecision: precision,
        timezone: value("hub-event-schedule-timezone") || "Asia/Seoul",
        links: collectLinkEditor(hubEventScheduleLinksRoot),
        notificationEligible: document.getElementById("hub-event-schedule-notification").checked,
        isPrimary: document.getElementById("hub-event-schedule-primary").checked,
        expectedRevision: currentHubEvent?.revision
      };
    }

    function acceptScheduleMutation(updated) {
      currentHubEvent = updated;
      if (!parentDirty) {
        hubEventFields.startsAt.value = toLocalDateTime(updated.startsAt);
        hubEventFields.endsAt.value = toLocalDateTime(updated.endsAt);
      }
      renderScheduleItems(updated.scheduleItems || []);
      updateScheduleModeUi();
    }

    async function saveScheduleDialog() {
      if (!currentHubEvent?.id) throw new Error("hub_event_required");
      const scheduleItemIdValue = document.getElementById("hub-event-schedule-edit-id").value;
      const path = endpoints.hubEvents + "/" + encodeURIComponent(currentHubEvent.id) + "/schedule-items" + (scheduleItemIdValue ? "/" + encodeURIComponent(scheduleItemIdValue) : "");
      scheduleDirty = true;
      const updated = await adminApi(path, {
        method: scheduleItemIdValue ? "PATCH" : "POST",
        body: JSON.stringify(collectScheduleDialogInput())
      });
      acceptScheduleMutation(updated);
      scheduleDirty = false;
      hubEventScheduleDialog.close();
      await loadHubEventAuditLog(updated.id);
    }

    async function cancelScheduleItem(scheduleItemIdValue) {
      if (!currentHubEvent?.id) return;
      const result = await adminApi(endpoints.hubEvents + "/" + encodeURIComponent(currentHubEvent.id) + "/schedule-items/" + encodeURIComponent(scheduleItemIdValue), {
        method: "DELETE",
        body: JSON.stringify({ expectedRevision: currentHubEvent.revision })
      });
      acceptScheduleMutation(result.event);
      await loadHubEventAuditLog(currentHubEvent.id);
    }

    async function restoreScheduleItem(scheduleItemIdValue) {
      if (!currentHubEvent?.id) return;
      const updated = await adminApi(endpoints.hubEvents + "/" + encodeURIComponent(currentHubEvent.id) + "/schedule-items/" + encodeURIComponent(scheduleItemIdValue) + "/restore", {
        method: "POST",
        body: JSON.stringify({ expectedRevision: currentHubEvent.revision })
      });
      acceptScheduleMutation(updated);
      await loadHubEventAuditLog(updated.id);
    }

    async function setPrimaryScheduleItem(scheduleItemIdValue) {
      if (!currentHubEvent?.id) return;
      const updated = await adminApi(endpoints.hubEvents + "/" + encodeURIComponent(currentHubEvent.id) + "/schedule-items/" + encodeURIComponent(scheduleItemIdValue), {
        method: "PATCH",
        body: JSON.stringify({ expectedRevision: currentHubEvent.revision, isPrimary: true })
      });
      acceptScheduleMutation(updated);
      await loadHubEventAuditLog(updated.id);
    }

    async function reorderScheduleItem(scheduleItemIdValue, delta) {
      if (!currentHubEvent?.id) return;
      const ids = hubEventScheduleItems.map(function (item) { return item.id; });
      const index = ids.indexOf(scheduleItemIdValue);
      const nextIndex = index + delta;
      if (index < 0 || nextIndex < 0 || nextIndex >= ids.length) return;
      const temporary = ids[index]; ids[index] = ids[nextIndex]; ids[nextIndex] = temporary;
      const updated = await adminApi(endpoints.hubEvents + "/" + encodeURIComponent(currentHubEvent.id) + "/schedule-items/order", {
        method: "PUT",
        body: JSON.stringify({ expectedRevision: currentHubEvent.revision, scheduleItemIds: ids })
      });
      acceptScheduleMutation(updated);
      await loadHubEventAuditLog(updated.id);
    }

    async function addScheduleItem() {
      if (!currentHubEvent?.id) {
        if (!window.confirm(t("hubEvent.saveBeforeSchedule"))) return;
        await saveHubEventDraft();
      }
      openScheduleDialog(null);
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
        if (!element || key === "id" || key === "scheduleMode") return;
        if (["imagePolicyState", "imageUrl", "imageSourceLabel", "imageSourceUrl"].includes(key)) return;
        if (key === "notificationEligible") {
          input[key] = element.checked;
          return;
        }
        if (key === "tags") return;
      if (["announcedAt", "startsAt", "endsAt"].includes(key)) {
        const iso = toIsoFromLocal(element.value);
        input[key] = iso || null;
        return;
      }
        const value = element.value.trim();
        if (value) input[key] = value;
      });
      input.tags = hubEventFields.tags.checked ? ["album"] : [];
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
      input.links = collectLinkEditor(hubEventLinksRoot);
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
        const error = new Error(String(reason));
        error.validationPayload = payload;
        throw error;
      }
      return payload;
    }

    function renderHubEventValidation(result) {
      const errors = result && result.errors ? result.errors : [];
      document.querySelectorAll('#hub-event-form [aria-invalid="true"]').forEach(function (element) { element.removeAttribute("aria-invalid"); });
      hubEventScheduleItemsRoot.querySelectorAll('[aria-invalid="true"]').forEach(function (element) { element.removeAttribute("aria-invalid"); });
      hubEventValidationRoot.replaceChildren();
      if (errors.length === 0) {
        const item = document.createElement("li");
        item.textContent = result && result.valid === false ? t("hubEvent.validationFailed") : t("hubEvent.noValidationErrors");
        hubEventValidationRoot.appendChild(item);
        return;
      }
      errors.forEach(function (error) {
        const item = document.createElement("li");
        item.textContent = [error.field, error.reason, error.message].filter(Boolean).join(" - ");
        hubEventValidationRoot.appendChild(item);
        const scheduleMatch = String(error.field || "").match(/^scheduleItems\.(\d+)(?:\.(.+))?$/);
        if (scheduleMatch) {
          const row = hubEventScheduleItemsRoot.children[Number(scheduleMatch[1])];
          if (row) {
            row.setAttribute("aria-invalid", "true");
            const scheduleField = scheduleMatch[2] && row.querySelector('[data-schedule-field="' + scheduleMatch[2] + '"]');
            if (scheduleField) scheduleField.setAttribute("aria-invalid", "true");
          }
        } else {
          const baseField = hubEventFields[error.field];
          if (baseField) baseField.setAttribute("aria-invalid", "true");
        }
      });
    }

    function bindHubEventForm(event) {
      currentHubEvent = event;
      parentDirty = false;
      scheduleDirty = false;
      hubEventFields.id.value = event.id || "";
      hubEventFields.title.value = event.title || "";
      hubEventFields.summary.value = event.summary || "";
      hubEventFields.category.value = event.category || "online_goods";
      hubEventFields.participationMode.value = event.participationMode || "online";
      hubEventFields.status.value = event.status || "announced";
      hubEventFields.tags.checked = Array.isArray(event.tags) && event.tags.includes("album");
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
      hubEventFields.scheduleMode.value = event.scheduleMode || "single_window";
      hubEventFields.startsAt.value = toLocalDateTime(event.startsAt);
      hubEventFields.endsAt.value = toLocalDateTime(event.endsAt);
      renderLinkEditor(hubEventLinksRoot, parentEditorLinks(event));
      hubEventFields.venueName.value = event.venueName || "";
      hubEventFields.venueAddress.value = event.venueAddress || "";
      hubEventFields.notificationEligible.checked = event.notificationEligible !== false;
      const activePrimary = (event.scheduleItems || []).find(function (item) { return item.isPrimary && !item.cancelledAt; });
      singleWindowScheduleItemId = activePrimary?.id || event.scheduleItems?.[0]?.id || "";
      renderScheduleItems(event.scheduleItems || []);
      updateScheduleModeUi();
    }

    function renderHubEvents(events) {
      hubEventListRoot.replaceChildren();
      if (!events.length) {
        const empty = document.createElement("div");
        empty.className = "empty event-row";
        empty.textContent = t("hubEvent.none");
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
        if (Array.isArray(event.tags) && event.tags.includes("album")) main.appendChild(createPill(t("hubEvent.album")));

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
      if (hubEventTagFilter.value) params.set("tag", hubEventTagFilter.value);
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
      return result;
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
        setMessage(t("operations.completed", { action: label }), false);
      } catch (error) {
        if (error && error.validationPayload) renderHubEventValidation(error.validationPayload);
        setMessage(error instanceof Error ? error.message : "unknown_error", true);
      } finally {
        setBusy(false);
      }
    }

    const announcementFields = {
      id: document.getElementById("announcement-id"), type: document.getElementById("announcement-type"),
      severity: document.getElementById("announcement-severity"), title: document.getElementById("announcement-title"),
      summary: document.getElementById("announcement-summary"), body: document.getElementById("announcement-body"),
      android: document.getElementById("announcement-platform-android"), ios: document.getElementById("announcement-platform-ios"),
      minimumAppVersion: document.getElementById("announcement-min-version"), maximumAppVersion: document.getElementById("announcement-max-version"),
      expiresAt: document.getElementById("announcement-expires-at"), actionLabel: document.getElementById("announcement-action-label"),
      appDeepLink: document.getElementById("announcement-deep-link"), externalUrl: document.getElementById("announcement-external-url"),
      isPinned: document.getElementById("announcement-pinned"), pushEnabled: document.getElementById("announcement-push-enabled")
    };
    const announcementListRoot = document.getElementById("announcement-list");
    const announcementAuditRoot = document.getElementById("announcement-audit-log");
    const announcementPushRoot = document.getElementById("announcement-push-attempts");
    const announcementStateFilter = document.getElementById("announcement-state-filter");

    function collectAnnouncementInput() {
      const targetPlatforms = [];
      if (announcementFields.android.checked) targetPlatforms.push("android");
      if (announcementFields.ios.checked) targetPlatforms.push("ios");
      return {
        type: announcementFields.type.value,
        severity: announcementFields.severity.value,
        title: announcementFields.title.value.trim(),
        summary: announcementFields.summary.value.trim(),
        body: announcementFields.body.value.trim(),
        isPinned: announcementFields.isPinned.checked,
        targetPlatforms: targetPlatforms,
        minimumAppVersion: announcementFields.minimumAppVersion.value.trim() || null,
        maximumAppVersion: announcementFields.maximumAppVersion.value.trim() || null,
        expiresAt: toIsoFromLocal(announcementFields.expiresAt.value) || null,
        actionLabel: announcementFields.actionLabel.value.trim() || null,
        appDeepLink: announcementFields.appDeepLink.value.trim() || null,
        externalUrl: announcementFields.externalUrl.value.trim() || null,
        pushEnabled: announcementFields.pushEnabled.checked
      };
    }

    function bindAnnouncement(item) {
      announcementFields.id.value = item.id || "";
      announcementFields.type.value = item.type || "general";
      announcementFields.severity.value = item.severity || "info";
      announcementFields.title.value = item.title || "";
      announcementFields.summary.value = item.summary || "";
      announcementFields.body.value = item.body || "";
      announcementFields.android.checked = (item.targetPlatforms || []).includes("android");
      announcementFields.ios.checked = (item.targetPlatforms || []).includes("ios");
      announcementFields.minimumAppVersion.value = item.minimumAppVersion || "";
      announcementFields.maximumAppVersion.value = item.maximumAppVersion || "";
      announcementFields.expiresAt.value = toLocalDateTime(item.expiresAt);
      announcementFields.actionLabel.value = item.actionLabel || "";
      announcementFields.appDeepLink.value = item.appDeepLink || "";
      announcementFields.externalUrl.value = item.externalUrl || "";
      announcementFields.isPinned.checked = item.isPinned === true;
      announcementFields.pushEnabled.checked = item.pushEnabled !== false;
    }

    function clearAnnouncementForm() {
      bindAnnouncement({ targetPlatforms: ["android", "ios"], pushEnabled: true });
      announcementAuditRoot.replaceChildren();
      announcementPushRoot.replaceChildren();
    }

    async function loadAnnouncementHistory(id) {
      const results = await Promise.all([
        adminApi(endpoints.announcements + "/" + encodeURIComponent(id) + "/audit-log"),
        adminApi(endpoints.announcements + "/" + encodeURIComponent(id) + "/push-attempts")
      ]);
      announcementAuditRoot.replaceChildren();
      (results[0] || []).forEach(function (entry) {
        const row = document.createElement("li");
        row.textContent = [formatLastCheckedAt(entry.createdAt), entry.action, entry.actorId || "unknown"].join(" - ");
        announcementAuditRoot.appendChild(row);
      });
      announcementPushRoot.replaceChildren();
      (results[1] || []).forEach(function (entry) {
        const row = document.createElement("li");
        row.textContent = [formatLastCheckedAt(entry.requestedAt), entry.topic, entry.status, entry.providerErrorCode].filter(Boolean).join(" - ");
        announcementPushRoot.appendChild(row);
      });
    }

    function renderAnnouncements(items) {
      announcementListRoot.replaceChildren();
      if (!items.length) {
        const empty = document.createElement("div"); empty.className = "empty"; empty.textContent = t("announcement.none"); announcementListRoot.appendChild(empty); return;
      }
      items.forEach(function (item) {
        const row = document.createElement("button"); row.type = "button"; row.className = "event-row";
        const title = document.createElement("strong"); title.textContent = item.title || t("announcement.untitled");
        const meta = document.createElement("span"); meta.className = "event-meta";
        meta.textContent = [displayValue(item.publicationState), displayValue(item.type), displayValue(item.severity), "attention " + item.attentionRevision].join(" / ");
        row.append(title, meta);
        row.addEventListener("click", function () { bindAnnouncement(item); loadAnnouncementHistory(item.id); });
        announcementListRoot.appendChild(row);
      });
    }

    async function refreshAnnouncements() {
      const params = new URLSearchParams();
      if (announcementStateFilter.value) params.set("publicationState", announcementStateFilter.value);
      const result = await adminApi(endpoints.announcements + (params.toString() ? "?" + params.toString() : ""));
      renderAnnouncements(result.items || []);
    }

    async function saveAnnouncement() {
      const id = announcementFields.id.value;
      const result = await adminApi(endpoints.announcements + (id ? "/" + encodeURIComponent(id) : ""), {
        method: id ? "PATCH" : "POST", body: JSON.stringify(collectAnnouncementInput())
      });
      bindAnnouncement(result);
      await refreshAnnouncements();
      await loadAnnouncementHistory(result.id);
    }

    async function runAnnouncementAction(action) {
      const id = announcementFields.id.value;
      if (!id) throw new Error("service_announcement_required");
      const body = action === "publish" ? JSON.stringify({ sendPush: announcementFields.pushEnabled.checked }) : undefined;
      const result = await adminApi(endpoints.announcements + "/" + encodeURIComponent(id) + "/" + action, { method: "POST", body: body });
      if (result && result.id) bindAnnouncement(result);
      await refreshAnnouncements();
      await loadAnnouncementHistory(id);
    }

    async function deleteAnnouncement() {
      const id = announcementFields.id.value;
      if (!id) throw new Error("service_announcement_required");
      const title = announcementFields.title.value.trim() || t("announcement.untitled");
      if (!window.confirm(t("announcement.deleteConfirm", { title: title }))) return;
      await adminApi(endpoints.announcements + "/" + encodeURIComponent(id), { method: "DELETE" });
      clearAnnouncementForm();
      await refreshAnnouncements();
    }

    document.getElementById("announcement-new").addEventListener("click", clearAnnouncementForm);
    document.getElementById("announcement-refresh").addEventListener("click", function () { return runHubEventUiAction(t("common.refresh"), refreshAnnouncements); });
    document.getElementById("announcement-save").addEventListener("click", function () { return runHubEventUiAction(t("announcement.saveDraft"), saveAnnouncement); });
    document.getElementById("announcement-publish").addEventListener("click", function () {
      const input = collectAnnouncementInput();
      const summary = "Platforms: " + input.targetPlatforms.join(", ") + " / Version: " + (input.minimumAppVersion || t("announcement.noLimit")) + " ~ " + (input.maximumAppVersion || t("announcement.noLimit")) + " / Pinned: " + (input.isPinned ? t("common.yes") : t("common.no")) + " / Push: " + (input.pushEnabled ? t("announcement.send") : t("announcement.doNotSend"));
      if (!window.confirm(t("announcement.publishConfirm", { summary: summary }))) return;
      return runHubEventUiAction(t("announcement.publish"), function () { return runAnnouncementAction("publish"); });
    });
    [["announcement-resolve", "resolve", t("announcement.resolve")], ["announcement-archive", "archive", t("announcement.archive")], ["announcement-bump", "bump-attention", t("announcement.bumpAttention")], ["announcement-resend", "resend", t("announcement.resend")]].forEach(function (entry) {
      document.getElementById(entry[0]).addEventListener("click", function () { return runHubEventUiAction(entry[2], function () { return runAnnouncementAction(entry[1]); }); });
    });
    document.getElementById("announcement-delete").addEventListener("click", function () { return runHubEventUiAction(t("common.delete"), deleteAnnouncement); });
    announcementStateFilter.addEventListener("change", function () { return runHubEventUiAction(t("announcement.listAction"), refreshAnnouncements); });

    document.getElementById("hub-event-refresh").addEventListener("click", function () {
      return runHubEventUiAction("Refresh hub events", function () { return refreshHubEvents({ resetPage: true }); });
    });
    document.querySelectorAll("[data-hub-event-tab]").forEach(function (button) {
      button.addEventListener("click", function () {
        const activeTab = button.getAttribute("data-hub-event-tab");
        document.querySelectorAll("[data-hub-event-tab]").forEach(function (candidate) {
          candidate.setAttribute("aria-selected", String(candidate === button));
        });
        document.getElementById("hub-event-form").hidden = activeTab !== "info";
        hubEventTimelineFields.hidden = activeTab !== "schedule";
        document.querySelector('[data-hub-event-tab-panel="history"]').hidden = activeTab !== "history";
      });
    });
    document.getElementById("hub-event-form").addEventListener("input", function () { parentDirty = true; });
    document.getElementById("hub-event-link-add").addEventListener("click", function () {
      hubEventLinksRoot.appendChild(createLinkEditorRow({ kind: "source" }));
      updateLinkEditorCount(hubEventLinksRoot);
      parentDirty = true;
    });
    document.getElementById("hub-event-schedule-add").addEventListener("click", function () {
      return runHubEventUiAction(t("hubEvent.scheduleCreate"), addScheduleItem);
    });
    document.getElementById("hub-event-schedule-link-add").addEventListener("click", function () {
      hubEventScheduleLinksRoot.appendChild(createLinkEditorRow({ kind: "source" }));
      updateLinkEditorCount(hubEventScheduleLinksRoot);
      scheduleDirty = true;
    });
    document.getElementById("hub-event-schedule-dialog-close").addEventListener("click", function () { hubEventScheduleDialog.close(); });
    document.getElementById("hub-event-schedule-title").addEventListener("invalid", function (event) { event.target.setCustomValidity(t("hubEvent.scheduleTitleRequired")); });
    document.getElementById("hub-event-schedule-title").addEventListener("input", function (event) { event.target.setCustomValidity(""); });
    document.getElementById("hub-event-schedule-timing").addEventListener("change", function (event) { setScheduleTimingUi(event.target.value); });
    document.getElementById("hub-event-schedule-precision").addEventListener("change", function (event) { setScheduleDateInputType(event.target.value); });
    hubEventScheduleForm.addEventListener("input", function () { scheduleDirty = true; });
    hubEventScheduleForm.addEventListener("submit", function (event) {
      event.preventDefault();
      return runHubEventUiAction(t("hubEvent.scheduleSave"), saveScheduleDialog);
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
    [hubEventCategoryFilter, hubEventTagFilter, hubEventParticipationModeFilter, hubEventIncludeDeleted, hubEventPageSize].forEach(function (filter) {
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
    document.getElementById("external-api-prune").addEventListener("click", function () {
      return runAction("Prune external API logs", endpoints.externalApiPrune, { method: "POST" });
    });
    externalApiResultsRefreshButton.addEventListener("click", function () {
      return runHubEventUiAction("Refresh external API results", refreshExternalApiResults);
    });
    externalApiSourceFilter.addEventListener("change", function () {
      return runHubEventUiAction("Filter external API results", refreshExternalApiResults);
    });
    externalApiStatusFilter.addEventListener("change", function () {
      return runHubEventUiAction("Filter external API results", refreshExternalApiResults);
    });
    try {
      const storedPage = window.localStorage.getItem(activePageStorageKey);
      if (storedPage && pageCopy[storedPage]) setActivePage(storedPage);
    } catch (_error) {
      // Keep Dashboard active when browser storage is unavailable.
    }
    pageButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        const page = button.getAttribute("data-page-target");
        setActivePage(page);
        if (page === "announcements") runHubEventUiAction(t("announcement.listAction"), refreshAnnouncements);
      });
    });
    internalTokenSaveButton.addEventListener("click", function () {
      persistInternalToken();
      setSettingsTokenStatus(tokenInput.value.trim() ? t("settings.tokenStored") : t("settings.tokenCleared"), false);
    });
    internalTokenTestButton.addEventListener("click", function () {
      return refreshDashboard({ source: "manual" });
    });
    internalTokenClearButton.addEventListener("click", function () {
      tokenInput.value = "";
      clearStoredInternalToken();
      setSettingsTokenStatus(t("settings.tokenCleared"), false);
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
    /* action-overflow controller */
    (function () {
      if (document.documentElement.dataset.actionOverflowInit === "1") {
        return;
      }
      document.documentElement.dataset.actionOverflowInit = "1";
      var wrappers = document.querySelectorAll(".action-overflow");
      var openWrapper = null;
      function items(panel) {
        return panel.querySelectorAll("button");
      }
      function closeAll(except) {
        var list = document.querySelectorAll(".action-overflow");
        for (var i = 0; i < list.length; i += 1) {
          if (except && list[i] === except) {
            continue;
          }
          var t = list[i].querySelector(".overflow-trigger");
          var p = list[i].querySelector(".overflow-panel");
          if (p && !p.hidden) {
            p.hidden = true;
          }
          if (t) {
            t.setAttribute("aria-expanded", "false");
          }
        }
        if (!except) {
          openWrapper = null;
        }
      }
      for (var w = 0; w < wrappers.length; w += 1) {
        (function (wrapper) {
          var trigger = wrapper.querySelector(".overflow-trigger");
          var panel = wrapper.querySelector(".overflow-panel");
          if (!trigger || !panel) {
            return;
          }
          function open() {
            closeAll(wrapper);
            panel.hidden = false;
            trigger.setAttribute("aria-expanded", "true");
            openWrapper = wrapper;
            var list = items(panel);
            if (list.length) {
              list[0].focus();
            }
          }
          function close(refocus) {
            panel.hidden = true;
            trigger.setAttribute("aria-expanded", "false");
            if (openWrapper === wrapper) {
              openWrapper = null;
            }
            if (refocus) {
              trigger.focus();
            }
          }
          trigger.addEventListener("click", function () {
            if (panel.hidden) {
              open();
            } else {
              close(false);
            }
          });
          wrapper.addEventListener("keydown", function (event) {
            if (event.key === "Escape" || event.key === "Esc") {
              if (!panel.hidden) {
                event.preventDefault();
                close(true);
              }
              return;
            }
            if (panel.hidden) {
              return;
            }
            var list = items(panel);
            if (!list.length) {
              return;
            }
            var current = -1;
            for (var i = 0; i < list.length; i += 1) {
              if (list[i] === document.activeElement) {
                current = i;
                break;
              }
            }
            if (event.key === "ArrowDown") {
              event.preventDefault();
              list[(current + 1 + list.length) % list.length].focus();
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              list[(current - 1 + list.length) % list.length].focus();
            } else if (event.key === "Home") {
              event.preventDefault();
              list[0].focus();
            } else if (event.key === "End") {
              event.preventDefault();
              list[list.length - 1].focus();
            }
          });
          panel.addEventListener("click", function (event) {
            var node = event.target;
            while (node && node !== panel) {
              if (node.tagName === "BUTTON") {
                close(false);
                return;
              }
              node = node.parentNode;
            }
          });
        })(wrappers[w]);
      }
      document.addEventListener("click", function (event) {
        if (!openWrapper) {
          return;
        }
        if (!openWrapper.contains(event.target)) {
          closeAll(null);
        }
      });
    })();
  </script>
</body>
</html>`, locale);
}
