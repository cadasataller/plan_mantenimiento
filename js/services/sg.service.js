const SGService = (() => {
  const db = window.SupabaseClient;
  
  // ── CACHÉ LOCAL ───────────────────────────────────────────────
  let _sgCache = []; 

  // Obtener todas las SG (Utiliza caché si ya existen, a menos que se fuerce)
  async function fetchSGs(forceRefresh = false) {
    if (!forceRefresh && _sgCache.length > 0) {
      return _sgCache;
    }

    const { data, error } = await db
      .from('OM_SG')
      .select(`
        *,
        fecha_solicitud::timestamptz,
        ORDEN_MANTENIMIENTO (*)
      `)
      .order('fecha_solicitud', { ascending: false });

    if (error) {
      console.error('[SGService] Error fetchSGs:', error);
      return [];
    }

    const dataFormateada = data.map(row => ({
        ...row,
        fecha_solicitud: new Date(row.fecha_solicitud).toLocaleString('es-PA', {
          timeZone: 'America/Panama',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
    }));

    // Guardar en caché
    _sgCache = dataFormateada;
    return _sgCache;
  }

  // Actualizar una SG en Base de Datos y Caché
  async function updateSG(id_sg, id_orden_base, editState, perms) {
    try {
      const omPayload = {};
      const sgPayload = {};

      // 1. Armar payload de la tabla base según permisos
      if (perms.statusObs || perms.all) {
        omPayload.Estatus = editState.estatus;
        omPayload.Observaciones = editState.observaciones;
        omPayload['Fecha inicio'] = editState.fecha_inicio || null;
        omPayload['Fecha conclusion'] = editState.fecha_conclusion || null;
        omPayload.Semana = editState.semana || null;
      }

      // 2. Armar payload extendido según permisos totales
      if (perms.all) {
        omPayload['Fecha Entrega'] = editState.fecha_entrega || null;
        omPayload['Tiene solicitud de compra?'] = editState.tiene_compra === 'true';
        omPayload['N° solicitud'] = editState.n_solicitud || null;
        omPayload['N° Orden de compra'] = editState.n_oc || null;

        sgPayload.tipo_trabajo = editState.tipo_trabajo || null;
        sgPayload.estimacion_horas = parseInt(editState.estimacion_horas, 10) || null;
        sgPayload.solicitar_personal = editState.solicitar_personal || null;
        sgPayload.fecha_entrega = editState.fecha_entrega || null;
      }

      // 3. Ejecutar actualizaciones en paralelo
      const tasks = [];
      if (Object.keys(omPayload).length > 0) {
        tasks.push(db.from('ORDEN_MANTENIMIENTO').update(omPayload).eq('ID_Orden mantenimiento', id_orden_base));
      }
      if (Object.keys(sgPayload).length > 0) {
        tasks.push(db.from('OM_SG').update(sgPayload).eq('id_sg', id_sg));
      }

      const results = await Promise.all(tasks);
      
      for (let res of results) {
        if (res.error) throw res.error;
      }

      // 4. Actualizar la caché local para no tener que recargar
      const cacheIndex = _sgCache.findIndex(item => item.id_sg === id_sg);
      if (cacheIndex !== -1) {
        const cachedItem = _sgCache[cacheIndex];
        
        if (Object.keys(omPayload).length > 0) {
          cachedItem.ORDEN_MANTENIMIENTO = { ...cachedItem.ORDEN_MANTENIMIENTO, ...omPayload };
        }
        if (Object.keys(sgPayload).length > 0) {
          Object.assign(cachedItem, sgPayload);
        }
        
        _sgCache[cacheIndex] = cachedItem;
      }

      return { ok: true, data: _sgCache[cacheIndex] };
    } catch (err) {
      console.error('[SGService] Error updateSG:', err);
      return { ok: false, error: err };
    }
  }

  // Crear una SG Manual (Crea la base en ORDEN_MANTENIMIENTO y luego el detalle en OM_SG)
  async function createManualSG(baseData, sgData) {
    try {
      baseData.IS_SG = true;
      
      const { data: baseResult, error: baseError } = await db
        .from('ORDEN_MANTENIMIENTO')
        .insert([baseData])
        .select()
        .single();

      if (baseError) throw baseError;

      sgData.id_orden_base = baseResult['ID_Orden mantenimiento'];

      const { data: sgResult, error: sgError } = await db
        .from('OM_SG')
        .insert([sgData])
        .select()
        .single();

      if (sgError) {
        await db.from('ORDEN_MANTENIMIENTO').delete().eq('ID_Orden mantenimiento', baseData['ID_Orden mantenimiento']);
        throw sgError;
      }

      const nuevaSG = { 
        ...sgResult, 
        ORDEN_MANTENIMIENTO: baseResult,
        fecha_solicitud: new Date().toLocaleString('es-PA', { timeZone: 'America/Panama' }) 
      };

      // Inyectar en caché al principio de la lista
      _sgCache.unshift(nuevaSG);

      return { ok: true, data: nuevaSG };
    } catch (err) {
      console.error('[SGService] Error createManualSG:', err);
      return { ok: false, error: err };
    }
  }

  function generarIdMantenimiento({ area, equipo, item, sistema }) {
    const getFirst = (str) => (str || '').charAt(0).toUpperCase();
    const prefijo = `SG-${getFirst(area)}${getFirst(equipo)}${getFirst(item)}${getFirst(sistema)}`;
    const now = new Date();
    const fecha = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    return `${prefijo}-${fecha}`;
  }

  // Devolver la caché directamente si otros componentes la necesitan
  function getCache() {
    return _sgCache;
  }

  return { fetchSGs, updateSG, createManualSG, generarIdMantenimiento, getCache };
})();

window.SGService = SGService;