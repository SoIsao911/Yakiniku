// ===================================================================
// FoamCore RAG Engine v1.1
// Knowledge-based search with Synonyms, Smart Index, Cross-KB, Memory
// ===================================================================

var FoamCoreRAG = (function() {
    'use strict';
    
    var STORAGE_KEY = 'foamcore_rag_index';
    var LIT_KEY = 'foamcore_rag_literature';
    var VERSION_KEY = 'foamcore_rag_version';
    
    var index = { formula: [], tds: [], literature: [] };
    var vocabulary = {};
    var idf = {};
    var vocabSize = 0;
    var isBuilt = false;
    
    // Layer 4: Conversation Memory
    var conversationHistory = [];
    var lastContext = { topic: '', model: '', color: '', material: '' };
    
    // ===================================================================
    // Layer 1: Synonym Dictionary
    // ===================================================================
    var SYNONYMS = {
        'dcp':['crosslinker','peroxide','dicumyl','架橋劑','交聯劑','過氧化物'],
        'zno':['zinc oxide','氧化鋅','活化劑','activator'],
        'urea':['尿素','促進劑','accelerator','ac promoter'],
        'bht':['antioxidant','抗氧化劑','防老劑','butylated hydroxytoluene','酚系抗氧化'],
        'ac':['blowing agent','發泡劑','azodicarbonamide','adc','adca'],
        'hals':['uv stabilizer','光穩定劑','紫外線','hindered amine','光安定劑'],
        'eva':['ethylene vinyl acetate','乙烯醋酸乙烯酯','醋酸乙烯'],
        'ldpe':['low density polyethylene','低密度聚乙烯','聚乙烯'],
        'poe':['polyolefin elastomer','聚烯烴彈性體','engage'],
        'va':['vinyl acetate','醋酸乙烯含量','va含量'],
        'mi':['melt index','mfr','熔融指數','melt flow','流動指數','熔體流動','melt flow rate'],
        'density':['密度','比重','specific gravity'],
        'tm':['melting point','熔點','融點','熔化溫度'],
        'temp1':['mixing temperature','密煉溫度','一段溫度','混煉溫度'],
        'temp2':['foaming temperature','發泡溫度','二段溫度','模溫'],
        'time2':['foaming time','發泡時間','二段時間','成型時間'],
        'qi':['quality index','品質指標','品質'],
        'score':['quality score','品質分數','評分','qs'],
        'expansion':['發泡倍率','倍率','膨脹比','exp'],
        '特黑':['cb','carbon black','炭黑','黑色'],
        '藍':['blue','pb15','酞菁藍'],
        '紅':['red','azo','偶氮紅'],
        '綠':['green','pg7','酞菁綠'],
        '白':['white','tio2','鈦白'],
        '灰':['grey','gray'],
        '不夠':['不足','偏低','too low','insufficient'],
        '太多':['過多','偏高','too high','excessive'],
        '替代':['replacement','substitute','替換','取代'],
        '配方':['formula','formulation','recipe','處方'],
        '斷貨':['缺貨','out of stock','discontinued','停產'],
        'tds':['technical data sheet','規格書','技術資料','物性表'],
        '色母':['color masterbatch','色母粒','pigment mb'],
        '母粒':['masterbatch','mb'],
        // ── v1.2 新增同義詞 ──
        // 阻燃劑
        'ath':['氫氧化鋁','aluminum trihydrate','alumina trihydrate','al(oh)3'],
        '紅磷':['red phosphorus','rp','磷系阻燃'],
        'br-sb':['溴銻','bromine antimony','dbdpe','十溴二苯醚','sb2o3','三氧化二銻'],
        'cp-70':['氯化石蠟','chlorinated paraffin','含氯阻燃'],
        'mh':['氫氧化鎂','magnesium hydroxide','mg(oh)2'],
        // 測試方法
        'astm d2765':['溶劑萃取','gel content test','膠含量測試','二甲苯萃取'],
        'shore a':['邵氏硬度','shore hardness','硬度計'],
        'asker c':['asker硬度','日本硬度計','軟質泡棉硬度'],
        'compression set':['壓縮永久變形','壓縮殘留','cs','astm d395'],
        // 加工設備
        '密煉機':['banbury','internal mixer','密閉式混煉機','加壓混煉機'],
        '兩輥機':['two-roll mill','開煉機','open mill','two roll','煉膠機'],
        '壓機':['press','熱壓機','molding press','油壓機','compression mold'],
        // 缺陷術語
        'blistering':['起泡','水泡','表面氣泡','blister'],
        'yellowing':['黃變','變黃','泛黃','color shift','discoloration'],
        'warping':['翹曲','彎曲變形','warp','bow'],
        'delamination':['分層','脫層','剝離','layer separation'],
        '魚眼':['fish eye','fisheye','局部硬點','凝膠點'],
        // 材料術語
        'tac':['三烯丙基氰尿酸酯','triallyl cyanurate','多功能單體','coagent'],
        'stearic acid':['硬脂酸','st/a','潤滑劑'],
        'pcr':['post consumer recycled','回收料','再生料','recycled material'],
        'caco3':['碳酸鈣','calcium carbonate','石灰石','chalk'],
        'tio2':['鈦白粉','titanium dioxide','二氧化鈦','白色顏料'],
        'ci':['crosslinking index','交聯指數','交聯度指標'],
        '冷縮':['shrinkage','收縮','尺寸收縮','dimensional shrinkage','post shrinkage'],
        '塌陷':['collapse','cell collapse','泡孔塌陷','塔陷','坍塌','foam collapse'],
        '破裂':['rupture','表皮破裂','skin rupture','爆裂','裂開'],
        '脆化':['brittle','embrittlement','開裂','脆裂','brittleness'],
        '邊緣硬化':['edge hardening','edge harden','山形曲線','邊硬'],
        '泡孔':['cell','foam cell','氣泡','泡孔結構','cell structure','泡泡'],
        '交聯':['crosslink','crosslinking','架橋','交聯反應','硫化','curing'],
        '發泡':['foaming','foam','膨脹','blowing','起泡成型'],
        '倍率':['expansion ratio','發泡倍率','膨脹比','倍數','magnification'],
        '填料':['filler','填充劑','無機填料','填充'],
        '阻燃':['flame retardant','防火','阻燃劑','flame retardancy','難燃'],
        '老化':['aging','ageing','劣化','degradation','weathering','耐候'],
        '分散':['dispersion','dispersing','混合均勻','分佈','distribute'],
        '模具':['mold','mould','模壓','molding','press mold'],
        '成本':['cost','價格','價錢','降本','cost reduction','省錢']
    };
    
    var synonymLookup = {};
    Object.keys(SYNONYMS).forEach(function(key) {
        var allWords = [key].concat(SYNONYMS[key]);
        allWords.forEach(function(word) {
            var w = word.toLowerCase();
            if (!synonymLookup[w]) synonymLookup[w] = [];
            allWords.forEach(function(syn) {
                var s = syn.toLowerCase();
                if (s !== w && synonymLookup[w].indexOf(s) === -1) synonymLookup[w].push(s);
            });
        });
    });
    
    function expandWithSynonyms(tokens) {
        var expanded = tokens.slice();
        tokens.forEach(function(t) {
            var syns = synonymLookup[t];
            if (syns) {
                syns.forEach(function(s) {
                    s.split(/\s+/).forEach(function(st) {
                        if (expanded.indexOf(st) === -1) expanded.push(st);
                    });
                });
            }
        });
        return expanded;
    }
    
    // ===================================================================
    // Text Processing — Enhanced Chinese support
    // ===================================================================
    function tokenize(text) {
        if (!text) return [];
        var cleaned = String(text).toLowerCase()
            .replace(/[，。；：、！？\(\)\[\]{}\u300a\u300b\u3010\u3011]/g, ' ')
            .replace(/[^a-z0-9\u4e00-\u9fff\u3400-\u4dbf.%°℃]+/g, ' ');
        
        var parts = cleaned.split(/\s+/).filter(function(w) { return w.length > 0; });
        var tokens = [];
        
        parts.forEach(function(part) {
            // English/number tokens: keep as-is if length > 1
            if (/^[a-z0-9.%°℃]+$/.test(part)) {
                if (part.length > 1) tokens.push(part);
                return;
            }
            // Chinese: character-level 2-grams + full token
            var chars = part.split('');
            if (chars.length >= 2) {
                tokens.push(part); // full token
                // Generate 2-char grams for Chinese
                for (var i = 0; i < chars.length - 1; i++) {
                    var gram = chars[i] + chars[i + 1];
                    if (tokens.indexOf(gram) === -1) tokens.push(gram);
                }
                // Also add individual chars for very short queries
                if (chars.length <= 3) {
                    chars.forEach(function(c) {
                        if (/[\u4e00-\u9fff]/.test(c) && tokens.indexOf(c) === -1) tokens.push(c);
                    });
                }
            } else if (chars.length === 1 && /[\u4e00-\u9fff]/.test(chars[0])) {
                tokens.push(chars[0]);
            }
        });
        
        return tokens;
    }
    
    function bigrams(tokens) {
        var r = tokens.slice();
        for (var i = 0; i < tokens.length - 1; i++) {
            var bg = tokens[i] + '_' + tokens[i+1];
            if (r.indexOf(bg) === -1) r.push(bg);
        }
        return r;
    }
    
    function buildTF(tokens) {
        var tf = {};
        tokens.forEach(function(t) { tf[t] = (tf[t] || 0) + 1; });
        var mx = Math.max.apply(null, Object.values(tf)) || 1;
        Object.keys(tf).forEach(function(t) { tf[t] = 0.5 + 0.5 * (tf[t] / mx); });
        return tf;
    }
    
    function buildIDF(allDocs) {
        var n = allDocs.length, df = {};
        allDocs.forEach(function(doc) {
            var seen = {};
            doc.tokens.forEach(function(t) { if (!seen[t]) { df[t] = (df[t]||0)+1; seen[t]=true; } });
        });
        idf = {}; vocabulary = {}; vocabSize = 0;
        Object.keys(df).forEach(function(w) {
            idf[w] = Math.log((n+1)/(df[w]+1)) + 1;
            vocabulary[w] = vocabSize++;
        });
    }
    
    function buildTFIDF(tokens) {
        var tf = buildTF(tokens), v = {};
        Object.keys(tf).forEach(function(w) { if (idf[w]) v[w] = tf[w] * idf[w]; });
        return v;
    }
    
    function cosineSim(v1, v2) {
        var dot=0, n1=0, n2=0;
        Object.keys(v1).forEach(function(k) { n1+=v1[k]*v1[k]; if(v2[k]) dot+=v1[k]*v2[k]; });
        Object.keys(v2).forEach(function(k) { n2+=v2[k]*v2[k]; });
        return (n1===0||n2===0) ? 0 : dot/(Math.sqrt(n1)*Math.sqrt(n2));
    }
    
    // ===================================================================
    // Index Building
    // ===================================================================
    function buildFormulaIndex() {
        var h = [];
        try { h = JSON.parse(localStorage.getItem('foamHistory') || '[]'); } catch(e) {}
        if (!h || !h.length) return 0;
        index.formula = h.map(function(r, i) {
            var text = [r.productModel||'', r.batchId||'', 'DCP', r.raw_dcp_g||'', 'Temp1', r.raw_temp1||'',
                'Temp2', r.raw_temp2||'', 'Time2', r.raw_time2||'', 'ZnO', r.raw_zno_g||'',
                'Urea', r.raw_urea_g||'', 'BHT', r.raw_bht_g||'', 'EVA', r.raw_eva16_kg||'',
                'LDPE', r.raw_ldpe24_kg||r.raw_ldpe40_kg||'', 'POE', r.raw_poe_kg||'',
                'color', r.raw_color_kg||'', 'AC', r.raw_acpe_kg||r.raw_aceva_kg||'',
                'expansion', r.predictedExpansion||r.raw_expansion||'',
                'QI', r.qi_percent||'', 'score', r.qualityScore||'', r.resinType||''].join(' ');
            return { id:'f_'+i, type:'formula', text:text, tokens:bigrams(tokenize(text)), vector:null,
                data:{ index:i, model:r.productModel||'?', color:r.batchId||'',
                    dcp:r.raw_dcp_g||0, temp1:r.raw_temp1||0, temp2:r.raw_temp2||0,
                    time2:r.raw_time2||0, zno:r.raw_zno_g||0, urea:r.raw_urea_g||0,
                    bht:r.raw_bht_g||0, qi:r.qi_percent||0, score:r.qualityScore||0,
                    expansion:r.predictedExpansion||r.raw_expansion||0, resin:r.resinType||'',
                    eva16:r.raw_eva16_kg||0, ldpe:r.raw_ldpe24_kg||r.raw_ldpe40_kg||0,
                    poe:r.raw_poe_kg||0, color_kg:r.raw_color_kg||0,
                    acpe:r.raw_acpe_kg||0, aceva:r.raw_aceva_kg||0 }};
        });
        return index.formula.length;
    }
    
    function buildTDSIndex() {
        var lib = [];
        try { lib = JSON.parse(localStorage.getItem('foamcore_materials') || '[]'); } catch(e) {}
        if (!lib || !lib.length) return 0;
        index.tds = lib.map(function(m, i) {
            var text = [m.name||'', m.category||'', m.supplier||'',
                m.va?'VA '+m.va+'%':'', m.mi?'MI '+m.mi:'', m.density?'density '+m.density:'',
                m.tm?'Tm '+m.tm+'°C':'', m.active_pct?'active '+m.active_pct+'%':'',
                m.ac_content?'AC '+m.ac_content+'%':'', m.gas_volume?'gas '+m.gas_volume:'',
                m.decomp_temp?'decomp '+m.decomp_temp:'', m.pigment_content?'pigment '+m.pigment_content+'%':'',
                m.carrier_type||'', m.ai_notes||''].join(' ');
            return { id:'t_'+i, type:'tds', text:text, tokens:bigrams(tokenize(text)), vector:null, data:m };
        });
        return index.tds.length;
    }
    
    function buildLiteratureIndex() {
        var lit = [];
        try { lit = JSON.parse(localStorage.getItem(LIT_KEY) || '[]'); } catch(e) {}
        index.literature = lit.map(function(d, i) {
            return { id:'l_'+i, type:'literature', text:d.title+' '+d.content,
                tokens:bigrams(tokenize(d.title+' '+d.content)), vector:null,
                data:{ title:d.title, content:d.content, added:d.added||'' }};
        });
        return index.literature.length;
    }
    
    // Layer 2: Smart Index
    function getFingerprint() {
        var h=0, m=0, l=0;
        try { h=JSON.parse(localStorage.getItem('foamHistory')||'[]').length; } catch(e){}
        try { m=JSON.parse(localStorage.getItem('foamcore_materials')||'[]').length; } catch(e){}
        try { l=JSON.parse(localStorage.getItem(LIT_KEY)||'[]').length; } catch(e){}
        return h+':'+m+':'+l;
    }
    
    function needsRebuild() { return (localStorage.getItem(VERSION_KEY)||'') !== getFingerprint(); }
    
    function buildIndex() {
        var f=buildFormulaIndex(), t=buildTDSIndex(), l=buildLiteratureIndex();
        var all = index.formula.concat(index.tds).concat(index.literature);
        if (!all.length) return {formula:0,tds:0,literature:0,total:0};
        buildIDF(all);
        all.forEach(function(d) { d.vector = buildTFIDF(d.tokens); });
        isBuilt = true;
        saveIndex();
        localStorage.setItem(VERSION_KEY, getFingerprint());
        console.log('📚 RAG: '+f+' formulas, '+t+' TDS, '+l+' lit, vocab='+vocabSize);
        return {formula:f, tds:t, literature:l, total:all.length, vocabSize:vocabSize};
    }
    
    function ensureIndex() {
        if (!isBuilt) loadIndex();
        if (!isBuilt || needsRebuild()) buildIndex();
    }
    
    // ===================================================================
    // Search (Layer 1 synonym expansion)
    // ===================================================================
    function search(query, options) {
        options = options || {};
        var topK = options.topK || 10;
        var kbs = options.kbs || ['formula','tds','literature'];
        ensureIndex();
        if (!isBuilt) return [];
        
        var qTokens = expandWithSynonyms(tokenize(query));
        var qVector = buildTFIDF(bigrams(qTokens));
        var results = [];
        var seenIds = {};
        
        // TF-IDF cosine similarity search
        kbs.forEach(function(kb) {
            if (!index[kb]) return;
            index[kb].forEach(function(doc) {
                if (!doc.vector) return;
                var s = cosineSim(qVector, doc.vector);
                if (s > 0.01) {
                    results.push({id:doc.id, type:doc.type, score:Math.round(s*1000)/1000, data:doc.data, text:doc.text.substring(0,200)});
                    seenIds[doc.id] = true;
                }
            });
        });
        
        // Keyword substring fallback — catches short Chinese queries
        if (results.length < 3 && query.length >= 2) {
            var qLower = query.toLowerCase();
            var qChars = qLower.split('');
            kbs.forEach(function(kb) {
                if (!index[kb]) return;
                index[kb].forEach(function(doc) {
                    if (seenIds[doc.id]) return;
                    var text = (doc.text || '').toLowerCase();
                    // Direct substring match
                    if (text.indexOf(qLower) !== -1) {
                        results.push({id:doc.id, type:doc.type, score:0.05, data:doc.data, text:doc.text.substring(0,200)});
                        seenIds[doc.id] = true;
                    }
                    // Also check expanded synonyms
                    else if (qTokens.some(function(t) { return t.length >= 2 && text.indexOf(t) !== -1; })) {
                        results.push({id:doc.id, type:doc.type, score:0.03, data:doc.data, text:doc.text.substring(0,200)});
                        seenIds[doc.id] = true;
                    }
                });
            });
        }
        
        results.sort(function(a,b){return b.score-a.score;});
        return results.slice(0, topK);
    }
    
    // ===================================================================
    // Layer 3: Cross-KB Correlation
    // ===================================================================
    function crossCorrelate(results) {
        var fr = results.filter(function(r){return r.type==='formula';});
        var tr = results.filter(function(r){return r.type==='tds';});
        var lr = results.filter(function(r){return r.type==='literature';});
        
        // Related TDS from formula context
        var relatedTDS = [];
        if (fr.length > 0 && index.tds.length > 0) {
            var kw = {};
            fr.forEach(function(r) {
                if (r.data.eva16>0) kw['eva']=1;
                if (r.data.ldpe>0) kw['ldpe']=1;
                if (r.data.poe>0) kw['poe']=1;
            });
            var existT = {};
            tr.forEach(function(r){existT[r.id]=1;});
            index.tds.forEach(function(doc) {
                if (existT[doc.id]) return;
                var cat = (doc.data.category||'').toLowerCase();
                if (kw[cat]) relatedTDS.push({id:doc.id,type:'tds',score:0.01,data:doc.data,text:doc.text.substring(0,200),crossRef:true});
            });
        }
        
        // Stats from formula matches
        var stats = null;
        if (fr.length >= 2) {
            var dcps=[],t1s=[],qis=[],scs=[],exps=[];
            fr.forEach(function(r) {
                var d=r.data;
                if(d.dcp>0)dcps.push(d.dcp); if(d.temp1>0)t1s.push(d.temp1);
                if(d.qi>0)qis.push(d.qi); if(d.score>0)scs.push(d.score);
                if(d.expansion>0)exps.push(d.expansion);
            });
            function avg(a){return a.length?Math.round(a.reduce(function(x,y){return x+y;},0)/a.length*10)/10:0;}
            function rng(a){return a.length?[Math.min.apply(null,a),Math.max.apply(null,a)]:[0,0];}
            stats = {count:fr.length, dcp:{avg:avg(dcps),range:rng(dcps)}, temp1:{avg:avg(t1s),range:rng(t1s)},
                qi:{avg:avg(qis),range:rng(qis)}, score:{avg:avg(scs),range:rng(scs)}, expansion:{avg:avg(exps),range:rng(exps)}};
        }
        
        // Related literature from formula context
        var relatedLit = [];
        if (fr.length > 0 && index.literature.length > 0) {
            var ctxText = fr.map(function(r){return r.data.model+' '+r.data.resin+' DCP '+r.data.dcp;}).join(' ');
            var ctxVec = buildTFIDF(bigrams(expandWithSynonyms(tokenize(ctxText))));
            var existL = {};
            lr.forEach(function(r){existL[r.id]=1;});
            index.literature.forEach(function(doc) {
                if (existL[doc.id]) return;
                var sim = cosineSim(ctxVec, doc.vector||{});
                if (sim > 0.02) relatedLit.push({id:doc.id,type:'literature',score:Math.round(sim*1000)/1000,data:doc.data,text:doc.text.substring(0,200),crossRef:true});
            });
            relatedLit.sort(function(a,b){return b.score-a.score;});
        }
        
        return { formulaResults:fr, tdsResults:tr.concat(relatedTDS.slice(0,3)), litResults:lr.concat(relatedLit.slice(0,2)), stats:stats };
    }
    
    // ===================================================================
    // Layer 4: Conversation Memory
    // ===================================================================
    function updateContext(question, results) {
        var q = question.toLowerCase();
        var modelMatch = question.match(/\d{3,4}[A-Za-z]*/);
        if (modelMatch) lastContext.model = modelMatch[0];
        ['特黑','黑','藍','紅','綠','白','灰','深藍','淺藍'].forEach(function(c){if(q.indexOf(c)>=0)lastContext.color=c;});
        if (q.indexOf('替代')>=0||q.indexOf('replace')>=0) lastContext.topic='substitution';
        else if (q.indexOf('配方')>=0||q.indexOf('formula')>=0) lastContext.topic='formula';
        else if (q.indexOf('dcp')>=0||q.indexOf('temp')>=0) lastContext.topic='process';
        
        conversationHistory.push({question:question, resultCount:results.length, context:JSON.parse(JSON.stringify(lastContext)), timestamp:Date.now()});
        if (conversationHistory.length > 10) conversationHistory = conversationHistory.slice(-10);
    }
    
    function expandWithContext(question) {
        var q = question.toLowerCase();
        var expanded = question;
        var needsCtx = (q.indexOf('它')>=0||q.indexOf('這個')>=0||q.indexOf('那個')>=0||
            (q.indexOf('跟')>=0&&!q.match(/\d{3,4}/))||(q.indexOf('比')>=0&&!q.match(/\d{3,4}/))||
            (q.indexOf('可以')>=0&&q.length<15)||(q.indexOf('再')>=0&&(q.indexOf('降')>=0||q.indexOf('升')>=0))||
            q.indexOf('還有')>=0||(q.indexOf('其他')>=0&&q.indexOf('顏色')>=0));
        
        if (needsCtx && conversationHistory.length > 0) {
            if (lastContext.model && q.indexOf(lastContext.model.toLowerCase()) < 0) expanded = lastContext.model + ' ' + expanded;
            if (lastContext.color && q.indexOf(lastContext.color) < 0 && q.indexOf('其他顏色') < 0) expanded += ' ' + lastContext.color;
        }
        return expanded;
    }
    
    function getConversationSummary() {
        if (!conversationHistory.length) return '';
        return conversationHistory.slice(-3).map(function(h){return 'Q: '+h.question+' ('+h.resultCount+' results)';}).join('\n');
    }
    
    // ===================================================================
    // Ask (Search + Cross-correlate + Claude)
    // ===================================================================
    async function ask(question, claudeKey) {
        var expanded = expandWithContext(question);
        ensureIndex();
        var results = search(expanded, {topK:12});
        var corr = crossCorrelate(results);
        updateContext(question, results);
        
        if (!results.length) return {answer:null, results:[], stats:null, formulaResults:[], tdsResults:[], litResults:[], source:'no_results', message:'No relevant information found.', expandedQuery:expanded!==question?expanded:null};
        
        // Build context
        var ctx = '';
        if (corr.stats) {
            var s = corr.stats;
            ctx += '\n[Stats: '+s.count+' batches] DCP:'+s.dcp.avg+'g('+s.dcp.range[0]+'-'+s.dcp.range[1]+') Temp1:'+s.temp1.avg+'°C('+s.temp1.range[0]+'-'+s.temp1.range[1]+') QI:'+s.qi.avg+'% Score:'+s.score.avg+' Exp:'+s.expansion.avg+'X';
        }
        corr.formulaResults.slice(0,5).forEach(function(r) {
            var d=r.data;
            ctx+='\n[Formula] '+d.model+' '+d.color+' | DCP:'+d.dcp+'g Temp1:'+d.temp1+'°C Time2:'+d.time2+'min ZnO:'+d.zno+'g | QI:'+d.qi+'% Score:'+d.score+' '+d.resin;
        });
        corr.tdsResults.slice(0,3).forEach(function(r) {
            var m=r.data;
            ctx+='\n[TDS'+(r.crossRef?'*':'')+'] '+(m.name||'')+' '+(m.category||'')+' '+(m.supplier||'')+(m.va?' VA:'+m.va+'%':'')+(m.mi?' MI:'+m.mi:'')+(m.density?' ρ:'+m.density:'');
        });
        corr.litResults.slice(0,2).forEach(function(r) {
            ctx+='\n[Lit'+(r.crossRef?'*':'')+'] '+(r.data.title||'')+': '+(r.data.content||'').substring(0,200);
        });
        var histCtx = conversationHistory.length>1 ? '\n\nPrevious:\n'+getConversationSummary() : '';
        
        if (!claudeKey || claudeKey.length < 5) {
            return {answer:null, results:results, stats:corr.stats, formulaResults:corr.formulaResults, tdsResults:corr.tdsResults, litResults:corr.litResults, source:'local', message:'Local results (no Claude API key)', expandedQuery:expanded!==question?expanded:null};
        }
        
        try {
            var resp = await fetch('/proxy/anthropic', {
                method:'POST',
                headers:{'Content-Type':'application/json','x-api-key':claudeKey,'anthropic-version':'2023-06-01'},
                body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:1500,
                    messages:[{role:'user',content:'You are a crosslinked EVA/LDPE/POE foam expert. Answer in Traditional Chinese (繁體中文).\n\nQuestion: '+question+'\n\nKnowledge base:\n'+ctx+histCtx+'\n\nInstructions: Answer directly, reference batch records, highlight key ranges, give actionable advice. Be concise.'}]
                })
            });
            var data = await resp.json();
            var answer = '';
            if (data.content && Array.isArray(data.content)) data.content.forEach(function(b){if(b.type==='text'&&b.text)answer+=b.text;});
            
            return {answer:answer, results:results, stats:corr.stats, formulaResults:corr.formulaResults, tdsResults:corr.tdsResults, litResults:corr.litResults, source:'claude', message:'AI analysis from '+results.length+' entries', expandedQuery:expanded!==question?expanded:null};
        } catch(e) {
            return {answer:null, results:results, stats:corr.stats, formulaResults:corr.formulaResults, tdsResults:corr.tdsResults, litResults:corr.litResults, source:'local_fallback', message:'Claude unavailable ('+e.message+')', expandedQuery:expanded!==question?expanded:null};
        }
    }
    
    // ===================================================================
    // Literature Management
    // ===================================================================
    function addLiterature(title, content) {
        var lit = [];
        try { lit = JSON.parse(localStorage.getItem(LIT_KEY) || '[]'); } catch(e) {}
        lit.push({title:title, content:content, added:new Date().toISOString().slice(0,10)});
        localStorage.setItem(LIT_KEY, JSON.stringify(lit));
        buildIndex();
        return lit.length;
    }
    function removeLiterature(idx) {
        var lit = [];
        try { lit = JSON.parse(localStorage.getItem(LIT_KEY) || '[]'); } catch(e) {}
        if (idx>=0 && idx<lit.length) { lit.splice(idx,1); localStorage.setItem(LIT_KEY,JSON.stringify(lit)); buildIndex(); }
        return lit.length;
    }
    function getLiterature() {
        try { return JSON.parse(localStorage.getItem(LIT_KEY) || '[]'); } catch(e) { return []; }
    }
    
    // ===================================================================
    // Persistence
    // ===================================================================
    function saveIndex() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                idf:idf, vocabulary:vocabulary, vocabSize:vocabSize,
                formula:index.formula.map(function(d){return {id:d.id,type:d.type,tokens:d.tokens,vector:d.vector,data:d.data,text:d.text.substring(0,200)};}),
                tds:index.tds.map(function(d){return {id:d.id,type:d.type,tokens:d.tokens,vector:d.vector,data:d.data,text:d.text.substring(0,200)};}),
                literature:index.literature.map(function(d){return {id:d.id,type:d.type,tokens:d.tokens,vector:d.vector,data:d.data,text:d.text.substring(0,300)};}),
                builtAt:new Date().toISOString()
            }));
            return true;
        } catch(e) { return false; }
    }
    function loadIndex() {
        try {
            var d = JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
            if (!d) return false;
            idf=d.idf||{}; vocabulary=d.vocabulary||{}; vocabSize=d.vocabSize||0;
            index.formula=d.formula||[]; index.tds=d.tds||[]; index.literature=d.literature||[];
            isBuilt = (index.formula.length+index.tds.length+index.literature.length) > 0;
            return isBuilt;
        } catch(e) { return false; }
    }
    
    function getStatus() {
        return { isBuilt:isBuilt, needsRebuild:needsRebuild(), formula:index.formula.length,
            tds:index.tds.length, literature:index.literature.length,
            total:index.formula.length+index.tds.length+index.literature.length,
            vocabSize:vocabSize, synonyms:Object.keys(SYNONYMS).length,
            turns:conversationHistory.length, lastContext:lastContext };
    }
    
    loadIndex();
    
    return { buildIndex:buildIndex, search:search, ask:ask, crossCorrelate:crossCorrelate,
        addLiterature:addLiterature, removeLiterature:removeLiterature, getLiterature:getLiterature,
        getStatus:getStatus, loadIndex:loadIndex, ensureIndex:ensureIndex, needsRebuild:needsRebuild,
        getConversationSummary:getConversationSummary, expandWithSynonyms:expandWithSynonyms };
})();

console.log('📚 FoamCore RAG v1.1 loaded', FoamCoreRAG.getStatus());
