// ===================================================================
// FoamCore OS — Knowledge Graph Builder v1.0
// ===================================================================
// 自動從以下資料源擷取 entity-relation 三元組，合併到知識圖譜：
//   ① foamHistory（配方紀錄）→ 統計 entity co-occurrence → edge strength
//   ② Literature（文獻庫）→ 規則式 NER 提取三元組
//   ③ Calculate warnings → 缺陷模式關聯
//   ④ 內建領域文獻（BUILT_IN_LITERATURE）→ 預載到 RAG Literature 庫
//
// 依賴：foamcore-rag.js（Layer 1 同義詞 + Literature API）
// ===================================================================

var FoamCoreKGBuilder = (function() {
    'use strict';

    // ═══════════════════════════════════════════════════════════
    // §1  BUILT-IN DOMAIN LITERATURE（內建領域文獻）
    //     預載到 RAG Literature 庫，讓 Ask FoamCore 也能查詢
    // ═══════════════════════════════════════════════════════════

    var BUILT_IN_LITERATURE = [
        {
            title: 'DCP 交聯劑用量對 EVA 泡棉泡孔結構的影響',
            content: '過氧化物（DCP）濃度在交聯發泡中扮演關鍵平衡角色。交聯不足（<0.6 pbw）導致泡孔塌陷，因為交聯網絡無法支撐氣泡壓力。交聯過量（>4 pbw）則限制膨脹、增加密度，並導致膠料脆化開裂。最佳膠含量（gel content）範圍為 60-85%（ASTM D2765 溶劑萃取法）。DCP 分解溫度約 170-180°C，產生自由基引發 EVA 鏈的交聯反應。VA 含量越高，可交聯位點越多，交聯度隨之增加。',
            source: 'Patsnap Eureka Material + J. Polymer Research',
            tags: ['DCP', 'crosslinking', 'cell collapse', 'embrittlement', 'gel content']
        },
        {
            title: 'ZnO 對 AC（偶氮二甲醯胺）分解溫度的影響',
            content: 'AC（ADC, Azodicarbonamide）純品分解溫度約 200-220°C。添加 ZnO 作為活化劑可將分解溫度顯著降低至 170°C，甚至在高用量時降至 150°C 以下。機制為 ZnO 的 O²⁻ 自由離子透過感應效應促進 ADA-ZnO 錯合物形成，降低活化能。硬脂酸（stearic acid）與 ZnO 協同作用，進一步改善 AC 分散性和分解均勻性。DSC 分析顯示 ZnO 添加後 ADC 放熱峰溫度明顯前移。',
            source: 'Scientific.Net MSF Vol.1028 + Levai et al. ACH Models Chem.',
            tags: ['ZnO', 'AC', 'ADC', 'decomposition temperature', 'activator', 'stearic acid']
        },
        {
            title: '交聯與發泡時序控制（ΔT 窗口）',
            content: '在 EVA 交聯二次發泡中，交聯反應必須先於或同步於發泡。最佳 ΔT（交聯溫度 - 發泡溫度）為 5-15°C。若 ΔT 過小或發泡先於交聯，熔體強度不足以支撐泡孔，導致塌陷。Pre-polymer 技術（先部分交聯至 gel content 20-40%）可改善初期黏著性和坯料強度。射出成型溫度 150-180°C，模具溫度 140-170°C，射出壓力 80-150 bar。',
            source: 'Patsnap Eureka Material',
            tags: ['crosslinking timing', 'foaming window', 'cell collapse', 'melt strength']
        },
        {
            title: 'EVA/LDPE 共混比對泡棉力學性能的影響',
            content: 'LDPE-rich 泡棉在室溫展現較高壓縮阻力；EVA-rich 泡棉在 90°C 時壓縮應力急劇上升（entropic 彈性效應）。DCP 交聯的 EVA/LDPE 體系使用 ADC 作為發泡劑，不同共混比影響泡孔形態（cell size, cell density）和應力鬆弛速率。EVA 含量增加→軟化→壓縮永久變形增加；LDPE 含量增加→硬度提升→低溫衝擊性下降。POE 作為第三組分可改善低溫柔韌性和相容性。',
            source: 'Katbab et al. J. Polymer Research 30, 15 (2023)',
            tags: ['EVA', 'LDPE', 'blend ratio', 'compression set', 'cell morphology', 'POE']
        },
        {
            title: 'CaCO₃ 和 TiO₂ 在 EVA 泡棉中的成核效應',
            content: '無機填料作為氣泡成核點，填料越多成核點越多，泡孔頻率分佈在更多直徑區間，產生混合尺寸的泡孔結構。CaCO₃ 純度 98% 常用作填料和成核劑。TiO₂ 奈米級粒子可改善泡孔均勻性。填料增加→密度增加但泡孔尺寸更均勻。滑石粉（talc）同樣具有成核效應，且可抑制冷縮（shrinkage）。',
            source: 'Li et al. PMC (2024) + IAS Bull. Mater. Sci.',
            tags: ['CaCO3', 'TiO2', 'nucleation', 'cell size', 'filler', 'talc']
        },
        {
            title: '物理發泡 vs 化學發泡的泡孔結構比較',
            content: '化學發泡（AC）在 EVA 中產生的泡孔較大且分佈不均勻。物理發泡（超臨界 N₂）可產生 50-100 μm 的均勻微細泡孔，發泡溫度窗口更寬（120-180°C），能耗更低。化學發泡樣品含有 TiO₂ 顯白色；物理發泡需完全交聯後再以高壓 N₂ 發泡。兩種方法的 Tm、Tc、ΔHm 隨交聯度增加而下降，但物理發泡的變化幅度較小。',
            source: 'Li et al. Polymers PMC (2024)',
            tags: ['physical foaming', 'chemical foaming', 'cell structure', 'supercritical N2', 'AC']
        },
        {
            title: 'DCP 交聯 EVA 的機制',
            content: 'DCP 分解產生過氧化自由基（RO·），從聚合物鏈上奪取氫原子形成碳自由基，兩個碳自由基結合形成交聯鍵。EVA 中主要的交聯位點是醋酸基末端的甲基碳原子。VA 含量越高，可交聯位點越多，gel content 隨之增加。用 KOH 水解交聯 EVA 後 gel content 下降，證實了交聯主要發生在 VA 單元。CNT（碳奈米管）可作為自由基清除劑，降低交聯效率。',
            source: 'Bryden JST (2008) + CJPS EVA/LDPE/CNT (2025)',
            tags: ['DCP', 'mechanism', 'free radical', 'VA content', 'gel content', 'CNT']
        },
        {
            title: '多功能單體（TAC/TMPTMA）對 DCP 交聯效率的提升',
            content: 'TAC（三烯丙基氰尿酸酯）可顯著減少達到特定 gel content 所需的 DCP 用量。TAC 約 0.5 phr 最具成本效益。交聯促進效率：TAC > DALP > TMPTMA。烯丙基系單體優於甲基丙烯酸酯。TAC 增加交聯密度，提高熔體模量但降低延伸性，促進更高的成核密度。swell ratio 比 gel content 更能預測發泡行為。',
            source: 'Sipaut & Sims, Cellular Polymers (2008)',
            tags: ['TAC', 'TMPTMA', 'coagent', 'DCP efficiency', 'gel content', 'crosslink density']
        },
        {
            title: '交聯泡棉的冷縮機制與對策',
            content: '高發泡倍率泡棉在冷卻後出現 5% 以上的體積收縮，主要原因是泡孔內氣體快速冷卻收縮而非聚合物本身的熱收縮。對策包括：增加無機填料用量（5→10 phr）提供剛性支撐、優化交聯度以提高泡孔壁強度、控制冷卻速率。LDPE 含量增加可改善尺寸穩定性。32× 以上高倍率泡棉的邊緣硬化現象與模具溫度分佈的山形曲線效應有關。',
            source: 'FoamCore OS 內部分析',
            tags: ['shrinkage', 'cell collapse', 'filler', 'cooling', 'edge hardening', 'expansion ratio']
        },
        {
            title: 'PCR 回收料在 EVA 泡棉中的應用挑戰',
            content: 'PCR（Post-Consumer Recycled）材料摻混配方需注意：PCR 分散性差導致表面不規則和破裂缺陷、AC 分解與 DCP 交聯的時序失配（148°C 下更明顯）、建議增加 DCP 用量補償交聯效率損失、降低 ZnO 以避免過早發泡。PCR 原料需標準化熱歷史處理以改善分散性。',
            source: 'FoamCore OS 內部分析',
            tags: ['PCR', 'recycled', 'dispersion', 'surface defect', 'DCP', 'ZnO']
        },
        // ── 第 11-30 篇：v1.2 知識庫擴充 ──
        {
            title: 'VA 含量與結晶度、硬度、交聯位點的關係',
            content: 'EVA 中 VA（醋酸乙烯）含量是決定材料性能的核心參數。VA 含量 14%（低 VA）結晶度高、硬度高、剛性佳但可交聯位點少；VA 18-20% 為通用型，平衡硬度與柔韌性；VA 25-28%（高 VA）結晶度低、柔軟性好、可交聯位點多但強度下降。交聯位點主要在 VA 單元的甲基碳上，VA% 越高 DCP 交聯效率越高。VA 選錯常導致硬度異常：目標硬度偏硬卻用高 VA 樹脂，或目標偏軟卻用低 VA 樹脂。',
            source: 'Polymer Handbook + FoamCore OS 內部分析',
            tags: ['VA', 'crystallinity', 'hardness', 'crosslink sites', 'EVA grade']
        },
        {
            title: '色母（Color Masterbatch）載體對 DCP 交聯的干擾',
            content: '色母粒由顏料、載體樹脂和分散劑組成。載體樹脂若為 PP 或 HDPE，與 EVA 相容性差，形成分散不良的「島」結構，降低整體交聯均勻性。色母中某些有機顏料含有酚系或胺系結構，會捕捉 DCP 產生的自由基，降低交聯效率。深色配方（高色母添加量 3-5 phr）品質下降的根因多為交聯度不足。建議：使用 EVA 載體色母、降低色母用量改用高濃度型、或適當增加 DCP 0.05-0.1 phr 補償。',
            source: 'FoamCore OS 內部分析 + 色母粒供應商技術文檔',
            tags: ['color masterbatch', 'DCP', 'crosslinking interference', 'pigment', 'carrier resin']
        },
        {
            title: 'Carbon Black 的自由基清除效應',
            content: 'Carbon Black（碳黑，CB）具有大量表面活性位點和共軛 π 電子結構，能高效捕捉自由基（radical scavenging effect），與 DCP 產生的過氧化自由基競爭。特黑色配方（CB 3-5 phr）中 DCP 有效交聯效率可降低 15-30%。對策：增加 DCP 用量（每 1 phr CB 約增加 DCP 0.03-0.05 phr）、選用表面活性較低的熱裂法碳黑代替爐法碳黑、或使用 TAC 多功能單體提升交聯效率。碳奈米管（CNT）也有類似效應。',
            source: 'CJPS EVA/LDPE/CNT (2025) + FoamCore OS 內部分析',
            tags: ['carbon black', 'radical scavenging', 'DCP', 'crosslinking loss', 'CNT']
        },
        {
            title: 'BHT 抗氧化劑用量與過量風險',
            content: 'BHT（二丁基羥基甲苯，Butylated Hydroxytoluene）是 EVA 泡棉常用的酚系抗氧化劑，正常用量 0.1-0.3 phr 可防止加工中的氧化降解。然而 BHT 本身就是自由基捕捉劑，過量（>0.5 phr）會顯著抑制 DCP 交聯反應，導致膠含量下降、泡孔塌陷。診斷線索：配方未變但交聯度突然下降→檢查 BHT 批次用量。另外 BHT 過量會在泡棉表面析出（blooming），產生白色粉末狀外觀缺陷。',
            source: 'Plastics Additives Handbook + FoamCore OS 內部分析',
            tags: ['BHT', 'antioxidant', 'radical scavenger', 'crosslinking inhibition', 'blooming']
        },
        {
            title: 'Urea（尿素）促進劑機制與用量',
            content: 'Urea 是 AC（ADC）發泡劑的重要促進劑，能降低 AC 的分解溫度約 10-20°C 並使分解更均勻。機制為 Urea 與 AC 的中間產物形成錯合物，降低後續分解的活化能。常用量 0.3-1.0 phr。Urea 不足→AC 分解不完全，殘留未分解 AC 導致二次發泡或泡孔不均。Urea 過量→AC 分解過快，氣體釋放速率超過熔體強度，導致泡孔塌陷或表皮破裂。Urea 需與 ZnO 配合使用，兩者協同控制 AC 分解溫度和速率。',
            source: 'AC Blowing Agent Technical Manual + Polymer Processing Literature',
            tags: ['urea', 'AC promoter', 'decomposition', 'activation energy', 'ZnO']
        },
        {
            title: 'ATH 阻燃劑對交聯效率與硬度的影響',
            content: 'ATH（氫氧化鋁，Aluminum Trihydrate）是環保型無機阻燃劑，受熱分解吸收熱量並釋放水蒸氣。常用量 20-60 phr。ATH 高填充會顯著增加混合物黏度、降低發泡倍率、提高硬度。ATH 的水分殘留（>0.3%）會干擾 DCP 交聯：水分子與過氧化自由基反應生成非活性的 ROH，降低交聯效率。阻燃配方硬度偏高的原因：ATH 剛性填料效應 + 交聯度因水分而下降（看似矛盾但物理填充效應>化學損失）。建議：ATH 預先乾燥至含水量<0.1%、使用矽烷偶聯劑表面處理改善界面。',
            source: 'Flame Retardancy of Polymers + FoamCore OS 內部分析',
            tags: ['ATH', 'flame retardant', 'hardness', 'DCP interference', 'moisture']
        },
        {
            title: 'Br-Sb 協效阻燃體系與 DCP 消耗',
            content: '溴系阻燃劑（如十溴二苯醚 DBDPE）與三氧化二銻（Sb₂O₃）協效體系在氣相中生成 SbBr₃ 等鏈終止劑來撲滅火焰。然而 Br 和 Sb 化合物在 DCP 分解溫度下也會與過氧化自由基反應，消耗有效交聯自由基。Br-Sb 過量（>15 phr 合計）可造成 DCP 損耗 20-40%。XRF 分析可快速確認 Cl/Br 含量。解決方案：增加 DCP 補償、使用膨脹型阻燃體系替代、或改用 ATH/MH 無鹵阻燃方案。',
            source: 'FoamCore OS 內部分析 + XRF 配方分析數據',
            tags: ['bromine', 'antimony', 'synergist', 'flame retardant', 'DCP consumption', 'XRF']
        },
        {
            title: '密度-硬度-倍率三角關係',
            content: '泡棉的密度、硬度、發泡倍率之間存在三角耦合關係。發泡倍率 α = ρ_compound / ρ_foam。倍率越高→密度越低→硬度越低（但非線性）。密度偏差診斷：密度偏高→①倍率不足（AC/ZnO 問題）②交聯過度限制膨脹（DCP 過量）③模壓過高。密度偏低→①倍率過高（AC 過量或 ZnO 過量）②交聯不足（DCP 不足導致後膨脹）。硬度偏差需同時考慮密度和交聯度，不能僅調單一因素。Shore A 約等於 Asker C - 15。',
            source: 'FoamCore OS 品質模型',
            tags: ['density', 'hardness', 'expansion ratio', 'triangle relation', 'diagnosis']
        },
        {
            title: '模具溫度分佈的山形曲線效應',
            content: '模具加熱盤的溫度並非均勻分佈，中心溫度高、邊緣溫度低，形成「山形曲線」。溫差範圍通常在 3-8°C。在高倍率（α>30×）配方中，此溫差的影響被放大：中心區域 AC 完全分解、DCP 完全交聯；邊緣區域 AC 殘留 5-15%、交聯度偏低。結果是邊緣硬化（密度高、倍率低）。對策：使用導熱性好的模具材料（鋁合金）、增加模壓時間以確保邊緣也達到足夠溫度、或在模具邊緣增加電熱補償區。',
            source: 'FoamCore OS 內部分析',
            tags: ['mold temperature', 'mountain curve', 'edge hardening', 'temperature distribution', 'expansion ratio']
        },
        {
            title: '煉膠工藝：溫度、次數、填充率的優化',
            content: '兩輥開煉機（Two-Roll Mill）的煉膠工藝直接影響配方分散均勻性。關鍵參數：①輥溫：EVA 體系建議 70-90°C，溫度過高→DCP 提前分解（scorch），溫度過低→混合不均。②翻膠次數：最少 6 次以上（薄通法），CaCO₃/ATH 等填料需增至 10+ 次。③填充率（Fill Factor）：兩輥間距 V 型存料區的填滿程度，建議 0.7-0.85，過低→效率差，過高→剪切不足分散差。分散不良的表徵：泡棉表面魚眼（fish eye）、局部硬點、色差不均。密煉機（Banbury）的填充率控制在 0.70-0.75。',
            source: '橡塑加工手冊 + FoamCore OS 內部分析',
            tags: ['two-roll mill', 'mixing', 'temperature', 'fill factor', 'dispersion', 'Banbury']
        },
        {
            title: 'AC-EVA vs AC-PE 載體選擇邏輯',
            content: 'AC 發泡劑以母粒形式供應時，載體樹脂的選擇影響分散性和分解時序。AC-EVA 載體：與 EVA 基體相容性好，適用於 EVA-only 或 EVA+POE 配方；分散快、分解溫度略低。AC-PE 載體：與 LDPE 基體相容性好，適用於 EVA+LDPE 或 LDPE-dominant 配方；分散需要更長時間但分解更均勻。載體選錯的後果：AC-EVA 用於 LDPE 體系→AC 在 EVA 島中優先分解，發泡不均勻；AC-PE 用於 EVA 體系→分散慢，局部 AC 聚集導致大泡孔。',
            source: 'AC 母粒供應商技術指南 + FoamCore OS 內部分析',
            tags: ['AC-EVA', 'AC-PE', 'carrier resin', 'dispersion', 'decomposition timing']
        },
        {
            title: 'CI 交聯指數計算公式與意義',
            content: 'FoamCore OS 使用交聯指數 CI（Crosslinking Index）作為交聯度的綜合評估指標。CI = DCP_phr × (1 + VA%/100) × (1 - CB_phr×0.05) × time_factor。其中 time_factor = min(1, time2/optimal_time)。CI 正常範圍 0.5-1.5。CI<0.5 表示交聯不足風險（塌陷、冷縮）；CI>1.5 表示交聯過度風險（脆化、低倍率）。CI 診斷可識別出：DCP 用量正常但因色母/CB/BHT 干擾而交聯度不足的隱性問題。膠含量 gel content 與 CI 呈正相關但非線性。',
            source: 'FoamCore OS 品質模型',
            tags: ['CI', 'crosslinking index', 'DCP', 'gel content', 'diagnosis']
        },
        {
            title: '發泡倍率與泡孔結構的定量關係',
            content: '發泡倍率 α 與泡孔結構存在定量關係。低倍率（10-15×）→泡孔小且密（cell size 50-100μm, cell density 高）→硬度高、回彈慢。中倍率（20-30×）→泡孔中等（100-200μm）→最佳力學平衡。高倍率（30-40×）→泡孔大（>200μm）→風險區，泡孔壁薄易塌陷。超高倍率（>40×）→需要極精確的交聯-發泡平衡，否則泡孔必然塌陷。高倍率泡孔塌陷的根因通常是 DCP 不足或時間不夠，而非 AC 問題。',
            source: 'Cellular Polymers Journal + FoamCore OS 內部分析',
            tags: ['expansion ratio', 'cell structure', 'cell size', 'cell density', 'collapse']
        },
        {
            title: 'HALS/UV 穩定劑與老化防護',
            content: 'HALS（受阻胺光穩定劑，Hindered Amine Light Stabilizer）是戶外用 EVA 泡棉的關鍵添加劑。HALS 通過 Denisov 循環捕捉光降解產生的自由基，具有再生性。常用量 0.3-1.0 phr。UV 吸收劑（如 UV-327、UV-531）與 HALS 協同使用效果更佳。HALS 與 DCP 的交互：HALS 在加工溫度下穩定，不會干擾 DCP 交聯（與 BHT 不同）。戶外產品褪色問題的排查：①顏料耐光性不足②HALS/UV 穩定劑缺失③EVA 中 VA% 偏高加速光降解。',
            source: 'Plastics Additives Handbook + BASF Light Stabilizer Guide',
            tags: ['HALS', 'UV stabilizer', 'aging', 'yellowing', 'outdoor', 'light stability']
        },
        {
            title: '常見缺陷 Root Cause 診斷流程',
            content: '泡棉缺陷系統化診斷：①泡孔塌陷→檢查 DCP（不足？）→檢查 CI 指數→檢查 BHT/CB 干擾→檢查模壓時間。②表皮破裂→檢查 AC 用量（過多？）→檢查 ZnO 用量→檢查開模速度→檢查模溫是否過高。③冷縮→檢查填料量（<5phr？）→檢查交聯度→檢查冷卻方式。④邊緣硬化→檢查倍率（>30×？）→檢查模溫分佈→檢查加壓時間。⑤表面魚眼→檢查煉膠次數→檢查填料分散→檢查色母相容性。⑥黃變→檢查 BHT 過量→檢查加工溫度→檢查 HALS/UV。⑦起泡（blistering）→檢查水分→檢查 AC 分解殘留→檢查交聯度。⑧分層（delamination）→檢查相容性→檢查煉膠溫度。',
            source: 'FoamCore OS 品質診斷手冊',
            tags: ['root cause', 'diagnosis', 'defect', 'troubleshooting', 'systematic']
        },
        {
            title: 'EVA 等級選擇指南 (VA14/18/25/28)',
            content: 'EVA 樹脂的選擇取決於目標產品性能。VA14-16（如 UE630 VA16）：結晶度較高，硬度偏硬，適合需要支撐性的鞋底。VA18-20（如 UE632/UE633）：通用型，硬度 Shore A 65-75，適合運動鞋中底、瑜珈墊。VA25（如 UE634）：柔軟型，硬度 Shore A 50-60，適合嬰兒墊、護具。VA28+（如特種牌號）：超軟型，硬度 Shore A 40-50，適合高端緩衝。MI（熔融指數）也很重要：MI 2-5 適合壓縮成型，MI 15-25 適合射出成型。選錯等級是硬度異常的最常見根因之一。注意：USI 牌號編號與 VA% 並非直接對應，務必以供應商 TDS 確認。',
            source: '樹脂供應商技術手冊 + FoamCore OS 內部分析',
            tags: ['EVA grade', 'VA14', 'VA18', 'VA25', 'VA28', 'MI', 'melt index', 'selection guide']
        },
        {
            title: '測試標準：ASTM D2765、Shore、Asker C',
            content: 'ASTM D2765 溶劑萃取法測定膠含量（gel content）：取樣→二甲苯迴流萃取 12h→計算不溶分比例→gel%=60-85% 為正常。Shore A 硬度計：測量平坦表面，施壓 15 秒讀數，適用範圍 10-90A。Asker C 硬度計：日本標準，適用軟質泡棉，Asker C ≈ Shore A + 15。壓縮永久變形（ASTM D395）：壓縮 50%×72h@23°C 或 25%×6h@70°C。撕裂強度（ASTM D624）：Die C 型試片。密度（ASTM D297 或水中法）：至少取 3 個位置平均。',
            source: 'ASTM Standards + JIS Standards',
            tags: ['ASTM D2765', 'Shore A', 'Asker C', 'compression set', 'testing', 'gel content']
        },
        {
            title: 'QS 品質分數各組分權重解釋',
            content: 'FoamCore OS 的 QS（Quality Score）由多個維度加權計算：①密度偏差（權重 25%）：|actual-target|/target，0 最佳。②硬度偏差（權重 20%）。③發泡倍率偏差（權重 15%）。④交聯指數 CI 偏離最佳區（權重 15%）：CI 在 0.7-1.2 得滿分。⑤泡孔結構評分（權重 10%）。⑥表皮品質評分（權重 10%）。⑦缺陷扣分（權重 5%）：每個 warning 扣 5-15 分。QS>85 為優良，70-85 為合格，<70 需要改善。理解各組分權重有助於對策排優先順序。',
            source: 'FoamCore OS 品質模型文檔',
            tags: ['QS', 'quality score', 'weight', 'density', 'hardness', 'evaluation']
        },
        {
            title: '水洗/後處理對尺寸穩定性的影響',
            content: '交聯發泡後的水洗（washing）和後處理直接影響產品尺寸穩定性。水洗溫度 60-80°C 可加速殘留 AC 分解產物和未反應小分子的析出，改善 VOC 和氣味。但水洗後乾燥不完全→殘留水分→後續高溫環境下起泡。冷縮與後處理的關係：①剛出模的泡棉應避免急冷→緩慢冷卻至室溫（4-8h）。②水洗後需完全乾燥至含水量<0.5%。③堆放方式影響尺寸→平放不疊壓，避免自重變形。後處理不當是冷縮投訴最常被忽略的根因之一。',
            source: 'FoamCore OS 內部分析 + 製程標準作業程序',
            tags: ['washing', 'post-processing', 'shrinkage', 'dimensional stability', 'drying', 'VOC']
        },
        {
            title: '配方成本優化策略',
            content: '降本不降質的策略：①以 LDPE 部分替代 EVA（LDPE 價格約 EVA 的 60-70%），但需注意硬度會提高。②增加 CaCO₃ 填充量（最便宜的填料），但超過 10 phr 影響倍率和外觀。③使用 AC-PE 替代 AC-EVA（PE 載體較便宜），需確認配方相容性。④降低 DCP 同時添加 TAC 多功能單體（DCP 價格高，TAC 可減少 DCP 用量 30-50%）。⑤回收料摻混（5-15%），需要額外的品質控制。成本優化必須伴隨小量試產驗證，切勿直接套用到量產。',
            source: 'FoamCore OS 內部分析 + 採購數據庫',
            tags: ['cost optimization', 'LDPE substitution', 'CaCO3 filler', 'TAC', 'PCR', 'formulation']
        },
        // ══════════════════════════════════════════════════════════
        // #31-100: v1.2.1 大規模知識庫擴充
        // 主題：配方實戰案例、添加劑應用、改善方案
        // ══════════════════════════════════════════════════════════

        // ── A. 配方實戰案例（Case Studies）──
        {
            title: '案例：運動鞋中底 32× 倍率泡孔塌陷',
            content: '問題：運動鞋中底配方 EVA VA18 100phr、AC 8phr、DCP 0.8phr、ZnO 2phr，目標倍率 32×，實際泡孔嚴重塌陷。診斷：CI 交聯指數計算 = 0.8×(1+18/100) = 0.944，在正常範圍。但檢查發現 BHT 被錯誤添加 0.8phr（正常 0.2phr），BHT 過量抑制了 DCP 交聯。解法：將 BHT 降至 0.2phr，DCP 增至 0.9phr 補償。結果：膠含量從 52% 恢復至 72%，泡孔結構正常。教訓：交聯劑和抗氧化劑的平衡是關鍵。',
            source: 'FoamCore OS 案例庫 #CS001',
            tags: ['case study', 'cell collapse', 'BHT', 'DCP', 'gel content', 'sport shoe']
        },
        {
            title: '案例：深色 EVA 泡棉硬度偏低 10 度',
            content: '問題：特黑色配方（CB 4phr + 黑色母 3phr）硬度比標準白色配方低 Asker C 10 度。診斷：Carbon Black 4phr 消耗 DCP 約 15-20%（自由基清除效應），黑色母載體 PP 與 EVA 不相容。解法：①DCP 從 0.7 增至 0.85phr（+0.05 per phr CB）②改用 EVA 載體黑色母③添加 TAC 0.3phr 提升交聯效率。結果：硬度恢復正常，色彩均勻度也改善。',
            source: 'FoamCore OS 案例庫 #CS002',
            tags: ['case study', 'carbon black', 'color masterbatch', 'hardness', 'DCP compensation', 'TAC']
        },
        {
            title: '案例：阻燃 EVA 泡棉倍率不足',
            content: '問題：阻燃配方 ATH 40phr + EVA VA18，目標倍率 25× 實際只有 18×。診斷：ATH 40phr 大幅增加混合物黏度，限制泡孔膨脹；ATH 含水量 0.5% 干擾 DCP 交聯。解法：①ATH 預乾燥至含水量 <0.1%②AC 從 6 增至 7.5phr 補償③DCP 從 0.7 增至 0.85phr④添加硬脂酸 1.5phr 改善 ATH 分散。結果：倍率達到 23×（接近目標），硬度在可接受範圍。',
            source: 'FoamCore OS 案例庫 #CS003',
            tags: ['case study', 'ATH', 'flame retardant', 'expansion ratio', 'moisture', 'drying']
        },
        {
            title: '案例：瑜珈墊邊緣硬化嚴重',
            content: '問題：瑜珈墊配方 EVA/LDPE 70/30，倍率 25×，邊緣 3cm 區域硬度比中心高 15 度。診斷：模具溫度量測確認邊緣比中心低 6°C（山形曲線效應）。在 25× 倍率下此溫差已造成邊緣 AC 殘留約 10%。解法：①延長模壓時間 30 秒（確保邊緣達到完全分解溫度）②模具邊緣增加電熱補償帶③改用導熱更好的鋁合金模具。結果：邊緣硬度差從 15 度縮小至 3 度。',
            source: 'FoamCore OS 案例庫 #CS004',
            tags: ['case study', 'edge hardening', 'yoga mat', 'mold temperature', 'mountain curve']
        },
        {
            title: '案例：EVA 泡棉冷縮 8% 客訴',
            content: '問題：32× 高倍率鞋材泡棉出廠後 48 小時內體積縮小 8%，客戶退貨。診斷：配方填料僅 3phr CaCO₃，交聯度偏低（gel% 58%），出模後急冷（風扇直吹）。解法：①CaCO₃ 增至 8phr（提供骨架支撐）②DCP 增加 0.1phr 提升交聯度至 gel% 68%③出模後改為室溫自然冷卻 6 小時④堆放改為平放不疊壓。結果：冷縮從 8% 降至 2%（業界可接受範圍）。',
            source: 'FoamCore OS 案例庫 #CS005',
            tags: ['case study', 'shrinkage', 'CaCO3', 'filler', 'cooling', 'DCP', 'gel content']
        },
        {
            title: '案例：表皮破裂率從 15% 降至 2%',
            content: '問題：生產線表皮破裂率高達 15%，配方 AC 7phr、ZnO 2.5phr。診斷：ZnO 2.5phr 使 AC 分解溫度過低（約 155°C），氣體釋放速率過快，超過交聯網絡的承受力。解法：①ZnO 從 2.5 降至 1.8phr（提高 AC 分解溫度約 8°C）②模壓前 3 分鐘先低壓（50%→100%）讓氣體緩慢釋放③DCP 增加 0.05phr 強化交聯網絡。結果：破裂率從 15% 降至 2%。',
            source: 'FoamCore OS 案例庫 #CS006',
            tags: ['case study', 'rupture', 'ZnO', 'AC', 'pressure control', 'decomposition temperature']
        },
        {
            title: '案例：PCR 回收料 20% 摻混配方開發',
            content: '問題：客戶要求含 20% PCR 的環保配方，直接摻混後表面粗糙、硬度不穩定。診斷：PCR 批次間 MI 差異大（2-15）、含有雜質和已交聯碎片、熱歷史不一致。解法：①PCR 預處理：80°C 乾燥 4h + 密煉機 90°C 重混煉均化②配方補償：DCP +0.15phr、ZnO -0.3phr③品質窗口放寬：硬度容許 ±5 度④先以 10% 摻混驗證再逐步提高。結果：10% PCR 配方品質穩定，20% 仍需持續優化。',
            source: 'FoamCore OS 案例庫 #CS007',
            tags: ['case study', 'PCR', 'recycled', 'sustainability', 'dispersion', 'quality control']
        },
        {
            title: '案例：黃色泡棉褪色問題',
            content: '問題：黃色 EVA 泡棉戶外使用 3 個月後嚴重褪色。診斷：①未添加 HALS/UV 穩定劑②使用有機偶氮黃顏料（耐光性差，藍標等級僅 3）③EVA VA25 高 VA 含量加速光降解。解法：①添加 HALS 0.5phr + UV-531 0.3phr②改用無機鉻黃或 Irgalite Yellow（耐光性 7-8）③EVA 改為 VA18 降低光降解速率④色母中加入少量 TiO₂ 作為 UV 屏障。結果：加速老化測試 500h 後色差 ΔE < 2（合格）。',
            source: 'FoamCore OS 案例庫 #CS008',
            tags: ['case study', 'yellowing', 'fading', 'HALS', 'UV stabilizer', 'pigment', 'outdoor']
        },
        {
            title: '案例：魚眼缺陷批次性出現',
            content: '問題：某批次泡棉表面出現大量魚眼（直徑 1-3mm 硬點），之前批次無此問題。診斷：追溯發現該批次更換了新供應商的 CaCO₃，粒徑分佈偏粗（D90 從 15μm 變為 45μm），且含有少量硬團聚體。解法：①回復原供應商 CaCO₃②若必須用新供應商，增加煉膠次數從 8 次到 14 次③預先用三輥研磨機過一次。結果：回復原供應商後魚眼消失。長期對策：建立原料入庫檢驗（粒徑分佈 D90<20μm）。',
            source: 'FoamCore OS 案例庫 #CS009',
            tags: ['case study', 'fisheye', 'CaCO3', 'particle size', 'supplier change', 'dispersion']
        },
        {
            title: '案例：起泡缺陷與水分關聯',
            content: '問題：梅雨季期間泡棉表面出現 0.5-2mm 小水泡（blistering），乾季正常。診斷：EVA 粒子含水量從正常的 0.05% 上升至 0.3%；ATH 含水量從 0.1% 上升至 0.8%。水分在發泡溫度下汽化產生額外氣泡。解法：①所有粉料使用前 80°C 烘乾 4h②EVA 粒子 60°C 除濕 2h③混煉室維持 <60% 相對濕度④密煉機排氣口保持暢通。結果：起泡率從 12% 降至 0.5%。教訓：水分是看不見的殺手。',
            source: 'FoamCore OS 案例庫 #CS010',
            tags: ['case study', 'blistering', 'moisture', 'humidity', 'ATH', 'drying', 'seasonal']
        },
        {
            title: '案例：DCP 批次差異導致硬度波動',
            content: '問題：同一配方不同批次硬度波動 ±8 度（Asker C），遠超 ±3 度的規格。診斷：DCP 不同批次的有效成分含量差異（純度 98% vs 95%），且儲存條件不佳（>30°C）導致部分 DCP 提前分解。解法：①DCP 入庫檢驗（DSC 測分解溫度一致性）②DCP 冷藏保存（<25°C）③建立 DCP 批次校正係數（每批先做小量試驗調整用量）④考慮改用液態 DCP（濃度更穩定）。結果：硬度波動縮小至 ±2.5 度。',
            source: 'FoamCore OS 案例庫 #CS011',
            tags: ['case study', 'DCP', 'batch variation', 'hardness', 'quality control', 'storage']
        },
        {
            title: '案例：LDPE/EVA 配方分層問題',
            content: '問題：EVA/LDPE 50/50 配方泡棉切面出現明顯分層（上下密度不同）。診斷：LDPE MI=2（高黏度）與 EVA MI=15（低黏度）熔體流動性差異大，密煉機混合不充分。解法：①選用 MI 較接近的 LDPE（MI=7）②密煉機混合時間從 8 分鐘延長至 14 分鐘③添加 POE 3phr 作為相容劑④改變加料順序：先混 LDPE+EVA 5min，再加填料和助劑。結果：分層消失，密度均勻性 ±3%。',
            source: 'FoamCore OS 案例庫 #CS012',
            tags: ['case study', 'delamination', 'LDPE', 'EVA', 'MI mismatch', 'compatibility', 'POE']
        },
        {
            title: '案例：高回彈配方開發（POE 體系）',
            content: '問題：客戶要求回彈率>55%（標準 EVA 約 45%）。診斷：EVA 的結晶結構限制了回彈性能。解法：改用 POE 基體系：POE（Engage 8150）60phr + EVA VA25 40phr + AC 6.5phr + DCP 0.9phr + ZnO 1.5phr。POE 的無規共聚結構提供優異彈性。關鍵：POE 交聯速度比 EVA 慢，需適當延長模壓時間。結果：回彈率 58%，硬度 Asker C 42，壓縮永久變形 38%（遠優於純 EVA）。成本比純 EVA 高約 25%。',
            source: 'FoamCore OS 案例庫 #CS013',
            tags: ['case study', 'POE', 'resilience', 'rebound', 'EVA blend', 'high performance']
        },
        {
            title: '案例：超輕量 40× 倍率配方',
            content: '問題：客戶要求密度 <0.04 g/cm³（倍率 >40×）的超輕量泡棉。診斷：40× 以上倍率泡孔壁極薄，需要精準的交聯-發泡平衡。解法：①EVA VA25（高 VA 提供更多交聯點）②AC 9phr（高發泡劑用量）③DCP 1.0phr + TAC 0.5phr（確保足夠交聯度）④ZnO 2.0phr + Urea 0.5phr（控制分解速率）⑤模壓時間延長 20%。關鍵：CI 必須在 1.0-1.3 範圍，低於 1.0 必然塌陷。結果：達到 38×（接近目標），完全 40× 需要物理發泡輔助。',
            source: 'FoamCore OS 案例庫 #CS014',
            tags: ['case study', 'ultra-light', 'high expansion', 'TAC', 'cell collapse', '40x']
        },
        {
            title: '案例：壓縮永久變形改善（鞋墊應用）',
            content: '問題：EVA 鞋墊壓縮永久變形（CS）55%（要求 <45%）。診斷：純 EVA VA18 體系交聯密度不足，分子鏈鬆弛快。解法：①添加 POE 15phr 改善彈性回復②DCP 從 0.7 增至 0.9phr 提高交聯密度③降低倍率從 28× 至 24×（犧牲輕量性換取耐久性）④後處理增加 70°C 退火 2h（消除殘留應力）。結果：CS 從 55% 改善至 42%。進一步改善需要使用 TPEE 或 PU 體系。',
            source: 'FoamCore OS 案例庫 #CS015',
            tags: ['case study', 'compression set', 'insole', 'POE', 'DCP', 'annealing']
        },

        // ── B. 添加劑深入知識 ──
        {
            title: '矽烷偶聯劑在填料表面處理的應用',
            content: '矽烷偶聯劑（如 KH-550、KH-570）用於改善無機填料（CaCO₃、ATH、TiO₂）與 EVA 基體的界面結合。處理方法：將填料在高速混合機中加入 1-2% 矽烷偶聯劑（相對於填料重量），80°C 混合 15-30 分鐘。效果：①填料分散性改善 30-50%②拉伸強度提升 10-20%③填料用量可增加而不犧牲表面品質④減少魚眼缺陷。KH-550（胺基型）適用於 ATH；KH-570（甲基丙烯酸酯型）適用於 CaCO₃。注意：偶聯劑過量會遷移到表面造成黏性。',
            source: '偶聯劑應用技術手冊 + FoamCore OS 內部分析',
            tags: ['silane coupling agent', 'filler treatment', 'CaCO3', 'ATH', 'dispersion', 'interface']
        },
        {
            title: '加工助劑 PE Wax 與 Stearic Acid 的區別',
            content: 'PE Wax（聚乙烯蠟）和硬脂酸都是 EVA 泡棉的加工助劑，但功能不同。硬脂酸（0.5-1.5phr）：①潤滑劑降低混煉扭矩②ZnO 的協同活化劑③改善填料分散。PE Wax（0.3-1.0phr）：①外潤滑劑改善脫模性②降低混煉溫度 3-5°C③改善表面光澤。兩者可並用：硬脂酸做內潤滑 + PE Wax 做外潤滑。注意：PE Wax 過量（>1.5phr）會導致泡棉表面油膩、印刷附著力下降。',
            source: '加工助劑技術手冊',
            tags: ['PE wax', 'stearic acid', 'processing aid', 'lubricant', 'mold release', 'dispersion']
        },
        {
            title: 'TAC 多功能單體的最佳用量',
            content: 'TAC（三烯丙基氰尿酸酯）是 DCP 交聯的高效助交聯劑。用量-效果關係：0.2phr→DCP 效率提升 15%；0.5phr→DCP 效率提升 35%（最佳性價比）；1.0phr→效率提升 50% 但延伸率下降 20%；>1.5phr→過度交聯風險。TAC 與 DCP 的最佳比例為 TAC:DCP = 0.3-0.5:1。TAC 能使 DCP 用量減少 30-50% 達到相同交聯度，降低成本同時減少 DCP 分解產物的氣味。TAC 替代品：TMPTMA（效果較弱但更便宜）、TAIC（耐熱性更好）。',
            source: 'Sipaut & Sims, Cellular Polymers + FoamCore OS 內部分析',
            tags: ['TAC', 'coagent', 'DCP efficiency', 'TMPTMA', 'TAIC', 'crosslink density', 'cost']
        },
        {
            title: '抗靜電劑在 EVA 泡棉中的應用',
            content: 'EVA 泡棉的表面電阻通常 >10¹³ Ω，容易產生靜電吸附灰塵。抗靜電方案：①外塗型（季銨鹽類）：噴塗後表面電阻降至 10⁹-10¹¹ Ω，但不耐水洗。②內添型（GMS 甘油硬脂酸酯 2-4phr）：永久性抗靜電，但會影響發泡（降低表面張力→泡孔不均）。③導電填料（導電碳黑 5-15phr）：表面電阻 10⁶-10⁸ Ω，但黑色且硬度大幅提高。電子包裝用泡棉建議方案②+③混合：GMS 2phr + 導電 CB 3phr。',
            source: '抗靜電材料技術手冊',
            tags: ['antistatic', 'surface resistance', 'GMS', 'conductive carbon black', 'electronics packaging']
        },
        {
            title: '發泡劑 OBSH 與 AC 的比較',
            content: 'OBSH（4,4-氧代雙苯磺醯肼）是 AC 的替代發泡劑。OBSH 分解溫度 155-165°C（比 AC 低），產生 N₂ 氣體（無毒），分解殘渣為白色（不影響淺色產品）。AC 分解溫度 200-220°C（可被 ZnO 降至 170°C），產生 N₂+CO+CO₂+NH₃（有氣味），殘渣為黃色。OBSH 優勢：分解溫度與 DCP 更匹配、無需 ZnO 活化、無氣味。OBSH 劣勢：發氣量僅 AC 的 60%、價格較高、泡孔較粗。適用場景：淺色低氣味要求的泡棉（如嬰兒用品）。',
            source: 'Blowing Agent Selection Guide',
            tags: ['OBSH', 'AC', 'blowing agent', 'decomposition', 'odor', 'baby products']
        },
        {
            title: '增韌劑 SEBS/SBS 在 EVA 泡棉中的效果',
            content: 'SEBS（苯乙烯-乙烯-丁烯-苯乙烯嵌段共聚物）和 SBS 可作為 EVA 泡棉的增韌劑。SEBS 5-15phr 效果：①撕裂強度提升 20-40%②低溫衝擊性改善③壓縮永久變形略微改善。但 SEBS 會降低交聯效率（苯乙烯段不參與 DCP 交聯），需增加 DCP 用量。SBS 比 SEBS 便宜但耐候性差（含不飽和鍵）。推薦組合：EVA/POE/SEBS = 60/25/15 用於高韌性鞋材。注意：SEBS 與 EVA 的 MI 差異會影響混合均勻性。',
            source: '熱塑性彈性體應用手冊',
            tags: ['SEBS', 'SBS', 'toughening', 'tear strength', 'impact resistance', 'blend']
        },
        {
            title: '色粉 vs 色母粒在泡棉中的選用',
            content: '色粉（直接添加顏料粉）vs 色母粒（顏料+載體預分散）各有優缺。色粉：成本低、顏色調配靈活，但分散差（需長時間混煉）、粉塵污染、計量不精確。色母粒：分散好、計量方便、環境友好，但成本高、載體可能影響配方。建議：①量產一律用色母粒②色母載體選 EVA（與基體相容）③色母添加量 2-5phr（視濃度）④深色配方注意 DCP 補償。特殊情況：螢光色、夜光色通常只有色粉形式，需額外加強混煉。',
            source: 'FoamCore OS 內部分析',
            tags: ['pigment', 'color masterbatch', 'dispersion', 'cost', 'carrier resin']
        },
        {
            title: '抗菌劑在 EVA 泡棉中的應用',
            content: '鞋材和運動墊需要抗菌功能。常用方案：①銀離子系（Ag⁺）：添加 0.5-2phr 銀系抗菌母粒，抗菌率>99%，但成本高、白色產品可能變色。②鋅基（ZnO 奈米級）：利用配方中已有的 ZnO 提供基本抗菌性，但效果有限。③有機系（IPBC、OIT）：成本低但耐久性差，水洗後失效。④銅基（Cu₂O）：效果好但會使淺色產品偏綠。推薦：鞋材用銀系 + ZnO 協同；瑜珈墊用有機系（直接接觸皮膚需安全認證）。注意：部分抗菌劑會干擾 DCP 交聯（銅系最嚴重）。',
            source: '抗菌材料應用指南',
            tags: ['antibacterial', 'silver', 'ZnO', 'shoe', 'yoga mat', 'hygiene']
        },
        {
            title: '氧化鈣 CaO 作為除水劑',
            content: 'CaO（氧化鈣，生石灰）可在配方中作為除水劑，吸收原料和環境中的水分，防止起泡（blistering）。用量 0.5-2.0phr。CaO 與水反應生成 Ca(OH)₂，為不可逆吸收。優點：有效防止梅雨季的起泡問題、不影響發泡和交聯反應。缺點：CaO 呈鹼性，過量會加速 AC 分解（與 ZnO 類似的活化效果），需要調整 ZnO 用量。建議：CaO + ZnO 合計控制在 3phr 以內。替代品：分子篩（Molecular Sieve 4A），效果更溫和但價格較高。',
            source: 'FoamCore OS 內部分析',
            tags: ['CaO', 'desiccant', 'moisture absorber', 'blistering', 'humidity', 'molecular sieve']
        },
        {
            title: '膨脹型阻燃劑 IFR 體系在泡棉中的應用',
            content: '膨脹型阻燃劑（IFR：Intumescent Flame Retardant）由三元體系組成：酸源（APP 聚磷酸銨）+ 炭源（PER 季戊四醇）+ 氣源（MEL 三聚氰胺）。典型配比 APP:PER:MEL = 3:1:1，合計 25-40phr。IFR 優勢：無鹵環保、不干擾 DCP 交聯（與 Br-Sb 體系不同）、煙密度低。IFR 劣勢：填充量高影響倍率和柔韌性、APP 吸濕性強需預乾燥。與 ATH 複合使用可降低總填充量：ATH 20phr + IFR 15phr 效果≈ATH 50phr。',
            source: '阻燃材料技術手冊',
            tags: ['IFR', 'intumescent', 'APP', 'flame retardant', 'halogen free', 'environmental']
        },
        {
            title: '白色母粒與 TiO₂ 的用量和遮蓋力',
            content: '白色 EVA 泡棉的白度和遮蓋力取決於 TiO₂ 用量。TiO₂ 1phr→輕微增白；3phr→標準白色；5phr→高遮蓋力純白；>8phr→超白但硬度上升明顯。金紅石型 TiO₂ 比銳鈦型遮蓋力好 20%、耐候性好。白色母粒（含 50-70% TiO₂）使用更方便：3phr 白色母 ≈ 2phr 純 TiO₂。TiO₂ 作為成核劑改善泡孔結構，但過量（>8phr）使密度明顯增加。UV 防護效果：TiO₂ 3phr 可阻擋 80% UV 到達基體內部。',
            source: 'TiO₂ 應用技術手冊',
            tags: ['TiO2', 'white masterbatch', 'opacity', 'nucleation', 'UV protection']
        },

        // ── C. 製程改善方案 ──
        {
            title: '密煉機 vs 開煉機的選擇指南',
            content: '密煉機（Banbury）和開煉機（Two-Roll Mill）各有適用場景。密煉機：①混合效率高（8-15min/batch）②溫度控制精確③適合高填充配方（ATH>30phr）④密封環境減少粉塵⑤填充率 0.70-0.75。開煉機：①成本低、操作簡單②適合小量試產③可觀察混合狀態④輥溫 70-90°C⑤填充率 0.70-0.85。建議：研發試產用開煉機，量產用密煉機。混合順序：①EVA/LDPE/POE 先混 3min②加填料和助劑 5min③最後加 DCP+AC 2min（避免提前交聯）。',
            source: '橡塑加工手冊 + FoamCore OS 內部分析',
            tags: ['Banbury', 'two-roll mill', 'mixing', 'processing', 'fill factor', 'sequence']
        },
        {
            title: '模壓發泡的溫度-壓力-時間三參數優化',
            content: '模壓發泡三參數交互影響：①溫度（140-175°C）：決定 AC 分解速率和 DCP 交聯速率。低溫→交聯慢但均勻；高溫→反應快但邊緣效應大。②壓力（100-200 kg/cm²）：決定泡孔壓力和表皮品質。低壓→表皮粗糙；高壓→表皮好但能耗高。③時間（6-25 min）：取決於厚度和倍率。時間=基礎時間+厚度係數×坯料厚度。經驗公式：time(min)=4+2×thickness(cm)（倍率 20-30×）。三參數的優化順序：先固定壓力→調溫度到最佳 ΔT 窗口→最後微調時間。',
            source: 'FoamCore OS 品質模型',
            tags: ['temperature', 'pressure', 'time', 'optimization', 'molding', 'process parameter']
        },
        {
            title: '快速換色的清機程序',
            content: '深色→淺色換色是生產中最耗時的操作。高效清機程序：①用清機料（高 MI EVA + 5% PE Wax）密煉 5min②開煉機薄通 10 次以上③觀察通出料顏色是否乾淨④特殊情況用白色母 10phr 做 2-3 次沖洗。清機料配方：EVA VA18 MI=15 100phr + PE Wax 5phr + CaCO₃ 5phr。清機時間估算：黑→白 25-40min；紅→白 15-25min；黃→白 10-15min。預防措施：排產時安排淺→深的順序生產，最小化換色次數。',
            source: 'FoamCore OS 內部分析',
            tags: ['color change', 'purging', 'cleaning', 'production efficiency', 'scheduling']
        },
        {
            title: '坯料尺寸計算與模具設計',
            content: '坯料（compound slab）尺寸決定發泡後產品的尺寸精度。計算：坯料體積 = 產品體積 / 發泡倍率 × 1.02（2% 安全係數）。坯料面積 = 模腔面積 / α^(2/3)（因為膨脹是三維的）。坯料厚度 = 模腔深度 / α^(1/3)。例如：產品 30×30×2cm，α=25×→坯料約 10.3×10.3×0.68cm。模具設計重點：①排氣槽深 0.03-0.05mm②脫模斜度 3-5°③模腔表面鏡面拋光（Ra<0.8μm）④加熱管均勻佈局避免山形曲線。',
            source: 'FoamCore OS 品質模型',
            tags: ['compound slab', 'mold design', 'calculation', 'expansion ratio', 'dimensions']
        },
        {
            title: '連續式發泡 vs 模壓發泡的比較',
            content: '模壓發泡（compression molding）：坯料放入密閉模具加熱加壓→開模膨脹。優點：產品形狀精確、表皮品質好、倍率可控。缺點：批次生產效率低、每次只能做一片。連續式發泡（continuous foaming）：通過擠出機+發泡爐連續生產板材。優點：效率高（10-50m/min）、適合大面積板材。缺點：僅能做平板、倍率通常<20×、設備投資大。選擇建議：鞋材/異形件→模壓發泡；建築保溫/包裝→連續式發泡。',
            source: '發泡加工技術手冊',
            tags: ['compression molding', 'continuous foaming', 'extrusion', 'production efficiency']
        },
        {
            title: '開模速度對泡孔結構的影響',
            content: '模壓發泡的開模速度直接影響泡孔結構。快速開模（<0.5s）：壓力瞬間釋放→氣泡快速膨脹→泡孔大但可能破裂。慢速開模（2-5s）：壓力緩慢釋放→泡孔均勻膨脹→表皮更好但效率降低。最佳策略：兩段式開模——先快速開至 80% 行程（0.3s），然後慢速完成最後 20%（1-2s）。表皮破裂率與開模速度正相關：0.3s→破裂率 12%；1.0s→5%；2.0s→1%。高倍率（>30×）配方建議開模時間 >1.5s。',
            source: 'FoamCore OS 內部分析',
            tags: ['mold opening', 'speed', 'cell structure', 'rupture', 'skin quality', 'two-stage']
        },

        // ── D. 品質控制與檢測 ──
        {
            title: '泡棉品質日常檢測項目與頻率',
            content: '建議的品質檢測體系：①每批必檢：密度（水中法）、硬度（Asker C，3 點平均）、厚度、外觀（目視）。②每日抽檢（每 5 批取 1 批）：撕裂強度（ASTM D624）、壓縮永久變形（簡化法 50%×6h@23°C）、尺寸穩定性（出廠 24h 後複測）。③每週檢測：膠含量（ASTM D2765 溶劑萃取）、回彈性（落球法）。④每月檢測：加速老化（70°C×168h 後物性變化率）。記錄所有數據到 FoamCore OS 配方紀錄，累積 ML 訓練數據。',
            source: 'FoamCore OS 品質手冊',
            tags: ['quality control', 'testing', 'frequency', 'density', 'hardness', 'ASTM']
        },
        {
            title: 'SPC 統計製程控制在泡棉生產的應用',
            content: '將 SPC 應用於泡棉生產關鍵參數：①密度 X-bar R 管制圖（n=3，每批取 3 點）②硬度趨勢圖③模溫記錄（連續監控）④DCP 稱量偏差追蹤。Cpk 目標：密度 Cpk>1.33、硬度 Cpk>1.0。常見異常模式：①連續 7 點在中線同側→系統性偏移（檢查原料批次）②趨勢上升→DCP 批次劣化或秤不準③突然跳出→操作錯誤或設備異常。FoamCore OS 的 QS 分數趨勢可作為綜合 SPC 指標。',
            source: 'SPC 品管手冊 + FoamCore OS 內部分析',
            tags: ['SPC', 'quality control', 'Cpk', 'control chart', 'density', 'hardness', 'trend']
        },
        {
            title: '密度測量方法比較',
            content: '泡棉密度測量方法：①水中稱重法（ASTM D297）：最準確，精度 ±0.002 g/cm³。步驟：乾重→浸水→水中重→計算。注意防止泡孔吸水（用蠟封或快速測量）。②尺寸重量法：用游標卡尺量長寬高，電子秤量重量。簡單但精度 ±0.01 g/cm³（適合日常快速檢測）。③比重瓶法：適合小樣品。建議：日常用尺寸法快篩，異常時用水中法精確覆核。溫度修正：每°C 約影響 0.001 g/cm³，標準測量溫度 23±2°C。',
            source: 'ASTM Standards + FoamCore OS 品質手冊',
            tags: ['density measurement', 'water displacement', 'ASTM D297', 'accuracy', 'testing']
        },
        {
            title: '泡孔結構的 SEM/光學觀察方法',
            content: '泡孔結構分析方法：①光學顯微鏡（最快）：將泡棉用刀片切出平整截面→放大 20-50× 觀察。可判斷泡孔大小均勻性。②SEM 掃描電鏡（最精確）：樣品液氮脆斷→噴金→觀察。可測量 cell size（50-500μm）、cell density、cell wall thickness。③ImageJ 圖像分析：SEM 圖片導入→二值化→粒子分析→統計 cell size 分布。正常泡孔：圓形/橢圓形、壁厚均勻。異常泡孔：不規則形狀（交聯不足）、破裂壁（發泡過度）、雙峰分佈（分散不良）。',
            source: '材料分析技術手冊',
            tags: ['SEM', 'cell structure', 'microscopy', 'ImageJ', 'cell size', 'analysis']
        },

        // ── E. 材料選擇與特性 ──
        {
            title: 'EVA 常用牌號特性對照表',
            content: 'USI 體系：UE630（VA16, MI=2.5）通用發泡；UE632（VA19, MI=2.5）中底發泡；UE633（VA20, MI=2.5）通用鞋材；UE634（VA25, MI=3.0）軟質墊材；UE654（VA19, MI=2.0）注射級。LG 體系：EA28150（VA28, MI=150）高流動注射；EA33045（VA33, MI=45）超軟。Hanwha：E182F（VA18, MI=2.5）；E284F（VA28, MI=4.0）。選擇邏輯：①目標硬度→決定 VA 含量②加工方式→決定 MI③倍率→影響 VA 選擇（高倍率用高 VA）。注意：不同廠牌同 VA% 的樹脂，其 DCP 交聯效率可能不同（與共聚分佈有關）。USI UE6 系列命名規則與 VA% 並非線性對應，務必以供應商 TDS 為準。',
            source: '樹脂供應商技術手冊整理',
            tags: ['EVA grade', 'USI', 'LG', 'Hanwha', 'VA', 'MI', 'selection']
        },
        {
            title: 'LDPE 牌號選擇與 EVA 共混相容性',
            content: 'LDPE 在泡棉中的作用：提高硬度、改善尺寸穩定性、降低成本。常用牌號：LDPE NA208（MI=5, ρ=0.920）通用型；LDPE LA407（MI=4, ρ=0.924）高密度型；LDPE LH606（MI=7, ρ=0.919）易混合型。EVA/LDPE 相容性規則：①MI 差異<5 倍較佳②密度相近更易混合③VA% 越高與 LDPE 相容性越差（結晶度差異大）。LDPE 添加效果：每 10phr LDPE 替代 EVA→硬度 +3-5 Asker C、壓縮永久變形 -2-3%、成本降低 5-8%。最大建議替代量 40%（超過影響發泡品質）。',
            source: '樹脂供應商技術手冊 + FoamCore OS 內部分析',
            tags: ['LDPE', 'grade selection', 'EVA blend', 'compatibility', 'MI', 'density', 'cost']
        },
        {
            title: 'POE 牌號特性與應用範圍',
            content: 'POE（聚烯烴彈性體）常用牌號：Dow Engage 8150（密度 0.868, MI=0.5）最通用、回彈好；Engage 8200（密度 0.870, MI=5.0）易加工；Engage 8100（密度 0.870, MI=1.0）高強度。POE 特點：①無規共聚結構→無結晶→彈性優異②與 EVA/LDPE 完全相容③DCP 交聯效率比 EVA 低（需增加 DCP 15-20%）④成本為 EVA 的 1.5-2.0 倍。POE 最佳用量：鞋材 15-30phr（平衡性能和成本）。EVA/POE 比例效果：100/0→標準；70/30→高回彈；50/50→頂級但貴。',
            source: 'Dow Engage 技術手冊 + FoamCore OS 內部分析',
            tags: ['POE', 'Engage', 'elastomer', 'rebound', 'resilience', 'grade selection', 'cost']
        },
        {
            title: '發泡劑 AC 的等級與規格差異',
            content: 'AC（ADC）發泡劑的等級影響品質：①粒徑：細粒（D50<5μm）分散好但價格高；標準粒（D50=10-15μm）性價比佳；粗粒（D50>20μm）便宜但泡孔不均。②發氣量：標準 200-220 ml/g；高發氣型 230+ ml/g。③純度：工業級 95%→發泡不穩定；聚合級 98%→推薦使用。AC 母粒 vs AC 粉末：母粒分散更好但發氣量損失 10-15%（載體佔比）。建議：量產用 AC 母粒（AC-EVA 50%）；試產可用 AC 粉末搭配精確計量。AC 儲存：避光、<30°C、遠離 ZnO（防止預反應）。',
            source: 'AC 發泡劑供應商技術指南',
            tags: ['AC', 'ADC', 'blowing agent', 'particle size', 'gas yield', 'grade', 'storage']
        },

        // ── F. 更多改善方案與故障排除 ──
        {
            title: '硬度偏高的系統性排查流程',
            content: '硬度偏高排查：①先確認密度→密度也偏高？→可能是倍率不足（AC/ZnO 問題）。②密度正常但硬度高→檢查交聯度（gel%偏高？）→DCP 過量或 TAC 過量。③交聯度正常→檢查填料量（CaCO₃/ATH 是否增加）。④填料正常→檢查 EVA 牌號（VA% 是否偏低）。⑤EVA 正常→檢查 LDPE 比例是否增加。⑥以上都正常→檢查模壓條件（壓力是否偏高、時間是否過長導致過度交聯）。調整優先順序：先調 AC/ZnO（最敏感）→再調 DCP→最後調配方。',
            source: 'FoamCore OS 品質診斷手冊',
            tags: ['hardness', 'diagnosis', 'troubleshooting', 'systematic', 'density', 'expansion ratio']
        },
        {
            title: '硬度偏低的系統性排查流程',
            content: '硬度偏低排查：①先確認密度→密度也偏低？→可能是倍率過高（AC 過多或 ZnO 過多）。②密度正常但硬度低→檢查交聯度→DCP 不足？BHT/CB 干擾？③檢查 EVA 牌號→VA% 是否偏高（VA25 誤用為 VA18）。④檢查 LDPE 比例→是否減少。⑤檢查模壓時間→過短導致交聯不完全。⑥檢查水洗→過度水洗萃取了助劑。常見隱性原因：①DCP 儲存不當（過期或高溫失效）②色母中的有機顏料捕捉自由基③POE 用量不小心增加。',
            source: 'FoamCore OS 品質診斷手冊',
            tags: ['hardness', 'low', 'diagnosis', 'troubleshooting', 'DCP', 'VA content']
        },
        {
            title: '密度偏差的快速診斷矩陣',
            content: '密度偏差診斷矩陣：密度偏高+硬度偏高→倍率不足（AC/ZnO 不夠或失效）。密度偏高+硬度正常→DCP 過量限制膨脹。密度偏低+硬度偏低→倍率過高（AC/ZnO 過量）。密度偏低+硬度正常→後膨脹（DCP 不足導致出模後繼續膨脹）。密度不均勻（邊高中低）→模溫山形曲線。密度不均勻（上高下低）→坯料厚度不均或模具傾斜。快速驗證：取 5 個位置量密度，CV%>5% 即為不均勻。',
            source: 'FoamCore OS 品質診斷手冊',
            tags: ['density', 'diagnosis', 'matrix', 'expansion ratio', 'uniformity', 'troubleshooting']
        },
        {
            title: '氣味問題的來源與對策',
            content: '泡棉氣味來源：①AC 分解產物（NH₃、HNCO）：刺鼻氨味，AC 用量越高越嚴重。②DCP 分解產物（苯乙酮、α-甲基苯乙烯）：甜味/化學味。③EVA 降解（醋酸）：酸味。④色母/助劑揮發物。對策：①水洗 60-80°C×30min 去除水溶性分解產物②高溫退火 70°C×24h 加速揮發③使用 OBSH 替代 AC（無氨味）④降低 DCP 配合 TAC 減少分解產物⑤添加活性炭 1-2phr 吸附殘留 VOC。客戶要求 VOC<50μg/g 時需多重處理。',
            source: 'FoamCore OS 內部分析 + VOC 測試報告',
            tags: ['odor', 'VOC', 'AC decomposition', 'DCP', 'washing', 'OBSH', 'activated carbon']
        },
        {
            title: '翹曲變形的原因與解決方案',
            content: '泡棉翹曲原因：①上下表面密度差（坯料放置位置偏移→上層比下層先接觸高溫）②內部應力不均（交聯度梯度）③冷卻不均勻（一面接觸冷台一面朝空氣）④模具上下溫差。解法：①坯料精確置中②出模後立即翻面平放③冷卻台雙面接觸④模具上下板溫度差控制在 2°C 以內⑤必要時做後處理：60°C 壓板矯正 2h。預防：模具設計時確保上下板加熱管對稱佈局。',
            source: 'FoamCore OS 內部分析',
            tags: ['warping', 'deformation', 'stress', 'cooling', 'mold', 'flatness']
        },
        {
            title: '接著性（黏合性）改善方案',
            content: '泡棉與其他材料的接著性改善：①表面處理：UV 照射/電暈處理增加表面能②底塗劑（primer）：使用聚氨酯系底塗劑③泡棉配方調整：添加馬來酸酐接枝 POE（MA-g-POE）3-5phr 提升極性④熱貼合：表面加熱至 softening 後立即貼合。與 PU 鞋面黏合：先打粗→底塗→PU 膠（最常見工藝）。與布料貼合：使用 EVA 熱熔膠膜（120-140°C）。注意：LDPE 含量高的配方接著性較差（表面能低），建議表面層為純 EVA。',
            source: 'FoamCore OS 內部分析 + 接著劑供應商技術文件',
            tags: ['adhesion', 'bonding', 'primer', 'surface treatment', 'corona', 'MA-g-POE']
        },
        {
            title: '尺寸穩定性的長期追蹤方法',
            content: '泡棉尺寸穩定性分為三階段：①初期收縮（出模後 0-24h）：最劇烈，5-8%（高倍率）。②穩定期收縮（1-7 天）：1-3%，逐漸穩定。③長期變化（>7 天）：<0.5%。測量方法：在泡棉上標記 4 個點（形成矩形），用游標卡尺追蹤長/寬/厚的變化。合格標準：7 天後總收縮 <5%（運動鞋材）、<3%（精密墊片）。改善措施：增加填料、提高交聯度、緩慢冷卻、後處理退火。FoamCore OS 可記錄每批次的尺寸追蹤數據。',
            source: 'FoamCore OS 品質手冊',
            tags: ['dimensional stability', 'shrinkage', 'measurement', 'tracking', 'specification']
        },
        {
            title: '配方設計的系統化方法論',
            content: '配方設計六步法：①定義目標：密度、硬度、倍率、特殊要求（阻燃/抗菌/回彈）。②選擇基體樹脂：VA%/MI 決定→EVA/LDPE/POE 比例。③計算發泡系統：AC 用量 = f(目標倍率, 填料量)；ZnO/Urea 控制分解溫度。④設計交聯系統：DCP 用量 = f(VA%, 填料干擾因子, 目標 CI)；考慮 TAC 助交聯。⑤添加功能助劑：填料/色母/穩定劑/阻燃劑/抗菌劑。⑥小量試產驗證：先做 500g 試片→檢測→調整→1kg→5kg→量產。每一步都記錄到 FoamCore OS。',
            source: 'FoamCore OS 配方設計指南',
            tags: ['formulation design', 'methodology', 'systematic', 'EVA', 'DCP', 'AC', 'workflow']
        },
        {
            title: '交聯度不足的五大隱性原因',
            content: '當 DCP 用量正常但交聯度（gel%）偏低時，需檢查五大隱性干擾源：①BHT 過量（>0.3phr）→自由基捕捉。②Carbon Black（>2phr）→自由基清除。③色母有機顏料→某些偶氮/酞菁顏料捕捉自由基。④Br-Sb 阻燃劑（>10phr）→Br 消耗自由基。⑤DCP 本身失效→儲存溫度>30°C 或過期。診斷方法：做一個不含任何填料/色母/助劑的「空白配方」對比測試 gel%。如果空白配方 gel% 正常，就逐項添加回去找出干擾源。',
            source: 'FoamCore OS 品質診斷手冊',
            tags: ['crosslinking', 'gel content', 'hidden causes', 'BHT', 'carbon black', 'diagnosis']
        },
        {
            title: '發泡倍率調整的安全範圍',
            content: '調整發泡倍率時的安全操作範圍：每次調整 AC 用量不超過 ±1phr（對應倍率 ±3-5×）。ZnO 調整不超過 ±0.5phr。AC 與 ZnO 不要同時調整（無法判斷哪個因素造成變化）。倍率-AC 經驗曲線：10×→AC 3-4phr；20×→AC 5-6phr；30×→AC 7-8phr；40×→AC 9-10phr。注意：這是 EVA VA18 的經驗值，不同 VA% 和填料量會偏移。填料每增加 10phr，AC 需增加約 0.5-1phr 補償。LDPE 含量增加→發泡效率下降→AC 需增加。',
            source: 'FoamCore OS 配方設計指南',
            tags: ['expansion ratio', 'AC', 'adjustment', 'safe range', 'ZnO', 'formulation']
        },
        {
            title: '不同應用場景的配方參考範圍',
            content: '典型應用配方參考（以 100phr 基體樹脂計）：①運動鞋中底（α=28-32×, Asker C 50-58）：EVA VA18 70 + POE 30, AC 7-8, DCP 0.8-1.0, ZnO 1.5-2.0。②拖鞋（α=20-25×, Asker C 35-45）：EVA VA25 100, AC 5-6, DCP 0.6-0.8, ZnO 1.5, CaCO₃ 5。③瑜珈墊（α=22-28×, Asker C 40-50）：EVA VA18 70 + LDPE 30, AC 6-7, DCP 0.7-0.9, ZnO 1.8。④包裝緩衝（α=15-20×, Shore A 25-35）：EVA VA28 100, AC 4-5, DCP 0.5-0.7。⑤阻燃墊（α=18-22×）：EVA VA18 60 + LDPE 40 + ATH 40, AC 7, DCP 0.9。',
            source: 'FoamCore OS 配方設計指南',
            tags: ['application', 'reference formula', 'sport shoe', 'yoga mat', 'packaging', 'flame retardant']
        },
        {
            title: '溫度對 DCP 半衰期的影響',
            content: 'DCP 的分解遵循一級動力學，半衰期隨溫度指數下降：130°C→t½=145min；140°C→t½=42min；150°C→t½=13min；160°C→t½=4.3min；170°C→t½=1.5min；180°C→t½=0.5min。實用意義：①140°C 需要至少 15min 才能達到 80% 交聯②160°C 只需 5min③溫度每升高 10°C，反應速率約增加 3 倍。模壓時間設計：至少 4 個 DCP 半衰期（>95% 分解）。例如 160°C→4×4.3=17min 最低。過短時間→殘留 DCP→後續揮發產生氣味。',
            source: 'DCP 技術手冊 + 化學動力學',
            tags: ['DCP', 'half-life', 'temperature', 'kinetics', 'decomposition', 'curing time']
        },
        {
            title: 'AC 分解動力學與 ZnO 活化效應定量',
            content: 'AC（ADC）純品分解參數：起始溫度 195°C，峰值溫度 210°C，活化能 Ea=145 kJ/mol。ZnO 活化效應（定量）：ZnO 0.5phr→峰值降至 195°C；ZnO 1.0→185°C；ZnO 1.5→178°C；ZnO 2.0→172°C；ZnO 3.0→165°C；ZnO 5.0→155°C。DSC 曲線從單峰變為雙峰（低溫峰=ZnO 催化分解，高溫峰=殘餘 AC 自分解）。最佳 ΔT 窗口：AC 分解溫度比 DCP 分解溫度高 5-15°C。ZnO 過量（>3phr）風險：AC 分解太早→與 DCP 交聯時序失配→塌陷。',
            source: 'Scientific.Net MSF Vol.1028 + DSC 數據',
            tags: ['AC', 'ZnO', 'decomposition kinetics', 'activation energy', 'DSC', 'delta T']
        },
        {
            title: '交聯發泡的 ΔT 窗口精確控制',
            content: 'ΔT = T_AC_decomp - T_DCP_decomp，是控制泡棉品質的最關鍵參數。ΔT<0（AC 先分解）：氣體在交聯前釋放→嚴重塌陷。ΔT=0-5°C：危險區，容易塌陷。ΔT=5-15°C：最佳窗口，交聯略先於發泡。ΔT=15-25°C：安全但泡孔偏小、倍率偏低。ΔT>25°C：交聯過度完成才發泡→倍率嚴重不足。調整 ΔT 的手段：①調 ZnO 改變 AC 分解溫度②調 TAC/模溫改變 DCP 有效交聯速度③使用 OBSH 替代部分 AC（分解溫度更低）。FoamCore OS 的 ΔT 計算基於 ZnO/AC 比值自動估算。',
            source: 'FoamCore OS 品質模型',
            tags: ['delta T', 'timing', 'AC', 'DCP', 'cell collapse', 'window', 'ZnO']
        },
        {
            title: '填料表面處理的成本效益分析',
            content: '填料表面處理的投入與回報：①未處理 CaCO₃（0 元/kg 額外成本）：分散一般，魚眼風險中等。②硬脂酸處理 CaCO₃（+0.5 元/kg）：分散改善 30%，魚眼減少 50%。③矽烷處理 CaCO₃（+1.5 元/kg）：分散改善 60%，強度提升 15%，魚眼幾乎消除。④矽烷處理 ATH（+2.0 元/kg）：水分降低 80%，與基體界面結合力翻倍，DCP 干擾減少。結論：高填充配方（>15phr）建議至少用硬脂酸處理；阻燃配方（ATH>30phr）建議矽烷處理。投資回報：減少廢品率 5-10% 即可覆蓋處理成本。',
            source: 'FoamCore OS 內部分析 + 成本數據庫',
            tags: ['filler treatment', 'stearic acid', 'silane', 'cost benefit', 'CaCO3', 'ATH']
        },
        {
            title: '回收料 PCR 的品質分級與應用指南',
            content: 'PCR（Post-Consumer Recycled）材料品質分級：A 級（MI 穩定 ±20%、無雜質、色差 ΔE<3）→可用 20-30%。B 級（MI 波動 ±50%、少量雜質、色差 ΔE<8）→限用 10-15%。C 級（MI 不可控、含交聯碎片）→限用 5-8% 且僅用於深色。PCR 預處理標準程序：①篩分去除 >2mm 雜質②80°C 烘乾 4h③密煉機 90°C×10min 均化④取樣測 MI 和灰分。配方補償：每 10% PCR 摻混→DCP +0.05phr、AC +0.3phr、ZnO -0.15phr。',
            source: 'FoamCore OS 內部分析 + 環保規範',
            tags: ['PCR', 'recycled', 'grading', 'quality control', 'sustainability', 'preprocessing']
        },
        {
            title: '生產排程優化與批次管理',
            content: '泡棉生產排程最佳實踐：①顏色排序：白→黃→紅→藍→綠→黑（淺到深減少清機時間）。②配方排序：同一基體樹脂連續生產（減少換料）。③批次大小：密煉機單批 20-50kg，連續生產 8-15 批為一個生產單元。④換料/換色的時機：設在午休或換班時。⑤原料預配（pre-weighing）：提前 1 天按批次稱量所有原料並密封標記。⑥DCP/AC 單獨保存：冷藏專區 + 專人管理。FoamCore OS 的批次記錄功能可追蹤每批的配料、操作人員、品質結果。',
            source: 'FoamCore OS 內部分析',
            tags: ['scheduling', 'batch management', 'color sequence', 'production efficiency', 'pre-weighing']
        },
        {
            title: '模具維護與壽命管理',
            content: '模具維護影響產品品質：①每次使用後清理模面殘留（不鏽鋼刮刀 + 脫模劑）。②每 100 模次：檢查排氣槽是否堵塞（堵塞→表面氣泡/欠料）。③每 500 模次：檢查模面磨損（磨損→表皮粗糙）→必要時重新拋光。④每 1000 模次：全面檢查加熱管、溫度感應器、密封條。⑤模面防鏽：長期不用時塗防鏽油 + 乾燥劑密封保存。脫模劑選擇：矽氧烷類（效果好但影響後續接著性）vs 蠟類（效果一般但不影響接著）。',
            source: 'FoamCore OS 內部分析',
            tags: ['mold maintenance', 'vent cleaning', 'polishing', 'mold release', 'lifetime']
        },
        {
            title: '新配方開發的 DOE 實驗設計',
            content: '使用 DOE（Design of Experiments）加速配方開發：①篩選階段（2^k 階乘設計）：K=3 因子（DCP、AC、ZnO），每因子 2 水準→8 組實驗→找出顯著因子。②優化階段（RSM 響應曲面法）：選 2 個最顯著因子→中心複合設計 13 組→建立二次模型→找最佳點。③驗證：最佳點 + 周圍 4 個確認點。範例：目標倍率 28±2×、硬度 50±3 Asker C。因子範圍：DCP 0.6-1.0phr、AC 6-8phr、ZnO 1.0-2.5phr。響應：倍率、硬度、QS 分數。DOE 比一次一因子法省 60% 的實驗次數。',
            source: 'DOE 統計方法 + FoamCore OS 內部分析',
            tags: ['DOE', 'experimental design', 'RSM', 'optimization', 'factorial', 'DCP', 'AC', 'ZnO']
        },
        {
            title: '常見加工異常與即時對策',
            content: '生產線常見異常的即時處理：①混煉扭矩突然升高→檢查輥溫是否過低 / 填料是否結塊→暫停加料，提高輥溫 5°C。②坯料表面粗糙→混煉不足或水分過高→增加薄通次數 / 檢查原料烘乾。③出模時泡棉黏模→脫模劑不足 / 模面磨損→補噴脫模劑 / 排程模具維護。④泡棉出模後持續膨脹→DCP 不足或時間過短→立即增加下批 DCP 或延長時間。⑤批量表皮有花紋→模面有殘留→立即清模。⑥發泡不均（一邊大一邊小）→模具加熱不均→檢查加熱管是否故障。',
            source: 'FoamCore OS 內部分析',
            tags: ['processing anomaly', 'troubleshooting', 'immediate action', 'torque', 'sticking']
        },
        {
            title: '泡棉切割與二次加工指南',
            content: '泡棉的二次加工：①熱切割：使用熱線切割機（nichrome wire 400-600°C），切面光滑但會有 0.5-1mm 熔融邊。②冷切割：帶鋸機/裁斷機，切面平整但高倍率泡棉容易壓縮變形。③磨削（grinding）：用砂帶磨床磨至精確厚度（±0.3mm），表面開孔性好（適合需要透氣的應用）。④打孔（punching）：液壓沖床 + 刀模，適合鞋墊等規則形狀。⑤熱壓成型（thermoforming）：130-150°C 加熱→模具定型→3D 造型（如護具、頭盔內襯）。切割前建議泡棉靜置 48h（尺寸穩定後再加工）。',
            source: 'FoamCore OS 內部分析',
            tags: ['cutting', 'grinding', 'punching', 'thermoforming', 'secondary processing']
        },
        {
            title: '環保法規對泡棉配方的影響',
            content: '全球環保法規趨勢對 EVA 泡棉的影響：①REACH（歐盟）：限制 SVHC 物質→禁用含鉛/鎘穩定劑、限制特定 Br 阻燃劑（如 HBCD）。②RoHS：限制 Pb/Cd/Hg/Cr⁶⁺/PBB/PBDE。③TSCA（美國）：化學品通報制度。④California Prop 65：限制致癌物→DCP 分解產物苯乙酮需要關注。⑤中國 GB 限塑令：推動 PCR 使用。配方影響：①阻燃劑轉向無鹵（ATH/IFR）②穩定劑用 Ca-Zn 系取代 Pb/Ba-Cd③發泡劑趨勢：AC 受限（NH₃ 排放）→OBSH/物理發泡。成本影響：環保合規配方通常比傳統配方貴 10-30%。',
            source: '環保法規匯編 + FoamCore OS 內部分析',
            tags: ['REACH', 'RoHS', 'environmental', 'regulation', 'halogen free', 'compliance']
        },
        {
            title: '超臨界 N₂ 物理發泡在 EVA 中的應用前景',
            content: '超臨界 N₂ 物理發泡流程：①先完全交聯（DCP 完全分解）②高壓容器中注入超臨界 N₂（80-150 bar, 120-180°C）③飽和滲透 30-120min④快速洩壓（100-500 bar/s）→泡孔成核和膨脹。優勢：泡孔極細（20-100μm）且均勻、無化學發泡殘留（零氣味）、泡孔密度高（10⁶-10⁹ cells/cm³）。劣勢：設備投資巨大（高壓反應器）、批次生產效率低、倍率控制精度低於化學發泡。應用：高端運動鞋（Nike ZoomX 類）。目前成本為化學發泡的 3-5 倍。',
            source: 'Li et al. Polymers PMC (2024) + 超臨界發泡技術文獻',
            tags: ['supercritical N2', 'physical foaming', 'microcellular', 'Nike', 'high-end', 'equipment']
        },
        {
            title: '案例：EVA/POE 配方撕裂強度不足',
            content: '問題：EVA VA18 70phr + POE 30phr 配方撕裂強度僅 8 N/mm（要求 >12 N/mm）。診斷：POE 30phr 雖改善回彈但降低了撕裂強度（POE 本身撕裂性差）。解法：①添加 SEBS 10phr（替代部分 POE：EVA 70 + POE 20 + SEBS 10）②DCP 從 0.85 增至 1.0phr（提高交聯密度）③添加 CaCO₃ 5phr（填料增韌效應）。結果：撕裂強度從 8 提升至 13.5 N/mm，回彈率僅從 56% 略降至 53%。教訓：三元共混需要更精確的交聯控制。',
            source: 'FoamCore OS 案例庫 #CS016',
            tags: ['case study', 'tear strength', 'POE', 'SEBS', 'EVA blend', 'DCP']
        },
        {
            title: '案例：批次間色差 ΔE>3 的根因分析',
            content: '問題：同一配方不同批次之間色差 ΔE 高達 3-5（客戶要求 ΔE<1.5）。診斷：①色母計量精度 ±5%（人工稱量）②不同批次 EVA 底色略有差異③混煉時間不一致（6-10min 波動）④模溫波動 ±3°C 影響色彩顯色。解法：①色母改用自動計量系統（精度 ±0.5%）②建立 EVA 入庫色板比對③固定混煉時間 SOP（8min±30s）④每批首件色板對比確認。結果：ΔE 從 3-5 縮小至 0.8-1.2。',
            source: 'FoamCore OS 案例庫 #CS017',
            tags: ['case study', 'color difference', 'deltaE', 'quality control', 'masterbatch', 'SOP']
        },
        {
            title: '矽烷偶聯劑在 ATH 阻燃配方中的必要性',
            content: '實驗對比：ATH 40phr 未處理 vs 矽烷 KH-550 處理 1.5%。未處理：撕裂強度 7.2 N/mm、倍率 18×、表面魚眼 5-8 個/dm²。矽烷處理：撕裂強度 9.8 N/mm（+36%）、倍率 21×（+17%）、表面魚眼 0-1 個/dm²。原因：矽烷在 ATH 表面形成有機化學鍵，改善與 EVA 的界面結合；同時封閉 ATH 表面 -OH 基團，減少水分吸附。投資回報：矽烷成本增加 2 元/kg ATH，但廢品率從 8% 降至 1%。結論：ATH>20phr 時強烈建議矽烷處理。',
            source: 'FoamCore OS 內部分析 + 實驗數據',
            tags: ['silane', 'ATH', 'flame retardant', 'coupling agent', 'tear strength', 'dispersion']
        },
        {
            title: '低 VOC 配方設計策略',
            content: '低 VOC（揮發性有機化合物）配方設計：①發泡劑：用 OBSH 替代 AC 50%（AC 3phr + OBSH 2phr 替代 AC 6phr），VOC 降低 40%。②交聯劑：DCP 降低配合 TAC（減少苯乙酮產生量），VOC 降低 25%。③助劑：避免 PE Wax 過量、避免液態增塑劑。④後處理：水洗 70°C×40min + 烘乾 60°C×4h + 室溫放置 72h。⑤測試：取 1g 樣品封入頂空瓶，80°C×2h，GC-MS 分析 VOC 組成和總量。目標：TVOC<50μg/g（嬰幼兒產品）；TVOC<200μg/g（一般鞋材）。',
            source: 'FoamCore OS 內部分析 + VOC 法規',
            tags: ['VOC', 'low emission', 'OBSH', 'odor', 'baby product', 'post-processing']
        },
        {
            title: '高溫耐受配方（汽車內裝用）',
            content: '汽車內裝泡棉要求耐 90°C×500h 不變形。標準 EVA 配方在 80°C 以上會軟化變形（EVA Tm=60-85°C）。解法：①提高交聯密度：DCP 1.2phr + TAC 0.5phr（gel%>85%）②增加 LDPE 比例（Tm=110°C）：EVA/LDPE=40/60③添加高嶺土（kaolin）10phr 提供高溫骨架支撐④選用高 Tm 的 HDPE 5-10phr 作為耐熱骨架。結果：90°C×500h 壓縮永久變形<20%（標準 EVA 為 60%+）。注意：高 LDPE/HDPE 比例會顯著提高硬度，需搭配 POE 平衡。',
            source: 'FoamCore OS 內部分析 + 汽車材料規範',
            tags: ['automotive', 'heat resistance', 'LDPE', 'HDPE', 'high temperature', 'compression set']
        },
        {
            title: '導電泡棉配方設計',
            content: '電子包裝用導電泡棉（表面電阻 10⁴-10⁶ Ω）配方設計：①導電填料選擇：導電碳黑（Ketjenblack 3-8phr）最常用；金屬纖維（不鏽鋼纖維 5-10phr）效果好但貴；碳纖維（3-5phr）中等。②導電碳黑的逾滲閾值約 5-8phr（視分散度）。③導電碳黑會嚴重消耗 DCP（自由基清除）：每 1phr 導電 CB 需增加 DCP 0.08phr。④配方範例：EVA VA18 100 + Ketjenblack 6 + DCP 1.3 + TAC 0.5 + AC 5 + ZnO 1.5。結果：表面電阻 10⁵ Ω、倍率 15×、硬度 Asker C 55。導電性與倍率矛盾：高倍率拉長導電路徑→電阻升高。',
            source: 'FoamCore OS 內部分析 + 電子包裝規範',
            tags: ['conductive', 'ESD', 'carbon black', 'Ketjenblack', 'electronics', 'surface resistance']
        },
        {
            title: '泡棉回收再利用的技術路線',
            content: '交聯 EVA 泡棉的回收困難在於交聯網絡無法重新熔融。現行技術路線：①機械粉碎再填充：將廢泡棉粉碎至 1-5mm 粒子→以 5-15phr 摻混到新配方→成為填料（降低成本但降低品質）。②化學解交聯：用超臨界水或特殊溶劑打斷交聯鍵→回收 EVA→品質接近原料但成本高。③熱能回收：焚燒發電→最不環保但最便宜。④降級應用：粉碎後黏結為地墊/隔音材料。推薦路線：①粉碎摻混（5-10%，深色配方）+④降級應用。FoamCore OS 可追蹤每批次的回收料比例和品質影響。',
            source: 'FoamCore OS 內部分析 + 循環經濟研究',
            tags: ['recycling', 'waste', 'grinding', 'circular economy', 'sustainability', 'downcycling']
        },
    ];

    // ═══════════════════════════════════════════════════════════
    // §2  ENTITY EXTRACTION RULES（實體擷取規則）
    // ═══════════════════════════════════════════════════════════

    // 從文本中擷取已知實體 ID
    var ENTITY_PATTERNS = {
        'eva':    /\bEVA\b|乙烯醋酸乙烯|ethylene.vinyl.acetate/i,
        'ldpe':   /\bLDPE\b|低密度聚乙烯|low.density.polyethylene/i,
        'poe':    /\bPOE\b|聚烯烴彈性體|polyolefin.elastomer/i,
        'ac':     /\bAC\b|ADC\b|ADCA\b|偶氮二甲醯胺|azodicarbonamide|發泡劑/i,
        'dcp':    /\bDCP\b|過氧化物|dicumyl.peroxide|交聯劑/i,
        'zno':    /\bZnO\b|氧化鋅|zinc.oxide|活化劑/i,
        'stearic':/硬脂酸|stearic.acid/i,
        'talc':   /滑石粉|talc/i,
        'caco3':  /\bCaCO[₃3]\b|碳酸鈣|calcium.carbonate/i,
        'temp':   /溫度|temperature|模溫|temp[12]/i,
        'press':  /壓力|pressure|模壓/i,
        'time':   /時間|time[12]|foaming.time/i,
        'ratio':  /發泡倍率|expansion.ratio|膨脹/i,
        'roll':   /煉膠|two.roll|mixing|密煉機|banbury/i,
        'hardness':  /硬度|hardness|shore|asker/i,
        'density':   /密度|density/i,
        'compress':  /壓縮永久變形|compression.set/i,
        'tear':      /撕裂|tear.strength/i,
        'skinQ':     /表皮|skin.quality|外觀/i,
        'collapse':  /塌陷|collapse|泡孔塌陷/i,
        'rupture':   /破裂|rupture|表皮破裂/i,
        'shrink':    /冷縮|shrink|收縮/i,
        'edgeharden':/邊緣硬化|edge.harden|山形曲線/i,
        'brittle':   /脆化|brittle|embrittlement|開裂/i,
        'gelcont':   /膠含量|gel.content|gel.fraction/i,
        'va':        /\bVA\b.?含量|VA%|vinyl.acetate.content/i,
        'cellsize':  /泡孔尺寸|cell.size|泡孔結構/i,
        // ── v1.2 新增 entity patterns ──
        'bht':       /\bBHT\b|抗氧化劑|butylated.hydroxytoluene|防老劑/i,
        'urea':      /\bUrea\b|尿素|促進劑/i,
        'hals':      /\bHALS\b|光穩定劑|hindered.amine|UV.穩定劑/i,
        'ath':       /\bATH\b|氫氧化鋁|aluminum.trihydrate/i,
        'tio2':      /\bTiO[₂2]\b|鈦白粉|titanium.dioxide/i,
        'mi':        /\bMI\b|熔融指數|melt.index|MFR|melt.flow/i,
        'colormb':   /色母|color.masterbatch|pigment.mb|色母粒/i,
        'cb':        /\bCB\b|carbon.black|碳黑|炭黑/i,
        'yellowing': /黃變|yellowing|變黃|color.shift/i,
        'blistering':/起泡|blistering|水泡|blister/i,
        'warping':   /翹曲|warping|warp|變形/i,
        'delamination':/分層|delamination|剝離|脫層/i,
        'fisheye':   /魚眼|fish.eye|局部硬點/i,
        'ci':        /\bCI\b|交聯指數|crosslinking.index/i,
        'qs':        /\bQS\b|品質分數|quality.score/i,
    };

    // 關係模式（從文本提取 relation 類型）
    var RELATION_PATTERNS = [
        { pattern: /導致|causes?|引起|造成|產生/, type: 'CAUSES' },
        { pattern: /控制|affects?|影響|調控|controls?|決定/, type: 'CONTROLS' },
        { pattern: /拮抗|opposes?|干擾|inhibit|抑制|降低/, type: 'OPPOSES' },
        { pattern: /協同|synerg|促進|enhance|增強|改善/, type: 'SYNERGIZES' },
        { pattern: /相關|correlat|正相關|反相關|關聯/, type: 'CORRELATES' },
        { pattern: /包含|contains?|成分|組成/, type: 'CONTAINS' },
        { pattern: /量測|measur|檢測|指標/, type: 'MEASURES' },
    ];

    // ═══════════════════════════════════════════════════════════
    // §3  KG BUILDER — 從資料源自動擷取並合併
    // ═══════════════════════════════════════════════════════════

    /**
     * 從配方紀錄統計 entity co-occurrence → 校準 edge strength
     * @returns {Object} { edgeStrengths: {source_target: {count, avgScore}}, nodeFreq: {id: count} }
     */
    function extractFromHistory() {
        var history = [];
        try { history = JSON.parse(localStorage.getItem('foamHistory') || '[]'); } catch(e) {}
        if (!history.length) return { edgeStrengths: {}, nodeFreq: {}, recordCount: 0 };

        var nodeFreq = {};
        var edgeStrengths = {};
        var defectPatterns = {};

        history.forEach(function(r) {
            var entities = [];
            // 提取使用了哪些化學品
            if ((r.raw_eva16_kg || 0) > 0 || (r.raw_eva25_kg || 0) > 0) entities.push('eva');
            if ((r.raw_ldpe24_kg || 0) > 0 || (r.raw_ldpe40_kg || 0) > 0) entities.push('ldpe');
            if ((r.raw_poe_kg || 0) > 0) entities.push('poe');
            if ((r.raw_acpe_kg || 0) > 0 || (r.raw_aceva_kg || 0) > 0) entities.push('ac');
            if ((r.raw_dcp_g || 0) > 0) entities.push('dcp');
            if ((r.raw_zno_g || 0) > 0) entities.push('zno');

            // 提取製程參數（存在即算）
            if (r.raw_temp1) entities.push('temp');
            if (r.raw_temp2) entities.push('temp');
            if (r.raw_time2) entities.push('time');

            // 提取品質指標
            if (r.predictedExpansion || r.raw_expansion) entities.push('ratio');
            if (r.qualityScore) entities.push('hardness'); // Score 代表整體品質

            // 提取 warnings 中的缺陷
            var warnings = (r.warnings || []);
            if (typeof warnings === 'string') warnings = warnings.split(';');
            warnings.forEach(function(w) {
                var wl = (w || '').toLowerCase();
                if (wl.includes('塌陷') || wl.includes('collapse')) entities.push('collapse');
                if (wl.includes('破裂') || wl.includes('rupture')) entities.push('rupture');
                if (wl.includes('冷縮') || wl.includes('shrink')) entities.push('shrink');
                if (wl.includes('脆化') || wl.includes('brittle')) entities.push('brittle');
                if (wl.includes('硬化') || wl.includes('harden')) entities.push('edgeharden');
            });

            // 統計節點頻率
            entities.forEach(function(e) { nodeFreq[e] = (nodeFreq[e] || 0) + 1; });

            // 統計邊共現（每對 entity 組合）
            var score = r.qualityScore || 0;
            for (var i = 0; i < entities.length; i++) {
                for (var j = i + 1; j < entities.length; j++) {
                    var key = entities[i] + '_' + entities[j];
                    var keyR = entities[j] + '_' + entities[i];
                    var k = edgeStrengths[key] ? key : edgeStrengths[keyR] ? keyR : key;
                    if (!edgeStrengths[k]) edgeStrengths[k] = { count: 0, totalScore: 0 };
                    edgeStrengths[k].count++;
                    edgeStrengths[k].totalScore += score;
                }
            }
        });

        // 計算平均分數
        Object.keys(edgeStrengths).forEach(function(k) {
            var e = edgeStrengths[k];
            e.avgScore = e.count > 0 ? e.totalScore / e.count : 0;
        });

        return { edgeStrengths: edgeStrengths, nodeFreq: nodeFreq, recordCount: history.length };
    }

    /**
     * 從文獻文本提取 entity-relation 三元組
     * @param {string} text - 文獻內容
     * @returns {Array} [{source, target, type, label, strength}]
     */
    function extractTriples(text) {
        if (!text) return [];
        var triples = [];
        var sentences = text.split(/[。.;；!\n]/).filter(function(s) { return s.length > 5; });

        sentences.forEach(function(sentence) {
            // 找出句子中的所有 entities
            var foundEntities = [];
            Object.keys(ENTITY_PATTERNS).forEach(function(id) {
                if (ENTITY_PATTERNS[id].test(sentence)) {
                    foundEntities.push(id);
                }
            });

            // 找出句子中的 relation 類型
            var relationType = 'CORRELATES';
            var relationLabel = '';
            RELATION_PATTERNS.forEach(function(rp) {
                if (rp.pattern.test(sentence)) {
                    relationType = rp.type;
                }
            });

            // 建立 entity pairs（最多取前 3 個 entity 的組合）
            var entities = foundEntities.slice(0, 4);
            for (var i = 0; i < entities.length; i++) {
                for (var j = i + 1; j < entities.length; j++) {
                    if (entities[i] !== entities[j]) {
                        triples.push({
                            source: entities[i],
                            target: entities[j],
                            type: relationType,
                            label: sentence.substring(0, 30).trim(),
                            strength: 0.5,
                            fromLiterature: true
                        });
                    }
                }
            }
        });

        return triples;
    }

    /**
     * 合併動態資料到基礎知識圖譜
     * @param {Object} baseKG - DEFAULT KG_DATA
     * @returns {Object} 合併後的 { nodes, edges, meta }
     */
    function buildMergedKG(baseKG) {
        if (!baseKG) return null;

        var merged = {
            nodes: JSON.parse(JSON.stringify(baseKG.nodes)),
            edges: JSON.parse(JSON.stringify(baseKG.edges)),
        };
        var nodeIdSet = {};
        merged.nodes.forEach(function(n) { nodeIdSet[n.id] = true; });
        var edgeKeySet = {};
        merged.edges.forEach(function(e) { edgeKeySet[e.source + '_' + e.target + '_' + e.type] = true; });

        // ── ① 從 foamHistory 校準 edge strength
        var histData = extractFromHistory();
        if (histData.recordCount > 0) {
            merged.edges.forEach(function(e) {
                var key1 = e.source + '_' + e.target;
                var key2 = e.target + '_' + e.source;
                var hist = histData.edgeStrengths[key1] || histData.edgeStrengths[key2];
                if (hist && hist.count >= 3) {
                    // 用共現頻率微調 strength（±20% 範圍內）
                    var freq = Math.min(hist.count / histData.recordCount, 1);
                    var adjustment = (freq - 0.5) * 0.4; // -0.2 ~ +0.2
                    e.strength = Math.max(0.1, Math.min(1.0, (e.strength || 0.5) + adjustment));
                    e._histCount = hist.count;
                    e._histCalibrated = true;
                }
            });
        }

        // ── ② 從 Literature 提取新的三元組
        var allLit = [];
        try { allLit = JSON.parse(localStorage.getItem('foamcore_rag_literature') || '[]'); } catch(e) {}
        
        var litTriples = [];
        allLit.forEach(function(lit) {
            var triples = extractTriples((lit.title || '') + ' ' + (lit.content || ''));
            litTriples = litTriples.concat(triples);
        });

        // 去重並加入
        litTriples.forEach(function(t) {
            var key = t.source + '_' + t.target + '_' + t.type;
            var keyR = t.target + '_' + t.source + '_' + t.type;
            if (!edgeKeySet[key] && !edgeKeySet[keyR] && nodeIdSet[t.source] && nodeIdSet[t.target]) {
                merged.edges.push(t);
                edgeKeySet[key] = true;
            }
        });

        merged.meta = {
            baseNodes: baseKG.nodes.length,
            baseEdges: baseKG.edges.length,
            mergedNodes: merged.nodes.length,
            mergedEdges: merged.edges.length,
            historyRecords: histData.recordCount,
            literatureCount: allLit.length,
            litTriples: litTriples.length,
            calibratedEdges: merged.edges.filter(function(e) { return e._histCalibrated; }).length,
            builtAt: new Date().toISOString(),
        };

        return merged;
    }

    // ═══════════════════════════════════════════════════════════
    // §4  BOOTSTRAP — 預載內建文獻到 RAG Literature 庫
    // ═══════════════════════════════════════════════════════════

    var BOOTSTRAP_KEY = 'foamcore_kg_bootstrap_v3';

    function bootstrapLiterature() {
        // 只執行一次（除非版本更新）
        if (localStorage.getItem(BOOTSTRAP_KEY) === 'done') return { added: 0, total: 0 };

        var existing = [];
        try { existing = JSON.parse(localStorage.getItem('foamcore_rag_literature') || '[]'); } catch(e) {}
        var existingTitles = {};
        existing.forEach(function(lit) { existingTitles[lit.title] = true; });

        var added = 0;
        BUILT_IN_LITERATURE.forEach(function(lit) {
            if (!existingTitles[lit.title]) {
                existing.push({
                    title: lit.title,
                    content: lit.content + (lit.source ? '\n[Source: ' + lit.source + ']' : ''),
                    added: new Date().toISOString().slice(0, 10),
                    tags: lit.tags || [],
                    builtin: true
                });
                added++;
            }
        });

        localStorage.setItem('foamcore_rag_literature', JSON.stringify(existing));
        localStorage.setItem(BOOTSTRAP_KEY, 'done');

        // 觸發 RAG rebuild
        if (typeof FoamCoreRAG !== 'undefined' && FoamCoreRAG.buildIndex) {
            FoamCoreRAG.buildIndex();
        }

        return { added: added, total: existing.length };
    }

    /**
     * 重置內建文獻（下次 bootstrap 會重新載入）
     */
    function resetBootstrap() {
        localStorage.removeItem(BOOTSTRAP_KEY);
        // 移除 builtin 標記的文獻
        var existing = [];
        try { existing = JSON.parse(localStorage.getItem('foamcore_rag_literature') || '[]'); } catch(e) {}
        var filtered = existing.filter(function(lit) { return !lit.builtin; });
        localStorage.setItem('foamcore_rag_literature', JSON.stringify(filtered));
        return filtered.length;
    }

    // ═══════════════════════════════════════════════════════════
    // §5  PUBLIC API
    // ═══════════════════════════════════════════════════════════

    return {
        // 建構合併後的知識圖譜
        buildMergedKG: buildMergedKG,

        // 從配方紀錄提取統計
        extractFromHistory: extractFromHistory,

        // 從文本提取三元組
        extractTriples: extractTriples,

        // 預載內建文獻
        bootstrapLiterature: bootstrapLiterature,

        // 重置內建文獻
        resetBootstrap: resetBootstrap,

        // 取得內建文獻列表（供 UI 顯示）
        getBuiltInLiterature: function() { return BUILT_IN_LITERATURE; },

        // 取得 entity 模式（供外部擴展）
        getEntityPatterns: function() { return ENTITY_PATTERNS; },

        // 版本
        version: '1.2',
    };
})();

console.log('🧠 FoamCore KG Builder v1.2 loaded', {
    builtInLiterature: FoamCoreKGBuilder.getBuiltInLiterature().length + ' articles',
    entityPatterns: Object.keys(FoamCoreKGBuilder.getEntityPatterns()).length + ' patterns',
});

// Node.js module export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FoamCoreKGBuilder;
}
