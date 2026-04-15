/**
 * FoamCore OS — RAG Layer 5: Knowledge Graph Visualization
 * =========================================================
 * 互動式 SVG 知識圖譜，整合 Layer 1-4 輸出，呈現泡棉配方的
 * 化學-製程-品質三維關聯網絡。
 *
 * 架構定位：
 *   Layer 1  同義詞標準化      → 節點標籤統一
 *   Layer 2  智能索引           → 節點分類與權重
 *   Layer 3  跨庫關聯           → 邊的關聯類型
 *   Layer 4  對話記憶           → 動態高亮活躍節點
 *   Layer 5  知識圖譜視覺化 ← YOU ARE HERE
 *
 * 依賴：無外部庫，純 SVG + Vanilla JS
 */

// ═══════════════════════════════════════════════════════════
// §1  ONTOLOGY — 節點類型與邊類型定義
// ═══════════════════════════════════════════════════════════

(function() {
'use strict';

const KG_NODE_TYPES = {
  CHEMICAL:   { color: '#00d4ff', icon: '⬡', label: '化學品',   ring: '#003a52' },
  PROCESS:    { color: '#ff9f1c', icon: '⚙', label: '製程參數', ring: '#3d2600' },
  QUALITY:    { color: '#7fff6e', icon: '◈', label: '品質指標', ring: '#003d00' },
  DEFECT:     { color: '#ff4d6d', icon: '✕', label: '缺陷模式', ring: '#3d0010' },
  FORMULA:    { color: '#c77dff', icon: '⬟', label: '配方',     ring: '#1a0033' },
  STANDARD:   { color: '#ffd166', icon: '★', label: '標準規範', ring: '#332b00' },
};

const KG_EDGE_TYPES = {
  CAUSES:       { color: '#ff4d6d', dash: '',      label: '導致',   weight: 3 },
  CONTROLS:     { color: '#00d4ff', dash: '',      label: '控制',   weight: 2.5 },
  CONTAINS:     { color: '#c77dff', dash: '',      label: '包含',   weight: 2 },
  CORRELATES:   { color: '#ffd166', dash: '6,3',   label: '相關',   weight: 1.5 },
  OPPOSES:      { color: '#ff9f1c', dash: '3,3',   label: '拮抗',   weight: 1.5 },
  SYNERGIZES:   { color: '#7fff6e', dash: '',      label: '協同',   weight: 2 },
  MEASURES:     { color: '#a0a0a0', dash: '8,4',   label: '量測',   weight: 1 },
};

// ═══════════════════════════════════════════════════════════
// §2  DEFAULT FOAM KNOWLEDGE GRAPH DATA
//     EVA/PE/POE 交聯二次發泡核心知識圖
// ═══════════════════════════════════════════════════════════

const DEFAULT_KG_DATA = {
  nodes: [
    // ── 化學品
    { id: 'eva',    type: 'CHEMICAL', label: 'EVA',       sub: '基體樹脂',      phr: null,   importance: 10 },
    { id: 'ldpe',   type: 'CHEMICAL', label: 'LDPE',      sub: '基體樹脂',      phr: null,   importance: 7  },
    { id: 'poe',    type: 'CHEMICAL', label: 'POE',       sub: '彈性體',        phr: null,   importance: 6  },
    { id: 'ac',     type: 'CHEMICAL', label: 'AC 發泡劑', sub: '偶氮二甲醯胺',  phr: '3-8',  importance: 9  },
    { id: 'dcp',    type: 'CHEMICAL', label: 'DCP',       sub: '過氧化物交聯劑',phr: '0.4-1.2', importance: 9 },
    { id: 'zno',    type: 'CHEMICAL', label: 'ZnO',       sub: 'AC 活化劑',     phr: '1-3',  importance: 7  },
    { id: 'stearic',type: 'CHEMICAL', label: '硬脂酸',    sub: '輔助活化劑',    phr: '0.5-1',importance: 5  },
    { id: 'talc',   type: 'CHEMICAL', label: '滑石粉',    sub: '成核劑/填充',   phr: '0-15', importance: 6  },

    // ── 製程參數
    { id: 'temp',   type: 'PROCESS',  label: '模具溫度',  sub: '°C',            importance: 9 },
    { id: 'press',  type: 'PROCESS',  label: '模壓壓力',  sub: 'MPa',           importance: 8 },
    { id: 'time',   type: 'PROCESS',  label: '模壓時間',  sub: 'min',           importance: 8 },
    { id: 'ratio',  type: 'PROCESS',  label: '發泡倍率',  sub: '× 倍',          importance: 9 },
    { id: 'roll',   type: 'PROCESS',  label: '煉膠工藝',  sub: '兩輥溫度/次數', importance: 6 },

    // ── 品質指標
    { id: 'hardness', type: 'QUALITY', label: '硬度',     sub: 'Asker C',       importance: 8 },
    { id: 'density',  type: 'QUALITY', label: '密度',     sub: 'g/cm³',         importance: 9 },
    { id: 'compress', type: 'QUALITY', label: '壓縮永久變形', sub: '%',          importance: 7 },
    { id: 'tear',     type: 'QUALITY', label: '撕裂強度', sub: 'N/mm',          importance: 7 },
    { id: 'skinQ',    type: 'QUALITY', label: '表皮品質', sub: '外觀',          importance: 6 },

    // ── 缺陷模式
    { id: 'collapse',   type: 'DEFECT', label: '泡孔塌陷', sub: '過度交聯',      importance: 8 },
    { id: 'rupture',    type: 'DEFECT', label: '表皮破裂', sub: '快速洩壓',      importance: 9 },
    { id: 'shrink',     type: 'DEFECT', label: '冷縮',     sub: '低溫收縮',      importance: 7 },
    { id: 'edgeharden', type: 'DEFECT', label: '邊緣硬化', sub: '山形曲線效應',  importance: 8 },

    // ── 配方
    { id: 'f_sport',  type: 'FORMULA', label: '運動鞋中底', sub: 'α=32×',        importance: 8 },
    { id: 'f_mat',    type: 'FORMULA', label: '瑜珈墊',     sub: 'α=25×',        importance: 7 },
    { id: 'f_pcr',    type: 'FORMULA', label: 'PCR 回收料', sub: '摻混配方',      importance: 6 },
    // 新增節點（文獻佐證）
    { id: 'brittle',  type: 'DEFECT',  label: '脆化開裂', sub: '過度交聯',        importance: 8 },
    { id: 'gelcont',  type: 'QUALITY', label: '膠含量',   sub: '% gel content',   importance: 8 },
    { id: 'va',       type: 'PROCESS', label: 'VA 含量',  sub: 'wt%',             importance: 7 },
    { id: 'caco3',    type: 'CHEMICAL',label: 'CaCO₃',   sub: '成核劑/填充', phr: '0-10', importance: 5 },
    { id: 'cellsize', type: 'QUALITY', label: '泡孔尺寸', sub: 'μm',              importance: 7 },
  ],

  edges: [
    // AC 發泡劑關聯
    { source: 'ac',     target: 'ratio',      type: 'CONTROLS',   strength: 0.9 },
    { source: 'ac',     target: 'density',    type: 'CONTROLS',   strength: 0.85 },
    { source: 'zno',    target: 'ac',         type: 'CONTROLS',   strength: 0.8, label: '降低分解溫度' },
    { source: 'stearic',target: 'ac',         type: 'SYNERGIZES', strength: 0.6 },
    { source: 'ac',     target: 'rupture',    type: 'CAUSES',     strength: 0.7, label: '快速氣體釋放' },

    // DCP 交聯關聯（修正：不足→塌陷，過量→脆化）
    { source: 'dcp',    target: 'hardness',   type: 'CONTROLS',   strength: 0.85 },
    { source: 'dcp',    target: 'compress',   type: 'CONTROLS',   strength: 0.8 },
    { source: 'dcp',    target: 'collapse',   type: 'CONTROLS',   strength: 0.8, label: '不足時塌陷' },
    { source: 'dcp',    target: 'brittle',    type: 'CAUSES',     strength: 0.8, label: '過量時脆化' },
    { source: 'dcp',    target: 'tear',       type: 'CONTROLS',   strength: 0.75 },
    { source: 'dcp',    target: 'ratio',      type: 'CONTROLS',   strength: 0.7, label: '抑制膨脹' },
    { source: 'zno',    target: 'dcp',        type: 'OPPOSES',    strength: 0.5, label: 'Zn 干擾自由基' },
    { source: 'zno',    target: 'ac',         type: 'CONTROLS',   strength: 0.85, label: '降溫 220→170°C' },
    { source: 'stearic',target: 'zno',        type: 'SYNERGIZES', strength: 0.55, label: '協同活化 AC' },

    // 溫度/壓力/時間
    { source: 'temp',   target: 'ac',         type: 'CONTROLS',   strength: 0.9, label: '啟動分解' },
    { source: 'temp',   target: 'dcp',        type: 'CONTROLS',   strength: 0.9, label: '啟動交聯' },
    { source: 'temp',   target: 'rupture',    type: 'CAUSES',     strength: 0.6 },
    { source: 'press',  target: 'density',    type: 'CONTROLS',   strength: 0.7 },
    { source: 'press',  target: 'skinQ',      type: 'CONTROLS',   strength: 0.8 },
    { source: 'time',   target: 'dcp',        type: 'CONTROLS',   strength: 0.75, label: '固化完整性' },
    { source: 'ratio',  target: 'edgeharden', type: 'CAUSES',     strength: 0.8, label: 'α>30 山形曲線' },
    { source: 'ratio',  target: 'shrink',     type: 'CAUSES',     strength: 0.6 },

    // 樹脂體系
    { source: 'eva',    target: 'f_sport',    type: 'CONTAINS',   strength: 1.0 },
    { source: 'poe',    target: 'f_sport',    type: 'CONTAINS',   strength: 0.7 },
    { source: 'eva',    target: 'f_mat',      type: 'CONTAINS',   strength: 1.0 },
    { source: 'ldpe',   target: 'f_mat',      type: 'CONTAINS',   strength: 0.6 },
    { source: 'eva',    target: 'f_pcr',      type: 'CONTAINS',   strength: 0.8 },
    { source: 'poe',    target: 'eva',        type: 'SYNERGIZES', strength: 0.7, label: '相容性佳' },

    // 填料
    { source: 'talc',   target: 'shrink',     type: 'CONTROLS',   strength: 0.7, label: '無機填料抑制' },
    { source: 'talc',   target: 'hardness',   type: 'CONTROLS',   strength: 0.6 },
    { source: 'talc',   target: 'density',    type: 'CONTROLS',   strength: 0.5 },

    // 品質指標互相關聯
    { source: 'hardness',  target: 'compress', type: 'CORRELATES', strength: 0.6 },
    { source: 'density',   target: 'hardness', type: 'CORRELATES', strength: 0.7 },

    // 煉膠
    { source: 'roll',   target: 'ac',         type: 'CONTROLS',   strength: 0.6, label: '分散均勻' },
    { source: 'roll',   target: 'dcp',        type: 'CONTROLS',   strength: 0.65 },

    // 新增邊（文獻佐證）
    { source: 'temp',   target: 'collapse',   type: 'CAUSES',     strength: 0.7, label: 'ΔT<5°C 交聯不足' },
    { source: 'time',   target: 'gelcont',    type: 'CONTROLS',   strength: 0.8, label: '延長→膠含量↑' },
    { source: 'gelcont',target: 'collapse',   type: 'CONTROLS',   strength: 0.85, label: '<60% 泡孔塌陷' },
    { source: 'gelcont',target: 'compress',   type: 'CONTROLS',   strength: 0.7 },
    { source: 'dcp',    target: 'gelcont',    type: 'CONTROLS',   strength: 0.9, label: '交聯度↔膠含量' },
    { source: 'va',     target: 'dcp',        type: 'CONTROLS',   strength: 0.65, label: 'VA%↑交聯位點↑' },
    { source: 'va',     target: 'hardness',   type: 'CONTROLS',   strength: 0.7, label: 'VA%↑→軟' },
    { source: 'va',     target: 'density',    type: 'CORRELATES', strength: 0.5 },
    { source: 'caco3',  target: 'cellsize',   type: 'CONTROLS',   strength: 0.7, label: '成核→細胞均勻' },
    { source: 'caco3',  target: 'density',    type: 'CONTROLS',   strength: 0.5 },
    { source: 'cellsize',target:'compress',   type: 'CORRELATES', strength: 0.6 },
    { source: 'cellsize',target:'skinQ',      type: 'CORRELATES', strength: 0.5 },
    { source: 'ac',     target: 'cellsize',   type: 'CONTROLS',   strength: 0.7, label: 'AC↑→泡孔大' },
  ],
};

// ═══════════════════════════════════════════════════════════
// §3  LAYOUT ENGINE — 力導向模擬（純 JS，無 D3）
// ═══════════════════════════════════════════════════════════

class ForceLayout {
  constructor(nodes, edges, width, height) {
    this.width  = width;
    this.height = height;
    this.alpha  = 1.0;
    this.alphaDecay = 0.02;
    this.velocityDecay = 0.4;

    // 初始化節點位置（類型分區散佈）
    const typeGroups = {
      CHEMICAL: { cx: width * 0.25, cy: height * 0.4 },
      PROCESS:  { cx: width * 0.5,  cy: height * 0.2 },
      QUALITY:  { cx: width * 0.75, cy: height * 0.4 },
      DEFECT:   { cx: width * 0.75, cy: height * 0.7 },
      FORMULA:  { cx: width * 0.5,  cy: height * 0.75 },
      STANDARD: { cx: width * 0.5,  cy: height * 0.5  },
    };

    this.nodes = nodes.map((n, i) => {
      const g = typeGroups[n.type] || { cx: width/2, cy: height/2 };
      const angle = (i / nodes.length) * Math.PI * 2;
      return {
        ...n,
        x: g.cx + Math.cos(angle) * 80 + (Math.random()-0.5)*40,
        y: g.cy + Math.sin(angle) * 80 + (Math.random()-0.5)*40,
        vx: 0, vy: 0,
        r: this._nodeRadius(n),
      };
    });

    this.nodeMap = Object.fromEntries(this.nodes.map(n => [n.id, n]));
    this.edges   = edges.map(e => ({
      ...e,
      source: this.nodeMap[e.source],
      target: this.nodeMap[e.target],
    })).filter(e => e.source && e.target);
  }

  _nodeRadius(n) {
    const base = { CHEMICAL:18, PROCESS:16, QUALITY:16, DEFECT:14, FORMULA:20, STANDARD:14 };
    return (base[n.type] || 14) + Math.sqrt(n.importance || 5) * 1.5;
  }

  step() {
    if (this.alpha < 0.001) return false;
    const { nodes, edges, width, height, alpha } = this;

    // ── 排斥力（節點間）
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d2 = dx*dx + dy*dy || 0.001;
        const d  = Math.sqrt(d2);
        const minD = a.r + b.r + 30;
        if (d < minD) {
          const f = (minD - d) / d * 0.5 * alpha;
          const fx = dx * f, fy = dy * f;
          a.vx -= fx; a.vy -= fy;
          b.vx += fx; b.vy += fy;
        } else {
          const strength = 800 * alpha / d2;
          const fx = dx * strength, fy = dy * strength;
          a.vx -= fx; a.vy -= fy;
          b.vx += fx; b.vy += fy;
        }
      }
    }

    // ── 彈力（邊）
    for (const e of edges) {
      const { source: a, target: b, strength = 0.5 } = e;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d  = Math.sqrt(dx*dx + dy*dy) || 0.001;
      const idealD = 120 + (1 - strength) * 60;
      const f = (d - idealD) / d * 0.3 * alpha;
      const fx = dx * f, fy = dy * f;
      a.vx += fx; a.vy += fy;
      b.vx -= fx; b.vy -= fy;
    }

    // ── 向心力
    const cx = width/2, cy = height/2;
    for (const n of nodes) {
      n.vx += (cx - n.x) * 0.008 * alpha;
      n.vy += (cy - n.y) * 0.008 * alpha;
    }

    // ── 積分 + 邊界
    for (const n of nodes) {
      if (n._fixed) { n.vx = 0; n.vy = 0; continue; }
      n.vx *= (1 - this.velocityDecay);
      n.vy *= (1 - this.velocityDecay);
      n.x = Math.max(n.r + 10, Math.min(width  - n.r - 10, n.x + n.vx));
      n.y = Math.max(n.r + 10, Math.min(height - n.r - 10, n.y + n.vy));
    }

    this.alpha -= this.alphaDecay;
    return true;
  }

  runAll(steps = 300) {
    for (let i = 0; i < steps; i++) {
      if (!this.step()) break;
    }
  }
}

// ═══════════════════════════════════════════════════════════
// §4  SVG RENDERER — 完整渲染邏輯
// ═══════════════════════════════════════════════════════════

class KGRenderer {
  constructor(svgEl, layout) {
    this.svg    = svgEl;
    this.layout = layout;
    this.transform = { x: 0, y: 0, scale: 1 };
    this._activeNodes  = new Set();
    this._hoveredNode  = null;
    this._selectedNode = null;

    this._buildDefs();
    this._buildLayers();
    this._setupPan();
  }

  _buildDefs() {
    const defs = this._el('defs');

    // Arrow markers per edge type
    for (const [key, et] of Object.entries(KG_EDGE_TYPES)) {
      const m = this._el('marker', {
        id: `arrow-${key}`, markerWidth: '10', markerHeight: '7',
        refX: '9', refY: '3.5', orient: 'auto',
      });
      const p = this._el('polygon', {
        points: '0 0, 10 3.5, 0 7',
        fill: et.color, opacity: '0.85',
      });
      m.appendChild(p);
      defs.appendChild(m);
    }

    // Glow filters per node type
    for (const [key, nt] of Object.entries(KG_NODE_TYPES)) {
      const f = this._el('filter', { id: `glow-${key}`, x: '-50%', y: '-50%', width: '200%', height: '200%' });
      const b1 = this._el('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: '4', result: 'blur' });
      const b2 = this._el('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: '2', result: 'blur2' });
      const m  = this._el('feMerge');
      const m1 = this._el('feMergeNode', { in: 'blur' });
      const m2 = this._el('feMergeNode', { in: 'blur2' });
      const m3 = this._el('feMergeNode', { in: 'SourceGraphic' });
      m.append(m1,m2,m3); f.append(b1,b2,m); defs.appendChild(f);
    }

    // Radial gradient for node fill
    for (const [key, nt] of Object.entries(KG_NODE_TYPES)) {
      const g = this._el('radialGradient', { id: `grad-${key}`, cx: '35%', cy: '35%', r: '65%' });
      const s1 = this._el('stop', { offset: '0%',   'stop-color': this._lighten(nt.color, 0.4) });
      const s2 = this._el('stop', { offset: '100%', 'stop-color': nt.color });
      g.append(s1,s2); defs.appendChild(g);
    }

    this.svg.appendChild(defs);
  }

  _lighten(hex, amt) {
    const num = parseInt(hex.slice(1), 16);
    const r = Math.min(255, ((num >> 16) & 0xff) + Math.round(255*amt));
    const g = Math.min(255, ((num >> 8)  & 0xff) + Math.round(255*amt));
    const b = Math.min(255,  (num        & 0xff) + Math.round(255*amt));
    return `#${[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('')}`;
  }

  _buildLayers() {
    this.layerEdge   = this._el('g', { id: 'layer-edges',   class: 'kg-layer' });
    this.layerNode   = this._el('g', { id: 'layer-nodes',   class: 'kg-layer' });
    this.layerLabel  = this._el('g', { id: 'layer-labels',  class: 'kg-layer' });
    this.layerRoot   = this._el('g', { id: 'layer-root' });
    this.layerRoot.append(this.layerEdge, this.layerNode, this.layerLabel);
    this.svg.appendChild(this.layerRoot);
  }

  _setupPan() {
    let drag = null;
    this.svg.addEventListener('mousedown', e => {
      if (e.target === this.svg || e.target === this.layerRoot) {
        drag = { sx: e.clientX, sy: e.clientY, ox: this.transform.x, oy: this.transform.y };
      }
    });
    window.addEventListener('mousemove', e => {
      if (!drag) return;
      this.transform.x = drag.ox + (e.clientX - drag.sx);
      this.transform.y = drag.oy + (e.clientY - drag.sy);
      this._applyTransform();
    });
    window.addEventListener('mouseup', () => { drag = null; });
    this.svg.addEventListener('wheel', e => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      this.transform.scale = Math.max(0.3, Math.min(3, this.transform.scale * factor));
      this._applyTransform();
    }, { passive: false });
  }

  _applyTransform() {
    const { x, y, scale } = this.transform;
    this.layerRoot.setAttribute('transform', `translate(${x},${y}) scale(${scale})`);
  }

  render() {
    this._renderEdges();
    this._renderNodes();
  }

  _renderEdges() {
    this.layerEdge.innerHTML = '';
    for (const e of this.layout.edges) {
      const { source: a, target: b, type, strength = 0.5, label } = e;
      const et = KG_EDGE_TYPES[type] || KG_EDGE_TYPES.CORRELATES;

      // 偏移，防止雙向邊重疊
      const dx = b.x - a.x, dy = b.y - a.y;
      const d  = Math.sqrt(dx*dx + dy*dy) || 1;
      const ox = -dy/d * 6, oy = dx/d * 6;

      // 縮短線段，不穿過節點圓心
      const shrinkA = a.r + 4, shrinkB = b.r + 8;
      const ratio = d > 0 ? 1 : 0;
      const x1 = a.x + ox + dx/d * shrinkA;
      const y1 = a.y + oy + dy/d * shrinkA;
      const x2 = b.x + ox - dx/d * shrinkB;
      const y2 = b.y + oy - dy/d * shrinkB;

      const line = this._el('line', {
        x1, y1, x2, y2,
        stroke: et.color,
        'stroke-width': et.weight * strength + 0.5,
        'stroke-dasharray': et.dash || 'none',
        'stroke-opacity': '0.55',
        'marker-end': `url(#arrow-${type})`,
        class: `kg-edge kg-edge-${type}`,
        'data-source': a.id,
        'data-target': b.id,
        'data-type': type,
      });

      this.layerEdge.appendChild(line);

      // 邊標籤（選填）
      if (label) {
        const mx = (x1+x2)/2, my = (y1+y2)/2;
        const t = this._el('text', {
          x: mx, y: my - 4,
          fill: et.color, 'font-size': '9',
          'text-anchor': 'middle',
          'font-family': 'monospace',
          opacity: '0.7',
          class: 'kg-edge-label',
        });
        t.textContent = label;
        this.layerEdge.appendChild(t);
      }
    }
  }

  _renderNodes() {
    this.layerNode.innerHTML  = '';
    this.layerLabel.innerHTML = '';

    for (const n of this.layout.nodes) {
      const nt = KG_NODE_TYPES[n.type];
      const isActive   = this._activeNodes.has(n.id);
      const isHovered  = this._hoveredNode  === n.id;
      const isSelected = this._selectedNode === n.id;

      const g = this._el('g', {
        class: `kg-node kg-node-${n.type}`,
        'data-id': n.id,
        transform: `translate(${n.x},${n.y})`,
        style: 'cursor:pointer',
      });

      // ── 外光暈（active/hover）
      if (isActive || isHovered || isSelected) {
        const glow = this._el('circle', {
          r: n.r + (isSelected ? 14 : isHovered ? 10 : 7),
          fill: 'none',
          stroke: nt.color,
          'stroke-width': isSelected ? 3 : 1.5,
          opacity: isSelected ? 0.9 : 0.5,
          filter: `url(#glow-${n.type})`,
        });
        g.appendChild(glow);
      }

      // ── 環
      const ring = this._el('circle', {
        r: n.r + 3,
        fill: nt.ring,
        stroke: nt.color,
        'stroke-width': '1',
        opacity: '0.6',
      });

      // ── 主體
      const circle = this._el('circle', {
        r: n.r,
        fill: `url(#grad-${n.type})`,
        stroke: nt.color,
        'stroke-width': isSelected ? 2.5 : 1.5,
      });

      // ── 圖示文字
      const icon = this._el('text', {
        'text-anchor': 'middle', 'dominant-baseline': 'central',
        'font-size': Math.round(n.r * 0.7),
        fill: '#fff', opacity: '0.8',
        style: 'pointer-events:none; user-select:none',
      });
      icon.textContent = nt.icon;

      g.append(ring, circle, icon);

      // ── 事件
      g.addEventListener('mouseenter', () => this._onHover(n.id, true));
      g.addEventListener('mouseleave', () => this._onHover(n.id, false));
      g.addEventListener('click', (ev) => { ev.stopPropagation(); this._onSelect(n.id); });

      // ── 拖曳
      let dragNode = false, dfx, dfy;
      g.addEventListener('mousedown', e => {
        e.stopPropagation();
        dragNode = true;
        n._fixed = true;
        const rect = this.svg.getBoundingClientRect();
        const { scale, x, y } = this.transform;
        dfx = (e.clientX - rect.left - x) / scale - n.x;
        dfy = (e.clientY - rect.top  - y) / scale - n.y;
      });
      window.addEventListener('mousemove', e => {
        if (!dragNode) return;
        const rect = this.svg.getBoundingClientRect();
        const { scale, x, y } = this.transform;
        n.x = (e.clientX - rect.left - x) / scale - dfx;
        n.y = (e.clientY - rect.top  - y) / scale - dfy;
        this.render();
      });
      window.addEventListener('mouseup', () => {
        if (dragNode) { dragNode = false; }
      });

      this.layerNode.appendChild(g);

      // ── 標籤
      const labelG = this._el('g', {
        transform: `translate(${n.x},${n.y + n.r + 11})`,
        style: 'pointer-events:none',
      });
      const lblBg = this._el('rect', {
        x: -28, y: -7, width: 56, height: 13,
        rx: 3, fill: '#0a0e1a', opacity: '0.75',
      });
      const lbl = this._el('text', {
        'text-anchor': 'middle', 'dominant-baseline': 'central',
        'font-size': '9.5',
        fill: nt.color,
        'font-family': '"JetBrains Mono", monospace',
        'font-weight': isActive || isSelected ? '700' : '400',
        opacity: isActive || isSelected || isHovered ? '1' : '0.75',
      });
      lbl.textContent = n.label;
      labelG.append(lblBg, lbl);
      this.layerLabel.appendChild(labelG);
    }
  }

  _onHover(id, enter) {
    this._hoveredNode = enter ? id : null;
    this.render();
    if (enter) this._dispatchEvent('kg:hover', { id });
  }

  _onSelect(id) {
    this._selectedNode = this._selectedNode === id ? null : id;
    this.render();
    this._dispatchEvent('kg:select', {
      id,
      node: this.layout.nodes.find(n => n.id === id),
      edges: this.layout.edges.filter(e => e.source.id === id || e.target.id === id),
    });
  }

  _dispatchEvent(name, detail) {
    this.svg.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
  }

  // ── 外部 API：由 Layer 4 對話記憶調用，高亮活躍節點
  setActiveNodes(ids) {
    this._activeNodes = new Set(ids);
    this.render();
  }

  // ── 外部 API：聚焦到指定節點
  focusNode(id) {
    const node = this.layout.nodeMap[id];
    if (!node) return;
    const w = parseInt(this.svg.getAttribute('width')  || this.svg.clientWidth);
    const h = parseInt(this.svg.getAttribute('height') || this.svg.clientHeight);
    this.transform.x = w/2 - node.x * this.transform.scale;
    this.transform.y = h/2 - node.y * this.transform.scale;
    this._applyTransform();
    this._selectedNode = id;
    this.render();
  }

  _el(tag, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  }
}

// ═══════════════════════════════════════════════════════════
// §5  LAYER 5 PUBLIC CLASS
// ═══════════════════════════════════════════════════════════

class FoamCoreKnowledgeGraph {
  /**
   * @param {Object} opts
   * @param {HTMLElement} opts.container   - 掛載容器
   * @param {Object}      opts.data        - 可選自訂知識圖資料
   * @param {number}      opts.width
   * @param {number}      opts.height
   * @param {Function}    opts.onSelect    - 節點選中回調 (node, edges)
   * @param {Function}    opts.onHover     - 節點懸停回調 (id)
   */
  constructor(opts = {}) {
    this.container = opts.container || document.body;
    this.data      = opts.data      || DEFAULT_KG_DATA;
    this.width     = opts.width     || this.container.clientWidth  || 900;
    this.height    = opts.height    || this.container.clientHeight || 600;
    this.onSelect  = opts.onSelect  || null;
    this.onHover   = opts.onHover   || null;

    this._build();
  }

  _build() {
    // 建立 SVG 元素
    this.svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svgEl.setAttribute('width',  this.width);
    this.svgEl.setAttribute('height', this.height);
    this.svgEl.setAttribute('viewBox', `0 0 ${this.width} ${this.height}`);
    this.svgEl.style.cssText = 'background:#06091a; border-radius:8px; display:block;';
    this.container.appendChild(this.svgEl);

    // 力導向佈局（預先計算）
    this.layout = new ForceLayout(this.data.nodes, this.data.edges, this.width, this.height);
    this.layout.runAll(400);

    // 渲染器
    this.renderer = new KGRenderer(this.svgEl, this.layout);
    this.renderer.render();

    // 事件橋接
    this.svgEl.addEventListener('kg:select', e => {
      if (this.onSelect) this.onSelect(e.detail.node, e.detail.edges);
    });
    this.svgEl.addEventListener('kg:hover', e => {
      if (this.onHover) this.onHover(e.detail.id);
    });
  }

  // ── Layer 4 介面：接收對話中提及的關鍵詞，自動高亮相關節點
  highlightFromQuery(queryText) {
    const text = queryText.toLowerCase();
    const ids = this.data.nodes
      .filter(n =>
        text.includes(n.label.toLowerCase()) ||
        text.includes(n.id.toLowerCase())    ||
        (n.sub && text.includes(n.sub.toLowerCase()))
      )
      .map(n => n.id);
    this.renderer.setActiveNodes(ids);
    return ids;
  }

  // ── 外部：聚焦節點
  focus(id) { this.renderer.focusNode(id); }

  // ── 外部：重新佈局
  relayout() {
    this.layout.alpha = 1.0;
    this.layout.runAll(300);
    this.renderer.render();
  }

  // ── 外部：動態添加節點/邊（來自 Layer 3 跨庫關聯）
  addNode(nodeData) {
    this.data.nodes.push(nodeData);
    this.relayout();
  }

  addEdge(edgeData) {
    this.data.edges.push(edgeData);
    // 重建 layout edges
    this.layout.edges = this.data.edges.map(e => ({
      ...e,
      source: this.layout.nodeMap[e.source] || e.source,
      target: this.layout.nodeMap[e.target] || e.target,
    })).filter(e => e.source && e.target);
    this.renderer.render();
  }

  // ── 導出當前圖譜為 SVG 字串
  exportSVG() {
    return this.svgEl.outerHTML;
  }

  // ── 銷毀
  destroy() {
    this.svgEl.remove();
  }
}

// ═══════════════════════════════════════════════════════════
// §6  MODULE EXPORT (guards against inline code conflict)
// ═══════════════════════════════════════════════════════════

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    FoamCoreKnowledgeGraph,
    KGRenderer,
    ForceLayout,
    KG_NODE_TYPES,
    KG_EDGE_TYPES,
    DEFAULT_KG_DATA,
  };
} else {
  // Only export if not already defined by inline code
  if (!window.FoamCoreKnowledgeGraph) window.FoamCoreKnowledgeGraph = FoamCoreKnowledgeGraph;
  if (!window.KGRenderer)   window.KGRenderer   = KGRenderer;
  if (!window.ForceLayout)  window.ForceLayout  = ForceLayout;
  if (!window.DEFAULT_KG_DATA) window.DEFAULT_KG_DATA = DEFAULT_KG_DATA;
  console.log('🕸️ FoamCore RAG Layer 5 (external module) loaded', {
    nodes: DEFAULT_KG_DATA.nodes.length,
    edges: DEFAULT_KG_DATA.edges.length,
    classes: ['FoamCoreKnowledgeGraph','KGRenderer','ForceLayout'],
  });
}

})(); // end IIFE
