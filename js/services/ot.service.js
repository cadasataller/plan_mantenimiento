// ============================================================
// CADASA TALLER — OT SERVICE
// Maneja CRUD de Órdenes de Trabajo (backend + store)
// ============================================================

const OTService = (() => {

  const TABLE = 'ORDEN_TRABAJO';

  // ─────────────────────────────────────────────
  // Crear nueva OT
  // ─────────────────────────────────────────────
  async function crearOT(omId, data) {
    const db = window.SupabaseClient;

    try {
      // 1. Mapear a formato DB
      const payload = _mapToDB(omId, data);

      // 2. Insertar en Supabase
      const { data: inserted, error } = await db
        .from(TABLE)
        .insert([payload])
        .select()
        .single();

      if (error) throw new Error(error.message);

      // 3. Mapear a formato UI (usar mismo mapper del store)
      const nuevaOT = _mapFromDB(inserted);

      // 4. Actualizar cache del store
      _updateStoreCache(omId, nuevaOT);

      return { ok: true, data: nuevaOT };

    } catch (err) {
      console.error('[OTService.crearOT]', err);
      return { ok: false, error: err.message };
    }
  }

  // ─────────────────────────────────────────────
  // Actualizar OT
  // ─────────────────────────────────────────────
  async function actualizarOT(id, cambios) {
    const db = window.SupabaseClient;

    try {
      const payload = _mapToDBUpdate(cambios);

      const { data, error } = await db
        .from(TABLE)
        .update(payload)
        .eq('ID_OT', id)
        .select()
        .single();

      if (error) throw new Error(error.message);

      const updated = _mapFromDB(data);

      _replaceInCache(updated);

      return { ok: true, data: updated };

    } catch (err) {
      console.error('[OTService.actualizarOT]', err);
      return { ok: false, error: err.message };
    }
  }

  // ─────────────────────────────────────────────
  // Eliminar OT
  // ─────────────────────────────────────────────
  async function eliminarOT(id, omId) {
    const db = window.SupabaseClient;

    try {
      const { error } = await db
        .from(TABLE)
        .delete()
        .eq('ID_OT', id);

      if (error) throw new Error(error.message);

      _removeFromCache(id, omId);

      return { ok: true };

    } catch (err) {
      console.error('[OTService.eliminarOT]', err);
      return { ok: false, error: err.message };
    }
  }

  // ═════════════════════════════════════════════
  // MAPPERS
  // ═════════════════════════════════════════════

  function _mapToDB(omId, data) {
    return {
      'ID_Orden mantenimiento': String(omId),
      'Descripcion': data.Descripcion ?? '',
      'ID_Mecanico': data.ID_Mecanico ?? '',
      'Fecha': data.Fecha || new Date().toISOString(),
      'Duración (horas)': data.Duracion ?? 0,
      'Estatus': data.Estatus ?? 'Programado',
      'Retraso (horas)': 0,
      'Cantidad': 1,
    };
  }

  function _mapToDBUpdate(data) {
    const out = {};

    if (data.Descripcion !== undefined) out['Descripcion'] = data.Descripcion;
    if (data.ID_Mecanico !== undefined) out['ID_Mecanico'] = data.ID_Mecanico;
    if (data.Fecha !== undefined) out['Fecha'] = data.Fecha;
    if (data.Duracion !== undefined) out['Duración (horas)'] = data.Duracion;
    if (data.Estatus !== undefined) out['Estatus'] = data.Estatus;

    return out;
  }

  function _mapFromDB(row) {
    // Reutiliza el mapper del store si existe
    if (window.OTWorkStore && window.OTWorkStore._mapRow) {
      return window.OTWorkStore._mapRow(row);
    }

    // fallback
    return {
      ID_RowNumber: row['ID_OT'],
      ID_OrdenMant: row['ID_Orden mantenimiento'],
      Descripcion: row['Descripcion'],
      ID_Mecanico: row['ID_Mecanico'],
      Fecha: row['Fecha'],
      Duracion: row['Duración (horas)'],
      Estatus: row['Estatus'],
      Retraso: row['Retraso (horas)'] || 0,
      Cantidad: row['Cantidad'] || 1,
    };
  }

  // ═════════════════════════════════════════════
  // STORE INTEGRATION
  // ═════════════════════════════════════════════

  function _updateStoreCache(omId, nuevaOT) {
    const key = String(omId);

    // Acceso interno (necesitamos exponer helpers en el store)
    if (!window.OTWorkStore._getCache) return;

    const cache = window.OTWorkStore._getCache();
    const list = cache.get(key) || [];

    list.unshift(nuevaOT); // 👉 arriba de la lista
    cache.set(key, list);

    window.OTWorkStore._notify(key);
  }

  function _replaceInCache(updated) {
    const cache = window.OTWorkStore._getCache?.();
    if (!cache) return;

    cache.forEach((list, key) => {
      const idx = list.findIndex(o => o.ID_RowNumber === updated.ID_RowNumber);
      if (idx !== -1) {
        list[idx] = updated;
        window.OTWorkStore._notify(key);
      }
    });
  }

  function _removeFromCache(id, omId) {
    const cache = window.OTWorkStore._getCache?.();
    if (!cache) return;

    const key = String(omId);
    const list = cache.get(key) || [];

    const filtered = list.filter(o => o.ID_RowNumber !== id);
    cache.set(key, filtered);

    window.OTWorkStore._notify(key);
  }

  return {
    crearOT,
    actualizarOT,
    eliminarOT
  };

})();

window.OTService = OTService;