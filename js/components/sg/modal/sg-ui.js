// ============================================================
// SG UI ATOMS — Componentes puros de presentación y UI
// ============================================================

const SGUI = (() => {
  // Inyector de CSS interno
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
    .sg-field-input { padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 4px; font-family: inherit; }
  `);

  // --- Átomos ---
  
  const Icon = (type) => {
    const icons = {
      calendar: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
      clock: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
      plus: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`
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

  const Field = ({ id, label, type = 'text', required = false, placeholder = '', options = [] }) => {
    let inputHtml = '';
    if (type === 'select') {
      inputHtml = `<select id="${id}" class="sg-field-input" ${required ? 'required' : ''}>
        ${options.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
      </select>`;
    } else {
      inputHtml = `<input type="${type}" id="${id}" class="sg-field-input" placeholder="${placeholder}" ${required ? 'required' : ''} />`;
    }

    return `
      <div class="sg-field-atom">
        <label class="sg-field-label" for="${id}">${label}${required ? '*' : ''}</label>
        ${inputHtml}
      </div>
    `;
  };

  return { Icon, Badge, Field, injectCSS };
})();
window.SGUI = SGUI;