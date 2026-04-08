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
    'Concluido':            { cls: 'est-success', dot: '#2D8A4E' },
    'En Proceso':           { cls: 'est-info',    dot: '#1A6B9A' },
    'Pendiente':            { cls: 'est-warning', dot: '#C97B2F' },
    'Retrasado':            { cls: 'est-danger',  dot: '#C0392B' },
    'Cancelado':            { cls: 'est-muted',   dot: '#8F8A7F' },
  };

  function _estatusMeta(estatus) {
    return ESTATUS_META[estatus] || { cls: 'est-muted', dot: '#8F8A7F' };
  }

  function _fmt(n) { return Number(n).toFixed(1); }

  function _formatFecha(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('es-PA', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  /** Convierte "2025-S05" a "Semana 05 · 2025" */
  function _formatSemana(key) {
    const m = key.match(/^(\d{4})-S(\d+)$/);
    if (m) return `Semana ${m[2]} · ${m[1]}`;
    return key;
  }

  function _formatGroupKey(key, groupBy) {
    if (groupBy === 'semana') return _formatSemana(key);
    if (groupBy === 'dia')    return _formatFecha(key + 'T00:00:00');
    return key;
  }

  // Ícono de cabecera según tipo de agrupación
  function _groupIcon(groupBy) {
    switch (groupBy) {
      case 'semana':  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
      case 'estatus': return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
      case 'area':    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`;
      case 'dia':     return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
      default:        return '';
    }
  }

  /**
   * Renderiza el grupo y devuelve un HTMLElement.
   * @param {Object} group  — { key, rows, totalHoras, totalRetraso }
   * @param {Object} opts   — { isAdmin, groupBy }
   */
  function render(group, opts = {}) {
    const { isAdmin = false, groupBy = 'semana' } = opts;
    const wrap = document.createElement('div');
    wrap.className = 'hg-group';

    const collapsed = false; // se puede persistir en localStorage si se quiere

    const label   = _formatGroupKey(group.key, groupBy);
    const count   = group.rows.length;
    const hTotal  = _fmt(group.totalHoras);
    const rTotal  = _fmt(group.totalRetraso);

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

      <div class="hg-body">
        <div class="hg-table-wrap">
          <table class="hg-table">
            <thead>
              <tr>
                <th>Personal</th>
                ${isAdmin ? '<th>Área</th>' : ''}
                <th>Origen</th>
                <th>Fecha</th>
                <th>Semana</th>
                <th class="text-right">Horas</th>
                <th class="text-right">Retraso</th>
                <th>Estatus</th>
              </tr>
            </thead>
            <tbody>
              ${group.rows.map(r => _renderRow(r, isAdmin)).join('')}
            </tbody>
            
          </table>
        </div>
      </div>
    `;

    // Después de construir wrap.innerHTML, antes del bloque de eventos:
    if (group.subGroups && group.subGroups.length > 0) {
      const body = wrap.querySelector('.hg-body');
      body.innerHTML = ''; // reemplaza la tabla plana por sub-grupos

      group.subGroups.forEach(sg => {
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
          <div class="hg-subgroup-body">
            <div class="hg-table-wrap">
              <table class="hg-table">
                <thead><tr>
                  <th>Mecánico</th>
                  <th>Origen</th>
                  <th class="text-right">Horas</th>
                  <th class="text-right">Retraso</th>
                  <th>Estatus</th>
                </tr></thead>
                <tbody>${sg.rows.map(r => _renderRow(r, false)).join('')}</tbody>
              </table>
            </div>
          </div>
        `;

        // toggle sub-grupo
        const subHeader = sgEl.querySelector('.hg-subgroup-header');
        const subBody   = sgEl.querySelector('.hg-subgroup-body');
        const subChevron = sgEl.querySelector('.hg-sub-chevron');

        subHeader.dataset.expanded = 'false';
        subBody.style.maxHeight = '0';
        subBody.style.opacity = '0';
        subBody.style.overflow = 'hidden';
        subChevron.style.transform = 'rotate(-90deg)';

        sgEl.querySelector('.hg-subgroup-header').addEventListener('click', e => {
          e.stopPropagation();
          const open = subHeader.dataset.expanded === 'true';
          subHeader.dataset.expanded = open ? 'false' : 'true';
          subBody.style.maxHeight  = open ? '0' : '';
          subBody.style.opacity    = open ? '0' : '1';
          subBody.style.overflow   = open ? 'hidden' : '';
          subChevron.style.transform = open ? 'rotate(-90deg)' : '';
        });

        body.appendChild(sgEl);
      });
    }

    // Toggle colapsar/expandir
    const header  = wrap.querySelector('.hg-header');
    const body    = wrap.querySelector('.hg-body');
    const chevron = wrap.querySelector('.hg-chevron');
    //const toggleBtn = wrap.querySelector('.hg-toggle');

    header.dataset.expanded = 'false';
    body.style.maxHeight = '0';
    body.style.opacity = '0';
    body.style.overflow = 'hidden';
    chevron.style.transform = 'rotate(-90deg)';

    header.addEventListener('click', (e) => {
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

  function _renderRow(r, isAdmin) {
    const meta = _estatusMeta(r.estatus);
    return `
      <tr class="hg-row">
        <td class="hg-mec">
          <span class="hg-mec-name">${_escHtml(r.mecNombre || '—')}</span>
        </td>
        ${isAdmin ? `<td><span class="hg-area-tag">${_escHtml(r.area || r.mecArea || '—')}</span></td>` : ''}
        <td>
          <span class="hg-origen hg-origen-${r.origen.toLowerCase()}">${r.origen}</span>
          <span class="hg-ref">${_escHtml(String(r.origenRef || '').slice(0,8))}</span>
        </td>
        <td class="hg-fecha">${_formatFecha(r.fecha)}</td>
        <td class="hg-semana">${_escHtml(r.semana || '—')}</td>
        <td class="text-right hg-horas">${_fmt(r.horas)}<span class="hg-unit">h</span></td>
        <td class="text-right ${r.retraso > 0 ? 'hg-retraso-val' : 'hg-muted'}">${r.retraso > 0 ? _fmt(r.retraso) + '<span class="hg-unit">h</span>' : '—'}</td>
        <td>
          <span class="hg-estatus ${meta.cls}">
            <span class="hg-dot" style="background:${meta.dot}"></span>
            ${_escHtml(r.estatus)}
          </span>
        </td>
      </tr>
    `;
  }

  function _escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { render };
})();

window.HorasGroup = HorasGroup;