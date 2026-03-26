// ============================================================
// SG UI ATOMS — Componentes puros de presentación y UI
// ============================================================

const SGUI = (() => {
  const injectCSS = (id, rules) => {
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.innerHTML = rules;
    document.head.appendChild(style);
  };

  injectCSS('sg-ui-atoms-css', `
    .sg-badge-atom { padding: 0.25rem 0.6rem; border-radius: 99px; font-size: 0.75rem; font-weight: 600; display: inline-flex; align-items: center; gap: 0.3rem; }
    .st-prog { background: #F3F4F6; color: #4B5563; }
    .st-proc { background: #E0F2FE; color: #0284C7; }
    .st-conc { background: #DCFCE7; color: #166534; }
    .sg-field-atom { display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 1rem; }
    .sg-field-label { font-size: 0.8rem; font-weight: 600; color: var(--text-muted, #6b7280); }
    .sg-field-input { padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px; font-family: inherit; font-size: 0.85rem; width: 100%; box-sizing: border-box; }
    .sg-field-input:focus { outline: none; border-color: #0284C7; box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.2); }
    .sg-edit-tag { font-size: 0.65rem; color: #0284C7; margin-left: 4px; font-weight: normal; }
    
    /* Nuevos estilos para los botones de estado */
    .sg-status-picker { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.2rem; }
    .sg-status-btn { padding: 0.4rem 0.8rem; border: 1px solid #d1d5db; border-radius: 6px; background: #fff; cursor: pointer; font-size: 0.8rem; color: #4B5563; font-weight: 500; transition: all 0.15s; font-family: inherit; }
    .sg-status-btn:hover { background: #f9fafb; border-color: #9ca3af; }
    .sg-status-btn.active { background: #E0F2FE; color: #0284C7; border-color: #0284C7; font-weight: 600; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
  `);

  const Icon = (type) => {
    const icons = {
      calendar: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
      clock: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
      plus: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
      edit: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
      save: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`
    };
    return icons[type] || '';
  };

  const Badge = (status) => {
    const s = (status || 'Programado').toLowerCase();
    let cls = 'st-prog';
    if (s.includes('proceso')) cls = 'st-proc';
    if (s.includes('concluida')) cls = 'st-conc';
    return `<span class="sg-badge-atom ${cls}"><span class="ot-status-dot"></span>${status}</span>`;
  };

  // Selector de Estado en forma de Botones
  const StatusPicker = ({ id, label, value, options = [], isEditMode = false, canEdit = false }) => {
    if (!isEditMode || !canEdit) {
      return `
        <div class="ot-modal-field" style="grid-column: 1 / -1;">
          <div class="ot-modal-label">${label}</div>
          <div class="ot-modal-val">${Badge(value)}</div>
        </div>
      `;
    }

    return `
      <div class="ot-modal-field" style="grid-column: 1 / -1;">
        <div class="ot-modal-label">${label} <span class="sg-edit-tag">(editable)</span></div>
        <div class="sg-status-picker" id="${id}">
          ${options.map(o => `
            <button type="button" class="sg-status-btn ${o.value === value ? 'active' : ''}" data-sg-status="${o.value}">
              ${o.label}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  };

  const EditableField = ({ id, label, value, type = 'text', options = [], isEditMode = false, canEdit = false, placeholder = '', fullWidth = false }) => {
    if (!isEditMode || !canEdit) {
      let displayVal = value || '—';
      if (type === 'select' && value !== undefined && value !== null) {
        const opt = options.find(o => String(o.value) === String(value));
        if (opt) displayVal = opt.label;
      }
      return `
        <div class="ot-modal-field" ${fullWidth ? 'style="grid-column: 1 / -1;"' : ''}>
          <div class="ot-modal-label">${label}</div>
          <div class="ot-modal-val" ${type==='textarea' ? 'style="white-space: pre-wrap;"' : ''}>${displayVal}</div>
        </div>
      `;
    }

    let inputHtml = '';
    if (type === 'select') {
      inputHtml = `<select id="${id}" data-sg-edit class="sg-field-input">
        ${options.map(o => `<option value="${o.value}" ${String(o.value) === String(value) ? 'selected' : ''}>${o.label}</option>`).join('')}
      </select>`;
    } else if (type === 'textarea') {
      inputHtml = `<textarea id="${id}" data-sg-edit class="sg-field-input" rows="3" placeholder="${placeholder}">${value || ''}</textarea>`;
    } else {
      inputHtml = `<input type="${type}" id="${id}" data-sg-edit class="sg-field-input" placeholder="${placeholder}" value="${value || ''}" />`;
    }

    return `
      <div class="ot-modal-field" ${fullWidth ? 'style="grid-column: 1 / -1;"' : ''}>
        <div class="ot-modal-label">${label} <span class="sg-edit-tag">(editable)</span></div>
        ${inputHtml}
      </div>
    `;
  };

  return { Icon, Badge, StatusPicker, EditableField, injectCSS };
})();
window.SGUI = SGUI;