/**
 * Theme init utilities shared between the server layout and the client theme
 * provider. Kept in a plain (non-client) module so the layout can call it.
 */

export const THEME_STORAGE_KEY = 'a3chat:theme'

/** Inline script used in <head> to set the theme class before first paint. */
export function themeInitScript(): string {
  return `(function(){try{var s=localStorage.getItem('${THEME_STORAGE_KEY}');var t=s==='light'||s==='dark'||s==='system'?s:'system';var d=t==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;document.documentElement.classList.toggle('dark',d==='dark');document.documentElement.style.colorScheme=d;}catch(e){}})();`
}
