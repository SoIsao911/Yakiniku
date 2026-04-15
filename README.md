# FoamCore OS v2.0

**AI-Powered Crosslinked Foam Formulation Engineering Platform**

> EVA / PE / POE 交聯發泡配方工程系統 — 配方預測、品質分析、知識管理、成本計算

![Version](https://img.shields.io/badge/version-2.0-30D158)
![License](https://img.shields.io/badge/license-Proprietary-FF9F0A)
![Platform](https://img.shields.io/badge/platform-Browser%20(localhost)-0A84FF)

---

## Overview

FoamCore OS is a local-first, single-page application for crosslinked foam formulation engineering. It integrates physics-based prediction models, quality analysis, a 100-article RAG knowledge base, 3D knowledge graph visualization, and a complete production cost analysis system — all running in the browser with zero cloud dependency.

Designed for foam manufacturing professionals who manage EVA/LDPE/POE crosslinked foam formulations for mattress, packaging, and industrial applications.

## Features

### 🧪 Formulation Prediction Engine
- **Dual Mode**: Lab (g/phr) and Production (kg) with automatic unit conversion
- **Physics-Based Models**: AC decomposition kinetics, DCP crosslink efficiency, shear heating, mixing losses
- **Tetrahedral Quality Model**: 6-edge quality scoring via Cayley-Menger determinant (Formulation × Temperature × Time × Chemical Kinetics)
- **Dynamic CI Range**: Crosslink Index optimization with per-product adaptive thresholds
- **Mahalanobis Anomaly Detection**: One-Class Classification for quality validation

### 📊 Quality Analysis
- SPC trend charts with Nelson Rules drift detection
- Batch analysis with CSV import/export
- Formula comparison and sensitivity analysis
- Process window visualization
- Product family comparison panel

### 🧠 RAG Knowledge Base
- 100 curated foam engineering articles (Traditional Chinese)
- Chinese tokenization with synonym group expansion
- TF-IDF search with relevance scoring
- AI-powered Q&A integration (Claude / Gemini / Perplexity API)

### 🌐 3D Knowledge Graph
- Three.js atomic orbital visualization model
- DCP as nucleus (highest edge connections)
- Interactive camera orbit with signature "Supernova" animation
- Real-time node/edge exploration

### 💰 Cost Analysis Module (v2.0 New)
- Complete cost structure: Variable (A) + Fixed (B) + Profit (C) = Product Price
- **20 raw materials** mapped to formulation fields (including color MB slots, DCP, ZnO, etc.)
- **Card-based calculators**: Energy (度數÷產量=每床度數×單價), Direct/Indirect Labor (薪資÷產量=每床成本)
- Real-time formula cost linked to calculation results or history records
- **Dual cost display**: 成本(整手) + 成本(每床)
- Cost structure visualization (donut + bar charts)
- Formula cost comparison (side-by-side)
- Cost optimization suggestions with RAG integration
- Excel template import (.xlsx)

### 📥 Production Form Import
- Direct import from Production Form v3.2 / v4.0 (.xlsx)
- Smart field mapping: EVA type → VA% classification, PE → LDPE/POE, AC → PE/EVA carrier, FR → classification
- Color MB individual slot parsing (up to 5 colors)
- Process parameters auto-extraction (temperature, time, steam pressure conversion)

## File Structure

```
FoamCoreOS/
├── FoamCoreOS_v2.0.html      # Main application (1.2 MB)
├── foamcore-cost.js           # Cost analysis module (87 KB)
├── foamcore-kg-builder.js     # Knowledge graph builder + 100 articles (94 KB)
├── foamcore-rag.js            # RAG search engine with Chinese tokenization (30 KB)
├── foamcore-rag-layer5.js     # 3D knowledge graph (Three.js) (30 KB)
├── server.ps1                 # PowerShell local server
├── StartFoamCoreOS.bat        # One-click startup script
├── FoamCore_QuickCost.html    # Standalone cost calculator (45 KB)
└── README.md
```

## Quick Start

### Requirements
- Windows 10/11 with PowerShell, or Python 3.x
- Modern browser (Chrome / Edge / Firefox)
- No internet required (fully offline capable)

### Launch
```
1. Download all files into the same folder
2. Double-click StartFoamCoreOS.bat
3. Browser opens automatically at http://localhost:8080
```

The startup script auto-detects Python or PowerShell and starts a local HTTP server.

### Manual Launch (Alternative)
```bash
# Python
cd /path/to/FoamCoreOS
python -m http.server 8080

# Then open: http://localhost:8080/FoamCoreOS_v2.0.html
```

### Standalone QuickCost Calculator
`FoamCore_QuickCost.html` can be opened directly (double-click, no server needed) for quick formula cost calculations with Production Form import support.

## Technical Architecture

| Component | Technology | Description |
|-----------|-----------|-------------|
| UI | Vanilla HTML/CSS/JS | Single-page app, Apple-inspired dark theme |
| Prediction | Physics-based models | AC/DCP kinetics, shear heating, mixing loss |
| Quality | Cayley-Menger + Mahalanobis | Tetrahedral quality model + anomaly detection |
| RAG | TF-IDF + Chinese tokenizer | 100-article knowledge base with synonym expansion |
| 3D Graph | Three.js r128 | Atomic orbital model with orbital animations |
| Cost | Card-based calculators | Energy/labor calc + raw material pricing |
| Storage | localStorage | All data persisted locally, zero cloud dependency |
| Server | Python http.server / PowerShell | Static file serving only |

## Data Flow

```
Production Form (.xlsx)
        ↓ Import
  ┌─────────────────────────────┐
  │   FoamCore OS Calculator    │
  │   (EVA/PE/POE formulation)  │
  ├─────────────────────────────┤
  │ → Physics Prediction        │
  │ → Quality Scoring           │
  │ → CI / Expansion / Density  │
  │ → Warnings & Suggestions    │
  ├─────────────────────────────┤
  │ → Cost Analysis             │──→ Price DB (localStorage)
  │   · Raw material cost       │
  │   · Energy / Labor / Fixed  │
  │   · Profit margin           │
  │   · Product pricing         │
  ├─────────────────────────────┤
  │ → RAG Knowledge Search      │──→ 100 Articles (Chinese)
  │ → 3D Knowledge Graph        │
  └─────────────────────────────┘
        ↓ Export
  CSV / PDF Report / History
```

## Key Formulations

- **Crosslink Index (CI)**: Effective DCP / Required DCP ratio, with dynamic range per product
- **AC Decomposition**: Temperature + time + ZnO/Unicell effect + shear heating model
- **Expansion Prediction**: Based on effective AC, total suppression (filler + FR + pigment)
- **Quality Score**: Tetrahedral volume via edge scores (e₁–e₆), 0-100 scale
- **Mahalanobis Distance**: Anomaly detection from historical good-product data

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome 90+ | ✅ Full |
| Edge 90+ | ✅ Full |
| Firefox 90+ | ✅ Full |
| Safari 15+ | ⚠️ WebGL may vary |
| Mobile (iOS/Android) | ✅ Responsive layout |

## Privacy & Security

- **100% local**: No data leaves your machine
- **No cloud APIs required**: AI features are optional (user provides own API keys)
- **localStorage only**: All data stored in browser, exportable as JSON/CSV
- **No tracking, no analytics, no telemetry**

## Version History

| Version | Date | Highlights |
|---------|------|------------|
| v2.0 | 2026-04 | Cost analysis module, card-based energy/labor calc, dual cost display (整手/每床), Production Form import in QuickCost |
| v1.2 | 2026-03 | 3D knowledge graph, RAG expansion to 100 articles, batch analysis, formula wizard |
| v1.0 | 2026-01 | Initial release: prediction engine, quality model, basic RAG |

## License

Proprietary — developed for internal manufacturing use.

## Author

Developed by James — CTO & EVA/LDPE Foam Engineer

---

*FoamCore OS — Engineering foam formulations with data, physics, and domain expertise.*
