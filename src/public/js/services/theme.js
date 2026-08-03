// Dynamic Theme Engine Service

const THEME_KEY = 'forge_theme_preference';

export function getTheme() {
  return localStorage.getItem(THEME_KEY) || 'dark';
}

export function setTheme(theme) {
  const currentTheme = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);
  localStorage.setItem(THEME_KEY, currentTheme);
  return currentTheme;
}

export function toggleTheme() {
  const current = getTheme();
  const nextTheme = current === 'dark' ? 'light' : 'dark';
  return setTheme(nextTheme);
}

export function initTheme() {
  const theme = getTheme();
  setTheme(theme);
}

export function setCustomAccents(accents = {}) {
  if (accents.accent1) document.documentElement.style.setProperty('--accent-1', accents.accent1);
  if (accents.accent2) document.documentElement.style.setProperty('--accent-2', accents.accent2);
  if (accents.accent3) document.documentElement.style.setProperty('--accent-3', accents.accent3);
}
