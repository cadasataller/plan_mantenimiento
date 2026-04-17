const SGListComponent = (() => {
  let _container = null;
  let _onNewManual = null;
  let _instanceId = null; // ID único para evitar conflictos

  // ── Estado interno ────────────────────────────────────────
  let _search = '';
  let _filter = 'todos';      // 'todos' | 'proceso' | 'concluidas' | 'atrasadas' | 'pendientes' | 'proximos' | 'detenido'
  let _groupBySemana = false; // Desactivado por defecto
  let _concluidosOpen = false; // Toggle de concluidos cerrado por defecto
  let _semanaOpenMap  = {};    // uid → boolean, todos cerrados por defecto

  // ── Helper para IDs únicos ────────────────────────────────
  function _makeId(name) {
    return `${_instanceId}__${name}`;
  }

  // ══════════════════════════════════════════════════════════
  // MOUNT — punto de entrada
  // ══════════════════════════════════════════════════════════
  async function mount(containerId, callbacks) {
    _container = document.getElementById(containerId);
    _instanceId = containerId; // Usar el container ID como namespace
    _onNewManual = callbacks?.onNewManual;

    // Reset de estado al montar
    _search = '';
    _filter = 'todos';
    _groupBySemana = false;
    _concluidosOpen = false;
    _semanaOpenMap  = {};

    _renderShell();
    _bindStaticEvents();
    _showLoading();

    const sgs = await SGService.fetchSGs();
    _renderKPIs(sgs);
    _renderList(sgs);
  }

  // ══════════════════════════════════════════════════════════
  // REFRESH — recarga sin destruir el modal abierto
  // ══════════════════════════════════════════════════════════
  async function refresh(force = false) {
    if (!_container) return;

    const refreshBtn = document.getElementById(_makeId('btn-refresh'));
    const refreshIcon = document.getElementById('btn-sg-refresh-icon');

    if (force) {
      if (refreshBtn) refreshBtn.disabled = true;
      if (refreshIcon) refreshIcon.classList.add('sg-list-spinning');
      _showLoading();
    }

    const sgs = await SGService.fetchSGs(force);

    if (force) {
      if (refreshBtn) refreshBtn.disabled = false;
      if (refreshIcon) refreshIcon.classList.remove('sg-list-spinning');
    }

    _renderKPIs(sgs);
    _renderList(sgs);
  }

  // ══════════════════════════════════════════════════════════
  // SHELL — estructura HTML estática
  // ══════════════════════════════════════════════════════════
  function _renderShell() {
    const user = window.AuthService?.getUser() || {};
    const uArea = String(user.Area || user.area || user.Área || '').trim().toUpperCase();
    const showNewBtn = uArea !== 'SERVICIOS GENERALES';

    _injectCSS();

    _container.innerHTML = `
      <div class="sgl-shell">

        <!-- TOP BAR: buscador + botones -->
        <div class="sgl-topbar">
          <div class="sgl-search-wrap">
            <svg class="sgl-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              id="${_makeId('search-input')}"
              class="sgl-search"
              type="search"
              placeholder="Buscar por ID, equipo, descripción…"
              autocomplete="off"
              value="${_escH(_search)}"
            />
          </div>
          <button class="sgl-btn" id="${_makeId('btn-refresh')}" title="Actualizar lista">
            <svg id="${_makeId('btn-refresh-icon')}" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
          </button>
          
          <button class="sgl-btn sgl-btn-primary" id="${_makeId('btn-new-manual')}">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Nueva SG
          </button>
        </div>

        <!-- KPI CARDS — filtros clickeables -->
        <div class="sgl-kpi-row" id="${_makeId('kpi-row')}">
          ${_buildKPISkeleton()}
        </div>

        <!-- AGRUPADOR POR SEMANA -->
        <div class="sgl-grp-bar">
          <div class="sgl-grp-toggle" id="${_makeId('grp-toggle')}" role="button" tabindex="0" aria-label="Agrupar por semana">
            <div class="sgl-grp-switch${_groupBySemana ? ' on' : ''}" id="${_makeId('grp-switch')}"></div>
            <span class="sgl-grp-label">Agrupar por semana</span>
          </div>
        </div>

        <!-- CUERPO DE LA LISTA -->
        <div id="${_makeId('list-body')}"></div>

      </div>

      <!-- Raíz del modal SG -->
      <div id="sg-modal-root"></div>
    `;
  }

  // ══════════════════════════════════════════════════════════
  // EVENTOS ESTÁTICOS (se bindean una sola vez)
  // ══════════════════════════════════════════════════════════
  function _bindStaticEvents() {
    // Buscador
    document.getElementById(_makeId('search-input'))?.addEventListener('input', e => {
      _search = e.target.value;
      _reRender();
    });

    // Botón refresh
    document.getElementById(_makeId('btn-refresh'))?.addEventListener('click', () => {
      refresh(true);
    });

    // Botón nueva SG manual
    document.getElementById(_makeId('btn-new-manual'))?.addEventListener('click', () => {
      if (_onNewManual) _onNewManual();
    });

    // Toggle agrupador
    const toggle = document.getElementById(_makeId('grp-toggle'));
    toggle?.addEventListener('click', _handleGroupToggle);
    toggle?.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') _handleGroupToggle(); });
  }

  function _handleGroupToggle() {
    _groupBySemana = !_groupBySemana;
    document.getElementById(_makeId('grp-switch'))?.classList.toggle('on', _groupBySemana);
    _reRender();
  }

  // ══════════════════════════════════════════════════════════
  // RE-RENDER (usa caché del servicio, sin nueva fetch)
  // ══════════════════════════════════════════════════════════
  function _reRender() {
    const sgs = SGService.getCache();
    _renderKPIs(sgs);
    _renderList(sgs);
  }

  // ══════════════════════════════════════════════════════════
  // ESTADO LOADING
  // ══════════════════════════════════════════════════════════
  function _showLoading() {
    const body = document.getElementById(_makeId('list-body'));
    if (body) {
      body.innerHTML = `
        <div style="padding: 3rem; text-align: center; color: var(--sgl-text-muted);">
          <div class="sgl-spinner" style="margin: 0 auto 1rem auto;"></div>
          Cargando órdenes…
        </div>`;
    }
  }

  // ══════════════════════════════════════════════════════════
  // FILTRADO
  // ══════════════════════════════════════════════════════════
  function _applySearch(sgs) {
    if (!_search.trim()) return sgs;
    const q = _search.toLowerCase();
    return sgs.filter(sg => {
      const om = sg.ORDEN_MANTENIMIENTO || {};
      return (
        String(om['ID_Orden mantenimiento'] || '').toLowerCase().includes(q) ||
        String(om['ID_#EQUIPO'] || '').toLowerCase().includes(q) ||
        String(om.Descripcion  || '').toLowerCase().includes(q)
      );
    });
  }

  function _applyFilter(sgs) {
    switch (_filter) {
      case 'proceso':   return sgs.filter(sg => sg.Estatus === 'En Proceso');
      case 'concluidas':return sgs.filter(sg => sg.Estatus === 'Concluida');
      case 'atrasadas': return sgs.filter(sg => _isAtrasado(sg));
      case 'pendientes':return sgs.filter(sg => _isPendiente(sg));
      case 'proximos':  return sgs.filter(sg => _isProximo(sg));
      case 'detenido':  return sgs.filter(sg => sg.Estatus === 'Detenido');
      default:          return sgs;
    }
  }

  function _getFiltered(sgs) {
    return _applyFilter(_applySearch(sgs));
  }

  // ══════════════════════════════════════════════════════════
  // CLASIFICADORES DE ESTADO
  // ══════════════════════════════════════════════════════════
  function _getDiffDays(fechaStr) {
    if (!fechaStr) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const f = new Date(fechaStr);
    f.setMinutes(f.getMinutes() + f.getTimezoneOffset());
    f.setHours(0, 0, 0, 0);
    return Math.round((f - today) / 86400000);
  }

  function _isPendiente(sg) {
    const e = sg.Estatus || '';
    return !e || e === 'No Programado' || e === 'Programado';
  }

  function _isAtrasado(sg) {
    if (sg.Estatus === 'Concluida') return false;
    const diff = _getDiffDays(sg.fecha_entrega);
    return diff !== null && diff < 0;
  }

  function _isProximo(sg) {
    if (sg.Estatus === 'Concluida') return false;
    const diff = _getDiffDays(sg.fecha_entrega);
    return diff !== null && diff >= 0 && diff <= 4;
  }

  // ══════════════════════════════════════════════════════════
  // KPI CARDS
  // ══════════════════════════════════════════════════════════
  function _buildKPISkeleton() {
    return ['Total','Próx. a vencer','Atrasadas','Pendientes','Detenido','En Proceso','Concluida']
      .map(l => `
        <div class="sgl-kpi">
          <div class="sgl-kpi-val">—</div>
          <div class="sgl-kpi-label">${l}</div>
        </div>`).join('');
  }

  function _renderKPIs(allSgs) {
    // Los KPIs se calculan sobre el resultado del buscador, no del filtro de KPI
    const base = _applySearch(allSgs);

    const kpis = [
      { key: 'todos',     label: 'Total',          val: base.length,                                               color: '#374151' },
      { key: 'proximos',  label: 'Próx. a vencer',  val: base.filter(sg => _isProximo(sg)).length,                color: '#7C3AED' },
      { key: 'atrasadas', label: 'Atrasadas',       val: base.filter(sg => _isAtrasado(sg)).length,                color: '#991B1B' },
      { key: 'pendientes',label: 'Pendientes',      val: base.filter(sg => _isPendiente(sg)).length,               color: '#854D0E' },
      { key: 'detenido',  label: 'Detenido',        val: base.filter(sg => sg.Estatus === 'Detenido').length,      color: '#DC2626' },
      { key: 'proceso',   label: 'En Proceso',      val: base.filter(sg => sg.Estatus === 'En Proceso').length,    color: '#0284C7' },
      { key: 'concluidas',label: 'Concluida',       val: base.filter(sg => sg.Estatus === 'Concluida').length,     color: '#166534' },
    ];

    const row = document.getElementById(_makeId('kpi-row'));
    if (!row) return;

    row.innerHTML = kpis.map(k => `
      <div class="sgl-kpi${_filter === k.key ? ' active' : ''}"
           style="--kpi-color: ${k.color}"
           data-kpi-key="${k.key}"
           role="button"
           tabindex="0"
           title="${_filter === k.key ? 'Clic para quitar filtro' : 'Clic para filtrar por ' + k.label}">
        <div class="sgl-kpi-val">${k.val}</div>
        <div class="sgl-kpi-label">
          <span class="sgl-kpi-dot"></span>${k.label}
        </div>
        ${_filter === k.key ? `<div class="sgl-kpi-active-tick">✓</div>` : ''}
      </div>`).join('');

    row.querySelectorAll('.sgl-kpi[data-kpi-key]').forEach(el => {
      const handler = () => {
        const key = el.dataset.kpiKey;
        _filter = (_filter === key) ? 'todos' : key;
        _reRender();
      };
      el.addEventListener('click', handler);
      el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') handler(); });
    });
  }

  // ══════════════════════════════════════════════════════════
  // LISTA PRINCIPAL
  // ══════════════════════════════════════════════════════════
  function _renderList(allSgs) {
    const body = document.getElementById(_makeId('list-body'));
    if (!body) return;

    const rows = _getFiltered(allSgs);

    if (!rows.length) {
      body.innerHTML = `
        <div style="padding: 2rem; text-align: center; color: var(--sgl-text-muted); font-size: 0.85rem;">
          No hay órdenes con los filtros aplicados.
        </div>`;
      return;
    }

    if (_groupBySemana) {
      body.innerHTML = _renderGroupedBySemana(rows);
    } else {
      body.innerHTML = _renderSplitList(rows);
    }

    _bindCardEvents(body);
    _bindConcluirToggle(body);
  }

  // ── Vista normal: activas (ordenadas por fecha) + toggle concluidas ─
  function _renderSplitList(rows) {
    const activas    = _sortByEntrega(rows.filter(sg => sg.Estatus !== 'Concluida'));
    const concluidas = rows.filter(sg => sg.Estatus === 'Concluida');

    let html = '';

    if (activas.length) {
      html += `<div class="sgl-section-label">Activas · ${activas.length}</div>`;
      html += activas.map(sg => _renderCard(sg)).join('');
    }

    if (concluidas.length) {
      html += `
        <div class="sgl-toggle-header" id="${_makeId('conc-toggle')}" role="button" tabindex="0">
          <svg class="sgl-toggle-chevron${_concluidosOpen ? ' open' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
          <span>Concluidas · ${concluidas.length}</span>
        </div>`;
      if (_concluidosOpen) {
        html += `<div id="${_makeId('conc-body')}">` + concluidas.map(sg => _renderCard(sg)).join('') + `</div>`;
      }
    }

    if (!activas.length && !concluidas.length) {
      html = `<div style="padding: 2rem; text-align: center; color: var(--sgl-text-muted); font-size: 0.85rem;">No hay órdenes registradas.</div>`;
    }

    return html;
  }

  // ── Vista agrupada por semana — cada semana es un toggle colapsado ─
  function _renderGroupedBySemana(rows) {
    const groups = {};
    const order  = [];
    rows.forEach(sg => {
      const k = sg.semana ? `Semana ${String(sg.semana).padStart(2, '0')}` : 'Sin semana';
      if (!groups[k]) { groups[k] = []; order.push(k); }
      groups[k].push(sg);
    });

    const keys = order.sort((a, b) => {
      if (a === 'Sin semana') return 1;
      if (b === 'Sin semana') return -1;
      return a.localeCompare(b, 'es', { numeric: true });
    });

    return keys.map(k => {
      const uid    = 'sgl-sem-' + k.replace(/\s+/g, '-');
      const sorted = _sortByEntrega(groups[k]);
      const isOpen = !!_semanaOpenMap[uid]; // false por defecto

      return `
        <div class="sgl-week-group">
          <div class="sgl-toggle-header sgl-sem-toggle" data-sem-uid="${uid}" role="button" tabindex="0">
            <svg class="sgl-toggle-chevron${isOpen ? ' open' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
            <span style="font-weight:600; color: #374151;">${k}</span>
            <span style="margin-left: auto; font-size: 0.72rem; color: #9CA3AF;">${sorted.length} orden(es)</span>
          </div>
          ${isOpen ? `<div class="sgl-sem-body" id="${uid}-body">${sorted.map(sg => _renderCard(sg)).join('')}</div>` : ''}
        </div>`;
    }).join('');
  }

  // ── Ordenar por fecha de entrega (más urgente primero) ───
  function _sortByEntrega(rows) {
    return [...rows].sort((a, b) => {
      const da = _getDiffDays(a.fecha_entrega);
      const db = _getDiffDays(b.fecha_entrega);
      // Nulos van al final
      if (da === null && db === null) return 0;
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db; // Más cercano/atrasado primero
    });
  }

  // ══════════════════════════════════════════════════════════
  // CARD INDIVIDUAL
  // ══════════════════════════════════════════════════════════
  function _renderCard(sg) {
    const om  = sg.ORDEN_MANTENIMIENTO || {};
    const obs = sg.Observaciones || '';
    const dataStr = encodeURIComponent(JSON.stringify(sg));
    const user = window.AuthService?.getUser?.() || {};
    const uArea = String(user.Area || user.area || user.Área || '').trim().toUpperCase();
    const showArea = uArea === 'SERVICIOS GENERALES' || uArea === 'ALL';

    return `
    <div class="sgl-card" data-sg-payload="${dataStr}">

  <div class="sgl-card-top">
    <div>
      <div class="sgl-card-title">${_escH(om.Descripcion.toUpperCase() || 'Sin descripción')}</div>

      <div class="sgl-card-submeta">
        <span class="sgl-card-chip">${_escH(sg.tipo_trabajo || 'Sin tipo')}</span>
        ${showArea ? `<span class="sgl-card-chip">${_escH(om['Área'] || 'Sin área')}</span>` : ''}
      </div>
    </div>

    <div class="sgl-card-id">${_escH(om['ID_#EQUIPO'] || 'N/A')}</div>
  </div>

  ${_renderDiasBadge(sg)}

  ${obs ? `<div class="sgl-card-obs"><strong>Obs:</strong> ${_escH(obs)}</div>` : ''}

  <div class="sgl-card-footer">
    <span class="sgl-card-meta">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
      ${_escH(sg.fecha_solicitud || '—')}
    </span>

    <span class="sgl-card-meta">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
      ${sg.estimacion_horas || 0}h
    </span>

    ${sg.semana ? `<span class="sgl-card-meta">Sem ${String(sg.semana).padStart(2,'0')}</span>` : ''}

    <span style="margin-left: auto;">${_renderStatusBadge(sg.Estatus)}</span>
  </div>

</div>  
    `;
  }

  // ── Pastilla de días ──────────────────────────────────────
  function _renderDiasBadge(sg) {
    const diasG  = sg.dias;
    const e      = sg.Estatus || '';
    const fecha  = sg.fecha_entrega || (sg.ORDEN_MANTENIMIENTO?.['Fecha Entrega'] ?? null);

    if (diasG !== null && diasG !== undefined && diasG !== '') {
      const d = parseInt(diasG, 10);
      if (d >= 0) return `<span class="sgl-dias sgl-dias-green">Días: ${d} (${d === 0 ? 'A tiempo' : 'Anticipado'})</span>`;
      return `<span class="sgl-dias sgl-dias-red">Días: ${d} (Retraso)</span>`;
    }
    if (e === 'Concluida') return `<span class="sgl-dias sgl-dias-gray">Trabajo concluido</span>`;
    if (!fecha) return `<span class="sgl-dias sgl-dias-gray">Sin fecha de entrega</span>`;

    const diff = _getDiffDays(fecha);
    if (diff === null) return '';
    if (diff > 4)       return `<span class="sgl-dias sgl-dias-green">Faltan ${diff} día(s)</span>`;
    if (diff >= 2)      return `<span class="sgl-dias sgl-dias-yellow">Faltan ${diff} día(s)</span>`;
    if (diff === 1)     return `<span class="sgl-dias sgl-dias-red">Falta 1 día</span>`;
    if (diff === 0)     return `<button class="sgl-dias sgl-dias-red sgl-dias-btn" type="button">Se entrega hoy</button>`;
    return `<span class="sgl-dias sgl-dias-red">Retraso de ${Math.abs(diff)} día(s)</span>`;
  }

  function _renderStatusBadge(estatus) {
    if (!estatus || estatus === 'No Programado') return `<span class="sgl-badge sgl-badge-none">No Programado</span>`;
    if (estatus === 'Programado') return `<span class="sgl-badge sgl-badge-prog"><span class="sgl-badge-dot"></span>Programado</span>`;
    if (estatus === 'En Proceso') return `<span class="sgl-badge sgl-badge-proc"><span class="sgl-badge-dot"></span>En Proceso</span>`;
    if (estatus === 'Concluida')  return `<span class="sgl-badge sgl-badge-conc"><span class="sgl-badge-dot"></span>Concluida</span>`;
    if (estatus === 'Detenido')   return `<span class="sgl-badge sgl-badge-det"><span class="sgl-badge-dot"></span>Detenido</span>`;
    return `<span class="sgl-badge sgl-badge-none">${_escH(estatus)}</span>`;
  }

  // ══════════════════════════════════════════════════════════
  // EVENTOS EN LA LISTA
  // ══════════════════════════════════════════════════════════
  function _bindCardEvents(container) {
    if (container.dataset.boundCards === 'true') return;
    container.dataset.boundCards = 'true';
    
    container.addEventListener('click', e => {
      // Toggle de semana (optimizado: manipular DOM sin re-render completo)
      const semToggle = e.target.closest('.sgl-sem-toggle[data-sem-uid]');
      if (semToggle) {
        const uid = semToggle.dataset.semUid;
        _semanaOpenMap[uid] = !_semanaOpenMap[uid];
        const isOpen = _semanaOpenMap[uid];
        
        // Actualizar chevron
        const chevron = semToggle.querySelector('.sgl-toggle-chevron');
        if (chevron) chevron.classList.toggle('open', isOpen);
        
        // Crear o mostrar/ocultar body
        const bodyId = uid + '-body';
        const weekGroup = semToggle.closest('.sgl-week-group');
        let body = weekGroup?.querySelector(`#${bodyId}`);
        
        if (isOpen && !body) {
          // Crear el body con las cards (reutilizar datos cacheados)
          const sgs = SGService.getCache();
          const rows = _getFiltered(sgs);
          const semanaNum = uid.replace('sgl-sem-', '').replace(/-/g, ' ');
          const grouped = {};
          rows.forEach(sg => {
            const k = sg.semana ? `Semana ${String(sg.semana).padStart(2, '0')}` : 'Sin semana';
            if (!grouped[k]) grouped[k] = [];
            grouped[k].push(sg);
          });
          const items = grouped[semanaNum] || [];
          if (items.length > 0) {
            const bodyHtml = items.map(sg => _renderCard(sg)).join('');
            body = document.createElement('div');
            body.id = bodyId;
            body.className = 'sgl-sem-body';
            body.innerHTML = bodyHtml;
            weekGroup?.appendChild(body);
            _bindCardEventsToBody(body);
          }
        } else if (body) {
          body.style.display = isOpen ? 'block' : 'none';
        }
        e.stopPropagation();
        return;
      }
      // Abrir modal de card
      const card = e.target.closest('.sgl-card[data-sg-payload]');
      if (!card) return;
      try {
        const sg = JSON.parse(decodeURIComponent(card.dataset.sgPayload));
        if (window.SGModalComponent) SGModalComponent.open(sg);
      } catch(err) {
        console.error('[SGListComponent] Error al abrir modal', err);
      }
    });
  }

  function _bindCardEventsToBody(body) {
    body.addEventListener('click', e => {
      const card = e.target.closest('.sgl-card[data-sg-payload]');
      if (!card) return;
      try {
        const sg = JSON.parse(decodeURIComponent(card.dataset.sgPayload));
        if (window.SGModalComponent) SGModalComponent.open(sg);
      } catch(err) {
        console.error('[SGListComponent] Error al abrir modal', err);
      }
    });
  }

  function _bindConcluirToggle(container) {
    const toggleBtn = container.querySelector('#' + _makeId('conc-toggle'));
    if (!toggleBtn) return;
    const handler = () => {
      _concluidosOpen = !_concluidosOpen;
      _reRender();
    };
    toggleBtn.addEventListener('click', handler);
    toggleBtn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') handler(); });
  }

  // ══════════════════════════════════════════════════════════
  // UTILIDADES
  // ══════════════════════════════════════════════════════════
  function _escH(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  // ══════════════════════════════════════════════════════════
  // CSS
  // ══════════════════════════════════════════════════════════
  function _injectCSS() {
    const ID = 'sg-list-component-css';
    if (document.getElementById(ID)) return;
    const style = document.createElement('style');
    style.id = ID;
    style.innerHTML = `
      /* ── Shell ── */
      .sgl-shell { padding: 1.5rem; max-width: 1200px; margin: 0 auto; }

      /* ── Top bar ── */
      .sgl-topbar { display: flex; gap: 8px; align-items: center; margin-bottom: 1rem; }
      .sgl-search-wrap { flex: 1; position: relative; min-width: 0; }
      .sgl-search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #9CA3AF; width: 14px; height: 14px; pointer-events: none; }
      .sgl-search { width: 100%; height: 36px; padding: 0 12px 0 34px; border: 1px solid #d1d5db; border-radius: 6px; background: #fff; color: #111827; font-size: 0.85rem; font-family: inherit; outline: none; transition: border-color .15s, box-shadow .15s; }
      .sgl-search:focus { border-color: #0284C7; box-shadow: 0 0 0 2px rgba(2,132,199,.15); }

      .sgl-btn { height: 36px; padding: 0 12px; border: 1px solid #d1d5db; border-radius: 6px; background: #fff; color: #374151; font-size: 0.85rem; font-family: inherit; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; transition: background .12s; }
      .sgl-btn:hover { background: #f9fafb; }
      .sgl-btn:disabled { opacity: .5; cursor: not-allowed; }
      .sgl-btn-primary { background: #0284C7; color: #fff; border-color: #0284C7; }
      .sgl-btn-primary:hover { background: #0369a1; }

      @keyframes sgl-spin { to { transform: rotate(360deg); } }
      .sgl-list-spinning { animation: sgl-spin .7s linear infinite; }

      /* ── KPI row ── */
      .sgl-kpi-row { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; margin-bottom: 1rem; }
      @media (max-width: 800px) { .sgl-kpi-row { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
      @media (max-width: 500px) { .sgl-kpi-row { grid-template-columns: repeat(2, minmax(0, 1fr)); } }

      .sgl-kpi { background: #F9FAFB; border-radius: 8px; padding: .65rem .85rem; cursor: pointer; border: 1.5px solid transparent; transition: border-color .15s, background .15s; position: relative; user-select: none; }
      .sgl-kpi:hover { background: #F3F4F6; }
      .sgl-kpi.active { border-color: var(--kpi-color, #0284C7); background: #fff; box-shadow: 0 0 0 3px color-mix(in srgb, var(--kpi-color, #0284C7) 12%, transparent); }
      .sgl-kpi-val { font-size: 1.35rem; font-weight: 600; color: var(--kpi-color, #374151); line-height: 1; margin-bottom: 3px; }
      .sgl-kpi-label { font-size: 0.72rem; color: #6B7280; display: flex; align-items: center; gap: 4px; }
      .sgl-kpi-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--kpi-color, #9CA3AF); display: inline-block; flex-shrink: 0; }
      .sgl-kpi-active-tick { position: absolute; top: 6px; right: 8px; font-size: 0.65rem; color: var(--kpi-color, #0284C7); font-weight: 700; }

      /* ── Agrupador ── */
      .sgl-grp-bar { background: #F9FAFB; border: 1px solid #e5e7eb; border-radius: 8px; padding: .5rem .85rem; margin-bottom: 1rem; display: flex; align-items: center; }
      .sgl-grp-toggle { display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; }
      .sgl-grp-switch { width: 34px; height: 20px; border-radius: 10px; background: #D1D5DB; position: relative; transition: background .2s; flex-shrink: 0; }
      .sgl-grp-switch.on { background: #0284C7; }
      .sgl-grp-switch::after { content:''; width: 16px; height: 16px; border-radius: 50%; background: #fff; position: absolute; top: 2px; left: 2px; transition: left .2s; }
      .sgl-grp-switch.on::after { left: 16px; }
      .sgl-grp-label { font-size: 0.82rem; color: #4B5563; }

      /* ── Secciones ── */
      .sgl-section-label { font-size: 0.72rem; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: .06em; padding: .5rem 0 .4rem; }
      .sgl-week-group { margin-bottom: 1.25rem; }
      .sgl-week-header { font-size: 0.75rem; font-weight: 600; color: #6B7280; padding: .25rem .5rem; background: #F3F4F6; border-radius: 4px; margin-bottom: .4rem; display: flex; justify-content: space-between; align-items: center; }

      /* ── Toggle concluidos ── */
      .sgl-toggle-header { display: flex; align-items: center; gap: 8px; padding: .5rem .75rem; border-radius: 8px; background: #F9FAFB; border: 1px solid #e5e7eb; cursor: pointer; margin-bottom: .5rem; user-select: none; font-size: 0.83rem; color: #6B7280; margin-top: 1rem; }
      .sgl-toggle-header:hover { background: #F3F4F6; }
      .sgl-toggle-chevron { width: 14px; height: 14px; transition: transform .2s; flex-shrink: 0; }
      .sgl-toggle-chevron.open { transform: rotate(180deg); }

      /* ── Card ── */
      .sgl-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: .875rem 1rem; margin-bottom: .5rem; cursor: pointer; transition: transform .12s, box-shadow .12s, border-color .12s; }
      .sgl-card:hover { transform: translateY(-1px); box-shadow: 0 2px 8px rgba(0,0,0,.07); border-color: #d1d5db; }
      .sgl-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: .4rem; }
      .sgl-card-title { font-size: 0.875rem; font-weight: 600; color: #111827; line-height: 1.3; }
      .sgl-card-id { font-size: 0.72rem; color: #6B7280; font-family: monospace; background: #F3F4F6; padding: .15rem .4rem; border-radius: 4px; white-space: nowrap; flex-shrink: 0; }
      .sgl-card-obs { font-size: 0.8rem; color: #4B5563; margin-bottom: .4rem; }
      .sgl-card-footer { display: flex; gap: 10px; align-items: center; border-top: 1px solid #F3F4F6; padding-top: .5rem; flex-wrap: wrap; }
      .sgl-card-meta { display: flex; align-items: center; gap: 3px; font-size: 0.75rem; color: #9CA3AF; }
      .sgl-card-meta svg { width: 12px; height: 12px; flex-shrink: 0; }

      /* ── Pastilla días ── */
      .sgl-dias { display: inline-block; padding: .13rem .45rem; border-radius: 4px; font-size: 0.72rem; font-weight: 600; margin-bottom: .4rem; }
      .sgl-dias-green  { background: #DCFCE7; color: #166534; }
      .sgl-dias-yellow { background: #FEF9C3; color: #854D0E; }
      .sgl-dias-red    { background: #FEE2E2; color: #991B1B; }
      .sgl-dias-gray   { background: #F3F4F6; color: #6B7280; font-style: italic; font-weight: 400; }
      .sgl-dias-btn { border: none; background: inherit; color: inherit; cursor: pointer; padding: .13rem .45rem; border-radius: 4px; font-size: 0.72rem; font-weight: 600; transition: all .15s; font-family: inherit; }
      .sgl-dias-btn:hover { transform: scale(1.05); box-shadow: 0 1px 4px rgba(153,27,27,.2); }
      .sgl-dias-btn:active { transform: scale(0.98); }

      /* ── Status badge ── */
      .sgl-badge { display: inline-flex; align-items: center; gap: 4px; padding: .15rem .5rem; border-radius: 99px; font-size: 0.72rem; font-weight: 600; }
      .sgl-badge-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; opacity: .7; }
      .sgl-badge-none { background: #F3F4F6; color: #9CA3AF; }
      .sgl-badge-prog  { background: #F3F4F6; color: #4B5563; }
      .sgl-badge-proc  { background: #E0F2FE; color: #0284C7; }
      .sgl-badge-conc  { background: #DCFCE7; color: #166534; }
      .sgl-badge-det   { background: #FEE2E2; color: #DC2626; }

      /* ── Spinner ── */
      .sgl-spinner { width: 28px; height: 28px; border: 3px solid #e5e7eb; border-top-color: #0284C7; border-radius: 50%; animation: sgl-spin .8s linear infinite; }
    `;
    document.head.appendChild(style);
  }

  // ── API pública ───────────────────────────────────────────
  return { mount, refresh };
})();

window.SGListComponent = SGListComponent;