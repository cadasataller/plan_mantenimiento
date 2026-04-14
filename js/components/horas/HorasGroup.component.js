/**
 * HorasGroup.component.js
 * Renderiza UN grupo (semana / estatus / área / día) colapsable
 * con su tabla de OTs y resumen de horas.
 *
 * Uso (imperativo, sin dependencias):
 *   HorasGroup.render(group, { isAdmin, groupBy }) → HTMLElement
 */
const HorasGroup = (() => {

  // ─── Paleta de estatus ───────────────────────────────────
  const ESTATUS_META = {
    'Concluido':  { cls: 'est-success', dot: '#2D8A4E' },
    'En Proceso': { cls: 'est-info',    dot: '#1A6B9A' },
    'Pendiente':  { cls: 'est-warning', dot: '#C97B2F' },
    'Retrasado':  { cls: 'est-danger',  dot: '#C0392B' },
    'Cancelado':  { cls: 'est-muted',   dot: '#8F8A7F' },
  };

  function _estatusMeta(estatus) {
    return ESTATUS_META[estatus] || { cls: 'est-muted', dot: '#8F8A7F' };
  }

  function _fmt(n) { return Number(n).toFixed(1); }

  function _formatFecha(iso) {
    if (!iso) return '—';
    if (typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
    if (typeof iso === 'string' && iso.includes('T')) return iso.split('T')[0];
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toISOString().split('T')[0];
  }

  function _formatSemana(key) {
    const strkey = String(key || '');
    const m = strkey.match(/^(\d{4})-S(\d+)$/);
    if (m) return `Semana ${m[2]} · ${m[1]}`;
    return key;
  }

  function _formatGroupKey(key, groupBy) {
    if (groupBy === 'semana') return _formatSemana(key);
    if (groupBy === 'dia')    return _formatFecha(key + 'T00:00:00');
    return key;
  }

  function _groupIcon(groupBy) {
    switch (groupBy) {
      case 'semana':  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
      case 'estatus': return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
      case 'area':    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`;
      case 'dia':     return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
      default:        return '';
    }
  }

  // ── INICIO DEL CAMBIO EN render() ───────────────────────
  /**
   * Renderiza el grupo principal y devuelve un HTMLElement.
   * @param {Object} group  — { key, rows, totalHoras, totalRetraso, subGroups? }
   * @param {Object} opts   — { isAdmin, groupBy }
   */
  function render(group, opts = {}) {
    const { isAdmin = false, groupBy = 'semana' } = opts;
    const wrap = document.createElement('div');
    wrap.className = 'hg-group';

    const label  = _formatGroupKey(group.key, groupBy);
    const count  = group.rows.length;
    const hTotal = _fmt(group.totalHoras);
    const rTotal = _fmt(group.totalRetraso);

    wrap.innerHTML = `
      <div class="hg-header" data-expanded="false">
        <div class="hg-header-left">
          <button class="hg-toggle" aria-label="colapsar">
            <svg class="hg-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          <span class="hg-icon">${_groupIcon(groupBy)}</span>
          <span class="hg-label">${_escHtml(label)}</span>
          <span class="hg-count">${count} OT${count !== 1 ? 's' : ''}</span>
        </div>
        <div class="hg-header-stats">
          <span class="hg-stat hg-stat-horas">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            ${hTotal}h asignadas
          </span>
          ${parseFloat(rTotal) > 0 ? `
          <span class="hg-stat hg-stat-retraso">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            ${rTotal}h retraso
          </span>` : ''}
        </div>
      </div>
      <div class="hg-body"></div>
    `;

    const body    = wrap.querySelector('.hg-body');
    const header  = wrap.querySelector('.hg-header');
    const chevron = wrap.querySelector('.hg-chevron');

    // ── INICIO DEL CAMBIO: decidir qué renderizar en el body ──
    if (group.subGroups && group.subGroups.length > 0) {
      // Agrupación por día con admin: sub-grupos por área
      group.subGroups.forEach(sg => {
        body.appendChild(_renderAreaSubGroup(sg, { isAdmin }));
      });
    } else {
      // Sin sub-grupos: tabla plana con nivel mecánico si las rows son consistentes
      // Determinar si se debe mostrar columna equipoTrabajo para este grupo
      const showEquipoTrabajo = group.rows.some(r => r.equipoTrabajo);
      const mecGroups = _buildMecGroupsFromRows(group.rows);

      if (mecGroups.length > 0) {
        mecGroups.forEach(mg => {
          body.appendChild(_renderMecGroup(mg, { isAdmin, showEquipoTrabajo }));
        });
      } else {
        // fallback: tabla plana sin nivel mecánico
        body.appendChild(_renderPlainTable(group.rows, isAdmin, showEquipoTrabajo));
      }
    }
    // ── FIN DEL CAMBIO: decidir qué renderizar en el body ────

    // Toggle colapsar/expandir
    header.dataset.expanded = 'false';
    body.style.maxHeight    = '0';
    body.style.opacity      = '0';
    body.style.overflow     = 'hidden';
    chevron.style.transform = 'rotate(-90deg)';

    header.addEventListener('click', e => {
      e.stopPropagation();
      const expanded = header.dataset.expanded === 'true';
      header.dataset.expanded = expanded ? 'false' : 'true';
      body.style.maxHeight    = expanded ? '0' : '';
      body.style.opacity      = expanded ? '0' : '1';
      body.style.overflow     = expanded ? 'hidden' : '';
      chevron.style.transform = expanded ? 'rotate(-90deg)' : '';
    });

    return wrap;
  }
  // ── FIN DEL CAMBIO EN render() ──────────────────────────


  // ── INICIO DE FUNCIÓN NUEVA: _renderAreaSubGroup ─────────
  /**
   * Renderiza un sub-grupo de área (nivel 2).
   * Puede tener sub-sub-grupos por equipo o ir directamente a mecánico.
   */
  function _renderAreaSubGroup(sg, opts = {}) {
    const { isAdmin = false } = opts;
    const sgEl = document.createElement('div');
    sgEl.className = 'hg-subgroup';

    sgEl.innerHTML = `
      <div class="hg-subgroup-header" data-expanded="false">
        <button class="hg-sub-toggle">
          <svg class="hg-sub-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        <span class="hg-subgroup-label">${_escHtml(sg.key)}</span>
        <span class="hg-subgroup-count">${sg.rows.length} OT${sg.rows.length !== 1 ? 's' : ''}</span>
        <span class="hg-stat hg-stat-horas" style="margin-left:auto">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          ${_fmt(sg.totalHoras)}h
        </span>
        ${sg.totalRetraso > 0 ? `<span class="hg-stat hg-stat-retraso">${_fmt(sg.totalRetraso)}h retraso</span>` : ''}
      </div>
      <div class="hg-subgroup-body"></div>
    `;

    const subHeader  = sgEl.querySelector('.hg-subgroup-header');
    const subBody    = sgEl.querySelector('.hg-subgroup-body');
    const subChevron = sgEl.querySelector('.hg-sub-chevron');

    // Determinar si el área tiene equipoTrabajo
    const showEquipoTrabajo = sg.hasEquipoTrabajo;

    if (sg.subSubGroups && sg.subSubGroups.length > 0) {
      // Nivel 3: EQUIPO DE TRABAJO → luego mecánico
      sg.subSubGroups.forEach(eq => {
        subBody.appendChild(_renderEquipoSubGroup(eq, { isAdmin, showEquipoTrabajo }));
      });
    } else if (sg.mecGroups && sg.mecGroups.length > 0) {
      // Sin equipo: ir directo al nivel mecánico
      sg.mecGroups.forEach(mg => {
        subBody.appendChild(_renderMecGroup(mg, { isAdmin, showEquipoTrabajo }));
      });
    } else {
      // fallback: tabla plana
      subBody.appendChild(_renderPlainTable(sg.rows, false, showEquipoTrabajo));
    }

    // Toggle
    subHeader.dataset.expanded = 'false';
    subBody.style.maxHeight    = '0';
    subBody.style.opacity      = '0';
    subBody.style.overflow     = 'hidden';
    subChevron.style.transform = 'rotate(-90deg)';

    subHeader.addEventListener('click', e => {
      e.stopPropagation();
      const open = subHeader.dataset.expanded === 'true';
      subHeader.dataset.expanded = open ? 'false' : 'true';
      subBody.style.maxHeight    = open ? '0' : '';
      subBody.style.opacity      = open ? '0' : '1';
      subBody.style.overflow     = open ? 'hidden' : '';
      subChevron.style.transform = open ? 'rotate(-90deg)' : '';
    });

    return sgEl;
  }
  // ── FIN DE FUNCIÓN NUEVA: _renderAreaSubGroup ────────────


  // ── INICIO DE FUNCIÓN NUEVA: _renderEquipoSubGroup ───────
  /**
   * Renderiza un sub-sub-grupo por EQUIPO DE TRABAJO (nivel 3).
   */
  function _renderEquipoSubGroup(eq, opts = {}) {
    const { isAdmin = false, showEquipoTrabajo = false } = opts;
    const eqEl = document.createElement('div');
    eqEl.className = 'hg-subgroup hg-subgroup--equipo';

    eqEl.innerHTML = `
      <div class="hg-subgroup-header hg-equipo-header" data-expanded="false">
        <button class="hg-sub-toggle">
          <svg class="hg-sub-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="11" height="11">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" style="color:var(--color-info,#1A6B9A);flex-shrink:0">
          <rect x="2" y="7" width="20" height="14" rx="2"/>
          <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
        </svg>
        <span class="hg-subgroup-label" style="font-size:11.5px">${_escHtml(eq.key)}</span>
        <span class="hg-subgroup-count">${eq.rows.length} OT${eq.rows.length !== 1 ? 's' : ''}</span>
        <span class="hg-stat hg-stat-horas" style="margin-left:auto; font-size:11px">
          ${_fmt(eq.totalHoras)}h
        </span>
        ${eq.totalRetraso > 0 ? `<span class="hg-stat hg-stat-retraso" style="font-size:11px">${_fmt(eq.totalRetraso)}h retraso</span>` : ''}
      </div>
      <div class="hg-subgroup-body"></div>
    `;

    const eqHeader  = eqEl.querySelector('.hg-equipo-header');
    const eqBody    = eqEl.querySelector('.hg-subgroup-body');
    const eqChevron = eqEl.querySelector('.hg-sub-chevron');

    // Nivel mecánico dentro del equipo
    if (eq.mecGroups && eq.mecGroups.length > 0) {
      eq.mecGroups.forEach(mg => {
        eqBody.appendChild(_renderMecGroup(mg, { isAdmin, showEquipoTrabajo }));
      });
    } else {
      eqBody.appendChild(_renderPlainTable(eq.rows, false, showEquipoTrabajo));
    }

    eqHeader.dataset.expanded = 'false';
    eqBody.style.maxHeight    = '0';
    eqBody.style.opacity      = '0';
    eqBody.style.overflow     = 'hidden';
    eqChevron.style.transform = 'rotate(-90deg)';

    eqHeader.addEventListener('click', e => {
      e.stopPropagation();
      const open = eqHeader.dataset.expanded === 'true';
      eqHeader.dataset.expanded = open ? 'false' : 'true';
      eqBody.style.maxHeight    = open ? '0' : '';
      eqBody.style.opacity      = open ? '0' : '1';
      eqBody.style.overflow     = open ? 'hidden' : '';
      eqChevron.style.transform = open ? 'rotate(-90deg)' : '';
    });

    return eqEl;
  }
  // ── FIN DE FUNCIÓN NUEVA: _renderEquipoSubGroup ──────────


  // ── INICIO DE FUNCIÓN NUEVA: _renderMecGroup ─────────────
  /**
   * Renderiza un grupo de mecánico (nivel final antes de las filas).
   * Incluye botón "Concluir Rápido" si hay OTs En Proceso.
   * @param {Object} mecGroup — { key, mecId, rows, totalHoras, totalRetraso, hasEnProceso }
   * @param {Object} opts     — { isAdmin, showEquipoTrabajo }
   */
  function _renderMecGroup(mecGroup, opts = {}) {
    const { isAdmin = false, showEquipoTrabajo = false } = opts;
    const mgEl = document.createElement('div');
    mgEl.className = 'hg-mec-group';

    // ID único para el checkbox de este mecánico
    const cbId = `hg-mec-cb-${mecGroup.mecId || _escHtml(mecGroup.key).replace(/\s+/g,'-')}`;

    mgEl.innerHTML = `
      <div class="hg-mec-group-header" data-expanded="false" data-mec-id="${mecGroup.mecId}">
        <button class="hg-sub-toggle hg-mec-toggle">
          <svg class="hg-mec-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="11" height="11">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13" style="flex-shrink:0;color:var(--text-secondary)">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
        <span class="hg-mec-group-name">${_escHtml(mecGroup.key)}</span>
        <span class="hg-subgroup-count">${mecGroup.rows.length} OT${mecGroup.rows.length !== 1 ? 's' : ''}</span>
        <span class="hg-stat hg-stat-horas" style="margin-left:auto;font-size:11px">
          ${_fmt(mecGroup.totalHoras)}h
        </span>
        ${mecGroup.totalRetraso > 0 ? `<span class="hg-stat hg-stat-retraso" style="font-size:11px">${_fmt(mecGroup.totalRetraso)}h retraso</span>` : ''}

        ${mecGroup.hasEnProceso ? `
        <!-- Botón Concluir Rápido — solo visible si hay OTs En Proceso -->
        <label class="hg-conclude-label" title="Concluir todas las OTs En Proceso de ${_escHtml(mecGroup.key)}" for="${cbId}">
          <input
            type="checkbox"
            id="${cbId}"
            class="hg-mec-conclude-cb"
            data-mec-id="${mecGroup.mecId || ''}"
            data-mec-name="${_escHtml(mecGroup.key)}"
            style="display:none"
          />
          <span class="hg-conclude-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="11" height="11">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Concluir rápido
          </span>
        </label>` : ''}
      </div>
      <div class="hg-mec-group-body"></div>
    `;

    const mgHeader  = mgEl.querySelector('.hg-mec-group-header');
    const mgBody    = mgEl.querySelector('.hg-mec-group-body');
    const mgChevron = mgEl.querySelector('.hg-mec-chevron');

    // Tabla de filas del mecánico
    mgBody.appendChild(_renderPlainTable(mecGroup.rows, isAdmin, showEquipoTrabajo));

    // Toggle
    mgHeader.dataset.expanded = 'false';
    mgBody.style.maxHeight    = '0';
    mgBody.style.opacity      = '0';
    mgBody.style.overflow     = 'hidden';
    mgChevron.style.transform = 'rotate(-90deg)';

    mgHeader.addEventListener('click', e => {
      // No propagar si se clicó en el label de concluir
      if (e.target.closest('.hg-conclude-label')) return;
      e.stopPropagation();
      const open = mgHeader.dataset.expanded === 'true';
      mgHeader.dataset.expanded = open ? 'false' : 'true';
      mgBody.style.maxHeight    = open ? '0' : '';
      mgBody.style.opacity      = open ? '0' : '1';
      mgBody.style.overflow     = open ? 'hidden' : '';
      mgChevron.style.transform = open ? 'rotate(-90deg)' : '';
    });

    // Evento del checkbox "Concluir Rápido"
    const cb = mgEl.querySelector('.hg-mec-conclude-cb');
    if (cb) {
      cb.addEventListener('change', e => {
        e.stopPropagation();
        if (cb.checked) {
          _onConcluirCheckboxActivated(cb, mecGroup);
        } else {
          _reenableAllConcludeCheckboxes();
        }
      });

      // Click en el label no debe propagar al header
      const label = mgEl.querySelector('.hg-conclude-label');
      if (label) {
        label.addEventListener('click', e => e.stopPropagation());
      }
    }

    return mgEl;
  }
  // ── FIN DE FUNCIÓN NUEVA: _renderMecGroup ────────────────


  // ── INICIO DE FUNCIÓN NUEVA: _onConcluirCheckboxActivated ─
  /**
   * Lógica al activar el checkbox de un mecánico:
   * 1. Deshabilita todos los demás checkboxes de mecánico.
   * 2. Abre el modal de confirmación.
   * 3. En confirmación: actualiza solo las OTs "En Proceso".
   */
  function _onConcluirCheckboxActivated(activeCb, mecGroup) {
    // Deshabilitar todos los demás checkboxes de mecánico en la página
    document.querySelectorAll('.hg-mec-conclude-cb').forEach(cb => {
      if (cb !== activeCb) {
        cb.disabled = true;
        const btn = cb.parentElement?.querySelector('.hg-conclude-btn');
        if (btn) btn.style.opacity = '0.35';
      }
    });

    // Revisar si hay OTs con retraso o ausencia para advertir en el modal
    const hasPendientes = mecGroup.rows.some(r =>
      r.estatus === 'Retrasado' || r.estatus === 'Pendiente'
    );

    window.ConfirmConcluirModal.show(
      // onConfirm
      () => {
        _ejecutarConcluirRapido(mecGroup, activeCb);
      },
      hasPendientes
    );

    // Si el usuario cierra el modal sin confirmar, desmarcar y re-habilitar
    // Usamos un MutationObserver para detectar cuando el modal desaparece
    const modalObserver = new MutationObserver(() => {
      if (!document.getElementById('confirm-concluir-root')) {
        // Modal cerrado sin confirmar
        if (activeCb.checked) {
          // Solo si sigue marcado (si confirmó ya se desmarca internamente)
          activeCb.checked = false;
          _reenableAllConcludeCheckboxes();
        }
        modalObserver.disconnect();
      }
    });
    modalObserver.observe(document.body, { childList: true });
  }
  // ── FIN DE FUNCIÓN NUEVA: _onConcluirCheckboxActivated ───


  // ── INICIO DE FUNCIÓN NUEVA: _ejecutarConcluirRapido ─────
  /**
   * Recorre las OTs del mecánico y actualiza solo las "En Proceso" a "Concluida".
   * @param {Object} mecGroup — el grupo de mecánico
   * @param {HTMLInputElement} cb — checkbox activo (para desmarcar al terminar)
   */
  async function _ejecutarConcluirRapido(mecGroup, cb) {
    const otsProceso = mecGroup.rows.filter(r => r.estatus === 'En Proceso');

    if (otsProceso.length === 0) {
      _reenableAllConcludeCheckboxes();
      cb.checked = false;
      return;
    }

    try {
      const resultados = await Promise.allSettled(
        otsProceso.map(async (r) => {
          const res = await window.OTService.actualizarOT(r.id, { Estatus: 'Concluida' });

          if (res.ok) {
            const updated = {
              ...r,
              estatus: 'Concluida'
            };

            // ✅ actualizar cache
            if (window.HorasTable?._updateCache) {
              window.HorasTable._updateCache(updated);
            }

            // ✅ actualizar fila en DOM
            const tr = document.querySelector(`.hg-row[data-ot-id="${r.id}"]`);
            if (tr) {
            // 🔥 animación suave
            tr.style.transition = 'opacity .2s';
            tr.style.opacity = '0.5';

            // actualizar badge
            HorasDetail.updateRowBadge({ ...updated, id: r.id });

            // restaurar
            setTimeout(() => {
              tr.style.opacity = '1';
            }, 200);
            }

            return { ok: true };
          }

          return { ok: false };
        })
      );
      const errores = resultados.filter(r => r.status === 'rejected' || r.value?.ok === false);

      if (errores.length > 0) {
        window.ToastService?.show(
          `${errores.length} OT(s) no pudieron concluirse. Verifica e intenta de nuevo.`,
          'danger'
        );
      } else {
        window.ToastService?.show(
          `${otsProceso.length} OT(s) concluidas correctamente.`,
          'success'
        );
      }
    } catch (err) {
      console.error('[HorasGroup] Error en concluir rápido:', err);
      window.ToastService?.show('Error inesperado al concluir.', 'danger');
    } finally {
      cb.checked = false;
      _reenableAllConcludeCheckboxes();

      // Re-renderizar para reflejar los cambios
      if (typeof window.HorasTable?._rebuildGroups === 'function') {
        window.HorasTable._rebuildGroups();
      }

      // ✅ actualizar botón del mecánico
      if (window.HorasTable?._updateMecHeaderConcludeBtn) {
        window.HorasTable._updateMecHeaderConcludeBtn(mecGroup.mecId);
      }
    }
  }
  // ── FIN DE FUNCIÓN NUEVA: _ejecutarConcluirRapido ────────


  // ── INICIO DE FUNCIÓN NUEVA: _reenableAllConcludeCheckboxes
  function _reenableAllConcludeCheckboxes() {
    document.querySelectorAll('.hg-mec-conclude-cb').forEach(cb => {
      cb.disabled = false;
      const btn = cb.parentElement?.querySelector('.hg-conclude-btn');
      if (btn) btn.style.opacity = '';
    });
  }
  // ── FIN DE FUNCIÓN NUEVA: _reenableAllConcludeCheckboxes ─


  // ── INICIO DE FUNCIÓN NUEVA: _buildMecGroupsFromRows ─────
  /**
   * Construye grupos de mecánico a partir de un array de rows plano.
   * Se usa cuando el Store no provee mecGroups (agrupaciones no por día).
   */
  function _buildMecGroupsFromRows(rows) {
    const map = new Map();
    rows.forEach(r => {
      const k = r.mecId || r.mecNombre || 'Sin personal';
      if (!map.has(k)) {
        map.set(k, {
          key: r.mecNombre || 'Sin personal',
          mecId: r.mecId,
          rows: [],
          totalHoras: 0,
          totalRetraso: 0,
          hasEnProceso: false,
        });
      }
      const mg = map.get(k);
      mg.rows.push(r);
      mg.totalHoras   += r.horas;
      mg.totalRetraso += r.retraso;
      if (r.estatus === 'En Proceso') mg.hasEnProceso = true;
    });
    return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
  }
  // ── FIN DE FUNCIÓN NUEVA: _buildMecGroupsFromRows ────────


  // ── INICIO DE FUNCIÓN NUEVA: _renderPlainTable ───────────
  /**
   * Renderiza una tabla plana de filas sin agrupación adicional.
   * @param {NormalizedRow[]} rows
   * @param {boolean} isAdmin
   * @param {boolean} showEquipoTrabajo — muestra columna si el área la tiene
   */
  function _renderPlainTable(rows, isAdmin, showEquipoTrabajo) {
    const wrap = document.createElement('div');
    wrap.className = 'hg-table-wrap';
    wrap.innerHTML = `
      <table class="hg-table">
        <thead>
          <tr>
            <th>Personal</th>
            ${isAdmin ? '<th>Área</th>' : ''}
            <th>Equipo</th>
            ${showEquipoTrabajo ? '<th>Equipo Trabajo</th>' : ''}
            <th>Trabajo a realizar</th>
            <th>Fecha</th>
            <th>Semana</th>
            <th>Horas</th>
            <th>Retraso</th>
            <th>Estatus</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => _renderRow(r, isAdmin, showEquipoTrabajo)).join('')}
        </tbody>
      </table>
    `;
    return wrap;
  }
  // ── FIN DE FUNCIÓN NUEVA: _renderPlainTable ──────────────


  // ── INICIO DEL CAMBIO EN _renderRow ─────────────────────
  /**
   * @param {NormalizedRow} r
   * @param {boolean} isAdmin
   * @param {boolean} showEquipoTrabajo — columna condicional por área
   */
  function _renderRow(r, isAdmin, showEquipoTrabajo = false) {
    const meta = _estatusMeta(r.estatus);
    return `
      <tr class="hg-row" data-ot-id="${_escHtml(r.id || r.origenRef)}">
        <td class="hg-mec">
          <span class="hg-mec-name">${_escHtml(r.mecNombre || '—')}</span>
        </td>
        ${isAdmin ? `<td><span class="hg-area-tag">${_escHtml(r.area || r.mecArea || '—')}</span></td>` : ''}
        <td>
          <span class="hg-equipo">${_escHtml(r.equipo)}</span>
        </td>
        ${showEquipoTrabajo ? `
        <td>
          <span class="hg-equipo-trabajo">${_escHtml(r.equipoTrabajo || '—')}</span>
        </td>` : ''}
        <td>
          <span class="hg-descripcion">${_escHtml(r.descripcion)}</span>
        </td>
        <td class="hg-fecha">${_formatFecha(r.fecha)}</td>
        <td class="hg-semana">${_escHtml(r.semana || '—')}</td>
        <td class="hg-horas">${_fmt(r.horas)}<span class="hg-unit">h</span></td>
        <td class="${r.retraso > 0 ? 'hg-retraso-val' : 'hg-muted'}">
          ${r.retraso > 0 ? _fmt(r.retraso) + '<span class="hg-unit">h</span>' : '—'}
        </td>
        <td>
          <button class="hg-btn-status-change"
            data-ot-id="${_escHtml(r.id || r.origenRef)}"
            data-current-status="${_escHtml(r.estatus)}"
            style="background:none;border:none;cursor:pointer;padding:0;display:inline-flex;align-items:center;">
            <span class="hg-estatus ${meta.cls}">
              <span class="hg-dot" style="background:${meta.dot}"></span>
              ${_escHtml(r.estatus)}
            </span>
          </button>
        </td>
        <td>
          <button class="hg-row-detail-btn" data-ot-id="${_escHtml(r.id || r.origenRef)}" title="Editar OT">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Editar
          </button>
        </td>
      </tr>
    `;
  }
  // ── FIN DEL CAMBIO EN _renderRow ────────────────────────

  function _escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { render,_onConcluirCheckboxActivated};
})();

window.HorasGroup = HorasGroup;