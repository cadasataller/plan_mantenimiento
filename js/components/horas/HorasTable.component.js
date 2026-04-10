const HorasTable = (() => {

  let _containerId  = null;
  let _lastGroups   = [];
  let _lastOpts     = {};
  let _rowsCache    = {};   // { [id]: rowObject } — cache plano de todas las filas

  // ── Mount ─────────────────────────────────────────────────
  function mount(containerId) {
    _containerId = containerId;

    HorasDetail.init({

      onSave: (updatedRow) => {

          const payload =  {
            ...updatedRow,

            // 🔹 mapping
            Fecha:     updatedRow.fecha,
            Semana:    updatedRow.semana,
            Duracion:  updatedRow.horas,
            Retraso:   updatedRow.retraso,
            Causa:     updatedRow.causa,
            Estatus:   updatedRow.estatus,
            Comentario: updatedRow.comentario,
            ID_Mecanico: updatedRow.mecId,
          };
          const id = updatedRow.id; // ✅ aquí viene el id
          const original = _rowsCache[id];

          
          

          // 🔹 3. Persistencia
          console.log(payload);
          
          OTService.actualizarOT(id, payload).then(res => {
            if (res.ok) {
              const data = _mapFromDB(res.data);

              const resolveAndApply = (finalData) => {
                _updateCache(finalData);

                // ¿Cambió la clave de agrupación?
                const groupBy = _lastOpts.groupBy || 'semana';
                const oldKey = _groupKeyOf(original, groupBy);
                const newKey = _groupKeyOf(finalData, groupBy);

                console.log(original);
                console.log(finalData);
                
                

                if (oldKey !== newKey) {
                  // La fila cambia de grupo → re-render completo
                  _rebuildGroups();
                } else {
                  // Mismo grupo → solo patch en DOM
                  _patchRow(id, finalData);
                }
              };

              if (updatedRow.mecId && updatedRow.mecId !== original?.mecId) {
                MecanicoSelectComponent.getNameById(updatedRow.mecId).then(nombre => {
                  resolveAndApply({ ...data, mecNombre: nombre, mecId: updatedRow.mecId });
                });
              } else {
                resolveAndApply({...data, mecNombre: updatedRow.mecNombre, mecId: updatedRow.mecId});
              }

            } else {
              if (original) _patchRow(id, original);
              window.ToastService?.show('Error al guardar.', 'danger');
            }
          });
        },

      onStatusChange: (id, newStatus) => {
        // Optimista en DOM
        const row = _rowsCache[id];
        if (!row) return;
        //const optimista = { ...row, estatus: newStatus };
        //HorasDetail.updateRowBadge(optimista);

        // Persistir en servidor
        OTService.actualizarOT(id, { Estatus: newStatus })
          .then(res => {
            if (res.ok) {
              const data = _mapFromDB(res.data);

              data = {...data, mecNombre: updatedRow.mecNombre, mecId: updatedRow.mecId};
              _updateCache(data);

              const groupBy = _lastOpts.groupBy || 'semana';
              const oldKey = _groupKeyOf(row, groupBy);
              const newKey = _groupKeyOf(data, groupBy);

              if (oldKey !== newKey) {
                _rebuildGroups(); // estatus cambió y se agrupa por estatus
              } else {
                _patchRow(id, data);
              }
            } else {
              _patchRow(id, row);
              window.ToastService?.show('Error al cambiar estado.', 'danger');
            }
          });
      },
    });

    // Delegación de eventos
    const el = document.getElementById(_containerId);
    if (!el) return;

    el.addEventListener('click', e => {
      // Botón editar → panel de detalle
      const detailBtn = e.target.closest('.hg-row-detail-btn');
      if (detailBtn) {
        e.stopPropagation();
        const id  = detailBtn.dataset.otId;
        const row = _rowsCache[id];
        if (row) HorasDetail.open(row);
        return;
      }

      // Badge de estado → popup
      const statusBtn = e.target.closest('.hg-btn-status-change');
      if (statusBtn) {
        e.stopPropagation();
        const id  = statusBtn.dataset.otId;
        const row = _rowsCache[id];
        if (!row) return;

        HorasDetail.openStatusPopup(
          statusBtn,
          id,
          statusBtn.dataset.currentStatus,
          (id, newStatus) => {
            // Optimista
            HorasDetail.updateRowBadge({ ...row, estatus: newStatus });

            OTService.actualizarOT(id, { Estatus: newStatus })
              .then(res => {
                if (res.ok) {
                  _updateCache(res.data);
                  HorasDetail.updateRowBadge(res.data);
                } else {
                  HorasDetail.updateRowBadge(row);
                  window.ToastService?.show('Error al cambiar estado.', 'danger');
                }
              });
          }
        );
      }
    });
  }

  function _groupKeyOf(row, groupBy) {
    switch (groupBy) {
      case 'semana':  return row?.semana  || '—';
      case 'estatus': return row?.estatus || '—';
      case 'area':    return row?.area    || row?.mecArea || 'Sin área';
      case 'dia':     return row?.fecha   ? String(row.fecha).slice(0,10) : '—';
      default:        return '—';
    }
  }

  function _mapFromDB(row) {
    console.log(row);
    row.Semana = String(row.Semana);
    return {
      ...row,

      // 🔹 convertir a formato interno
      fecha:     row.Fecha      ? String(row.Fecha).slice(0, 10) : '',
      semana:    row.Semana,
      horas:     row.Duracion,
      retraso:   row.Retraso,
      causa:     row.Causa,
      estatus:   row.Estatus,
      comentario: row.Comentario,
    };
  }

  // Actualiza solo las celdas de un <tr> existente sin tocar el resto del DOM
  function _patchRow(id, data) {
    const tr = document.querySelector(`.hg-row[data-ot-id="${id}"]`);
    if (!tr) return false;

    const h = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const fmt = n => Number(n).toFixed(1);

    const mecEl = tr.querySelector('.hg-mec-name');
    if (mecEl) mecEl.textContent = data.mecNombre || '—';

    const fechaEl = tr.querySelector('.hg-fecha');
    if (fechaEl) fechaEl.textContent = data.fecha ? String(data.fecha).slice(0,10) : '—';

    const semanaEl = tr.querySelector('.hg-semana');
    if (semanaEl) semanaEl.textContent = data.semana || '—';

    const horasEl = tr.querySelector('.hg-horas');
    if (horasEl) horasEl.innerHTML = `${fmt(data.horas)}<span class="hg-unit">h</span>`;

    // retraso
    const retrasoEl = tr.querySelector('td.hg-retraso-val, td.hg-muted');
    if (retrasoEl) {
      retrasoEl.className = data.retraso > 0 ? 'text-right hg-retraso-val' : 'text-right hg-muted';
      retrasoEl.innerHTML = data.retraso > 0
        ? `${fmt(data.retraso)}<span class="hg-unit">h</span>`
        : '—';
    }

    // badge de estatus
    HorasDetail.updateRowBadge({...data,id:id});
    return true;
  }

  // ── Helpers internos ──────────────────────────────────────

  /** Guarda o actualiza una fila en el cache plano */
  function _updateCache(row) {
    const id = row.id || row.ID_RowNumber;
    if (!id) return;
    _rowsCache[id] = { ...(_rowsCache[id] || {}), ...row };
  }

  /** Reconstruye los grupos desde el cache y re-renderiza */
  // ── Fix 4: _rebuildGroups mueve filas entre grupos si cambia la semana ─
function _rebuildGroups() {
  const groupBy = _lastOpts.groupBy || 'semana';

  // Reconstruir el mapa de grupos desde cero usando el cache actualizado
  const groupMap = new Map();

  _lastGroups.forEach(group => {
    group.rows.forEach(r => {
      const id = r.id || r.ID_OT;
      const fresh = _rowsCache[id] || r;

      // ✅ FIX: clave del grupo según el dato ACTUALIZADO, no el original
      let key;
      switch (groupBy) {
        case 'semana':  key = fresh.semana || group.key; break;
        case 'estatus': key = fresh.estatus; break;
        case 'area':    key = fresh.area || fresh.mecArea || 'Sin área'; break;
        case 'dia':     key = fresh.fecha ? fresh.fecha.slice(0, 10) : '—'; break;
        default:        key = group.key;
      }

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          key,
          rows: [],
          totalHoras: 0,
          totalRetraso: 0,
          subGroups: null,
        });
      }
      const g = groupMap.get(key);
      g.rows.push(fresh);
      g.totalHoras   += (fresh.horas   || 0);
      g.totalRetraso += (fresh.retraso || 0);
    });
  });

  const refreshedGroups = [...groupMap.values()].sort((a, b) => {
    b.key = String(b.key);
    a.key = String(a.key);
    if (groupBy === 'semana' || groupBy === 'dia') return b.key.localeCompare(a.key);
    return a.key.localeCompare(b.key);
  });

  const totalHoras   = refreshedGroups.reduce((s, g) => s + g.totalHoras, 0);
  const totalRetraso = refreshedGroups.reduce((s, g) => s + g.totalRetraso, 0);
  const totalRows    = refreshedGroups.reduce((s, g) => s + g.rows.length, 0);

  // ✅ Actualizar _lastGroups para futuros rebuilds
  _lastGroups = refreshedGroups;

  render(refreshedGroups, {
    ..._lastOpts,
    totalHoras,
    totalRetraso,
    totalRows,
  });
}
  // ── Render ────────────────────────────────────────────────
  function render(groups, opts = {}) {
    const el = document.getElementById(_containerId);
    if (!el) return;

    // Guardar para re-renders
    _lastGroups = groups ?? _lastGroups;
    _lastOpts   = { ..._lastOpts, ...opts };

    // Poblar cache con todas las filas recibidas
    (groups || []).forEach(g => {
      (g.rows || []).forEach(r => _updateCache(r));
    });

    const {
      isAdmin      = false,
      groupBy      = 'semana',
      loading      = false,
      totalHoras   = 0,
      totalRetraso = 0,
      totalRows    = 0,
    } = opts;

    if (loading) { el.innerHTML = _skeleton(); return; }
    if (!groups || groups.length === 0) { el.innerHTML = _empty(); return; }

    const summaryEl = document.createElement('div');
    summaryEl.className = 'ht-summary';
    summaryEl.innerHTML = `
      <div class="ht-summary-inner">
        <div class="ht-summary-stat">
          <span class="ht-summary-val">${totalRows}</span>
          <span class="ht-summary-lbl">órdenes</span>
        </div>
        <div class="ht-summary-div"></div>
        <div class="ht-summary-stat">
          <span class="ht-summary-val">${Number(totalHoras).toFixed(1)}<span class="ht-unit">h</span></span>
          <span class="ht-summary-lbl">horas asignadas</span>
        </div>
        ${totalRetraso > 0 ? `
        <div class="ht-summary-div"></div>
        <div class="ht-summary-stat ht-summary-danger">
          <span class="ht-summary-val">${Number(totalRetraso).toFixed(1)}<span class="ht-unit">h</span></span>
          <span class="ht-summary-lbl">horas retraso</span>
        </div>` : ''}
        <div class="ht-summary-div"></div>
        <div class="ht-summary-stat">
          <span class="ht-summary-val">${groups.length}</span>
          <span class="ht-summary-lbl">grupos</span>
        </div>
      </div>`;

    const listEl = document.createElement('div');
    listEl.className = 'ht-list';
    groups.forEach(group => {
      listEl.appendChild(HorasGroup.render(group, { isAdmin, groupBy }));
    });

    el.innerHTML = '';
    el.appendChild(summaryEl);
    el.appendChild(listEl);
  }

  // ── Estados especiales ────────────────────────────────────
  function _skeleton() {
    return `<div class="ht-skeleton">${Array(4).fill(0).map(() => `
      <div class="ht-skel-group">
        <div class="ht-skel-header ht-skel-pulse"></div>
        <div class="ht-skel-rows">
          ${Array(3).fill('<div class="ht-skel-row ht-skel-pulse"></div>').join('')}
        </div>
      </div>`).join('')}</div>`;
  }

  function _empty() {
    return `
      <div class="ht-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
             width="48" height="48" opacity=".3">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        <p>No se encontraron órdenes de trabajo</p>
        <small>Ajusta los filtros o el buscador</small>
      </div>`;
  }



  function showLoading() {
    const el = document.getElementById(_containerId);
    if (el) el.innerHTML = _skeleton();
  }

  return { mount, render, showLoading };
})();

window.HorasTable = HorasTable;