const SGService = (() => {
  const db = window.SupabaseClient;
  
  // ── CACHÉ LOCAL ───────────────────────────────────────────────
  let _sgCache = []; 

  // 1. OBTENER Y CARGAR INFORMACIÓN (fetchSGs)
  async function fetchSGs(forceRefresh = false) {
    if (!forceRefresh && _sgCache.length > 0) {
      return _sgCache;
    }

    const user = window.AuthService?.getUser() || {};
    const uArea = String(user.Area || user.area || user.Área || '').trim().toUpperCase();

    // Traemos todo de OM_SG (raíz) y anidamos ORDEN_MANTENIMIENTO
    let query = db
      .from('OM_SG')
      .select(`
        *,
        fecha_solicitud::timestamptz,
        ORDEN_MANTENIMIENTO!inner (*)
      `)
      .order('fecha_solicitud', { ascending: false });

    if (uArea !== 'ALL' && uArea !== 'SERVICIOS GENERALES') {
      query = query.ilike('ORDEN_MANTENIMIENTO.Área', uArea);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[SGService] Error fetchSGs:', error);
      return [];
    }

    const dataFormateada = data.map(row => ({
        ...row,
        fecha_solicitud: new Date(row.fecha_solicitud).toLocaleString('es-PA', {
          timeZone: 'America/Panama',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        })
    }));

    _sgCache = dataFormateada;
    return _sgCache;
  }

  // 2. GUARDAR Y ACTUALIZAR INFORMACIÓN (updateSG)
  async function updateSG(id_sg, id_orden_base, editState, perms) {
    try {
      const omPayload = {};
      const sgPayload = {};

      // A. Permisos básicos (Estatus y Fechas de ejecución van 100% a OM_SG)
      if (perms.statusObs) {
        sgPayload['Estatus'] = editState.estatus || null;
        sgPayload['Observaciones'] = editState.observaciones || null;
        sgPayload['Fecha conclusion'] = editState.fecha_conclusion || null;
        sgPayload.semana = editState.semana || null;
        sgPayload.fecha_ejecucion = editState.fecha_ejecucion || null; 
        if (editState.dias !== undefined) {
          sgPayload.dias = editState.dias;
        }
      }

      // B. Permisos de gestión (Trabajo y Compras)
      if (perms.all || perms.godMode) {
        // Compras se queda en la orden base
        omPayload['Tiene solicitud de compra?'] = editState.tiene_compra === 'true';
        omPayload['N° solicitud'] = editState.n_solicitud || null;
        omPayload['N° Orden de compra'] = editState.n_oc || null;

        // Gestión de SG va a OM_SG
        sgPayload.tipo_trabajo = editState.tipo_trabajo || null;
        sgPayload.estimacion_horas = parseInt(editState.estimacion_horas, 10) || null;
        sgPayload.solicitar_personal = editState.solicitar_personal || null;
        sgPayload.fecha_entrega = editState.fecha_entrega || null; 
      }

      // C. God Mode (Info Core del Equipo en ORDEN_MANTENIMIENTO)
      if (perms.godMode) {
        omPayload['Área'] = editState.area_om || null;
        omPayload['ID_#EQUIPO'] = editState.equipo || null;
        omPayload['ITEM'] = editState.item || null;
        omPayload['Sistema'] = editState.sistema || null;
        omPayload['Descripcion'] = editState.descripcion || null;
      }

      if (Object.keys(omPayload).length === 0 && Object.keys(sgPayload).length === 0) {
         return { ok: false, error: 'Sin permisos para editar.' };
      }

      const tasks = [];
      
      if (Object.keys(omPayload).length > 0) {
        tasks.push(
          db.from('ORDEN_MANTENIMIENTO')
            .update(omPayload)
            .eq('ID_Orden mantenimiento', id_orden_base)
            .select() 
        );
      }
      
      if (Object.keys(sgPayload).length > 0) {
        tasks.push(
          db.from('OM_SG')
            .update(sgPayload)
            .eq('id_sg', id_sg)
            .select() 
        );
      }

      const results = await Promise.all(tasks);
      
      for (let res of results) {
        if (res.error) throw res.error;
      }

      // D. ACTUALIZAR CACHÉ (Fusionamos los payloads directamente en memoria)
      const cacheIndex = _sgCache.findIndex(item => item.id_sg === id_sg);
      if (cacheIndex !== -1) {
        const cachedItem = _sgCache[cacheIndex];
        
        // Lo que es de OM_SG va a la raíz del objeto
        if (Object.keys(sgPayload).length > 0) {
          Object.assign(cachedItem, sgPayload);
        }
        
        // Lo que es de ORDEN_MANTENIMIENTO va al objeto anidado
        if (Object.keys(omPayload).length > 0) {
          cachedItem.ORDEN_MANTENIMIENTO = { ...cachedItem.ORDEN_MANTENIMIENTO, ...omPayload };
        }
        
        _sgCache[cacheIndex] = cachedItem;
      }

      return { ok: true, data: _sgCache[cacheIndex] };
      
    } catch (err) {
      console.error('[SGService] Error updateSG:', err);
      return { ok: false, error: err.message || err };
    }
  }

  // 3. CREAR SG MANUAL
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

      _sgCache.unshift(nuevaSG);
      return { ok: true, data: nuevaSG };
    } catch (err) {
      console.error('[SGService] Error createManualSG:', err);
      return { ok: false, error: err };
    }
  }

  // 4. CREAR SG AUTOMÁTICA
  async function createAutoSG(id_orden_existente, sgData) {
    try {
      sgData.id_orden_base = id_orden_existente;

      const { data: sgResult, error: sgError } = await db
        .from('OM_SG')
        .insert([sgData])
        .select()
        .single();

      if (sgError) throw sgError;

      await db.from('ORDEN_MANTENIMIENTO')
        .update({ IS_SG: true })
        .eq('ID_Orden mantenimiento', id_orden_existente);

      const { data: baseResult } = await db
        .from('ORDEN_MANTENIMIENTO')
        .select('*')
        .eq('ID_Orden mantenimiento', id_orden_existente)
        .single();

      const nuevaSG = { 
        ...sgResult, 
        ORDEN_MANTENIMIENTO: baseResult || {},
        fecha_solicitud: new Date().toLocaleString('es-PA', { timeZone: 'America/Panama' }) 
      };

      _sgCache.unshift(nuevaSG);
      return { ok: true, data: nuevaSG };
    } catch (err) {
      console.error('[SGService] Error createAutoSG:', err);
      return { ok: false, error: err };
    }
  }

  // UTILIDADES
  function generarIdMantenimiento({ area, equipo, item, sistema }) {
    const getFirst = (str) => (str || '').charAt(0).toUpperCase();
    const prefijo = `SG-${getFirst(area)}${getFirst(equipo)}${getFirst(item)}${getFirst(sistema)}`;
    const now = new Date();
    const fecha = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    return `${prefijo}-${fecha}`;
  }

  function getCache() {
    return _sgCache;
  }

  // 5. CONCLUIR SG RÁPIDO (Optimizado para el botón de conclusión rápida)
  async function quickConcluirSG(id_sg, cambios) {
    try {
      // Preparar payload minimalista: solo los campos esenciales
      const payload = {
        Estatus: cambios.estatus || 'Concluida',
        'Fecha conclusion': cambios.fecha_conclusion,
        fecha_ejecucion: cambios.fecha_ejecucion,
        semana: cambios.semana || null
      };

      // Agregar dias si se calculó
      if (cambios.dias !== undefined) {
        payload.dias = cambios.dias;
      }

      const { data, error } = await db
        .from('OM_SG')
        .update(payload)
        .eq('id_sg', id_sg)
        .select()
        .single();

      if (error) throw error;

      // Actualizar caché local
      const cacheIndex = _sgCache.findIndex(item => item.id_sg === id_sg);
      if (cacheIndex !== -1) {
        Object.assign(_sgCache[cacheIndex], payload);
      }

      return { ok: true, data: _sgCache[cacheIndex] || data };
    } catch (err) {
      console.error('[SGService] Error quickConcluirSG:', err);
      return { ok: false, error: err.message || err };
    }
  }

  // 6. ACTUALIZACIÓN LIGERA DIRECTA (Ideal para cambios de estado rápidos)
  async function actualizarEstado(id_sg, payload) {
    try {
      const { data, error } = await db
        .from('OM_SG')
        .update(payload)
        .eq('id_sg', id_sg)
        .select()
        .single();

      if (error) throw error;

      // Actualizar el caché local para que la UI no pierda sincronía
      const cacheIndex = _sgCache.findIndex(item => item.id_sg === id_sg);
      if (cacheIndex !== -1) {
        Object.assign(_sgCache[cacheIndex], payload);
      }

      return { ok: true, data: data };
    } catch (err) {
      console.error('[SGService] Error actualizarEstado:', err);
      return { ok: false, error: err.message || err };
    }
  }

  return { fetchSGs, updateSG, createManualSG, generarIdMantenimiento, getCache, createAutoSG, quickConcluirSG, actualizarEstado };
})();

window.SGService = SGService;