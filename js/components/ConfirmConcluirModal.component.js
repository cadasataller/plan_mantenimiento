const ConfirmConcluirModal = (() => {
  let _onConfirm = null;

  function show(onConfirm) {
    _onConfirm = onConfirm;
    _render();
  }

  function _render() {
    const existing = document.getElementById('confirm-concluir-root');
    if (existing) existing.remove();

    const root = document.createElement('div');
    root.id = 'confirm-concluir-root';
    root.style.cssText = `
      position: fixed;
      inset: 0;
      width: 100%;
      height: 100%;
      min-width: 100%;
      min-height: 100%;
      z-index: 99999;
      background: rgba(0,0,0,0.45) !important;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: auto;
    `;
    root.innerHTML = `
      <div id="confirm-concluir-box" style="
        background: var(--color-background-primary, #ffffff);
        border: 1px solid var(--color-border-tertiary, #ced4da);
        box-shadow: 0 12px 30px rgba(0,0,0,0.25);
        border-radius: 12px;
        padding: 1rem;
        width: min(340px, 90vw);
        max-width: 90vw;
        transition: all 0.15s ease;
      ">
        <div style="display:flex; align-items:flex-start; gap:12px; margin-bottom:1rem;">
            <div style="width:36px; height:36px; border-radius:50%; background:var(--color-success-bg, #E8F5ED); display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:2px;">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--color-success, #2D8A4E)" stroke-width="2.2"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div style="min-width:0;">
            <p style="font-size:15px; font-weight:600; color:var(--text-primary, #1A1917); margin:0 0 6px;">Concluir orden</p>
            <p style="font-size:13px; color:var(--text-secondary, #4A4640); margin:0; line-height:1.5; text-align:left; word-break:break-word;">
              Esta acción marcará la orden como <strong style="color:var(--text-primary, #1A1917); font-weight:600;">Concluida</strong>.
            </p>
          </div>
        </div>
        <div style="background:var(--color-info-bg, #E3F0FA); border-radius:8px; padding:0.7rem 0.85rem; margin-bottom:1.25rem; font-size:12px; color:var(--text-secondary, #4A4640); display:flex; align-items:center; gap:8px; border:1px solid var(--color-info, #1A6B9A);">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--color-info, #1A6B9A)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span style="line-height:1.35; display:inline-block;">Asegúrate de que todas las OTs estén cerradas antes de continuar.</span>
        </div>
        <div style="display:flex; gap:8px; justify-content:flex-end;">
          <button id="btn-confirm-no" style="padding:0 1rem; height:38px; font-size:13px; border-radius:8px; border:1px solid var(--color-border-secondary, #ccc); background:transparent; color:var(--color-text-primary, #111); cursor:pointer;">
            Cancelar
          </button>
          <button id="btn-confirm-si" style="padding:0 1rem; height:38px; font-size:13px; border-radius:8px; border:1px solid #155d48; background:#166534; color:#fff; cursor:pointer; display:flex; align-items:center; gap:6px;">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            Sí, concluir
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
    const callback = _onConfirm;
    _close();
    if (typeof callback === 'function') callback();
  }

  function _close() {
    document.removeEventListener('keydown', _escHandler);
    const root = document.getElementById('confirm-concluir-root');
    if (root) root.remove();
    _onConfirm = null;
  }

  function _escHandler(e) { if (e.key === 'Escape') _close(); }

  return { show };
})();

window.ConfirmConcluirModal = ConfirmConcluirModal;