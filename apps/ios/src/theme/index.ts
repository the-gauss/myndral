import {
  BRAND_THEMES,
  BRAND_THEME_ORDER,
  DEFAULT_THEME_NAME,
  type BrandThemeName,
} from '@/src/generated/brandTokens';

export type AppThemeName = BrandThemeName;
export const DEFAULT_THEME = DEFAULT_THEME_NAME;
export const THEME_ORDER = BRAND_THEME_ORDER;
export const THEME_OPTIONS = THEME_ORDER.map((name) => ({
  name,
  label: BRAND_THEMES[name].label,
  description: BRAND_THEMES[name].description,
}));

export interface AppTheme {
  name: AppThemeName;
  label: string;
  description: string;
  isDark: boolean;
  usesSerifBody: boolean;
  colors: {
    background: string;
    backgroundOffset: string;
    surface: string;
    surfaceRaised: string;
    surfaceBorder: string;
    text: string;
    textMuted: string;
    textSubtle: string;
    primary: string;
    primaryDim: string;
    secondary: string;
    cta: string;
    ctaText: string;
    fillSoft: string;
    fillSubtle: string;
    success: string;
    warning: string;
    danger: string;
    info: string;
    glassBg: string;
    glassBgHeavy: string;
    glassBorder: string;
    sidebarBg: string;
    sidebarActive: string;
    sidebarActiveText: string;
  };
  typography: {
    bodyFontFamily?: string;
    displayFontFamily?: string;
  };
}

export function getTheme(themeName: AppThemeName): AppTheme {
  const theme = BRAND_THEMES[themeName];
  const tokens = theme.tokens;

  return {
    name: themeName,
    label: theme.label,
    description: theme.description,
    isDark: themeName === 'dark',
    usesSerifBody: false,
    colors: {
      background: tokens['color-bg'],
      backgroundOffset: tokens['color-bg-offset'],
      surface: tokens['color-surface'],
      surfaceRaised: tokens['color-surface-raised'],
      surfaceBorder: tokens['color-surface-border'],
      text: tokens['color-text'],
      textMuted: tokens['color-text-muted'],
      textSubtle: tokens['color-text-subtle'],
      primary: tokens['color-primary'],
      primaryDim: tokens['color-primary-dim'],
      secondary: tokens['color-secondary'],
      cta: tokens['color-cta'],
      ctaText: tokens['color-cta-text'],
      fillSoft: tokens['color-fill-soft'],
      fillSubtle: tokens['color-fill-subtle'],
      success: tokens['color-success'],
      warning: tokens['color-warning'],
      danger: tokens['color-danger'],
      info: tokens['color-info'],
      glassBg: tokens['glass-bg'],
      glassBgHeavy: tokens['glass-bg-heavy'],
      glassBorder: tokens['glass-border'],
      sidebarBg: tokens['color-sidebar-bg'],
      sidebarActive: tokens['color-sidebar-item-active'],
      sidebarActiveText: tokens['color-sidebar-item-active-text'],
    },
    typography: {},
  };
}
