// Motor de APP GIMNASIO: arma el plan base, sugiere progresiones, detecta cuándo descargar
// y evalúa la comida. Todas las funciones son puras (no leen ni escriben estado).
// Es el punto de partida: las decisiones finas las revisa el entrenador con los datos reales,
// y cada sugerencia devuelve su motivo para que se pueda auditar (DISENO.md §9 y §12).
import { CATALOGO, GRUPOS_VOLUMEN } from './catalogo.js';
import { NUTRICION } from './nutricion.js';

const porId = Object.fromEntries(CATALOGO.map(e => [e.id, e]));
const redondear = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d;

// =====================================================================
// 1. CARGAS (dato del gimnasio, DISENO.md §9.2)
// =====================================================================
// Mancuernas: 2.5 kg por mancuerna.
// Barra con discos (y máquinas cargadas con discos): 5 kg en total (un disco de 2.5 por lado).
// Máquinas de placas: se asume 5 kg hasta confirmar con el gimnasio.
// Poleas: 5 kg por paso hasta el corte y 7.5 kg desde ahí.
//   PENDIENTE (Tato): el corte es 30 o 35 kg. Se deja 35 hasta que se confirme.
//   Todo lo que usa pesosPolea() depende de este valor: incremento, decremento, pesoSiguiente,
//   pesoAnterior y, por lo tanto, cuánto sube o baja sugerirProgresion en ejercicios de polea.
export const POLEA_CORTE_KG = 35;
const POLEA_PASO_BAJO = 5;
const POLEA_PASO_ALTO = 7.5;
const POLEA_MAX_KG = 150;

// Escalones de la columna de la polea. DEPENDE DE POLEA_CORTE_KG.
// Ejemplo con corte 35: 5, 10, ..., 35, 42.5, 50, 57.5, ...  Con corte 30: ..., 30, 37.5, 45, ...
export function pesosPolea(corte = POLEA_CORTE_KG) {
  const p = [];
  for (let w = POLEA_PASO_BAJO; w <= corte; w += POLEA_PASO_BAJO) p.push(w);
  for (let w = corte + POLEA_PASO_ALTO; w <= POLEA_MAX_KG; w += POLEA_PASO_ALTO) p.push(redondear(w));
  return p;
}

function pasoFijo(ej) {
  if (ej.equipo === 'mancuerna') return 2.5;
  if (ej.equipo === 'barra' || ej.cargaPor === 'discos') return 5;
  if (ej.equipo === 'maquina') return 5; // máquina de placas: a confirmar con el gimnasio.
  return 2.5;
}

// Peso siguiente hacia arriba. En polea busca el escalón real (DEPENDE DE POLEA_CORTE_KG).
export function pesoSiguiente(ej, peso, corte = POLEA_CORTE_KG) {
  if (ej.equipo === 'polea') {
    const sig = pesosPolea(corte).find(w => w > peso + 1e-9);
    return sig ?? peso + POLEA_PASO_ALTO;
  }
  return redondear(peso + pasoFijo(ej), 2);
}

// Peso anterior hacia abajo. En polea, al bajar desde el corte el paso vuelve a ser 5 kg
// (desde 35 se baja a 30, no a 27.5). DEPENDE DE POLEA_CORTE_KG.
export function pesoAnterior(ej, peso, corte = POLEA_CORTE_KG) {
  if (ej.equipo === 'polea') {
    const ant = pesosPolea(corte).filter(w => w < peso - 1e-9).pop();
    return ant ?? 0;
  }
  return Math.max(0, redondear(peso - pasoFijo(ej), 2));
}

// Paso hacia arriba desde el peso actual (firma original, la usa la interfaz).
export function incremento(ejercicio, pesoActual) {
  return redondear(pesoSiguiente(ejercicio, pesoActual) - pesoActual, 2);
}
// Paso hacia abajo. Para la polea no es igual al de subida justo en el corte.
export function decremento(ejercicio, pesoActual) {
  return redondear(pesoActual - pesoAnterior(ejercicio, pesoActual), 2);
}

// =====================================================================
// 2. PRESCRIPCIÓN POR OBJETIVO Y ROL
// =====================================================================
// principal: primer ejercicio del día, más carga. secundario: compuesto que sigue. accesorio: aislamiento.
// Rangos de 6–15 con RIR 1–2 dan hipertrofia similar si se llega cerca del fallo (Schoenfeld y col., 2017);
// descansos de 2 min o más en compuestos rinden más que 1 min (Schoenfeld y col., 2016; Singer y col., 2024).
// En recomposición el estímulo es el mismo que en hipertrofia: lo que cambia es la dieta, no las series.
const PRESCRIPCION = {
  hipertrofia: {
    principal:  { reps: [6, 10],  rir: 2, descanso: 150 },
    secundario: { reps: [8, 12],  rir: 2, descanso: 120 },
    accesorio:  { reps: [10, 15], rir: 1, descanso: 75 },
  },
  recomposicion: {
    principal:  { reps: [6, 10],  rir: 2, descanso: 150 },
    secundario: { reps: [8, 12],  rir: 2, descanso: 120 },
    accesorio:  { reps: [10, 15], rir: 1, descanso: 75 },
  },
  fuerza: {
    principal:  { reps: [3, 6],  rir: 2, descanso: 210 },
    secundario: { reps: [5, 8],  rir: 2, descanso: 150 },
    accesorio:  { reps: [8, 12], rir: 2, descanso: 90 },
  },
};

// =====================================================================
// 3. PLANTILLAS Y DIVISIÓN SEMANAL
// =====================================================================
// [id, series, rol]. Orden: básico principal, básico secundario, accesorios (DISENO §6.2).
// Las plantillas evitan de entrada la sentadilla libre y la búlgara porque ninguno de los dos
// usuarios es candidato; siguen en el catálogo para quien las pueda hacer.
// Volumen semanal calculado con conteo fraccionado: ver volumenSemanal(). Objetivo 10–20 series
// por grupo grande y cada grupo en al menos 2 sesiones (DISENO §5.1).
const P = (id, series, rol) => ({ id, series, rol });

const PLANTILLAS = {
  // --- 2 días: cuerpo completo ---
  'Cuerpo completo A': [
    P('EJ-001', 3, 'principal'), P('EJ-011', 3, 'principal'), P('EJ-015', 3, 'secundario'),
    P('EJ-004', 3, 'secundario'), P('EJ-012', 2, 'secundario'), P('EJ-016', 2, 'secundario'),
    P('EJ-008', 2, 'accesorio'), P('EJ-022', 3, 'accesorio'), P('EJ-040', 2, 'accesorio'), P('EJ-024', 2, 'accesorio'),
  ],
  'Cuerpo completo B': [
    P('EJ-006', 3, 'principal'), P('EJ-036', 3, 'principal'), P('EJ-014', 3, 'secundario'),
    P('EJ-003', 3, 'secundario'), P('EJ-037', 3, 'secundario'), P('EJ-020', 2, 'secundario'),
    P('EJ-035', 3, 'accesorio'), P('EJ-025', 2, 'accesorio'), P('EJ-026', 2, 'accesorio'),
  ],
  // --- 3 días: cuerpo completo A/B/C (cada grupo 3 veces por semana) ---
  'Full A': [
    P('EJ-001', 3, 'principal'), P('EJ-011', 3, 'principal'), P('EJ-015', 3, 'secundario'),
    P('EJ-035', 4, 'accesorio'), P('EJ-022', 3, 'accesorio'), P('EJ-040', 2, 'accesorio'), P('EJ-024', 2, 'accesorio'),
  ],
  'Full B': [
    P('EJ-006', 3, 'principal'), P('EJ-036', 3, 'principal'), P('EJ-014', 3, 'secundario'),
    P('EJ-005', 2, 'secundario'), P('EJ-020', 3, 'secundario'), P('EJ-008', 3, 'accesorio'),
    P('EJ-007', 3, 'accesorio'), P('EJ-025', 2, 'accesorio'),
  ],
  'Full C': [
    P('EJ-003', 3, 'principal'), P('EJ-012', 3, 'principal'), P('EJ-016', 3, 'secundario'),
    P('EJ-004', 3, 'secundario'), P('EJ-013', 2, 'accesorio'), P('EJ-039', 2, 'accesorio'),
    P('EJ-041', 2, 'accesorio'), P('EJ-024', 2, 'accesorio'), P('EJ-026', 2, 'accesorio'),
  ],
  // --- 4 días: superior / inferior ---
  'Superior A': [
    P('EJ-011', 3, 'principal'), P('EJ-015', 3, 'secundario'), P('EJ-012', 3, 'secundario'), P('EJ-016', 3, 'secundario'),
    P('EJ-022', 3, 'accesorio'), P('EJ-024', 2, 'accesorio'), P('EJ-040', 2, 'accesorio'),
  ],
  'Inferior A': [
    P('EJ-001', 3, 'principal'), P('EJ-004', 3, 'secundario'), P('EJ-035', 4, 'accesorio'),
    P('EJ-008', 3, 'accesorio'), P('EJ-041', 2, 'accesorio'), P('EJ-009', 3, 'accesorio'), P('EJ-029', 2, 'accesorio'),
  ],
  'Superior B': [
    P('EJ-036', 3, 'principal'), P('EJ-014', 3, 'secundario'), P('EJ-037', 3, 'secundario'), P('EJ-020', 3, 'secundario'),
    P('EJ-038', 3, 'accesorio'), P('EJ-013', 2, 'accesorio'), P('EJ-039', 2, 'accesorio'), P('EJ-025', 2, 'accesorio'), P('EJ-026', 2, 'accesorio'),
  ],
  'Inferior B': [
    P('EJ-006', 3, 'principal'), P('EJ-003', 3, 'secundario'), P('EJ-005', 2, 'secundario'),
    P('EJ-007', 3, 'accesorio'), P('EJ-008', 2, 'accesorio'), P('EJ-010', 3, 'accesorio'), P('EJ-028', 2, 'accesorio'),
  ],
  // --- 5 días: superior / inferior + empuje / tirón / piernas ---
  'Empuje': [
    P('EJ-012', 3, 'principal'), P('EJ-020', 3, 'secundario'), P('EJ-014', 3, 'secundario'),
    P('EJ-013', 2, 'accesorio'), P('EJ-038', 2, 'accesorio'), P('EJ-026', 3, 'accesorio'),
  ],
  'Tirón': [
    P('EJ-017', 3, 'principal'), P('EJ-037', 3, 'secundario'), P('EJ-018', 3, 'secundario'),
    P('EJ-039', 2, 'accesorio'), P('EJ-025', 3, 'accesorio'),
  ],
  'Piernas': [
    P('EJ-006', 3, 'principal'), P('EJ-003', 3, 'secundario'), P('EJ-005', 2, 'secundario'),
    P('EJ-007', 3, 'accesorio'), P('EJ-008', 2, 'accesorio'), P('EJ-010', 3, 'accesorio'), P('EJ-028', 2, 'accesorio'),
  ],
};

// Días de la semana (0 = lunes) en que va cada sesión de fuerza.
// Se deja al menos un día entre dos sesiones que repiten los mismos músculos cuando se puede.
const SPLIT = {
  2: { sesiones: ['Cuerpo completo A', 'Cuerpo completo B'], dias: [0, 3] },
  3: { sesiones: ['Full A', 'Full B', 'Full C'], dias: [0, 2, 4] },
  4: { sesiones: ['Superior A', 'Inferior A', 'Superior B', 'Inferior B'], dias: [0, 1, 3, 4] },
  5: { sesiones: ['Superior A', 'Inferior A', 'Empuje', 'Tirón', 'Piernas'], dias: [0, 1, 3, 4, 5] },
};
// 6 días: no se programa una sexta sesión de fuerza. Con 5 ya se cubren 10–20 series por grupo; una sexta
// pasa de 20 en tren superior o repite piernas sin días de recuperación. El sexto día queda para cardio.
const NOMBRE_DIA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

// Días recomendados por el entrenador. El usuario puede tener otro número cargado; si no, se usa este.
export function diasRecomendados(perfil = {}) {
  return {
    dias: 4,
    motivo: 'Cuatro días en superior/inferior permiten entrenar cada músculo 2 veces por semana con 10–14 series semanales y sesiones de 60–80 min, cerca de la referencia de 90. Con 3 días hay que meter más ejercicios por sesión; con 5 o más, el cardio queda sin días libres y la recuperación de piernas se complica.'
      + (perfil.cardio === 'prioridad' ? ' Deja 3 días libres para el cardio, separado de la fuerza.' : ''),
  };
}

// =====================================================================
// 4. FILTROS POR LESIÓN Y PREFERENCIA
// =====================================================================
// perfil.lesiones: zonas ('rodilla', ...) o { zona, nivel } con nivel 1–3 (3 = molestia fuerte).
// perfil.noGustan / perfil.duelen: ids de ejercicios.
function normalizarLesiones(lesiones = []) {
  return lesiones.map(l => (typeof l === 'string' ? { zona: l, nivel: 1 } : { zona: l.zona, nivel: Number(l.nivel) || 1 }));
}
function normalizarPerfil(perfil = {}) {
  return {
    ...perfil,
    lesiones: normalizarLesiones(perfil.lesiones ?? []),
    noGustan: perfil.noGustan ?? [],
    duelen: perfil.duelen ?? [],
  };
}

// Por qué un ejercicio no sirve para la persona (null si sirve).
function motivoExclusion(ej, perfil) {
  if (perfil.duelen.includes(ej.id)) return 'marcado como "me duele"';
  if (perfil.noGustan.includes(ej.id)) return 'marcado como "no me gusta"';
  for (const l of perfil.lesiones) {
    if ((ej.excluyeSi ?? []).includes(l.zona)) return `molestia en ${l.zona}`;
    if (l.nivel >= 3 && ej.zonasCuidado.includes(l.zona)) return `molestia fuerte en ${l.zona}`;
  }
  return null;
}

export function esValido(ej, perfil) {
  return motivoExclusion(ej, normalizarPerfil(perfil)) === null;
}

// Ejercicios que la persona puede hacer (sin cardio).
export function ejerciciosPermitidos(perfil) {
  const p = normalizarPerfil(perfil);
  return CATALOGO.filter(e => e.patron !== 'cardio' && motivoExclusion(e, p) === null).map(e => e.id);
}

function grupoPrincipal(ej) {
  const v = Object.entries(ej.volumen ?? {});
  return v.length ? v.sort((a, b) => b[1] - a[1])[0][0] : null;
}

// Alternativas válidas, en orden: primero las del catálogo, después otras del mismo patrón
// y del mismo músculo principal, y por último cualquiera del mismo músculo principal.
export function alternativasValidas(id, perfil, usados = new Set()) {
  const p = normalizarPerfil(perfil);
  const ej = porId[id];
  if (!ej) return [];
  const gp = grupoPrincipal(ej);
  const ok = (e) => e && e.id !== id && !usados.has(e.id) && motivoExclusion(e, p) === null;
  const lista = [];
  const sumar = (e) => { if (ok(e) && !lista.includes(e)) lista.push(e); };
  ej.alternativas.forEach(a => sumar(porId[a]));
  CATALOGO.filter(e => e.patron === ej.patron && grupoPrincipal(e) === gp).forEach(sumar);
  if (gp) CATALOGO.filter(e => e.patron !== 'cardio' && grupoPrincipal(e) === gp).forEach(sumar);
  return lista;
}

// Para "no me gusta": la mejor alternativa válida, o null con el aviso para el entrenador (DISENO §6.3).
export function proponerAlternativa(id, perfil, usados = new Set()) {
  const alt = alternativasValidas(id, perfil, usados)[0];
  if (!alt) return { ejercicio: null, motivo: `No hay alternativa válida para ${porId[id]?.nombre ?? id}: lo revisa el entrenador.` };
  return { ejercicio: alt, motivo: `${alt.nombre} cubre el mismo músculo. ${alt.justificacion}` };
}

function resolver(id, perfil, usados) {
  const ej = porId[id];
  const motivo = motivoExclusion(ej, perfil);
  if (motivo === null && !usados.has(id)) return { ej, reemplaza: null, motivo: null };
  const alt = alternativasValidas(id, perfil, usados)[0];
  if (!alt) return null;
  return { ej: alt, reemplaza: ej, motivo: motivo ?? 'ya está en la sesión' };
}

// Ajustes técnicos por las zonas con molestia de la persona.
function cuidadosPara(ej, perfil) {
  return perfil.lesiones
    .filter(l => ej.zonasCuidado.includes(l.zona) && ej.ajustes?.[l.zona])
    .map(l => `Por tu molestia de ${l.zona}: ${ej.ajustes[l.zona]}`);
}

// =====================================================================
// 5. PLAN
// =====================================================================
const SEG_POR_SERIE = 45;         // trabajo de una serie
const SEG_CAMBIO_EJERCICIO = 90;  // preparar la máquina y series de aproximación del ejercicio
const MIN_ENTRADA_EN_CALOR = 8;   // general; la caminata de 10 min hasta el gimnasio ya suma
// La duración se estima y se muestra, pero no limita el plan: 90 min es referencia (DISENO §6.2), no tope.
// porLado: el trabajo de la serie se hace dos veces (una por lado).
export function estimarDuracion(ejercicios) {
  const seg = ejercicios.reduce((t, e) => t + e.series * (SEG_POR_SERIE * (e.porLado ? 2 : 1) + e.descanso) + SEG_CAMBIO_EJERCICIO, 0);
  return Math.round(MIN_ENTRADA_EN_CALOR + seg / 60);
}

export function generarPlan(perfilEntrada) {
  const perfil = normalizarPerfil(perfilEntrada);
  const objetivo = PRESCRIPCION[perfil.objetivo] ? perfil.objetivo : 'hipertrofia';
  const presc = PRESCRIPCION[objetivo];
  const avisos = [];
  let dias = SPLIT[perfil.dias] ? perfil.dias : diasRecomendados(perfil).dias;
  if (perfil.dias > 5) {
    dias = 5;
    avisos.push('Con 6 días se programan 5 de fuerza: una sexta sesión pasa de 20 series en tren superior o repite piernas sin recuperación. El día que queda se usa para cardio.');
  }
  const split = SPLIT[dias];

  const sesiones = split.sesiones.map((nombre, i) => {
    const usados = new Set();
    const ejercicios = [];
    for (const slot of PLANTILLAS[nombre]) {
      const r = resolver(slot.id, perfil, usados);
      if (!r) { avisos.push(`Sin alternativa válida para ${porId[slot.id].nombre} en ${nombre}: lo revisa el entrenador.`); continue; }
      usados.add(r.ej.id);
      const p = presc[slot.rol];
      const cuidados = cuidadosPara(r.ej, perfil);
      const base = r.reemplaza
        ? `Reemplaza a ${r.reemplaza.nombre} (${r.motivo}). ${r.ej.justificacion}`
        : r.ej.justificacion;
      ejercicios.push({
        id: r.ej.id,
        nombre: r.ej.nombre,
        rol: slot.rol,
        series: slot.series,
        reps: p.reps,
        rir: p.rir,
        descanso: p.descanso,
        equipo: r.ej.equipo,
        reemplazaA: r.reemplaza ? r.reemplaza.id : null,
        cuidados,
        justificacion: cuidados.length ? `${base} ${cuidados.join(' ')}` : base,
      });
    }
    const duracionMin = estimarDuracion(ejercicios);
    return { orden: i + 1, nombre, dia: NOMBRE_DIA[split.dias[i]], duracionMin, ejercicios };
  });

  const plan = { objetivo, dias, sesiones, avisos };
  const vol = volumenSemanal(plan);
  for (const g of GRUPOS_GRANDES) {
    if (vol[g] < VOLUMEN_MIN) avisos.push(`Volumen de ${g}: ${vol[g]} series por semana, debajo de ${VOLUMEN_MIN}. Con ${dias} días no se llega a 2 dosis semanales suficientes; se recomiendan ${diasRecomendados(perfil).dias}.`);
    if (vol[g] > VOLUMEN_MAX) avisos.push(`Volumen de ${g}: ${vol[g]} series por semana, arriba de ${VOLUMEN_MAX}.`);
  }
  plan.volumen = vol;
  plan.cardio = planCardio(perfil, plan);
  return plan;
}

// =====================================================================
// 6. VOLUMEN Y FRECUENCIA
// =====================================================================
// Conteo fraccionado: una serie suma 1 al músculo principal y 0.5 a los que ayudan (Pelland y col., 2024).
export const GRUPOS_GRANDES = ['pecho', 'espalda', 'hombros', 'biceps', 'triceps', 'cuadriceps', 'isquiotibiales', 'gluteo'];
export const VOLUMEN_MIN = 10;
export const VOLUMEN_MAX = 20;

function volumenSesion(sesion) {
  const v = {};
  for (const e of sesion.ejercicios) {
    for (const [g, f] of Object.entries(porId[e.id].volumen ?? {})) v[g] = (v[g] ?? 0) + e.series * f;
  }
  return v;
}

export function volumenSemanal(plan) {
  const v = Object.fromEntries(GRUPOS_VOLUMEN.map(g => [g, 0]));
  for (const s of plan.sesiones) for (const [g, n] of Object.entries(volumenSesion(s))) v[g] += n;
  for (const g of Object.keys(v)) v[g] = redondear(v[g]);
  return v;
}

// Sesiones por semana en las que el grupo recibe al menos 2 series efectivas.
export function frecuenciaSemanal(plan) {
  const f = Object.fromEntries(GRUPOS_VOLUMEN.map(g => [g, 0]));
  for (const s of plan.sesiones) for (const [g, n] of Object.entries(volumenSesion(s))) if (n >= 2) f[g] += 1;
  return f;
}

// =====================================================================
// 7. CARDIO (siempre en sesiones separadas de la fuerza, DISENO §5.3)
// =====================================================================
// perfil.cardio: 'prioridad' (Tato: mejorar mucho la capacidad aeróbica), 'salud' (por defecto), 'ninguno'.
// Reglas:
//  - Zona 2 es la base: mucho beneficio aeróbico con poco costo de recuperación.
//  - Intervalos solo con 'prioridad', 1 por semana, y nunca el día antes de piernas: el trabajo intenso
//    de piernas en las 24 h previas es lo que más interfiere con la fuerza (Wilson y col., 2012).
//  - Bici o elíptica antes que correr por la rodilla.
//  - Siempre queda al menos un día sin entrenamiento: la adherencia y la recuperación pesan más que una
//    sesión de zona 2 extra. Si no alcanzan los días libres, la zona 2 va el mismo día de un tren
//    superior, en otro momento (no castiga las piernas del día siguiente).
export function planCardio(perfilEntrada, plan) {
  const perfil = normalizarPerfil(perfilEntrada);
  const modo = perfil.cardio ?? 'salud';
  if (modo === 'ninguno') return { sesiones: [], motivo: 'Sin cardio programado por decisión del perfil. Las caminatas al gimnasio suman, pero no alcanzan para mejorar la capacidad aeróbica.' };

  const split = SPLIT[plan.dias];
  const piernas = new Set();
  plan.sesiones.forEach((s, i) => {
    const v = volumenSesion(s);
    if ((v.cuadriceps ?? 0) + (v.isquiotibiales ?? 0) + (v.gluteo ?? 0) >= 3) piernas.add(split.dias[i]);
  });
  const fuerza = new Set(split.dias);
  const libres = [0, 1, 2, 3, 4, 5, 6].filter(d => !fuerza.has(d));
  const antesDePiernas = (d) => piernas.has((d + 1) % 7);

  const sesiones = [];
  const usados = new Set();
  const z2 = (dia, mismoDia) => ({
    id: 'EJ-030', nombre: porId['EJ-030'].nombre, dia: NOMBRE_DIA[dia], duracionMin: '30 → 45',
    intensidad: 'zona 2 (se puede conversar)',
    nota: mismoDia ? 'Mismo día que la fuerza, en otro momento (idealmente 6 h o más de diferencia, o después de la fuerza).' : null,
  });

  if (modo === 'prioridad') {
    // Intervalos: el día libre más lejos del próximo día de piernas.
    const candidatos = libres.filter(d => !antesDePiernas(d));
    const distancia = (d) => { for (let k = 1; k <= 7; k++) if (piernas.has((d + k) % 7)) return k; return 7; };
    const diaInt = candidatos.sort((a, b) => distancia(b) - distancia(a))[0];
    if (diaInt !== undefined) {
      usados.add(diaInt);
      sesiones.push({
        id: 'EJ-042', nombre: porId['EJ-042'].nombre, dia: NOMBRE_DIA[diaInt], duracionMin: 35,
        intensidad: '4 × 4 min al 85–95% de la frecuencia máxima', nota: null,
      });
    }
  }
  const nZ2 = 2;
  const cupoLibres = Math.max(0, libres.length - 1 - usados.size); // se guarda un día de descanso
  const restantes = libres.filter(d => !usados.has(d));
  for (const d of restantes.slice(0, Math.min(nZ2, cupoLibres))) { sesiones.push(z2(d, false)); usados.add(d); }
  const superiores = split.dias.filter(d => !piernas.has(d));
  for (const d of superiores) {
    if (sesiones.filter(s => s.id === 'EJ-030').length >= nZ2) break;
    sesiones.push(z2(d, true));
  }

  const motivo = modo === 'prioridad'
    ? 'Para mejorar mucho la capacidad aeróbica: 2 sesiones de zona 2 (base, poco costo de recuperación) y 1 de intervalos 4×4 (sube el consumo máximo de oxígeno). Van en días distintos de la fuerza y los intervalos nunca el día antes de piernas. Bici para cuidar la rodilla; elíptica o cinta con pendiente como alternativa.'
    : 'Dos sesiones de zona 2 de 30–45 min: suman gasto y salud cardiovascular sin quitar recuperación a la fuerza. Recomendadas, no obligatorias. Las caminatas al gimnasio suman, pero no alcanzan solas.';
  return { sesiones, motivo };
}

// =====================================================================
// 8. PROGRESIÓN
// =====================================================================
// historial: sesiones del ejercicio en orden cronológico: { peso, reps: [..], rir: [..], dolor: 0|1|2|3 }
// reps: [mínimo, máximo] del rango. rirObjetivo: RIR previsto.
// Devuelve { accion, peso, motivo }. accion: inicial | subir | mantener | bajar | reemplazar.
//
// Criterio (doble progresión, el método con mejor respaldo práctico para hipertrofia):
//  - SUBIR cuando todas las series llegan al tope del rango con el RIR previsto. Se acepta 1 rep de
//    diferencia en el RIR porque la estimación de RIR tiene ese error típico (Zourdos y col., 2016).
//    Antes de subir se calcula cuántas reps saldrían con el peso nuevo: si el salto del equipo es muy
//    grande (típico con mancuernas livianas) y quedaría debajo del rango, primero se suman reps.
//  - MANTENER mientras se está dentro del rango: la carga es la correcta y se progresa en reps.
//  - MANTENER si una sola sesión salió baja: puede ser ruido (sueño, comida, estrés).
//  - BAJAR si dos sesiones seguidas quedaron debajo del rango: la carga es alta para ese rango. Se baja
//    al peso con el que, según el rendimiento real, se vuelve a la parte baja-media del rango.
//  - Dolor: 1 = mantener, 2 = bajar un paso y ajustar rango, 3 = reemplazar (DISENO §6.3).
//    No se progresa sobre dolor; una molestia leve que no aumenta se tolera, como en rehabilitación.
const MARGEN_RIR = 1;

// Reps hasta el fallo estimadas = reps hechas + RIR. 1RM por Epley, válido hasta ~15 reps.
function e1rmSerie(peso, reps, rir = 0) {
  return peso * (1 + (reps + Math.min(rir, 4)) / 30);
}
function mejorE1rm(registro) {
  return Math.max(...registro.reps.map((r, i) => e1rmSerie(registro.peso, r, registro.rir?.[i] ?? 0)));
}
// Reps que saldrían con un peso dado y un RIR dado.
function repsPrevistas(e1rm, peso, rir) {
  return Math.round(30 * (e1rm / peso - 1) - rir); // la estimación tiene ±1 rep de error: se redondea
}
function seriesBajas(registro, minimo) {
  return registro.reps.filter(r => r < minimo).length >= Math.ceil(registro.reps.length / 2);
}

export function sugerirProgresion(ejercicio, historial, reps, rirObjetivo) {
  if (!historial || historial.length === 0) {
    return { accion: 'inicial', peso: null, motivo: `Primera vez: elegí un peso con el que hagas ${reps[0]}–${reps[0] + 2} repeticiones y te queden ${rirObjetivo} en reserva. Mejor quedarse corto: en 1–2 sesiones se ajusta.` };
  }
  const ult = historial[historial.length - 1];
  const ant = historial.length >= 2 ? historial[historial.length - 2] : null;
  const dolor = Number(ult.dolor) || 0;

  // --- Dolor primero ---
  if (dolor >= 3) {
    return { accion: 'reemplazar', peso: null, motivo: 'Dolor fuerte (3 de 3): el ejercicio sale del plan y se usa la alternativa. Si el dolor sigue fuera del gimnasio, consultá con un kinesiólogo.' };
  }
  if (dolor === 2 || (dolor === 1 && ant && Number(ant.dolor) >= 1)) {
    const peso = pesoAnterior(ejercicio, ult.peso);
    const porque = dolor === 2 ? 'Dolor moderado (2 de 3)' : 'Molestia en dos sesiones seguidas';
    return { accion: 'bajar', peso, motivo: `${porque}: se baja a ${peso} kg y se trabaja en el rango que no moleste. Si en la próxima sigue, se reemplaza el ejercicio.` };
  }
  if (dolor === 1) {
    return { accion: 'mantener', peso: ult.peso, motivo: `Molestia leve: se mantienen ${ult.peso} kg y no se sube hasta una sesión sin molestia. Si aumenta durante la serie o al día siguiente, avisá con "me duele".` };
  }

  const rir = ult.rir ?? ult.reps.map(() => rirObjetivo);
  const minRep = Math.min(...ult.reps);

  // --- Subir ---
  const topeCumplido = ult.reps.every(r => r >= reps[1]) && rir.every(x => x >= rirObjetivo - MARGEN_RIR);
  if (topeCumplido) {
    const nuevo = pesoSiguiente(ejercicio, ult.peso);
    const paso = redondear(nuevo - ult.peso, 2);
    const e1 = mejorE1rm({ ...ult, rir });
    const previstas = repsPrevistas(e1, nuevo, rirObjetivo);
    const saltoPct = Math.round((paso / ult.peso) * 100);
    if (previstas < reps[0] && minRep < reps[1] + 3) {
      return { accion: 'mantener', peso: ult.peso, motivo: `Llegaste al tope (${reps[1]} reps), pero el paso de ${paso} kg es un ${saltoPct}% de la carga: con ${nuevo} kg harías unas ${Math.max(previstas, 0)} reps, debajo del rango. Sumá repeticiones hasta ${reps[1] + 3} en todas las series y ahí subí.` };
    }
    return { accion: 'subir', peso: nuevo, motivo: `Hiciste ${reps[1]} o más reps en todas las series con RIR ${rirObjetivo - MARGEN_RIR} o más: se sube ${paso} kg (a ${nuevo} kg). Con ese peso se esperan unas ${Math.min(previstas, reps[1])} reps; la meta es volver a sumar hasta ${reps[1]}.` };
  }

  // --- Bajar (dos sesiones seguidas debajo del rango) ---
  const bajaHoy = seriesBajas(ult, reps[0]);
  if (bajaHoy && ant && seriesBajas(ant, reps[0]) && ant.peso <= ult.peso + 1e-9) {
    const e1 = mejorE1rm({ ...ult, rir });
    // Peso más alto (en los escalones reales del equipo) con el que se llega a mínimo+2 reps con el RIR previsto.
    const repsMeta = reps[0] + 2;
    const objetivoKg = e1 / (1 + (repsMeta + rirObjetivo) / 30);
    let peso = pesoAnterior(ejercicio, ult.peso);
    while (peso > objetivoKg) {
      const menor = pesoAnterior(ejercicio, peso);
      if (menor <= 0 || menor === peso) break;
      peso = menor;
    }
    const previstas = Math.min(repsPrevistas(e1, peso, rirObjetivo), reps[1]);
    return { accion: 'bajar', peso, motivo: `Dos sesiones seguidas debajo de ${reps[0]} reps en la mayoría de las series: la carga es alta para este rango. Según tu rendimiento real (1RM estimado ${Math.round(e1)} kg), con ${peso} kg la primera serie da unas ${previstas} reps con RIR ${rirObjetivo} (las siguientes, algo menos por la fatiga); desde ahí se vuelve a progresar.` };
  }
  if (bajaHoy) {
    return { accion: 'mantener', peso: ult.peso, motivo: `Quedaste debajo de ${reps[0]} reps en esta sesión. Una sesión mala puede ser sueño, comida o estrés: se repite ${ult.peso} kg. Si vuelve a pasar, se baja.` };
  }

  // --- Mantener dentro del rango ---
  const rirAlto = rir.some(x => x > rirObjetivo + 1);
  return {
    accion: 'mantener', peso: ult.peso,
    motivo: rirAlto
      ? `Estás en el rango pero con más reserva de la prevista (RIR ${Math.max(...rir)}): mantené ${ult.peso} kg y llevá cada serie hasta RIR ${rirObjetivo}, sumando repeticiones.`
      : `Estás en el rango (${reps[0]}–${reps[1]}) pero no en el tope en todas las series: se mantienen ${ult.peso} kg y se suman repeticiones.`,
  };
}

// Estimación de 1RM (Epley) a partir de una serie.
export function estimarRM(peso, reps) {
  return Math.round(peso * (1 + reps / 30) * 10) / 10;
}

// =====================================================================
// 9. DESCARGA (solo con evidencia en los datos, DISENO §9.4)
// =====================================================================
// sesiones: últimas sesiones en orden cronológico: { sensacion: 1–5, ejercicios: [{ id, peso, reps, rir }] }
// Señales: (a) rendimiento que cae en la mitad o más de los ejercicios comparables (1RM estimado
// más de 3% abajo que la vez anterior) junto con sensación baja (≤2) en 2 de las 3 últimas sesiones;
// o (b) sensación baja en las 3 últimas. La descarga es una semana con la mitad de las series y la misma
// carga con RIR 3–4: reduce la fatiga sin perder adaptaciones (Bell y col., 2023, consenso Delphi).
export function sugerirDescarga(sesiones = []) {
  const ultimas = sesiones.slice(-3);
  const sensBaja = ultimas.filter(s => Number(s.sensacion) <= 2).length;

  let comparados = 0, caidas = 0;
  const visto = {};
  sesiones.forEach((s, i) => {
    for (const e of s.ejercicios ?? []) {
      if (!e.reps?.length) continue;
      const valor = mejorE1rm(e);
      if (i >= sesiones.length - 2 && visto[e.id] !== undefined) {
        comparados++;
        if (valor < visto[e.id] * 0.97) caidas++;
      }
      visto[e.id] = valor;
    }
  });
  const como = 'Una semana: mitad de las series, misma carga, RIR 3–4. Cardio solo zona 2. Después se retoma el plan donde quedó.';
  if (comparados >= 3 && caidas / comparados >= 0.5 && sensBaja >= 2) {
    return { descargar: true, como, motivo: `El rendimiento bajó en ${caidas} de ${comparados} ejercicios comparables y la sensación fue baja en ${sensBaja} de las últimas 3 sesiones: es fatiga acumulada, no falta de esfuerzo.` };
  }
  if (ultimas.length >= 3 && sensBaja >= 3) {
    return { descargar: true, como, motivo: 'Sensación baja en las 3 últimas sesiones seguidas, aunque las cargas todavía no cayeron: se descarga antes de que caigan.' };
  }
  return { descargar: false, como: null, motivo: comparados ? `Sin señales de fatiga acumulada (${caidas} de ${comparados} ejercicios abajo, sensación baja en ${sensBaja} de ${ultimas.length}). No se programa descarga.` : 'Faltan datos para evaluar fatiga. No se programa descarga.' };
}

// =====================================================================
// 10. COMIDA (lista fija de DISENO §11.2, tono de §11.4)
// =====================================================================
// Estados válidos por categoría (los muestra la interfaz).
export const CHEQUEO_COMIDA = {
  proteina: ['suficiente', 'justa', 'faltante'],
  verduras: ['suficiente', 'faltante'],
  carbohidratos: ['acorde', 'sobra', 'falta'],
  grasas: ['acorde', 'excede'],
  ultraprocesados: ['pocos', 'algunos', 'muchos'],
  agua: ['suficiente', 'faltante'],
  calorias: ['dentro', 'arriba', 'abajo'],
};
// Orden de importancia para la composición corporal: balance de energía y proteína primero.
const ORDEN_COMIDA = ['calorias', 'proteina', 'verduras', 'ultraprocesados', 'carbohidratos', 'grasas', 'agua'];

const CLASE = {
  suficiente: 'bien', acorde: 'bien', pocos: 'bien', dentro: 'bien',
  justa: 'mejorar', algunos: 'mejorar', fuera: 'mejorar',
  faltante: 'falta', falta: 'falta', abajo: 'falta',
  sobra: 'sobra', excede: 'sobra', muchos: 'sobra', arriba: 'sobra',
};

// Balance calórico frente a mantenimiento, en % (DISENO §4). Se usa solo si la persona no tiene objetivo de comida propio.
// Hipertrofia sin "verse gordo": de mantenimiento a +10% (superávit chico, menos grasa ganada; Iraki y col., 2019).
// Recomposición: déficit leve, de −15% a mantenimiento.
const BALANCE = { hipertrofia: [0, 10], recomposicion: [-15, 0], fuerza: [0, 10] };
// Proteína g/kg/día: 1.6 es donde se aplana el beneficio en promedio, 2.2 el techo útil (Morton y col., 2018).
// En déficit (recomposición) se apunta más alto para proteger el músculo.
const PROTEINA = { hipertrofia: { ok: 1.6, justa: 1.2 }, recomposicion: { ok: 1.8, justa: 1.4 }, fuerza: { ok: 1.6, justa: 1.2 } };

// Objetivos de comida por persona (los decide la nutricionista; cada usuario tiene el suyo en nutricion.js).
//   balance: rango "en línea" en % frente a mantenimiento; meta: el punto al que se apunta.
//   proteina g/kg/día: ok = en línea, justa = parcial, meta = lo que se muestra como objetivo.
//   textos: qué consejos de calorías usa (los de TEXTO.calorias.hacer).
// superavit_chico: ganar músculo sin grasa visible. ~5% vs ~15% de superávit en entrenados dio músculo parecido
//   y más grasa con el grande (Helms y col., 2023); por eso el techo es +10% y la meta +5%.
// deficit_leve: ganar músculo y bajar grasa. Hasta −10% queda lejos de las ~500 kcal/día de déficit desde las que
//   se frena la ganancia de músculo (Murphy y Koehler, 2022). En déficit, proteína más alta (Helms y col., 2014).
export const OBJETIVOS_COMIDA = {
  superavit_chico: { balance: [0, 10], meta: 5, proteina: { ok: 1.6, justa: 1.2, meta: 1.8 }, textos: 'hipertrofia' },
  mantenimiento:   { balance: [-5, 5], meta: 0, proteina: { ok: 1.6, justa: 1.2, meta: 1.8 }, textos: 'hipertrofia' },
  deficit_leve:    { balance: [-10, 0], meta: -5, proteina: { ok: 1.8, justa: 1.4, meta: 2.0 }, textos: 'recomposicion' },
};
// Margen de error al cargar calorías: hasta 3 puntos fuera del rango cuenta como "a ajustar", no como falla.
const TOLERANCIA_PCT = 3;

const edadEn = (nac, hoy) => {
  const n = new Date(nac); if (isNaN(n)) return 0;
  let e = hoy.getFullYear() - n.getFullYear();
  if (hoy.getMonth() < n.getMonth() || (hoy.getMonth() === n.getMonth() && hoy.getDate() < n.getDate())) e--;
  return e;
};
// Mantenimiento estimado cuando el perfil no lo trae: Mifflin-St Jeor (Mifflin y col., 1990) por un factor de actividad
// según los días de entrenamiento. Error individual de ±10%: es punto de partida; se corrige con el peso de 2–3 semanas.
// Devuelve 0 si falta peso, altura, edad o sexo (femenino/masculino).
export function estimarMantenimiento(perfil = {}, hoy = new Date()) {
  const peso = +perfil.peso_kg, alt = +perfil.altura_cm, edad = edadEn(perfil.fecha_nacimiento, hoy);
  const s = { masculino: 5, femenino: -161 }[perfil.sexo];
  if (!(peso > 0 && alt > 0 && edad > 0) || s === undefined) return 0;
  const dias = +perfil.dias || 0;
  const factor = dias >= 5 ? 1.7 : dias >= 3 ? 1.55 : 1.4;
  return Math.round((10 * peso + 6.25 * alt - 5 * edad + s) * factor / 10) * 10;
}

const TEXTO = {
  calorias: {
    bien: 'calorías dentro del rango', falta: 'calorías por debajo del rango', sobra: 'calorías por encima del rango', mejorar: 'calorías apenas fuera del rango',
    hacer: {
      falta: { hipertrofia: 'sumá una colación (por ejemplo, yogur con avena o un sándwich): sin llegar a mantenimiento el músculo no crece', recomposicion: 'no bajes tanto: un déficit grande frena el músculo; sumá una colación con proteína', fuerza: 'sumá una colación: sin energía suficiente la fuerza se estanca' },
      sobra: { hipertrofia: 'volvé a mantenimiento o apenas arriba: un superávit grande suma más grasa que músculo', recomposicion: 'recortá porciones de lo más calórico (aceite, harinas, alcohol, dulces) hasta volver a un déficit leve', fuerza: 'volvé a mantenimiento o apenas arriba' },
      mejorar: 'quedaste cerca: con una porción más o una menos volvés al rango',
    },
  },
  proteina: { bien: 'proteína suficiente', mejorar: 'proteína justa', falta: 'proteína baja', hacer: 'poné una fuente de proteína (carne, pollo, pescado, huevos, lácteos o legumbres) en cada comida principal, repartida en 3–4 comidas' },
  verduras: { bien: 'verduras y fruta', falta: 'faltaron verduras y fruta', hacer: 'medio plato de verduras en almuerzo y cena y 1–2 frutas por día' },
  ultraprocesados: { bien: 'pocos ultraprocesados', mejorar: 'algunos ultraprocesados', sobra: 'muchos ultraprocesados', hacer: 'cambiá un ultraprocesado por algo simple (fruta, yogur, sándwich casero): llenan menos y suman calorías fácil' },
  carbohidratos: { bien: 'carbohidratos acordes', falta: 'faltaron carbohidratos', sobra: 'sobraron carbohidratos', hacer: { falta: 'los días de entrenamiento sumá una porción de carbohidrato (arroz, papa, pan, fruta) antes o después de entrenar: rinde más la sesión', sobra: 'bajá la porción de carbohidrato en las comidas lejos del entrenamiento' } },
  grasas: { bien: 'grasas razonables', sobra: 'grasas en exceso', hacer: 'medí el aceite y bajá fritos, quesos grasos y fiambres: es la forma más fácil de pasarse de calorías sin notarlo' },
  agua: { bien: 'agua suficiente', falta: 'faltó agua', hacer: 'tomá agua con cada comida y durante el entrenamiento' },
};

function accion(cat, clase, objetivo) {
  const h = TEXTO[cat].hacer;
  if (typeof h === 'string') return h;
  const x = h[clase] ?? h.mejorar;
  return typeof x === 'string' ? x : (x?.[objetivo] ?? x?.hipertrofia);
}
const mayus = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const signo = (n) => (n > 0 ? `+${n}` : n === 0 ? '0' : `−${-n}`);
const lista = (xs) => xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`;

// estados: { categoria: estado } con los valores de CHEQUEO_COMIDA.
// tono: 'critico' | 'motivador' | 'neutro'. Cambia la forma, no los datos (DISENO §11.4).
// contexto (opcional): { objetivo, pesoKg, proteinaG, kcal, kcalMantenimiento }. Si vienen números,
// proteína y calorías se calculan con ellos en vez del estado cargado a mano.
// Objetivo de comida de cada persona: contexto.objetivoComida (clave de OBJETIVOS_COMIDA) o contexto.usuario
// (se busca en nutricion.js). Sin ninguno de los dos, se usa el balance genérico de contexto.objetivo.
// contexto.perfil (opcional): el perfil completo; de ahí salen peso y mantenimiento si no vienen sueltos.
// Si el perfil no tiene mantenimiento cargado, se estima con peso, altura, edad y sexo; si faltan, no se evalúan calorías.
export function evaluarDia(estados = {}, tono = 'neutro', contexto = {}) {
  const p = contexto.perfil || {};
  const clave = OBJETIVOS_COMIDA[contexto.objetivoComida] ? contexto.objetivoComida : NUTRICION[contexto.usuario]?.objetivoComida;
  const propio = OBJETIVOS_COMIDA[clave];
  const generico = BALANCE[contexto.objetivo ?? p.objetivo] ? (contexto.objetivo ?? p.objetivo) : 'hipertrofia';
  const objetivo = propio ? propio.textos : generico; // qué textos de consejo usar
  const rango = propio ? propio.balance : BALANCE[generico];
  const prot = propio ? propio.proteina : PROTEINA[generico];
  const pesoKg = contexto.pesoKg > 0 ? contexto.pesoKg : +p.peso_kg || 0;
  let mant = contexto.kcalMantenimiento > 0 ? contexto.kcalMantenimiento : +p.kcal_mantenimiento || 0;
  const e = { ...estados };
  const datos = {};
  if (propio) datos.objetivoComida = clave;
  if (!(mant > 0) && contexto.perfil) { mant = estimarMantenimiento(p, contexto.hoy); if (mant) datos.mantenimientoEstimado = mant; }

  if (contexto.proteinaG > 0 && pesoKg > 0) {
    const gkg = redondear(contexto.proteinaG / pesoKg);
    e.proteina = gkg >= prot.ok ? 'suficiente' : gkg >= prot.justa ? 'justa' : 'faltante';
    datos.proteinaGkg = gkg;
    datos.proteinaMetaG = Math.round((prot.meta ?? prot.ok) * pesoKg);
  }
  if (contexto.kcal > 0 && mant > 0) {
    const pct = Math.round((contexto.kcal / mant - 1) * 100);
    const [lo, hi] = rango;
    e.calorias = pct > hi + TOLERANCIA_PCT ? 'arriba' : pct < lo - TOLERANCIA_PCT ? 'abajo' : (pct > hi || pct < lo) ? 'fuera' : 'dentro';
    datos.balancePct = pct;
    datos.rangoPct = [lo, hi];
  }

  const bien = [], faltan = [], sobran = [], mejorar = [], acciones = [];
  for (const cat of ORDEN_COMIDA) {
    const clase = CLASE[e[cat]];
    if (!clase) continue;
    if (clase === 'bien') { bien.push(cat); continue; }
    (clase === 'falta' ? faltan : clase === 'sobra' ? sobran : mejorar).push(cat);
    acciones.push(accion(cat, clase, objetivo));
  }
  const evaluadas = bien.length + faltan.length + sobran.length + mejorar.length;

  // Nivel: proteína baja o calorías fuera del rango son las fallas que más mueven la composición.
  const graves = faltan.includes('proteina') || faltan.includes('calorias') || sobran.includes('calorias');
  const problemas = faltan.length + sobran.length;
  const estado = evaluadas === 0 ? 'sin_datos'
    : (graves || problemas >= 3) ? 'no'
    : (problemas + mejorar.length > 0) ? 'parcial' : 'si';

  const txt = (cat, clase) => TEXTO[cat][clase] ?? cat;
  const tBien = bien.map(c => txt(c, 'bien'));
  const tMal = [...faltan.map(c => txt(c, 'falta')), ...sobran.map(c => txt(c, 'sobra')), ...mejorar.map(c => txt(c, 'mejorar'))];
  const dato = [
    datos.proteinaGkg !== undefined ? `proteína ${datos.proteinaGkg} g/kg (meta ${datos.proteinaMetaG} g)` : null,
    datos.balancePct !== undefined ? `balance ${signo(datos.balancePct)}% (rango ${signo(datos.rangoPct[0])}% a ${signo(datos.rangoPct[1])}%${datos.mantenimientoEstimado ? `, sobre un mantenimiento estimado de ${datos.mantenimientoEstimado} kcal` : ''})` : null,
  ].filter(Boolean).join('; ');
  const pasos = acciones.slice(0, 2);

  let resumen;
  if (estado === 'sin_datos') {
    resumen = 'Sin datos para evaluar: completá el chequeo del día.';
  } else if (tono === 'critico') {
    const cab = { si: 'En línea con el objetivo.', parcial: 'Parcialmente en línea.', no: 'No estás en línea con el objetivo.' }[estado];
    resumen = [cab,
      tMal.length ? `${mayus(lista(tMal))}.` : null,
      dato ? `Datos: ${dato}.` : null,
      pasos.length ? `Qué cambiar: ${pasos.join('; ')}.` : 'Sostenelo todos los días: un buen día no cambia nada, la constancia sí.',
    ].filter(Boolean).join(' ');
  } else if (tono === 'motivador') {
    const cab = { si: '¡Día en línea con tu objetivo!', parcial: 'Vas por buen camino, con algo para ajustar.', no: 'Hoy quedó lejos del objetivo, pero se corrige con pasos concretos.' }[estado];
    resumen = [cab,
      tBien.length ? `Bien: ${lista(tBien)}.` : null,
      dato ? `Tus números: ${dato}.` : null,
      pasos.length ? `Próximo paso: ${pasos[0]}.` : 'Repetir esto es lo que da resultados.',
      pasos.length > 1 ? `Y después: ${pasos[1]}.` : null,
    ].filter(Boolean).join(' ');
  } else {
    const cab = { si: 'En línea con el objetivo.', parcial: 'Parcialmente en línea.', no: 'No en línea con el objetivo.' }[estado];
    resumen = [cab,
      tBien.length ? `Bien: ${lista(tBien)}.` : null,
      tMal.length ? `A corregir: ${lista(tMal)}.` : null,
      dato ? `Datos: ${dato}.` : null,
      pasos.length ? `Sugerencia: ${pasos.join('; ')}.` : null,
    ].filter(Boolean).join(' ');
  }

  return {
    enLinea: estado === 'si',
    estado,           // 'si' | 'parcial' | 'no' | 'sin_datos'
    bien, faltan, sobran, mejorar,
    acciones,         // qué hacer, en orden de importancia
    datos,
    resumen,
    aviso: 'Evaluación orientativa. Con una condición médica o para un plan detallado, consultá con una nutricionista deportóloga.',
  };
}
