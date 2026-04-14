// ============================================================
// ARCHIVO: HorasStore.js
// ============================================================

// ── INICIO DEL CAMBIO EN fetchAll ───────────────────────────
// Localiza el bloque .select(`...`) dentro de fetchAll().
// Reemplaza la sección MECANICOS con la versión ampliada:

      let query = sb
        .from('ORDEN_TRABAJO')
        .select(`
          ID_OT,
          id_om,
          id_sg,
          Fecha,
          "Duración (horas)",
          Estatus,
          "Retraso (horas)",
          Semana,
          Causa,
          Comentario,
          Observaciones,
          MECANICOS!ORDEN_TRABAJO_ID_Mecanico_fkey (
            id,
            NOMBRE,
            AREA,
            "EQUIPO DE TRABAJO"
          ),
          ORDEN_MANTENIMIENTO!ot_id_om_fkey (
            "ID_Orden mantenimiento",
            "Descripcion",
            "Área",
            "ID_#EQUIPO"
          ),
          OM_SG!OT_id_sg_fkey (
            id_sg,
            tipo_trabajo,
            "Observaciones",
            ORDEN_MANTENIMIENTO!om_servicios_generales_id_orden_base_fkey (
              "ID_Orden mantenimiento",
              "Descripcion",
              "Área",
              "ID_#EQUIPO"
            )
          )
        `)
        .gte('Fecha', fechaDesde)
        .order('Fecha', { ascending: false });

// ── FIN DEL CAMBIO EN fetchAll (select) ─────────────────────


// ── INICIO DEL CAMBIO EN fetchAll (normalize rows) ──────────
// Dentro del .map(row => {...}), añade el campo equipoTrabajo
// justo después de tipoTrabajo:

          // 🔥 EQUIPO DE TRABAJO (del mecánico, solo disponible si viene del select)
          --equipoTrabajo: (mec['EQUIPO DE TRABAJO'] || '').trim() || null,

// ── FIN DEL CAMBIO EN fetchAll (normalize rows) ─────────────


// ── INICIO DEL CAMBIO EN group() ────────────────────────────
// Reemplaza el bloque completo de sub-agrupación por área
// (el if que dice "Sub-agrupación por área dentro de cada día — solo para admin")
// con el siguiente bloque extendido:

    // Sub-agrupación por área dentro de cada día — solo para admin
    --if (groupBy === 'dia' && isAdmin) {
      grupos.forEach(g => {
        const subMap = new Map();

        g.rows.forEach(r => {
          const areaKey = r.id_sg != null
            ? 'Servicios Generales'
            : (r.area || r.mecArea || 'Sin área');

          if (!subMap.has(areaKey)) {
            subMap.set(areaKey, {
              key: areaKey,
              rows: [],
              totalHoras: 0,
              totalRetraso: 0,
              mecGroups: null,
              subSubGroups: null,
              hasEquipoTrabajo: false,
            });
          }
          const sg = subMap.get(areaKey);
          sg.rows.push(r);
          sg.totalHoras   += r.horas;
          sg.totalRetraso += r.retraso;

          // Detectar si el área tiene al menos una row con equipoTrabajo válido
          if (r.equipoTrabajo) sg.hasEquipoTrabajo = true;
        });

        g.subGroups = [...subMap.values()].sort((a, b) => a.key.localeCompare(b.key));

        // Construir el tercer nivel por equipo (si aplica) y el nivel mecánico
        g.subGroups.forEach(sg => {
          if (sg.hasEquipoTrabajo) {
            // Tercer nivel: EQUIPO DE TRABAJO → mecánico
            const equipoMap = new Map();

            sg.rows.forEach(r => {
              const eKey = r.equipoTrabajo || 'Sin equipo';
              if (!equipoMap.has(eKey)) {
                equipoMap.set(eKey, {
                  key: eKey,
                  rows: [],
                  totalHoras: 0,
                  totalRetraso: 0,
                  mecGroups: null,
                });
              }
              const eq = equipoMap.get(eKey);
              eq.rows.push(r);
              eq.totalHoras   += r.horas;
              eq.totalRetraso += r.retraso;
            });

            sg.subSubGroups = [...equipoMap.values()].sort((a, b) => a.key.localeCompare(b.key));

            // Nivel mecánico dentro de cada equipo
            sg.subSubGroups.forEach(eq => {
              eq.mecGroups = _buildMecGroups(eq.rows);
            });

          } else {
            // Sin agrupación por equipo → nivel mecánico directo
            sg.mecGroups = _buildMecGroups(sg.rows);
          }
        });
      });
    }

// ── FIN DEL CAMBIO EN group() ───────────────────────────────


// ── INICIO DEL CAMBIO EN group() — helper _buildMecGroups ───
// Añade esta función auxiliar DENTRO del IIFE de HorasStore,
// antes del return final:

  /**
   * Agrupa un array de rows por mecánico.
   * @param {NormalizedRow[]} rows
   * @returns {MecGroup[]}
   */
  --function _buildMecGroups(rows) {
    const mecMap = new Map();

    rows.forEach(r => {
      const mecKey = r.mecId || r.mecNombre || 'Sin personal';

      if (!mecMap.has(mecKey)) {
        mecMap.set(mecKey, {
          key: r.mecNombre || 'Sin personal',
          mecId: r.mecId,
          rows: [],
          totalHoras: 0,
          totalRetraso: 0,
          hasEnProceso: false,
        });
      }
      const mg = mecMap.get(mecKey);
      mg.rows.push(r);
      mg.totalHoras   += r.horas;
      mg.totalRetraso += r.retraso;
      if (r.estatus === 'En Proceso') mg.hasEnProceso = true;
    });

    return [...mecMap.values()].sort((a, b) => a.key.localeCompare(b.key));
  }

// ── FIN DEL CAMBIO EN group() — helper _buildMecGroups ──────


// ── INICIO DEL CAMBIO EN return de HorasStore ───────────────
// Añade _buildMecGroups al return para que esté accesible
// (opcional, útil para testing; si prefieres privado, omítelo):

  return { fetchAll, group, filterByMecanico, getCache, subscribe, invalidate, AREAS };
  // Sin cambios en el return — _buildMecGroups es privado

// ── FIN DEL CAMBIO EN return de HorasStore ──────────────────




// ============================================================
// ARCHIVO: HorasGroup.js
// ============================================================
// Reemplaza el IIFE completo de HorasGroup con esta versión
// extendida. Los cambios están marcados internamente.

c




// ============================================================
// ARCHIVO: HorasTable.js
// ============================================================

// ── INICIO DEL CAMBIO EN mount() — exponer _rebuildGroups ───
// Añade al final de la función mount(), justo antes del cierre
// del bloque de delegación de eventos (el último párrafo del mount):

    // Exponer _rebuildGroups para que HorasGroup pueda llamarlo
    // tras la acción de "Concluir Rápido"
    window.HorasTable._rebuildGroups = _rebuildGroups;

// ── FIN DEL CAMBIO EN mount() ───────────────────────────────


// ── INICIO DEL CAMBIO EN onStatusChange ─────────────────────
// En el callback onStatusChange del HorasDetail.init (dentro de mount),
// hay un bug: `data` se declara con const y luego se reasigna.
// Reemplaza el bloque completo de onStatusChange con:

      onStatusChange: (id, newStatus) => {
        const row = _rowsCache[id];
        if (!row) return;

        OTService.actualizarOT(id, { Estatus: newStatus })
          .then(res => {
            if (res.ok) {
              // NOTA: res.data puede no tener mecNombre ni mecId — los tomamos del cache
              const data = {
                ..._mapFromDB(res.data),
                mecNombre: row.mecNombre,
                mecId: row.mecId,
              };

              _updateCache(data);

              const groupBy = _lastOpts.groupBy || 'semana';
              const oldKey  = _groupKeyOf(row, groupBy);
              const newKey  = _groupKeyOf(data, groupBy);

              if (oldKey !== newKey) {
                _rebuildGroups();
              } else {
                _patchRow(id, data);
              }
            } else {
              _patchRow(id, row);
              window.ToastService?.show('Error al cambiar estado.', 'danger');
            }
          });
      },

// ── FIN DEL CAMBIO EN onStatusChange ────────────────────────


// ── INICIO DEL CAMBIO EN return de HorasTable ───────────────
// El return actual expone: { mount, render, showLoading }
// Añadir _rebuildGroups para que también sea accesible vía módulo:

  return { mount, render, showLoading, _rebuildGroups };

// ── FIN DEL CAMBIO EN return de HorasTable ──────────────────




// ============================================================
// CSS sugerido (añadir a tu hoja de estilos o <style>)
// ============================================================
/*
.hg-mec-group {
  border-left: 2px solid var(--color-border-tertiary, #e8e4df);
  margin: 0 0 2px 8px;
}

.hg-mec-group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  cursor: pointer;
  user-select: none;
  background: var(--color-background-secondary, #f7f5f2);
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-secondary, #4A4640);
  transition: background 0.12s;
}

.hg-mec-group-header:hover {
  background: var(--color-background-tertiary, #ede9e3);
}

.hg-mec-group-name {
  font-weight: 600;
  color: var(--text-primary, #1A1917);
  font-size: 12.5px;
}

.hg-mec-group-body {
  transition: max-height 0.22s ease, opacity 0.18s ease;
}

.hg-conclude-label {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  margin-left: 8px;
}

.hg-conclude-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 500;
  color: var(--color-success, #2D8A4E);
  background: var(--color-success-bg, #E8F5ED);
  border: 1px solid rgba(45,138,78,0.25);
  transition: background 0.12s, opacity 0.12s;
}

.hg-conclude-btn:hover {
  background: rgba(45,138,78,0.15);
}

.hg-subgroup--equipo .hg-subgroup-header {
  background: var(--color-info-bg, #E3F0FA);
  border-radius: 5px;
  padding: 5px 10px;
  font-size: 11.5px;
}

.hg-equipo-trabajo {
  font-size: 11.5px;
  color: var(--color-info, #1A6B9A);
  font-weight: 500;
}
*/