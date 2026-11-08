// Catálogo de equipo fotográfico ficticio. Cada estadística afecta la simulación.
export const CAMERAS = {
  jm_classic: { id: 'jm_classic', type: 'camera', name: 'JM Classic D1 (usada)', desc: 'Réflex veterana de segunda mano: lenta y ruidosa, pero barata y con batería eterna.', crop: 1.5, maxISO: 3200, noise: 1.8, fps: 2.5, buffer: 6,
    afSpeed: 0.45, tracking: 0.2, battery: 900, minShutter: 1 / 4000, sound: 'classic', price: 140000, rep: 0, look: { size: 1.08, color: '#2a2a2a', grip: false } },
  jm_basic: { id: 'jm_basic', type: 'camera', name: 'JM Basic', desc: 'Cuerpo APS-C de entrada. Lento pero honesto.', crop: 1.5, maxISO: 6400, noise: 1.45, fps: 3, buffer: 8,
    afSpeed: 0.55, tracking: 0.3, battery: 320, minShutter: 1 / 4000, sound: 'basic', price: 0, rep: 0, look: { size: 0.92, color: '#1b1b1b', grip: false } },
  jm_sport: { id: 'jm_sport', type: 'camera', name: 'JM Sport', desc: 'APS-C rápido con buen seguimiento. Ideal para empezar en deportes.', crop: 1.5, maxISO: 12800, noise: 1.1, fps: 10, buffer: 30,
    afSpeed: 0.8, tracking: 0.62, battery: 450, minShutter: 1 / 4000, sound: 'sport', price: 680000, rep: 10, look: { size: 0.96, color: '#171717', grip: false } },
  jm_pro: { id: 'jm_pro', type: 'camera', name: 'JM Professional', desc: 'Formato completo, 14 fps y ruido muy controlado.', crop: 1.0, maxISO: 25600, noise: 0.72, fps: 14, buffer: 70,
    afSpeed: 0.93, tracking: 0.86, battery: 700, minShutter: 1 / 8000, sound: 'pro', price: 1750000, rep: 35, look: { size: 1.04, color: '#141414', grip: false } },
  jm_flagship: { id: 'jm_flagship', type: 'camera', name: 'JM Flagship', desc: 'La herramienta de las finales: 20 fps, enfoque implacable.', crop: 1.0, maxISO: 51200, noise: 0.52, fps: 20, buffer: 150,
    afSpeed: 1.0, tracking: 1.0, battery: 950, minShutter: 1 / 8000, sound: 'flagship', price: 3600000, rep: 60, look: { size: 1.18, color: '#101010', grip: true } },
  jm_m50: { id: 'jm_m50', type: 'camera', name: 'JM M50 Mirrorless', desc: 'Sin espejo, APS-C y silenciosa: obturador electrónico, ideal para retratos y ambiente. Gasta batería rápido.', crop: 1.5, maxISO: 25600, noise: 1.0, fps: 11, buffer: 40,
    afSpeed: 0.86, tracking: 0.72, battery: 300, minShutter: 1 / 4000, sound: 'silent', price: 890000, rep: 8, look: { size: 0.8, color: '#1c1c1c', grip: false } },
  jm_studio: { id: 'jm_studio', type: 'camera', name: 'JM Studio 60', desc: 'Formato completo de alta resolución: detalle y color extraordinarios, pero solo 7 fps y enfoque más lento.', crop: 1.0, maxISO: 12800, noise: 0.62, fps: 7, buffer: 22,
    afSpeed: 0.72, tracking: 0.55, battery: 650, minShutter: 1 / 8000, sound: 'pro', price: 2100000, rep: 25, look: { size: 1.0, color: '#191919', grip: false } },
  jm_r1: { id: 'jm_r1', type: 'camera', name: 'JM R1 Sin Espejo', desc: 'Formato completo sin espejo: 30 fps en electrónico, seguimiento por detección de jugadores y el mejor rendimiento nocturno.', crop: 1.0, maxISO: 51200, noise: 0.45, fps: 30, buffer: 200,
    afSpeed: 1.0, tracking: 1.0, battery: 560, minShutter: 1 / 8000, sound: 'mirrorless', price: 4900000, rep: 75, look: { size: 1.02, color: '#0d0d0d', grip: true } },
};
export const LENSES = {
  kit_18_135: { id: 'kit_18_135', type: 'lens', name: 'JM 18-135 mm f/3.5-5.6', short: '18-135', min: 18, max: 135, fMin: 3.5, fMax: 5.6, af: 0.7, stab: 3, weight: 0.5, price: 0, rep: 0 },
  l_24_70: { id: 'l_24_70', type: 'lens', name: 'JM 24-70 mm f/2.8', short: '24-70', min: 24, max: 70, fMin: 2.8, fMax: 2.8, af: 0.9, stab: 0, weight: 0.9, price: 480000, rep: 0 },
  l_70_200: { id: 'l_70_200', type: 'lens', name: 'JM 70-200 mm f/2.8', short: '70-200', min: 70, max: 200, fMin: 2.8, fMax: 2.8, af: 0.95, stab: 4, weight: 1.4, price: 950000, rep: 5 },
  l_100_400: { id: 'l_100_400', type: 'lens', name: 'JM 100-400 mm f/4.5-5.6', short: '100-400', min: 100, max: 400, fMin: 4.5, fMax: 5.6, af: 0.85, stab: 4, weight: 1.6, price: 820000, rep: 5 },
  l_200_600: { id: 'l_200_600', type: 'lens', name: 'JM 200-600 mm f/5.6-6.3', short: '200-600', min: 200, max: 600, fMin: 5.6, fMax: 6.3, af: 0.8, stab: 5, weight: 2.2, price: 1150000, rep: 15 },
  l_300_28: { id: 'l_300_28', type: 'lens', name: 'JM 300 mm f/2.8', short: '300 f/2.8', min: 300, max: 300, fMin: 2.8, fMax: 2.8, af: 1.0, stab: 4, weight: 2.6, price: 2700000, rep: 40 },
  l_16_35: { id: 'l_16_35', type: 'lens', name: 'JM 16-35 mm f/2.8', short: '16-35', min: 16, max: 35, fMin: 2.8, fMax: 2.8, af: 0.9, stab: 0, weight: 0.8, price: 620000, rep: 5 },
  l_50_14: { id: 'l_50_14', type: 'lens', name: 'JM 50 mm f/1.4', short: '50 f/1.4', min: 50, max: 50, fMin: 1.4, fMax: 1.4, af: 0.85, stab: 0, weight: 0.95, price: 780000, rep: 10 },
  l_150_600: { id: 'l_150_600', type: 'lens', name: 'JM 150-600 mm f/5-6.3 (económico)', short: '150-600', min: 150, max: 600, fMin: 5.6, fMax: 6.3, af: 0.7, stab: 3, weight: 2.0, price: 640000, rep: 10 },
  l_400_28: { id: 'l_400_28', type: 'lens', name: 'JM 400 mm f/2.8', short: '400 f/2.8', min: 400, max: 400, fMin: 2.8, fMax: 2.8, af: 1.0, stab: 5, weight: 3.0, price: 4300000, rep: 55 },
};
export const ACCESSORIES = {
  card_16: { id: 'card_16', type: 'card', name: 'Tarjeta SD 16 GB', capacity: 180, price: 0 },
  card_64: { id: 'card_64', type: 'card', name: 'Tarjeta SD 64 GB V90', capacity: 700, price: 45000 },
  card_256: { id: 'card_256', type: 'card', name: 'CFexpress 256 GB', capacity: 2500, price: 160000, rep: 20 },
  battery: { id: 'battery', type: 'battery', name: 'Batería JM-B1 (repuesto)', price: 38000, stack: true },
  monopod: { id: 'monopod', type: 'accessory', name: 'Monopié de carbono', desc: 'Reduce la trepidación 2,5 pasos al disparar quieto.', price: 95000 },
  raincover: { id: 'raincover', type: 'accessory', name: 'Cubierta para lluvia', desc: 'Evita gotas en el lente y fallas por humedad.', price: 42000 },
  backpack_pro: { id: 'backpack_pro', type: 'backpack', name: 'Mochila Pro 30 L', slots: 14, desc: 'Más espacio para lentes y accesorios.', price: 120000 },
  backpack_basic: { id: 'backpack_basic', type: 'backpack', name: 'Mochila básica', slots: 7, price: 0 },
  credential: { id: 'credential', type: 'credential', name: 'Acreditación de prensa', price: 0, noSell: true },
};
export const ALL_ITEMS = { ...CAMERAS, ...LENSES, ...ACCESSORIES };
export const SHUTTERS = [1 / 30, 1 / 60, 1 / 125, 1 / 200, 1 / 250, 1 / 320, 1 / 400, 1 / 500, 1 / 640, 1 / 800, 1 / 1000, 1 / 1250, 1 / 1600, 1 / 2000, 1 / 2500, 1 / 3200, 1 / 4000, 1 / 8000];
export const APERTURES = [1.4, 2, 2.8, 3.2, 3.5, 4, 4.5, 5, 5.6, 6.3, 7.1, 8, 9, 11, 13, 16];
export const ISOS = ['AUTO', 100, 200, 400, 800, 1600, 3200, 6400, 12800, 25600, 51200];
export const WBS = [{ id: 'AUTO', k: null, label: 'AWB' }, { id: 'DAY', k: 5500, label: 'Día 5500K' }, { id: 'CLOUD', k: 6500, label: 'Nublado 6500K' },
  { id: 'SHADE', k: 7500, label: 'Sombra 7500K' }, { id: 'LED', k: 5000, label: 'LED 5000K' }, { id: 'TUNG', k: 3200, label: 'Tungsteno 3200K' }];
export function lensMaxAperture(lens, focal) {
  if (lens.min === lens.max) return lens.fMin;
  const t = (Math.log(focal) - Math.log(lens.min)) / (Math.log(lens.max) - Math.log(lens.min));
  const raw = lens.fMin + (lens.fMax - lens.fMin) * Math.max(0, Math.min(1, t));
  return APERTURES.find((a) => a >= raw - 0.05) || raw;
}
export function fmtShutter(s) { return s >= 1 ? `${s}"` : `1/${Math.round(1 / s)}`; }
