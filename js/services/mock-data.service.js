// ============================================================
// CADASA TALLER — MOCK DATA SERVICE
// Genera 100 filas de órdenes de mantenimiento de ejemplo
// ============================================================

const MockDataService = (() => {

  const AREAS = [
    'Cosecha Agricola',
    'Cosecha Mecanizada',
    'Engrase',
    'Equipo Pesado',
    'Mecanica de Transporte',
    'Fabrica',
    'Calderas',
  ];

  const EQUIPOS = {
    'Cosecha Agricola':      [{ id: '431001', item: 'GRAP'        }, { id: '431002', item: 'COSECHADORA A' }],
    'Cosecha Mecanizada':    [{ id: '403019', item: 'SURCADORA'   }, { id: '403022', item: 'SEMBRADORA'    }],
    'Engrase':               [{ id: '4-15-402', item: 'PLANTA DE COMBUSTIBLE' }, { id: '4-15-405', item: 'DISTRIBUIDOR'  }],
    'Equipo Pesado':         [{ id: '458016', item: 'Montacarga'  }, { id: '458020', item: 'RETROEXCAVADORA' }],
    'Mecanica de Transporte':[{ id: '473001', item: 'CAMION 01'   }, { id: '473002', item: 'CAMION 02'     }],
    'Fabrica':               [{ id: '502001', item: 'MOLINO 1'    }, { id: '502002', item: 'MOLINO 2'      }],
    'Calderas':              [{ id: '601001', item: 'CALDERA A'   }, { id: '601002', item: 'CALDERA B'     }],
  };

  const SISTEMAS = [
    'Diferencial Delantero', 'Diferencial Trasero', 'Motor',
    'Transmisión', 'Hidráulico', 'Eléctrico', 'Neumático',
    'Chasis', 'Carrocería', 'MECANICO', 'Sistema de Frenos',
    'Sistema de Dirección', 'Tren de Rodaje', 'CHASIS',
  ];

  const DESCRIPCIONES = {
    'Desmontaje y diagnóstico': [
      'Corona De Piñon Y Balinera', 'Revision De Manzana',
      'Diagnóstico sistema hidráulico', 'Inspección de motor',
      'Evaluación de frenos', 'Revisión de transmisión',
      'Diagnóstico eléctrico general', 'Inspección de carrocería',
    ],
    'Lavado e inspección': [
      'Lavado e inspección general', 'Lavado del tanque por dentro',
      'Retirara Latas', 'Retirar Tierra Y Grasa',
      'Limpieza de filtros', 'Lavado de motor',
      'Inspección visual de chasis', 'Desengrase de componentes',
    ],
    'Reparación o reemplazo': [
      'Cambio de balineras', 'Reemplazo de sellos hidráulicos',
      'Cambio de mangueras', 'Reparación de bomba de agua',
      'Reemplazo de filtro de aceite', 'Cambio de batería',
      'Reparación de fuga de aceite', 'Sustitución de correas',
    ],
    'Ensamblaje y ajuste; pruebas finales': [
      'Ensamblaje de diferencial', 'Ajuste de frenos',
      'Calibración de motor', 'Prueba de hidráulicos',
      'Ajuste de transmisión', 'Prueba eléctrica final',
      'Calibración de inyectores', 'Ajuste de dirección',
    ],
  };

  const TIPOS_PROCESO = Object.keys(DESCRIPCIONES);
  const ESTATUS = ['Programado', 'Programado', 'Programado', 'En proceso', 'Completado', 'Pendiente'];

  const AREA_PREFIXES = {
    'Cosecha Agricola':       'GRAP',
    'Cosecha Mecanizada':     'CM',
    'Engrase':                'ENGX',
    'Equipo Pesado':          'EQPP',
    'Mecanica de Transporte': 'MT',
    'Fabrica':                'FAB',
    'Calderas':               'CAL',
  };

  function rand(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function padNum(n, len = 2) {
    return String(n).padStart(len, '0');
  }

  /**
   * Calcula el número de semana ISO de una fecha
   * @param {Date} d
   * @returns {number}
   */
  function getISOWeek(d) {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  }

  /**
   * Genera fecha aleatoria dentro del año en curso (algunos null para sin asignar)
   */
  function randomFechaInicio(withNull = true) {
    if (withNull && Math.random() < 0.45) return null; // 45% sin fecha
    const year  = new Date().getFullYear();
    const month = randInt(1, 12);
    const day   = randInt(1, 28);
    return new Date(year, month - 1, day);
  }

  function formatDateStr(d) {
    if (!d) return '';
    return `${d.getFullYear()}-${padNum(d.getMonth()+1)}-${padNum(d.getDate())}`;
  }

  /**
   * Genera el array de 100 OTs agrupadas por área
   */
  function generateOrders(count = 100) {
    const orders = [];
    const counters = {};

    for (let i = 0; i < count; i++) {
      const area    = rand(AREAS);
      const equipo  = rand(EQUIPOS[area]);
      const tipo    = rand(TIPOS_PROCESO);
      const sistema = rand(SISTEMAS);
      const desc    = rand(DESCRIPCIONES[tipo]);
      const estatus = rand(ESTATUS);

      const prefix = AREA_PREFIXES[area] || 'OT';
      counters[prefix] = (counters[prefix] || 0) + 1;
      const id = `${prefix}${padNum(counters[prefix], 2)}`;

      const fechaInicioDate = randomFechaInicio();
      const fechaInicio     = formatDateStr(fechaInicioDate);
      const semana          = fechaInicioDate ? getISOWeek(fechaInicioDate) : null;

      const tieneSolicitud  = Math.random() < 0.3;
      const nSolicitud      = tieneSolicitud ? `SC-${randInt(1000,9999)}` : '';
      const nOrdenCompra    = tieneSolicitud && Math.random() < 0.6 ? `OC-${randInt(100,999)}` : '';
      const fechaEntrega    = tieneSolicitud && nOrdenCompra ? formatDateStr(randomFechaInicio(false)) : '';

      // Fecha conclusión solo si completado o en proceso
      const completado      = estatus === 'Completado';
      const fechaConclusion = completado && fechaInicioDate
        ? formatDateStr(new Date(fechaInicioDate.getTime() + randInt(3,21)*86400000))
        : '';

      const observaciones   = Math.random() < 0.2
        ? rand(['Pendiente piezas', 'Esperando OC', 'Retrasado por clima', 'En espera de técnico'])
        : '';

      orders.push({
        ID_Orden:         id,
        Area:             area,
        ID_EQUIPO:        equipo.id,
        ITEM:             equipo.item,
        Sistema:          sistema,
        Descripcion:      desc,
        TipoProceso:      tipo,
        Estatus:          estatus,
        FechaInicio:      fechaInicio,
        FechaConclusion:  fechaConclusion,
        TieneSolicitud:   tieneSolicitud ? 'Si' : 'No',
        NSolicitud:       nSolicitud,
        NOrdenCompra:     nOrdenCompra,
        FechaEntrega:     fechaEntrega,
        Observaciones:    observaciones,
        Semana:           semana,
        Cantidad:         '',
        Etapa:            '',
      });
    }

    return orders;
  }

  return { generateOrders };
})();

window.MockDataService = MockDataService;
