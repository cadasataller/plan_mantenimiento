const SGService = (() => {
  const db = window.SupabaseClient;

  // Obtener todas las SG junto con su orden base
  async function fetchSGs() {
    const { data, error } = await db
      .from('OM_SG')
      .select(`
        *,
        ORDEN_MANTENIMIENTO (*)
      `)
      .order('fecha_solicitud', { ascending: false });

    if (error) {
      console.error('[SGService] Error fetchSGs:', error);
      return [];
    }
    return data;
  }

  // Crear una SG Manual (Crea la base en ORDEN_MANTENIMIENTO y luego el detalle en OM_SG)
  async function createManualSG(baseData, sgData) {
    try {
      // 1. Forzar IS_SG en la base
      baseData.IS_SG = true;

      // 2. Insertar en ORDEN_MANTENIMIENTO
      const { data: baseResult, error: baseError } = await db
        .from('ORDEN_MANTENIMIENTO')
        .insert([baseData])
        .select()
        .single();

      if (baseError) throw baseError;

      // 3. Vincular el ID y la fecha/hora de registro en SG
      sgData.id_orden_base = baseResult['ID_Orden mantenimiento'];
      sgData.fecha_solicitud = new Date().toISOString().split('T')[0]; // Fecha actual local
      sgData.hora_registro = new Date().toTimeString().split(' ')[0]; // Hora actual local

      // 4. Insertar en OM_SG
      const { data: sgResult, error: sgError } = await db
        .from('OM_SG')
        .insert([sgData])
        .select()
        .single();

      if (sgError) {
        // Fallback: Si falla el detalle, idealmente se debería borrar la base (compensación manual)
        await db.from('ORDEN_MANTENIMIENTO').delete().eq('ID_Orden mantenimiento', baseData['ID_Orden mantenimiento']);
        throw sgError;
      }

      return { ok: true, data: { ...sgResult, ORDEN_MANTENIMIENTO: baseResult } };
    } catch (err) {
      console.error('[SGService] Error createManualSG:', err);
      return { ok: false, error: err };
    }
  }

  return { fetchSGs, createManualSG };
})();

window.SGService = SGService;