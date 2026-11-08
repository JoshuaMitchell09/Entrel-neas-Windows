import { pick, formatClock } from '../core/MathUtil.js';

/*
 * Conversaciones del teléfono: cada contacto tiene temas de varias vueltas.
 * Un tema es { key, label, reply, next } y cada opción de `next` puede tener su propio `next`,
 * así se arma un árbol de charla. Las frases usan el contexto del juego (hora, marcador, fotos…).
 */
function ctx(phone) {
  const g = phone.game, m = g.match, ev = g.story?.ev, inEv = !!(g.inEvent && ev);
  const kicked = !!g.story?.kickedOff;
  const score = m && kicked ? `${m.teams[0].short} ${m.score[0]}-${m.score[1]} ${m.teams[1].short}` : null;
  const left = inEv && !kicked ? Math.max(0, Math.round(ev.kickoff - g.clock)) : null;
  return {
    g, m, ev, inEv, kicked, score, left,
    home: inEv ? g.teamName(ev.home) : 'el equipo', away: inEv ? g.teamName(ev.away) : 'el rival',
    stadium: inEv ? (g.stadium?.cfg.name || 'el estadio') : 'el estadio',
    hour: formatClock(g.clock), name: (g.playerName || '').split(' ')[0] || 'mae',
    posts: phone.social.posts.length, followers: phone.social.followers, rep: Math.round(g.career.reputation),
    photos: g.photos.records.length, best: Math.round(Math.max(0, ...g.photos.records.map((r) => r.eval.score))),
    night: g.env.time === 'night', rain: g.env.weather === 'rain',
  };
}
// Atajos para escribir árboles
const O = (label, reply, next) => ({ label, reply, next });

export function topicsFor(phone, id) {
  const c = ctx(phone);
  const T = [];
  const add = (key, label, reply, next) => T.push({ key, label, reply, next });
  const where = c.inEv ? (c.kicked ? `Estoy en ${c.stadium}, ${c.score ? 'vamos ' + c.score : 'en pleno partido'}.` : `Ya estoy en ${c.stadium}, faltan ${c.left} min para el partido.`) : 'Estoy en la redacción, viendo qué me toca cubrir.';
  switch (id) {
    case 'mama':
      add('donde', '¿Qué hacés, ma?', `Aquí haciendo el almuerzo para mañana. ¿Y vos dónde andás?`, [
        O(where, c.night ? 'Ay, de noche y en ese estadio… abrigate y no te vengás muy tarde, por favor.' : '¡Qué dicha! Tomá agüita, que el sol está fuerte.', [
          O('Tranquila, ma. Ando con cuidado', 'Eso espero. Escribime cuando vengás para la casa ❤️'),
          O('Ya estoy grande, ma 😅', 'Para mí siempre vas a ser mi chiquito/a. Cuidate igual 😘'),
        ]),
        O('Trabajando, después te cuento', 'Está bien, no te molesto. ¡Te quiero!'),
      ]);
      add('comida', '¿Qué hiciste de comer?', pick(['Gallo pinto con huevo y natilla, como te gusta 😋', 'Arroz con pollo. Te guardé un plato en la refri.', 'Olla de carne. Hay para cuando llegués.']), [
        O('¡Guardame bastante!', 'Ya te aparté. Pero llegá a una hora decente 😂', [
          O('¿Qué es una hora decente? 😂', 'Antes de que tu papá se duerma en el sillón. O sea, las 9 jaja'),
        ]),
        O('Ya comí algo en la calle', '¿Otra vez comida de la calle? Después andás con dolor de panza… 🙄', [
          O('Fue un gallo de la soda, ma', 'Bueno, eso sí cuenta como comida. Te perdono 😄'),
          O('Unas papas y una coca nada más', '¡Eso no es comida! Mañana te hago desayuno en serio.'),
        ]),
      ]);
      add('trabajo', '¿Viste mis fotos?', c.posts ? `¡Claro! Las que subiste a Lente. Se las enseñé a la vecina, a la tía y al padre de la iglesia 😂` : 'Todavía no has subido nada a ese Lente… ¿cuándo me enseñás algo?', [
        O('¿Cuál te gustó más?', c.best >= 70 ? 'La que se ve todo nítido, parece de revista. Esa la quiero impresa.' : 'Todas, mi amor. Pero sí, alguna se ve un poquito movida jaja', [
          O('Te la imprimo para la sala', '¡Ay sí! Le voy a comprar un marco bonito 🖼️'),
          O('Voy mejorando, ya vas a ver', 'Yo sé. Siempre fuiste necio/a con lo que te gusta. Eso es bueno.'),
        ]),
        O('Subo más hoy', '¡Dale! Avisame para darle corazón ❤️'),
      ]);
      add('papa', '¿Y mi papá?', 'Aquí al lado, gritándole a la tele como si lo escucharan 📺😂', [
        O('Decile que se calme jaja', 'Ya se lo dije y me contestó que «es el clásico de su vida». Siempre dice lo mismo.'),
        O('¿Va con quién?', `Con ${c.home}, como siempre. Aunque dice que hoy no confía en la defensa.`),
      ]);
      add('dia', '¿Cómo te fue hoy?', pick(['Bien, fui al mercado y vi a doña Ligia. Te manda saludos.', 'Cansada, pero bien. Lavé, planché y vi la novela.', 'Bien. Tu abuela llamó, quiere que la visités pronto.']), [
        O('Saludos a todos', 'De tu parte. Y llamá a tu abuela, que se pone sentimental 😅'),
        O('El domingo vamos donde la abuela', '¡Le va a encantar! Hago un queque.'),
      ]);
      break;
    case 'papa':
      add('partido', c.kicked ? '¿Lo estás viendo, pa?' : '¿Lo vas a ver, pa?', c.kicked ? `¡Claro! ${c.score}. ${c.m && c.m.score[0] > c.m.score[1] ? 'Va bien la cosa.' : c.m && c.m.score[0] < c.m.score[1] ? 'Ese equipo no está jugando a nada…' : 'Partido trabado.'}` : `Ya tengo el sillón listo. ${c.home} contra ${c.away}, ¿verdad?`, [
        O('¿Cómo ves el partido?', pick(['Le falta un delantero que la meta. Mucha posesión y nada de gol.', 'El 10 está jugando muy bien, fijate en él.', 'El portero está inspirado hoy. Sacale buenas fotos.']), [
          O('Voy a estar atento a ese', 'Así me gusta. Un buen fotógrafo es como un buen defensa: lee la jugada antes.'),
          O('Vos sabés más que el técnico', '¡Diay, claro! Si me dieran el puesto… 😂'),
        ]),
        O('¿Quién gana?', pick([`${c.home}, dos a uno. Anotalo.`, 'Empate, hoy huele a empate.', `Se lo lleva ${c.away}, aunque me duela.`]), [
          O('Apostemos un café', '¡Hecho! Y el que pierde lo hace en la cafetera vieja ☕'),
        ]),
      ]);
      add('consejo', 'Pa, ¿algún consejo?', pick(['Trabajá con respeto y la gente te va a abrir las puertas.', 'No te comparés con los otros fotógrafos. Hacé lo tuyo.', 'Llegá temprano siempre. El que llega temprano escoge el mejor puesto.']), [
        O('Gracias, pa. Lo tomo en cuenta', 'Para eso estamos. Estoy orgulloso de vos, ¿sabés?', [
          O('Lo sé, pa ❤️', 'Bueno, ya, que me pongo sentimental. ¡A trabajar! 😄'),
        ]),
        O('¿Vos cómo empezaste a trabajar?', 'Cargando sacos en el mercado a los 15. Por eso me alegra que vos trabajés en lo que te gusta.', [
          O('Debió ser duro', 'Duro pero me hizo quien soy. Vos aprovechá cada oportunidad.'),
        ]),
      ]);
      add('carro', '¿Me prestás el carro el domingo?', 'Depende… ¿le vas a echar gasolina? ⛽', [
        O('Sí, se lo devuelvo lleno', 'Trato hecho. Y lavado, ya que estás 😂'),
        O('Le echo un poquito…', 'Ajá, «un poquito». La última vez me lo dejaste en reserva. Lo pienso.'),
      ]);
      add('equipo', '¿Viste la tabla de posiciones?', 'Sí. Si ganamos los próximos dos, nos metemos en zona de clasificación.', [
        O('Hay que creer', '¡Siempre! Hasta que las matemáticas digan lo contrario.'),
        O('Lo veo difícil', 'Vos siempre tan pesimista. Igualito a tu tío 😂'),
      ]);
      break;
    case 'vale':
      add('lente', '¿Cuántos seguidores tengo?', `Tenés ${c.followers} en Lente. ${c.followers > 400 ? 'Ya sos famoso/a, ¿me firmás un autógrafo? 😂' : 'Vas bien, pero tenés que subir más cosas.'}`, [
        O('¿Qué subo?', 'Fotos de la afición, la gente ama verse. Y los goles, obvio.', [
          O('Buena idea', 'Lo sé, soy la mejor community manager. Me pagás en helados 🍦'),
        ]),
        O('Compartilas vos también', 'Ya lo hago, ¿qué creés? Hasta mis amigas te siguen.'),
      ]);
      add('cole', '¿Cómo te fue en el cole?', pick(['Mal, tuve examen de mate y no sabía nada 😩', 'Bien, me saqué un 95 en ciencias 😎', 'Normal. La profe de inglés nos dejó un montón de tarea.']), [
        O('¿Querés que te ayude?', 'Sí porfa, el domingo. Pero vos me explicás despacio 🙏', [
          O('Trato hecho', '¡Sos el/la mejor! Bueno, a veces 😂'),
        ]),
        O('¡Así se hace!', 'Obvio. Inteligencia de familia 💅'),
      ]);
      add('chisme', '¿Algún chisme?', pick(['Diego le escribió a mi amiga Sofi. Creo que le gusta 👀', 'La vecina se compró un perro igualito al tuyo de cuando eras chiquito/a.', 'Mamá está viendo videos de cómo usar Lente para darte likes 😂']), [
        O('¿En serio? 😂', 'Te lo juro. Pero no digás que yo te conté 🤐'),
        O('No me interesa jaja', 'Mentira, sí te interesa. Te conozco 😏'),
      ]);
      add('foto', 'Mandame una selfie', 'No, vos mandá una del estadio desde donde estás 📸', [
        O('Ahí te va una', '¡Qué lindo se ve! Ya la subí a mis historias, te etiqueté.'),
        O('Estoy trabajando 😅', 'Siempre la misma excusa. Ok, pero después me mandás 🙄'),
      ]);
      break;
    case 'abuela':
      add('salud', '¿Cómo está, abuela?', pick(['Bien, mi amor, con un dolorcito en la rodilla pero ahí vamos.', 'Muy bien. Hoy fui a misa y recé por vos.', 'Contenta, me vino a visitar tu tía con los nietos.']), [
        O('Cuídese mucho', 'Usted también. Y coma bien, que en la foto se ve flaquito/a.', [
          O('Jaja como bien, abuela', 'Eso dicen todos. El domingo le hago sopa de mondongo.'),
        ]),
        O('El domingo la visito', '¡Qué alegría! Le hago tamales aunque no sea diciembre.'),
      ]);
      add('fut', '¿Ve fútbol, abuela?', 'Desde que tenía tu edad. Fui al estadio con tu abuelo muchas veces. Él sí sabía de fútbol.', [
        O('Cuénteme del abuelo', 'Llevaba un radio de baterías y escuchaba la narración aunque estuviera viendo el partido 😄 Gritaba los goles antes de que entraran.', [
          O('Qué lindo recuerdo', 'Usted se parece a él. Tiene la misma pasión.'),
        ]),
        O('Un día la llevo', 'Ay, ¿de verdad? Mi última vez fue en el 90. Llévame con sombrilla.'),
      ]);
      add('fe', 'Écheme una bendición', 'Que Dios me lo acompañe, me lo cuide y le dé muchas fotos bonitas 🙏', [
        O('Amén, abuela ❤️', 'Amén. Y abríguese, que en la noche hace frío.'),
      ]);
      break;
    case 'diego':
      add('ambiente', '¿Cómo se ve por tele?', c.kicked ? `Lleno, mae. ${c.score}. La barra no para.` : 'La previa se ve brutal, ya hay gente cantando afuera.', [
        O('Aquí se siente demasiado', '¡Qué envidia! Mandá un video de la barra 🔥', [
          O('Después te lo paso', 'Va, pero no se te olvide como la vez pasada 😂'),
        ]),
        O('¿Viste quién salió de titular?', pick(['Sí, el entrenador metió al chamaco nuevo. A ver qué tal.', 'El mismo once de siempre. Ese técnico no arriesga nada.']), [
          O('Hay que darle chance', 'Puede ser, pero si perdemos es culpa de él, que conste 😤'),
        ]),
      ]);
      add('mejenga', '¿Mejenga el jueves?', '¡De una! En la cancha sintética de siempre, a las 8.', [
        O('Yo llevo la bola', 'Perfecto. Andy dice que él lleva las birras 🍺', [
          O('Siempre dice eso y nunca lleva', '😂😂 Cierto. Esta vez lo obligamos.'),
        ]),
        O('No puedo, trabajo', 'Mae, desde que sos fotógrafo/a profesional no venís nunca 😒', [
          O('El otro jueves fijo', 'Te voy a sostener la palabra.'),
        ]),
      ]);
      add('fotos', '¿Te gustaron las fotos?', c.posts ? 'Mae, sí. La de la celebración está de póster.' : 'No has subido nada, mae. ¿Qué estás esperando?', [
        O('Gracias, mae', 'Diay, de nada. Ahora consiguime una camiseta firmada 😂'),
        O('Hoy subo más', 'Más te vale. Ya les conté a todos que sos mi compa famoso/a.'),
      ]);
      add('apuesta', '¿Apostamos algo?', `Va. Si gana ${c.home} me pagás un casado. Si no, te lo pago yo.`, [
        O('Hecho 🤝', 'Ya estás debiendo, mae 😂'),
        O('Mejor no, siempre perdés', '¡Mentira! La última vez gané… creo 🤔'),
      ]);
      break;
    case 'andy':
      add('soda', '¿Dónde lo estás viendo?', 'En la soda de doña Mari, con el pinto y el café. El ambiente está bonito.', [
        O('Saludos a doña Mari', 'Dice que cuándo venís, que te guarda una empanada 😋', [
          O('El sábado paso', 'Te esperamos, mae. Traé la cámara y nos hacés una sesión 😂'),
        ]),
        O('¿Hay mucha gente?', 'Llenísimo. Hasta el perro de la soda está viendo el partido 🐕'),
      ]);
      add('chiste', 'Contame algo', pick(['¿Sabés por qué el portero no fue a la fiesta? Porque no lo dejaban pasar 😂', 'Mi tío dice que él jugó en primera división. Pero en la liga de veteranos de Tres Ríos 😂', 'Hoy vi a un mae con la camiseta al revés en el bus. Así ando yo en la vida.']), [
        O('Jajaja qué malo', 'Malo pero te reíste, mae 😎'),
        O('Contame otro', '¿Qué le dijo la bola al poste? «Siempre me rechazás» 😂😂', [
          O('Ya, ya, suficiente 😂', 'Tengo cien más. Me debés escuchar todos algún día.'),
        ]),
      ]);
      add('trabajo', '¿Y el trabajo?', 'Igual, mae. El jefe me tiene haciendo inventario. Vos sí tenés el trabajo soñado.', [
        O('No es tan fácil como parece', 'Me imagino, mae. Pero estar en la cancha… eso no tiene precio.', [
          O('Eso sí es cierto', 'Disfrutalo. Y si un día necesitás asistente, aquí estoy 😂'),
        ]),
        O('Un día te llevo', '¿EN SERIO? Me pongo un chaleco y me hago el fotógrafo 😂'),
      ]);
      break;
    case 'kendall':
      add('consejo', '¿Algún consejo para hoy?', pick(['Fijate en la luz: cuando el sol baja, buscá a contraluz con cuidado. Puede salir algo precioso.', 'Si el partido está aburrido, buscá historias en el banco: el técnico, los suplentes.', 'No le quités el ojo al portero después de un gol en contra. Esas caras venden.']), [
        O('¿Y con qué lente?', 'Con el tele largo detrás de la portería y el corto para celebraciones cerca. Siempre dos opciones listas.', [
          O('¿Y si solo tengo uno?', 'Entonces aprendé a moverte. Los pies son el mejor zoom, mae.'),
        ]),
        O('Gracias, Kendall', 'Para servir. Y no se me ponga nervioso/a: la cámara huele el miedo 😄'),
      ]);
      add('historia', '¿Cuál ha sido su mejor foto?', 'Una final en el 2004: el portero arrodillado, llorando, solo en el área. Nadie más la vio porque todos estaban con el campeón.', [
        O('Qué buena historia', 'La moraleja: no sigás a la manada. Mirá para donde nadie está mirando.', [
          O('Lo voy a recordar', 'Eso espero. Así se hacen los grandes.'),
        ]),
        O('¿Todavía la tiene?', 'Impresa en mi casa, en la sala. Mi esposa dice que es la única foto que no le aburre 😂'),
      ]);
      add('equipo', '¿Qué cámara me recomienda?', `Con ${c.rep} de reputación, ahorrá para un cuerpo con buen enfoque continuo antes que para un lente más largo. El enfoque es todo.`, [
        O('¿Y la JM Sport?', 'Buena para empezar. Rápida y no cuesta un riñón.'),
        O('Quiero la Flagship', 'Jaja, todos queremos. Primero ganate el puesto, mae.'),
      ]);
      break;
    case 'mariana':
      add('acceso', '¿Puedo pasar al otro lado de la cancha?', 'Sí, pero siempre por detrás de la valla y nunca por el área técnica. Si dudás, preguntale a un steward.', [
        O('Entendido, gracias', '¡Con gusto! Que te vaya muy bien.'),
      ]);
      add('cortesia', '¿Hay cortesías para el próximo?', 'Estoy viendo con el club. Si sobran, sos de los primeros en mi lista 😉', [
        O('¡Muchas gracias!', 'No hay de qué. Te lo ganaste por ser puntual.'),
      ]);
      add('evento', '¿Cuál es el próximo partido?', 'Revisá el calendario en la redacción. Ricardo asigna las coberturas según tu reputación.', [
        O('¿Me recomendás alguno?', 'El clásico es otra cosa. Cuando te den acceso, no te lo perdás.'),
      ]);
      break;
    case 'editor':
      add('encargo', '¿Qué es lo más importante hoy?', c.inEv ? `«${c.ev.assignment.title}». ${c.ev.assignment.desc}` : 'Primero escogé una cobertura en la redacción.', [
        O('¿Cuántas fotos mando?', 'Máximo diez. Prefiero tres excelentes que diez del montón.', [
          O('Entendido', 'Perfecto. Y nada de fotos movidas, por favor.'),
        ]),
        O('¿Y si no hay gol?', 'Entonces contame el partido con caras, duelos y la afición. Siempre hay historia.'),
      ]);
      add('pago', '¿Cuándo pagan?', 'El pago sale al liquidar cada entrega. Fotos sobre 40 se pagan; las mejores, mejor.', [
        O('¿Y si mejoro?', 'Con más reputación te ofrecemos contrato de planta. Ganás más por foto.'),
      ]);
      add('portada', '¿Qué hace falta para la portada?', 'Momento clave, cara visible, nitidez y composición limpia. 85 o más.', [
        O('Lo voy a lograr', 'Eso quiero ver. La portada del lunes está esperando.'),
      ]);
      break;
  }
  return T;
}
