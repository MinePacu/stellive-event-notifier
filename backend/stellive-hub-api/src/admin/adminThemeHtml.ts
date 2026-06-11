export const adminThemeStorageKey = "stellive-admin-theme";

export function renderAdminThemeInitScript(): string {
  return `<script>
    (function () {
      var storageKey = "${adminThemeStorageKey}";
      var allowed = { light: true, system: true, dark: true, black: true };

      function readPreference() {
        try {
          var stored = window.localStorage ? window.localStorage.getItem(storageKey) : null;
          return stored && allowed[stored] ? stored : "system";
        } catch (_error) {
          return "system";
        }
      }

      function resolveTheme(preference) {
        if (preference === "light" || preference === "dark" || preference === "black") {
          return preference;
        }

        if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
          return "dark";
        }

        return "light";
      }

      var preference = readPreference();
      document.documentElement.dataset.themePreference = preference;
      document.documentElement.dataset.theme = resolveTheme(preference);
    })();
  </script>`;
}

export function renderAdminThemeControl(): string {
  return `<div class="theme-control" role="group" aria-label="Theme" data-theme-default="system">
    <button type="button" class="theme-option" data-theme-option="light" aria-pressed="false">Light</button>
    <button type="button" class="theme-option" data-theme-option="system" aria-pressed="false">System</button>
    <button type="button" class="theme-option" data-theme-option="dark" aria-pressed="false">Dark</button>
    <button type="button" class="theme-option" data-theme-option="black" aria-pressed="false">Black</button>
  </div>`;
}

export function renderAdminThemeStyle(): string {
  return `
    :root {
      color-scheme: light dark;
      --admin-bg: #f3f5f8;
      --admin-surface: #ffffff;
      --admin-surface-hover: #eef3f8;
      --admin-text: #1f2733;
      --admin-muted: #657286;
      --admin-label: #526073;
      --admin-border: #d6dde7;
      --admin-soft-border: #edf1f5;
      --admin-input-border: #bcc7d4;
      --admin-danger: #a13224;
      --admin-primary: #2563eb;
      --admin-primary-text: #ffffff;
      --admin-pill-bg: #e9edf3;
      --admin-pill-text: #344155;
      --admin-pill-ok-bg: #dbeee1;
      --admin-pill-ok-text: #19643a;
      --admin-pill-neutral-bg: #edf0f5;
      --admin-pill-neutral-text: #556274;
      --admin-pill-danger-bg: #fde5df;
      --admin-pill-danger-text: #9a3222;
      --admin-pill-warning-bg: #fff0cd;
      --admin-pill-warning-text: #865d00;
    }

    :root[data-theme="dark"] {
      --admin-bg: #0f172a;
      --admin-surface: #111827;
      --admin-surface-hover: #1f2937;
      --admin-text: #e5edf7;
      --admin-muted: #94a3b8;
      --admin-label: #cbd5e1;
      --admin-border: #334155;
      --admin-soft-border: #243244;
      --admin-input-border: #475569;
      --admin-danger: #fca5a5;
      --admin-primary: #3b82f6;
      --admin-primary-text: #ffffff;
      --admin-pill-bg: #243244;
      --admin-pill-text: #d8e2ee;
      --admin-pill-ok-bg: #123d2a;
      --admin-pill-ok-text: #b7f7cf;
      --admin-pill-neutral-bg: #253044;
      --admin-pill-neutral-text: #cbd5e1;
      --admin-pill-danger-bg: #4c1d1d;
      --admin-pill-danger-text: #fecaca;
      --admin-pill-warning-bg: #4a3411;
      --admin-pill-warning-text: #fde68a;
    }

    :root[data-theme="black"] {
      --admin-bg: #000000;
      --admin-surface: #050505;
      --admin-surface-hover: #111111;
      --admin-text: #f2f5f8;
      --admin-muted: #a3aab5;
      --admin-label: #d1d5db;
      --admin-border: #262626;
      --admin-soft-border: #1f1f1f;
      --admin-input-border: #3a3a3a;
      --admin-danger: #fca5a5;
      --admin-primary: #60a5fa;
      --admin-primary-text: #020617;
      --admin-pill-bg: #171717;
      --admin-pill-text: #e5e7eb;
      --admin-pill-ok-bg: #052e1a;
      --admin-pill-ok-text: #bbf7d0;
      --admin-pill-neutral-bg: #171717;
      --admin-pill-neutral-text: #d4d4d8;
      --admin-pill-danger-bg: #450a0a;
      --admin-pill-danger-text: #fecaca;
      --admin-pill-warning-bg: #422006;
      --admin-pill-warning-text: #fde68a;
    }

    .theme-control {
      display: inline-grid;
      grid-template-columns: repeat(4, minmax(0, auto));
      gap: 2px;
      align-items: center;
      border: 1px solid var(--admin-border);
      border-radius: 8px;
      padding: 2px;
      background: var(--admin-bg);
    }

    .theme-option {
      min-height: 28px;
      border: 0;
      border-radius: 6px;
      padding: 5px 8px;
      background: transparent;
      color: var(--admin-muted);
      font: inherit;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
    }

    .theme-option:hover {
      background: var(--admin-surface-hover);
      color: var(--admin-text);
    }

    .theme-option[aria-pressed="true"] {
      background: var(--admin-surface);
      color: var(--admin-text);
      box-shadow: inset 0 0 0 1px var(--admin-border);
    }

    .theme-option:focus-visible {
      outline: 2px solid var(--admin-primary);
      outline-offset: 2px;
    }
  `;
}

export function renderAdminThemeBehaviorScript(): string {
  return `<script>
    (function () {
      var storageKey = "${adminThemeStorageKey}";
      var allowed = { light: true, system: true, dark: true, black: true };
      var mediaQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

      function readPreference() {
        try {
          var stored = window.localStorage ? window.localStorage.getItem(storageKey) : null;
          return stored && allowed[stored] ? stored : "system";
        } catch (_error) {
          return "system";
        }
      }

      function writePreference(preference) {
        try {
          if (window.localStorage) {
            window.localStorage.setItem(storageKey, preference);
          }
        } catch (_error) {
          // Theme selection is cosmetic; storage failures should not block admin work.
        }
      }

      function resolveTheme(preference) {
        if (preference === "light" || preference === "dark" || preference === "black") {
          return preference;
        }
        return mediaQuery && mediaQuery.matches ? "dark" : "light";
      }

      function applyPreference(preference, shouldStore) {
        var normalized = allowed[preference] ? preference : "system";
        if (shouldStore) {
          writePreference(normalized);
        }

        document.documentElement.dataset.themePreference = normalized;
        document.documentElement.dataset.theme = resolveTheme(normalized);

        var options = document.querySelectorAll("[data-theme-option]");
        for (var index = 0; index < options.length; index += 1) {
          var option = options[index];
          var isSelected = option.getAttribute("data-theme-option") === normalized;
          option.setAttribute("aria-pressed", isSelected ? "true" : "false");
        }
      }

      var controls = document.querySelectorAll("[data-theme-option]");
      for (var index = 0; index < controls.length; index += 1) {
        controls[index].addEventListener("click", function (event) {
          var nextPreference = event.currentTarget.getAttribute("data-theme-option") || "system";
          applyPreference(nextPreference, true);
        });
      }

      if (mediaQuery) {
        var onSystemThemeChange = function () {
          if (document.documentElement.dataset.themePreference === "system") {
            applyPreference("system", false);
          }
        };

        if (typeof mediaQuery.addEventListener === "function") {
          mediaQuery.addEventListener("change", onSystemThemeChange);
        } else if (typeof mediaQuery.addListener === "function") {
          mediaQuery.addListener(onSystemThemeChange);
        }
      }

      applyPreference(readPreference(), false);
    })();
  </script>`;
}
