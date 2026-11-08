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
};
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
