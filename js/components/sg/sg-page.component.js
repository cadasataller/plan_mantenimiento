const SGPageComponent = (() => {
  let _container = null;
  let _currentState = 'list'; // 'list' | 'form_manual'

  function mount(containerId) {
    _container = document.getElementById(containerId);
    _render();
  }

  function onEnter() {
    _currentState = 'list';
    _render();
  }

  function _render() {
    if (!_container) return;
    
    _container.innerHTML = `<div id="sg-sub-view" style="max-width: 1200px; margin: 0 auto; padding: 2rem;"></div>`;
    
    if (_currentState === 'list') {
      SGListComponent.mount('sg-sub-view', {
        onNewManual: () => {
          _currentState = 'form_manual';
          _render();
        }
      });
    } else if (_currentState === 'form_manual') {
      SGFormComponent.mount('sg-sub-view', {
        onCancel: () => {
          _currentState = 'list';
          _render();
        },
        onSuccess: () => {
          _currentState = 'list';
          _render();
        }
      });
    }
  }

  return { mount, onEnter };
})();

window.SGPageComponent = SGPageComponent;