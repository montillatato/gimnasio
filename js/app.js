// APP GIMNASIO — lógica de la interfaz.
// La fuente de verdad es el backend (Apps Script). localStorage es solo caché y cola de envíos pendientes.
import { generarPlan, sugerirProgresion, estimarRM, evaluarDia, incremento, decremento, proponerAlternativa, estimarDuracion } from './motor.js';
import { CATALOGO, ZONAS } from './catalogo.js';
import { PLANES } from './planes.js';

const CLAVE_CACHE = 'gimnasio_cache_v1';
const CLAVE_API = 'gimnasio_api_url';
const CLAVE_SRV = 'gimnasio_api_clave'; // solo en este celular; nunca en el código ni en la hoja
const USUARIOS = { 'USR-001': 'Tato', 'USR-002': 'Lau' };
const ej_ = Object.fromEntries(CATALOGO.map(e => [e.id, e]));

// ---------- Estado ----------
const PERFIL_BASE = {
  nombre: '', fecha_nacimiento: '', sexo: '', altura_cm: '', peso_kg: '', grasa_pct: '', experiencia: '6-24 meses',
  objetivo: 'hipertrofia', objetivo_texto: '', objetivo_secundario: '', dias: 3, duracion_min: 75,
  lesiones: [], limitaciones: '', no_gustan: [], duelen: [], tono: 'neutro', mail_avisos: '', unidad: 'kg',
  chequeo_medico: 'no', chequeo_fecha: '', kcal_mantenimiento: ''
};

let S = {
  usuario: 'USR-001', perfil: { ...PERFIL_BASE }, sesiones: [], series: [], comidas: [], evaluaciones: [],
  buzon: [], cola: [], alertas: [], sesion: null, vista: 'hoy', previa: 'hoy', ejId: null, enviando: false
};
let UI = { panel: null, activo: 0, resultadoComida: null, ejProgreso: null, msg: '' };
let temp = { restante: 0, total: 0, id: null };

function cargarCache() {
  try {
    const c = JSON.parse(localStorage.getItem(CLAVE_CACHE) || 'null');
    if (c && c.usuario) S = { ...S, ...c, vista: 'hoy' };
  } catch (e) { /* sin caché: se sigue igual */ }
}
function guardarCache() {
  try { localStorage.setItem(CLAVE_CACHE, JSON.stringify(S)); } catch (e) { /* caché no disponible */ }
}
function apiUrl() { try { return localStorage.getItem(CLAVE_API) || ''; } catch (e) { return ''; } }
function apiClave() { try { return localStorage.getItem(CLAVE_SRV) || ''; } catch (e) { return ''; } }
function servidorListo() { return !!(apiUrl() && apiClave()); }
// Toda llamada es POST con JSON en el cuerpo; la URL no lleva clave ni datos.
async function llamar(accion, datos) {
  const r = await fetch(apiUrl(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ clave: apiClave(), usuario: S.usuario, accion, datos }) });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error);
  return j.resultado;
}

// ---------- Utilidades ----------
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ahora = () => new Date().toISOString();
const hoyStr = () => new Date().toISOString().slice(0, 10);
const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? 0 : n; };
const lista = (v) => { if (Array.isArray(v)) return v; try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
const fmtFecha = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }); };

function motorPerfil() {
  const p = S.perfil;
  return { objetivo: p.objetivo, dias: Number(p.dias) || 3, lesiones: p.lesiones, noGustan: p.no_gustan, duelen: p.duelen };
}
// Si el entrenador armó un plan para el usuario (planes.js), se usa ese. Si no, el plan base de generarPlan.
function planEntrenador(pe) {
  const sesiones = pe.dias.map((d, i) => {
    const ejercicios = d.ejercicios.map(x => {
      const c = ej_[x.id];
      const cuidados = (pe.lesiones || []).filter(z => c.zonasCuidado.includes(z) && c.ajustes?.[z]).map(z => `Por tu molestia de ${z}: ${c.ajustes[z]}`);
      return { ...x, nombre: c.nombre + (x.porLado ? ' (por lado)' : ''), equipo: c.equipo, cuidados,
        justificacion: cuidados.length ? `${x.motivo} ${cuidados.join(' ')}` : x.motivo };
    });
    return { orden: i + 1, nombre: d.nombre, dia: d.dia, duracionMin: estimarDuracion(ejercicios), ejercicios };
  });
  return { fuente: 'entrenador', estado: pe.estado, objetivo: pe.objetivo, dias: sesiones.length, sesiones,
    avisos: pe.estado === 'definitivo' ? [] : [`Plan ${pe.estado}.`], notas: pe.notas || [], aValidar: pe.aValidar || [], cardio: pe.cardio || [] };
}
function plan() {
  const pe = PLANES[S.usuario];
  if (pe) return planEntrenador(pe);
  return { ...generarPlan(motorPerfil()), fuente: 'automatico' };
}

// ---------- Backend ----------
async function enviar(accion, datos) {
  S.cola.push({ accion, datos });
  guardarCache();
  vaciarCola();
}
async function vaciarCola() {
  if (!servidorListo() || S.enviando) return;
  S.enviando = true;
  try {
    while (S.cola.length) {
      const it = S.cola[0];
      await llamar(it.accion, it.datos);
      S.cola.shift();
      guardarCache();
    }
  } catch (e) { UI.msg = 'Sin conexión con el servidor. Se reintenta solo.'; }
  S.enviando = false;
}
async function sincronizar() {
  if (!servidorListo()) return;
  await vaciarCola();
  if (S.cola.length) return; // no se pisa lo local mientras haya envíos pendientes
  try {
    const d = await llamar('leer', { que: 'todo' });
    if (d.perfil && (d.perfil.objetivo || d.perfil.nombre)) {
      S.perfil = { ...PERFIL_BASE, ...d.perfil, lesiones: lista(d.perfil.lesiones), no_gustan: lista(d.perfil.no_gustan), duelen: lista(d.perfil.duelen) };
    }
    S.sesiones = d.sesiones || []; S.series = d.series || []; S.comidas = d.comidas || [];
    S.evaluaciones = d.evaluaciones || []; S.buzon = d.buzon || [];
    UI.msg = '';
    guardarCache(); render();
  } catch (e) { UI.msg = 'No se pudo actualizar desde el servidor. Se muestran los datos guardados.'; render(); }
}

function alerta(tipo, detalle) {
  const k = tipo + '|' + detalle;
  if (S.alertas.includes(k)) return;
  S.alertas.push(k);
  enviar('alerta', { fecha: ahora(), tipo, detalle });
}

// ---------- Historial y plan del día ----------
function historial(id) {
  const g = {};
  S.series.filter(s => s.ejercicio_id === id).forEach(s => { (g[s.sesion_id] = g[s.sesion_id] || []).push(s); });
  return Object.values(g).sort((a, b) => String(a[0].fecha).localeCompare(String(b[0].fecha))).map(ss => ({
    peso: Math.max(...ss.map(s => num(s.peso))), reps: ss.map(s => num(s.reps)), rir: ss.map(s => num(s.rir)),
    dolor: Math.max(0, ...ss.map(s => s.dolor === 'sí' ? (num(s.escala_dolor) || 1) : 0))
  }));
}
function sugerencia(e) {
  const c = ej_[e.id];
  return sugerirProgresion(c, historial(e.id), e.reps, e.rir);
}
// Plan del entrenador: la sesión del día de la semana, o la próxima si hoy no hay fuerza.
// Plan automático: rota en orden, como antes.
const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
function indiceSesion(p) {
  if (p.fuente !== 'entrenador') return S.sesiones.length % p.sesiones.length;
  const hoy = new Date().getDay();
  for (let k = 0; k < 7; k++) {
    const i = p.sesiones.findIndex(s => s.dia === DIAS_SEMANA[(hoy + k) % 7]);
    if (i >= 0) return i;
  }
  return 0;
}
function sesionDelDia() {
  const p = plan();
  if (!p.sesiones.length) return null;
  return p.sesiones[indiceSesion(p)];
}
function respuestasSinLeer() { return S.buzon.filter(b => b.estado === 'respondida' && b.leida !== 'sí').length; }

// ---------- Temporizador ----------
function iniciarTemp(seg) {
  clearInterval(temp.id);
  temp.restante = seg; temp.total = seg;
  temp.id = setInterval(() => {
    temp.restante--;
    if (temp.restante <= 0) {
      clearInterval(temp.id); temp.id = null; temp.restante = 0;
      try { navigator.vibrate && navigator.vibrate([300, 150, 300]); } catch (e) { /* sin vibración */ }
    }
    pintarTemp();
  }, 1000);
  pintarTemp();
}
function pintarTemp() {
  const c = $('#temp-contenedor');
  if (!temp.total) { c.innerHTML = ''; return; }
  const m = Math.floor(Math.max(temp.restante, 0) / 60), s = Math.max(temp.restante, 0) % 60;
  c.innerHTML = `<div class="temporizador"><span>${temp.restante > 0 ? 'Descanso ' : '¡A la próxima serie! '}${m}:${String(s).padStart(2, '0')}</span>
    <span><button data-acc="tempMas">+30 s</button> <button data-acc="tempFin">Listo</button></span></div>`;
}

// ---------- Imagen del ejercicio ----------
// Solo se usan archivos de imagenes/. Si falta, se muestra la descripción y se registra una alerta.
function imagenEj(c) {
  if (!c.imagen) { alerta('imagen faltante', c.id + ' ' + c.nombre); return ''; }
  return `<img class="img-ej" src="imagenes/${esc(c.imagen)}" alt="${esc(c.nombre)}" data-ej="${esc(c.id)}" onerror="this.dispatchEvent(new CustomEvent('imgfalta',{bubbles:true}));this.remove()">`;
}
document.addEventListener('imgfalta', (e) => {
  const id = e.target && e.target.dataset && e.target.dataset.ej;
  if (id) alerta('imagen faltante', id + ' ' + (ej_[id] ? ej_[id].nombre : ''));
});

// ---------- Vistas ----------
const TITULOS = { hoy: 'Hoy', sesion: 'Sesión', ejercicio: 'Ejercicio', comida: 'Comida', progreso: 'Progreso', entrenador: 'Entrenador', buzon: 'Buzón', perfil: 'Perfil' };

function render() {
  const v = S.vista;
  $('#titulo').textContent = TITULOS[v] || 'Gimnasio';
  $('#quien').textContent = USUARIOS[S.usuario] || '';
  document.querySelectorAll('#nav button').forEach(b => {
    b.classList.toggle('activo', b.dataset.v === (v === 'sesion' || v === 'ejercicio' ? 'hoy' : v));
    const old = b.querySelector('.globo'); if (old) old.remove();
    if (b.dataset.v === 'buzon' && respuestasSinLeer()) b.insertAdjacentHTML('beforeend', `<span class="globo">${respuestasSinLeer()}</span>`);
  });
  const f = { hoy: vHoy, sesion: vSesion, ejercicio: vEjercicio, comida: vComida, progreso: vProgreso, entrenador: vEntrenador, buzon: vBuzon, perfil: vPerfil }[v];
  const aviso = (UI.msg ? `<div class="aviso">${esc(UI.msg)}</div>` : '') + (S.cola.length && servidorListo() ? `<p class="suave">${S.cola.length} cambio(s) sin enviar.</p>` : '');
  $('#vista').innerHTML = aviso + f();
  guardarCache();
}
function ir(v) {
  if (v === 'ejercicio') S.previa = S.vista;
  S.vista = v; UI.panel = null;
  if (v === 'buzon') marcarLeidas();
  render(); window.scrollTo(0, 0);
}

function vHoy() {
  const p = S.perfil;
  const sin = !servidorListo() ? `<div class="aviso">Modo local: falta la dirección o la clave del servidor (Perfil, "Servidor y datos"). Mientras tanto los datos quedan solo en este celular.</div>` : '';
  if (!p.nombre) return sin + `<div class="tarjeta"><h3>Empecemos por tu perfil</h3><p class="suave">Con tu objetivo, tus días y tus molestias armamos el plan.</p><button class="b principal" data-acc="ir" data-v="perfil">Completar perfil</button></div>`;
  const s = sesionDelDia();
  if (!s) return sin + '<p>No hay plan. Revisá el perfil.</p>';
  const filas = s.ejercicios.map(e => {
    const sg = sugerencia(e);
    return `<div class="serie"><span><b>${esc(e.nombre)}</b><br><span class="suave">${e.series} x ${e.reps[0]}-${e.reps[1]} · RIR ${e.rir}</span></span>
      <span style="text-align:right">${sg.peso == null ? '<span class="suave">a definir</span>' : '<b>' + sg.peso + ' kg</b>'}</span></div>`;
  }).join('');
  const ult = S.sesiones.slice(-1)[0];
  const pl = plan();
  const etiqueta = pl.fuente === 'entrenador'
    ? `${esc(s.dia)}${s.dia === DIAS_SEMANA[new Date().getDay()] ? '' : ' (próxima)'} · ~${s.duracionMin} min${pl.estado !== 'definitivo' ? ' · ' + esc(pl.estado) : ''}`
    : `Sesión ${indiceSesion(pl) + 1} de ${pl.sesiones.length} · plan automático (sin plan del entrenador)`;
  return sin + `<div class="tarjeta"><span class="etiqueta">${etiqueta}</span>
    <h2>${esc(s.nombre)}</h2>${filas}
    <div style="height:12px"></div>
    <button class="b principal" data-acc="empezar">${S.sesion ? 'Continuar sesión' : 'Empezar sesión'}</button></div>
    ${ult ? `<p class="suave">Última sesión: ${esc(ult.nombre)}, ${fmtFecha(ult.fecha)}.</p>` : ''}
    ${respuestasSinLeer() ? `<button class="b" data-acc="ir" data-v="buzon">Tenés ${respuestasSinLeer()} respuesta(s) nueva(s)</button>` : ''}`;
}

function vSesion() {
  const se = S.sesion;
  if (!se) return '<p>No hay sesión en curso.</p><button class="b" data-acc="ir" data-v="hoy">Volver</button>';
  const cards = se.ejercicios.map((e, i) => cardEj(e, i)).join('');
  return `<p class="suave">${esc(se.nombre)} · ${se.ejercicios.length} ejercicios</p>${cards}
    ${UI.panel && UI.panel.tipo === 'fin' ? panelFin() : '<button class="b principal" data-acc="finalizar">Terminar sesión</button>'}`;
}

function cardEj(e, i) {
  const c = ej_[e.id];
  const hechas = S.series.filter(s => s.sesion_id === S.sesion.id && s.ejercicio_id === e.id);
  const abierto = UI.activo === i;
  let html = `<div class="tarjeta"><div class="fila" style="flex-wrap:nowrap"><div data-acc="abrir" data-i="${i}" style="flex:1"><h3>${esc(e.nombre)}</h3>
    <span class="suave">${hechas.length}/${e.series} series · ${e.reps[0]}-${e.reps[1]} reps · RIR ${e.rir}</span></div>
    <button class="b chico" data-acc="verEj" data-id="${e.id}">Info</button></div>`;
  if (abierto) {
    const sg = sugerencia(e);
    const en = (se_entrada[e.id] ||= { peso: sg.peso ?? (hechas.length ? num(hechas[hechas.length - 1].peso) : 0), reps: e.reps[1] > 8 ? e.reps[0] + 2 : e.reps[0], rir: e.rir });
    const pasoMas = incremento(c, en.peso), pasoMenos = decremento(c, en.peso);
    html += `<p class="suave">${esc(sg.motivo)}</p>`;
    html += hechas.map(s => `<div class="serie"><span>Serie ${s.num_serie}</span><span><b>${s.peso} kg x ${s.reps}</b> · RIR ${s.rir}${s.dolor === 'sí' ? ' · dolor' : ''}</span></div>`).join('');
    html += `<label>Peso (kg)</label><div class="num"><button class="b" data-acc="ajuste" data-id="${e.id}" data-c="peso" data-d="${-pasoMenos}">−</button><input inputmode="decimal" data-in="peso" data-id="${e.id}" value="${en.peso}"><button class="b" data-acc="ajuste" data-id="${e.id}" data-c="peso" data-d="${pasoMas}">+</button></div>
      <label>Repeticiones</label><div class="num"><button class="b" data-acc="ajuste" data-id="${e.id}" data-c="reps" data-d="-1">−</button><input inputmode="numeric" data-in="reps" data-id="${e.id}" value="${en.reps}"><button class="b" data-acc="ajuste" data-id="${e.id}" data-c="reps" data-d="1">+</button></div>
      <label>RIR (repeticiones que te quedaban)</label><div class="fila rir">${[0, 1, 2, 3].map(r => `<button class="b ${en.rir === r ? 'sel' : ''}" data-acc="rir" data-id="${e.id}" data-r="${r}">${r === 3 ? '3+' : r}</button>`).join('')}</div>
      <div style="height:12px"></div><button class="b principal" data-acc="serie" data-i="${i}">Registrar serie ${hechas.length + 1}</button>
      <div style="height:8px"></div><div class="fila"><button class="b" data-acc="panel" data-t="gusta" data-i="${i}">No me gusta</button><button class="b peligro" data-acc="panel" data-t="duele" data-i="${i}">Me duele</button></div>`;
    if (UI.panel && UI.panel.i === i && UI.panel.tipo === 'gusta') html += panelGusta(e);
    if (UI.panel && UI.panel.i === i && UI.panel.tipo === 'duele') html += panelDuele();
  }
  return html + '</div>';
}
const se_entrada = {}; // peso, reps y RIR que se están cargando por ejercicio

function alternativa(e) {
  const usados = new Set(S.sesion.ejercicios.map(x => x.id));
  return proponerAlternativa(e.id, motorPerfil(), usados).ejercicio;
}
function panelGusta(e) {
  const a = alternativa(e);
  if (!a) return `<div class="aviso" style="margin-top:12px">No hay una alternativa válida del mismo patrón. Anotalo en el Buzón para que el entrenador la revise.</div>`;
  return `<div class="tarjeta" style="margin-top:12px"><b>Alternativa propuesta</b><h3>${esc(a.nombre)}</h3><p class="suave">${esc(a.justificacion)}</p>
    <div class="fila"><button class="b principal" data-acc="aceptaAlt" data-i="${UI.panel.i}">Aceptar</button><button class="b" data-acc="cierraPanel">Rechazar</button></div></div>`;
}
function panelDuele() {
  return `<div class="tarjeta" style="margin-top:12px"><b>¿Dónde te duele?</b>
    <select id="zonaDolor">${ZONAS.map(z => `<option>${z}</option>`).join('')}<option>otra</option></select>
    <label>Intensidad</label><div class="fila rir">${[1, 2, 3].map(n => `<button class="b ${UI.panel.escala === n ? 'sel' : ''}" data-acc="escala" data-n="${n}">${n}</button>`).join('')}</div>
    <p class="suave">1 leve, 2 moderado, 3 fuerte. El ejercicio se excluye del plan.</p>
    <div class="fila"><button class="b peligro" data-acc="confirmaDuele" data-i="${UI.panel.i}">Excluir ejercicio</button><button class="b" data-acc="cierraPanel">Cancelar</button></div></div>`;
}
function panelFin() {
  return `<div class="tarjeta"><h3>Cerrar sesión</h3><label>Sensación general (1 a 5)</label>
    <div class="fila rir">${[1, 2, 3, 4, 5].map(n => `<button class="b ${UI.panel.sens === n ? 'sel' : ''}" data-acc="sens" data-n="${n}">${n}</button>`).join('')}</div>
    <label>Comentario</label><textarea id="comSesion" placeholder="Opcional"></textarea><div style="height:12px"></div>
    <button class="b principal" data-acc="guardarSesion">Guardar sesión</button></div>`;
}

function vEjercicio() {
  const c = ej_[S.ejId];
  if (!c) return '<button class="b" data-acc="ir" data-v="hoy">Volver</button>';
  let porque = '';
  plan().sesiones.forEach(s => s.ejercicios.forEach(e => { if (e.id === c.id && !porque) porque = e.justificacion; }));
  return `<button class="b chico" data-acc="ir" data-v="${S.previa}">← Volver</button><div style="height:12px"></div>
    <div class="tarjeta">${imagenEj(c)}<h2>${esc(c.nombre)}</h2><p>${esc(c.descripcion)}</p>
    <h3>Técnica</h3><ul>${c.tecnica.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
    <h3>Por qué está en el plan</h3><p>${esc(porque || c.justificacion)}</p>
    ${c.zonasCuidado.length ? `<p class="suave">Cuidado con: ${esc(c.zonasCuidado.join(', '))}.</p>` : ''}
    <p class="suave">Músculos: ${esc(c.musculos.join(', '))} · Equipo: ${esc(c.equipo)}</p></div>`;
}

const CHEQUEO = {
  proteina: ['suficiente', 'justa', 'faltante'], verduras: ['suficiente', 'faltante'], carbohidratos: ['acorde', 'sobra', 'falta'],
  grasas: ['acorde', 'excede'], ultraprocesados: ['pocos', 'algunos', 'muchos'], agua: ['suficiente', 'faltante']
};
function vComida() {
  const hoy = S.comidas.filter(c => String(c.fecha).slice(0, 10) === hoyStr());
  const kcal = hoy.reduce((a, c) => a + num(c.calorias), 0);
  const r = UI.resultadoComida;
  return `<div class="tarjeta"><h3>Qué comiste</h3>
    <label>Descripción</label><textarea id="cTexto" placeholder="Ej: almuerzo, milanesa de pollo con ensalada"></textarea>
    <div class="fila"><div><label>Horario (opcional)</label><input id="cHora" type="time"></div><div><label>Calorías (opcional)</label><input id="cKcal" inputmode="numeric"></div></div>
    <label>Proteína del día (g), opcional</label><input id="cProteina" inputmode="numeric">
    <h3 style="margin-top:14px">Chequeo del día</h3><p class="suave">Confirmá cómo estuvo cada punto antes de evaluar.</p>
    ${Object.keys(CHEQUEO).map(k => `<label>${k}</label><select data-chk="${k}"><option value="">sin dato</option>${CHEQUEO[k].map(o => `<option>${o}</option>`).join('')}</select>`).join('')}
    <div style="height:14px"></div><button class="b principal" data-acc="evaluar">Guardar y evaluar</button></div>
    ${r ? `<div class="tarjeta"><span class="etiqueta ${r.enLinea ? '' : 'pend'}">${r.enLinea ? 'En línea' : 'No en línea'}</span><p>${esc(r.resumen)}</p>
      ${r.bien.length ? `<p class="suave">Bien: ${esc(r.bien.join(', '))}</p>` : ''}</div>` : ''}
    <h3>Hoy</h3>${hoy.length ? hoy.map(c => `<div class="serie"><span>${esc(c.horario || '')} ${esc(c.texto)}</span><span>${c.calorias ? c.calorias + ' kcal' : ''}</span></div>`).join('') + (kcal ? `<p class="suave">Total cargado: ${kcal} kcal</p>` : '') : '<p class="suave">Todavía no cargaste comidas hoy.</p>'}
    <p class="suave">La evaluación es orientativa. Si tenés una condición médica, consultá con una nutricionista deportóloga.</p>`;
}

function vProgreso() {
  const ids = [...new Set(S.series.map(s => s.ejercicio_id))].filter(id => ej_[id]);
  const sel = UI.ejProgreso && ids.includes(UI.ejProgreso) ? UI.ejProgreso : ids[0];
  let graf = '<p class="suave">Todavía no hay series registradas.</p>';
  if (sel) {
    const h = historial(sel);
    const pesos = h.map(x => x.peso);
    const mejor = Math.max(...S.series.filter(s => s.ejercicio_id === sel).map(s => estimarRM(num(s.peso), num(s.reps))));
    graf = `<select data-acc-ch="ejProgreso">${ids.map(id => `<option value="${id}" ${id === sel ? 'selected' : ''}>${esc(ej_[id].nombre)}</option>`).join('')}</select>
      ${linea(pesos)}<p class="suave">Mejor peso por sesión (kg). 1RM estimado: <b>${mejor} kg</b></p>`;
  }
  // Volumen semanal: series de los últimos 7 días (principal = 1, secundarios = 0,5)
  const desde = Date.now() - 7 * 864e5, vol = {};
  S.series.filter(s => new Date(s.fecha).getTime() >= desde && ej_[s.ejercicio_id]).forEach(s => {
    const c = ej_[s.ejercicio_id];
    const m = c.musculos[0]; vol[m] = (vol[m] || 0) + 1;
    (c.secundarios || []).forEach(x => { vol[x] = (vol[x] || 0) + 0.5; });
  });
  const max = Math.max(1, ...Object.values(vol));
  const volHtml = Object.keys(vol).length ? Object.entries(vol).sort((a, b) => b[1] - a[1]).map(([m, n]) =>
    `<div class="serie"><span>${esc(m)}</span><span>${Math.round(n * 10) / 10} series</span></div><div class="barra"><div style="width:${n / max * 100}%"></div></div>`).join('') : '<p class="suave">Sin series en los últimos 7 días.</p>';
  const ult28 = S.sesiones.filter(s => new Date(s.fecha).getTime() >= Date.now() - 28 * 864e5).length;
  const meta = (Number(S.perfil.dias) || 3) * 4, adh = Math.min(100, Math.round(ult28 / meta * 100));
  return `<div class="tarjeta"><h3>Carga por ejercicio</h3>${graf}</div>
    <div class="tarjeta"><h3>Volumen por músculo (7 días)</h3>${volHtml}</div>
    <div class="tarjeta"><h3>Adherencia (28 días)</h3><p><b>${ult28} de ${meta}</b> sesiones · ${adh}%</p><div class="barra"><div style="width:${adh}%"></div></div></div>`;
}
function linea(v) {
  if (v.length < 2) return `<p><b>${v[0] ?? '-'} kg</b></p>`;
  const mn = Math.min(...v), mx = Math.max(...v), r = mx - mn || 1;
  const pts = v.map((x, i) => `${(i / (v.length - 1)) * 300 + 5},${105 - ((x - mn) / r) * 90}`).join(' ');
  return `<svg class="lin" viewBox="0 0 310 120" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="var(--acento)" stroke-width="3" stroke-linejoin="round"/></svg>`;
}

function vEntrenador() {
  const p = plan();
  const resp = S.buzon.filter(b => b.respuesta);
  const ent = p.fuente === 'entrenador';
  const li = (xs) => `<ul>${xs.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
  return `<p class="suave">${ent ? `Plan del entrenador (${esc(p.estado)}). Cada ejercicio lleva su motivo.` : 'No hay plan del entrenador para este usuario: plan base automático según tu perfil.'} El entrenador lo ajusta con tus datos reales.</p>
    ${p.avisos.length ? `<div class="aviso">${p.avisos.map(esc).join('<br>')}</div>` : ''}
    ${ent && p.aValidar.length ? `<div class="tarjeta"><h3>A validar</h3>${li(p.aValidar)}</div>` : ''}
    ${ent && p.notas.length ? `<div class="tarjeta"><h3>Criterio del plan</h3>${li(p.notas)}</div>` : ''}
    ${ent && p.cardio.length ? `<div class="tarjeta"><h3>Cardio (sesiones aparte)</h3>${p.cardio.map(c => `<div class="serie" style="display:block"><b>${esc(c.dia)}: ${esc(ej_[c.id] ? ej_[c.id].nombre : c.id)}</b>
      <span class="suave"> · ${esc(c.duracionMin)} min · ${esc(c.intensidad)}</span><div class="suave">${esc(c.motivo)}</div></div>`).join('')}</div>` : ''}
    ${p.sesiones.map(s => `<div class="tarjeta"><h3>${ent ? '' : `Día ${s.orden}: `}${esc(s.nombre)}</h3><p class="suave">Duración estimada: ~${s.duracionMin} min</p>${s.ejercicios.map(e => `<div class="serie" style="display:block"><b>${esc(e.nombre)}</b>
      <span class="suave"> · ${e.series} x ${e.reps[0]}-${e.reps[1]} · RIR ${e.rir} · descanso ${Math.round(e.descanso / 60 * 10) / 10} min</span>
      <div class="suave">${esc(e.justificacion)}</div><button class="b chico" data-acc="verEj" data-id="${e.id}">Ver ejercicio</button></div>`).join('')}</div>`).join('')}
    <h3>Respuestas del entrenador</h3>${resp.length ? resp.map(b => `<div class="tarjeta"><div class="suave">${esc(b.texto)}</div><p>${esc(b.respuesta)}</p></div>`).join('') : '<p class="suave">Sin respuestas todavía.</p>'}`;
}

function vBuzon() {
  const l = [...S.buzon].reverse();
  return `<div class="tarjeta"><h3>Nueva entrada</h3><label>Tipo</label><select id="bTipo"><option value="consulta">Consulta</option><option value="sugerencia">Sugerencia</option><option value="reporte de error">Reporte de error</option></select>
    <label>Texto</label><textarea id="bTexto"></textarea><div style="height:12px"></div><button class="b principal" data-acc="enviarBuzon">Enviar</button></div>
    ${l.map(b => `<div class="tarjeta"><span class="etiqueta ${b.estado === 'respondida' ? '' : 'pend'}">${esc(b.estado || 'pendiente')}</span> <span class="suave">${esc(b.tipo)} · ${fmtFecha(b.fecha)}</span>
      <p>${esc(b.texto)}</p>${b.respuesta ? `<div class="tarjeta" style="background:var(--acento-suave)"><b>Respuesta</b><p>${esc(b.respuesta)}</p></div>` : ''}</div>`).join('')}`;
}

function vPerfil() {
  const p = S.perfil;
  const op = (arr, v) => arr.map(o => `<option ${o === v ? 'selected' : ''}>${o}</option>`).join('');
  const inp = (k, t = 'text', extra = '') => `<input data-p="${k}" type="${t}" value="${esc(p[k])}" ${extra}>`;
  return `<div class="tarjeta">
    <label>Usuario</label><select id="selUsuario">${Object.keys(USUARIOS).map(u => `<option value="${u}" ${u === S.usuario ? 'selected' : ''}>${u} · ${USUARIOS[u]}</option>`).join('')}</select>
    <label>Nombre</label>${inp('nombre')}
    <label>Fecha de nacimiento</label>${inp('fecha_nacimiento', 'date')}
    <label>Sexo</label><select data-p="sexo"><option value=""></option>${op(['femenino', 'masculino', 'otro'], p.sexo)}</select>
    <div class="fila"><div><label>Altura (cm)</label>${inp('altura_cm', 'text', 'inputmode="numeric"')}</div><div><label>Peso (kg)</label>${inp('peso_kg', 'text', 'inputmode="decimal"')}</div><div><label>% grasa</label>${inp('grasa_pct', 'text', 'inputmode="decimal"')}</div></div>
    <label>Experiencia</label><select data-p="experiencia">${op(['nunca', '<6 meses', '6-24 meses', '>2 años'], p.experiencia)}</select>
    <label>Objetivo principal</label><select data-p="objetivo">${['hipertrofia', 'recomposicion', 'fuerza'].map(o => `<option ${o === p.objetivo ? 'selected' : ''}>${o}</option>`).join('')}</select>
    <label>Objetivo en tus palabras</label>${inp('objetivo_texto')}
    <label>Objetivo secundario</label>${inp('objetivo_secundario')}
    <div class="fila"><div><label>Días por semana</label><select data-p="dias">${[2, 3, 4, 5, 6].map(n => `<option ${n === Number(p.dias) ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
    <div><label>Minutos máx. (90)</label>${inp('duracion_min', 'text', 'inputmode="numeric"')}</div></div>
    <label>Zonas con molestia</label><div class="fila">${ZONAS.map(z => `<label style="margin:0"><input type="checkbox" style="width:auto;min-height:0" data-zona="${z}" ${p.lesiones.includes(z) ? 'checked' : ''}> ${z}</label>`).join('')}</div>
    <label>Limitaciones médicas (solo para el entrenador)</label>${inp('limitaciones')}
    <label>Tono de feedback</label><select data-p="tono">${op(['critico', 'motivador', 'neutro'], p.tono)}</select>
    <label>Mail para avisos</label>${inp('mail_avisos', 'email')}
    <label>Calorías de mantenimiento (opcional)</label>${inp('kcal_mantenimiento', 'text', 'inputmode="numeric"')}
    <label>Unidad de peso</label><select data-p="unidad">${op(['kg', 'lb'], p.unidad)}</select>
    <label>Chequeo médico</label><div class="fila"><select data-p="chequeo_medico">${op(['sí', 'no'], p.chequeo_medico)}</select>${inp('chequeo_fecha', 'date')}</div>
    <div style="height:14px"></div><button class="b principal" data-acc="guardarPerfil">Guardar perfil</button></div>
    <div class="tarjeta"><h3>Ejercicios excluidos y que no gustan</h3>
    ${[...p.duelen.map(id => ['duele', id]), ...p.no_gustan.map(id => ['gusta', id])].map(([t, id]) => `<div class="serie"><span>${esc(ej_[id] ? ej_[id].nombre : id)}<br><span class="suave">${t === 'duele' ? 'Me duele' : 'No me gusta'}</span></span>
      <button class="b chico" data-acc="levantar" data-t="${t}" data-id="${id}">Levantar</button></div>`).join('') || '<p class="suave">Ninguno.</p>'}</div>
    <div class="tarjeta"><h3>Servidor y datos</h3><label>Dirección del servidor (este celular)</label>
    <input id="apiUrl" value="${esc(apiUrl())}" placeholder="https://script.google.com/...">
    <label>Clave del servidor (este celular)</label><input id="apiClave" type="password" autocomplete="off" value="${esc(apiClave())}"><div style="height:10px"></div>
    <div class="fila"><button class="b" data-acc="guardarApi">Conectar</button><button class="b" data-acc="exportar">Exportar CSV</button></div></div>`;
}

// ---------- Acciones ----------
function marcarLeidas() {
  if (!respuestasSinLeer()) return;
  S.buzon.forEach(b => { if (b.estado === 'respondida') b.leida = 'sí'; });
  enviar('marcarLeidas', {});
}

function leerPerfilForm() {
  document.querySelectorAll('[data-p]').forEach(el => { S.perfil[el.dataset.p] = el.value; });
  S.perfil.lesiones = [...document.querySelectorAll('[data-zona]')].filter(c => c.checked).map(c => c.dataset.zona);
  S.perfil.dias = Number(S.perfil.dias) || 3;
  S.perfil.duracion_min = Math.min(90, Number(S.perfil.duracion_min) || 90);
}
function guardarRutina() {
  const filas = [];
  plan().sesiones.forEach(s => s.ejercicios.forEach((e, i) => filas.push({
    objetivo: S.perfil.objetivo, sesion: s.nombre, orden: i + 1, ejercicio_id: e.id, ejercicio: e.nombre, series: e.series,
    reps_min: e.reps[0], reps_max: e.reps[1], rir: e.rir, descanso_s: e.descanso, justificacion: e.justificacion })));
  enviar('rutina', { filas });
}
function perfilPlano() {
  const p = { ...S.perfil };
  return p; // enviar() serializa listas; el backend las guarda como JSON
}
function reemplazar(i, a) {
  const e = S.sesion.ejercicios[i];
  S.sesion.ejercicios[i] = { ...e, id: a.id, nombre: a.nombre, justificacion: a.justificacion };
}
function descargarCSV() {
  const q = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const bloque = (nombre, filas) => filas.length ? `# ${nombre}\n${Object.keys(filas[0]).map(q).join(',')}\n${filas.map(f => Object.values(f).map(q).join(',')).join('\n')}\n\n` : '';
  const txt = bloque('Perfiles', [{ usuario: S.usuario, ...S.perfil, lesiones: S.perfil.lesiones.join('|'), no_gustan: S.perfil.no_gustan.join('|'), duelen: S.perfil.duelen.join('|') }])
    + bloque('Sesiones', S.sesiones) + bloque('Series', S.series) + bloque('Comidas', S.comidas) + bloque('Evaluaciones', S.evaluaciones) + bloque('Buzon', S.buzon);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + txt], { type: 'text/csv;charset=utf-8' }));
  a.download = 'datos_gimnasio.csv'; a.click();
}

const ACC = {
  ir: (el) => ir(el.dataset.v),
  verEj: (el) => { S.ejId = el.dataset.id; ir('ejercicio'); },
  empezar: () => {
    if (!S.sesion) {
      const s = sesionDelDia();
      S.sesion = { id: 'S' + Date.now(), inicio: ahora(), nombre: s.nombre, ejercicios: JSON.parse(JSON.stringify(s.ejercicios)) };
      UI.activo = 0;
    }
    ir('sesion');
  },
  abrir: (el) => { UI.activo = Number(el.dataset.i); UI.panel = null; render(); },
  ajuste: (el) => {
    const en = se_entrada[el.dataset.id], c = el.dataset.c;
    en[c] = Math.max(0, Math.round((num(en[c]) + num(el.dataset.d)) * 10) / 10); render();
  },
  rir: (el) => { se_entrada[el.dataset.id].rir = Number(el.dataset.r); render(); },
  serie: (el) => {
    const i = Number(el.dataset.i), e = S.sesion.ejercicios[i], en = se_entrada[e.id];
    const n = S.series.filter(s => s.sesion_id === S.sesion.id && s.ejercicio_id === e.id).length + 1;
    const fila = { sesion_id: S.sesion.id, fecha: ahora(), ejercicio_id: e.id, num_serie: n, peso: num(en.peso), reps: num(en.reps), rir: en.rir, dolor: 'no', zona: '', escala_dolor: '' };
    S.series.push(fila);
    S.sesion.pend = (S.sesion.pend || []).concat([fila]);
    if (n >= e.series && i < S.sesion.ejercicios.length - 1) UI.activo = i + 1;
    iniciarTemp(e.descanso || 90);
    render();
  },
  panel: (el) => { UI.panel = { tipo: el.dataset.t, i: Number(el.dataset.i), escala: 0 }; render(); },
  cierraPanel: () => { UI.panel = null; render(); },
  aceptaAlt: (el) => {
    const i = Number(el.dataset.i), e = S.sesion.ejercicios[i], a = alternativa(e);
    if (!a) return;
    S.perfil.no_gustan.push(e.id);
    enviar('preferencia', { fecha: ahora(), tipo: 'no gusta', ejercicio_id: e.id, activa: 'sí' });
    enviar('perfil', { no_gustan: S.perfil.no_gustan });
    reemplazar(i, a); UI.panel = null; guardarRutina(); render();
  },
  escala: (el) => { UI.panel.escala = Number(el.dataset.n); render(); },
  confirmaDuele: (el) => {
    if (!UI.panel.escala) { UI.msg = 'Elegí la intensidad del dolor (1 a 3).'; render(); UI.msg = ''; return; }
    const i = Number(el.dataset.i), e = S.sesion.ejercicios[i], zona = $('#zonaDolor').value, esc_ = UI.panel.escala;
    S.perfil.duelen.push(e.id);
    enviar('preferencia', { fecha: ahora(), tipo: 'duele', ejercicio_id: e.id, zona, escala: esc_, activa: 'sí' });
    enviar('perfil', { duelen: S.perfil.duelen });
    alerta('dolor reportado', `${e.id} ${e.nombre}: ${zona}, intensidad ${esc_}`);
    const a = alternativa(e);
    if (a) reemplazar(i, a); else S.sesion.ejercicios.splice(i, 1);
    UI.msg = a ? `Ejercicio excluido. Lo reemplaza ${a.nombre}.` : 'Ejercicio excluido. No hay reemplazo válido: avisale al entrenador desde el Buzón.';
    UI.panel = null; UI.activo = Math.min(i, S.sesion.ejercicios.length - 1); guardarRutina(); render(); UI.msg = '';
  },
  levantar: (el) => {
    if (!confirm('¿Seguro? El ejercicio vuelve a entrar en el plan.')) return;
    const k = el.dataset.t === 'duele' ? 'duelen' : 'no_gustan', campo = k;
    S.perfil[k] = S.perfil[k].filter(x => x !== el.dataset.id);
    enviar('preferencia', { fecha: ahora(), tipo: 'levanta ' + el.dataset.t, ejercicio_id: el.dataset.id, activa: 'no' });
    enviar('perfil', { [campo]: S.perfil[k] }); guardarRutina(); render();
  },
  tempMas: () => { temp.restante += 30; temp.total += 30; if (!temp.id) iniciarTemp(temp.restante); pintarTemp(); },
  tempFin: () => { clearInterval(temp.id); temp.id = null; temp.total = 0; pintarTemp(); },
  finalizar: () => { UI.panel = { tipo: 'fin', sens: 0 }; render(); },
  sens: (el) => { UI.panel.sens = Number(el.dataset.n); render(); },
  guardarSesion: () => {
    const se = S.sesion;
    const dur = Math.max(1, Math.round((Date.now() - new Date(se.inicio).getTime()) / 60000));
    const ses = { sesion_id: se.id, fecha: se.inicio, nombre: se.nombre, duracion_min: dur, sensacion: UI.panel.sens || '', comentario: $('#comSesion').value };
    S.sesiones.push(ses);
    enviar('sesion', ses);
    enviar('series', { series: S.series.filter(s => s.sesion_id === se.id) });
    S.sesion = null; UI.panel = null; ACC.tempFin(); ir('hoy');
  },
  evaluar: () => {
    const estados = {};
    document.querySelectorAll('[data-chk]').forEach(s => { if (s.value) estados[s.dataset.chk] = s.value; });
    const texto = $('#cTexto').value.trim();
    if (texto) {
      const c = { fecha: ahora(), horario: $('#cHora').value, texto, calorias: num($('#cKcal').value) || '' };
      S.comidas.push(c); enviar('comida', c);
    }
    const r = evaluarDia(estados, S.perfil.tono, { objetivo: S.perfil.objetivo, pesoKg: num(S.perfil.peso_kg), proteinaG: num($('#cProteina')?.value),
      kcal: num($('#cKcal').value), kcalMantenimiento: num(S.perfil.kcal_mantenimiento) });
    UI.resultadoComida = r;
    if (Object.keys(estados).length) {
      const ev = { fecha: ahora(), en_linea: r.enLinea ? 'sí' : 'no', estados, resumen: r.resumen };
      S.evaluaciones.push(ev); enviar('evaluacion', ev);
    }
    render();
  },
  enviarBuzon: () => {
    const texto = $('#bTexto').value.trim();
    if (!texto) return;
    const b = { fecha: ahora(), usuario: S.usuario, tipo: $('#bTipo').value, texto, estado: 'pendiente', leida: 'no', respuesta: '' };
    S.buzon.push(b); enviar('buzon', { fecha: b.fecha, tipo: b.tipo, texto }); render();
  },
  guardarPerfil: () => {
    leerPerfilForm();
    enviar('perfil', perfilPlano()); guardarRutina();
    UI.msg = 'Perfil guardado. El plan se actualizó.'; ir('hoy'); UI.msg = '';
  },
  guardarApi: () => {
    try {
      localStorage.setItem(CLAVE_API, $('#apiUrl').value.trim());
      localStorage.setItem(CLAVE_SRV, $('#apiClave').value.trim());
    } catch (e) { UI.msg = 'No se pudo guardar en este navegador.'; }
    sincronizar(); render();
  },
  exportar: () => descargarCSV()
};

// Delegación de eventos: un solo escuchador para toda la app.
document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-acc]');
  if (el && ACC[el.dataset.acc]) ACC[el.dataset.acc](el);
});
document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (el.dataset && el.dataset.in) se_entrada[el.dataset.id][el.dataset.in] = el.value;
});
document.addEventListener('change', (ev) => {
  const el = ev.target;
  if (el.id === 'selUsuario') {
    leerPerfilForm(); guardarCache();
    S = { ...S, usuario: el.value, perfil: { ...PERFIL_BASE }, sesiones: [], series: [], comidas: [], evaluaciones: [], buzon: [], cola: [], sesion: null };
    sincronizar(); render();
  }
  if (el.dataset && el.dataset.accCh === 'ejProgreso') { UI.ejProgreso = el.value; render(); }
});
$('#nav').addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (b) ir(b.dataset.v); });
$('#btnPerfil').addEventListener('click', () => ir('perfil'));

// ---------- Inicio ----------
cargarCache();
render();
sincronizar();
if (S.sesion) { /* sesión en curso recuperada de la caché */ }
