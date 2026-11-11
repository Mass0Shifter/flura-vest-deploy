// FluraVest Tailwind preset v2.0. Use with fluravest-tokens.css so semantic colours switch in dark mode.
// tailwind.config.js -> presets: [require('./tailwind.preset.js')]
module.exports = {
  "theme": {
    "extend": {
      "colors": {
        "navy": {
          "50": "#EEF3F8",
          "100": "#D6E1EC",
          "200": "#ADC3D9",
          "300": "#7F9FBF",
          "400": "#52789F",
          "500": "#335A82",
          "600": "#1F4670",
          "700": "#173A60",
          "800": "#103153",
          "900": "#0A2A4A",
          "950": "#061B30"
        },
        "green": {
          "50": "#F0FDF4",
          "100": "#DCFCE7",
          "200": "#BBF7D0",
          "300": "#86EFAC",
          "400": "#4ADE80",
          "500": "#22C55E",
          "600": "#16A34A",
          "700": "#15803D",
          "800": "#166534",
          "900": "#14532D",
          "950": "#052E16"
        },
        "neutral": {
          "0": "#FFFFFF",
          "25": "#F4F8F7",
          "50": "#EEF3F2",
          "100": "#E2E9E8",
          "200": "#CBD5D4",
          "300": "#A9B6B6",
          "400": "#7F8D8F",
          "500": "#5E6C70",
          "600": "#46535A",
          "700": "#333F47",
          "800": "#1F2A33",
          "900": "#121B23"
        },
        "red": {
          "50": "#FEF2F2",
          "400": "#F87171",
          "500": "#EF4444",
          "600": "#DC2626",
          "700": "#B91C1C"
        },
        "amber": {
          "50": "#FFFBEB",
          "500": "#F59E0B",
          "600": "#D97706",
          "700": "#B45309"
        },
        "blue": {
          "50": "#EFF6FF",
          "500": "#3B82F6",
          "600": "#2563EB",
          "700": "#1D4ED8"
        },
        "bg": "var(--fv-bg)",
        "surface": "var(--fv-surface)",
        "surface-raised": "var(--fv-surface-raised)",
        "surface-sunken": "var(--fv-surface-sunken)",
        "surface-brand": "var(--fv-surface-brand)",
        "border": "var(--fv-border)",
        "border-strong": "var(--fv-border-strong)",
        "text": "var(--fv-text)",
        "text-secondary": "var(--fv-text-secondary)",
        "text-muted": "var(--fv-text-muted)",
        "text-on-brand": "var(--fv-text-on-brand)",
        "text-link": "var(--fv-text-link)",
        "text-positive": "var(--fv-text-positive)",
        "text-negative": "var(--fv-text-negative)",
        "text-warning": "var(--fv-text-warning)",
        "action-primary": "var(--fv-action-primary)",
        "action-primary-hover": "var(--fv-action-primary-hover)",
        "action-primary-pressed": "var(--fv-action-primary-pressed)",
        "on-action-primary": "var(--fv-on-action-primary)",
        "action-secondary": "var(--fv-action-secondary)",
        "action-secondary-hover": "var(--fv-action-secondary-hover)",
        "on-action-secondary": "var(--fv-on-action-secondary)",
        "focus-ring": "var(--fv-focus-ring)",
        "positive": "var(--fv-positive)",
        "positive-subtle": "var(--fv-positive-subtle)",
        "negative": "var(--fv-negative)",
        "negative-subtle": "var(--fv-negative-subtle)",
        "warning": "var(--fv-warning)",
        "warning-subtle": "var(--fv-warning-subtle)",
        "info": "var(--fv-info)",
        "info-subtle": "var(--fv-info-subtle)",
        "verified": "var(--fv-verified)",
        "progress-track": "var(--fv-progress-track)",
        "progress-fill": "var(--fv-progress-fill)"
      },
      "fontFamily": {
        "sans": [
          "Plus Jakarta Sans",
          "system-ui",
          "sans-serif"
        ]
      },
      "fontSize": {
        "display": [
          "2.5rem",
          {
            "lineHeight": "3rem",
            "fontWeight": "800",
            "letterSpacing": "-0.02em"
          }
        ],
        "h1": [
          "2rem",
          {
            "lineHeight": "2.5rem",
            "fontWeight": "800",
            "letterSpacing": "-0.02em"
          }
        ],
        "h2": [
          "1.625rem",
          {
            "lineHeight": "2.125rem",
            "fontWeight": "700",
            "letterSpacing": "-0.015em"
          }
        ],
        "h3": [
          "1.3125rem",
          {
            "lineHeight": "1.75rem",
            "fontWeight": "700",
            "letterSpacing": "-0.01em"
          }
        ],
        "title": [
          "1.125rem",
          {
            "lineHeight": "1.625rem",
            "fontWeight": "600",
            "letterSpacing": "-0.005em"
          }
        ],
        "body-lg": [
          "1.0625rem",
          {
            "lineHeight": "1.625rem",
            "fontWeight": "400",
            "letterSpacing": "0em"
          }
        ],
        "body": [
          "0.9375rem",
          {
            "lineHeight": "1.375rem",
            "fontWeight": "400",
            "letterSpacing": "0em"
          }
        ],
        "body-sm": [
          "0.8125rem",
          {
            "lineHeight": "1.125rem",
            "fontWeight": "400",
            "letterSpacing": "0em"
          }
        ],
        "label": [
          "0.875rem",
          {
            "lineHeight": "1.25rem",
            "fontWeight": "600",
            "letterSpacing": "0em"
          }
        ],
        "caption": [
          "0.75rem",
          {
            "lineHeight": "1rem",
            "fontWeight": "500",
            "letterSpacing": "0.01em"
          }
        ],
        "overline": [
          "0.6875rem",
          {
            "lineHeight": "1rem",
            "fontWeight": "700",
            "letterSpacing": "0.12em"
          }
        ],
        "amount-xl": [
          "2.25rem",
          {
            "lineHeight": "2.75rem",
            "fontWeight": "800",
            "letterSpacing": "-0.02em"
          }
        ],
        "amount": [
          "1.375rem",
          {
            "lineHeight": "1.75rem",
            "fontWeight": "700",
            "letterSpacing": "-0.01em"
          }
        ]
      },
      "borderRadius": {
        "none": "0px",
        "sm": "6px",
        "md": "10px",
        "lg": "14px",
        "xl": "20px",
        "2xl": "28px",
        "full": "9999px"
      },
      "boxShadow": {
        "sm": "0 1px 2px rgba(10,42,74,0.06), 0 1px 3px rgba(10,42,74,0.08)",
        "md": "0 4px 12px rgba(10,42,74,0.08), 0 2px 4px rgba(10,42,74,0.06)",
        "lg": "0 12px 32px rgba(10,42,74,0.12), 0 4px 8px rgba(10,42,74,0.06)"
      }
    }
  }
};
