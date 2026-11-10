// Clubes ficticios inspirados en el ambiente del fútbol costarricense (sin marcas reales).
export const TEAMS = {
  tibas: { id: 'tibas', name: 'Deportivo Tibás', short: 'TIB', city: 'Tibás',
    colors: { primary: '#4a2370', secondary: '#ffffff', shorts: '#ffffff', socks: '#4a2370', ink: '#ffffff' },
    gk: { shirt: '#c6ff00', shorts: '#1a1a1a' }, style: { pace: 1.02, pass: 1.05, shoot: 1.02 } },
  toros: { id: 'toros', name: 'Toros del Valle FC', short: 'TOR', city: 'Alajuela',
    colors: { primary: '#c8102e', secondary: '#111111', shorts: '#111111', socks: '#c8102e', ink: '#ffffff' },
    gk: { shirt: '#f2c500', shorts: '#222222' }, style: { pace: 1.0, pass: 0.95, shoot: 1.0 } },
  brumas: { id: 'brumas', name: 'Atlético Brumas', short: 'BRU', city: 'Cartago',
    colors: { primary: '#1b4fa0', secondary: '#ffffff', shorts: '#ffffff', socks: '#1b4fa0', ink: '#ffffff' },
    gk: { shirt: '#2e2e2e', shorts: '#2e2e2e' }, style: { pace: 0.95, pass: 1.05, shoot: 0.95 } },
  caribe: { id: 'caribe', name: 'Deportivo Caribe', short: 'CAR', city: 'Limón',
    colors: { primary: '#f4c20d', secondary: '#0b7a3b', shorts: '#0b7a3b', socks: '#f4c20d', ink: '#0b4a23' },
    gk: { shirt: '#7a2fbf', shorts: '#222222' }, style: { pace: 1.08, pass: 0.9, shoot: 1.0 } },
  pumas: { id: 'pumas', name: 'Pumas de Guanacaste', short: 'PUM', city: 'Liberia',
    colors: { primary: '#f26b1d', secondary: '#1a1a1a', shorts: '#1a1a1a', socks: '#f26b1d', ink: '#1a1a1a' },
    gk: { shirt: '#20a4c8', shorts: '#20a4c8' }, style: { pace: 1.02, pass: 0.95, shoot: 1.02 } },
  cafetal: { id: 'cafetal', name: 'Real Cafetal', short: 'RCF', city: 'Heredia',
    colors: { primary: '#ffffff', secondary: '#0f5132', shorts: '#0f5132', socks: '#ffffff', ink: '#0f5132' },
    gk: { shirt: '#d81b60', shorts: '#111111' }, style: { pace: 0.98, pass: 1.0, shoot: 0.98 } },
  montana: { id: 'montana', name: 'C.S. Montaña Azul', short: 'CSM', city: 'Pérez Zeledón',
    colors: { primary: '#5fb4e6', secondary: '#0d2c54', shorts: '#0d2c54', socks: '#5fb4e6', ink: '#0d2c54' },
    gk: { shirt: '#4caf50', shorts: '#111111' }, style: { pace: 1.0, pass: 1.0, shoot: 1.0 } },
  // Clubes centroamericanos (ficticios) para la Copa Centroamericana
  lempira: { id: 'lempira', name: 'Atlético Lempira', short: 'LEM', city: 'Tegucigalpa', country: 'HON',
    colors: { primary: '#ffffff', secondary: '#1b3fa0', shorts: '#1b3fa0', socks: '#ffffff', ink: '#1b3fa0' },
    gk: { shirt: '#ff7a00', shorts: '#111111' }, style: { pace: 1.04, pass: 0.98, shoot: 1.02 } },
  quetzal: { id: 'quetzal', name: 'Club Quetzal', short: 'QTZ', city: 'Ciudad de Guatemala', country: 'GUA',
    colors: { primary: '#0a7d4f', secondary: '#ffffff', shorts: '#ffffff', socks: '#0a7d4f', ink: '#ffffff' },
    gk: { shirt: '#ffd400', shorts: '#111111' }, style: { pace: 1.0, pass: 1.02, shoot: 0.98 } },
  canal: { id: 'canal', name: 'Deportivo Canal', short: 'CNL', city: 'Ciudad de Panamá', country: 'PAN',
    colors: { primary: '#d4001e', secondary: '#ffffff', shorts: '#0b2a6b', socks: '#d4001e', ink: '#ffffff' },
    gk: { shirt: '#00b3a4', shorts: '#111111' }, style: { pace: 1.06, pass: 0.96, shoot: 1.0 } },
  izalco: { id: 'izalco', name: 'Real Izalco', short: 'IZA', city: 'San Salvador', country: 'SLV',
    colors: { primary: '#0f3d8c', secondary: '#f2f2f2', shorts: '#f2f2f2', socks: '#0f3d8c', ink: '#ffffff' },
    gk: { shirt: '#e91e63', shorts: '#111111' }, style: { pace: 0.98, pass: 1.0, shoot: 1.02 } },
  // Segunda División (clubes ficticios de barrio)
  llanero: { id: 'llanero', name: 'Atlético El Llano', short: 'LLA', city: 'Goicoechea', league: 'segunda',
    colors: { primary: '#1b4fa0', secondary: '#f2c500', shorts: '#1b4fa0', socks: '#f2c500', ink: '#f2c500' },
    gk: { shirt: '#111111', shorts: '#111111' }, style: { pace: 0.97, pass: 0.92, shoot: 0.95 } },
  moravia: { id: 'moravia', name: 'Moravia F.C.', short: 'MOR', city: 'Moravia', league: 'segunda',
    colors: { primary: '#1f8a3a', secondary: '#ffffff', shorts: '#ffffff', socks: '#1f8a3a', ink: '#ffffff' },
    gk: { shirt: '#ff7a00', shorts: '#111111' }, style: { pace: 0.98, pass: 0.9, shoot: 0.93 } },
  cerro: { id: 'cerro', name: 'Cerro Escazú A.D.', short: 'CER', city: 'Escazú', league: 'segunda',
    colors: { primary: '#d62828', secondary: '#ffffff', shorts: '#ffffff', socks: '#d62828', ink: '#ffffff' },
    gk: { shirt: '#20a4c8', shorts: '#20a4c8' }, style: { pace: 0.95, pass: 0.94, shoot: 0.95 } },
  aserri: { id: 'aserri', name: 'Aserrí Fútbol Club', short: 'ASE', city: 'Aserrí', league: 'segunda',
    colors: { primary: '#f77f00', secondary: '#111111', shorts: '#111111', socks: '#f77f00', ink: '#111111' },
    gk: { shirt: '#7a2fbf', shorts: '#111111' }, style: { pace: 1.0, pass: 0.9, shoot: 0.94 } },
  puriscal: { id: 'puriscal', name: 'Juventud Puriscal', short: 'PUR', city: 'Puriscal', league: 'segunda',
    colors: { primary: '#ffffff', secondary: '#111111', shorts: '#111111', socks: '#ffffff', ink: '#111111' },
    gk: { shirt: '#c6ff00', shorts: '#111111' }, style: { pace: 0.96, pass: 0.93, shoot: 0.92 } },
  // Los equipos de los amigos (mejengas de fut 5 y fut 7)
  compas: { id: 'compas', name: 'Los Compas F.C.', short: 'CMP', city: 'Hatillo', league: 'amigos',
    colors: { primary: '#0f5132', secondary: '#ffffff', shorts: '#111111', socks: '#0f5132', ink: '#ffffff' },
    gk: { shirt: '#ff7a00', shorts: '#111111' }, style: { pace: 0.86, pass: 0.8, shoot: 0.82 } },
  esquina: { id: 'esquina', name: 'Deportivo La Esquina', short: 'ESQ', city: 'Hatillo', league: 'amigos',
    colors: { primary: '#ffcc00', secondary: '#111111', shorts: '#111111', socks: '#ffcc00', ink: '#111111' },
    gk: { shirt: '#2b6cb0', shorts: '#111111' }, style: { pace: 0.85, pass: 0.78, shoot: 0.84 } },
  oficina: { id: 'oficina', name: 'Los Oficinistas', short: 'OFI', city: 'San José', league: 'amigos',
    colors: { primary: '#1d4ed8', secondary: '#ffffff', shorts: '#ffffff', socks: '#1d4ed8', ink: '#ffffff' },
    gk: { shirt: '#e11d48', shorts: '#111111' }, style: { pace: 0.8, pass: 0.84, shoot: 0.8 } },
  veteranos: { id: 'veteranos', name: 'Veteranos del Ocho', short: 'VET', city: 'Desamparados', league: 'amigos',
    colors: { primary: '#7a1f1f', secondary: '#f5f5f5', shorts: '#f5f5f5', socks: '#7a1f1f', ink: '#ffffff' },
    gk: { shirt: '#16a34a', shorts: '#111111' }, style: { pace: 0.78, pass: 0.88, shoot: 0.86 } },
  relampago: { id: 'relampago', name: 'Relámpago F.C.', short: 'REL', city: 'Alajuelita', league: 'amigos',
    colors: { primary: '#7c3aed', secondary: '#facc15', shorts: '#111111', socks: '#7c3aed', ink: '#facc15' },
    gk: { shirt: '#f97316', shorts: '#111111' }, style: { pace: 0.9, pass: 0.78, shoot: 0.82 } },
  soda: { id: 'soda', name: 'La Soda F.C.', short: 'SOD', city: 'Desamparados', league: 'amigos',
    colors: { primary: '#f97316', secondary: '#ffffff', shorts: '#1f2937', socks: '#f97316', ink: '#ffffff' },
    gk: { shirt: '#0ea5e9', shorts: '#111111' }, style: { pace: 0.84, pass: 0.8, shoot: 0.8 } },
  // Selecciones nacionales (Estadio Nacional). Planteles con nombres ficticios.
  cr: { id: 'cr', name: 'Costa Rica', short: 'CRC', city: 'San José', league: 'seleccion', country: 'CRC',
    colors: { primary: '#c8102e', secondary: '#ffffff', shorts: '#1b3fa6', socks: '#ffffff', ink: '#ffffff' },
    gk: { shirt: '#111111', shorts: '#111111' }, style: { pace: 1.08, pass: 1.08, shoot: 1.06 } },
  hon: { id: 'hon', name: 'Honduras', short: 'HON', city: 'Tegucigalpa', league: 'seleccion', country: 'HON',
    colors: { primary: '#ffffff', secondary: '#1f4fa3', shorts: '#ffffff', socks: '#ffffff', ink: '#1f4fa3' },
    gk: { shirt: '#f2c500', shorts: '#111111' }, style: { pace: 1.06, pass: 1.02, shoot: 1.04 } },
  pan: { id: 'pan', name: 'Panamá', short: 'PAN', city: 'Ciudad de Panamá', league: 'seleccion', country: 'PAN',
    colors: { primary: '#d4001e', secondary: '#ffffff', shorts: '#d4001e', socks: '#d4001e', ink: '#ffffff' },
    gk: { shirt: '#00b3a4', shorts: '#111111' }, style: { pace: 1.06, pass: 1.04, shoot: 1.04 } },
  gua: { id: 'gua', name: 'Guatemala', short: 'GUA', city: 'Ciudad de Guatemala', league: 'seleccion', country: 'GUA',
    colors: { primary: '#ffffff', secondary: '#4a9fd8', shorts: '#4a9fd8', socks: '#ffffff', ink: '#4a9fd8' },
    gk: { shirt: '#111111', shorts: '#111111' }, style: { pace: 1.02, pass: 1.0, shoot: 1.0 } },
  jam: { id: 'jam', name: 'Jamaica', short: 'JAM', city: 'Kingston', league: 'seleccion', country: 'JAM',
    colors: { primary: '#ffd100', secondary: '#009b3a', shorts: '#111111', socks: '#ffd100', ink: '#009b3a' },
    gk: { shirt: '#7a2fbf', shorts: '#111111' }, style: { pace: 1.12, pass: 0.98, shoot: 1.04 } },
};
// Ligas menores: las categorías inferiores de los clubes de Primera (U-17 y U-15)
for (const [base, cat] of [['tibas', 'U-17'], ['toros', 'U-17'], ['brumas', 'U-17'], ['tibas', 'U-15'], ['toros', 'U-15'], ['cafetal', 'U-15']]) {
  const B = TEAMS[base], id = `${base}_${cat.replace('-', '').toLowerCase()}`;
  TEAMS[id] = { ...B, id, name: `${B.name} ${cat}`, short: B.short, league: 'menores', youth: cat, style: { pace: B.style.pace * 0.94, pass: B.style.pass * 0.9, shoot: B.style.shoot * 0.9 } };
}
const SURNAMES = ['Rojas', 'Vargas', 'Jiménez', 'Mora', 'Solís', 'Araya', 'Chaves', 'Quesada', 'Alvarado', 'Calderón', 'Brenes',
  'Campos', 'Ramírez', 'Fonseca', 'Navarro', 'Murillo', 'Zúñiga', 'Hernández', 'Salazar', 'Arias', 'Cordero', 'Venegas',
  'Ugalde', 'Barrantes', 'Soto', 'Castro', 'Madrigal', 'Leiva', 'Porras', 'Matarrita', 'Granados', 'Esquivel', 'Montero', 'Obando',
  'Bolaños', 'Villalobos', 'Cubillo', 'Guzmán', 'Sibaja', 'Picado'];
const FIRST = ['Kendall', 'Jostin', 'Bryan', 'Andrey', 'Celso', 'Joel', 'Randall', 'Johan', 'Yeltsin', 'Keylor', 'Allan', 'Francisco', 'Esteban', 'Jefferson', 'Douglas', 'Ariel', 'Kevin', 'Orlando', 'Marvin', 'Álvaro', 'Daniel', 'Josué', 'Warren', 'Gerson'];
// Plantel determinista por equipo para que los nombres sean consistentes entre partidos.
export function squad(teamId) {
  let s = 0; for (const c of teamId) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  const r = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
  const used = new Set(), out = [];
  const nums = [1, 4, 3, 5, 2, 6, 8, 10, 7, 9, 11];
  for (let i = 0; i < 11; i++) {
    let sur; do { sur = SURNAMES[Math.floor(r() * SURNAMES.length)]; } while (used.has(sur)); used.add(sur);
    out.push({ number: nums[i], surname: sur, first: FIRST[Math.floor(r() * FIRST.length)], skin: Math.floor(r() * 8), hair: Math.floor(r() * 6), height: 1.68 + r() * 0.2 });
  }
  return out;
}
