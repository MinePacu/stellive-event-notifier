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
      --admin-bg: #0b0c0b;
      --admin-surface: #121411;
      --admin-surface-hover: #171a16;
      --admin-text: #f1f4ec;
      --admin-muted: #a9b0a4;
      --admin-label: #d9ded5;
      --admin-border: #2a3029;
      --admin-soft-border: #20261f;
      --admin-input-border: #3b4539;
      --admin-danger: #f17878;
      --admin-primary: #7dd3a7;
      --admin-primary-text: #ffffff;
      --admin-pill-bg: #1b211a;
      --admin-pill-text: #d9ded5;
      --admin-pill-ok-bg: #133625;
      --admin-pill-ok-text: #b7f7cf;
      --admin-pill-neutral-bg: #20241f;
      --admin-pill-neutral-text: #cfd6ca;
      --admin-pill-danger-bg: #432020;
      --admin-pill-danger-text: #ffd7d7;
      --admin-pill-warning-bg: #413016;
      --admin-pill-warning-text: #f8d98b;
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
