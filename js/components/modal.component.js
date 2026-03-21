// ============================================================
// CADASA TALLER — MODAL COMPONENT
// Modal de detalle de OM: Info + Gráficas + Órdenes de Trabajo
// ============================================================

const ModalComponent = (() => {

  // Colores de estado consistentes
  const STATUS_COLORS = {
    'Concluida':  { hex: '#2D8A4E', cls: 'color-concluida',  badge: 'status-completado'  },
    'En Proceso': { hex: '#1A6B9A', cls: 'color-en-proceso', badge: 'status-en-proceso'  },
    'Programado': { hex: '#B8B3A7', cls: 'color-programado', badge: 'status-programado'  },
    'Detenido':   { hex: '#C0392B', cls: 'color-detenido',   badge: 'status-pendiente'   },
  };

  // Colores para la dona
  const DONUT_ORDER = ['Concluida','En Proceso','Programado','Detenido'];

  let _currentOM  = null;
  let _activeTab  = 'info';

  // ══════════════════════════════════════════════════════════
  // ABRIR MODAL
  // ══════════════════════════════════════════════════════════
  function open(om) {
  const authenticated = true;
    _currentOM = om;
    _activeTab = 'info';

    const root = document.getElementById('ot-modal-root');
    if (!root) return;

    const omSC  = omStatusClass(om.Estatus);
    const eIdx  = ETAPA_IDX[om.TipoProceso] ?? 'x';
    const sem   = om.Semana ? `Semana ${String(om.Semana).padStart(2,'0')}` : '—';

    root.innerHTML = `
      <div class="ot-modal-backdrop" id="ot-backdrop">
        <div class="ot-modal" role="dialog" aria-modal="true">

          <!-- Cabecera -->
          <div class="ot-modal-header">
            <div class="ot-modal-header-left">
              <div class="ot-modal-id-badge">${h(om.ID_Orden)}</div>
              <div class="ot-modal-title">${h(om.Descripcion)}</div>
              <div class="ot-modal-area">
                <span>${h(om.Area)}</span>
                <span class="ot-modal-area-sep">·</span>
                <span>${h(om.ID_EQUIPO)} — ${h(om.ITEM)}</span>
                <span class="ot-modal-area-sep">·</span>
                <span>${h(om.Sistema)}</span>
              </div>
            </div>
            <div class="ot-modal-status-wrap">
              <button class="btn-modal-close" id="btn-modal-close" aria-label="Cerrar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
              <span class="ot-status ${omSC}">
                <span class="ot-status-dot"></span>${h(om.Estatus)}
              </span>
            </div>
          </div>

          <!-- Tabs internas -->
          <div class="ot-modal-tabs" id="ot-modal-tabs">
            <div class="ot-modal-tab active" data-tab="info">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Información
            </div>
            <div class="ot-modal-tab" data-tab="ots">
              <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              Órdenes de Trabajo
              <span class="dash-tab-badge" id="modal-ot-badge" style="display:none"></span>
            </div>
            <div class="ot-modal-tab" data-tab="graficas">
              <svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>
              Gráficas
            </div>
            
          </div>

          <!-- Cuerpo con tabs -->
          <div class="ot-modal-body">

            <!-- Tab: Información -->
            <div class="ot-modal-tab-panel active" id="tab-info">

              <div class="ot-modal-section">
                <div class="ot-modal-section-title">
                  <svg viewBox="0 0 24 24"><path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/><path d="M16 3H8v4h8V3z"/></svg>
                  Identificación
                </div>
                <div class="ot-modal-grid">
                  ${mf('ID de Orden',    om.ID_Orden)}
                  ${mf('Área',           om.Area)}
                  ${mf('Equipo (ID)',    om.ID_EQUIPO)}
                  ${mf('Item / Equipo', om.ITEM)}
                  ${mf('Sistema',        om.Sistema)}
                  ${mf('Tipo de Proceso','',
                    `<span class="ot-etapa-chip etapa-${eIdx}">${ETAPA_SHORT[om.TipoProceso] ?? h(om.TipoProceso||'—')}</span>`)}
                </div>
              </div>

              <div class="ot-modal-section">
                <div class="ot-modal-section-title">
                  <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  Planificación
                </div>
                <div class="ot-modal-grid">
                  ${mf('Estado','',`<span class="ot-status ${omSC}" style="font-size:0.72rem;"><span class="ot-status-dot"></span>${h(om.Estatus)}</span>`)}
                  ${mf('Semana asignada',  sem)}
                  ${mf('Fecha de inicio',  om.FechaInicio)}
                  ${mf('Fecha conclusión', om.FechaConclusion)}
                </div>
              </div>

              <div class="ot-modal-section">
                <div class="ot-modal-section-title">
                  <svg viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
                  Compras y Materiales
                </div>
                <div class="ot-modal-grid">
                  ${mf('Tiene solicitud', om.TieneSolicitud)}
                  ${mf('N° Solicitud',    om.NSolicitud)}
                  ${mf('N° Orden Compra', om.NOrdenCompra)}
                  ${mf('Fecha entrega',   om.FechaEntrega)}
                </div>
              </div>

              ${om.Observaciones ? `
              <div class="ot-modal-section">
                <div class="ot-modal-section-title">
                  <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                  Observaciones
                </div>
                <div style="font-size:0.85rem;color:var(--text-primary);line-height:1.7;
                            background:var(--color-gray-50);padding:0.85rem 1rem;
                            border-radius:var(--radius-md);border-left:3px solid var(--color-main-light);">
                  ${h(om.Observaciones)}
                </div>
              </div>` : ''}

            </div>

            <!-- Tab: OTs -->
            <div class="ot-modal-tab-panel" id="tab-ots">
              <div id="ots-content">
                <div class="ot-work-loading">
                  <div class="spinner"></div> Cargando órdenes de trabajo…
                </div>
              </div>
            </div>

            <!-- Tab: Gráficas -->
            <div class="ot-modal-tab-panel" id="tab-graficas">
              <div id="graficas-content">
                <div class="ot-work-loading">
                  <div class="spinner"></div> Calculando métricas…
                </div>
              </div>
            </div>

            

          </div>

          <!-- Footer -->
          <div class="ot-modal-footer">
            <div class="ot-modal-footer-left">
              <span style="font-size:0.72rem;color:var(--text-muted);">
                OM ${h(om.ID_Orden)}
              </span>
            </div>
            <div class="ot-modal-footer-right">
              <button class="btn-modal-secondary" id="btn-modal-footer-close">Cerrar</button>
              <button class="btn-modal-primary" id="btn-ver-ots">
                <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                Ver OTs
              </button>
            </div>
          </div>

        </div>
      </div>`;

    // ── Bind eventos ────────────────────────────────────────
    document.getElementById('btn-modal-close')?.addEventListener('click', close);
    document.getElementById('btn-modal-footer-close')?.addEventListener('click', close);
    document.getElementById('btn-ver-ots')?.addEventListener('click', () => switchTab('ots'));
    document.getElementById('ot-backdrop')?.addEventListener('click', e => {
      if (e.target === e.currentTarget) close();
    });

    // Tabs
    document.getElementById('ot-modal-tabs')?.addEventListener('click', e => {
      const tab = e.target.closest('[data-tab]');
      if (tab) switchTab(tab.dataset.tab);
    });

    document.addEventListener('keydown', escHandler);

    // Pre-cargar OTs en background
    loadOTs(om, authenticated);
  }

  // ══════════════════════════════════════════════════════════
  // SWITCH TAB
  // ══════════════════════════════════════════════════════════
  function switchTab(tabId) {
    _activeTab = tabId;
    document.querySelectorAll('.ot-modal-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.tab === tabId));
    document.querySelectorAll('.ot-modal-tab-panel').forEach(p =>
      p.classList.toggle('active', p.id === `tab-${tabId}`));
  }

  // ══════════════════════════════════════════════════════════
  // CARGAR Y RENDERIZAR OTs
  // ══════════════════════════════════════════════════════════
  async function loadOTs(om, authenticated) {
    const ots = await OTWorkStore.getForOM(om.ID_Orden, om, authenticated);

    // Actualizar badge
    const badge = document.getElementById('modal-ot-badge');
    if (badge) { badge.textContent = ots.length; badge.style.display = 'inline'; }

    // Renderizar panel OTs
    const otsEl = document.getElementById('ots-content');
    if (otsEl) otsEl.innerHTML = renderOTList(ots);

    // Renderizar gráficas
    const grafEl = document.getElementById('graficas-content');
    if (grafEl) grafEl.innerHTML = renderCharts(ots);
  }

  // ══════════════════════════════════════════════════════════
  // GRÁFICAS
  // ══════════════════════════════════════════════════════════
  function renderCharts(ots) {
    const kpis        = OTWorkStore.calcKPIs(ots);
    const omsDelEquipo = OTStore.getAll().filter(o => o.ID_EQUIPO === _currentOM.ID_EQUIPO);
    const equipos     = OTWorkStore.calcEquipoAvance(omsDelEquipo);
    const equipo      = equipos[0];

    const pctColor = kpis.pctConcluida >= 75 ? '#2D8A4E'
                   : kpis.pctConcluida >= 40 ? '#4caf50'
                   : kpis.pctConcluida >  0  ? '#81c784'
                   : '#B8B3A7';

    return `
      <!-- 1. Hero: avance general -->
      <div class="ot-chart-hero">
        <div class="ot-chart-hero-left">
          <div class="ot-chart-hero-label">Avance general</div>
          <div class="ot-chart-hero-pct">
            ${kpis.pctConcluida}<span>%</span>
          </div>
          <div class="ot-chart-hero-sub">
            ${kpis.counts['Concluida'] ?? 0} completadas de ${kpis.total} órdenes
          </div>
        </div>
        <div class="ot-chart-hero-bar-wrap">
          <div class="ot-chart-hero-track">
            <div class="ot-chart-hero-fill" style="width:${Math.max(kpis.pctConcluida, 2)}%;background:${pctColor};"></div>
          </div>
          <div class="ot-chart-hero-scale">
            <span>0%</span><span>50%</span><span>100%</span>
          </div>
        </div>
      </div>

      <!-- 2. Dona + Avance del equipo -->
      <div class="ot-charts-panel">

        <div class="ot-chart-card">
          <div class="ot-chart-card-title">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Estado de OTs
          </div>
          ${renderDonut(kpis)}
        </div>

        <div class="ot-chart-card">
          <div class="ot-chart-card-title">
            <svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>
            Avance del Equipo
          </div>
          ${equipo ? `
            <div style="padding:0.5rem 0;">
              <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:0.6rem;">
                ${equipo.equipoId} — ${equipo.item}
              </div>
              <div style="display:flex;align-items:center;gap:0.75rem;">
                <div style="flex:1;height:10px;background:var(--color-gray-100);border-radius:99px;overflow:hidden;">
                  <div style="height:100%;width:${Math.max(equipo.pct, 2)}%;background:${pctColor};border-radius:99px;transition:width 0.4s ease;"></div>
                </div>
                <span style="font-family:var(--font-mono);font-size:0.85rem;font-weight:700;color:${pctColor};min-width:36px;">
                  ${equipo.pct}%
                </span>
              </div>
              <div style="font-size:0.7rem;color:var(--text-muted);margin-top:0.4rem;">
                ${equipo.concluidas} de ${equipo.total} órdenes completadas
              </div>
            </div>`
          : `<div style="font-size:0.8rem;color:var(--text-muted);">Sin datos de equipo.</div>`}

          <!-- 3. KPIs de soporte -->
        <div class="ot-modal-kpis">
          ${mkpi(kpis.total,                    'Total OTs')}
          ${mkpi(kpis.horasTotal.toFixed(1),    'Horas totales')}
          ${mkpi(kpis.mecanicos,                'Mecánicos')}
          ${mkpi(kpis.pctConcluida + '%',       'Concluido')}
        </div>
        </div>

      </div>

      `;
  }

  function mkpi(val, label) {
    return `<div class="ot-modal-kpi">
      <div class="ot-modal-kpi-val">${val}</div>
      <div class="ot-modal-kpi-label">${label}</div>
    </div>`;
  }

  function renderDonut(kpis) {
    const total  = kpis.total || 1;
    const r      = 62; // radio
    const cx     = 80; const cy = 80;
    const circum = 2 * Math.PI * r;

    let paths    = '';
    let offset   = 0;
    let legend   = '';

    DONUT_ORDER.forEach(st => {
      const cnt   = kpis.counts[st] ?? 0;
      const pct   = cnt / total;
      const dash  = pct * circum;
      const gap   = circum - dash;
      const color = STATUS_COLORS[st]?.hex ?? '#ccc';
      const pctDisp = Math.round(pct * 100);

      paths += `
        <circle
          cx="${cx}" cy="${cy}" r="${r}"
          fill="none"
          stroke="${color}"
          stroke-width="22"
          stroke-dasharray="${dash} ${gap}"
          stroke-dashoffset="${-offset}"
          stroke-linecap="butt"
        />`;
      offset += dash;

      legend += `
        <div class="ot-legend-item">
          <span class="ot-legend-dot" style="background:${color}"></span>
          <span class="ot-legend-label">${st}</span>
          <span class="ot-legend-val">${cnt}</span>
          <span class="ot-legend-pct">${pctDisp}%</span>
        </div>`;
    });

    // Si no hay OTs, mostrar dona gris
    if (kpis.total === 0) {
      paths = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--color-gray-200)" stroke-width="22"/>`;
    }

    return `
      <div class="ot-donut-wrap">
        <div style="position:relative;display:inline-flex;align-items:center;justify-content:center;">
          <svg class="ot-donut-svg" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">
            <!-- Fondo -->
            <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--color-gray-100)" stroke-width="22"/>
            ${paths}
          </svg>
          <div class="ot-donut-center">
            <div class="ot-donut-pct">${kpis.pctConcluida}<span style="font-size:1rem;">%</span></div>
            <div class="ot-donut-pct-label">Concluido</div>
          </div>
        </div>
        <div class="ot-donut-legend">${legend}</div>
      </div>`;
  }

  function renderBarChart(equipos) {
    if (!equipos || equipos.length === 0) {
      return `<div class="ot-bar-chart-empty">Sin datos de equipos disponibles.</div>`;
    }

    // Mostrar máximo 12 equipos
    const rows = equipos.slice(0, 12);

    return `<div class="ot-bar-chart-wrap">
      ${rows.map(eq => {
        const pct      = eq.pct;
        const fillCls  = pct >= 75 ? 'high' : pct >= 40 ? 'medium' : pct > 0 ? 'low' : 'zero';
        const itemLabel = eq.item.length > 14 ? eq.item.slice(0, 13) + '…' : eq.item;
        return `
          <div class="ot-bar-row">
            <div class="ot-bar-label">
              ${itemLabel}
              <small>${eq.equipoId}</small>
            </div>
            <div class="ot-bar-track">
              <div class="ot-bar-fill ${fillCls}" style="width:${Math.max(pct,2)}%"></div>
            </div>
            <div class="ot-bar-pct">${pct}%</div>
          </div>`;
      }).join('')}
      ${equipos.length > 12
        ? `<div style="font-size:0.72rem;color:var(--text-muted);text-align:center;padding:0.5rem 0;">
             +${equipos.length - 12} equipos más…
           </div>`
        : ''}
    </div>`;
  }

  // ══════════════════════════════════════════════════════════
  // LISTA DE OTs
  // ══════════════════════════════════════════════════════════
  function renderOTList(ots) {
    if (!ots || ots.length === 0) {
      return `<div class="ot-bar-chart-empty">No hay órdenes de trabajo registradas para esta OM.</div>`;
    }

    // Totales resumen
    const totalHoras   = ots.reduce((s, ot) => s + (ot.Duracion || 0), 0);
    const totalRetraso = ots.reduce((s, ot) => s + (ot.Retraso  || 0), 0);
    const concluidas   = ots.filter(ot => ot.Estatus === 'Concluida').length;

    const summary = `
      <div style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1rem;padding:0.75rem 1rem;
                  background:var(--color-gray-50);border-radius:var(--radius-md);
                  border:1px solid var(--color-gray-100);">
        <div style="font-size:0.75rem;color:var(--text-muted);">
          <strong style="color:var(--text-primary);font-family:var(--font-mono);">${ots.length}</strong> OTs ·
          <strong style="color:var(--text-primary);font-family:var(--font-mono);">${totalHoras.toFixed(1)}h</strong> totales ·
          <strong style="color:var(--color-success);font-family:var(--font-mono);">${concluidas}</strong> concluidas
          ${totalRetraso > 0
            ? ` · <strong style="color:var(--color-danger);font-family:var(--font-mono);">${totalRetraso.toFixed(1)}h</strong> retraso acumulado`
            : ''}
        </div>
      </div>`;

    const cards = ots.map(ot => {
      const stKey    = ot.Estatus?.replace(/\s/g,'-') ?? '';
      const stColor  = STATUS_COLORS[ot.Estatus];
      const badgeCls = stColor?.badge ?? 'status-programado';
      return `
        <div class="ot-work-card st-${stKey}">
          <div class="ot-work-card-main">
            <div class="ot-work-desc">${h(ot.Descripcion)}</div>
            <div class="ot-work-meta">
              <span class="ot-work-meta-item">
                <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                ${h(ot.ID_Mecanico)}
              </span>
              <span class="ot-work-meta-item">
                <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                ${h(ot.Fecha || '—')}
              </span>
              ${ot.Semana
                ? `<span class="ot-work-meta-item">
                    <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    S${String(ot.Semana).padStart(2,'0')}
                   </span>`
                : ''}
              <span class="ot-status ${badgeCls}" style="font-size:0.63rem;">
                <span class="ot-status-dot"></span>${h(ot.Estatus)}
              </span>
            </div>
            ${ot.Causa ? `<div class="ot-work-causa">⚠ ${h(ot.Causa)}</div>` : ''}
            ${ot.Comentario
              ? `<div style="font-size:0.74rem;color:var(--text-muted);margin-top:0.3rem;
                             font-style:italic;">${h(ot.Comentario)}</div>`
              : ''}
          </div>
          <div class="ot-work-card-right">
            <div class="ot-work-horas">${ot.Duracion.toFixed(1)} <span>hrs</span></div>
            ${ot.Retraso > 0
              ? `<div class="ot-work-retraso">
                  <svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" fill="none" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  +${ot.Retraso.toFixed(1)}h retraso
                </div>`
              : ''}
          </div>
        </div>`;
    }).join('');

    return summary + `<div class="ot-work-list">${cards}</div>`;
  }

  // ══════════════════════════════════════════════════════════
  // CERRAR
  // ══════════════════════════════════════════════════════════
  function close() {
    const root = document.getElementById('ot-modal-root');
    const bd   = document.getElementById('ot-backdrop');
    document.removeEventListener('keydown', escHandler);
    _currentOM = null;
    if (bd) {
      bd.style.transition = 'opacity 0.18s ease'; bd.style.opacity = '0';
      const m = bd.querySelector('.ot-modal');
      if (m) { m.style.transition = 'all 0.18s ease'; m.style.transform = 'scale(0.95) translateY(8px)'; m.style.opacity = '0'; }
      setTimeout(() => { if (root) root.innerHTML = ''; }, 200);
    } else if (root) { root.innerHTML = ''; }
  }

  function escHandler(e) { if (e.key === 'Escape') close(); }

  // ── Helpers ──────────────────────────────────────────────
  function h(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function mf(label, val, customHtml) {
    const empty = !val || String(val).trim() === '';
    const body  = customHtml
      ? customHtml
      : `<div class="ot-modal-val${empty?' empty':''}">${empty ? '—' : h(String(val))}</div>`;
    return `<div class="ot-modal-field"><div class="ot-modal-label">${label}</div>${body}</div>`;
  }

  function omStatusClass(s) {
    return { 'Programado':'status-programado','En proceso':'status-en-proceso',
             'Completado':'status-completado','Pendiente':'status-pendiente' }[s] ?? 'status-programado';
  }

  // Referencias a constantes del OTComponent (deben estar en scope global)
  const ETAPA_IDX = {
    'Desmontaje y diagnóstico':             0,
    'Lavado e inspección':                  1,
    'Reparación o reemplazo':              2,
    'Ensamblaje y ajuste; pruebas finales': 3,
  };
  const ETAPA_SHORT = {
    'Desmontaje y diagnóstico':             'Desmontaje',
    'Lavado e inspección':                  'Lavado/Insp.',
    'Reparación o reemplazo':              'Reparación',
    'Ensamblaje y ajuste; pruebas finales': 'Ensamblaje',
  };

  return { open, close };
})();

window.ModalComponent = ModalComponent;
