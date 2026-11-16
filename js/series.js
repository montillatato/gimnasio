// Edición de una serie ya registrada (lógica pura, sin pantalla).
const n = (v) => { const x = parseFloat(String(v).replace(',', '.')); return isNaN(x) ? 0 : x; };

// Busca la serie por sesion_id + ejercicio_id + num_serie. Devuelve el índice o -1.
export function indiceSerie(series, ref) {
  return series.findIndex(s => String(s.sesion_id) === String(ref.sesion_id) && String(s.ejercicio_id) === String(ref.ejercicio_id) && Number(s.num_serie) === Number(ref.num_serie));
}

// Aplica peso, reps y RIR nuevos sobre esa serie (sin tocar fecha, dolor ni el resto). Devuelve el registro a enviar o null si no la encuentra.
export function editarSerieLocal(series, ref, nuevo) {
  const i = indiceSerie(series, ref);
  if (i < 0) return null;
  const peso = Math.max(0, n(nuevo.peso)), reps = Math.max(0, Math.round(n(nuevo.reps))), rir = Math.max(0, Math.min(3, Math.round(n(nuevo.rir))));
  series[i] = { ...series[i], peso, reps, rir };
  return { sesion_id: ref.sesion_id, ejercicio_id: ref.ejercicio_id, num_serie: Number(ref.num_serie), peso, reps, rir };
}
