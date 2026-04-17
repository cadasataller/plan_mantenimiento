

const OMService = (() => {

  const TABLE = 'ORDEN_MANTENIMIENTO';
  const PK    = 'ID_Orden mantenimiento';

  // ── Convertir fecha US (mm/dd/yyyy) → ISO (yyyy-mm-dd) ─
  function _parsePaDate(val) {
    if (!val || val === '—') return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;   // ya es ISO
    const parts = val.split('/');
    if (parts.length === 3) {
      const [m, d, y] = parts;
      return `${y.padStart(4,'0')}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }
    return null;
  }

  function _formatUSDate(val) {
    if (!val || val === '—') return null;

    // Si viene como ISO: 2026-04-06T00:00:00 -> 2026-04-06
    if (typeof val === 'string' && val.includes('T')) {
      return val.split('T')[0];
    }

    // Si ya viene como fecha simple
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;

    // Si viene con guiones y quieres conservar solo la fecha
    const parts = val.split('-');
    if (parts.length >= 3) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].slice(0, 2).padStart(2, '0')}`;
    }

    return null;
  }

  // ── Calcular ISO week number de una fecha ────────────────
  // Devuelve el número de semana del año (1-53) según ISO 8601.
  function _isoWeek(dateStr) {
    if (!dateStr) return null;

    const s = String(dateStr).slice(0, 10); // toma solo YYYY-MM-DD
    const [y, m, d] = s.split('-').map(Number);
    if (!y || !m || !d) return null;

    const date = new Date(Date.UTC(y, m - 1, d));

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
    const hoy = new Date();
    const hoyFormatted = hoy.toISOString().slice(0, 10);const fechas = {};
    const nuevoEstatus = cambios.estatus;

    // 1. ELIMINAMOS la asignación automática de Fecha de Inicio en "En Proceso".
    // Esa responsabilidad ahora es del usuario al poner "Programado".

    // 2. NUEVO: Limpiamos la fecha de conclusión si la orden está activa o pausada
    if (nuevoEstatus === 'En Proceso' || nuevoEstatus === 'Detenido' || nuevoEstatus === 'Programado') {
        // Le mandamos null o un string vacío para que la BD borre el dato
        fechas['Fecha conclusion'] = null; 
    }

    // 3. Fecha conclusión al pasar a "Concluida"
    if (nuevoEstatus === 'Concluida' && omActual.Estatus !== 'Concluida') {
        fechas['Fecha conclusion'] = hoyFormatted;
    }

    return fechas;
  }

  // ── Construir payload completo para Supabase ─────────────
  function _buildPayload(omActual, cambios, fechasAuto) {
    const payload = {};

    // Estado
    if (cambios.estatus !== undefined) {
      payload['Estatus'] = cambios.estatus;
    }

    // Observaciones
    if (cambios.observaciones !== undefined) {
      payload['Observaciones'] = cambios.observaciones?.trim() || null;
    }

    if (cambios.fechaInicio !== undefined) {
      payload['Fecha inicio'] = _formatUSDate(cambios.fechaInicio?.trim()) || null;
    }

    // Fecha Conclusión
    if (cambios.fechaConclusion !== undefined) {
      payload['Fecha conclusion'] = _formatUSDate(cambios.fechaConclusion?.trim()) || null;
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
      payload['Fecha Entrega'] = _formatUSDate(cambios.fechaEntrega?.trim()) || null;
    }

    // Mezclar fechas automáticas
    for (const [key, val] of Object.entries(fechasAuto)) {
      if (!(key in payload)) payload[key] = val;
    }

    // Semana: se recalcula si hay fecha de inicio en el payload (nueva),
    // o si ya existía en el objeto pero la semana estaba vacía.
    const fechaInicioPayload   = payload['Fecha inicio'];
    const fechaInicioExistente =omActual?.FechaInicio && omActual.FechaInicio !== '—'
                                ? omActual.FechaInicio
                                : null;

    const fechaParaSemana = fechaInicioPayload ?? _parsePaDate(fechaInicioExistente);
    if (fechaParaSemana) {
      const semana = _isoWeek(fechaParaSemana);
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
        omActual.FechaInicio = v || null;
      },
      'Fecha conclusion': (v) => {
        omActual.FechaConclusion = v || null;
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
  async function actualizar(omActual, cambios,updateCache=true) {
    try {

      if (cambios.estatus === 'Concluida') {
        // Obtener las OTs asociadas a esta OM desde el Store
        const ots = OTWorkStore.getOTsByOM(omActual['ID_Orden mantenimiento'] || omActual.ID_Orden);
        
        // Verificar si hay alguna OT que NO esté "Concluida"
        const pendientes = ots.filter(ot => ot.Estatus !== 'Concluida');
        
        if (pendientes.length > 0) {
          return { 
            ok: false, 
            error: `No se puede concluir la OM. Existen ${pendientes.length} órdenes de trabajo pendientes.` 
          };
        }
      }
      
      const fechasAuto = _calcFechasAutomaticas(omActual, cambios);
      const payload = _buildPayload(omActual, cambios, fechasAuto);

      await _updateSupabase(omActual.ID_Orden, payload);
      _syncLocal(omActual, payload);

      if (window.OTStore?.updateLocal && updateCache) {
        OTStore.updateLocal();
      }

      return { ok: true };

    } catch (err) {
      console.error('[OMService] Error al actualizar OM:', err.message);
      return { ok: false, error: err.message };
    }
  }

  return { actualizar };
})();

window.OMService = OMService;