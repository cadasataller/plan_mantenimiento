// ============================================================
// CADASA TALLER — GOOGLE SHEETS DATA SERVICE
// Lee datos de Google Sheets (API pública por Sheet ID)
// ============================================================

const SheetsService = (() => {

  // ── CONFIGURAR AQUÍ ──────────────────────────────────────
  // ID del Google Spreadsheet (URL: /spreadsheets/d/{SHEET_ID}/...)
  // La hoja debe ser pública: Compartir → Cualquier persona con el enlace
  const SHEET_ID    = '1iiZaNbTXstSEDnLT7dTzQomyzYZ5zV9qiNANasNeT6E';

  // Nombre de cada hoja dentro del spreadsheet (una por área)
  // El servicio intentará leer cada una y unir los resultados
  const SHEET_NAMES = [
    'ORDEN_MANTENIMIENTO'
  ];

  // Índice de columnas (0-based) — ajustar si cambia el orden en Sheets
  const COL = {
    ID_Orden:        0,
    Area:            1,
    ID_EQUIPO:       2,
    ITEM:            3,
    Sistema:         4,
    Descripcion:     5,
    TipoProceso:     6,
    Estatus:         7,
    FechaInicio:     8,
    Columna1:        9,  // ignorada
    FechaConclusion: 10,
    TieneSolicitud:  11,
    NSolicitud:      12,
    NOrdenCompra:    13,
    FechaEntrega:    14,
    Observaciones:   15,
    Semana:          16,
    Cantidad:        17,
    Etapa:           18,
  };
  // ────────────────────────────────────────────────────────

  const BASE = 'https://docs.google.com/spreadsheets/d';

  /**
   * Descarga una hoja como CSV y parsea sus filas
   * @param {string} sheetName
   * @returns {Promise<object[]>}
   */
  async function fetchSheet(sheetName) {
  const token = window.AuthService?.getAccessToken();

  if (!token) {
    throw new Error('No hay access token. Usuario no autenticado.');
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(sheetName)}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (res.status === 401 || res.status === 403) {
    console.warn('[Sheets] Token expirado. Renovando...');
    window.AuthService?.requestAccessToken();
    throw new Error('Token expirado');
  }

  if (!res.ok) {
    throw new Error(`Error ${res.status} leyendo hoja`);
  }

  const data = await res.json();

  return parseRows(data.values);
}

  /**
   * Lee todas las hojas configuradas y devuelve un array unificado
   * @returns {Promise<object[]>}
   */
  async function fetchAll() {
    const results = await Promise.allSettled(
      SHEET_NAMES.map(name => fetchSheet(name))
    );

    const rows = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        rows.push(...r.value);
      } else {
        console.warn(`[Sheets] No se pudo leer hoja "${SHEET_NAMES[i]}":`, r.reason);
      }
    });

    return rows;
  }

  /**
   * Parsea un CSV con cabecera, salta la primera fila si es el header
   * @param {string} text  CSV raw
   * @returns {object[]}
   */
 function parseRows(rows) {
  if (!rows || rows.length < 2) return [];

  const result = [];

  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i];

    if (!cols[COL.ID_Orden]?.trim()) continue;

    const raw = {
      ID_Orden:        clean(cols[COL.ID_Orden]),
      Area:            clean(cols[COL.Area]),
      ID_EQUIPO:       clean(cols[COL.ID_EQUIPO]),
      ITEM:            clean(cols[COL.ITEM]),
      Sistema:         clean(cols[COL.Sistema]),
      Descripcion:     clean(cols[COL.Descripcion]),
      TipoProceso:     clean(cols[COL.TipoProceso]),
      Estatus:         clean(cols[COL.Estatus]) || 'Programado',
      FechaInicio:     clean(cols[COL.FechaInicio]),
      FechaConclusion: clean(cols[COL.FechaConclusion]),
      TieneSolicitud:  clean(cols[COL.TieneSolicitud]),
      NSolicitud:      clean(cols[COL.NSolicitud]),
      NOrdenCompra:    clean(cols[COL.NOrdenCompra]),
      FechaEntrega:    clean(cols[COL.FechaEntrega]),
      Observaciones:   clean(cols[COL.Observaciones]),
      Semana:          parseSemana(cols[COL.Semana], cols[COL.FechaInicio]),
      Cantidad:        clean(cols[COL.Cantidad]),
      Etapa:           clean(cols[COL.Etapa]),
    };

    result.push(raw);
  }

  return result;
}
  /**
   * Calcula semana: usa la columna si existe, sino la calcula desde FechaInicio
   */
  function parseSemana(semanaCol, fechaCol) {
    const s = clean(semanaCol);
    if (s) return parseInt(s, 10) || null;

    const f = clean(fechaCol);
    if (!f) return null;

    try {
      const d = new Date(f);
      if (isNaN(d)) return null;
      return getISOWeek(d);
    } catch (_) { return null; }
  }

  function getISOWeek(d) {
    const date = new Date(d);
    date.setHours(0,0,0,0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  }

  /** Divide una línea CSV respetando celdas con comas entre comillas */
  function splitCSVLine(line) {
    const result = [];
    let cur = '';
    let inQ  = false;
    for (let c of line) {
      if (c === '"') { inQ = !inQ; continue; }
      if (c === ',' && !inQ) { result.push(cur); cur = ''; continue; }
      cur += c;
    }
    result.push(cur);
    return result;
  }

  function clean(val) {
    return (val ?? '').trim();
  }

  return { fetchAll, fetchSheet };
})();

window.SheetsService = SheetsService;
