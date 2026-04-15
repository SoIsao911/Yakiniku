/**
 * FoamCore OS — Cost Analysis Module (foamcore-cost.js)
 * =====================================================
 * 生產成本分析模組
 * - 原料價格資料庫 (localStorage: foamcore_cost_db)
 * - Excel 匯入解析 (SheetJS CDN)
 * - 即時配方成本計算
 * - 成本結構視覺化 (SVG donut + bar)
 * - 配方成本比較
 * - 成本優化建議 (連結 RAG)
 * 
 * v1.0  2026-04-09  Initial release
 */

(function () {
    'use strict';

    // ═══════════════════════════════════════════════════
    // §0  CONSTANTS & DEFAULT DATA
    // ═══════════════════════════════════════════════════

    const COST_DB_KEY = 'foamcore_cost_db';
    const COST_VERSION = '2.0';

    // Excel row→field mapping for 600NN template
    // Col 0=category, 1=sub, 2=item, 3=unitPrice, 4=ratio%, 5=perUnitWt, 6=usageWt, 7=cost
    const RAW_MATERIAL_ITEMS = [
        { id: 'eva16',   name: 'EVA-VA16%',    calcField: 'raw_eva16_kg',  phrField: 'eva16_phr',   row: 7  },
        { id: 'eva25',   name: 'EVA-VA25%',    calcField: 'raw_eva25_kg',  phrField: 'eva25_phr',   row: 8  },
        { id: 'ldpe24',  name: 'LDPE MI2.4',   calcField: 'raw_ldpe24_kg', phrField: null,          row: 9  },
        { id: 'ldpe40',  name: 'LDPE MI4.0',   calcField: 'raw_ldpe40_kg', phrField: null,          row: 10 },
        { id: 'acpe',    name: 'AC-PE 母粒',    calcField: 'raw_acpe_kg',   phrField: null,          row: 11 },
        { id: 'aceva',   name: 'AC-EVA 母粒',   calcField: 'raw_aceva_kg',  phrField: null,          row: 12 },
        { id: 'brsb',    name: '溴銻複合阻燃母粒', calcField: 'raw_brsb_kg',   phrField: null,          row: 13 },
        { id: 'redp',    name: '紅磷母粒',       calcField: 'raw_redp_kg',   phrField: 'redPhos_phr', row: 14 },
        { id: 'ath',     name: 'ATH',           calcField: 'raw_ath_kg',    phrField: 'ath_phr',     row: 15 },
        { id: 'filler',  name: '無機填充MB',     calcField: 'raw_filler_kg', phrField: null,          row: 16 },
        { id: 'poe',     name: 'POE',           calcField: 'raw_poe_kg',    phrField: 'poe_phr',     row: 17 },
        { id: 'bht',     name: 'BHT',           calcField: 'raw_bht_kg',    phrField: 'bht_phr',     row: 18 },
        // ── 以下為 Excel 模板外、配方中實際使用的助劑/色母粒 ──
        { id: 'color',   name: '色母粒',         calcField: 'raw_color_kg',  phrField: 'pigment_phr', row: -1 },
        { id: 'dcp',     name: 'DCP',           calcField: 'raw_dcp_kg',    phrField: 'dcp_phr',     row: -1 },
        { id: 'zno',     name: 'ZnO',           calcField: 'raw_zno_kg',    phrField: 'zno_phr',     row: -1 },
        { id: 'urea',    name: '尿素 (Urea)',    calcField: 'raw_urea_kg',   phrField: 'urea_phr',    row: -1 },
        { id: 'cp70',    name: 'CP-70 (氯化石蠟)', calcField: 'raw_cp70_kg', phrField: 'cp70_phr',    row: -1 },
        { id: 'powder',  name: '粉料 (Talc/CaCO₃)', calcField: 'raw_powder_kg', phrField: 'powder_phr', row: -1 },
        { id: 'peg',     name: 'PEG',           calcField: 'raw_peg_kg',    phrField: 'peg_phr',     row: -1 },
        { id: 'uvstab',  name: 'UV 安定劑',      calcField: 'raw_uvstab_kg', phrField: 'uvstab_phr',  row: -1 },
    ];

    const ENERGY_ITEMS = [
        { id: 'gas',   name: '天然氣', unit: '度', row: 20 },
        { id: 'elec',  name: '電力',   unit: '度', row: 21 },
        { id: 'water', name: '水力',   unit: '度', row: 22 },
    ];

    // Direct labor: single consolidated item (月薪資÷產量=每床成本)
    const DIRECT_LABOR_ITEMS = [
        { id: 'direct_labor', name: '直接人力', row: -1 },
    ];

    const PACKAGING_ITEMS = [
        { id: 'pe_bag', name: '大尺寸PE', row: 28 },
    ];

    // Indirect labor: single consolidated item (月薪資÷產量=每床成本)
    const INDIRECT_LABOR_ITEMS = [
        { id: 'indirect_labor', name: '間接人力', row: -1 },
    ];

    const DEPRECIATION_ITEMS = [
        { id: 'mold_maint',  name: '模具維護', row: 37 },
        { id: 'mold_amort',  name: '模具攤提', row: 38 },
        { id: 'equip_maint', name: '設備維護', row: 39 },
        { id: 'equip_amort', name: '設備攤提', row: 40 },
        { id: 'plant_maint', name: '廠區維護', row: 41 },
        { id: 'plant_amort', name: '廠區攤提', row: 42 },
    ];

    const YIELD_ITEMS = [
        { id: 'yield_loss', name: '良率、耗損', row: 44 },
    ];

    // Color palette (consistent with FoamCore OS dark theme)
    const COLORS = {
        variable:   '#0A84FF',
        fixed:      '#FF9F0A',
        profit:     '#30D158',
        rawMat:     '#5E5CE6',
        energy:     '#64D2FF',
        labor:      '#BF5AF2',
        packaging:  '#FF453A',
        accent:     '#0A84FF',
        text:       '#F5F5F7',
        textDim:    '#98989D',
        bg:         'rgba(30,30,35,0.95)',
        card:       'rgba(44,44,50,0.6)',
        border:     'rgba(255,255,255,0.06)',
    };

    // Material colors for bar chart (12 items)
    const MAT_COLORS = [
        '#0A84FF','#5E5CE6','#30D158','#FF9F0A','#64D2FF','#BF5AF2',
        '#FF453A','#FFD60A','#AC8E68','#00C7BE','#FF6482','#98989D'
    ];


    // ═══════════════════════════════════════════════════
    // §1  PRICE DATABASE (localStorage)
    // ═══════════════════════════════════════════════════

    function getDefaultDB() {
        return {
            version: COST_VERSION,
            activeTemplate: '600NN',
            templates: {
                '600NN': {
                    productName: '600 NN',
                    spec: '258cm×150cm×9cm',
                    unitWeight: 10,          // KG per unit
                    density: 0.00214,        // g/cm³
                    pricingPeriod: '',
                    rawMaterials: RAW_MATERIAL_ITEMS.map(m => ({
                        id: m.id, name: m.name, unitPrice: 0, usageRatio: 0, usageWeight: 0, cost: 0
                    })),
                    energy: ENERGY_ITEMS.map(m => ({
                        id: m.id, name: m.name, unitPrice: 0, monthlyTotal: 0, monthlyBeds: 0, perBedUsage: 0, cost: 0
                    })),
                    directLabor: DIRECT_LABOR_ITEMS.map(m => ({
                        id: m.id, name: m.name, monthlySalary: 0, monthlyBeds: 0, costPerUnit: 0
                    })),
                    packaging: PACKAGING_ITEMS.map(m => ({
                        id: m.id, name: m.name, costPerUnit: 0
                    })),
                    indirectLabor: INDIRECT_LABOR_ITEMS.map(m => ({
                        id: m.id, name: m.name, monthlySalary: 0, monthlyBeds: 0, costPerUnit: 0
                    })),
                    depreciation: DEPRECIATION_ITEMS.map(m => ({
                        id: m.id, name: m.name, costPerUnit: 0
                    })),
                    yieldLoss: { costPerUnit: 0 },
                    profitPercent: 60,   // default 60%, adjustable, no cap
                }
            }
        };
    }

    function loadCostDB() {
        try {
            const raw = localStorage.getItem(COST_DB_KEY);
            if (raw) {
                const db = JSON.parse(raw);
                if (db.version === COST_VERSION) {
                    // Migrate: ensure all templates have all RAW_MATERIAL_ITEMS
                    _migrateTemplateItems(db);
                    return db;
                }
            }
        } catch (e) { /* corrupted */ }
        const def = getDefaultDB();
        saveCostDB(def);
        return def;
    }

    function _migrateTemplateItems(db) {
        let changed = false;
        Object.keys(db.templates).forEach(k => {
            const tpl = db.templates[k];
            if (!tpl.rawMaterials) tpl.rawMaterials = [];
            // Add any new items not yet in the template
            RAW_MATERIAL_ITEMS.forEach(def => {
                if (!tpl.rawMaterials.find(m => m.id === def.id)) {
                    tpl.rawMaterials.push({
                        id: def.id, name: def.name, unitPrice: 0,
                        usageRatio: 0, usageWeight: 0, cost: 0
                    });
                    changed = true;
                }
            });
        });
        if (changed) saveCostDB(db);
    }

    function saveCostDB(db) {
        localStorage.setItem(COST_DB_KEY, JSON.stringify(db));
    }

    function getActiveTemplate() {
        const db = loadCostDB();
        return db.templates[db.activeTemplate] || db.templates['600NN'];
    }


    // ═══════════════════════════════════════════════════
    // §1.5  FORMULA SOURCE SELECTOR
    // ═══════════════════════════════════════════════════

    // Tracks which formula data the cost module uses
    let _costFormulaSource = { source: 'current', calc: null, label: '', _key: '' };

    function _costGetActiveCalc() {
        if (_costFormulaSource.source === 'history' && _costFormulaSource.calc) {
            return _costFormulaSource.calc;
        }
        return window.currentCalc || null;
    }

    function _costGetHistory() {
        let prodH = [], labH = [];
        try { prodH = JSON.parse(localStorage.getItem('foamHistory') || '[]'); } catch(e){}
        try { labH = JSON.parse(localStorage.getItem('foamHistoryLab') || '[]'); } catch(e){}
        prodH.forEach(h => { h._mode = 'production'; });
        labH.forEach(h => { h._mode = 'lab'; });
        return { prod: prodH, lab: labH, all: [...prodH, ...labH] };
    }

    function _buildFormulaSourceSelector() {
        const hist = _costGetHistory();
        const currentCalc = window.currentCalc;
        const hasCurrentCalc = !!(currentCalc && (currentCalc.formulaWeight || currentCalc.totalWeight));
        const currentLabel = hasCurrentCalc
            ? `⚡ 當前計算: ${currentCalc.productModel || 'N/A'} ${currentCalc.batchId || ''}`
            : '⚡ 當前計算 (尚未計算)';

        const mkOpts = (arr, prefix, icon) => arr.slice(0, 40).map((h, i) => {
            const label = `${h.productModel || h.product || 'N/A'} ${h.batchId || h.batch || ''}`.trim();
            const date = h.productionDate || '';
            const key = prefix + '_' + i;
            const sel = (_costFormulaSource.source === 'history' && _costFormulaSource._key === key) ? 'selected' : '';
            return `<option value="${key}" ${sel}>${icon} ${label} ${date ? '(' + date + ')' : ''}</option>`;
        }).join('');

        const prodOpts = mkOpts(hist.prod, 'prod', '🏭');
        const labOpts = mkOpts(hist.lab, 'lab', '🔬');
        const isCurrentSelected = _costFormulaSource.source === 'current';

        const activeCalc = _costGetActiveCalc();
        const fwInfo = activeCalc ? `配方總重: ${(activeCalc.formulaWeight || activeCalc.totalWeight || 0).toFixed(2)} KG` : '';

        return `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;background:rgba(94,92,230,0.05);border:1px solid rgba(94,92,230,0.12);border-radius:8px;padding:8px 12px;flex-wrap:wrap;">
            <span style="font-size:11px;color:#5E5CE6;white-space:nowrap;font-weight:600;">📋 配方來源:</span>
            <select id="costFormulaSourceSelect" onchange="window._costSelectFormulaSource(this.value)"
                    style="flex:1;min-width:220px;background:rgba(255,255,255,0.06);color:#F5F5F7;border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:5px 8px;font-size:11px;">
                <option value="current" ${isCurrentSelected ? 'selected' : ''}>${currentLabel}</option>
                ${hist.prod.length > 0 ? `<optgroup label="── 生產模式 History (${hist.prod.length}) ──">${prodOpts}</optgroup>` : ''}
                ${hist.lab.length > 0 ? `<optgroup label="── 實驗模式 History (${hist.lab.length}) ──">${labOpts}</optgroup>` : ''}
            </select>
            <span id="costSourceInfo" style="font-size:10px;color:#64D2FF;">${fwInfo}</span>
        </div>`;
    }

    window._costSelectFormulaSource = function(val) {
        if (val === 'current') {
            _costFormulaSource = { source: 'current', calc: null, label: '', _key: '' };
        } else {
            const parts = val.split('_');
            const mode = parts[0];
            const idx = parseInt(parts[1]);
            let history = [];
            try {
                const key = mode === 'prod' ? 'foamHistory' : 'foamHistoryLab';
                history = JSON.parse(localStorage.getItem(key) || '[]');
            } catch(e){}

            if (history[idx]) {
                const h = history[idx];
                _costFormulaSource = {
                    source: 'history',
                    calc: h,
                    label: `${h.productModel || h.product || 'N/A'} ${h.batchId || h.batch || ''}`.trim(),
                    _key: val,
                };
            }
        }

        // Update info
        const info = document.getElementById('costSourceInfo');
        if (info) {
            const c = _costGetActiveCalc();
            info.textContent = c ? `配方總重: ${(c.formulaWeight || c.totalWeight || 0).toFixed(2)} KG` : '';
        }

        // Refresh active tab
        const activeBtn = document.querySelector('.cost-tab-btn[style*="0A84FF"]');
        const activeIdx = activeBtn ? parseInt(activeBtn.dataset.tab) : 0;
        window._costSwitchTab(activeIdx);
    };


    // ═══════════════════════════════════════════════════
    // §2  EXCEL IMPORT (SheetJS)
    // ═══════════════════════════════════════════════════

    let _xlsxLoaded = false;

    function ensureXLSX(cb) {
        if (_xlsxLoaded && window.XLSX) { cb(); return; }
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
        s.onload = () => { _xlsxLoaded = true; cb(); };
        s.onerror = () => {
            // Fallback: already bundled or offline
            if (window.XLSX) { _xlsxLoaded = true; cb(); }
            else alert('無法載入 SheetJS (XLSX) 函式庫，請檢查網路連線。');
        };
        document.head.appendChild(s);
    }

    function parseExcelCostTemplate(file, callback) {
        ensureXLSX(() => {
            const reader = new FileReader();
            reader.onload = function (e) {
                try {
                    const wb = XLSX.read(e.target.result, { type: 'array' });
                    const results = {};

                    wb.SheetNames.forEach(sheetName => {
                        const ws = wb.Sheets[sheetName];
                        const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
                        const tpl = parseSheetToTemplate(data, sheetName);
                        if (tpl) results[sheetName] = tpl;
                    });

                    callback(null, results);
                } catch (err) {
                    callback(err, null);
                }
            };
            reader.readAsArrayBuffer(file);
        });
    }

    function parseSheetToTemplate(rows, sheetName) {
        // Detect product info from header rows
        const productName = cellVal(rows, 3, 3) || sheetName;
        const spec = cellVal(rows, 4, 3) || '';
        const unitWeight = numVal(rows, 5, 3) || 10;
        const density = numVal(rows, 4, 5) || 0;
        const pricingPeriod = cellVal(rows, 5, 5) || '';

        const tpl = {
            productName, spec, unitWeight, density, pricingPeriod,
            rawMaterials: [], energy: [], directLabor: [], packaging: [],
            indirectLabor: [], depreciation: [], yieldLoss: { costPerUnit: 0 },
            profitPercent: 60,
        };

        // Parse raw materials (rows 7-18)
        RAW_MATERIAL_ITEMS.forEach((def, i) => {
            const r = def.row;
            tpl.rawMaterials.push({
                id: def.id,
                name: cellVal(rows, r, 2) || def.name,
                unitPrice: numVal(rows, r, 3),
                usageRatio: numVal(rows, r, 4),
                usageWeight: numVal(rows, r, 6),
                cost: numVal(rows, r, 7),
            });
        });

        // Energy (rows 20-22)
        ENERGY_ITEMS.forEach(def => {
            tpl.energy.push({
                id: def.id,
                name: cellVal(rows, def.row, 2) || def.name,
                unitPrice: numVal(rows, def.row, 3),
                usageRatio: numVal(rows, def.row, 4),
                usageWeight: numVal(rows, def.row, 6),
                cost: numVal(rows, def.row, 7),
            });
        });

        // Direct labor (rows 24-26) — cost per unit from col 7
        DIRECT_LABOR_ITEMS.forEach(def => {
            tpl.directLabor.push({
                id: def.id, name: cellVal(rows, def.row, 2) || def.name,
                costPerUnit: numVal(rows, def.row, 7),
            });
        });

        // Packaging (row 28)
        PACKAGING_ITEMS.forEach(def => {
            tpl.packaging.push({
                id: def.id, name: cellVal(rows, def.row, 2) || def.name,
                costPerUnit: numVal(rows, def.row, 7),
            });
        });

        // Indirect labor (rows 32-35)
        INDIRECT_LABOR_ITEMS.forEach(def => {
            tpl.indirectLabor.push({
                id: def.id, name: cellVal(rows, def.row, 2) || def.name,
                costPerUnit: numVal(rows, def.row, 7),
            });
        });

        // Depreciation (rows 37-42)
        DEPRECIATION_ITEMS.forEach(def => {
            tpl.depreciation.push({
                id: def.id, name: cellVal(rows, def.row, 2) || def.name,
                costPerUnit: numVal(rows, def.row, 7),
            });
        });

        // Yield loss (row 44)
        tpl.yieldLoss.costPerUnit = numVal(rows, 44, 7);

        return tpl;
    }

    function cellVal(rows, r, c) {
        if (!rows[r]) return '';
        const v = rows[r][c];
        return (v != null) ? String(v).trim() : '';
    }
    function numVal(rows, r, c) {
        if (!rows[r]) return 0;
        const v = rows[r][c];
        if (v == null || v === '') return 0;
        const n = parseFloat(v);
        return isNaN(n) ? 0 : n;
    }


    // ═══════════════════════════════════════════════════
    // §3  FORMULA COST CALCULATION
    // ═══════════════════════════════════════════════════

    /**
     * Calculate cost breakdown from currentCalc + cost template
     * Returns { rawMaterials: [{name,kg,cost},...], rawTotal, energyTotal, directLaborTotal,
     *           packagingTotal, variableTotal, indirectLaborTotal, depreciationTotal,
     *           yieldLossTotal, fixedTotal, productionTotal, profitPercent, profit, finalPrice }
     */
    function calculateFormulaCost(calc, template) {
        if (!calc || !template) return null;

        const tpl = template;
        const unitWeight = tpl.unitWeight || 10; // kg per unit

        // ── Raw material cost ──
        // Strategy: use currentCalc.raw_xxx_kg weights → ratio to unitWeight → unit cost
        // For each material: usageWeight = (raw_xxx_kg / formulaWeight) * unitWeight
        //                    cost = usageWeight * unitPrice
        const formulaWeight = calc.formulaWeight || calc.totalWeight || 1;

        const rawResults = [];
        let rawTotal = 0;

        RAW_MATERIAL_ITEMS.forEach((def, i) => {
            const matKg = calc[def.calcField] || 0;
            const ratio = formulaWeight > 0 ? (matKg / formulaWeight) : 0;
            const usageWt = ratio * unitWeight;
            const price = tpl.rawMaterials[i]?.unitPrice || 0;
            const batchCost = matKg * price;
            const cost = usageWt * price;
            rawResults.push({
                id: def.id,
                name: def.name,
                kg: matKg,
                ratio: ratio,
                usageWeight: usageWt,
                unitPrice: price,
                batchCost: batchCost,
                cost: cost,
            });
            rawTotal += cost;
        });

        // ── Energy (單價 × 每床度數) ──
        let energyTotal = 0;
        const energyResults = tpl.energy.map(e => {
            const perBed = (e.monthlyBeds > 0) ? (e.monthlyTotal / e.monthlyBeds) : (e.perBedUsage || 0);
            const cost = (e.unitPrice || 0) * perBed;
            energyTotal += cost;
            return { ...e, perBedUsage: perBed, cost };
        });

        // ── Direct Labor (月薪資 ÷ 月產量) ──
        let directLaborTotal = 0;
        tpl.directLabor.forEach(l => {
            const cost = (l.monthlyBeds > 0) ? (l.monthlySalary / l.monthlyBeds) : (l.costPerUnit || 0);
            directLaborTotal += cost;
        });

        // ── Packaging ──
        let packagingTotal = 0;
        tpl.packaging.forEach(p => { packagingTotal += (p.costPerUnit || 0); });

        // ── Variable Total (A) ──
        const variableTotal = rawTotal + energyTotal + directLaborTotal + packagingTotal;

        // ── Fixed: Indirect Labor (月薪資 ÷ 月產量) ──
        let indirectLaborTotal = 0;
        tpl.indirectLabor.forEach(l => {
            const cost = (l.monthlyBeds > 0) ? (l.monthlySalary / l.monthlyBeds) : (l.costPerUnit || 0);
            indirectLaborTotal += cost;
        });

        // ── Fixed: Depreciation ──
        let depreciationTotal = 0;
        tpl.depreciation.forEach(d => { depreciationTotal += (d.costPerUnit || 0); });

        // ── Fixed: Yield Loss ──
        const yieldLossTotal = tpl.yieldLoss?.costPerUnit || 0;

        // ── Fixed Total (B) ──
        const fixedTotal = indirectLaborTotal + depreciationTotal + yieldLossTotal;

        // ── Production Total (A+B) ──
        const productionTotal = variableTotal + fixedTotal;

        // ── Profit (C) ──
        const profitPercent = tpl.profitPercent || 60;
        const profit = productionTotal * (profitPercent / 100);

        // ── Final Price ──
        const finalPrice = productionTotal + profit;

        const rawBatchTotal = rawResults.reduce((s, m) => s + m.batchCost, 0);
        return {
            rawMaterials: rawResults,
            rawTotal, rawBatchTotal, energyTotal, energyResults,
            directLaborTotal, packagingTotal, variableTotal,
            indirectLaborTotal, depreciationTotal, yieldLossTotal, fixedTotal,
            productionTotal, profitPercent, profit, finalPrice,
            unitWeight, formulaWeight,
            productName: tpl.productName,
            spec: tpl.spec,
        };
    }


    // ═══════════════════════════════════════════════════
    // §4  SVG VISUALIZATIONS
    // ═══════════════════════════════════════════════════

    function renderDonutSVG(costResult) {
        if (!costResult) return '';
        const { variableTotal, fixedTotal, profit, finalPrice } = costResult;
        if (finalPrice <= 0) return '<div style="color:#98989D;font-size:12px;text-align:center;padding:20px;">尚無成本數據</div>';

        const data = [
            { label: 'A. 變動成本', value: variableTotal, color: COLORS.variable },
            { label: 'B. 固定成本', value: fixedTotal, color: COLORS.fixed },
            { label: 'C. 利潤', value: profit, color: COLORS.profit },
        ].filter(d => d.value > 0);

        const total = data.reduce((s, d) => s + d.value, 0);
        const cx = 100, cy = 100, r = 75, inner = 48;
        let startAngle = -Math.PI / 2;
        let paths = '';
        let legends = '';

        data.forEach((d, i) => {
            const pct = d.value / total;
            const angle = pct * 2 * Math.PI;
            const endAngle = startAngle + angle;
            const largeArc = angle > Math.PI ? 1 : 0;

            const x1 = cx + r * Math.cos(startAngle);
            const y1 = cy + r * Math.sin(startAngle);
            const x2 = cx + r * Math.cos(endAngle);
            const y2 = cy + r * Math.sin(endAngle);
            const ix1 = cx + inner * Math.cos(endAngle);
            const iy1 = cy + inner * Math.sin(endAngle);
            const ix2 = cx + inner * Math.cos(startAngle);
            const iy2 = cy + inner * Math.sin(startAngle);

            paths += `<path d="M${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2} L${ix1},${iy1} A${inner},${inner} 0 ${largeArc} 0 ${ix2},${iy2} Z" fill="${d.color}" opacity="0.85">
                <title>${d.label}: NT$${d.value.toFixed(0)} (${(pct*100).toFixed(1)}%)</title></path>`;

            legends += `<div style="display:flex;align-items:center;gap:6px;font-size:11px;">
                <span style="width:8px;height:8px;border-radius:2px;background:${d.color};flex-shrink:0;"></span>
                <span style="color:#98989D;">${d.label}</span>
                <span style="color:#F5F5F7;font-weight:600;margin-left:auto;">NT$${d.value.toFixed(0)}</span>
                <span style="color:#98989D;font-size:10px;">${(pct*100).toFixed(1)}%</span>
            </div>`;

            startAngle = endAngle;
        });

        return `<div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap;">
            <svg viewBox="0 0 200 200" width="160" height="160" style="flex-shrink:0;">
                ${paths}
                <text x="100" y="95" text-anchor="middle" fill="#F5F5F7" font-size="14" font-weight="700">NT$${finalPrice.toFixed(0)}</text>
                <text x="100" y="112" text-anchor="middle" fill="#98989D" font-size="9">產品定價/床</text>
            </svg>
            <div style="display:flex;flex-direction:column;gap:6px;min-width:160px;">${legends}</div>
        </div>`;
    }

    function renderBarChartSVG(costResult) {
        if (!costResult) return '';
        const items = costResult.rawMaterials.filter(m => m.cost > 0).sort((a, b) => b.cost - a.cost);
        if (items.length === 0) return '';

        const maxCost = items[0].cost;
        const barH = 22, gap = 4, labelW = 110, barMaxW = 160, valW = 80;
        const svgH = items.length * (barH + gap) + 8;
        const svgW = labelW + barMaxW + valW + 10;

        let bars = '';
        items.forEach((m, i) => {
            const y = i * (barH + gap) + 4;
            const w = maxCost > 0 ? (m.cost / maxCost) * barMaxW : 0;
            const color = MAT_COLORS[i % MAT_COLORS.length];
            bars += `
                <text x="${labelW - 4}" y="${y + 15}" text-anchor="end" fill="#98989D" font-size="10">${m.name}</text>
                <rect x="${labelW}" y="${y + 2}" width="${w}" height="${barH - 4}" rx="3" fill="${color}" opacity="0.75">
                    <title>${m.name}: NT$${m.cost.toFixed(1)} (${m.usageWeight.toFixed(3)} kg × NT$${m.unitPrice})</title>
                </rect>
                <text x="${labelW + barMaxW + 6}" y="${y + 15}" fill="#F5F5F7" font-size="10" font-weight="600">NT$${m.cost.toFixed(1)}</text>`;
        });

        return `<svg viewBox="0 0 ${svgW} ${svgH}" width="100%" height="${svgH}" style="max-width:${svgW}px;">
            ${bars}
        </svg>`;
    }


    // ═══════════════════════════════════════════════════
    // §5  COST SUMMARY CARD (injected after calculate)
    // ═══════════════════════════════════════════════════

    /**
     * Called after calculate() — injects a compact cost card into results
     */
    window.updateCostCard = function () {
        // Remove old card
        const old = document.getElementById('costSummaryCard');
        if (old) old.remove();

        const calc = window.currentCalc || (typeof currentCalc !== 'undefined' ? currentCalc : null);
        if (!calc) return;

        const tpl = getActiveTemplate();
        const cost = calculateFormulaCost(calc, tpl);
        if (!cost) return;

        // Check if any prices are set
        const hasAnyPrice = cost.rawMaterials.some(m => m.unitPrice > 0) ||
                            cost.energyTotal > 0 || cost.directLaborTotal > 0 || cost.fixedTotal > 0;

        const cardHTML = `
        <div id="costSummaryCard" class="input-section" style="background:rgba(48,209,88,0.04); border:1px solid rgba(48,209,88,0.15); margin-top:12px;">
            <div class="section-title" style="display:flex;justify-content:space-between;align-items:center;">
                <span style="color:#30D158;">💰 成本分析摘要</span>
                <div style="display:flex;gap:8px;">
                    ${!hasAnyPrice ? '<span style="font-size:10px;color:#FF9F0A;font-weight:500;">⚠ 尚未設定價格，請開啟成本分析模組</span>' : ''}
                    <button onclick="openCostAnalysis()" 
                            style="padding:4px 12px;background:rgba(48,209,88,0.1);border:1px solid rgba(48,209,88,0.3);border-radius:6px;color:#30D158;font-size:11px;font-weight:600;cursor:pointer;"
                            onmouseover="this.style.background='rgba(48,209,88,0.2)'"
                            onmouseout="this.style.background='rgba(48,209,88,0.1)'">
                        詳細分析 →
                    </button>
                </div>
            </div>
            ${hasAnyPrice ? `
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-top:8px;">
                <div style="background:rgba(10,132,255,0.06);border-radius:8px;padding:10px;">
                    <div style="font-size:10px;color:#98989D;">A. 變動成本</div>
                    <div style="font-size:16px;font-weight:700;color:#0A84FF;">NT$${cost.variableTotal.toFixed(0)}</div>
                    <div style="font-size:9px;color:#636366;">原料 ${cost.rawTotal.toFixed(0)} + 能源 ${cost.energyTotal.toFixed(0)} + 人力 ${cost.directLaborTotal.toFixed(0)}</div>
                </div>
                <div style="background:rgba(255,159,10,0.06);border-radius:8px;padding:10px;">
                    <div style="font-size:10px;color:#98989D;">B. 固定成本</div>
                    <div style="font-size:16px;font-weight:700;color:#FF9F0A;">NT$${cost.fixedTotal.toFixed(0)}</div>
                </div>
                <div style="background:rgba(48,209,88,0.06);border-radius:8px;padding:10px;">
                    <div style="font-size:10px;color:#98989D;">C. 利潤 (${cost.profitPercent}%)</div>
                    <div style="font-size:16px;font-weight:700;color:#30D158;">NT$${cost.profit.toFixed(0)}</div>
                </div>
                <div style="background:rgba(255,255,255,0.04);border-radius:8px;padding:10px;border:1px solid rgba(255,255,255,0.08);">
                    <div style="font-size:10px;color:#98989D;">產品定價</div>
                    <div style="font-size:18px;font-weight:800;color:#F5F5F7;">NT$${cost.finalPrice.toFixed(0)}</div>
                    <div style="font-size:9px;color:#636366;">每床 ${cost.unitWeight}KG</div>
                </div>
            </div>
            ` : `
            <div style="text-align:center;padding:12px;color:#636366;font-size:12px;">
                點擊「詳細分析」設定原料價格後，此處將自動顯示成本摘要
            </div>
            `}
        </div>`;

        const resultsDiv = document.getElementById('results');
        if (resultsDiv) {
            resultsDiv.insertAdjacentHTML('beforeend', cardHTML);
        }
    };


    // ═══════════════════════════════════════════════════
    // §6  FULL COST ANALYSIS MODAL
    // ═══════════════════════════════════════════════════

    window.openCostAnalysis = function () {
        let existing = document.getElementById('costAnalysisModal');
        if (existing) existing.remove();

        const db = loadCostDB();
        const tplName = db.activeTemplate;
        const tpl = db.templates[tplName];

        const calc = _costGetActiveCalc();
        const cost = calc ? calculateFormulaCost(calc, tpl) : null;

        const modal = document.createElement('div');
        modal.id = 'costAnalysisModal';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:10000;display:flex;justify-content:center;overflow-y:auto;padding:20px;';

        modal.innerHTML = buildCostModalContent(db, tpl, tplName, cost, calc);
        document.body.appendChild(modal);

        // Auto-recalc summary on initial load
        setTimeout(function(){ if(typeof window._costRecalcSummary==='function') window._costRecalcSummary(); }, 50);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
        // ESC to close
        const escHandler = (e) => {
            if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', escHandler); }
        };
        document.addEventListener('keydown', escHandler);
    };

    function buildCostModalContent(db, tpl, tplName, cost, calc) {
        return `
        <div style="background:${COLORS.bg};border-radius:16px;max-width:900px;width:100%;margin:auto;padding:24px;position:relative;border:1px solid ${COLORS.border};backdrop-filter:blur(20px);">
            <!-- Header -->
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                <div style="font-size:18px;font-weight:700;color:#F5F5F7;">💰 成本分析模組</div>
                <button onclick="document.getElementById('costAnalysisModal').remove()" 
                        style="background:none;border:none;color:#98989D;font-size:20px;cursor:pointer;padding:4px 8px;">✕</button>
            </div>

            <!-- Formula Source Selector -->
            ${_buildFormulaSourceSelector()}

            <!-- Tab navigation -->
            <div id="costTabs" style="display:flex;gap:2px;margin-bottom:16px;background:rgba(255,255,255,0.04);border-radius:8px;padding:2px;">
                ${['價格管理', '成本計算', '視覺分析', '配方比較', '優化建議'].map((t, i) =>
                    `<button class="cost-tab-btn" data-tab="${i}" onclick="window._costSwitchTab(${i})" 
                        style="flex:1;padding:8px 4px;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.2s;
                        ${i === 0 ? 'background:rgba(10,132,255,0.15);color:#0A84FF;' : 'background:transparent;color:#98989D;'}">
                        ${t}
                    </button>`
                ).join('')}
            </div>

            <!-- Tab content container -->
            <div id="costTabContent">
                ${buildPriceManagementTab(tpl, tplName)}
            </div>
        </div>`;
    }

    window._costSwitchTab = function (idx) {
        // Update tab buttons
        document.querySelectorAll('.cost-tab-btn').forEach(btn => {
            const isActive = parseInt(btn.dataset.tab) === idx;
            btn.style.background = isActive ? 'rgba(10,132,255,0.15)' : 'transparent';
            btn.style.color = isActive ? '#0A84FF' : '#98989D';
        });

        const db = loadCostDB();
        const tpl = db.templates[db.activeTemplate];
        const calc = _costGetActiveCalc();
        const cost = calc ? calculateFormulaCost(calc, tpl) : null;

        const container = document.getElementById('costTabContent');
        switch (idx) {
            case 0:
                container.innerHTML = buildPriceManagementTab(tpl, db.activeTemplate);
                setTimeout(function(){ if(typeof window._costRecalcSummary==='function') window._costRecalcSummary(); }, 30);
                break;
            case 1: container.innerHTML = buildCostCalcTab(cost, calc); break;
            case 2: container.innerHTML = buildVisualTab(cost); break;
            case 3: container.innerHTML = buildCompareTab(tpl); break;
            case 4: container.innerHTML = buildOptimizationTab(cost); break;
        }
    };

    window._costSwitchTemplate = function (name) {
        const db = loadCostDB();
        if (db.templates[name]) {
            db.activeTemplate = name;
            saveCostDB(db);
            openCostAnalysis();
        }
    };


    // ── Tab 0: Price Management ──

    function _getLiveCalcWeights() {
        const calc = _costGetActiveCalc();
        if (!calc) return null;
        const formulaWeight = calc.formulaWeight || calc.totalWeight || 0;
        return { calc, formulaWeight };
    }

    function buildPriceManagementTab(tpl, tplName) {
        const live = _getLiveCalcWeights();
        const calc = live ? live.calc : null;
        const formulaWeight = live ? live.formulaWeight : 0;
        const unitWt = tpl.unitWeight || 10;
        const hasCalc = calc && formulaWeight > 0;

        // Build raw material rows with live weight + cost
        const rawRowsHTML = RAW_MATERIAL_ITEMS.map((def, i) => {
            const matKg = calc ? (calc[def.calcField] || 0) : 0;
            const ratio = formulaWeight > 0 ? matKg / formulaWeight : 0;
            const usageWt = ratio * unitWt;
            const price = tpl.rawMaterials[i]?.unitPrice || 0;
            const batchCost = matKg * price;
            const cost = usageWt * price;
            const hasWeight = matKg > 0;

            // Visual separator before formula-only items
            const isFirstExtra = (def.row === -1 && (i === 0 || RAW_MATERIAL_ITEMS[i-1].row !== -1));
            const separator = isFirstExtra ? `<tr><td colspan="7" style="padding:8px 8px 4px;font-size:10px;font-weight:600;color:#BF5AF2;border-top:1px dashed rgba(191,90,242,0.3);">
                ── 助劑 / 色母粒（非 Excel 模板項目）──
            </td></tr>` : '';

            // For color MB, show slot detail
            let colorDetail = '';
            if (def.id === 'color' && calc && calc.colorSlots && calc.colorSlots.length > 0) {
                const slots = calc.colorSlots.filter(s => s.kg > 0);
                if (slots.length > 0) {
                    colorDetail = `<div style="font-size:9px;color:#BF5AF2;margin-top:1px;">` +
                        slots.map(s => `${s.type || 'Slot' + s.slot}: ${s.kg.toFixed(2)}kg`).join(' · ') +
                        `</div>`;
                }
            }

            return separator + `<tr style="${hasWeight ? '' : 'opacity:0.45;'}">
                <td style="padding:5px 8px;color:#F5F5F7;font-size:12px;white-space:nowrap;">
                    ${def.name}${colorDetail}
                </td>
                <td style="padding:5px 4px;text-align:right;">
                    <input type="number" step="0.01" min="0" value="${price}" 
                           data-mat-idx="${i}"
                           onchange="window._costUpdatePrice('rawMaterials',${i},'unitPrice',this.value); window._costRecalcRawRow(${i})"
                           style="width:80px;background:rgba(255,255,255,0.06);color:#F5F5F7;border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:4px 6px;font-size:12px;text-align:right;">
                </td>
                <td style="padding:5px 4px;text-align:right;font-size:11px;color:${hasWeight ? '#64D2FF' : '#636366'};" id="costRawKg_${i}">
                    ${hasWeight ? matKg.toFixed(2) : '-'}
                </td>
                <td style="padding:5px 4px;text-align:right;font-size:11px;color:${hasWeight ? '#98989D' : '#636366'};" id="costRawRatio_${i}">
                    ${hasWeight ? (ratio * 100).toFixed(1) + '%' : '-'}
                </td>
                <td style="padding:5px 4px;text-align:right;font-size:11px;color:${hasWeight ? '#F5F5F7' : '#636366'};" id="costRawUsage_${i}">
                    ${hasWeight ? usageWt.toFixed(3) : '-'}
                </td>
                <td style="padding:5px 4px;text-align:right;font-size:11px;font-weight:600;color:${batchCost > 0 ? '#64D2FF' : '#636366'};" id="costRawBatch_${i}">
                    ${batchCost > 0 ? batchCost.toFixed(1) : '-'}
                </td>
                <td style="padding:5px 4px;text-align:right;font-size:11px;font-weight:600;color:${cost > 0 ? '#30D158' : '#636366'};" id="costRawCost_${i}">
                    ${cost > 0 ? cost.toFixed(1) : '-'}
                </td>
            </tr>`;
        }).join('');

        // Calculate raw total for footer
        let rawTotalLive = 0;
        let rawBatchTotalLive = 0;
        if (hasCalc) {
            RAW_MATERIAL_ITEMS.forEach((def, i) => {
                const matKg = calc[def.calcField] || 0;
                const ratio = formulaWeight > 0 ? matKg / formulaWeight : 0;
                const price = tpl.rawMaterials[i]?.unitPrice || 0;
                rawTotalLive += ratio * unitWt * price;
                rawBatchTotalLive += matKg * price;
            });
        }

        // Generic section builder (for non-raw-material sections)
        const mkRow = (item, section, idx) => `
            <tr>
                <td style="padding:6px 8px;color:#F5F5F7;font-size:12px;">${item.name}</td>
                <td style="padding:6px 4px;">
                    <input type="number" step="0.01" min="0" value="${item.unitPrice || item.costPerUnit || 0}" 
                           onchange="window._costUpdatePrice('${section}',${idx},'unitPrice',this.value); window._costRecalcSummary()"
                           style="width:90px;background:rgba(255,255,255,0.06);color:#F5F5F7;border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:4px 6px;font-size:12px;text-align:right;">
                </td>
            </tr>`;

        const mkSection = (title, items, section, color) => `
            <div style="margin-bottom:16px;">
                <div style="font-size:12px;font-weight:700;color:${color};margin-bottom:6px;">${title}</div>
                <table style="width:100%;border-collapse:collapse;">
                    <thead><tr>
                        <th style="text-align:left;padding:4px 8px;font-size:10px;color:#636366;border-bottom:1px solid rgba(255,255,255,0.06);">品名</th>
                        <th style="text-align:right;padding:4px 8px;font-size:10px;color:#636366;border-bottom:1px solid rgba(255,255,255,0.06);">每床成本(NTD)</th>
                    </tr></thead>
                    <tbody>${items.map((it, i) => mkRow(it, section, i)).join('')}</tbody>
                </table>
            </div>`;

        // Energy section now uses card-based calc in template

        return `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <div style="font-size:13px;font-weight:600;color:#F5F5F7;">價格資料庫 — ${tplName}</div>
            <div style="display:flex;gap:8px;">
                <button onclick="window._costImportExcel()" 
                    style="padding:5px 14px;background:rgba(10,132,255,0.1);border:1px solid rgba(10,132,255,0.3);border-radius:6px;color:#0A84FF;font-size:11px;font-weight:600;cursor:pointer;">
                    📥 匯入 Excel
                </button>
                <button onclick="window._costExportJSON()"
                    style="padding:5px 14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#98989D;font-size:11px;font-weight:600;cursor:pointer;">
                    💾 匯出 JSON
                </button>
                <button onclick="window._costAddTemplate()"
                    style="padding:5px 14px;background:rgba(48,209,88,0.1);border:1px solid rgba(48,209,88,0.3);border-radius:6px;color:#30D158;font-size:11px;font-weight:600;cursor:pointer;">
                    + 新增產品
                </button>
            </div>
        </div>

        ${hasCalc ? `
        <div style="background:rgba(100,210,255,0.06);border:1px solid rgba(100,210,255,0.12);border-radius:8px;padding:8px 12px;margin-bottom:10px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <span style="font-size:11px;color:#64D2FF;">📋 已連結配方:</span>
            <span style="font-size:12px;color:#F5F5F7;font-weight:600;">${calc.productModel || 'N/A'}</span>
            <span style="font-size:10px;color:#98989D;">配方總重 ${formulaWeight.toFixed(2)} KG → 換算每床 ${unitWt} KG</span>
            <span style="font-size:10px;color:#636366;">· 模式: ${calc.mode === 'lab' ? 'Lab' : 'Production'}</span>
        </div>` : `
        <div style="background:rgba(255,159,10,0.06);border:1px solid rgba(255,159,10,0.12);border-radius:8px;padding:8px 12px;margin-bottom:10px;">
            <span style="font-size:11px;color:#FF9F0A;">⚠ 尚未計算配方 — 請先在主介面 Calculate & Predict，原料重量將自動帶入</span>
        </div>`}

        <!-- Product info -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px;">
            <div>
                <label style="font-size:10px;color:#636366;">每床重量 (KG)</label>
                <input type="number" step="0.1" value="${tpl.unitWeight}" onchange="window._costUpdateMeta('unitWeight',this.value)"
                    style="width:100%;background:rgba(255,255,255,0.06);color:#F5F5F7;border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:5px 8px;font-size:12px;margin-top:2px;">
            </div>
            <div>
                <label style="font-size:10px;color:#636366;">利潤率 (%)</label>
                <div style="display:flex;align-items:center;gap:6px;margin-top:2px;">
                    <input type="range" min="0" max="200" step="1" value="${tpl.profitPercent}" id="profitSlider"
                        oninput="document.getElementById('profitVal').value=this.value; window._costUpdateMeta('profitPercent',this.value); window._costRecalcSummary()"
                        style="flex:1;accent-color:#30D158;">
                    <input type="number" id="profitVal" min="0" step="1" value="${tpl.profitPercent}" 
                        onchange="document.getElementById('profitSlider').value=Math.min(200,this.value); window._costUpdateMeta('profitPercent',this.value); window._costRecalcSummary()"
                        style="width:55px;background:rgba(255,255,255,0.06);color:#30D158;border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:4px 6px;font-size:12px;text-align:right;font-weight:700;">
                    <span style="color:#636366;font-size:11px;">%</span>
                </div>
            </div>
            <div>
                <label style="font-size:10px;color:#636366;">定價日期區段</label>
                <input type="text" value="${tpl.pricingPeriod || ''}" onchange="window._costUpdateMeta('pricingPeriod',this.value)"
                    style="width:100%;background:rgba(255,255,255,0.06);color:#F5F5F7;border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:5px 8px;font-size:12px;margin-top:2px;"
                    placeholder="e.g. 2026.04.08-04.30">
            </div>
        </div>

        <div style="max-height:400px;overflow-y:auto;padding-right:4px;">
            <!-- Raw Materials with live weights -->
            <div style="margin-bottom:16px;">
                <div style="font-size:12px;font-weight:700;color:#0A84FF;margin-bottom:6px;">A. 變動成本 — 原料</div>
                <table style="width:100%;border-collapse:collapse;" id="costRawTable">
                    <thead><tr style="border-bottom:1px solid rgba(255,255,255,0.06);">
                        <th style="text-align:left;padding:4px 8px;font-size:10px;color:#636366;">品名</th>
                        <th style="text-align:right;padding:4px 4px;font-size:10px;color:#636366;">單價(NTD/KG)</th>
                        <th style="text-align:right;padding:4px 4px;font-size:10px;color:#64D2FF;">配方(KG)</th>
                        <th style="text-align:right;padding:4px 4px;font-size:10px;color:#636366;">比例</th>
                        <th style="text-align:right;padding:4px 4px;font-size:10px;color:#636366;">每床用量(KG)</th>
                        <th style="text-align:right;padding:4px 4px;font-size:10px;color:#64D2FF;">成本(整手)</th>
                        <th style="text-align:right;padding:4px 4px;font-size:10px;color:#30D158;">成本(每床)</th>
                    </tr></thead>
                    <tbody>${rawRowsHTML}</tbody>
                    <tfoot><tr style="border-top:1px solid rgba(255,255,255,0.1);">
                        <td colspan="5" style="padding:6px 8px;font-size:12px;font-weight:700;color:#0A84FF;">原料成本小計</td>
                        <td style="padding:6px 4px;font-size:12px;font-weight:700;color:#64D2FF;text-align:right;" id="costRawBatchTotal">
                            ${rawBatchTotalLive > 0 ? rawBatchTotalLive.toFixed(0) : '-'}
                        </td>
                        <td style="padding:6px 4px;font-size:12px;font-weight:700;color:#30D158;text-align:right;" id="costRawTotal">
                            ${rawTotalLive > 0 ? rawTotalLive.toFixed(0) : '-'}
                        </td>
                    </tr></tfoot>
                </table>
            </div>

            <!-- Energy: card-based calc -->
            <div style="margin-bottom:16px;">
                <div style="font-size:12px;font-weight:700;color:#64D2FF;margin-bottom:8px;">⚡ A. 變動成本 — 能源</div>
                ${tpl.energy.map((e, i) => {
                    const perBed = e.monthlyBeds > 0 ? (e.monthlyTotal / e.monthlyBeds) : 0;
                    const cost = e.unitPrice * perBed;
                    return `
                    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:10px;margin-bottom:8px;">
                        <div style="font-size:12px;font-weight:600;color:#F5F5F7;margin-bottom:8px;">${e.name}</div>
                        <div style="display:grid;grid-template-columns:1fr auto 1fr auto 1fr;gap:6px;align-items:center;margin-bottom:6px;">
                            <div><div style="font-size:9px;color:#636366;margin-bottom:2px;">當月度數</div>
                                <input type="number" step="1" min="0" value="${e.monthlyTotal||0}"
                                    onchange="window._costUpdateEnergy(${i},'monthlyTotal',this.value)"
                                    style="width:100%;background:rgba(255,255,255,0.06);color:#F5F5F7;border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:4px 6px;font-size:12px;font-family:monospace;text-align:right;"></div>
                            <span style="color:#636366;font-size:14px;">÷</span>
                            <div><div style="font-size:9px;color:#636366;margin-bottom:2px;">當月產量(床)</div>
                                <input type="number" step="1" min="0" value="${e.monthlyBeds||0}"
                                    onchange="window._costUpdateEnergy(${i},'monthlyBeds',this.value)"
                                    style="width:100%;background:rgba(255,255,255,0.06);color:#F5F5F7;border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:4px 6px;font-size:12px;font-family:monospace;text-align:right;"></div>
                            <span style="color:#636366;font-size:14px;">=</span>
                            <div><div style="font-size:9px;color:#64D2FF;margin-bottom:2px;">每床度數</div>
                                <div style="font-size:14px;font-weight:700;color:#64D2FF;text-align:right;padding:4px 6px;">${perBed > 0 ? perBed.toFixed(2) : '-'}</div></div>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr auto 1fr auto 1fr;gap:6px;align-items:center;">
                            <div><div style="font-size:9px;color:#636366;margin-bottom:2px;">單價 (NTD/度)</div>
                                <input type="number" step="0.01" min="0" value="${e.unitPrice||0}"
                                    onchange="window._costUpdateEnergy(${i},'unitPrice',this.value)"
                                    style="width:100%;background:rgba(255,255,255,0.06);color:#F5F5F7;border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:4px 6px;font-size:12px;font-family:monospace;text-align:right;"></div>
                            <span style="color:#636366;font-size:14px;">×</span>
                            <div><div style="font-size:9px;color:#636366;margin-bottom:2px;">每床度數</div>
                                <div style="font-size:13px;color:#98989D;text-align:right;padding:4px 6px;">${perBed > 0 ? perBed.toFixed(2) : '-'}</div></div>
                            <span style="color:#636366;font-size:14px;">=</span>
                            <div><div style="font-size:9px;color:#30D158;margin-bottom:2px;">每床成本</div>
                                <div style="font-size:14px;font-weight:700;color:#30D158;text-align:right;padding:4px 6px;">${cost > 0 ? 'NT$'+cost.toFixed(1) : '-'}</div></div>
                        </div>
                    </div>`;
                }).join('')}
            </div>

            <!-- Direct Labor: single card calc -->
            <div style="margin-bottom:16px;">
                <div style="font-size:12px;font-weight:700;color:#BF5AF2;margin-bottom:8px;">👷 A. 變動成本 — 直接人力</div>
                ${tpl.directLabor.map((l, i) => {
                    const cost = l.monthlyBeds > 0 ? (l.monthlySalary / l.monthlyBeds) : 0;
                    return `
                    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:10px;margin-bottom:8px;">
                        <div style="font-size:12px;font-weight:600;color:#F5F5F7;margin-bottom:8px;">${l.name}</div>
                        <div style="display:grid;grid-template-columns:1fr auto 1fr auto 1fr;gap:6px;align-items:center;">
                            <div><div style="font-size:9px;color:#636366;margin-bottom:2px;">月薪資總額 (NTD)</div>
                                <input type="number" step="1" min="0" value="${l.monthlySalary||0}"
                                    onchange="window._costUpdateLabor('directLabor',${i},'monthlySalary',this.value)"
                                    style="width:100%;background:rgba(255,255,255,0.06);color:#F5F5F7;border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:4px 6px;font-size:12px;font-family:monospace;text-align:right;"></div>
                            <span style="color:#636366;font-size:14px;">÷</span>
                            <div><div style="font-size:9px;color:#636366;margin-bottom:2px;">當月產量(床)</div>
                                <input type="number" step="1" min="0" value="${l.monthlyBeds||0}"
                                    onchange="window._costUpdateLabor('directLabor',${i},'monthlyBeds',this.value)"
                                    style="width:100%;background:rgba(255,255,255,0.06);color:#F5F5F7;border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:4px 6px;font-size:12px;font-family:monospace;text-align:right;"></div>
                            <span style="color:#636366;font-size:14px;">=</span>
                            <div><div style="font-size:9px;color:#30D158;margin-bottom:2px;">每床成本</div>
                                <div style="font-size:14px;font-weight:700;color:#30D158;text-align:right;padding:4px 6px;">${cost > 0 ? 'NT$'+cost.toFixed(1) : '-'}</div></div>
                        </div>
                    </div>`;
                }).join('')}
            </div>

            <!-- Packaging -->
            ${mkSection('📦 A. 變動成本 — 包裝', tpl.packaging, 'packaging', '#FF453A')}

            <!-- Indirect Labor: single card calc -->
            <div style="margin-bottom:16px;">
                <div style="font-size:12px;font-weight:700;color:#FF9F0A;margin-bottom:8px;">👔 B. 固定成本 — 間接人力</div>
                ${tpl.indirectLabor.map((l, i) => {
                    const cost = l.monthlyBeds > 0 ? (l.monthlySalary / l.monthlyBeds) : 0;
                    return `
                    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:10px;margin-bottom:8px;">
                        <div style="font-size:12px;font-weight:600;color:#F5F5F7;margin-bottom:8px;">${l.name}</div>
                        <div style="display:grid;grid-template-columns:1fr auto 1fr auto 1fr;gap:6px;align-items:center;">
                            <div><div style="font-size:9px;color:#636366;margin-bottom:2px;">月薪資總額 (NTD)</div>
                                <input type="number" step="1" min="0" value="${l.monthlySalary||0}"
                                    onchange="window._costUpdateLabor('indirectLabor',${i},'monthlySalary',this.value)"
                                    style="width:100%;background:rgba(255,255,255,0.06);color:#F5F5F7;border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:4px 6px;font-size:12px;font-family:monospace;text-align:right;"></div>
                            <span style="color:#636366;font-size:14px;">÷</span>
                            <div><div style="font-size:9px;color:#636366;margin-bottom:2px;">當月產量(床)</div>
                                <input type="number" step="1" min="0" value="${l.monthlyBeds||0}"
                                    onchange="window._costUpdateLabor('indirectLabor',${i},'monthlyBeds',this.value)"
                                    style="width:100%;background:rgba(255,255,255,0.06);color:#F5F5F7;border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:4px 6px;font-size:12px;font-family:monospace;text-align:right;"></div>
                            <span style="color:#636366;font-size:14px;">=</span>
                            <div><div style="font-size:9px;color:#30D158;margin-bottom:2px;">每床成本</div>
                                <div style="font-size:14px;font-weight:700;color:#30D158;text-align:right;padding:4px 6px;">${cost > 0 ? 'NT$'+cost.toFixed(1) : '-'}</div></div>
                        </div>
                    </div>`;
                }).join('')}
            </div>

            ${mkSection('🏭 B. 固定成本 — 折舊攤提', tpl.depreciation, 'depreciation', '#FFD60A')}

            <div style="margin-bottom:16px;">
                <div style="font-size:12px;font-weight:700;color:#AC8E68;margin-bottom:6px;">B. 固定成本 — 良率、耗損</div>
                <div style="display:flex;align-items:center;gap:8px;">
                    <span style="font-size:12px;color:#F5F5F7;">每床成本 (NTD)</span>
                    <input type="number" step="0.01" min="0" value="${tpl.yieldLoss?.costPerUnit || 0}" 
                           onchange="window._costUpdateYieldLoss(this.value); window._costRecalcSummary()"
                           style="width:100px;background:rgba(255,255,255,0.06);color:#F5F5F7;border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:4px 6px;font-size:12px;text-align:right;">
                </div>
            </div>
        </div>

        <!-- Live summary footer -->
        <div id="costLiveSummary" style="background:rgba(255,255,255,0.04);border-radius:10px;padding:12px;margin-top:10px;border:1px solid rgba(255,255,255,0.06);"></div>

        <input type="file" id="costExcelInput" accept=".xlsx,.xls" style="display:none;" onchange="window._costHandleFile(this)">
        `;
    }

    // Price update handlers
    window._costUpdatePrice = function (section, idx, field, value) {
        const db = loadCostDB();
        const tpl = db.templates[db.activeTemplate];
        const v = parseFloat(value) || 0;
        if (tpl[section] && tpl[section][idx]) {
            if (field === 'unitPrice' && (section === 'directLabor' || section === 'packaging' || section === 'indirectLabor' || section === 'depreciation')) {
                tpl[section][idx].costPerUnit = v;
            } else {
                tpl[section][idx][field] = v;
            }
        }
        saveCostDB(db);
    };

    window._costUpdateMeta = function (field, value) {
        const db = loadCostDB();
        const tpl = db.templates[db.activeTemplate];
        if (field === 'profitPercent' || field === 'unitWeight') {
            tpl[field] = parseFloat(value) || 0;
        } else {
            tpl[field] = value;
        }
        saveCostDB(db);
    };

    window._costUpdateYieldLoss = function (value) {
        const db = loadCostDB();
        const tpl = db.templates[db.activeTemplate];
        tpl.yieldLoss.costPerUnit = parseFloat(value) || 0;
        saveCostDB(db);
    };

    window._costUpdateEnergy = function (idx, field, value) {
        const db = loadCostDB();
        const tpl = db.templates[db.activeTemplate];
        if (tpl.energy && tpl.energy[idx]) {
            tpl.energy[idx][field] = parseFloat(value) || 0;
        }
        saveCostDB(db);
        // Refresh tab to show calculated values
        const activeBtn = document.querySelector('.cost-tab-btn[style*="0A84FF"]');
        const activeIdx = activeBtn ? parseInt(activeBtn.dataset.tab) : 0;
        if (activeIdx === 0) window._costSwitchTab(0);
        else window._costRecalcSummary();
    };

    window._costUpdateLabor = function (section, idx, field, value) {
        const db = loadCostDB();
        const tpl = db.templates[db.activeTemplate];
        if (tpl[section] && tpl[section][idx]) {
            tpl[section][idx][field] = parseFloat(value) || 0;
        }
        saveCostDB(db);
        const activeBtn = document.querySelector('.cost-tab-btn[style*="0A84FF"]');
        const activeIdx = activeBtn ? parseInt(activeBtn.dataset.tab) : 0;
        if (activeIdx === 0) window._costSwitchTab(0);
        else window._costRecalcSummary();
    };

    // ── Live recalculation when price inputs change ──

    window._costRecalcRawRow = function (idx) {
        const live = _getLiveCalcWeights();
        if (!live) return;
        const db = loadCostDB();
        const tpl = db.templates[db.activeTemplate];
        const unitWt = tpl.unitWeight || 10;
        const def = RAW_MATERIAL_ITEMS[idx];
        const matKg = live.calc[def.calcField] || 0;
        const ratio = live.formulaWeight > 0 ? matKg / live.formulaWeight : 0;
        const usageWt = ratio * unitWt;
        const price = tpl.rawMaterials[idx]?.unitPrice || 0;
        const cost = usageWt * price;

        const batchCost = matKg * price;
        const batchEl = document.getElementById('costRawBatch_' + idx);
        if (batchEl) {
            batchEl.textContent = batchCost > 0 ? batchCost.toFixed(1) : '-';
            batchEl.style.color = batchCost > 0 ? '#64D2FF' : '#636366';
        }
        const costEl = document.getElementById('costRawCost_' + idx);
        if (costEl) {
            costEl.textContent = cost > 0 ? cost.toFixed(1) : '-';
            costEl.style.color = cost > 0 ? '#30D158' : '#636366';
        }

        // Recalc totals
        let rawTotal = 0, rawBatchTotal = 0;
        RAW_MATERIAL_ITEMS.forEach((d, i) => {
            const mk = live.calc[d.calcField] || 0;
            const r = live.formulaWeight > 0 ? mk / live.formulaWeight : 0;
            const p = tpl.rawMaterials[i]?.unitPrice || 0;
            rawTotal += r * unitWt * p;
            rawBatchTotal += mk * p;
        });
        const totalEl = document.getElementById('costRawTotal');
        if (totalEl) totalEl.textContent = rawTotal > 0 ? rawTotal.toFixed(0) : '-';
        const batchTotalEl = document.getElementById('costRawBatchTotal');
        if (batchTotalEl) batchTotalEl.textContent = rawBatchTotal > 0 ? rawBatchTotal.toFixed(0) : '-';

        window._costRecalcSummary();
    };

    window._costRecalcSummary = function () {
        const el = document.getElementById('costLiveSummary');
        if (!el) return;

        const db = loadCostDB();
        const tpl = db.templates[db.activeTemplate];
        const calc = _costGetActiveCalc();
        const cost = calc ? calculateFormulaCost(calc, tpl) : null;

        if (!cost || cost.finalPrice <= 0) {
            el.innerHTML = '<div style="text-align:center;font-size:11px;color:#636366;">輸入單價後，此處顯示即時成本匯總</div>';
            return;
        }

        el.innerHTML = `
            <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;">
                <div style="text-align:center;flex:1;min-width:100px;">
                    <div style="font-size:10px;color:#0A84FF;">A. 變動成本</div>
                    <div style="font-size:15px;font-weight:700;color:#0A84FF;">NT$${cost.variableTotal.toFixed(0)}</div>
                </div>
                <div style="text-align:center;flex:1;min-width:100px;">
                    <div style="font-size:10px;color:#FF9F0A;">B. 固定成本</div>
                    <div style="font-size:15px;font-weight:700;color:#FF9F0A;">NT$${cost.fixedTotal.toFixed(0)}</div>
                </div>
                <div style="text-align:center;flex:1;min-width:100px;">
                    <div style="font-size:10px;color:#30D158;">C. 利潤 (${cost.profitPercent}%)</div>
                    <div style="font-size:15px;font-weight:700;color:#30D158;">NT$${cost.profit.toFixed(0)}</div>
                </div>
                <div style="text-align:center;flex:1;min-width:120px;background:rgba(255,255,255,0.04);border-radius:8px;padding:6px;">
                    <div style="font-size:10px;color:#98989D;">產品定價 (A+B+C)</div>
                    <div style="font-size:20px;font-weight:800;color:#F5F5F7;">NT$${cost.finalPrice.toFixed(0)}</div>
                </div>
            </div>`;
    };

    window._costImportExcel = function () {
        document.getElementById('costExcelInput').click();
    };

    window._costHandleFile = function (input) {
        const file = input.files[0];
        if (!file) return;
        parseExcelCostTemplate(file, (err, results) => {
            if (err) { alert('Excel 解析錯誤: ' + err.message); return; }
            const db = loadCostDB();
            let imported = 0;
            Object.keys(results).forEach(sheetName => {
                db.templates[sheetName] = results[sheetName];
                imported++;
            });
            if (imported > 0) {
                db.activeTemplate = Object.keys(results)[0];
                saveCostDB(db);
                if (typeof showToast === 'function') showToast(`已匯入 ${imported} 個產品模板`, 2000);
                openCostAnalysis();
            }
        });
        input.value = '';
    };

    window._costExportJSON = function () {
        const db = loadCostDB();
        const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `foamcore_cost_db_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
    };

    window._costAddTemplate = function () {
        const name = prompt('請輸入新產品代號 (例: 600NS, 700NN):');
        if (!name || !name.trim()) return;
        const db = loadCostDB();
        if (db.templates[name.trim()]) { alert('此產品代號已存在'); return; }
        db.templates[name.trim()] = JSON.parse(JSON.stringify(getDefaultDB().templates['600NN']));
        db.templates[name.trim()].productName = name.trim();
        db.activeTemplate = name.trim();
        saveCostDB(db);
        openCostAnalysis();
    };


    // ── Tab 1: Cost Calculation ──

    function buildCostCalcTab(cost, calc) {
        if (!cost) {
            return `<div style="text-align:center;padding:40px;color:#636366;">
                <div style="font-size:32px;margin-bottom:12px;">📊</div>
                <div style="font-size:14px;">請先在主介面計算配方後，此處將顯示成本明細</div>
                <div style="font-size:11px;margin-top:6px;color:#98989D;">Calculate & Predict → 成本自動計算</div>
            </div>`;
        }

        const fmtNTD = v => v > 0 ? `NT$${v.toFixed(1)}` : '-';

        let rawRows = cost.rawMaterials.map(m => `
            <tr style="${m.cost > 0 ? '' : 'opacity:0.4;'}">
                <td style="padding:5px 8px;font-size:11px;color:#F5F5F7;">${m.name}</td>
                <td style="padding:5px 4px;font-size:11px;color:#98989D;text-align:right;">${m.unitPrice > 0 ? m.unitPrice.toFixed(1) : '-'}</td>
                <td style="padding:5px 4px;font-size:11px;color:#98989D;text-align:right;">${(m.ratio * 100).toFixed(1)}%</td>
                <td style="padding:5px 4px;font-size:11px;color:#98989D;text-align:right;">${m.usageWeight.toFixed(3)}</td>
                <td style="padding:5px 4px;font-size:11px;color:#64D2FF;text-align:right;font-weight:600;">${m.batchCost > 0 ? 'NT$' + m.batchCost.toFixed(1) : '-'}</td>
                <td style="padding:5px 4px;font-size:11px;color:#30D158;text-align:right;font-weight:600;">${fmtNTD(m.cost)}</td>
            </tr>`).join('');

        return `
        <div style="font-size:12px;color:#98989D;margin-bottom:10px;">
            配方總重: ${cost.formulaWeight.toFixed(2)} KG → 產品每床: ${cost.unitWeight} KG
            ${calc ? ` · 產品型號: ${calc.productModel || 'N/A'}` : ''}
        </div>

        <div style="max-height:480px;overflow-y:auto;">
            <!-- Raw materials table -->
            <div style="font-size:12px;font-weight:700;color:#0A84FF;margin-bottom:6px;">A. 原料成本明細</div>
            <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
                <thead><tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
                    <th style="text-align:left;padding:4px 8px;font-size:10px;color:#636366;">品名</th>
                    <th style="text-align:right;padding:4px 4px;font-size:10px;color:#636366;">單價</th>
                    <th style="text-align:right;padding:4px 4px;font-size:10px;color:#636366;">比例</th>
                    <th style="text-align:right;padding:4px 4px;font-size:10px;color:#636366;">用量(KG)</th>
                    <th style="text-align:right;padding:4px 4px;font-size:10px;color:#64D2FF;">成本(整手)</th>
                    <th style="text-align:right;padding:4px 4px;font-size:10px;color:#30D158;">成本(每床)</th>
                </tr></thead>
                <tbody>${rawRows}</tbody>
                <tfoot><tr style="border-top:1px solid rgba(255,255,255,0.1);">
                    <td colspan="4" style="padding:6px 8px;font-size:12px;font-weight:700;color:#0A84FF;">原料成本小計</td>
                    <td style="padding:6px 4px;font-size:12px;font-weight:700;color:#64D2FF;text-align:right;">NT$${cost.rawBatchTotal.toFixed(0)}</td>
                    <td style="padding:6px 4px;font-size:12px;font-weight:700;color:#30D158;text-align:right;">NT$${cost.rawTotal.toFixed(0)}</td>
                </tr></tfoot>
            </table>

            <!-- Summary -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
                ${[
                    ['能源', cost.energyTotal, '#64D2FF'],
                    ['直接人力', cost.directLaborTotal, '#BF5AF2'],
                    ['包裝', cost.packagingTotal, '#FF453A'],
                    ['間接人力', cost.indirectLaborTotal, '#FF9F0A'],
                    ['折舊攤提', cost.depreciationTotal, '#FFD60A'],
                    ['良率耗損', cost.yieldLossTotal, '#AC8E68'],
                ].map(([label, val, color]) => `
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:rgba(255,255,255,0.03);border-radius:6px;">
                        <span style="font-size:11px;color:${color};">${label}</span>
                        <span style="font-size:12px;font-weight:600;color:#F5F5F7;">${fmtNTD(val)}</span>
                    </div>`).join('')}
            </div>

            <!-- Totals -->
            <div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:14px;border:1px solid rgba(255,255,255,0.06);">
                <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                    <span style="font-size:12px;color:#0A84FF;">A. 變動成本</span>
                    <span style="font-size:13px;font-weight:700;color:#0A84FF;">NT$${cost.variableTotal.toFixed(0)}</span>
                </div>
                <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                    <span style="font-size:12px;color:#FF9F0A;">B. 固定成本</span>
                    <span style="font-size:13px;font-weight:700;color:#FF9F0A;">NT$${cost.fixedTotal.toFixed(0)}</span>
                </div>
                <div style="display:flex;justify-content:space-between;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.08);">
                    <span style="font-size:12px;color:#98989D;">A+B 總生產成本</span>
                    <span style="font-size:13px;font-weight:700;color:#F5F5F7;">NT$${cost.productionTotal.toFixed(0)}</span>
                </div>
                <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                    <span style="font-size:12px;color:#30D158;">C. 利潤 (${cost.profitPercent}%)</span>
                    <span style="font-size:13px;font-weight:700;color:#30D158;">NT$${cost.profit.toFixed(0)}</span>
                </div>
                <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:2px solid rgba(255,255,255,0.1);">
                    <span style="font-size:14px;font-weight:800;color:#F5F5F7;">產品定價 (A+B+C)</span>
                    <span style="font-size:18px;font-weight:800;color:#F5F5F7;">NT$${cost.finalPrice.toFixed(0)}</span>
                </div>
            </div>
        </div>`;
    }


    // ── Tab 2: Visual Analysis ──

    function buildVisualTab(cost) {
        if (!cost || cost.finalPrice <= 0) {
            return `<div style="text-align:center;padding:40px;color:#636366;">
                <div style="font-size:32px;margin-bottom:12px;">📈</div>
                <div style="font-size:14px;">需要先設定價格並計算配方</div>
            </div>`;
        }

        return `
        <div style="margin-bottom:20px;">
            <div style="font-size:13px;font-weight:700;color:#F5F5F7;margin-bottom:10px;">成本結構分佈</div>
            ${renderDonutSVG(cost)}
        </div>
        <div>
            <div style="font-size:13px;font-weight:700;color:#F5F5F7;margin-bottom:10px;">原料成本排行</div>
            ${renderBarChartSVG(cost)}
        </div>`;
    }


    // ── Tab 3: Formula Comparison ──

    function buildCompareTab(tpl) {
        // Get history
        let history = [];
        try {
            const mode = (typeof currentMode !== 'undefined') ? currentMode : 'production';
            const key = mode === 'lab' ? 'foamHistoryLab' : 'foamHistory';
            history = JSON.parse(localStorage.getItem(key) || '[]');
        } catch (e) {}

        if (history.length < 2) {
            return `<div style="text-align:center;padding:40px;color:#636366;">
                <div style="font-size:32px;margin-bottom:12px;">⚖️</div>
                <div style="font-size:14px;">需要至少 2 筆歷史配方才能比較成本</div>
                <div style="font-size:11px;margin-top:6px;color:#98989D;">請先在主介面儲存配方記錄</div>
            </div>`;
        }

        // Build selection checkboxes (max 3)
        const listHTML = history.slice(0, 50).map((h, i) => {
            const label = `${h.productModel || h.product || 'N/A'} ${h.batchId || h.batch || ''}`.trim();
            return `<label style="display:flex;align-items:center;gap:6px;padding:4px 0;cursor:pointer;">
                <input type="checkbox" class="cost-compare-check" data-idx="${i}" 
                       style="accent-color:#0A84FF;" ${i < 2 ? 'checked' : ''}>
                <span style="font-size:11px;color:#F5F5F7;">${label}</span>
                <span style="font-size:10px;color:#636366;margin-left:auto;">${h.productionDate || ''}</span>
            </label>`;
        }).join('');

        return `
        <div style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">
            <div style="font-size:12px;color:#98989D;">選擇 2-3 筆配方進行成本比較</div>
            <button onclick="window._costRunCompare()" 
                style="padding:5px 14px;background:rgba(10,132,255,0.15);border:1px solid rgba(10,132,255,0.3);border-radius:6px;color:#0A84FF;font-size:11px;font-weight:600;cursor:pointer;">
                比較 →
            </button>
        </div>
        <div style="max-height:200px;overflow-y:auto;margin-bottom:12px;padding-right:4px;">
            ${listHTML}
        </div>
        <div id="costCompareResult"></div>`;
    }

    window._costRunCompare = function () {
        const checks = document.querySelectorAll('.cost-compare-check:checked');
        const indices = Array.from(checks).map(c => parseInt(c.dataset.idx)).slice(0, 3);
        if (indices.length < 2) { alert('請至少選擇 2 筆配方'); return; }

        let history = [];
        try {
            const mode = (typeof currentMode !== 'undefined') ? currentMode : 'production';
            const key = mode === 'lab' ? 'foamHistoryLab' : 'foamHistory';
            history = JSON.parse(localStorage.getItem(key) || '[]');
        } catch (e) {}

        const db = loadCostDB();
        const tpl = db.templates[db.activeTemplate];

        const selected = indices.map(i => history[i]).filter(Boolean);
        const costs = selected.map(h => {
            // history record uses same field structure as currentCalc
            return {
                label: `${h.productModel || h.product || 'N/A'} ${h.batchId || h.batch || ''}`.trim(),
                cost: calculateFormulaCost(h, tpl),
                record: h,
            };
        });

        // Build comparison table
        let header = '<th style="padding:5px 6px;font-size:10px;color:#636366;text-align:left;">品名</th>';
        costs.forEach(c => { header += `<th style="padding:5px 6px;font-size:10px;color:#0A84FF;text-align:right;">${c.label}</th>`; });
        if (costs.length === 2) header += '<th style="padding:5px 6px;font-size:10px;color:#FF9F0A;text-align:right;">差異</th>';

        let rows = '';
        RAW_MATERIAL_ITEMS.forEach((def, mi) => {
            const vals = costs.map(c => c.cost?.rawMaterials[mi]?.cost || 0);
            const anyNonZero = vals.some(v => v > 0);
            if (!anyNonZero) return;

            rows += '<tr>';
            rows += `<td style="padding:4px 6px;font-size:11px;color:#F5F5F7;">${def.name}</td>`;
            vals.forEach(v => {
                rows += `<td style="padding:4px 6px;font-size:11px;color:#98989D;text-align:right;">NT$${v.toFixed(1)}</td>`;
            });
            if (costs.length === 2) {
                const diff = vals[1] - vals[0];
                const color = diff > 0 ? '#FF453A' : diff < 0 ? '#30D158' : '#636366';
                rows += `<td style="padding:4px 6px;font-size:11px;color:${color};text-align:right;font-weight:600;">${diff > 0 ? '+' : ''}${diff.toFixed(1)}</td>`;
            }
            rows += '</tr>';
        });

        // Totals row
        rows += '<tr style="border-top:2px solid rgba(255,255,255,0.1);">';
        rows += '<td style="padding:6px;font-size:12px;font-weight:700;color:#F5F5F7;">產品定價</td>';
        costs.forEach(c => {
            rows += `<td style="padding:6px;font-size:13px;font-weight:700;color:#F5F5F7;text-align:right;">NT$${(c.cost?.finalPrice || 0).toFixed(0)}</td>`;
        });
        if (costs.length === 2) {
            const diff = (costs[1].cost?.finalPrice || 0) - (costs[0].cost?.finalPrice || 0);
            const color = diff > 0 ? '#FF453A' : diff < 0 ? '#30D158' : '#636366';
            rows += `<td style="padding:6px;font-size:13px;font-weight:700;color:${color};text-align:right;">${diff > 0 ? '+' : ''}NT$${diff.toFixed(0)}</td>`;
        }
        rows += '</tr>';

        document.getElementById('costCompareResult').innerHTML = `
            <table style="width:100%;border-collapse:collapse;">
                <thead><tr style="border-bottom:1px solid rgba(255,255,255,0.08);">${header}</tr></thead>
                <tbody>${rows}</tbody>
            </table>`;
    };


    // ── Tab 4: Optimization Suggestions ──

    function buildOptimizationTab(cost) {
        if (!cost || cost.rawTotal <= 0) {
            return `<div style="text-align:center;padding:40px;color:#636366;">
                <div style="font-size:32px;margin-bottom:12px;">💡</div>
                <div style="font-size:14px;">需要先計算配方成本後，此處將提供優化建議</div>
            </div>`;
        }

        // Auto-generate suggestions based on cost ranking
        const suggestions = [];
        const sorted = cost.rawMaterials.filter(m => m.cost > 0).sort((a, b) => b.cost - a.cost);

        // Top cost driver analysis
        if (sorted.length > 0) {
            const top = sorted[0];
            const topPct = (top.cost / cost.rawTotal * 100).toFixed(1);
            suggestions.push({
                icon: '🔍',
                title: `最大成本項: ${top.name}`,
                desc: `佔原料成本 ${topPct}%，單價 NT$${top.unitPrice}/KG，用量 ${top.usageWeight.toFixed(3)} KG`,
                color: '#FF453A',
            });
        }

        // EVA→LDPE substitution
        const eva16 = cost.rawMaterials.find(m => m.id === 'eva16');
        const eva25 = cost.rawMaterials.find(m => m.id === 'eva25');
        const ldpe24 = cost.rawMaterials.find(m => m.id === 'ldpe24');
        if (eva16 && ldpe24 && eva16.unitPrice > 0 && ldpe24.unitPrice > 0 && eva16.unitPrice > ldpe24.unitPrice) {
            const priceDiff = eva16.unitPrice - ldpe24.unitPrice;
            suggestions.push({
                icon: '🔄',
                title: 'LDPE 替代 EVA 降低成本',
                desc: `EVA-VA16% 單價高於 LDPE MI2.4 NT$${priceDiff.toFixed(1)}/KG，每增加 1KG LDPE 替代可節省約 NT$${(priceDiff / cost.unitWeight).toFixed(1)}/KG 原料成本。注意：會影響交聯度和發泡倍率。`,
                color: '#0A84FF',
            });
        }

        // CaCO₃ / Filler increase
        const filler = cost.rawMaterials.find(m => m.id === 'filler');
        if (filler && filler.unitPrice > 0 && sorted.length > 0 && filler.unitPrice < sorted[0].unitPrice * 0.5) {
            suggestions.push({
                icon: '⬆️',
                title: '增加無機填充降低成本',
                desc: `無機填充MB 單價 NT$${filler.unitPrice}/KG，遠低於高價原料。適度增加可攤薄整體成本，但需注意對密度和機械性能的影響。建議每次調整 ≤5 phr。`,
                color: '#30D158',
            });
        }

        // BHT reduction (radical scavenger reduces DCP efficiency)
        const bht = cost.rawMaterials.find(m => m.id === 'bht');
        if (bht && bht.cost > 0) {
            suggestions.push({
                icon: '⚗️',
                title: '評估 BHT 用量',
                desc: `BHT 為自由基捕捉劑，會降低 DCP 交聯效率。若可接受略低的儲存穩定性，減少 BHT 用量可同時降低成本和提高交聯度。`,
                color: '#BF5AF2',
            });
        }

        // TAC to reduce DCP
        suggestions.push({
            icon: '🧪',
            title: 'TAC 助交聯降低 DCP 用量',
            desc: `添加 TAC (三烯丙基異氰脲酸酯) 作為共交聯劑，可在維持同等交聯度的前提下減少 DCP 用量 15-25%，有效降低助劑成本。`,
            color: '#64D2FF',
        });

        // RAG search integration hint
        const ragHint = (typeof window.foamcoreRAG !== 'undefined' || typeof window.ragSearch === 'function')
            ? `<div style="margin-top:16px;padding:12px;background:rgba(94,92,230,0.06);border:1px solid rgba(94,92,230,0.15);border-radius:8px;">
                <div style="font-size:12px;font-weight:600;color:#5E5CE6;margin-bottom:4px;">🔍 知識庫搜索</div>
                <div style="font-size:11px;color:#98989D;margin-bottom:8px;">在 RAG 知識庫中搜索更多成本優化文獻</div>
                <button onclick="if(typeof openRAGAsk==='function'){document.getElementById('costAnalysisModal').remove();openRAGAsk();}" 
                    style="padding:5px 14px;background:rgba(94,92,230,0.15);border:1px solid rgba(94,92,230,0.3);border-radius:6px;color:#5E5CE6;font-size:11px;font-weight:600;cursor:pointer;">
                    開啟 Ask AI →
                </button>
               </div>`
            : '';

        return `
        <div style="font-size:12px;color:#98989D;margin-bottom:12px;">基於當前配方成本結構的智能優化建議</div>
        <div style="display:flex;flex-direction:column;gap:10px;">
            ${suggestions.map(s => `
                <div style="padding:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;">
                    <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                        <span style="font-size:14px;">${s.icon}</span>
                        <span style="font-size:12px;font-weight:700;color:${s.color};">${s.title}</span>
                    </div>
                    <div style="font-size:11px;color:#98989D;line-height:1.5;">${s.desc}</div>
                </div>
            `).join('')}
        </div>
        ${ragHint}`;
    }


    // ═══════════════════════════════════════════════════
    // §7  EXPOSE API
    // ═══════════════════════════════════════════════════

    window.foamcoreCost = {
        loadDB: loadCostDB,
        saveDB: saveCostDB,
        getActiveTemplate,
        calculateFormulaCost,
        parseExcelCostTemplate,
        RAW_MATERIAL_ITEMS,
    };

    console.log('[FoamCore Cost] Module loaded v' + COST_VERSION);

})();
