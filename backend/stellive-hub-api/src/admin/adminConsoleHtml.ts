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
    :root {
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--admin-bg);
      color: var(--admin-text);
    }
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      min-height: 100vh;
      background: var(--admin-bg);
      color: var(--admin-text);
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
      grid-template-columns: minmax(0, 1.8fr) repeat(4, auto);
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
    @media (max-width: 860px) {
      .toolbar {
        grid-template-columns: 1fr 1fr;
      }
      .field {
        grid-column: 1 / -1;
      }
    }
    @media (max-width: 640px) {
      .header-inner {
        flex-direction: column;
        align-items: stretch;
      }
      main {
        padding: 12px;
      }
      .toolbar {
        grid-template-columns: 1fr;
      }
      table {
        display: block;
        overflow-x: auto;
      }
    }
  </style>
</head>
<body>
  <header>
    <div class="header-inner">
      <div class="header-copy">
        <h1>Stellive Hub Admin</h1>
        <p class="subtle">Lightweight operational console for internal diagnostics and bounded maintenance actions.</p>
      </div>
      <div class="header-actions">
        ${renderAdminThemeControl()}
        <form class="logout-form" method="post" action="/admin/logout">
          <button class="logout-button" type="submit">Log out</button>
        </form>
      </div>
    </div>
  </header>
  <main class="stack">
    <section class="panel stack">
      <div class="toolbar">
        <div class="field">
          <label for="internal-token">Internal API bearer token</label>
          <input id="internal-token" type="password" autocomplete="off" spellcheck="false" placeholder="Required for /v1/internal/* requests">
        </div>
        <button id="refresh" type="button">Refresh</button>
        <button id="drain" type="button">Drain jobs</button>
        <button id="renew-youtube" type="button">Renew YouTube</button>
        <button id="poll-chzzk" type="button">Poll CHZZK</button>
      </div>
      <div id="message" class="message">Enter the internal API token, then refresh.</div>
    </section>

    <section id="overview" class="grid" aria-live="polite"></section>

    <section class="panel">
      <h2>Adapters</h2>
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
    </section>

    <section class="panel">
      <h2>Secrets readiness</h2>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>State</th>
          </tr>
        </thead>
        <tbody id="secrets"></tbody>
      </table>
    </section>

    <section class="panel">
      <h2>Feature flags</h2>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody id="feature-flags"></tbody>
      </table>
    </section>
  </main>
  ${renderAdminThemeBehaviorScript()}
  <script>
    const endpoints = {
      overview: "/v1/internal/admin/overview",
      drainJobs: "/v1/internal/jobs/notifications/drain",
      renewYoutube: "/v1/internal/schedulers/youtube/renew-subscriptions",
      pollChzzk: "/v1/internal/schedulers/chzzk/live-status"
    };

    const overviewRoot = document.getElementById("overview");
    const adaptersRoot = document.getElementById("adapters");
    const secretsRoot = document.getElementById("secrets");
    const featureFlagsRoot = document.getElementById("feature-flags");
    const messageRoot = document.getElementById("message");
    const tokenInput = document.getElementById("internal-token");
    const logoutForm = document.querySelector(".logout-form");
    const buttons = Array.from(document.querySelectorAll("button"));
    const internalTokenStorageKey = "stellive.admin.internalApiToken";
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
        dateStyle: "medium",
        timeStyle: "medium",
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

    async function refreshDashboard() {
      setBusy(true);
      setMessage("Loading overview...", false);
      try {
        const overview = await api(endpoints.overview);
        renderOverview(overview);
        renderAdapters(overview.adapters || []);
        renderSecrets(overview.secrets || {});
        renderFeatureFlags(overview.featureFlags || {});
        setMessage("Overview refreshed.", false);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "unknown_error", true);
      } finally {
        setBusy(false);
      }
    }

    async function runAction(label, path, init) {
      setBusy(true);
      setMessage(label + " in progress...", false);
      try {
        const result = await api(path, init);
        const status = result && typeof result === "object" && "status" in result ? result.status : "ok";
        setMessage(label + " completed (" + status + ").", false);
        await refreshDashboard();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "unknown_error", true);
        setBusy(false);
      }
    }

    document.getElementById("refresh").addEventListener("click", refreshDashboard);
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
    tokenInput.addEventListener("input", persistInternalToken);
    if (logoutForm) {
      logoutForm.addEventListener("submit", clearStoredInternalToken);
    }
  </script>
</body>
</html>`;
}
