// Look of the web app, from the Google Stitch project "Canton Fair Sourcing Portal" (D49).
// The same colours are CSS variables in index.css, for Bootstrap and the page classes.
export const COLORS = {
  primary: '#002a81', // navy: buttons, links, figures
  accent: '#1f6feb', // the active menu entry and the logo
  topbar: '#2f3031',
  surface: '#faf9f9', // page background
  panel: '#f4f3f3', // panel headers, table headers
  border: '#e3e2e2',
  text: '#1b1c1c',
  muted: '#434653',
  success: '#2e7d32',
  warning: '#b45309',
  error: '#ba1a1a',
};

export const FONT_BODY = "'Geist Sans', -apple-system, 'Segoe UI', Roboto, sans-serif";
export const FONT_HEADING = "'Space Grotesk', 'Geist Sans', sans-serif";

export const antTheme = {
  token: {
    colorPrimary: COLORS.primary,
    colorLink: COLORS.primary,
    colorSuccess: COLORS.success,
    colorWarning: COLORS.warning,
    colorError: COLORS.error,
    colorText: COLORS.text,
    colorTextSecondary: COLORS.muted,
    colorBorder: '#c4c5d6',
    colorBorderSecondary: COLORS.border,
    colorBgLayout: COLORS.surface,
    fontFamily: FONT_BODY,
    fontSize: 14,
    borderRadius: 4,
    borderRadiusLG: 6,
    controlHeight: 34,
  },
  components: {
    Table: {
      headerBg: COLORS.panel,
      headerColor: COLORS.muted,
      headerSplitColor: 'transparent',
      rowHoverBg: '#f2f5fc',
      cellPaddingBlock: 10,
      footerBg: COLORS.panel,
    },
    Card: { headerBg: COLORS.panel, headerFontSize: 15 },
    Tabs: { titleFontSize: 15, inkBarColor: COLORS.primary },
    Tag: { defaultBg: COLORS.panel },
    Modal: { titleFontSize: 17 },
  },
};
