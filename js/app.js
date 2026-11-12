// APP GIMNASIO — lógica de la interfaz.
// La fuente de verdad es el backend (Apps Script). localStorage es solo caché y cola de envíos pendientes.
import { generarPlan, sugerirProgresion, estimarRM, evaluarDia, incremento, decremento, proponerAlternativa, estimarDuracion } from './motor.js';
import { CATALOGO, ZONAS } from './catalogo.js';
import { PLANES } from './planes.js';

const CLAVE_CACHE = 'gimnasio_cache_v1';
const CLAVE_API = 'gimnasio_api_url';
const CLAVE_SRV = 'gimnasio_api_clave'; // solo en este celular; nunca en el código ni en la hoja
const CLAVE_USR = 'gym_usuario';
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

function usuarioGuardado() {
  try { const u = localStorage.getItem(CLAVE_USR); return USUARIOS[u] ? u : ''; } catch (e) { return ''; }
}
function guardarUsuario(u) { try { localStorage.setItem(CLAVE_USR, u); } catch (e) { /* sin almacenamiento */ } }
// Carga la caché solo si es del usuario elegido; si es de otra persona, empieza vacío (no se borra la caché ajena hasta que se guarde).
function cargarCache(usuario) {
  try {
    const c = JSON.parse(localStorage.getItem(CLAVE_CACHE) || 'null');
    if (c && c.usuario && (!usuario || c.usuario === usuario)) S = { ...S, ...c, vista: 'hoy' };
    else if (usuario) S = { ...S, usuario };
  } catch (e) { if (usuario) S = { ...S, usuario }; }
}
// Pantalla de primer uso: se muestra hasta que se elige quién usa el celular.
function pantallaQuien(alElegir) {
  const d = document.createElement('div');
  d.id = 'pantalla-quien';
  d.innerHTML = `<div class="quien-caja"><div class="quien-logo">${ic('pesa')}</div>
    <h2>¿Quién sos?</h2><p>Elegí tu usuario para ver tu plan y tus series.</p>` +
    Object.keys(USUARIOS).map(u => `<button class="quien-btn" data-usr="${u}"><span class="avatar">${esc(USUARIOS[u].charAt(0))}</span><span>${esc(USUARIOS[u])}</span><span class="flecha">${ic('ir')}</span></button>`).join('') +
    '<p class="quien-nota">Queda guardado en este celular. Lo cambiás cuando quieras desde Perfil.</p></div>';
  d.addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-usr]'); if (!b) return;
    d.remove(); alElegir(b.dataset.usr);
  });
  document.body.appendChild(d);
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
// fmt: número a texto con coma decimal (32,5). Enteros sin decimales; no cambia el valor guardado.
// Un texto que el usuario está escribiendo ("32," o "32,5") se respeta tal cual.
const fmt = (n) => {
  if (typeof n === 'string') { if (n.trim() === '' || isNaN(parseFloat(n.replace(',', '.')))) return n; if (/[.,]/.test(n)) return n.replace('.', ','); n = parseFloat(n); }
  if (n == null || n === '' || !isFinite(n)) return '';
  return String(Math.round(n * 10) / 10).replace('.', ',');
};
const fmtNum = fmt;
// Textos del motor (motivos) con decimales: 32.5 -> 32,5. Solo para mostrar.
const fmtTxt = (t) => String(t ?? '').replace(/(\d)\.(\d)/g, '$1,$2');
const mayusc = (t) => { t = String(t ?? ''); return t.charAt(0).toUpperCase() + t.slice(1); };
// Iconos en línea (trazo con currentColor).
const ICONOS = {
  pesa: '<path d="M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  abajo: '<path d="M6 9l6 6 6-6"/>',
  ir: '<path d="M9 5l7 7-7 7"/>',
  volver: '<path d="M15 5l-7 7 7 7"/>',
  idea: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  cambiar: '<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
  pulso: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
  reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  plan: '<rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 3h6v3H9zM9 11h6M9 15h6M9 19h3"/>',
  enviar: '<path d="M4 12l16-8-6 16-2.5-6.5z"/><path d="M11.5 13.5L20 4"/>',
  hoja: '<path d="M5 19c0-8 5-14 15-15-1 10-7 15-15 15z"/><path d="M5 19l8-8"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
};
const ic = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONOS[n] || ''}</svg>`;
// Anillo de progreso (SVG), valor de 0 a 1.
function anillo(frac, arriba, abajo) {
  const c = 2 * Math.PI * 32, f = Math.max(0, Math.min(1, frac || 0));
  return `<div class="anillo"><svg viewBox="0 0 76 76" aria-hidden="true"><circle class="fondo-a" cx="38" cy="38" r="32" fill="none" stroke-width="8"/>
    <circle class="valor-a" cx="38" cy="38" r="32" fill="none" stroke-width="8" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - f)).toFixed(1)}"${f ? '' : ' opacity="0"'}/></svg>
    <div class="centro"><div><b>${arriba}</b><span>${abajo}</span></div></div></div>`;
}

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
// Cardio del plan (datos de planes.js): por día, y texto corto.
function cardioDe(pl, dia) { return pl.fuente === 'entrenador' ? (pl.cardio || []).filter(c => c.dia === dia) : []; }
function cardioDur(c) { return String(c.duracionMin).replace(/\s*→\s*/, ' a ') + ' min'; }
function cardioInt(c) { return String(c.intensidad || '').replace(/\s*\([^)]*\)/g, '').trim(); }
function cardioNom(c) { return ej_[c.id] ? ej_[c.id].nombre : c.id; }
// Detalle sin repetir la intensidad si ya está en el nombre del ejercicio (ej. "Bicicleta estática zona 2").
function cardioDetalle(c) { return cardioNom(c).toLowerCase().includes(cardioInt(c).toLowerCase()) ? esc(cardioDur(c)) : cardioLinea(c); }
function cardioLinea(c) { return `${esc(cardioInt(c))}, ${esc(cardioDur(c))}`; }
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
  const corre = temp.restante > 0, pct = Math.max(0, Math.min(100, temp.restante / temp.total * 100));
  const reloj = `${m}:${String(s).padStart(2, '0')}`;
  // Si ya está en pantalla y sigue corriendo, se actualizan solo el número y la barra (sin parpadeo).
  const t = c.querySelector('.temporizador');
  if (t && corre && !t.classList.contains('fin')) {
    t.querySelector('.temp-num').textContent = reloj;
    t.querySelector('.temp-barra > div').style.width = pct + '%';
    return;
  }
  c.innerHTML = `<div class="temporizador${corre ? '' : ' fin'}${t ? ' sin-entrada' : ''}" role="timer" aria-live="off"><div><span class="temp-tit">${corre ? 'Descanso' : 'Descanso terminado'}</span>
    <span class="temp-num">${corre ? reloj : '¡A la próxima serie!'}</span></div>
    <div class="temp-bot"><button data-acc="tempMas">+30 s</button><button class="listo" data-acc="tempFin">Listo</button></div>
    <div class="temp-barra"><div style="width:${pct}%"></div></div></div>`;
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
  const aviso = (UI.msg ? `<div class="${/error|no se pudo|no autorizado|falló|falla/i.test(UI.msg) ? 'aviso' : /guardad|listo|conectad|enviad/i.test(UI.msg) ? 'ok' : 'info'}">${esc(UI.msg)}</div>` : '') + (S.cola.length && servidorListo() ? `<p class="pendientes">${S.cola.length} cambio(s) sin enviar.</p>` : '');
  const vista = $('#vista');
  // Animación de entrada solo al cambiar de pantalla, no en cada toque.
  const nueva = vista.dataset.v !== v;
  vista.dataset.v = v;
  if (nueva) { vista.classList.remove('entra'); void vista.offsetWidth; vista.classList.add('entra'); }
  else vista.classList.remove('entra');
  vista.innerHTML = aviso + f();
  guardarCache();
}
let POS = null; // posición de la pantalla de origen al abrir Ejercicio
function ir(v, volver) {
  if (v === 'ejercicio') {
    POS = { vista: S.vista, y: window.scrollY, abiertos: [...document.querySelectorAll('#vista details')].map(d => d.open) };
    S.previa = S.vista;
  }
  const restaurar = volver && POS && POS.vista === v ? POS : null;
  if (v !== 'ejercicio') POS = null;
  S.vista = v; UI.panel = null;
  if (v === 'buzon') marcarLeidas();
  render();
  if (!restaurar) { window.scrollTo(0, 0); return; }
  const ds = document.querySelectorAll('#vista details');
  restaurar.abiertos.forEach((o, i) => { if (o && ds[i]) ds[i].open = true; });
  window.scrollTo(0, restaurar.y);
  requestAnimationFrame(() => { window.scrollTo(0, restaurar.y); setTimeout(() => window.scrollTo(0, restaurar.y), 60); });
}

// Nombre de la sesión sin el día adelante ("Lunes · Inferior A" → "Inferior A").
const sinDia = (s) => String(s.nombre || '').replace(new RegExp('^' + (s.dia || '-') + '\\s*·\\s*'), '');
function fechaLocal(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

function saludo() {
  const nombre = S.perfil.nombre || USUARIOS[S.usuario] || '';
  const f = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).replace(',', '');
  return `<div class="saludo"><span class="ceja">${esc(f)}</span><h2>Hola${nombre ? ', ' + esc(nombre.split(' ')[0]) : ''}</h2></div>`;
}
// Resumen de la semana (lunes a domingo): sesiones guardadas frente a las del plan.
function resumenSemana(pl) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const lunes = new Date(hoy); lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
  const hechasDias = new Set(S.sesiones.filter(s => new Date(s.fecha) >= lunes).map(s => fechaLocal(new Date(s.fecha))));
  const hechas = S.sesiones.filter(s => new Date(s.fecha) >= lunes).length;
  const meta = pl.fuente === 'entrenador' ? pl.sesiones.length : (Number(S.perfil.dias) || 3);
  const diasPlan = new Set(pl.fuente === 'entrenador' ? pl.sesiones.map(s => s.dia) : []);
  const letras = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const dias = letras.map((l, k) => {
    const d = new Date(lunes); d.setDate(lunes.getDate() + k);
    const cls = [hechasDias.has(fechaLocal(d)) ? 'hecho' : '', diasPlan.has(DIAS_SEMANA[d.getDay()]) ? 'plan' : '', d.getTime() === hoy.getTime() ? 'hoy' : ''].join(' ');
    const card = cardioDe(pl, DIAS_SEMANA[d.getDay()]).length ? ' cardio' : '';
    return `<div class="dia ${cls}${card}"${card ? ' title="Con cardio"' : ''}><i>${hechasDias.has(fechaLocal(d)) ? ic('check') : ''}</i>${l}${card ? '<span class="punto" aria-label="con cardio"></span>' : ''}</div>`;
  }).join('');
  const falta = Math.max(0, meta - hechas);
  const frase = hechas >= meta ? 'Semana cumplida. Muy bien.' : hechas ? `Te ${falta === 1 ? 'falta 1 sesión' : `faltan ${falta} sesiones`} para cerrar la semana.` : `${meta} sesiones en el plan de esta semana.`;
  return `<div class="tarjeta"><div class="semana">${anillo(hechas / meta, `${hechas}/${meta}`, 'semana')}
    <div><h3>Tu semana</h3><p class="suave" style="margin:0">${frase}</p></div></div>
    <div class="dias">${dias}</div>${(pl.cardio || []).length && pl.fuente === 'entrenador' ? '<p class="leyenda-cardio"><span class="punto"></span>Día con cardio</p>' : ''}</div>`;
}

// Explicación plegada de cada ejercicio en Hoy (datos del catálogo y del plan, sin texto nuevo).
function explicacionEj(e) {
  const c = ej_[e.id];
  if (!c) return '';
  const img = c.imagen ? `<img class="img-ej" src="imagenes/${esc(c.imagen)}" alt="${esc(c.nombre)}" loading="lazy" onerror="this.remove()">` : '';
  const porque = e.justificacion || c.justificacion || '';
  return `<details class="exp"><summary><span>Cómo se hace y por qué</span>${ic('abajo')}</summary><div class="exp-cuerpo">${img}
    ${c.descripcion ? `<p>${esc(c.descripcion)}</p>` : ''}
    ${c.tecnica?.length ? `<h4>Técnica</h4><ul>${c.tecnica.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
    ${porque ? `<h4>Por qué está en el plan</h4><p>${esc(porque)}</p>` : ''}
    ${c.musculos?.length ? `<div class="chips">${c.musculos.map(m => `<span class="etiqueta">${esc(m)}</span>`).join('')}</div>` : ''}
    ${c.zonasCuidado?.length ? `<p class="cuid">Cuidado con: ${esc(c.zonasCuidado.join(', '))}.</p>` : ''}
    <button class="b chico" data-acc="verEj" data-id="${e.id}" aria-label="Info de ${esc(c.nombre)}">${ic('info')}Info</button></div></details>`;
}

function vHoy() {
  const p = S.perfil;
  const sin = !servidorListo() ? `<div class="info">Modo local: falta la dirección o la clave del servidor (Perfil, "Servidor y datos"). Mientras tanto los datos quedan solo en este celular.</div>` : '';
  if (!p.nombre) return saludo() + `<div class="tarjeta vacio"><div class="ilus">${ic('plan')}</div><h2>Armemos tu primer plan</h2>
    <p class="suave">Con tres datos el entrenador arma tu semana y te dice qué peso usar en cada serie.</p>
    <ol class="pasos"><li><span>1</span>Tu objetivo</li><li><span>2</span>Cuántos días y cuánto tiempo tenés</li><li><span>3</span>Si te molesta alguna zona</li></ol>
    <button class="b principal" data-acc="ir" data-v="perfil">Completar perfil</button></div>` + sin;
  const s = sesionDelDia();
  if (!s) return sin + '<div class="info">No hay plan. Revisá el perfil.</div>';
  const filas = s.ejercicios.map((e, k) => {
    const sg = sugerencia(e);
    return `<li><span class="orden">${k + 1}</span><span class="nom">${esc(e.nombre)}<span class="pres">${e.series} × ${e.reps[0]}–${e.reps[1]} · RIR ${e.rir}</span></span>
      ${sg.peso == null ? '<span class="carga def">a definir</span>' : `<span class="carga">${fmt(sg.peso)} kg</span>`}${explicacionEj(e)}</li>`;
  }).join('');
  const ult = S.sesiones.slice(-1)[0];
  const pl = plan();
  const ent = pl.fuente === 'entrenador';
  const esHoy = s.dia === DIAS_SEMANA[new Date().getDay()];
  const ceja = ent ? `${esHoy ? 'Hoy' : 'Próxima'} · ${esc(s.dia)}${pl.estado !== 'definitivo' ? `<span class="hero-chip">${esc(pl.estado)}</span>` : ''}`
    : `Sesión ${indiceSesion(pl) + 1} de ${pl.sesiones.length}<span class="hero-chip">plan automático</span>`;
  const totalSeries = s.ejercicios.reduce((a, e) => a + Number(e.series || 0), 0);
  let curso = '';
  if (S.sesion) {
    const tot = S.sesion.ejercicios.reduce((a, e) => a + Number(e.series || 0), 0) || 1;
    const hechas = S.series.filter(x => x.sesion_id === S.sesion.id).length;
    curso = `<div class="en-curso"><span>En curso</span><div class="barra"><div style="width:${Math.min(100, hechas / tot * 100)}%"></div></div><span class="n">${hechas}/${tot}</span></div>`;
  }
  const hoyDia = DIAS_SEMANA[new Date().getDay()];
  const cardioHoy = cardioDe(pl, hoyDia);
  const cardioNota = esHoy && cardioHoy.length ? cardioHoy.map(c => `<p class="cardio-nota"><b>Cardio:</b> ${cardioLinea(c)}</p>`).join('') : '';
  const sinFuerzaHoy = ent && !esHoy;
  const bloqueHoy = !sinFuerzaHoy ? '' : cardioHoy.length
    ? `<div class="cardio-hoy"><span class="ceja">Hoy toca cardio</span>${cardioHoy.map(c => `<p><b>${esc(cardioNom(c))}</b> · ${cardioDetalle(c)}</p>`).join('')}</div>`
    : '<p class="descanso">Día de descanso</p>';
  return saludo() + bloqueHoy + `<div class="hero"><span class="ceja">${ceja}</span>
    <h2>${esc(sinDia(s))}</h2>
    <div class="hero-meta"><span><b>${s.ejercicios.length}</b> ejercicios</span><span><b>${totalSeries}</b> series</span>${s.duracionMin ? `<span><b>~${s.duracionMin}</b> min</span>` : ''}</div>
    ${curso}<button class="b principal" data-acc="empezar">${ic(S.sesion ? 'ir' : 'pesa')}${S.sesion ? 'Continuar sesión' : 'Empezar sesión'}</button>
    <ul class="ejs">${filas}</ul></div>
    ${cardioNota}
    ${ent ? '' : '<p class="suave" style="margin:0 2px">Plan automático: todavía no hay plan del entrenador para vos.</p>'}
    ${respuestasSinLeer() ? `<button class="b" data-acc="ir" data-v="buzon">${ic('enviar')}Tenés ${respuestasSinLeer()} respuesta(s) nueva(s) del entrenador</button>` : ''}
    ${resumenSemana(pl)}
    ${ult ? `<p class="suave" style="margin:0 2px">Última sesión: ${esc(ult.nombre)}, ${fmtFecha(ult.fecha)}.</p>` : ''}${sin}`;
}

function vSesion() {
  const se = S.sesion;
  if (!se) return '<div class="info">No hay sesión en curso.</div><button class="b" data-acc="ir" data-v="hoy">Volver</button>';
  const cards = se.ejercicios.map((e, i) => cardEj(e, i)).join('');
  const tot = se.ejercicios.reduce((a, e) => a + Number(e.series || 0), 0) || 1;
  const hechas = S.series.filter(s => s.sesion_id === se.id).length;
  const desde = new Date(se.inicio).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return `<div class="sesion-cab"><span class="ceja">En curso · desde las ${desde}</span><h2>${esc(se.nombre)}</h2>
    <div class="progreso-ses"><div class="barra"><div style="width:${Math.min(100, hechas / tot * 100)}%"></div></div><span><b>${hechas}</b> de ${tot} series</span></div></div>
    ${cards}
    ${UI.panel && UI.panel.tipo === 'fin' ? panelFin() : '<button class="b principal" data-acc="finalizar">Terminar sesión</button>'}`;
}

function cardEj(e, i) {
  const c = ej_[e.id];
  const hechas = S.series.filter(s => s.sesion_id === S.sesion.id && s.ejercicio_id === e.id);
  const abierto = UI.activo === i;
  const completo = hechas.length >= e.series;
  const marcas = Array.from({ length: Math.max(e.series, hechas.length) }, (_, k) => `<i class="${k < hechas.length ? 'si' : ''}"></i>`).join('');
  let html = `<div class="tarjeta ej${abierto ? ' activo' : ''}${completo ? ' hecho' : ''}"><div class="ej-cab"><div class="ej-toca" data-acc="abrir" data-i="${i}">
    <span class="ej-num">${completo ? ic('check') : i + 1}</span><div><h3>${esc(e.nombre)}</h3>
    <span class="ej-pres"><span class="n">${hechas.length}/${e.series}</span> series · ${e.reps[0]}–${e.reps[1]} reps · RIR ${e.rir}</span>
    <div class="marcas" aria-hidden="true">${marcas}</div></div></div>
    <button class="b icono fantasma" data-acc="verEj" data-id="${e.id}" aria-label="Ver cómo se hace ${esc(e.nombre)}">${ic('info')}</button></div>`;
  if (abierto) {
    const sg = sugerencia(e);
    const en = (se_entrada[e.id] ||= { peso: sg.peso ?? (hechas.length ? num(hechas[hechas.length - 1].peso) : 0), reps: e.reps[1] > 8 ? e.reps[0] + 2 : e.reps[0], rir: e.rir });
    const pasoMas = incremento(c, num(en.peso)), pasoMenos = decremento(c, num(en.peso));
    const RIR_TXT = ['al fallo', 'quedaba 1', 'quedaban 2', 'o más'];
    html += `<div class="ej-cuerpo"><div class="nota">${ic('idea')}<span>${esc(fmtTxt(sg.motivo))}</span></div>`;
    if (hechas.length) html += `<div class="hechas">${hechas.map(s => `<div class="hecha${Date.now() - Date.parse(s.fecha) < 1500 ? ' recien' : ''}"><span class="hn">${ic('check')}</span>
      <span><b>${fmt(s.peso)} kg × ${s.reps}</b></span><span class="hd">Serie ${s.num_serie} · RIR ${s.rir}${s.dolor === 'sí' ? ' · dolor' : ''}</span></div>`).join('')}</div>`;
    html += `<div class="carga-grid">
      <div class="campo"><div class="campo-tit">Peso <span>kg</span></div><div class="num"><button class="b" data-acc="ajuste" data-id="${e.id}" data-c="peso" data-d="${-pasoMenos}" aria-label="Bajar ${fmtNum(pasoMenos)} kg">−<small>${fmtNum(pasoMenos)}</small></button><input inputmode="decimal" data-in="peso" data-id="${e.id}" value="${fmt(en.peso)}" aria-label="Peso en kg"><button class="b" data-acc="ajuste" data-id="${e.id}" data-c="peso" data-d="${pasoMas}" aria-label="Subir ${fmtNum(pasoMas)} kg">+<small>${fmtNum(pasoMas)}</small></button></div></div>
      <div class="campo"><div class="campo-tit">Reps <span>${e.reps[0]}–${e.reps[1]}</span></div><div class="num"><button class="b" data-acc="ajuste" data-id="${e.id}" data-c="reps" data-d="-1" aria-label="Una repetición menos">−</button><input inputmode="numeric" data-in="reps" data-id="${e.id}" value="${en.reps}" aria-label="Repeticiones"><button class="b" data-acc="ajuste" data-id="${e.id}" data-c="reps" data-d="1" aria-label="Una repetición más">+</button></div></div></div>
      <div><div class="rir-tit">RIR <span>repeticiones que te quedaban · objetivo ${e.rir}</span></div>
      <div class="seg rir">${[0, 1, 2, 3].map(r => `<button class="b ${en.rir === r ? 'sel' : ''}" data-acc="rir" data-id="${e.id}" data-r="${r}">${r === 3 ? '3+' : r}<small>${RIR_TXT[r]}</small></button>`).join('')}</div></div>
      <button class="b principal" data-acc="serie" data-i="${i}">${ic('check')}Registrar serie ${hechas.length + 1}</button>
      <div class="sec"><button class="b" data-acc="panel" data-t="gusta" data-i="${i}">${ic('cambiar')}No me gusta</button><button class="b peligro" data-acc="panel" data-t="duele" data-i="${i}">${ic('pulso')}Me duele</button></div>`;
    if (UI.panel && UI.panel.i === i && UI.panel.tipo === 'gusta') html += panelGusta(e);
    if (UI.panel && UI.panel.i === i && UI.panel.tipo === 'duele') html += panelDuele();
    html += '</div>';
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
  if (!a) return `<div class="info">No hay una alternativa válida del mismo patrón. Anotalo en el Buzón para que el entrenador la revise.</div>`;
  return `<div class="panel"><span class="ceja" style="margin:0">Alternativa propuesta</span><h3>${esc(a.nombre)}</h3><p class="suave">${esc(a.justificacion)}</p>
    <div class="sec"><button class="b principal" data-acc="aceptaAlt" data-i="${UI.panel.i}">Cambiar</button><button class="b" data-acc="cierraPanel">Dejar como está</button></div></div>`;
}
function panelDuele() {
  return `<div class="panel"><h3>¿Dónde te duele?</h3>
    <select id="zonaDolor" aria-label="Zona del dolor">${ZONAS.map(z => `<option>${z}</option>`).join('')}<option>otra</option></select>
    <label>Intensidad</label><div class="seg tres-op rir">${[1, 2, 3].map(n => `<button class="b ${UI.panel.escala === n ? 'sel' : ''}" data-acc="escala" data-n="${n}">${n}<small>${['leve', 'moderado', 'fuerte'][n - 1]}</small></button>`).join('')}</div>
    <p class="suave">El ejercicio sale del plan y, si hay uno equivalente, lo reemplaza.</p>
    <div class="sec"><button class="b peligro" data-acc="confirmaDuele" data-i="${UI.panel.i}">Excluir ejercicio</button><button class="b" data-acc="cierraPanel">Cancelar</button></div></div>`;
}
function panelFin() {
  return `<div class="tarjeta"><h3>Cerrar sesión</h3><label>¿Cómo te sentiste?</label>
    <div class="seg cinco rir">${[1, 2, 3, 4, 5].map(n => `<button class="b ${UI.panel.sens === n ? 'sel' : ''}" data-acc="sens" data-n="${n}">${n}<small>${n === 1 ? 'mal' : n === 5 ? 'muy bien' : ''}&nbsp;</small></button>`).join('')}</div>
    <label for="comSesion">Comentario</label><textarea id="comSesion" placeholder="Opcional: cómo dormiste, molestias, energía"></textarea><div style="height:14px"></div>
    <button class="b principal" data-acc="guardarSesion">${ic('check')}Guardar sesión</button></div>`;
}

function vEjercicio() {
  const c = ej_[S.ejId];
  if (!c) return '<button class="b" data-acc="ir" data-v="hoy">Volver</button>';
  let porque = '';
  plan().sesiones.forEach(s => s.ejercicios.forEach(e => { if (e.id === c.id && !porque) porque = e.justificacion; }));
  return `<button class="b chico fantasma volver" data-acc="ir" data-volver="1" data-v="${S.previa}">${ic('volver')}Volver</button>
    <div class="tarjeta">${imagenEj(c)}<span class="ceja">${esc(mayusc(c.equipo))}</span><h2>${esc(c.nombre)}</h2><p>${esc(c.descripcion)}</p>
    <div class="chips">${c.musculos.map(m => `<span class="etiqueta">${esc(m)}</span>`).join('')}</div></div>
    <div class="tarjeta"><h3>Técnica</h3><ol class="tecnica">${c.tecnica.map(t => `<li><span>${esc(t)}</span></li>`).join('')}</ol></div>
    <div class="tarjeta"><h3>Por qué está en el plan</h3><p class="suave">${esc(porque || c.justificacion)}</p>
    ${c.zonasCuidado.length ? `<div class="nota">${ic('info')}<span>Cuidado con: ${esc(c.zonasCuidado.join(', '))}.</span></div>` : ''}</div>`;
}

const CHEQUEO = {
  proteina: ['suficiente', 'justa', 'faltante'], verduras: ['suficiente', 'faltante'], carbohidratos: ['acorde', 'sobra', 'falta'],
  grasas: ['acorde', 'excede'], ultraprocesados: ['pocos', 'algunos', 'muchos'], agua: ['suficiente', 'faltante']
};
function vComida() {
  const hoy = S.comidas.filter(c => String(c.fecha).slice(0, 10) === hoyStr());
  const kcal = hoy.reduce((a, c) => a + num(c.calorias), 0);
  const r = UI.resultadoComida;
  return `<div class="tarjeta"><h3>¿Qué comiste?</h3>
    <label for="cTexto">Descripción</label><textarea id="cTexto" placeholder="Ej: almuerzo, milanesa de pollo con ensalada"></textarea>
    <div class="dos"><div><label for="cHora">Horario <span style="font-weight:400">(opcional)</span></label><input id="cHora" type="time"></div><div><label for="cKcal">Calorías <span style="font-weight:400">(opcional)</span></label><input id="cKcal" inputmode="decimal" placeholder="kcal"></div></div>
    <label for="cProteina">Proteína del día <span style="font-weight:400">(g, opcional)</span></label><input id="cProteina" inputmode="decimal" placeholder="g">
    </div>
    <div class="tarjeta"><h3>Chequeo del día</h3><p class="suave">Marcá cómo estuvo cada punto. Lo que no sepas, dejalo sin dato.</p>
    <div class="chequeo">${Object.keys(CHEQUEO).map(k => `<div><label for="chk-${k}">${NOMBRE_CAT[k] || k}</label><select id="chk-${k}" data-chk="${k}"><option value="">sin dato</option>${CHEQUEO[k].map(o => `<option>${o}</option>`).join('')}</select></div>`).join('')}</div>
    <div style="height:16px"></div><button class="b principal" data-acc="evaluar">Guardar y evaluar</button></div>
    ${r ? resultadoComida(r) : ''}
    <div class="seccion-tit"><h3>Hoy</h3>${kcal ? `<span class="suave n">${fmt(kcal)} kcal cargadas</span>` : ''}</div>
    ${hoy.length ? `<div class="tarjeta lista-simple">${hoy.map(c => `<div class="it"><span>${c.horario ? `<span class="hora">${esc(c.horario)}</span>` : ''}${esc(c.texto)}</span><span class="kcal">${c.calorias ? fmt(c.calorias) + ' kcal' : ''}</span></div>`).join('')}</div>`
      : '<p class="suave" style="margin:0 2px">Todavía no cargaste comidas hoy.</p>'}
    <p class="suave" style="font-size:13.5px;margin:4px 2px 0">La evaluación es orientativa. Si tenés una condición médica, consultá con una nutricionista deportóloga.</p>`;
}
const NOMBRE_CAT = { calorias: 'Calorías', proteina: 'Proteína', verduras: 'Verduras y fruta', carbohidratos: 'Carbohidratos', grasas: 'Grasas', ultraprocesados: 'Ultraprocesados', agua: 'Agua' };
// Resultado de evaluarDia en tarjetas. Sin rojo: no es un error, es una evaluación.
function resultadoComida(r) {
  const estado = r.estado || (r.enLinea ? 'si' : 'no');
  const cab = { si: ['En línea', 'check'], parcial: ['En parte', 'hoja'], no: ['Todavía no', 'hoja'], sin_datos: ['Sin datos', 'info'] }[estado] || ['Resultado', 'info'];
  const nom = (xs) => (xs || []).map(c => `<li>${esc(NOMBRE_CAT[c] || c)}</li>`).join('');
  const grupos = [['Qué está bien', r.bien, 'g-bien'], ['Qué falta', r.faltan, 'g-mal'], ['Qué sobra', r.sobran, 'g-mal'], ['Para ajustar', r.mejorar, 'g-mal']]
    .filter(g => g[1] && g[1].length).map(([t, xs, cl]) => `<div class="${cl}"><h4>${t}</h4><ul>${nom(xs)}</ul></div>`).join('');
  const acc = (r.acciones || []).filter(Boolean);
  return `<div class="tarjeta resultado res-${estado}"><div class="res-cab"><span class="ilus">${ic(cab[1])}</span><div><span>Con tu objetivo</span><h3>${cab[0]}</h3></div></div>
    <p style="margin:0">${esc(r.resumen)}</p>
    ${grupos ? `<div class="grupos">${grupos}</div>` : ''}
    ${acc.length ? `<div><span class="ceja">Qué hacer</span><ol class="acciones">${acc.map(a => `<li><span>${esc(mayusc(a))}</span></li>`).join('')}</ol></div>` : ''}</div>`;
}

function vProgreso() {
  const ids = [...new Set(S.series.map(s => s.ejercicio_id))].filter(id => ej_[id]);
  const sel = UI.ejProgreso && ids.includes(UI.ejProgreso) ? UI.ejProgreso : ids[0];
  let graf = '<p class="suave" style="margin:0">Todavía no hay series registradas. Cuando cargues la primera, acá vas a ver cómo sube la carga.</p>';
  if (sel) {
    const h = historial(sel);
    const pesos = h.map(x => x.peso);
    const mejor = Math.max(...S.series.filter(s => s.ejercicio_id === sel).map(s => estimarRM(num(s.peso), num(s.reps))));
    graf = `<select data-acc-ch="ejProgreso" aria-label="Ejercicio">${ids.map(id => `<option value="${id}" ${id === sel ? 'selected' : ''}>${esc(ej_[id].nombre)}</option>`).join('')}</select>
      <div class="stats"><div class="stat dest"><b>${fmt(mejor)}<small> kg</small></b><span>1RM estimado</span></div>
      <div class="stat"><b>${pesos.length ? fmt(Math.max(...pesos)) : '-'}<small> kg</small></b><span>Mejor peso</span></div>
      <div class="stat"><b>${h.length}</b><span>${h.length === 1 ? 'Sesión' : 'Sesiones'}</span></div></div>
      ${linea(pesos)}<p class="suave" style="margin:6px 0 0;font-size:13.5px">Mejor peso de cada sesión, en kg.</p>`;
  }
  // Volumen semanal: series de los últimos 7 días (principal = 1, secundarios = 0,5)
  const desde = Date.now() - 7 * 864e5, vol = {};
  S.series.filter(s => new Date(s.fecha).getTime() >= desde && ej_[s.ejercicio_id]).forEach(s => {
    const c = ej_[s.ejercicio_id];
    const m = c.musculos[0]; vol[m] = (vol[m] || 0) + 1;
    (c.secundarios || []).forEach(x => { vol[x] = (vol[x] || 0) + 0.5; });
  });
  const max = Math.max(1, ...Object.values(vol));
  const volHtml = Object.keys(vol).length ? `<div class="vol">${Object.entries(vol).sort((a, b) => b[1] - a[1]).map(([m, n]) =>
    `<div class="vol-fila"><div class="fila"><span class="vol-nom">${esc(m)}</span><span><b>${fmtNum(n)}</b> <span class="suave">series</span></span></div><div class="barra"><div style="width:${n / max * 100}%"></div></div></div>`).join('')}</div>`
    : '<p class="suave" style="margin:0">Sin series en los últimos 7 días.</p>';
  const ult28 = S.sesiones.filter(s => new Date(s.fecha).getTime() >= Date.now() - 28 * 864e5).length;
  const meta = (Number(S.perfil.dias) || 3) * 4, adh = Math.min(100, Math.round(ult28 / meta * 100));
  return `<div class="tarjeta"><h3>Carga por ejercicio</h3>${graf}</div>
    <div class="tarjeta"><h3>Volumen por músculo</h3><p class="suave" style="margin:0">Últimos 7 días. Músculo principal 1 serie, secundarios media.</p>${volHtml}</div>
    <div class="tarjeta"><div class="adh">${anillo(adh / 100, adh + '%', '28 días')}<div><h3>Adherencia</h3>
    <p style="margin:0"><b class="n">${ult28} de ${meta}</b> <span class="suave">sesiones en las últimas 4 semanas</span></p></div></div></div>`;
}
// Línea de evolución (SVG a escala, sin deformar): área suave, guías de mínimo y máximo y último punto marcado.
function linea(v) {
  if (v.length < 2) return `<p class="suave" style="margin:10px 0 0">Con dos sesiones de este ejercicio aparece la curva.</p>`;
  const W = 320, H = 120, x0 = 30, x1 = W - 10, y0 = 14, y1 = H - 14;
  const mn = Math.min(...v), mx = Math.max(...v), r = mx - mn || 1;
  const X = (i) => x0 + (i / (v.length - 1)) * (x1 - x0), Y = (x) => mx === mn ? (y0 + y1) / 2 : y1 - ((x - mn) / r) * (y1 - y0);
  const pts = v.map((x, i) => `${X(i).toFixed(1)},${Y(x).toFixed(1)}`);
  const area = `M${X(0).toFixed(1)},${y1} L${pts.join(' L')} L${X(v.length - 1).toFixed(1)},${y1} Z`;
  const ult = v[v.length - 1];
  return `<svg class="lin" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución del peso: de ${fmt(v[0])} a ${fmt(ult)} kg">
    <line class="guia" x1="${x0}" x2="${x1}" y1="${Y(mx).toFixed(1)}" y2="${Y(mx).toFixed(1)}"/>${mx !== mn ? `<line class="guia" x1="${x0}" x2="${x1}" y1="${Y(mn).toFixed(1)}" y2="${Y(mn).toFixed(1)}"/>` : ''}
    <text x="0" y="${(Y(mx) + 4).toFixed(1)}">${fmtNum(mx)}</text>${mx !== mn ? `<text x="0" y="${(Y(mn) + 4).toFixed(1)}">${fmtNum(mn)}</text>` : ''}
    <path class="area" d="${area}"/><polyline class="trazo" points="${pts.join(' ')}"/>
    <circle class="punto" cx="${X(v.length - 1).toFixed(1)}" cy="${Y(ult).toFixed(1)}" r="5"/></svg>`;
}

function esSiNo(x) { return /\bsi tolera\b/i.test(x); }
function formValidar(puntos) {
  if (S.validacionEnviada) return `<div class="validar"><h3>${ic('check')}Para ajustar tu plan</h3><div class="ok">Respuestas enviadas. El entrenador las revisa.</div><button class="b" data-acc="validarOtraVez">Volver a responder</button></div>`;
  return `<div class="validar"><h3>${ic('info')}Para ajustar tu plan</h3><p class="suave" style="margin:0">Contestá lo que puedas: el entrenador revisa tus respuestas y ajusta el plan con vos.</p>
    <div class="val-form">${puntos.map((x, i) => `<div class="val-campo"><label for="val${i}">${esc(x)}</label>${esSiNo(x)
      ? `<select id="val${i}" data-val="${i}"><option value="">Elegí una opción</option><option>Sí</option><option>No</option><option>No sé</option></select>`
      : `<input id="val${i}" data-val="${i}" type="text" autocomplete="off">`}</div>`).join('')}</div>
    <button class="b principal" data-acc="enviarValidacion">${ic('enviar')}Enviar respuestas</button></div>`;
}

function bloqueCardio(c) {
  return `<div class="cardio-bloque"><span class="mini">Complemento: cardio</span>
    <div class="nom">${esc(cardioNom(c))}</div><div class="det">${cardioDetalle(c)}</div>${c.motivo ? `<p>${esc(c.motivo)}</p>` : ''}</div>`;
}
// Días con cardio y sin fuerza (ej. miércoles): tarjeta propia, secundaria.
function diasSoloCardio(lista) {
  const hoyDia = DIAS_SEMANA[new Date().getDay()];
  return lista.map(c => ({ d: c.dia, h: `<div class="tarjeta dia-plan dia-cardio"><span class="ceja">${esc(c.dia)}${c.dia === hoyDia ? ' · hoy' : ''} · sin fuerza</span>${bloqueCardio(c)}</div>` }));
}

function vEntrenador() {
  const p = plan();
  const resp = S.buzon.filter(b => b.respuesta);
  const ent = p.fuente === 'entrenador';
  const plegable = (titulo, cuerpo, extra = '') => `<details class="plegable ${extra}"><summary><span>${titulo}</span>${ic('abajo')}</summary>${cuerpo}</details>`;
  const hoyDia = DIAS_SEMANA[new Date().getDay()];
  const diasFuerza = new Set(p.sesiones.map(s => s.dia));
  const cardioSuelto = ent ? p.cardio.filter(c => !diasFuerza.has(c.dia)) : [];
  const tarjetaFuerza = s => `<div class="tarjeta dia-plan"><div class="cab"><div><span class="ceja">${ent ? esc(s.dia) + (s.dia === hoyDia ? ' · hoy' : '') : `Día ${s.orden}`}</span><h3>${esc(ent ? sinDia(s) : s.nombre)}</h3></div></div>
      <p class="suave" style="margin:0">${s.ejercicios.length} ejercicios · ~${s.duracionMin} min</p>
      ${s.ejercicios.map(e => `<div class="ej-plan"><div class="top"><div><div class="nom">${esc(e.nombre)}</div>
        <div class="chips"><span class="chip">${e.series} × ${e.reps[0]}–${e.reps[1]}</span><span class="chip">RIR ${e.rir}</span><span class="chip">${ic('reloj').replace('class="i"', 'class="i" style="width:14px;height:14px;margin-right:4px"')}${fmtNum(e.descanso / 60)} min</span></div></div>
        <button class="b icono fantasma" data-acc="verEj" data-id="${e.id}" aria-label="Ver ejercicio ${esc(e.nombre)}">${ic('info')}</button></div>
        ${plegable('Por qué', `<p>${esc(e.justificacion)}</p>`)}</div>`).join('')}${ent ? cardioDe(p, s.dia).map(bloqueCardio).join('') : ''}</div>`;
  const tarjetasDias = (ent ? [...p.sesiones.map(s => ({ d: s.dia, h: tarjetaFuerza(s) })), ...diasSoloCardio(cardioSuelto)].sort((x, y) => (DIAS_SEMANA.indexOf(x.d) + 6) % 7 - (DIAS_SEMANA.indexOf(y.d) + 6) % 7).map(x => x.h) : p.sesiones.map(tarjetaFuerza)).join('');
  return `<div class="tarjeta plan-cab"><div class="fila"><span class="etiqueta ${ent && p.estado !== 'definitivo' ? 'pend' : ''}">${ent ? (p.estado === 'definitivo' ? ic('check') : '') + esc(p.estado) : 'plan automático'}</span>
      <span class="etiqueta neutra">${p.sesiones.length} días de fuerza</span></div>
    <h2 style="margin-bottom:6px">${ent ? 'Tu plan' : 'Plan base'}</h2>
    <p class="suave" style="margin:0">${ent ? 'Armado por tu entrenador. Cada ejercicio tiene su motivo: tocá «Por qué» para leerlo.' : 'Todavía no hay plan del entrenador para vos: este es el plan base según tu perfil.'} Se ajusta con tus datos reales.</p>
    ${ent && p.notas.length ? `<div style="margin-top:12px">${plegable(`Criterio del plan · ${p.notas.length}`, `<ul class="notas">${p.notas.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`)}</div>` : ''}</div>
    ${p.avisos.length ? `<div class="info">${p.avisos.map(esc).join('<br>')}</div>` : ''}
    ${ent && p.aValidar.length ? formValidar(p.aValidar) : ''}
    ${tarjetasDias}
    <div class="seccion-tit"><h3>Respuestas del entrenador</h3></div>
    ${resp.length ? `<div class="hilo">${resp.map(b => `<div class="burbuja yo">${esc(b.texto)}</div><div class="burbuja ent"><span class="quien">Entrenador</span>${esc(b.respuesta)}</div>`).join('')}</div>` : '<p class="suave" style="margin:0 2px">Sin respuestas todavía. Escribile desde el Buzón.</p>'}`;
}

function vBuzon() {
  const l = [...S.buzon].reverse();
  return `<div class="tarjeta redactar"><h3 style="margin:0">Escribile al entrenador</h3>
    <select id="bTipo" aria-label="Tipo de mensaje"><option value="consulta">Consulta</option><option value="sugerencia">Sugerencia</option><option value="reporte de error">Reporte de error</option></select>
    <textarea id="bTexto" aria-label="Mensaje" placeholder="Ej: ¿puedo cambiar el día de piernas al miércoles?"></textarea>
    <button class="b principal" data-acc="enviarBuzon">${ic('enviar')}Enviar</button></div>
    ${l.length ? '<div class="seccion-tit"><h3>Conversaciones</h3></div>' : '<p class="suave" style="margin:0 2px">Todavía no hay mensajes. Las respuestas del entrenador aparecen acá.</p>'}
    ${l.map(b => `<div class="hilo"><div class="hilo-meta"><span>${esc(mayusc(b.tipo))} · ${fmtFecha(b.fecha)}</span><span class="etiqueta ${b.estado === 'respondida' ? '' : 'pend'}">${esc(b.estado || 'pendiente')}</span></div>
      <div class="burbuja yo">${esc(b.texto)}</div>
      ${b.respuesta ? `<div class="burbuja ent"><span class="quien">Entrenador</span>${esc(b.respuesta)}</div>` : '<div class="esperando"><i><b></b><b></b><b></b></i>Esperando respuesta del entrenador</div>'}</div>`).join('')}`;
}

function vPerfil() {
  const p = S.perfil;
  const op = (arr, v) => arr.map(o => `<option ${o === v ? 'selected' : ''}>${o}</option>`).join('');
  const inp = (k, t = 'text', extra = '') => `<input data-p="${k}" type="${t}" value="${esc(DEC_PERFIL.includes(k) ? fmt(p[k]) : p[k])}" ${extra}>`;
  const nomUsr = USUARIOS[S.usuario] || '';
  return `<div class="tarjeta"><div class="perfil-cab"><span class="avatar">${esc((p.nombre || nomUsr).charAt(0))}</span><div><h2>${esc(p.nombre || nomUsr)}</h2>
      <span class="suave">${esc(S.usuario)}${p.objetivo ? ' · ' + esc(p.objetivo) : ''}</span></div></div>
    <label>Usuario de este celular</label><select id="selUsuario">${Object.keys(USUARIOS).map(u => `<option value="${u}" ${u === S.usuario ? 'selected' : ''}>${u} · ${USUARIOS[u]}</option>`).join('')}</select></div>

    <div class="tarjeta"><span class="ceja">Datos personales</span>
    <div class="grupo"><label>Nombre</label>${inp('nombre')}
    <div class="dos"><div><label>Fecha de nacimiento</label>${inp('fecha_nacimiento', 'date')}</div>
    <div><label>Sexo</label><select data-p="sexo"><option value=""></option>${op(['femenino', 'masculino', 'otro'], p.sexo)}</select></div></div>
    <div class="tres"><div><label>Altura (cm)</label>${inp('altura_cm', 'text', 'inputmode="decimal"')}</div><div><label>Peso (kg)</label>${inp('peso_kg', 'text', 'inputmode="decimal"')}</div><div><label>% grasa</label>${inp('grasa_pct', 'text', 'inputmode="decimal"')}</div></div>
    <label>Experiencia</label><select data-p="experiencia">${op(['nunca', '<6 meses', '6-24 meses', '>2 años'], p.experiencia)}</select></div></div>

    <div class="tarjeta"><span class="ceja">Objetivo y semana</span>
    <div class="grupo"><label>Objetivo principal</label><select data-p="objetivo">${['hipertrofia', 'recomposicion', 'fuerza'].map(o => `<option ${o === p.objetivo ? 'selected' : ''}>${o}</option>`).join('')}</select>
    <label>Objetivo en tus palabras</label>${inp('objetivo_texto')}
    <label>Objetivo secundario</label>${inp('objetivo_secundario')}
    <div class="dos"><div><label>Días por semana</label><select data-p="dias">${[2, 3, 4, 5, 6].map(n => `<option ${n === Number(p.dias) ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
    <div><label>Minutos máx. (90)</label>${inp('duracion_min', 'text', 'inputmode="numeric"')}</div></div></div></div>

    <div class="tarjeta"><span class="ceja">Molestias y salud</span>
    <label style="margin-top:4px">Zonas con molestia</label><div class="zonas">${ZONAS.map(z => `<label><input type="checkbox" data-zona="${z}" ${p.lesiones.includes(z) ? 'checked' : ''}>${z}</label>`).join('')}</div>
    <div class="grupo"><label>Limitaciones médicas (solo para el entrenador)</label>${inp('limitaciones')}
    <label>Chequeo médico</label><div class="dos"><select data-p="chequeo_medico" aria-label="Chequeo médico">${op(['sí', 'no'], p.chequeo_medico)}</select>${inp('chequeo_fecha', 'date', 'aria-label="Fecha del chequeo"')}</div></div></div>

    <div class="tarjeta"><span class="ceja">Preferencias</span>
    <div class="grupo"><div class="dos"><div><label>Tono de feedback</label><select data-p="tono">${op(['critico', 'motivador', 'neutro'], p.tono)}</select></div>
    <div><label>Unidad de peso</label><select data-p="unidad">${op(['kg', 'lb'], p.unidad)}</select></div></div>
    <label>Calorías de mantenimiento (opcional)</label>${inp('kcal_mantenimiento', 'text', 'inputmode="decimal"')}
    <label>Mail para avisos</label>${inp('mail_avisos', 'email')}</div></div>

    <button class="b principal" data-acc="guardarPerfil">${ic('check')}Guardar perfil</button>

    <div class="tarjeta"><h3>Ejercicios excluidos y que no gustan</h3><div class="lista-simple">
    ${[...p.duelen.map(id => ['duele', id]), ...p.no_gustan.map(id => ['gusta', id])].map(([t, id]) => `<div class="it" style="align-items:center"><span>${esc(ej_[id] ? ej_[id].nombre : id)}<br><span class="suave" style="font-size:13.5px">${t === 'duele' ? 'Me duele' : 'No me gusta'}</span></span>
      <button class="b chico" data-acc="levantar" data-t="${t}" data-id="${id}">Levantar</button></div>`).join('') || '<p class="suave" style="margin:0">Ninguno.</p>'}</div></div>
    <div class="tarjeta"><span class="ceja">Servidor y datos</span><div class="grupo"><label>Dirección del servidor (este celular)</label>
    <input id="apiUrl" value="${esc(apiUrl())}" placeholder="https://script.google.com/...">
    <label>Clave del servidor (este celular)</label><input id="apiClave" type="password" autocomplete="off" value="${esc(apiClave())}"></div><div style="height:12px"></div>
    <div class="sec"><button class="b" data-acc="guardarApi">Conectar</button><button class="b" data-acc="exportar">Exportar CSV</button></div></div>`;
}

// ---------- Acciones ----------
function marcarLeidas() {
  if (!respuestasSinLeer()) return;
  S.buzon.forEach(b => { if (b.estado === 'respondida') b.leida = 'sí'; });
  enviar('marcarLeidas', {});
}

const DEC_PERFIL = ['altura_cm', 'peso_kg', 'grasa_pct', 'kcal_mantenimiento'];
function leerPerfilForm() {
  document.querySelectorAll('[data-p]').forEach(el => { S.perfil[el.dataset.p] = el.value; });
  // Decimales con coma o punto: se guardan como número (punto); vacío o inválido queda vacío.
  DEC_PERFIL.forEach(k => { const t = String(S.perfil[k] ?? '').trim(); S.perfil[k] = t === '' || isNaN(parseFloat(t.replace(',', '.'))) ? '' : num(t); });
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
  ir: (el) => ir(el.dataset.v, !!el.dataset.volver),
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
  enviarValidacion: () => {
    const puntos = plan().aValidar || [];
    const texto = puntos.map((q, i) => { const el = $('#val' + i); const r = el && el.value.trim(); return `${q} ${r || 'Sin respuesta'}`; }).join('\n');
    if (!puntos.some((q, i) => { const el = $('#val' + i); return el && el.value.trim(); })) return;
    enviar('buzon', { fecha: ahora(), tipo: 'validación', texto });
    S.validacionEnviada = true; guardarCache(); render();
  },
  validarOtraVez: () => { S.validacionEnviada = false; guardarCache(); render(); },
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
    guardarUsuario(el.value);
    S = { ...S, usuario: el.value, perfil: { ...PERFIL_BASE }, sesiones: [], series: [], comidas: [], evaluaciones: [], buzon: [], cola: [], sesion: null, validacionEnviada: false };
    sincronizar(); render();
  }
  if (el.dataset && el.dataset.accCh === 'ejProgreso') { UI.ejProgreso = el.value; render(); }
});
$('#nav').addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (b) ir(b.dataset.v); });
$('#btnPerfil').addEventListener('click', () => ir('perfil'));

// ---------- Inicio ----------
function arrancar(usuario) {
  cargarCache(usuario);
  render();
  sincronizar();
}
const usrInicial = usuarioGuardado();
if (usrInicial) arrancar(usrInicial);
else pantallaQuien((u) => { guardarUsuario(u); arrancar(u); });
if (S.sesion) { /* sesión en curso recuperada de la caché */ }
