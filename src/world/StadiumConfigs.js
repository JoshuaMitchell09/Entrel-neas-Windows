// Configuración de estadios ficticios. El constructor del estadio usa estos datos.
export const STADIUMS = {
  palmas: {
    id: 'palmas', name: 'Estadio Municipal Las Palmas', city: 'San Isidro', capacity: 9800, tier: 1,
    nearRows: 24, endRows: 12, farRows: 16, rowDepth: 0.8, rowHeight: 0.42,
    roof: 'main', corners: false, lights: 'towers', crowdDensity: 0.62,
    seatColors: ['#c8102e', '#1a1a1a'], facade: '#e9e2d0', facadeBand: '#c8102e', hasBarra: true,
    description: 'Estadio municipal de tamaño mediano. Graderías cercanas a la cancha y ambiente familiar.',
  },
  irazu: {
    id: 'irazu', name: 'Estadio Metropolitano Irazú', city: 'San José', capacity: 32000, tier: 2,
    nearRows: 26, endRows: 26, farRows: 26, rowDepth: 0.78, rowHeight: 0.46,
    roof: 'full', corners: true, lights: 'roof', crowdDensity: 0.8,
    seatColors: ['#2b5fae', '#dcdcdc'], facade: '#cfd6dc', facadeBand: '#2b5fae', hasBarra: true,
    description: 'Recinto moderno de gran capacidad, techo perimetral e iluminación LED.',
  },
  fortaleza: {
    id: 'fortaleza', name: 'Estadio La Fortaleza', city: 'Alajuela Sur', capacity: 22000, tier: 3,
    nearRows: 24, endRows: 22, farRows: 24, rowDepth: 0.72, rowHeight: 0.52,
    roof: 'main', corners: true, lights: 'towers', crowdDensity: 0.95,
    seatColors: ['#8a1020', '#f2f2f2'], facade: '#b9b1a3', facadeBand: '#8a1020', hasBarra: true, clasico: true,
    description: 'Graderías empinadas y barras ruidosas. El escenario de los clásicos.',
  },
};
// Sede principal: inspirada en la arquitectura del estadio de Tibás conocido como "La Cueva".
// Tribunas laterales de dos niveles con techos de cerchas blancas, cabeceras abiertas,
// butacas moradas con pasillos amarillos y fachada granate con letras gigantes.
STADIUMS.cueva = {
  id: 'cueva', name: 'Estadio La Cueva', city: 'Tibás', capacity: 23000, tier: 1,
  nearRows: 31, endRows: 17, farRows: 33, rowDepth: 0.74, rowHeight: 0.5,
  roof: 'sides', corners: false, lights: 'roof', crowdDensity: 0.92,
  seatColors: ['#4a2370', '#6e6a78'], aisleColor: '#f2b705', aisleEvery: 9,
  tiers: { near: { row: 15, rise: 2.4 }, far: { row: 16, rise: 2.8 } },
  banners: { near: ['ASCENSO TOTAL · LA CASA DEL FÚTBOL TICO', 'JUNTOS SOMOS MÁS FUERTES', 'ASCENSO TOTAL'], far: ['LA VIDA POR LOS COLORES', 'ASCENSO TOTAL · FOTO Y VIDEO', 'AQUÍ SE VIVE EL FÚTBOL'] },
  facade: '#5c1a33', facadeBand: '#6d1f3a', facadeLetters: ['L', 'A', '★', 'C', 'U', 'E', 'V', 'A'],
  hasBarra: true, tifo: 'La Cueva nunca duerme',
  description: 'La Cueva: graderías encima de la cancha, techos de cerchas y una barra que no para de cantar.',
};
// Sede de Alajuela: inspirada en el estadio rojinegro de la ciudad.
// Tribuna principal y lateral opuesta con techos rojos con paneles solares, butacas rojas y negras
// por bloques con pasillos amarillos, cabecera de dos niveles, torres de luz rayadas rojo y blanco,
// fachada negra con letrero y bajos rojos con volúmenes curvos de ladrillo.
STADIUMS.alajuela = {
  id: 'alajuela', name: 'Estadio de Alajuela', city: 'Alajuela', capacity: 17800, tier: 2,
  nearRows: 26, endRows: 16, eastRows: 27, westRows: 14, farRows: 29, rowDepth: 0.76, rowHeight: 0.5,
  roof: 'main', corners: false, lights: 'towers', towerStyle: 'striped', crowdDensity: 0.9,
  seatColors: ['#c8102e', '#1a1a1a'], seatPattern: 'blocks', aisleColor: '#f2b705', aisleEvery: 7,
  tiers: { east: { row: 13, rise: 2.4 } },
  banners: { east: ['ASCENSO TOTAL', 'ROJINEGROS DE CORAZÓN', 'ASCENSO TOTAL'] },
  roofSpec: {
    near: { color: '#b3202c', solar: true, fascia: 'ASCENSO TOTAL · TRIBUNA PRINCIPAL', backText: 'ESTADIO DE ALAJUELA', fasciaColor: '#141414' },
    far: { color: '#b3202c', solar: true, fascia: 'ASCENSO TOTAL · LA CASA DEL FÚTBOL TICO', fasciaColor: '#9b1b25' },
  },
  facade: '#151515', facadeBand: '#c8102e', facadeText: 'EL ESTADIO DE SU GENTE', brickCorners: true,
  hasBarra: true, tifo: 'Rojinegros de corazón',
  description: 'Graderías rojinegras por bloques, techos rojos con paneles solares y torres de luz rayadas.',
};
// Sede de Cartago: inspirada en el estadio brumoso de la Vieja Metrópoli.
// Butacas azules con pasillos amarillos, tribuna principal con estructura metálica azul a la vista
// y borde rojo, graderías laterales y cabeceras bajas abiertas, torres de luz de celosía.
STADIUMS.cartago = {
  id: 'cartago', name: 'Estadio de Cartago', city: 'Cartago', capacity: 13500, tier: 1,
  nearRows: 28, endRows: 12, eastRows: 15, westRows: 11, farRows: 20, rowDepth: 0.78, rowHeight: 0.46,
  roof: 'main', corners: false, lights: 'towers', towerStyle: 'lattice', crowdDensity: 0.82,
  seatColors: ['#1d4fd1', '#173fa6'], seatPattern: 'solid', aisleColor: '#f6c400', aisleEvery: 8,
  roofSpec: { near: { color: '#c9ced3', beam: '#1b2f7a', edge: '#c8102e', beamStep: 8 } },
  facade: '#1e3a8a', facadeBand: '#1e3a8a', facadeText: 'ESTADIO DE CARTAGO · LA VIEJA METRÓPOLI',
  hasBarra: true, tifo: 'Brumosos hasta la muerte',
  description: 'Azul y amarillo, techo de estructura metálica y neblina de la Vieja Metrópoli.',
};
