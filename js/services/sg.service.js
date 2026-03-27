const SGService = (() => {
  const db = window.SupabaseClient;
  
  // ── CACHÉ LOCAL ───────────────────────────────────────────────
  let _sgCache = []; 

  // Obtener todas las SG (Utiliza caché si ya existen, a menos que se fuerce)
  // Obtener todas las SG (Utiliza caché si ya existen, a menos que se fuerce)
  async function fetchSGs(forceRefresh = false) {
    if (!forceRefresh && _sgCache.length > 0) {
      return _sgCache;
    }

    // 1. Obtenemos el área del usuario logueado
    const user = window.AuthService?.getUser() || {};
    const uArea = String(user.Area || user.area || user.Área || '').trim().toUpperCase();

    // 2. Preparamos la consulta base. 
    // OJO al !inner: Es vital para poder filtrar por una columna de la tabla unida.
    let query = db
      .from('OM_SG')
      .select(`
        *,
        fecha_solicitud::timestamptz,
        ORDEN_MANTENIMIENTO!inner (*)
      `)
      .order('fecha_solicitud', { ascending: false });

    // 3. Aplicamos el filtro si NO es ALL y NO es SERVICIOS GENERALES
    if (uArea !== 'ALL' && uArea !== 'SERVICIOS GENERALES') {
      // Usamos .ilike para ignorar mayúsculas/minúsculas y evitar problemas de tipeo
      query = query.ilike('ORDEN_MANTENIMIENTO.Área', uArea);
    }

    // 4. Ejecutamos la consulta
    const { data, error } = await query;

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
  // Actualizar una SG en Base de Datos y Caché
  async function updateSG(id_sg, id_orden_base, editState, perms) {
    try {
      console.log('--- INICIANDO UPDATE DB ---');
      console.log('ID SG:', id_sg);
      console.log('ID Base:', id_orden_base);
      console.log('Permisos aplicados:', perms);

      const omPayload = {};
      const sgPayload = {};

      // 1. Permisos básicos (o heredados por ser Dios)
      if (perms.statusObs || perms.all || perms.godMode) {
        omPayload.Estatus = editState.estatus;
        omPayload.Observaciones = editState.observaciones;
        omPayload['Fecha inicio'] = editState.fecha_inicio || null;
        omPayload['Fecha conclusion'] = editState.fecha_conclusion || null;
        omPayload.Semana = editState.semana || null;
      }

      // 2. Permisos totales o Dios
      if (perms.all || perms.godMode) {
        omPayload['Fecha Entrega'] = editState.fecha_entrega || null;
        omPayload['Tiene solicitud de compra?'] = editState.tiene_compra === 'true';
        omPayload['N° solicitud'] = editState.n_solicitud || null;
        omPayload['N° Orden de compra'] = editState.n_oc || null;

        sgPayload.tipo_trabajo = editState.tipo_trabajo || null;
        sgPayload.estimacion_horas = parseInt(editState.estimacion_horas, 10) || null;
        sgPayload.solicitar_personal = editState.solicitar_personal || null;
        sgPayload.fecha_entrega = editState.fecha_entrega || null;
      }

      // 👇 3. PERMISOS EXCLUSIVOS DE "ALL" (God Mode)
      if (perms.godMode) {
        omPayload['Área'] = editState.area_om || null;
        omPayload['ID_#EQUIPO'] = editState.equipo || null;
        omPayload['ITEM'] = editState.item || null;
        omPayload['Sistema'] = editState.sistema || null;
        omPayload['Descripcion'] = editState.descripcion || null;
      }

      console.log('Payload OM a enviar:', omPayload);
      console.log('Payload SG a enviar:', sgPayload);

      if (Object.keys(omPayload).length === 0 && Object.keys(sgPayload).length === 0) {
         console.warn('Los permisos bloquearon la actualización. No se enviaron datos.');
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
        if (!res.data || res.data.length === 0) {
          throw new Error('Supabase no actualizó ninguna fila. Verifica RLS en la tabla.');
        }
      }

      // Actualizar la caché local
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
      return { ok: false, error: err.message || err };
    }
  }
  // Crear una SG Manual
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
  // Crear una SG Automática (Asociada a una orden existente)
  async function createAutoSG(id_orden_existente, sgData) {
    try {
      // 1. Asignar el ID de la orden base que ya existe
      sgData.id_orden_base = id_orden_existente;

      // 2. Insertar SOLO en la tabla OM_SG
      const { data: sgResult, error: sgError } = await db
        .from('OM_SG')
        .insert([sgData])
        .select()
        .single();

      if (sgError) throw sgError;

      // Opcional pero recomendado: Actualizar la orden base para marcarla como SG
      await db.from('ORDEN_MANTENIMIENTO')
        .update({ IS_SG: true })
        .eq('ID_Orden mantenimiento', id_orden_existente);

      // 3. Consultar la orden base para armar el objeto completo para la caché
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

      // 4. Agregar a la caché local
      _sgCache.unshift(nuevaSG);

      return { ok: true, data: nuevaSG };
    } catch (err) {
      console.error('[SGService] Error createAutoSG:', err);
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

  function getCache() {
    return _sgCache;
  }

  return { fetchSGs, updateSG, createManualSG, generarIdMantenimiento, getCache,createAutoSG };
})();

window.SGService = SGService;