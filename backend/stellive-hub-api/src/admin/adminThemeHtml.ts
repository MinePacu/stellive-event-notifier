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
      --admin-bg: #f5f7fb;
      --admin-surface: #ffffff;
      --admin-surface-hover: #eef4fb;
      --admin-text: #111827;
      --admin-muted: #657084;
      --admin-label: #384358;
      --admin-border: #d8e0ec;
      --admin-soft-border: #edf2f7;
      --admin-input-border: #b9c5d6;
      --admin-danger: #b42318;
      --admin-primary: #243b73;
      --admin-primary-text: #ffffff;
      --admin-accent: #14b8a6;
      --admin-pill-bg: #edf2f7;
      --admin-pill-text: #334155;
      --admin-pill-ok-bg: #d9f4ec;
      --admin-pill-ok-text: #0f766e;
      --admin-pill-neutral-bg: #edf0f5;
      --admin-pill-neutral-text: #556274;
      --admin-pill-danger-bg: #fde5df;
      --admin-pill-danger-text: #9a3222;
      --admin-pill-warning-bg: #fff6d8;
      --admin-pill-warning-text: #8a5a00;
    }

    :root[data-theme="dark"] {
      --admin-bg: #0f172a;
      --admin-surface: #172033;
      --admin-surface-hover: #202b42;
      --admin-text: #e5edf7;
      --admin-muted: #9aa8bd;
      --admin-label: #cbd5e1;
      --admin-border: #2d3a52;
      --admin-soft-border: #223049;
      --admin-input-border: #40516d;
      --admin-danger: #fb7185;
      --admin-primary: #818cf8;
      --admin-primary-text: #ffffff;
      --admin-accent: #2dd4bf;
      --admin-pill-bg: #223049;
      --admin-pill-text: #dbe7f5;
      --admin-pill-ok-bg: #123b36;
      --admin-pill-ok-text: #99f6e4;
      --admin-pill-neutral-bg: #26334a;
      --admin-pill-neutral-text: #cbd5e1;
      --admin-pill-danger-bg: #432020;
      --admin-pill-danger-text: #ffd7d7;
      --admin-pill-warning-bg: #423518;
      --admin-pill-warning-text: #fde68a;
    }

    :root[data-theme="black"] {
      --admin-bg: #000000;
      --admin-surface: #050705;
      --admin-surface-hover: #0f130f;
      --admin-text: #f2f5ef;
      --admin-muted: #9ea79b;
      --admin-label: #d8ded3;
      --admin-border: #20271f;
      --admin-soft-border: #151a14;
      --admin-input-border: #303a2f;
      --admin-danger: #f17878;
      --admin-primary: #7dd3a7;
      --admin-primary-text: #020617;
      --admin-pill-bg: #111610;
      --admin-pill-text: #e2e8de;
      --admin-pill-ok-bg: #052e1a;
      --admin-pill-ok-text: #bbf7d0;
      --admin-pill-neutral-bg: #121612;
      --admin-pill-neutral-text: #d7ddd2;
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
