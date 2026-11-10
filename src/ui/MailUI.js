import { h, clear } from './dom.js';
import { MAIL_CONTACTS, TIERS } from '../career/Tiers.js';

// Qué hay que hacer ahora en el modo historia (se muestra en la redacción y en el Correo)
export function nextStep(game) {
  const c = game.career, t = c.tier, done = c.doneInTier(t);
  const pending = c.mail.sent.find((m) => m.status === 'pending');
  if (pending) return `⏳ Esperando la respuesta de ${MAIL_CONTACTS[pending.id].name}. Las respuestas llegan después de otra cobertura o en un rato.`;
  const writable = c.mail.contacts.find((id) => c.canWrite(id) && MAIL_CONTACTS[id].unlocks > t);
  if (writable) { const C = MAIL_CONTACTS[writable]; return `📧 Escribile a ${C.name} (${C.org}) desde el Correo para pasar a la siguiente etapa.`; }
  const goals = { 0: [2, 'Cubrí mejengas de tus amigos'], 1: [2, 'Cubrí partidos de ligas menores'], 2: [2, 'Cubrí partidos de la Segunda División'], 3: [3, 'Cubrí partidos de Primera (y llegá a reputación 30)'], 4: [1, 'Cubrí la Copa Centroamericana'] };
  const G = goals[t];
  if (G) return `🎯 ${G[1]}: ${Math.min(done, G[0])} / ${G[0]}.`;
  return '🇨🇷 Estás en la cima: cubrí a la Selección en el Estadio Nacional.';
}

export function renderMail(root, game, onChange) {
  const c = game.career, name = game.playerName || 'Fotógrafo';
  let view = 'inbox', open = null;
  const draw = () => {
    clear(root);
    const tabs = h('div', { class: 'mail-tabs' },
      h('button', { class: 'tab' + (view === 'inbox' ? ' on' : ''), onclick: () => { view = 'inbox'; open = null; draw(); } }, `Recibidos${c.unreadMail ? ` (${c.unreadMail})` : ''}`),
      h('button', { class: 'tab' + (view === 'write' ? ' on' : ''), onclick: () => { view = 'write'; open = null; draw(); } }, 'Redactar'),
      h('button', { class: 'tab' + (view === 'sent' ? ' on' : ''), onclick: () => { view = 'sent'; open = null; draw(); } }, 'Enviados'));
    root.append(tabs, h('div', { class: 'mail-step' }, nextStep(game)));
    if (view === 'inbox') {
      if (open) {
        const m = open, C = MAIL_CONTACTS[m.from];
        root.append(h('div', { class: 'mail-open' }, h('button', { class: 'btn small', onclick: () => { open = null; draw(); } }, '‹ Volver'),
          h('div', { class: 'mail-subj' }, m.subject), h('div', { class: 'muted', style: { fontSize: '12px' } }, `De: ${C?.name} <${C?.addr}>`),
          h('div', { class: 'mail-body' }, m.text), m.ok ? h('div', { class: 'pill on', style: { marginTop: '8px' } }, '✔ Aceptado: nueva etapa disponible en la redacción') : null));
        return;
      }
      if (!c.mail.inbox.length) root.append(h('div', { class: 'muted mail-empty' }, 'No tenés correos todavía. Cuando alguien te pase un contacto, escribile desde «Redactar».'));
      for (const m of c.mail.inbox) {
        const C = MAIL_CONTACTS[m.from];
        root.append(h('button', { class: 'mail-row' + (m.read ? '' : ' unread'), onclick: () => { m.read = true; open = m; onChange?.(); draw(); } },
          h('span', { class: 'av' }, m.ok ? '✅' : '✉️'), h('span', { class: 'mid' }, h('b', {}, C?.name || m.from), h('span', { class: 'prev' }, m.subject))));
      }
    } else if (view === 'write') {
      if (!c.mail.contacts.length) { root.append(h('div', { class: 'muted mail-empty' }, 'Todavía no tenés a quién escribirle. Seguí cubriendo partidos: alguien se va a fijar en tus fotos y te va a pasar un contacto.')); return; }
      for (const id of c.mail.contacts) {
        const C = MAIL_CONTACTS[id], st = c.mail.sent.filter((m) => m.id === id).slice(-1)[0];
        const status = st?.status === 'pending' ? '⏳ Esperando respuesta' : st?.status === 'yes' ? '✔ Te aceptaron' : st?.status === 'no' ? '✖ Te dijeron que no (podés volver a escribir)' : 'Sin escribir';
        root.append(h('div', { class: 'mail-compose' },
          h('div', {}, h('b', {}, C.name), h('span', { class: 'muted' }, ` · ${C.org}`)), h('div', { class: 'muted', style: { fontSize: '12px' } }, `Para: ${C.addr} · ${status}`),
          c.canWrite(id) ? h('div', {}, h('div', { class: 'mail-subj' }, `Asunto: ${C.subject}`), h('div', { class: 'mail-body' }, C.body.replaceAll('{name}', name)),
            h('div', { class: 'muted', style: { fontSize: '12px', margin: '6px 0' } }, `📎 Portafolio de Lente adjunto (${game.phone?.social.posts.length || 0} publicaciones · reputación ${Math.round(c.reputation)})`),
            h('button', { class: 'btn small primary', onclick: () => { if (c.sendMail(id)) { game.audio?.ui?.('click'); game.ui.toast(`📧 Correo enviado a ${C.name}. La respuesta puede tardar.`, 'good', 3500); game.saves.save('auto'); onChange?.(); view = 'sent'; draw(); } } }, '📨 Enviar correo')) : null));
      }
    } else {
      if (!c.mail.sent.length) root.append(h('div', { class: 'muted mail-empty' }, 'No has enviado correos.'));
      for (const m of c.mail.sent.slice().reverse()) {
        const C = MAIL_CONTACTS[m.id];
        root.append(h('div', { class: 'mail-row' }, h('span', { class: 'av' }, m.status === 'pending' ? '⏳' : m.status === 'yes' ? '✅' : '✖'), h('span', { class: 'mid' }, h('b', {}, `Para: ${C.name}`), h('span', { class: 'prev' }, `${C.subject} · ${m.status === 'pending' ? 'esperando respuesta…' : m.status === 'yes' ? 'aceptado' : 'rechazado'}`))));
      }
    }
  };
  draw();
  return { redraw: draw };
}

// Pantalla del Correo desde la redacción (con marco de celular)
export function openMailScreen(game, onClose) {
  const box = h('div', { class: 'mail-wrap' });
  const el = h('div', { class: 'screen' }, h('div', { class: 'panel mail-panel' },
    h('div', { class: 'mail-head' }, h('span', {}, '📧 Correo'), h('span', { class: 'muted', style: { fontSize: '12px' } }, `Etapa: ${TIERS[game.career.tier]?.name}`), h('button', { class: 'btn small', onclick: () => { game.ui.closeScreen(); onClose?.(); } }, 'Cerrar')), box));
  renderMail(box, game, () => {});
  game.ui.openScreen('mail', el);
}
