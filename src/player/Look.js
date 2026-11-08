// Apariencia del fotógrafo: género, piel, peinado, pelo, barba, ropa y gorra.
export const SKINS = ['#f6d7c3', '#f1c9a5', '#e0ac85', '#d9a07a', '#c68d63', '#b97c55', '#a86f48', '#8d5a3b', '#6b4330', '#4a2e20'];
export const HAIRS = ['#0a0a0a', '#1b130e', '#3a2817', '#5a3b22', '#8a5a2b', '#b8864b', '#d8c08a', '#9e9e9e', '#e6e6e6', '#7a1f1f'];
export const STYLES = { short: 'Corto', buzz: 'Rapado', fade: 'Degradado', curly: 'Rizado', long: 'Largo (cola)', bald: 'Calvo' };
export const SHIRTS = ['#2f3e46', '#0b3d91', '#1b1b1b', '#f2f2f2', '#6d597a', '#2a9d8f', '#c8102e', '#3a5a40', '#e9c46a', '#8d99ae'];
export const PANTS = ['#3d4a5c', '#1f2a44', '#2b2b2b', '#5b4a3a', '#6b705c', '#c9b38a'];
export const CAPS = [null, '#0b3d91', '#111111', '#c8102e', '#ffffff', '#2a9d8f'];
export const DEFAULT_LOOK = { gender: 'hombre', skin: '#c68d63', hairStyle: 'short', hair: '#1b130e', beard: false, shirt: '#2f3e46', pants: '#3d4a5c', cap: '#0b3d91' };
const KEY = 'entrelineas.look';

export function loadGlobalLook() { try { return { ...DEFAULT_LOOK, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (e) { return { ...DEFAULT_LOOK }; } }
export function saveGlobalLook(l) { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch (e) { /* sin almacenamiento */ } }
// Opciones de Humanoid a partir de la apariencia elegida
export function humanoidOpts(l) {
  const f = l.gender === 'mujer';
  return { skin: l.skin, shirt: l.shirt, shorts: '#2b2b2b', pants: l.pants, boots: '#5a4636', hair: l.hair, backpack: '#22333b', lanyard: true,
    cap: l.cap || null, longSleeves: false, height: f ? 1.66 : 1.76, female: f, hairStyle: l.hairStyle === 'bald' ? undefined : l.hairStyle, bald: l.hairStyle === 'bald', beard: !f && !!l.beard };
}
// Textos con «o/a», «el/la», «campeón/a»… según el género del fotógrafo
export function genderize(text, female) {
  if (!text || text.indexOf('/') < 0) return text;
  return text
    .replace(/\bel\/la\b/g, female ? 'la' : 'el').replace(/\bEl\/la\b/g, female ? 'La' : 'El')
    .replace(/\bun\/a\b/g, female ? 'una' : 'un')
    .replace(/(\p{L}+)ón\/a\b/gu, (m, w) => (female ? w + 'ona' : w + 'ón'))
    .replace(/(\p{L}+)o\/a\b/gu, (m, w) => (female ? w + 'a' : w + 'o'));
}
