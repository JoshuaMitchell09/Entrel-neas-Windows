// Modo historia por etapas: de las mejengas con los amigos hasta la Selección Nacional.
// Cada etapa tiene su capítulo (narrativa), quién evalúa las fotos y cómo se paga.
export const TIERS = [
  { id: 'amigos', name: 'Mejengas con los compas', short: 'Amigos', pay: 0.15,
    evaluator: { who: 'Diego', role: 'Grupo «Los Compas F.C.»', color: '#0f5132', initials: 'DG', title: 'EL GRUPO DE LOS COMPAS' } },
  { id: 'formativo', name: 'Ligas menores y fútbol aficionado', short: 'Formativo', pay: 0.4,
    evaluator: { who: 'Profe Andrés Vega', role: 'Ligas menores · Deportivo Tibás', color: '#4a2370', initials: 'AV', title: 'EVALUACIÓN · PRENSA DE LIGAS MENORES' } },
  { id: 'segunda', name: 'Segunda División', short: 'Segunda', pay: 0.6,
    evaluator: { who: 'Karla Méndez', role: 'Prensa · Atlético El Llano', color: '#1b4fa0', initials: 'KM', title: 'EVALUACIÓN · PRENSA DE ATLÉTICO EL LLANO' } },
  { id: 'primera', name: 'Primera División', short: 'Primera', pay: 1,
    evaluator: { who: 'Ricardo Solano', role: 'Editor deportivo · Ascenso Total', color: '#c8102e', initials: 'RS', title: 'EVALUACIÓN DEL EDITOR · RICARDO SOLANO' } },
  { id: 'copa', name: 'Copa Centroamericana', short: 'Copa', pay: 1.1,
    evaluator: { who: 'Ricardo Solano', role: 'Editor deportivo · Ascenso Total', color: '#c8102e', initials: 'RS', title: 'EVALUACIÓN DEL EDITOR · RICARDO SOLANO' } },
  { id: 'seleccion', name: 'Selección Nacional', short: 'Selección', pay: 1.3,
    evaluator: { who: 'Lucía Brenes', role: 'Jefa de prensa · Selección Nacional', color: '#1b3fa6', initials: 'LB', title: 'EVALUACIÓN · PRENSA DE LA SELECCIÓN NACIONAL' } },
];
export const TIER_IDX = Object.fromEntries(TIERS.map((t, i) => [t.id, i]));
export function tierOf(ev) {
  if (!ev) return 3;
  if (ev.cup) return TIER_IDX.copa;
  if (ev.league === 'amigos') return TIER_IDX.amigos;
  if (ev.league === 'menores' || ev.league === 'aficionada') return TIER_IDX.formativo;
  if (ev.league === 'segunda') return TIER_IDX.segunda;
  if (ev.league === 'seleccion') return TIER_IDX.seleccion;
  return TIER_IDX.primera;
}

// Capítulos: se muestran al empezar la carrera y cada vez que se sube de etapa.
export const CHAPTERS = [
  { n: 1, title: 'La cámara en la mochila', kicker: 'CAPÍTULO 1', img: '📷',
    text: [
      'Todo empezó con una cámara de segunda mano y un lente de kit que compraste juntando los ahorros de varios meses.',
      'Diego, tu amigo del colegio, juega todos los jueves con «Los Compas» en el fut 7 del barrio y te pidió unas fotos del equipo. No hay acreditación ni paga: hay malla ciclón, una gradería de cemento y la luz amarilla de los postes.',
      'Así empiezan casi todos los fotógrafos: practicando gratis, equivocándose mucho y subiendo las mejores fotos a Lente para que alguien las vea.',
    ],
    goal: 'Cubrí las mejengas de tus amigos y armá tu portafolio. Después de un par de partidos alguien se va a fijar en tus fotos.' },
  { n: 2, title: 'Tocando puertas', kicker: 'CAPÍTULO 2', img: '📧',
    text: [
      'Tus fotos de las mejengas empezaron a moverse en Lente. El profe de las ligas menores del Deportivo Tibás las vio y te pasó su correo.',
      'En este oficio nadie te llama: hay que escribir, mandar el portafolio y esperar. A veces la respuesta tarda. A veces es un no.',
      'Las ligas menores y el fútbol aficionado son la escuela: canchas de entrenamiento, papás en la gradería y futuras estrellas que todavía no saben posar para la foto.',
    ],
    goal: 'Escribí desde el Correo del celular y cubrí partidos de ligas menores. Con buena reputación, la Segunda División te va a abrir la puerta.' },
  { n: 3, title: 'El fútbol de barrio', kicker: 'CAPÍTULO 3', img: '🏟️',
    text: [
      'Atlético El Llano aceptó tu correo. Te dieron tu primera acreditación de verdad, con tu nombre y tu foto.',
      'La Segunda División paga poco, pero ahí se curte un fotógrafo: una gradería techada que da a la calle, sintética rayada, postes de luz y partidos que se juegan con el alma.',
      'Cada foto buena que entregás llega a más gente. Y en la Primera siempre hay editores buscando caras nuevas.',
    ],
    goal: 'Cubrí la Segunda División en El Llano. Cuando tu reputación crezca, escribile a Ascenso Total.' },
  { n: 4, title: 'La acreditación de la Liga', kicker: 'CAPÍTULO 4', img: '🪪',
    text: [
      'Ricardo Solano, editor de Ascenso Total, vio tu trabajo en El Llano y te ofreció ser colaborador de la revista.',
      'Ahora entrás por el túnel de los estadios grandes: La Cueva, Alajuela, Cartago. En la zona de prensa te espera Kendall Rojas, treinta años sentado detrás de las porterías.',
      'Aquí ya no alcanza con que la foto esté bonita: el editor quiere la jugada, el gol y la historia del partido. Y la quiere ya.',
    ],
    goal: 'Cumplí los encargos del editor en Primera División. Los mejores fotógrafos llegan a las noches de copa.' },
  { n: 5, title: 'Noches internacionales', kicker: 'CAPÍTULO 5', img: '🏆',
    text: [
      'Ricardo te inscribió para cubrir la Copa Centroamericana. Otra acreditación, otra seguridad, otros rivales.',
      'Clubes de Honduras, Guatemala, Panamá y El Salvador llegan a los estadios ticos. Las fotos se venden fuera del país y tu nombre empieza a sonar en la región.',
    ],
    goal: 'Cubrí la copa y seguí subiendo tu reputación. El último paso es la Selección.' },
  { n: 6, title: 'La Sele', kicker: 'CAPÍTULO 6', img: '🇨🇷',
    text: [
      'Llegó el correo que todo fotógrafo tico sueña recibir: la jefa de prensa de la Selección Nacional te acredita para cubrir a Costa Rica en el Estadio Nacional.',
      'Treinta y cinco mil personas cantando el himno, la ola en las graderías y once jugadores que cargan con un país entero. Hace no tanto estabas detrás de una malla ciclón tomándole fotos a Diego.',
    ],
    goal: 'Cubrí los partidos de la Selección en el Estadio Nacional.' },
];
export const EPILOGUE = { title: 'Detrás de la malla, detrás de la portería', kicker: 'EPÍLOGO', img: '⭐',
  text: [
    'De las mejengas del jueves al Estadio Nacional. Miles de fotos borradas, correos sin respuesta, lluvias, desvelos y alguna foto que te hizo saltar de la silla.',
    'Ese es el camino de muchos fotógrafos deportivos: nadie te regala la acreditación, se gana foto a foto.',
    'La historia sigue: podés repetir cualquier cobertura y seguir mejorando tu portafolio.',
  ], goal: '¡Gracias por jugar ENTRE LÍNEAS!' };

// Contactos de correo: a quién se le escribe para subir de etapa y qué contestan.
// minRep / minEvents: lo que necesitan ver en tu portafolio para decir que sí.
export const MAIL_CONTACTS = {
  menores: { id: 'menores', name: 'Profe Andrés Vega', addr: 'ligasmenores@deportivotibas.cr', org: 'Ligas menores · Deportivo Tibás', unlocks: 1, minRep: 0, minEvents: 2,
    subject: 'Fotógrafo para las ligas menores', body: 'Buenas, profe. Soy {name}, fotógrafo. Diego me pasó su correo. Le comparto mi portafolio de Lente con fotos de fut 5 y fut 7. Me encantaría cubrir los partidos de la U-17 y la U-15. Quedo atento. Saludos.',
    yes: '¡Hola, {name}! Vi tus fotos de las mejengas: buen ojo para el momento. Te agregamos a la lista de prensa de las ligas menores. Mariana Quesada, de prensa de la Liga, te va a entregar la acreditación en cada partido. ¡Nos vemos en La Cantera!',
    no: 'Hola, {name}. Gracias por escribir. Por ahora necesitamos ver más trabajo tuyo: cubrí un par de partidos más y mandanos el portafolio otra vez. ¡Éxitos!' },
  llano: { id: 'llano', name: 'Karla Méndez', addr: 'prensa@atleticoelllano.cr', org: 'Prensa · Atlético El Llano (Segunda División)', unlocks: 2, minRep: 8, minEvents: 2,
    subject: 'Cobertura fotográfica de la Segunda', body: 'Hola, Karla. Soy {name}. He cubierto las ligas menores del Deportivo Tibás y quisiera fotografiar los partidos de Atlético El Llano. Adjunto mi portafolio. ¡Muchas gracias!',
    yes: '¡Hola, {name}! Nos gustó mucho tu trabajo con los juveniles. Te acreditamos para los partidos en El Llano. Es Segunda: poco espacio, mucha garra. ¡Bienvenido/a!',
    no: 'Hola, {name}. Tu portafolio va bien, pero para la Segunda pedimos un poco más de experiencia. Seguí con las ligas menores y escribinos de nuevo (necesitamos ver reputación 8 o más).' },
  ascenso: { id: 'ascenso', name: 'Ricardo Solano', addr: 'redaccion@ascensototal.cr', org: 'Editor deportivo · Ascenso Total', unlocks: 3, minRep: 16, minEvents: 2,
    subject: 'Colaboración como fotógrafo', body: 'Estimado Ricardo: soy {name}, fotógrafo de la Segunda División (Atlético El Llano). Me gustaría colaborar con Ascenso Total en la Primera División. Le envío mis mejores fotos. Saludos cordiales.',
    yes: '{name}: ya te tenía fichado/a por las fotos de El Llano. Te ofrezco ser colaborador/a de Ascenso Total: Primera División, acreditación de la Liga y encargos del editor. Pago por foto entregada. Kendall Rojas te espera en La Cueva.',
    no: '{name}, gracias por escribir. Me gusta tu trabajo, pero en Primera necesito constancia: seguí en la Segunda unas fechas más (reputación 16 o más) y hablamos.' },
  sele: { id: 'sele', name: 'Lucía Brenes', addr: 'prensa@seleccion.cr', org: 'Jefa de prensa · Selección Nacional', unlocks: 5, minRep: 50, minEvents: 1,
    subject: 'Solicitud de acreditación · Selección Nacional', body: 'Estimada Lucía: soy {name}, fotógrafo/a colaborador/a de Ascenso Total. He cubierto la Primera División y la Copa Centroamericana. Solicito acreditación para los partidos de la Selección en el Estadio Nacional. Adjunto portafolio.',
    yes: '{name}: es un gusto confirmarte la acreditación de prensa para los partidos de la Selección Nacional en el Estadio Nacional. Llegá temprano: hay revisión de seguridad especial. ¡Pura vida!',
    no: '{name}, gracias por tu solicitud. Las acreditaciones de la Selección son muy limitadas: seguí cubriendo la Primera y la Copa (reputación 50 o más) y volvé a escribirnos.' },
};
// Qué contacto se habilita en cada etapa (el que te lleva a la siguiente)
export const MAIL_BY_TIER = { 0: 'menores', 1: 'llano', 2: 'ascenso', 4: 'sele' };
