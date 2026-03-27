const SGPageComponent = (() => {
  let _container = null;
  let _currentState = 'list'; // 'list' | 'form_manual'
  let _formData = {}; // 👈 NUEVO: Guardará los datos pre-llenados si vienen de otra pestaña

  function mount(containerId) {
    _container = document.getElementById(containerId);
    _render();
  }

  function onEnter() {
    _currentState = 'list';
    _formData = {}; // Limpiamos los datos al entrar
    _render();
  }

  // 👇 NUEVO: Función para abrir el formulario desde afuera inyectando datos
  function openForm(initialData = {}) {
    _formData = initialData;
    _currentState = 'form_manual';
    _render();
  }

  function _render() {
    if (!_container) return;
    
    _container.innerHTML = `<div id="sg-sub-view" style="max-width: 1200px; margin: 0 auto; padding: 2rem;"></div>`;
    
    if (_currentState === 'list') {
      SGListComponent.mount('sg-sub-view', {
        onNewManual: () => {
          openForm({}); // Abrimos el formulario vacío
        }
      });
    } else if (_currentState === 'form_manual') {
      SGFormComponent.mount('sg-sub-view', {
        onCancel: () => {
          _currentState = 'list';
          _formData = {}; // Limpiamos
          _render();
        },
        onSuccess: () => {
          _currentState = 'list';
          _formData = {}; // Limpiamos
          _render();
        }
      }, _formData); // 👈 Pasamos los datos al formulario
    }
  }

  // 👈 Exportamos openForm para que el modal de OT pueda usarlo
  return { mount, onEnter, openForm }; 
})();

window.SGPageComponent = SGPageComponent;