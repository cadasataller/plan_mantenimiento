// ============================================================
// CADASA TALLER — GAUGE COMPONENT
// Velocímetro SVG puro — % órdenes completadas / total
// Se actualiza solo con el filtro de búsqueda (no con KPIs)
// ============================================================

const GaugeComponent = (() => {

  const CONTAINER_ID = 'ot-gauge-wrap';

  // ── Paleta verde ─────────────────────────────────────────
  const PALETTE = [
    { from: 0,   to: 25,  color: '#c8e6c9', label: 'Bajo'     }, // verde muy claro
    { from: 25,  to: 50,  color: '#81c784', label: 'Regular'  }, // verde claro
    { from: 50,  to: 75,  color: '#388e3c', label: 'Bueno'    }, // verde medio
    { from: 75,  to: 100, color: '#1b5e20', label: 'Excelente'}, // verde oscuro
  ];

  // ── render ───────────────────────────────────────────────
  function render(total, completed) {
    const el = document.getElementById(CONTAINER_ID);
    if (!el) return;

    const pct     = total > 0 ? Math.round((completed / total) * 100) : 0;
    const segment = PALETTE.find(p => pct >= p.from && pct <= p.to) || PALETTE[3];

    // Arco: semicírculo de 180° (de π a 0, dibujado de izq a der)
    // Radio externo = 80, interno = 52 → grosor = 28
    const CX  = 110, CY = 100;
    const R_O = 80,  R_I = 52;

    // Ángulo: -180° (izq) → 0° (der), pct mapea en ese rango
    const startAngle = Math.PI;          // 180°
    const endAngle   = 0;                // 0°
    const needleAngle = startAngle - (pct / 100) * Math.PI; // izq→der

    function polar(r, angle) {
      return {
        x: CX + r * Math.cos(angle),
        y: CY - r * Math.sin(angle),   // SVG Y invertido
      };
    }

    function arcPath(r, from, to) {
      const s   = polar(r, from);
      const e   = polar(r, to);
      const lg  = (from - to > Math.PI) ? 1 : 0;
      return `M ${s.x} ${s.y} A ${r} ${r} 0 ${lg} 1 ${e.x} ${e.y}`;
    }

    // ── Arcos de segmentos de color ───────────────────────
    const segPaths = PALETTE.map(seg => {
      const aFrom = startAngle - (seg.from / 100) * Math.PI;
      const aTo   = startAngle - (seg.to   / 100) * Math.PI;
      const outer = arcPath(R_O, aFrom, aTo);
      const inner = arcPath(R_I, aTo, aFrom);
      const sOut  = polar(R_O, aFrom);
      const eOut  = polar(R_O, aTo);
      const sIn   = polar(R_I, aTo);
      const eIn   = polar(R_I, aFrom);
      return `
        <path d="M ${sOut.x} ${sOut.y}
                 A ${R_O} ${R_O} 0 0 1 ${eOut.x} ${eOut.y}
                 L ${sIn.x} ${sIn.y}
                 A ${R_I} ${R_I} 0 0 0 ${eIn.x} ${eIn.y}
                 Z"
              fill="${seg.color}" opacity="0.9"/>`;
    }).join('');

    // ── Aguja ─────────────────────────────────────────────
    const NEEDLE_LEN = R_O - 4;
    const NEEDLE_W   = 0.08; // radianes de ancho en la base
    const tip  = polar(NEEDLE_LEN, needleAngle);
    const bl   = polar(14, needleAngle + Math.PI / 2);
    const br   = polar(14, needleAngle - Math.PI / 2);

    // ── Marcas de tick ────────────────────────────────────
    const ticks = [0, 25, 50, 75, 100].map(v => {
      const a  = startAngle - (v / 100) * Math.PI;
      const t1 = polar(R_O + 4, a);
      const t2 = polar(R_O + 11, a);
      const lp = polar(R_O + 16, a);
      return `
        <line x1="${t1.x}" y1="${t1.y}" x2="${t2.x}" y2="${t2.y}"
              stroke="var(--text-muted,#999)" stroke-width="1.5" stroke-linecap="round"/>
        <text x="${lp.x}" y="${lp.y}"
              text-anchor="middle" dominant-baseline="middle"
              font-size="8" fill="var(--text-muted,#888)" font-family="inherit">${v}%</text>`;
    }).join('');

    // ── Animación aguja con CSS ───────────────────────────
    const needleId  = 'gauge-needle-' + Math.random().toString(36).slice(2,6);
    const startDeg  = 180; // empieza siempre desde el 0%
    const targetDeg = Math.round(180 - pct * 1.8); // 0%→180°, 100%→0°

    el.innerHTML = `
      <div class="ot-gauge-card">
        <div class="ot-gauge-title">Avance de Completado</div>
        <div class="ot-gauge-svg-wrap">
          <svg viewBox="0 0 220 118" xmlns="http://www.w3.org/2000/svg"
               style="overflow:visible;width:100%;max-width:280px;display:block;margin:0 auto">

            <!-- Arcos de color -->
            ${segPaths}

            <!-- Arco de fondo (riel gris tenue) -->
            <path d="M ${polar(R_O,startAngle).x} ${polar(R_O,startAngle).y}
                     A ${R_O} ${R_O} 0 0 1 ${polar(R_O,endAngle).x} ${polar(R_O,endAngle).y}
                     L ${polar(R_I,endAngle).x} ${polar(R_I,endAngle).y}
                     A ${R_I} ${R_I} 0 0 0 ${polar(R_I,startAngle).x} ${polar(R_I,startAngle).y}
                     Z"
                  fill="none" stroke="var(--border,#e2e8f0)" stroke-width="0.5"/>

            <!-- Ticks -->
            ${ticks}

            <!-- Aguja con animación CSS transform-origin -->
            <g id="${needleId}" style="transform-origin:${CX}px ${CY}px;
                 transform:rotate(${startDeg}deg);
                 animation: gaugeNeedle_${needleId} 1s cubic-bezier(.34,1.4,.64,1) forwards;">
              <polygon points="${tip.x},${tip.y} ${bl.x},${bl.y} ${br.x},${br.y}"
                       fill="var(--text,#2d3748)" opacity="0.85"/>
            </g>

            <!-- Centro de la aguja -->
            <circle cx="${CX}" cy="${CY}" r="7"
                    fill="var(--surface,#fff)" stroke="var(--text,#2d3748)" stroke-width="2"/>
            <circle cx="${CX}" cy="${CY}" r="3" fill="var(--text,#2d3748)"/>

            <!-- Valor central -->
            <text x="${CX}" y="${CY + 22}"
                  text-anchor="middle" font-size="22" font-weight="700"
                  fill="${segment.color}" font-family="inherit">${pct}%</text>

            <!-- Sub-texto -->
            <text x="${CX}" y="${CY + 35}"
                  text-anchor="middle" font-size="8.5"
                  fill="var(--text-muted,#888)" font-family="inherit">
              ${completed} de ${total} completadas
            </text>
          </svg>

          <style>
            @keyframes gaugeNeedle_${needleId} {
              from { transform: rotate(${startDeg}deg); }
              to   { transform: rotate(${targetDeg}deg); }
            }
          </style>
        </div>

        <!-- Leyenda -->
        <div class="ot-gauge-legend">
          ${PALETTE.map(p => `
            <div class="ot-gauge-legend-item${pct >= p.from && pct <= p.to ? ' active' : ''}">
              <span class="ot-gauge-legend-dot" style="background:${p.color}"></span>
              <span>${p.from}–${p.to}% ${p.label}</span>
            </div>`).join('')}
        </div>

        <!-- Indicador de contexto de filtro -->
        <div class="ot-gauge-ctx" id="ot-gauge-ctx"></div>
      </div>`;
  }

  // ── update: se llama desde OTComponent con datos de búsqueda ──
  // Recibe las órdenes YA filtradas SOLO por búsqueda (sin KPI)
  function update(searchFilteredRows) {
    const total     = searchFilteredRows.length;
    const completed = searchFilteredRows.filter(r => r.Estatus === 'Completado').length;
    render(total, completed);

    // Actualizar etiqueta de contexto
    const ctx = document.getElementById('ot-gauge-ctx');
    if (ctx) {
      const search = OTStore.getFilters().search;
      ctx.textContent = search ? `Filtro activo: "${search}"` : '';
    }
  }

  return { render, update };
})();

window.GaugeComponent = GaugeComponent;