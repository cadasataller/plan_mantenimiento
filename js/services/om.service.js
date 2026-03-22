// ============================================================
// CADASA TALLER — OM SERVICE
// Lógica de negocio para actualización de Órdenes de Mantenimiento.
// Separado del componente modal para mantener responsabilidades claras.
// Depende de: SupabaseClient, OTStore
//
// Campos editables:
//   estatus, observaciones, nSolicitud, nOrdenCompra, fechaEntrega, fechaInicio
//
// Campos calculados automáticamente:
//   TieneSolicitud  → 'Si' si nSolicitud tiene valor, 'No' si está vacío
//   Semana          → ISO week number derivada de fechaInicio
//   Fecha inicio    → se pone al pasar a "En Proceso" si estaba vacía
//   Fecha conclusion→ se pone al pasar a "Concluida"
// ============================================================

const OMService = (() => {

  const TABLE = 'ORDEN_MANTENIMIENTO';
  const PK    = 'ID_Orden mantenimiento';

  // ── Calcular ISO week number de una fecha ────────────────
  // Devuelve el número de semana del año (1-53) según ISO 8601.
  function _isoWeek(dateStr) {
    if (!dateStr) return null;
    const d  = new Date(dateStr);
    if (isNaN(d)) return null;
    // Copiar para no mutar
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    // Jueves de la semana ISO determina el año
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  }

  // ── Derivar TieneSolicitud ───────────────────────────────
  function _derivarTieneSolicitud(nSolicitud) {
    const val = (nSolicitud ?? '').toString().trim();
    return val.length > 0 ? 'Si' : 'No';
  }

  // ── Fechas automáticas por transición de estado ──────────
  function _calcFechasAutomaticas(omActual, cambios) {
    const hoy    = new Date().toISOString().split('T')[0];
    const fechas = {};

    const nuevoEstatus = cambios.estatus;

    // Fecha inicio automática al pasar a "En Proceso" si estaba vacía
    if (
      nuevoEstatus === 'En Proceso' &&
      omActual.Estatus !== 'En Proceso' &&
      (!omActual.FechaInicio || omActual.FechaInicio === '—')
    ) {
      fechas['Fecha inicio'] = hoy;
    }

    // Fecha conclusión al pasar a "Concluida"
    if (nuevoEstatus === 'Concluida' && omActual.Estatus !== 'Concluida') {
      fechas['Fecha conclusion'] = hoy;
    }

    return fechas;
  }

  // ── Construir payload completo para Supabase ─────────────
  function _buildPayload(cambios, fechasAuto) {
    const payload = {};

    // Estado
    if (cambios.estatus !== undefined) {
      payload['Estatus'] = cambios.estatus;
    }

    // Observaciones
    if (cambios.observaciones !== undefined) {
      payload['Observaciones'] = cambios.observaciones?.trim() || null;
    }

    // N° Solicitud → también deriva TieneSolicitud
    if (cambios.nSolicitud !== undefined) {
      const val = cambios.nSolicitud?.trim() || null;
      payload['N° solicitud']              = val;
      payload['Tiene solicitud de compra?'] = val ? true : false;
    }

    // N° Orden de Compra
    if (cambios.nOrdenCompra !== undefined) {
      payload['N° Orden de compra'] = cambios.nOrdenCompra?.trim() || null;
    }

    // Fecha Entrega
    if (cambios.fechaEntrega !== undefined) {
      payload['Fecha Entrega'] = cambios.fechaEntrega?.trim() || null;
    }

    // Mezclar fechas automáticas
    for (const [key, val] of Object.entries(fechasAuto)) {
      if (!(key in payload)) payload[key] = val;
    }

    // Semana: se recalcula si hay una fecha de inicio en el payload
    const fechaInicioFinal = payload['Fecha inicio'];
    if (fechaInicioFinal) {
      const semana = _isoWeek(fechaInicioFinal);
      if (semana !== null) payload['Semana'] = semana;
    }

    return payload;
  }

  // ── Actualizar en Supabase ────────────────────────────────
  async function _updateSupabase(omId, payload) {
    const db = window.SupabaseClient;
    const { error } = await db
      .from(TABLE)
      .update(payload)
      .eq(PK, String(omId));
    if (error) throw new Error(error.message);
  }

  // ── Sincronizar objeto local y OTStore ────────────────────
  function _syncLocal(omActual, payload) {

    const map = {
      'Estatus':                     (v) => { omActual.Estatus          = v; },
      'Observaciones':               (v) => { omActual.Observaciones     = v; },
      'N° solicitud':                (v) => { omActual.NSolicitud         = v; },
      'N° Orden de compra':          (v) => { omActual.NOrdenCompra       = v; },
      'Fecha Entrega':               (v) => { omActual.FechaEntrega       = v; },
      'Tiene solicitud de compra?':  (v) => { omActual.TieneSolicitud     = v ? 'Si' : 'No'; },
      'Semana':                      (v) => { omActual.Semana             = v; },
      'Fecha inicio': (v) => {
        omActual.FechaInicio = v
          ? new Date(v + 'T00:00:00').toLocaleDateString('es-PA')
          : null;
      },
      'Fecha conclusion': (v) => {
        omActual.FechaConclusion = v
          ? new Date(v + 'T00:00:00').toLocaleDateString('es-PA')
          : null;
      },
    };

    // Aplicar sobre el objeto actual
    for (const [key, setter] of Object.entries(map)) {
      if (key in payload) setter(payload[key]);
    }

    // Propagar al array del store
    const allOMs = OTStore.getAll();
    const idx    = allOMs.findIndex(o => o.ID_Orden === omActual.ID_Orden);
    if (idx !== -1) {
      Object.assign(allOMs[idx], {
        Estatus:          omActual.Estatus,
        Observaciones:    omActual.Observaciones,
        NSolicitud:       omActual.NSolicitud,
        NOrdenCompra:     omActual.NOrdenCompra,
        FechaEntrega:     omActual.FechaEntrega,
        TieneSolicitud:   omActual.TieneSolicitud,
        Semana:           omActual.Semana,
        FechaInicio:      omActual.FechaInicio,
        FechaConclusion:  omActual.FechaConclusion,
      });
    }
  }

  // ══════════════════════════════════════════════════════════
  // API PÚBLICA
  // ══════════════════════════════════════════════════════════

  /**
   * Actualiza una OM: persiste en Supabase y sincroniza el estado local.
   *
   * @param {object} omActual - Objeto OM actual (se muta in-place)
   * @param {object} cambios  - {
   *   estatus?, observaciones?,
   *   nSolicitud?, nOrdenCompra?, fechaEntrega?
   * }
   * @returns {Promise<{ ok: boolean, error?: string }>}
   */
  async function actualizar(omActual, cambios) {
    try {
      const fechasAuto = _calcFechasAutomaticas(omActual, cambios);
      const payload    = _buildPayload(cambios, fechasAuto);

      await _updateSupabase(omActual.ID_Orden, payload);
      _syncLocal(omActual, payload);

      return { ok: true };

    } catch (err) {
      console.error('[OMService] Error al actualizar OM:', err.message);
      return { ok: false, error: err.message };
    }
  }

  return { actualizar };
})();

window.OMService = OMService;