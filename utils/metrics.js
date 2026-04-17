const Metrics = (() => {

  let _supabase = null;
  let _currentUser = null;

  function init({ supabase, getUser }) {
    _supabase = supabase;
    _currentUser = getUser; // función para obtener usuario actual
  }

  async function create({
    screen,
    action,
    context = {},
    event_type='CLICK',
  }) {
    try {
      if (!_supabase) {
        console.warn('Metrics no inicializado');
        return;
      }

      const user = _currentUser?.();
      const { error } = await _supabase
        .from('usage_events')
        .insert([
          {
            user_id: user?.id || null,
            user_name: user?.name || 'anonymous',
            screen_name: screen,
            action_name: action,
            event_type: event_type,
            context
          }
        ]);

      if (error) {
        console.error('Metrics error:', error);
      }

    } catch (err) {
      console.error('Metrics exception:', err);
    }
  }

  return {
    init,
    create
  };

})();

// Asignar a window para acceso global
window.Metrics = Metrics;