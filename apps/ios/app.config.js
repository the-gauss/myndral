const fs = require('node:fs');
const path = require('node:path');

function stripComments(value) {
  return value.replace(/\/\*[\s\S]*?\*\//g, '');
}

function extractBlock(source, selector) {
  const start = source.indexOf(selector);
  if (start === -1) {
    throw new Error(`Unable to find selector: ${selector}`);
  }

  const openIndex = source.indexOf('{', start);
  if (openIndex === -1) {
    throw new Error(`Unable to find opening brace for selector: ${selector}`);
  }

  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) {
      return source.slice(openIndex + 1, index);
    }
  }

  throw new Error(`Unable to find closing brace for selector: ${selector}`);
}

function parseVariables(block) {
  const variables = {};
  const matcher = /--([a-z0-9-]+)\s*:\s*([\s\S]*?);/gi;

  for (const match of block.matchAll(matcher)) {
    const [, name, rawValue] = match;
    variables[name] = rawValue.replace(/\s+/g, ' ').trim();
  }

  return variables;
}

function parseDefaultTheme(source) {
  const defaultMatch = source.match(/DEFAULT_THEME:\s*ThemeName\s*=\s*"([^"]+)"/);
  if (!defaultMatch) {
    throw new Error('Unable to parse DEFAULT_THEME from shared/brand/theme.ts');
  }

  return defaultMatch[1];
}

const appRoot = __dirname;
const repoRoot = path.resolve(appRoot, '..', '..');
const themePath = path.join(repoRoot, 'shared', 'brand', 'theme.ts');
const tokensPath = path.join(repoRoot, 'shared', 'brand', 'tokens.css');

const themeSource = fs.readFileSync(themePath, 'utf8');
const cssSource = stripComments(fs.readFileSync(tokensPath, 'utf8'));
const defaultTheme = parseDefaultTheme(themeSource);

const tokensByTheme = {
  light: parseVariables(extractBlock(cssSource, ':root,')),
  dark: parseVariables(extractBlock(cssSource, '[data-theme="dark"]')),
  paper: parseVariables(extractBlock(cssSource, '[data-theme="paper"]')),
};

const defaultTokens = tokensByTheme[defaultTheme] ?? tokensByTheme.light;

module.exports = {
  expo: {
    name: 'MyndralAI',
    slug: 'myndral-ios',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'myndralios',
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/images/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: defaultTokens['color-bg'],
    },
    ios: {
      bundleIdentifier: 'com.myndral.player',
      supportsTablet: true,
    },
    android: {
      package: 'com.myndral.player',
      adaptiveIcon: {
        backgroundColor: defaultTokens['color-bg-offset'],
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    extra: {
      eas: {
        projectId: 'myndral-ios-first-draft',
      },
    },
    plugins: [
      'expo-router',
      'expo-audio',
      'expo-sharing',
      'expo-secure-store',
      'expo-image',
    ],
    experiments: {
      typedRoutes: true,
    },
  },
};
