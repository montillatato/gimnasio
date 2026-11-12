// APP GIMNASIO — reglas del perfil (puras, sin DOM): valores por defecto, "perfil completo" y sincronización.
// El perfil local sirve para la vista; la hoja solo debe recibir lo que la persona cargó de verdad.

export const PERFIL_BASE = {
  nombre: '', fecha_nacimiento: '', sexo: '', altura_cm: '', peso_kg: '', grasa_pct: '', experiencia: '6-24 meses',
  objetivo: 'hipertrofia', objetivo_texto: '', objetivo_secundario: '', dias: 3, duracion_min: 75,
  lesiones: [], limitaciones: '', no_gustan: [], duelen: [], tono: 'neutro', mail_avisos: '', unidad: 'kg',
  chequeo_medico: 'no', chequeo_fecha: '', kcal_mantenimiento: ''
};

const lista = (v) => { if (Array.isArray(v)) return v; try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
const vacio = (v) => v == null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);

// Un perfil está completo si la persona cargó su nombre.
export function perfilCompleto(p) { return !!(p && typeof p.nombre === 'string' && p.nombre.trim()); }

// Perfil para escribir en la hoja: lo que sigue igual al valor por defecto (la persona no lo tocó) o está vacío va como ''.
// Campos de opción: siempre se guardan con su valor, aunque coincidan con el por defecto.
const CAMPOS_SIEMPRE = ['objetivo', 'experiencia', 'dias', 'duracion_min', 'tono', 'unidad'];
export function perfilParaServidor(p) {
  const o = { ...p };
  Object.keys(PERFIL_BASE).forEach((k) => {
    const base = PERFIL_BASE[k], v = o[k];
    if (Array.isArray(base)) { if (vacio(v) || (typeof v === 'string' && lista(v).length === 0)) o[k] = ''; return; }
    if (CAMPOS_SIEMPRE.includes(k)) { if (vacio(v)) o[k] = base; return; }
    if (vacio(v) || String(v) === String(base)) o[k] = '';
  });
  return o;
}

// Perfil de la hoja a perfil local: los campos vacíos recuperan el valor por defecto (solo para la vista).
export function perfilDesdeServidor(d) {
  const o = { ...PERFIL_BASE };
  Object.keys(d || {}).forEach((k) => { if (!vacio(d[k]) || !(k in PERFIL_BASE)) o[k] = d[k]; });
  o.lesiones = lista(d && d.lesiones); o.no_gustan = lista(d && d.no_gustan); o.duelen = lista(d && d.duelen);
  return o;
}

const ms = (iso) => { const t = Date.parse(iso); return isNaN(t) ? 0 : t; };

// Decide qué hacer con el perfil al sincronizar: 'reemplazar' (usar el del servidor), 'enviar' (subir el local) o 'nada'.
// - El servidor reemplaza solo si tiene nombre y su "actualizado" es más nuevo que el último guardado local.
//   Si el local no tiene nombre no hay nada que perder: se reemplaza si el servidor tiene datos.
// - Si el local tiene datos y el servidor no, se sube el local.
export function decidirPerfil(local, servidor, guardadoLocal) {
  const sCompleto = perfilCompleto(servidor), lCompleto = perfilCompleto(local);
  if (sCompleto && !lCompleto) return 'reemplazar';
  if (sCompleto && ms(servidor.actualizado) > ms(guardadoLocal)) return 'reemplazar';
  if (lCompleto && !sCompleto) return 'enviar';
  return 'nada';
}
