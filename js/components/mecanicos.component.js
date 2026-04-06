/// ============================================================
// CADASA TALLER — MECANICO SELECT COMPONENT (v3 - Con Traductor)
// Maneja la carga, renderizado y validación de la lista de mecánicos
// ============================================================

const MecanicoSelectComponent = (() => {
  let _cache = null;
  let _isLoading = false;

  function _injectCSS() {
    if (document.getElementById('mecanico-select-css')) return;
    const style = document.createElement('style');
    style.id = 'mecanico-select-css';
    style.textContent = `
      .mecanico-loader {
        position: absolute;
        right: 12px;
        top: 36px;
        width: 14px;
        height: 14px;
        border: 2px solid var(--color-gray-300);
        border-top-color: var(--color-main);
        border-radius: 50%;
        animation: mec-spin 0.8s linear infinite;
        pointer-events: none;
      }
      @keyframes mec-spin { to { transform: rotate(360deg); } }
      .ot-modal-field.has-loader { position: relative; }
    `;
    document.head.appendChild(style);
  }

  async function fetchMecanicos(context = 'default', equipoTrabajo = null) {
    //if (_cache) return _cache;
    if (_isLoading) {
      return new Promise(resolve => {
        const interval = setInterval(() => {
          if (!_isLoading) { clearInterval(interval); resolve(_cache); }
        }, 50);
      });
    }
    
    _isLoading = true;
    try {
      const db = window.SupabaseClient;
      
      // 👇 1. Obtenemos el usuario actual y normalizamos su área
      const user = window.AuthService?.getUser() || {};
      const uArea = String(user.Area || user.area || user.Área || '').trim().toUpperCase();

      // 👇 2. Preparamos la consulta base
      let query = db
        .from('MECANICOS')
        .select('id, NOMBRE')
        .order('NOMBRE', { ascending: true });
        
      // 👇 3. Aplicamos el filtro según el contexto
      if (context === 'mecanicos') {
        // 👇 FILTRAMOS POR EQUIPO DE TRABAJO SI SE PROPORCIONA, SINO POR AREA
        if (equipoTrabajo) {
          query = query.ilike('"EQUIPO DE TRABAJO"', equipoTrabajo);
        } else {
          query = query.ilike('AREA', 'Servicios Generales');
        }
      } else if (uArea && uArea !== 'ALL') {
        // 👇 Filtro normal por área del usuario
        query = query.ilike('AREA', uArea);
      }

      const { data, error } = await query;
        
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

  function renderHtml() {
    _injectCSS();
    return `
      <select id="ot-mec-select" class="sg-field-input" style="width: 100%;" disabled>
        <option value="">Cargando mecánicos...</option>
      </select>
      <div id="ot-mec-loader" class="mecanico-loader"></div>
    `;
  }

  async function mount(selectedValue = null, context = 'default', equipoTrabajo = null) {
    const select = document.getElementById('ot-mec-select');
    const loader = document.getElementById('ot-mec-loader');
    
    if (!select) return;
    const parentField = select.closest('.ot-modal-field');
    if (parentField) parentField.classList.add('has-loader');

    select.disabled = true;
    if (loader) loader.style.display = 'block';

    const mecanicos = await fetchMecanicos(context, equipoTrabajo);
    let optionsHtml = '<option value="">Seleccione un mecánico...</option>';
    
    mecanicos.forEach(m => {
      const isSelected = String(m.id) === String(selectedValue) ? 'selected' : '';
      optionsHtml += `<option value="${m.id}" ${isSelected}>${m.NOMBRE}</option>`;
    });

    select.innerHTML = optionsHtml;
    select.disabled = false;
    if (loader) loader.style.display = 'none';
  }

  function getValue() {
    const select = document.getElementById('ot-mec-select');
    if (!select || !select.value) return null;
    return parseInt(select.value, 10);
  }

  // ── NUEVO: Función para traducir ID a Nombre ──
  // La hacemos async por si el caché aún no está cargado cuando se pinta la lista
  async function getNameById(id,context = 'default', equipoTrabajo = null) {
    if (!id) return '—';
    const mecanicos = await fetchMecanicos(context, equipoTrabajo);
    const mecanico = mecanicos.find(m => String(m.id) === String(id));
    return mecanico ? mecanico.NOMBRE : `ID: ${id}`;
  }

  return { renderHtml, mount, getValue, getNameById, fetchMecanicos };
})();

window.MecanicoSelectComponent = MecanicoSelectComponent;