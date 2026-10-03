// Tipos de riesgos y prioridades para la aplicación SECUSEO, para que toda la app utilice el mismo formato

export const TIPOS_RIESGO = [
  { value: 'hurto', label: 'Hurto' },
  { value: 'robo', label: 'Robo' },
  { value: 'agresiones_fisicas', label: 'Agresiones físicas' },
  { value: 'vandalismo', label: 'Vandalismo' },
  { value: 'iluminacion', label: 'Poca iluminación' },
  { value: 'accidente', label: 'Accidente de Tránsito' },
  { value: 'consumo_drogas', label: 'Consumo/venta de drogas' },
  { value: 'acoso_callejero', label: 'Acoso callejero' },
  { value: 'extorsion', label: 'Extorsión' },
  { value: 'otro', label: 'Otro' },
]; 
/*
Value = valor tecnico 
Label = valor que se muestra al usuario
*/

//Diccionario para mapear codigos a nombres legibles para mostrar al usuario
const TYPE_LABELS = {
  robo: 'Robo',
  hurto: 'Hurto',
  vandalismo: 'Vandalismo',
  iluminacion: 'Poca iluminación',
  'consumo/venta de drogas': 'Consumo/venta de drogas',
  accidente: 'Accidente de Tránsito',
  agresiones_fisicas: 'Agresiones físicas',
  consumo_drogas: 'Consumo/venta de drogas',
  acoso_callejero: 'Acoso callejero',
  extorsion: 'Extorsión',
  otro: 'Otro',
};

// Función para normalizar un valor de tipo de riesgo a un nombre legible para mostrar al usuario
export function prettyType(raw) {
  if (!raw && raw !== 0) return '';
  const s = String(raw).toLowerCase().trim();
  if (TYPE_LABELS[s]) return TYPE_LABELS[s];
  if (s.includes('ilumin') || s.includes('luz')) return 'Poca iluminación';
  if (s.includes('robo')) return 'Robo';
  if (s.includes('hurto')) return 'Hurto';
  if (s.includes('agresion')) return 'Agresiones físicas';
  if (s.includes('vandal')) return 'Vandalismo';
  if (s.includes('accident')) return 'Accidente de Tránsito';
  if (s.includes('drog')) return 'Consumo/venta de drogas';
  if (s.includes('extorsion')) return 'Extorsión';
  const cleaned = s.replace(/_/g, ' ');
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

//Convierte un valor de prioridad a un nivel legible para mostrar al usuario (Alto, Medio, Bajo) y con este dato se puede asignar un color en el barrio correspondiente
export function mapPriorityToLevel(p) {
  if (!p) return 'Bajo';
  const s = String(p).toLowerCase();
  if (s.includes('alto') || s.includes('3') || s.includes('3.0')) return 'Alto';
  if (s.includes('medio') || s.includes('2') || s.includes('2.0')) return 'Medio';
  if (s.includes('extorsion') || s.includes('violencia') || s.includes('robo')) return 'Alto';
  if (s.includes('ilumin') || s.includes('iluminacion')) return 'Bajo';
  if (s.includes('hurto') || s.includes('vandal')) return 'Medio';
  return 'Bajo';
}


//Normaliza los nombres de los barrios, dejandolos en minusculas y sin espacios al inicio o al final, para que se puedan comparar correctamente
export function normalizeName(name) {
  if (name === undefined || name === null) return '';
  try { return name.toString().trim().toLowerCase(); } catch (e) { return String(name).trim().toLowerCase(); }
}
