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
          };
          const id = updatedRow.id; // ✅ aquí viene el id
          //const original = _rowsCache[id];

          
          

          // 🔹 3. Persistencia
          console.log(payload);
          
          OTService.actualizarOT(id, payload)
            .then(res => {
              if (res.ok) {
                const data = _mapFromDB(res.data);
                _updateCache(data);
                HorasDetail.updateRowBadge(data);
                _rebuildGroups()
              } else {
                // 🔹 Revertir
                if (original) {
                  _updateCache(original);
                  HorasDetail.updateRowBadge(original);
                }
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
              _updateCache(data);
              HorasDetail.updateRowBadge(data);
              _rebuildGroups()
            } else {
              // Revertir si falla
              HorasDetail.updateRowBadge(row);
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

  function _mapFromDB(row) {
  return {
    ...row,

    // 🔹 convertir a formato interno
    fecha:     row.Fecha,
    semana:    row.Semana,
    horas:     row.Duracion,
    retraso:   row.Retraso,
    causa:     row.Causa,
    estatus:   row.Estatus,
    comentario: row.Comentario,
  };
}

  // ── Helpers internos ──────────────────────────────────────

  /** Guarda o actualiza una fila en el cache plano */
  function _updateCache(row) {
    const id = row.id || row.ID_RowNumber;
    if (!id) return;
    _rowsCache[id] = { ...(_rowsCache[id] || {}), ...row };
  }

  /** Reconstruye los grupos desde el cache y re-renderiza */
  function _rebuildGroups() {
    // Actualizar las filas dentro de _lastGroups con los datos del cache
    const refreshedGroups = _lastGroups.map(group => ({
      ...group,
      rows: group.rows.map(r => {
        const id = r.id || r.ID_RowNumber;
        return _rowsCache[id] || r;
      }),
      totalHoras:   group.rows.reduce((s, r) => {
        const id = r.id || r.ID_RowNumber;
        const fresh = _rowsCache[id] || r;
        return s + (fresh.horas || fresh.Duracion || 0);
      }, 0),
      totalRetraso: group.rows.reduce((s, r) => {
        const id = r.id || r.ID_RowNumber;
        const fresh = _rowsCache[id] || r;
        return s + (fresh.retraso || fresh.Retraso || 0);
      }, 0),
    }));

    const totalHoras   = refreshedGroups.reduce((s, g) => s + g.totalHoras, 0);
    const totalRetraso = refreshedGroups.reduce((s, g) => s + g.totalRetraso, 0);
    const totalRows    = refreshedGroups.reduce((s, g) => s + g.rows.length, 0);

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