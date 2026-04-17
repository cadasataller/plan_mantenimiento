// ============================================================
// CADASA TALLER — CONFIRM MODAL (genérico y personalizable)
// ============================================================
//
// Uso:
//   ConfirmModal.show({
//     title:        'Concluir orden',          // obligatorio
//     message:      'Esta acción marcará...',  // obligatorio
//     confirmLabel: 'Sí, concluir',            // opcional, default 'Confirmar'
//     cancelLabel:  'Cancelar',                // opcional, default 'Cancelar'
//     variant:      'success' | 'warning' | 'danger' | 'info',  // opcional, default 'success'
//     warning:      'Texto de aviso extra...',  // opcional, muestra banner amarillo
//     onConfirm:    () => { ... },             // obligatorio
//     onCancel:     () => { ... },             // opcional
//   });
//
// Backward-compat (firma antigua):
//   ConfirmConcluirModal.show(callbackFn, taskPendent)
// ============================================================

const ConfirmModal = (() => {

  // ── Paleta de variantes ──────────────────────────────────
  const VARIANTS = {
    success: {
      iconBg:     'var(--color-success-bg, #E8F5ED)',
      iconStroke: 'var(--color-success, #2D8A4E)',
      btnBg:      '#166534',
      btnBorder:  '#155d48',
      icon: `<polyline points="20 6 9 17 4 12"/>`,
    },
    warning: {
      iconBg:     'rgba(245,158,11,0.12)',
      iconStroke: '#f59e0b',
      btnBg:      '#b45309',
      btnBorder:  '#92400e',
      icon: `<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>`,
    },
    danger: {
      iconBg:     'var(--color-danger-bg, #FDECEA)',
      iconStroke: 'var(--color-danger, #C0392B)',
      btnBg:      '#991b1b',
      btnBorder:  '#7f1d1d',
      icon: `<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>`,
    },
    info: {
      iconBg:     'var(--color-info-bg, #E3F0FA)',
      iconStroke: 'var(--color-info, #1A6B9A)',
      btnBg:      '#1A6B9A',
      btnBorder:  '#145a83',
      icon: `<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>`,
    },
  };

  let _opts = null;

  // ── API pública ──────────────────────────────────────────

  /**
   * @param {Object|Function} optsOrCallback
   *   Objeto de opciones, o función callback (firma legacy).
   * @param {boolean} [taskPendent]
   *   Segundo argumento legacy.
   */
  function show(optsOrCallback, taskPendent = false) {
    // Soporte firma legacy: show(fn, bool)
    if (typeof optsOrCallback === 'function') {
      _opts = {
        title:        'Concluir orden',
        message:      'Esta acción marcará la orden como <strong>Concluida</strong>.',
        confirmLabel: 'Sí, concluir',
        cancelLabel:  'Cancelar',
        variant:      'success',
        warning:      taskPendent
          ? 'Tienes OTs en ausencia o retraso.'
          : 'Asegúrate de que todas las OTs estén cerradas antes de continuar.',
        warningType:  taskPendent ? 'warning' : 'info',
        onConfirm:    optsOrCallback,
      };
    } else {
      _opts = {
        title:        'Confirmar',
        confirmLabel: 'Confirmar',
        cancelLabel:  'Cancelar',
        variant:      'success',
        ...optsOrCallback,
      };
    }

    _render();
  }

  // ── Render ───────────────────────────────────────────────
  function _render() {
    const existing = document.getElementById('confirm-modal-root');
    if (existing) existing.remove();

    const v = VARIANTS[_opts.variant] || VARIANTS.success;

    // Banner de aviso (warning / info)
    let bannerHtml = '';
    if (_opts.warning) {
      const isWarn = _opts.warningType === 'warning';
      bannerHtml = `
        <div style="
          background:${isWarn ? 'rgba(245,158,11,0.12)' : 'var(--color-info-bg,#E3F0FA)'};
          border:1px solid ${isWarn ? 'rgba(245,158,11,0.35)' : 'var(--color-info,#1A6B9A)'};
          border-radius:8px; padding:0.75rem 0.85rem; margin-bottom:1.25rem;
          font-size:12px; color:var(--text-primary,#1A1917);
          display:flex; align-items:flex-start; gap:8px;">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
               stroke="${isWarn ? '#f59e0b' : 'var(--color-info,#1A6B9A)'}" stroke-width="2.2"
               style="flex-shrink:0;margin-top:1px;">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span style="line-height:1.35;font-weight:${isWarn ? 600 : 400};">${_opts.warning}</span>
        </div>`;
    }

    const root = document.createElement('div');
    root.id = 'confirm-modal-root';
    root.style.cssText = `
      position:fixed; inset:0; width:100%; height:100%;
      z-index:99999; background:rgba(0,0,0,0.45);
      display:flex; align-items:center; justify-content:center;
      pointer-events:auto;`;

    root.innerHTML = `
      <div id="confirm-modal-box" style="
        background:var(--color-white,#fff);
        border:1px solid var(--color-gray-100,#EFEDE7);
        box-shadow:0 12px 30px rgba(0,0,0,0.25);
        border-radius:12px; padding:1.25rem;
        width:min(360px,90vw); max-width:90vw;">

        <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:1rem;">
          <div style="
            width:36px;height:36px;border-radius:50%;
            background:${v.iconBg};flex-shrink:0;margin-top:2px;
            display:flex;align-items:center;justify-content:center;">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
                 stroke="${v.iconStroke}" stroke-width="2.2">${v.icon}</svg>
          </div>
          <div style="min-width:0;">
            <p style="font-size:15px;font-weight:600;color:var(--text-primary,#1A1917);margin:0 0 6px;">
              ${_opts.title}
            </p>
            <p style="font-size:13px;color:var(--text-secondary,#4A4640);margin:0;line-height:1.5;word-break:break-word;">
              ${_opts.message}
            </p>
          </div>
        </div>

        ${bannerHtml}

        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button id="btn-confirm-no" style="
            padding:0 1rem;height:38px;font-size:13px;
            border-radius:8px;border:1px solid var(--color-second-deep,#C9C3B4);
            background:transparent;color:var(--text-primary,#1A1917);cursor:pointer;
            font-family:var(--font-body);">
            ${_opts.cancelLabel}
          </button>
          <button id="btn-confirm-si" style="
            padding:0 1.1rem;height:38px;font-size:13px;
            border-radius:8px;border:1px solid ${v.btnBorder};
            background:${v.btnBg};color:#fff;cursor:pointer;
            display:flex;align-items:center;gap:6px;font-family:var(--font-body);font-weight:600;">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none"
                 stroke="currentColor" stroke-width="2.5">${v.icon}</svg>
            ${_opts.confirmLabel}
          </button>
        </div>
      </div>`;

    document.body.appendChild(root);

    root.addEventListener('click', e => { if (e.target === root) _close(); });
    document.getElementById('btn-confirm-no').addEventListener('click', _close);
    document.getElementById('btn-confirm-si').addEventListener('click', _confirm);
    document.addEventListener('keydown', _escHandler);
  }

  function _confirm() {
    const cb = _opts?.onConfirm;
    _close();
    if (typeof cb === 'function') cb();
  }

  function _close() {
    document.removeEventListener('keydown', _escHandler);
    document.getElementById('confirm-modal-root')?.remove();
    _opts = null;
  }

  function _escHandler(e) { if (e.key === 'Escape') _close(); }

  return { show };
})();

// Alias de backward-compat
window.ConfirmModal         = ConfirmModal;
window.ConfirmConcluirModal = { show: ConfirmModal.show };