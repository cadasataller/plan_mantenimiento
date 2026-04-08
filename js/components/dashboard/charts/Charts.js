/**
 * Charts — Todos los gráficos del dashboard usando Apache ECharts
 * Requiere: <script src="https://cdnjs.cloudflare.com/ajax/libs/echarts/5.4.3/echarts.min.js">
 */

// ── Paleta de estatus (consistente en todos los gráficos) ─────────────────
const CHART_STATUS_PALETTE = {
  'Concluida':   '#2D8A4E',
  'En Proceso':  '#D4A853',
  'Pendiente':   '#d194bd',
  'Sin iniciar': '#8F8A7F',
  'Detenida':    '#C0392B',
  'Cancelada':   '#B8B3A7',
  'En Espera':   '#C97B2F',
  'Sin estatus': '#D8D4CA',
};

function _statusPalette(s) { return CHART_STATUS_PALETTE[s] || '#1A6B9A'; }

// ── Tema base ECharts ─────────────────────────────────────────────────────
function _baseOpts() {
  return {
    textStyle: { fontFamily: 'DM Sans, Segoe UI, sans-serif', fontSize: 12 },
    grid: { containLabel: true, left: 16, right: 24, top: 32, bottom: 8 },
    tooltip: {
      backgroundColor: 'var(--color-white, #fff)',
      borderColor: 'var(--color-gray-200, #D8D4CA)',
      textStyle: { color: 'var(--text-primary, #1A1917)', fontSize: 12 },
      extraCssText: 'border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.10)',
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Gráfico de barras verticales de estatus
// ─────────────────────────────────────────────────────────────────────────────
function renderStatusBarChart(containerId, kpis) {
  const el = document.getElementById(containerId);
  if (!el || !window.echarts) return;
  const chart = echarts.init(el, null, { renderer: 'svg' });

  const entries = Object.entries(kpis.byStatus).sort((a, b) => b[1] - a[1]);
  const categories = entries.map(([s]) => s);

  const data = entries.map(([status, count]) => {
    const pct = kpis.total > 0 ? Number(((count / kpis.total) * 100).toFixed(1)) : 0;
    return {
      value: pct,
      count,
      status,
      itemStyle: { color: _statusPalette ? _statusPalette(status) : _statusColor(status) }
    };
  });

  chart.setOption({
    ..._baseOpts(),
    tooltip: {
      ..._baseOpts().tooltip,
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params) => {
        const p = params?.[0];
        const d = p?.data || {};
        return `
          <b>${p?.axisValue ?? ''}</b><br/>
          Porcentaje: <b>${d.value ?? 0}%</b><br/>
          Cantidad: <b>${d.count ?? 0}</b>
        `;
      },
    },
    xAxis: {
      type: 'category',
      data: categories,
      axisLabel: { rotate: 0, fontSize: 11, color: '#6B6660', interval: 0 },
      axisLine: { lineStyle: { color: '#E2DDD3' } },
    },
    yAxis: {
      type: 'value',
      max: 100,
      axisLabel: { color: '#8F8A7F', fontSize: 11, formatter: '{value}%' },
      splitLine: { lineStyle: { color: '#EFEDE7' } },
    },
    series: [{
      type: 'bar',
      data,
      label: {
        show: true,
        position: 'top',
        fontSize: 11,
        color: '#4A4640',
        formatter: (p) => `${p.value}%`,
      },
      barMaxWidth: 64,
    }],
  });

  window.addEventListener('resize', () => chart.resize());
  return chart;
}
// ─────────────────────────────────────────────────────────────────────────────
// 2. Avance semanal (barras + línea objetivo)
// ─────────────────────────────────────────────────────────────────────────────
function renderWeeklyChart(containerId, weeklyData) {
  const el = document.getElementById(containerId);
  if (!el || !window.echarts) return;
  const chart = echarts.init(el, null, { renderer: 'svg' });

  const TARGET = 100 / 38; // ~263% — ajusta si la meta es distinta
  // La meta real es: objetivo = 100 OM cerradas / semana sobre el total
  // Según tu spec: línea objetivo = 100% entre 38 semanas → ~2.63 OM/sem en % absoluto
  // Interpretamos como meta de avance por semana = 100/totalSemanas
  const META = TARGET.toFixed(2);

  const semanas  = weeklyData.map(w => w.semana);
  const avances  = weeklyData.map(w => w.avance);

  const maxData = Math.max(...avances);
  const maxTarget = Number(META);
  const dynamicMax = Math.round(Math.max(maxData, maxTarget) * 1.4); // margen visual

  chart.setOption({
    ..._baseOpts(),
    tooltip: {
      ..._baseOpts().tooltip,
      trigger: 'axis',
      formatter: (params) => {
        const bar  = params.find(p => p.seriesType === 'bar');
        const line = params.find(p => p.seriesType === 'line');
        return `<b>${bar?.axisValue}</b><br/>
          Avance: <b>${bar?.value ?? 0}%</b><br/>
          Concluidas: ${weeklyData[bar?.dataIndex]?.concluidas ?? 0} / ${weeklyData[bar?.dataIndex]?.total ?? 0}<br/>
          Objetivo: ${line?.value ?? META}%`;
      },
    },
    legend: {
      data: ['Avance %', 'Objetivo'],
      top: 4,
      textStyle: { color: '#4A4640', fontSize: 11 },
    },
    xAxis: {
      type: 'category',
      data: semanas,
      axisLabel: { color: '#6B6660', fontSize: 11 },
      axisLine: { lineStyle: { color: '#E2DDD3' } },
    },
    yAxis: {
      type: 'value',
      max: dynamicMax,
      axisLabel: { color: '#8F8A7F', formatter: '{value}%', fontSize: 11 },
      splitLine: { lineStyle: { color: '#EFEDE7' } },
    },
    series: [
      {
        name: 'Avance %',
        type: 'bar',
        data: avances,
        itemStyle: { color: '#004643', borderRadius: [4, 4, 0, 0] },
        label: { show: true, position: 'top', formatter: '{c}%', fontSize: 11, color: '#004643' },
        barMaxWidth: 56,
      },
      {
        name: 'Objetivo',
        type: 'line',
        data: semanas.map(() => META),
        symbol: 'none',
        lineStyle: { color: '#D4A853', width: 2, type: 'dashed' },
        label: { show: false },
      },
    ],
  });
  window.addEventListener('resize', () => chart.resize());
  return chart;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Barras apiladas horizontales por dimensión
//    dimension: 'Área' | 'Sistema' | 'ITEM' | 'ID_#EQUIPO'
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// 3. Barras apiladas horizontales por dimensión
//    dimension: 'Área' | 'Sistema' | 'ITEM' | 'ID_#EQUIPO'
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// 3. Barras apiladas horizontales por dimensión
//    dimension: 'Área' | 'Sistema' | 'ITEM' | 'ID_#EQUIPO'
// ─────────────────────────────────────────────────────────────────────────────
function renderStackedBarChart(containerId, dimensionData, onBarClick) {
  const el = document.getElementById(containerId);
  if (!el || !window.echarts) return;
  const chart = echarts.init(el, null, { renderer: 'svg' });

  const categories = Object.keys(dimensionData);
  const allStatuses = [...new Set(
    Object.values(dimensionData).flatMap(s => Object.keys(s))
  )];

  const sortedStatuses = Object.keys(CHART_STATUS_PALETTE).filter(s => allStatuses.includes(s));
  const extra = allStatuses.filter(s => !sortedStatuses.includes(s));
  const statuses = [...sortedStatuses, ...extra];

  const categoryTotals = categories.map(cat =>
    Object.values(dimensionData[cat] || {}).reduce((a, b) => a + b, 0)
  );

  const MAX_VISIBLE_BARS = 10;
  const needsScroll = categories.length > MAX_VISIBLE_BARS;

  const visibleCount = Math.min(categories.length, MAX_VISIBLE_BARS);
  const barWidth = Math.min(32, Math.max(16, Math.floor(240 / Math.max(1, visibleCount))));

  const series = statuses.map(status => ({
    name: status,
    type: 'bar',
    stack: 'total',
    barWidth,
    barMaxWidth: 32,
    barGap: '0%',
    barCategoryGap: '30%',
    data: categories.map((cat, i) => {
      const count = dimensionData[cat]?.[status] || 0;
      const total = categoryTotals[i] || 0;
      const pct = total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0;
      return {
        value: pct,
        count,
        total,
        status,
      };
    }),
    itemStyle: { color: _statusPalette(status) },
    label: {
      show: true,
      formatter: (p) => (p.data?.count > 0 ? `${p.value}%` : ''),
      position: 'insideRight',
      fontSize: 10,
      color: '#fff',
    },
  }));

  chart.setOption({
    ..._baseOpts(),
    grid: { containLabel: true, left: 8, right: needsScroll ? 36 : 16, top: 32, bottom: 70 },

    dataZoom: needsScroll ? [
      {
        type: 'slider',
        yAxisIndex: 0,
        width: 12,
        right: 4,
        startValue: categories.length > MAX_VISIBLE_BARS ? categories.length - MAX_VISIBLE_BARS : 0,
        endValue: categories.length - 1,
        showDetail: false,
        borderColor: 'transparent',
        fillerColor: 'rgba(143, 138, 127, 0.2)',
        handleSize: '100%',
      },
      {
        type: 'inside',
        yAxisIndex: 0,
        zoomOnMouseWheel: false,
        moveOnMouseWheel: true,
        moveOnMouseMove: true
      }
    ] : [],

    tooltip: {
      ..._baseOpts().tooltip,
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params) => {
        const total = params?.[0]?.data?.total ?? 0;
        const lines = params
          .filter(p => (p.data?.count || 0) > 0)
          .map(p =>
            `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color};margin-right:6px"></span>` +
            `${p.seriesName}: <b>${p.data.count}</b> (${p.value}%)`
          )
          .join('<br/>');

        return `<b>${params[0]?.axisValue ?? ''}</b> (${total})<br/>${lines}`;
      },
    },

    legend: {
      type: 'scroll',
      bottom: 0,
      textStyle: { color: '#4A4640', fontSize: 10 },
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
    },

    xAxis: {
      type: 'value',
      max: 100,
      axisLabel: { color: '#8F8A7F', fontSize: 10, formatter: '{value}%' },
      splitLine: { lineStyle: { color: '#EFEDE7' } },
    },

    yAxis: {
      type: 'category',
      data: categories,
      axisLabel: {
        color: '#4A4640',
        fontSize: 11,
        width: 120,
        overflow: 'truncate',
        ellipsis: '…',
      },
      axisLine: { lineStyle: { color: '#E2DDD3' } },
    },

    series,
  });

  if (onBarClick) {
    chart.on('click', (params) => onBarClick(params.name, params));
  }

  window.addEventListener('resize', () => chart.resize());
  return chart;
}

window.renderStatusBarChart  = renderStatusBarChart;
window.renderWeeklyChart     = renderWeeklyChart;
window.renderStackedBarChart = renderStackedBarChart;
window.CHART_STATUS_PALETTE  = CHART_STATUS_PALETTE;