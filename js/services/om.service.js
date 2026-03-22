// ============================================================
// CADASA TALLER — OM SERVICE
// Lógica de negocio para actualización de Órdenes de Mantenimiento.
// Separado del componente modal para mantener responsabilidades claras.
// Depende de: SupabaseClient, OTStore
// ============================================================

const OMService = (() => {

  // Nombre de la tabla en Supabase
  const TABLE = 'ORDEN_MANTENIMIENTO';
  const PK    = 'ID_Orden mantenimiento';

  // ── Lógica de fechas automáticas ──────────────────────────
  // Retorna un objeto con los campos de fecha que deben actualizarse
  // según la transición de estado. No modifica nada, solo calcula.
  function _calcFechasAutomaticas(omActual, nuevoEstatus) {
    const hoy    = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const fechas = {};

    // Cambia a "En Proceso" por primera vez → poner FechaInicio si está vacía
    if (
      nuevoEstatus === 'En Proceso' &&
      omActual.Estatus !== 'En Proceso' &&
      (!omActual.FechaInicio || omActual.FechaInicio === '—')
    ) {
      fechas['Fecha inicio'] = hoy;
    }

    // Cambia a "Concluida" → poner FechaConclusion siempre
    if (nuevoEstatus === 'Concluida' && omActual.Estatus !== 'Concluida') {
      fechas['Fecha conclusion'] = hoy;
    }

    return fechas;
  }

  // ── Construir payload para Supabase ──────────────────────
  function _buildPayload(cambios, fechasAuto) {
    const payload = {};

    if (cambios.estatus !== undefined) {
      payload['Estatus'] = cambios.estatus;
    }

    if (cambios.observaciones !== undefined) {
      payload['Observaciones'] = cambios.observaciones || null;
    }

    // Mezclar fechas automáticas
    Object.assign(payload, fechasAuto);

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

  // ── Sincronizar objeto local y OTStore en memoria ─────────
  function _syncLocal(omActual, payload) {
    // Actualizar propiedades del objeto OM en memoria
    if (payload['Estatus'] !== undefined) {
      omActual.Estatus = payload['Estatus'];
    }

    if (payload['Observaciones'] !== undefined) {
      omActual.Observaciones = payload['Observaciones'];
    }

    if (payload['Fecha inicio']) {
      omActual.FechaInicio = new Date(payload['Fecha inicio']).toLocaleDateString('es-PA');
    }

    if (payload['Fecha conclusion']) {
      omActual.FechaConclusion = new Date(payload['Fecha conclusion']).toLocaleDateString('es-PA');
    }

    // Propagar al store global
    const allOMs = OTStore.getAll();
    const idx    = allOMs.findIndex(o => o.ID_Orden === omActual.ID_Orden);

    if (idx !== -1) {
      if (payload['Estatus'] !== undefined)      allOMs[idx].Estatus        = omActual.Estatus;
      if (payload['Observaciones'] !== undefined) allOMs[idx].Observaciones  = omActual.Observaciones;
      if (payload['Fecha inicio'])               allOMs[idx].FechaInicio    = omActual.FechaInicio;
      if (payload['Fecha conclusion'])           allOMs[idx].FechaConclusion = omActual.FechaConclusion;
    }
  }

  // ══════════════════════════════════════════════════════════
  // API PÚBLICA
  // ══════════════════════════════════════════════════════════

  /**
   * Actualiza una OM: persiste en Supabase y sincroniza el estado local.
   *
   * @param {object} omActual   - Objeto OM actual (se muta con los nuevos valores)
   * @param {object} cambios    - { estatus?, observaciones? }
   * @returns {Promise<{ ok: boolean, error?: string }>}
   */
  async function actualizar(omActual, cambios) {
    try {
      const fechasAuto = _calcFechasAutomaticas(omActual, cambios.estatus);
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