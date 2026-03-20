// ============================================================
// CADASA TALLER — TOAST SERVICE
// Notificaciones no intrusivas
// ============================================================

const ToastService = (() => {
  const DURATION = 2000;

  function getContainer() {
    let c = document.getElementById('toast-container');
    if (!c) {
      c = document.createElement('div');
      c.id = 'toast-container';
      document.body.appendChild(c);
    }
    return c;
  }

  /**
   * @param {string} message
   * @param {'default'|'success'|'danger'|'warning'} type
   * @param {number} duration  ms
   */
  function show(message, type = 'default', duration = DURATION) {
    const container = getContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => dismiss(toast), duration);
    return toast;
  }

  function dismiss(toast) {
    toast.classList.add('toast-out');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }

  return { show };
})();

window.ToastService = ToastService;
