// ============================================================
// CADASA TALLER — OT SERVICE  (v4.1)
// Fix columnas reales del schema:
//   Área, ID_#EQUIPO, ITEM, Sistema, Semana (text)
// ============================================================

const OTService = (() => {

  const TABLE = 'ORDEN_TRABAJO';

  // ─────────────────────────────────────────────
  // Crear nueva OT
  // ─────────────────────────────────────────────
  async function crearOT(omId, data) {
    const db = window.SupabaseClient;
    try {
      const payload = _mapToDB(omId, data);
      console.log('[OTService.crearOT] payload →', payload);

      const { data: inserted, error } = await db
        .from(TABLE)
        .insert([payload])
        .select()
        .single();

      if (error) throw new Error(error.message);

      const nuevaOT = _mapFromDB(inserted);
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
      console.log('[OTService.actualizarOT] id:', id, 'payload →', payload);

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
  // MAPPERS  — nombres de columna exactos del schema
  // ═════════════════════════════════════════════

  function _mapToDB(omId, data) {
    // La columna Fecha es timestamp, Supabase acepta 'yyyy-MM-dd' o ISO
    const fechaISO = data.Fecha
      ? (data.Fecha.length === 10 ? data.Fecha + 'T00:00:00' : data.Fecha)
      : new Date().toISOString();

    return {
      'ID_Orden mantenimiento': String(omId),
      'Descripcion':            data.Descripcion  ?? '',
      'ID_Mecanico':            data.ID_Mecanico  ?? '',
      'Fecha':                  fechaISO,
      'Duración (horas)':       data.Duracion     ?? 0,
      'Estatus':                data.Estatus      ?? 'Programado',
      'Retraso (horas)':        data.Retraso      ?? 0,
      'Causa':                  data.Causa        ?? '',
      'Comentario':             data.Comentario   ?? '',
      'Semana':                 data.Semana != null ? String(data.Semana) : null,
      // Columnas exactas del schema (con tilde y mayúsculas)
      'Área':                   data.Area         ?? '',
      'ID_#EQUIPO':             data.ID_Equipo    ?? '',
      'ITEM':                   data.Item         ?? '',
      'Sistema':                data.Sistema      ?? '',
    };
  }

  function _mapToDBUpdate(data) {
    const out = {};
    if (data.Descripcion !== undefined) out['Descripcion']       = data.Descripcion;
    if (data.ID_Mecanico !== undefined) out['ID_Mecanico']       = data.ID_Mecanico;
    if (data.Fecha       !== undefined) {
      // Normalizar a ISO para columna timestamp
      out['Fecha'] = data.Fecha.length === 10
        ? data.Fecha + 'T00:00:00'
        : data.Fecha;
    }
    if (data.Duracion    !== undefined) out['Duración (horas)']  = data.Duracion;
    if (data.Estatus     !== undefined) out['Estatus']           = data.Estatus;
    if (data.Retraso     !== undefined) out['Retraso (horas)']   = data.Retraso;
    if (data.Causa       !== undefined) out['Causa']             = data.Causa;
    if (data.Comentario  !== undefined) out['Comentario']        = data.Comentario;
    if (data.Semana      !== undefined) out['Semana']            = data.Semana != null ? String(data.Semana) : null;
    if (data.Area        !== undefined) out['Área']              = data.Area;
    if (data.ID_Equipo   !== undefined) out['ID_#EQUIPO']        = data.ID_Equipo;
    if (data.Item        !== undefined) out['ITEM']              = data.Item;
    if (data.Sistema     !== undefined) out['Sistema']           = data.Sistema;
    return out;
  }

  function _mapFromDB(row) {
    // Delegar al store si tiene mapper propio
    if (window.OTWorkStore?._mapRow) {
      return window.OTWorkStore._mapRow(row);
    }

    // Fecha: convertir timestamp a yyyy-MM-dd para mostrar
    let fechaDisplay = row['Fecha'] ?? '';
    if (fechaDisplay && fechaDisplay.length > 10) {
      fechaDisplay = fechaDisplay.slice(0, 10);
    }

    return {
      ID_RowNumber: row['ID_OT'],
      ID_OrdenMant: row['ID_Orden mantenimiento'],
      Descripcion:  row['Descripcion']      ?? '',
      ID_Mecanico:  row['ID_Mecanico']      ?? '',
      Fecha:        fechaDisplay,
      Duracion:     row['Duración (horas)'] ?? 0,
      Estatus:      row['Estatus']          ?? 'Programado',
      Retraso:      row['Retraso (horas)']  ?? 0,
      Causa:        row['Causa']            ?? '',
      Comentario:   row['Comentario']       ?? '',
      Cantidad:     row['Cantidad']         ?? 1,
      Semana:       row['Semana']           ?? null,
      // Mapear de vuelta con nombres internos normalizados
      Area:         row['Área']             ?? '',
      ID_Equipo:    row['ID_#EQUIPO']       ?? '',
      Item:         row['ITEM']             ?? '',
      Sistema:      row['Sistema']          ?? '',
    };
  }

  // ═════════════════════════════════════════════
  // STORE INTEGRATION
  // ═════════════════════════════════════════════

  function _updateStoreCache(omId, nuevaOT) {
    const key   = String(omId);
    const cache = window.OTWorkStore?._getCache?.();
    if (!cache) return;
    const list = cache.get(key) || [];
    cache.set(key, [nuevaOT, ...list]);
    window.OTWorkStore._notify(key);
  }

  function _replaceInCache(updated) {
    const cache = window.OTWorkStore?._getCache?.();
    if (!cache) return;
    cache.forEach((list, key) => {
      const idx = list.findIndex(o => o.ID_RowNumber === updated.ID_RowNumber);
      if (idx !== -1) {
        const newList = [...list];
        newList[idx]  = updated;
        cache.set(key, newList);
        window.OTWorkStore._notify(key);
      }
    });
  }

  function _removeFromCache(id, omId) {
    const cache = window.OTWorkStore?._getCache?.();
    if (!cache) return;
    const key      = String(omId);
    const list     = cache.get(key) || [];
    cache.set(key, list.filter(o => o.ID_RowNumber !== id));
    window.OTWorkStore._notify(key);
  }

  return { crearOT, actualizarOT, eliminarOT };

})();

window.OTService = OTService;