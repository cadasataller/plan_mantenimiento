// ============================================================
// CADASA TALLER — MOCK OT SERVICE
// Genera órdenes de trabajo vinculadas a órdenes de mantenimiento
// ============================================================

const MockOTService = (() => {

  const MECANICOS = [
    'Edwin Rodriguez', 'Carlos Mendez', 'Luis Pereira',
    'Jorge Castillo', 'Mario Vargas', 'Roberto Fuentes',
    'Andrés Mora',    'Felipe Ruiz',   'David Núñez',
  ];

  const EQUIPOS_TRABAJO = [
    'Equipo Pesado', 'Mecánica General', 'Electromecánica',
    'Cosecha', 'Taller Central', 'Hidráulica',
  ];

  const ESTATUS_OT = ['Concluida', 'En Proceso', 'Programado', 'Detenido'];
  const ESTATUS_W  = [0.45, 0.25, 0.20, 0.10]; // pesos de probabilidad

  const CAUSAS_DETENIDO = [
    'Falta de repuesto', 'Espera de OC', 'Personal no disponible',
    'Condiciones climáticas', 'Equipo en uso', 'Esperando aprobación',
  ];

  const DESCRIPCIONES_OT = [
    'Desmontaje de componente', 'Inspección visual', 'Cambio de aceite',
    'Ajuste de tornillería', 'Prueba hidráulica', 'Limpieza de filtros',
    'Revisión eléctrica', 'Lubricación general', 'Alineación de ejes',
    'Cambio de sellos', 'Medición de desgaste', 'Prueba de presión',
    'Reemplazo de correas', 'Pintura y acabado', 'Ensamble final',
    'Pruebas de funcionamiento', 'Calibración de sensores', 'Soldadura',
  ];

  function rand(arr)        { return arr[Math.floor(Math.random() * arr.length)]; }
  function randInt(a, b)    { return Math.floor(Math.random() * (b - a + 1)) + a; }
  function randDec(a, b)    { return Math.round((Math.random() * (b - a) + a) * 10) / 10; }

  function weightedRand(items, weights) {
    const r = Math.random();
    let cum = 0;
    for (let i = 0; i < items.length; i++) {
      cum += weights[i];
      if (r <= cum) return items[i];
    }
    return items[items.length - 1];
  }

  function formatDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function getISOWeek(d) {
    const date = new Date(d);
    date.setHours(0,0,0,0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const w1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date.getTime() - w1.getTime()) / 86400000 - 3 + (w1.getDay()+6)%7)/7);
  }

  /**
   * Genera entre 2 y 6 OTs para una OM dada
   * @param {object} om  — row de la orden de mantenimiento
   * @returns {object[]}
   */
  function generateForOM(om) {
    const count  = randInt(2, 6);
    const result = [];
    const baseDate = om.FechaInicio
      ? new Date(om.FechaInicio)
      : new Date(new Date().getFullYear(), randInt(0,11), randInt(1,28));

    for (let i = 0; i < count; i++) {
      const offsetDays = randInt(0, 14);
      const fecha      = new Date(baseDate.getTime() + offsetDays * 86400000);
      const estatus    = weightedRand(ESTATUS_OT, ESTATUS_W);
      const horas      = randDec(0.5, 8);
      const detenido   = estatus === 'Detenido';

      result.push({
        ID_RowNumber:       `${om.ID_Orden}_OT${String(i+1).padStart(2,'0')}`,
        ID_OrdenMant:       om.ID_Orden,
        Area:               om.Area,
        ID_EQUIPO:          om.ID_EQUIPO,
        ITEM:               om.ITEM,
        Sistema:            om.Sistema,
        Descripcion:        rand(DESCRIPCIONES_OT),
        Fecha:              formatDate(fecha),
        ID_Mecanico:        rand(MECANICOS),
        EquipoTrabajo:      om.Area || rand(EQUIPOS_TRABAJO),
        Duracion:           horas,
        Estatus:            estatus,
        Retraso:            detenido ? randDec(0.5, 6) : 0,
        Causa:              detenido ? rand(CAUSAS_DETENIDO) : '',
        Comentario:         Math.random() < 0.3
                              ? `Trabajo ${estatus === 'Concluida' ? 'completado sin novedad' : 'en seguimiento'}. Próxima revisión programada.`
                              : '',
        Semana:             getISOWeek(fecha),
        Cantidad:           1,
      });
    }

    return result;
  }

  /**
   * Genera OTs para todas las OMs del array
   * @param {object[]} oms
   * @returns {Map<string, object[]>}  — mapa ID_Orden → [OTs]
   */
  function generateAll(oms) {
    const map = new Map();
    oms.forEach(om => {
      map.set(String(om.ID_Orden), generateForOM(om));
    });
    return map;
  }

  return { generateForOM, generateAll };
})();

window.MockOTService = MockOTService;
