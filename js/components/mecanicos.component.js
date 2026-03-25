// ============================================================
// CADASA TALLER — MECANICO SELECT COMPONENT
// Maneja la carga, renderizado y validación de la lista de mecánicos
// ============================================================

const MecanicoSelectComponent = (() => {
  let _cache = null;
  let _isLoading = false;

  // ── 1. Inyectar CSS propio ──
  function _injectCSS() {
    if (document.getElementById('mecanico-select-css')) return;
    const style = document.createElement('style');
    style.id = 'mecanico-select-css';
    style.textContent = `
      .mecanico-wrapper { position: relative; width: 100%; }
      .mecanico-select { width: 100%; padding: 0.45rem 0.65rem; font-size: 0.82rem; font-family: var(--font-body); color: var(--text-primary); background: var(--color-white); border: 1.5px solid var(--color-gray-200); border-radius: var(--radius-md); outline: none; appearance: auto; cursor: pointer; transition: all 0.2s; }
      .mecanico-select:focus { border-color: var(--color-main); box-shadow: 0 0 0 3px rgba(26,107,83,0.12); }
      .mecanico-select:disabled { background: var(--color-gray-50); cursor: not-allowed; opacity: 0.7; }
      .mecanico-loader { position: absolute; right: 25px; top: 50%; transform: translateY(-50%); width: 14px; height: 14px; border: 2px solid var(--color-gray-300); border-top-color: var(--color-main); border-radius: 50%; animation: mec-spin 0.8s linear infinite; }
      @keyframes mec-spin { to { transform: translateY(-50%) rotate(360deg); } }
    `;
    document.head.appendChild(style);
  }

  // ── 2. Consultar a Supabase ──
  async function _fetch() {
    if (_cache) return _cache;
    if (_isLoading) {
      // Esperar si ya hay una petición en curso
      return new Promise(resolve => {
        const interval = setInterval(() => {
          if (!_isLoading) { clearInterval(interval); resolve(_cache); }
        }, 50);
      });
    }
    
    _isLoading = true;
    try {
      const db = window.SupabaseClient;
      // Traemos id y NOMBRE, ordenados alfabéticamente
      const { data, error } = await db
        .from('MECANICOS')
        .select('id, NOMBRE')
        .order('NOMBRE', { ascending: true });
        
      if (error) throw error;
      _cache = data || [];
    } catch (err) {
      console.error('[MecanicoSelect] Error cargando mecánicos:', err);
      _cache = [];
    } finally {
      _isLoading = false;
    }
    return _cache;
  }

  // ── 3. Render HTML (Devuelve el string para incrustar) ──
  function renderHtml() {
    _injectCSS();
    return `
      <div class="mecanico-wrapper">
        <select id="ot-mec-select" class="mecanico-select" disabled>
          <option value="">Cargando mecánicos...</option>
        </select>
        <div id="ot-mec-loader" class="mecanico-loader"></div>
      </div>
    `;
  }

  // ── 4. Montar en el DOM (Llamar después de incrustar el HTML) ──
  async function mount(selectedValue = null) {
    const select = document.getElementById('ot-mec-select');
    const loader = document.getElementById('ot-mec-loader');
    if (!select) return;

    select.disabled = true;
    if (loader) loader.style.display = 'block';

    const mecanicos = await _fetch();

    let optionsHtml = '<option value="">Seleccione un mecánico...</option>';
    mecanicos.forEach(m => {
      // Comparamos como string para evitar errores entre number y bigint
      const isSelected = String(m.id) === String(selectedValue) ? 'selected' : '';
      optionsHtml += `<option value="${m.id}" ${isSelected}>${m.NOMBRE}</option>`;
    });

    select.innerHTML = optionsHtml;
    select.disabled = false;
    if (loader) loader.style.display = 'none';
  }

  // ── 5. Obtener ID elegido (Devuelve Número o Null) ──
  function getValue() {
    const select = document.getElementById('ot-mec-select');
    if (!select || !select.value) return null;
    return parseInt(select.value, 10); // Transformamos a número (bigint)
  }

  return { renderHtml, mount, getValue };
})();

window.MecanicoSelectComponent = MecanicoSelectComponent;