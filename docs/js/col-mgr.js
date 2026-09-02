/**
 * ShColMgr — Gerenciador universal de colunas para tabelas SplitHub
 * Expõe window.ShColMgr com drag-reorder, sort, show/hide e CSV export.
 */
(function(global) {
  'use strict';

  /* ── CSS injection ─────────────────────────────────────────── */
  (function() {
    if (document.getElementById('sh-col-mgr-css')) return;
    var style = document.createElement('style');
    style.id = 'sh-col-mgr-css';
    style.textContent = [
      '.sh-cm-btn{border:1px solid var(--border,#d0d7de);border-radius:6px;padding:4px 10px;font-size:12px;font-weight:500;font-family:inherit;cursor:pointer;background:var(--surface,#f6f8fa);color:var(--txt1,#1f2328);display:inline-flex;align-items:center;gap:4px;transition:border-color .15s,background .15s;}',
      '.sh-cm-btn:hover,.sh-cm-btn-active{border-color:var(--blue,#0969da);background:var(--blue-bg,#dbeafe);color:var(--blue,#0969da);}',
      '.sh-cm-reset-btn{padding:4px 7px;}',
      '.sh-cm-panel{position:absolute;top:calc(100% + 4px);left:0;z-index:200;background:var(--surface,#f6f8fa);border:1px solid var(--border,#d0d7de);border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,.15);min-width:210px;padding:8px;}',
      '.sh-cm-panel-title{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--txt3,#9ca3af);padding:2px 4px 6px;border-bottom:1px solid var(--border,#d0d7de);margin-bottom:6px;}',
      '.sh-cm-item{display:flex;align-items:center;gap:6px;padding:5px 4px;border-radius:5px;user-select:none;transition:background .1s;}',
      '.sh-cm-item:hover{background:var(--surface2,#eaeef2);}',
      '.sh-cm-item.sh-cm-drag-over{background:var(--blue-bg,#dbeafe);outline:1px dashed var(--blue,#0969da);}',
      '.sh-cm-item.sh-cm-dragging{opacity:.4;}',
      '.sh-cm-fixed .sh-cm-handle{opacity:.25;cursor:not-allowed;}',
      '.sh-cm-handle{font-size:14px;color:var(--txt3,#9ca3af);cursor:grab;flex-shrink:0;padding:0 2px;}',
      '.sh-cm-handle:active{cursor:grabbing;}',
      '.sh-cm-item input[type=checkbox]{accent-color:var(--blue,#0969da);cursor:pointer;flex-shrink:0;}',
      '.sh-cm-item label{font-size:12px;flex:1;cursor:pointer;}',
      '.sh-cm-export-menu{position:absolute;right:0;top:calc(100% + 4px);z-index:201;background:var(--surface,#f6f8fa);border:1px solid var(--border,#d0d7de);border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.15);min-width:240px;overflow:hidden;}',
      '.sh-cm-exp-label{padding:7px 12px 5px;font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--txt3,#9ca3af);border-bottom:1px solid var(--border,#d0d7de);}',
      '.sh-cm-exp-opt{width:100%;padding:9px 13px;text-align:left;background:none;border:none;border-bottom:1px solid var(--border,#d0d7de);cursor:pointer;font-family:inherit;display:flex;flex-direction:column;gap:2px;}',
      '.sh-cm-exp-opt:last-child{border-bottom:none;}',
      '.sh-cm-exp-opt:hover{background:var(--surface2,#eaeef2);}',
      '.sh-cm-exp-opt>span{font-size:13px;font-weight:600;color:var(--txt1,#1f2328);}',
      '.sh-cm-exp-opt>small{font-size:11px;color:var(--txt3,#9ca3af);}',
      '.sh-cm-sort-icon{margin-left:4px;opacity:.35;font-style:normal;font-size:10px;}',
      'th.sh-sort-asc .sh-cm-sort-icon,th.sh-sort-desc .sh-cm-sort-icon{opacity:1;color:var(--blue,#0969da);}',
      'th[data-sortable]{cursor:pointer;}',
      'th.sh-th-drag-over{background:var(--blue-bg,#dbeafe)!important;outline:2px dashed var(--blue,#0969da);outline-offset:-2px;}',
      'th.sh-th-dragging{opacity:.4;}',
      '.sh-cm-controls{display:flex;gap:6px;align-items:center;flex-shrink:0;position:relative;}',
    ].join('\n');
    document.head.appendChild(style);
  })();

  /* ── Internal registry ─────────────────────────────────────── */
  var _reg = {};
  var _dragSrcPanel = null;
  var _dragSrcTh = null;

  /* ── State helpers ─────────────────────────────────────────── */
  function _defaultState(config) {
    return {
      cols: config.cols.map(function(c) {
        return { key: c.key, label: c.label, fixed: !!c.fixed, visible: c.visible !== false, type: c.type || 'str' };
      }),
      sortKey: null,
      sortDir: 0
    };
  }

  function _load(id) {
    var r = _reg[id]; if (!r) return;
    try {
      var s = localStorage.getItem('sh_cm_' + id);
      if (!s) return;
      var parsed = JSON.parse(s);
      // Merge new cols added to config
      var savedKeys = parsed.cols.map(function(c) { return c.key; });
      r.config.cols.forEach(function(dc) {
        if (savedKeys.indexOf(dc.key) === -1) parsed.cols.push({ key: dc.key, label: dc.label, fixed: !!dc.fixed, visible: dc.visible !== false, type: dc.type || 'str' });
      });
      // Remove stale cols
      var configKeys = r.config.cols.map(function(c) { return c.key; });
      parsed.cols = parsed.cols.filter(function(c) { return configKeys.indexOf(c.key) !== -1; });
      r.state = parsed;
    } catch(e) {}
  }

  function _save(id) {
    var r = _reg[id]; if (!r) return;
    try { localStorage.setItem('sh_cm_' + id, JSON.stringify(r.state)); } catch(e) {}
  }

  function _closeAll(exceptId) {
    Object.keys(_reg).forEach(function(id) {
      if (id === exceptId) return;
      var panel = document.getElementById('sh-cm-panel-' + id);
      var colsBtn = document.getElementById('sh-cm-cols-' + id);
      if (panel && panel.style.display !== 'none') { panel.style.display = 'none'; if (colsBtn) colsBtn.classList.remove('sh-cm-btn-active'); }
      var expMenu = document.getElementById('sh-cm-exp-' + id);
      var expBtn = document.getElementById('sh-cm-exp-btn-' + id);
      if (expMenu && expMenu.style.display !== 'none') { expMenu.style.display = 'none'; if (expBtn) expBtn.classList.remove('sh-cm-btn-active'); }
    });
  }

  /* ── Toolbar injection ─────────────────────────────────────── */
  function _inject(id) {
    var r = _reg[id];
    if (document.getElementById('sh-cm-cols-' + id)) return true;
    var toolbar = document.querySelector(r.config.toolbarSel);
    if (!toolbar) return false;

    var wrap = document.createElement('div');
    wrap.className = 'sh-cm-controls';

    var eid = id.replace(/'/g, "\\'");
    wrap.innerHTML =
      '<button class="sh-cm-btn" id="sh-cm-cols-' + id + '" onclick="ShColMgr._togglePanel(\'' + eid + '\')">&#8862; Colunas</button>' +
      '<button class="sh-cm-btn sh-cm-reset-btn" onclick="ShColMgr.reset(\'' + eid + '\')" title="Restaurar colunas padrão">&#8635;</button>' +
      '<div style="position:relative">' +
        '<button class="sh-cm-btn" id="sh-cm-exp-btn-' + id + '" onclick="ShColMgr._toggleExport(\'' + eid + '\')">&#8595; CSV</button>' +
        '<div id="sh-cm-exp-' + id + '" class="sh-cm-export-menu" style="display:none">' +
          '<div class="sh-cm-exp-label">Exportar como</div>' +
          '<button class="sh-cm-exp-opt" onclick="ShColMgr._exportCSV(\'' + eid + '\',\'all\')">' +
            '<span>Toda a listagem</span>' +
            '<small>Todos os registros &middot; filtros ativos &middot; colunas vis&iacute;veis</small>' +
          '</button>' +
          '<button class="sh-cm-exp-opt" onclick="ShColMgr._exportCSV(\'' + eid + '\',\'page\')">' +
            '<span>P&aacute;gina atual</span>' +
            '<small>Apenas os registros desta p&aacute;gina</small>' +
          '</button>' +
        '</div>' +
      '</div>' +
      '<div id="sh-cm-panel-' + id + '" class="sh-cm-panel" style="display:none"></div>';

    toolbar.appendChild(wrap);
    return true;
  }

  /* ── Panel rendering ───────────────────────────────────────── */
  function _renderPanel(id) {
    var panel = document.getElementById('sh-cm-panel-' + id);
    if (!panel) return;
    var r = _reg[id];
    var html = '<div class="sh-cm-panel-title">Colunas</div>';
    r.state.cols.forEach(function(col, i) {
      var isFixed = !!col.fixed;
      var eid = id.replace(/'/g, "\\'");
      var ekey = col.key.replace(/'/g, "\\'");
      html += '<div class="sh-cm-item' + (isFixed ? ' sh-cm-fixed' : '') + '"'
        + (isFixed ? '' : ' draggable="true"')
        + ' ondragstart="ShColMgr._panelDragStart(event,\'' + eid + '\',' + i + ')"'
        + ' ondragover="ShColMgr._panelDragOver(event,\'' + eid + '\',' + i + ')"'
        + ' ondrop="ShColMgr._panelDrop(event,\'' + eid + '\',' + i + ')"'
        + ' ondragend="ShColMgr._panelDragEnd()">'
        + '<span class="sh-cm-handle">&#10783;</span>'
        + '<input type="checkbox" id="sh-cm-chk-' + id + '-' + col.key + '"'
        + (col.visible ? ' checked' : '') + (isFixed ? ' disabled' : '')
        + ' onchange="ShColMgr._toggleCol(\'' + eid + '\',\'' + ekey + '\')">'
        + '<label for="sh-cm-chk-' + id + '-' + col.key + '">'
        + col.label + (isFixed ? ' &#128274;' : '') + '</label>'
        + '</div>';
    });
    panel.innerHTML = html;
  }

  /* ── Public API ────────────────────────────────────────────── */
  var ShColMgr = {};

  ShColMgr.register = function(id, config) {
    _reg[id] = { config: config, state: _defaultState(config), _injected: false };
    _load(id);
    _reg[id]._injected = _inject(id);
  };

  ShColMgr.visCols = function(id) {
    var r = _reg[id]; if (!r) return [];
    return r.state.cols.filter(function(c) { return c.visible; });
  };

  ShColMgr.sortRows = function(id, rows) {
    if (!rows) return [];
    var r = _reg[id]; if (!r) return rows.slice();
    var s = r.state;
    if (!s.sortKey || s.sortDir === 0) return rows.slice();
    var col = s.cols.find(function(c) { return c.key === s.sortKey; });
    var type = col ? col.type : 'str';
    return rows.slice().sort(function(a, b) {
      var av = a[s.sortKey], bv = b[s.sortKey];
      var res = 0;
      if (type === 'num') { res = ((+av || 0) - (+bv || 0)); }
      else if (type === 'date') { res = (av || '') < (bv || '') ? -1 : (av || '') > (bv || '') ? 1 : 0; }
      else { res = String(av || '').localeCompare(String(bv || ''), 'pt-BR'); }
      return res * s.sortDir;
    });
  };

  ShColMgr.sortBy = function(id, key) {
    var r = _reg[id]; if (!r) return;
    var s = r.state;
    if (s.sortKey === key) {
      if (s.sortDir === 0) { s.sortDir = 1; }
      else if (s.sortDir === 1) { s.sortDir = -1; }
      else { s.sortDir = 0; s.sortKey = null; }
    } else {
      s.sortKey = key;
      s.sortDir = 1;
    }
    _save(id);
    _triggerReRender(id);
  };

  function _triggerReRender(id) {
    var r = _reg[id]; if (!r) return;
    if (r.config.reRenderFn) {
      try { r.config.reRenderFn(); } catch(e) {}
    } else {
      var tbody = document.getElementById(r.config.tbodyId);
      if (tbody) {
        try { tbody.dispatchEvent(new CustomEvent('sh-cm-reorder', { bubbles: true })); } catch(e) {}
      }
    }
  }

  ShColMgr.afterRender = function(id) {
    var r = _reg[id]; if (!r) return;
    if (!r._injected) r._injected = _inject(id);

    var thead = r.config.theadId ? document.getElementById(r.config.theadId) : null;
    if (!thead) return;
    var ths = thead.querySelectorAll('th');
    var visCols = ShColMgr.visCols(id);
    var s = r.state;

    ths.forEach(function(th, i) {
      var col = visCols[i];
      if (!col) return;
      th.setAttribute('data-col-key', col.key);
      th.setAttribute('data-sortable', '1');

      // Remove old sort icon
      var oldIcon = th.querySelector('.sh-cm-sort-icon');
      if (oldIcon) oldIcon.remove();

      // Add sort icon
      var icon = document.createElement('i');
      icon.className = 'sh-cm-sort-icon';
      var asc = s.sortKey === col.key && s.sortDir === 1;
      var desc = s.sortKey === col.key && s.sortDir === -1;
      icon.textContent = asc ? '↑' : desc ? '↓' : '↕';
      th.appendChild(icon);

      th.classList.toggle('sh-sort-asc', asc);
      th.classList.toggle('sh-sort-desc', desc);

      th._shColKey = col.key;
      th._shColId = id;
      if (!th._shSortBound) {
        th.addEventListener('click', function(e) {
          if (e.target && (e.target.type === 'checkbox' || e.target.tagName === 'INPUT')) return;
          ShColMgr.sortBy(th._shColId, th._shColKey);
        });
        th._shSortBound = true;
      } else {
        // Update key in case column moved
      }

      // Th drag-and-drop
      if (!col.fixed) {
        th.setAttribute('draggable', 'true');
        th._shDragIdx = i;
        if (!th._shDragBound) {
          th.addEventListener('dragstart', function(e) {
            _dragSrcTh = { id: th._shColId, idx: th._shDragIdx };
            th.classList.add('sh-th-dragging');
            e.dataTransfer.effectAllowed = 'move';
          });
          th.addEventListener('dragover', function(e) {
            e.preventDefault();
            th.classList.add('sh-th-drag-over');
          });
          th.addEventListener('dragleave', function() {
            th.classList.remove('sh-th-drag-over');
          });
          th.addEventListener('drop', function(e) {
            e.preventDefault();
            th.classList.remove('sh-th-drag-over');
            if (!_dragSrcTh || _dragSrcTh.id !== th._shColId) return;
            var fromIdx = _dragSrcTh.idx;
            var toIdx = th._shDragIdx;
            if (fromIdx === toIdx) return;
            var reg = _reg[th._shColId]; if (!reg) return;
            var vc = ShColMgr.visCols(th._shColId);
            var fromCol = vc[fromIdx], toCol = vc[toIdx];
            if (!fromCol || !toCol) return;
            var arr = reg.state.cols;
            var fi = arr.findIndex(function(c) { return c.key === fromCol.key; });
            var ti = arr.findIndex(function(c) { return c.key === toCol.key; });
            if (fi < 0 || ti < 0) return;
            var item = arr.splice(fi, 1)[0];
            arr.splice(ti, 0, item);
            _save(th._shColId);
            _triggerReRender(th._shColId);
          });
          th.addEventListener('dragend', function() {
            th.classList.remove('sh-th-dragging');
            _dragSrcTh = null;
          });
          th._shDragBound = true;
        }
      } else {
        th.removeAttribute('draggable');
      }
    });
  };

  ShColMgr.reset = function(id) {
    var r = _reg[id]; if (!r) return;
    try { localStorage.removeItem('sh_cm_' + id); } catch(e) {}
    r.state = _defaultState(r.config);
    _triggerReRender(id);
  };

  /* ── Panel interactions ────────────────────────────────────── */
  ShColMgr._togglePanel = function(id) {
    var panel = document.getElementById('sh-cm-panel-' + id);
    var btn = document.getElementById('sh-cm-cols-' + id);
    if (!panel) return;
    var isOpen = panel.style.display !== 'none';
    _closeAll(isOpen ? null : id);
    if (isOpen) {
      panel.style.display = 'none';
      if (btn) btn.classList.remove('sh-cm-btn-active');
    } else {
      _renderPanel(id);
      panel.style.display = 'block';
      if (btn) btn.classList.add('sh-cm-btn-active');
    }
  };

  ShColMgr._toggleExport = function(id) {
    var menu = document.getElementById('sh-cm-exp-' + id);
    var btn = document.getElementById('sh-cm-exp-btn-' + id);
    if (!menu) return;
    var isOpen = menu.style.display !== 'none';
    _closeAll(isOpen ? null : id);
    if (isOpen) {
      menu.style.display = 'none';
      if (btn) btn.classList.remove('sh-cm-btn-active');
    } else {
      menu.style.display = 'block';
      if (btn) btn.classList.add('sh-cm-btn-active');
    }
  };

  ShColMgr._toggleCol = function(id, key) {
    var r = _reg[id]; if (!r) return;
    var col = r.state.cols.find(function(c) { return c.key === key; });
    if (!col || col.fixed) return;
    col.visible = !col.visible;
    _save(id);
    _renderPanel(id);
    _triggerReRender(id);
  };

  ShColMgr._panelDragStart = function(e, id, idx) {
    _dragSrcPanel = { id: id, idx: idx };
    e.dataTransfer.effectAllowed = 'move';
    if (e.currentTarget) e.currentTarget.classList.add('sh-cm-dragging');
  };

  ShColMgr._panelDragOver = function(e, id, idx) {
    e.preventDefault();
    if (e.currentTarget) e.currentTarget.classList.add('sh-cm-drag-over');
  };

  ShColMgr._panelDrop = function(e, id, toIdx) {
    e.preventDefault();
    if (e.currentTarget) e.currentTarget.classList.remove('sh-cm-drag-over');
    if (!_dragSrcPanel || _dragSrcPanel.id !== id) return;
    var fromIdx = _dragSrcPanel.idx;
    if (fromIdx === toIdx) return;
    var r = _reg[id]; if (!r) return;
    var arr = r.state.cols;
    var item = arr.splice(fromIdx, 1)[0];
    arr.splice(toIdx, 0, item);
    _save(id);
    _renderPanel(id);
    _triggerReRender(id);
  };

  ShColMgr._panelDragEnd = function() {
    _dragSrcPanel = null;
    document.querySelectorAll('.sh-cm-dragging').forEach(function(el) { el.classList.remove('sh-cm-dragging'); });
    document.querySelectorAll('.sh-cm-drag-over').forEach(function(el) { el.classList.remove('sh-cm-drag-over'); });
  };

  /* ── CSV export ────────────────────────────────────────────── */
  ShColMgr._exportCSV = async function(id, scope) {
    var r = _reg[id]; if (!r) return;
    var rows = scope === 'page' ? r.config.pageRowsFn() : r.config.allRowsFns ? r.config.allRowsFns() : r.config.allRowsFn();
    var vc = ShColMgr.visCols(id);

    function fmtCell(row, col) {
      if (r.config.csvCellFn) { var v2 = r.config.csvCellFn(row, col); if (v2 !== null && v2 !== undefined) return String(v2); }
      var v = row[col.key];
      if (v === null || v === undefined) return '';
      if (col.type === 'date') { var p = String(v).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(v); }
      return String(v);
    }

    function esc(s) { s = String(s); return /[;\n\r"]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }

    var lines = [vc.map(function(c) { return esc(c.label); }).join(';')];
    rows.forEach(function(row) { lines.push(vc.map(function(c) { return esc(fmtCell(row, c)); }).join(';')); });

    var content = '﻿' + lines.join('\r\n');
    var today = new Date().toISOString().slice(0, 10);
    var filename = id.replace(/_/g, '-') + '_' + today + (scope === 'page' ? '_pagina' : '') + '.csv';

    var em = document.getElementById('sh-cm-exp-' + id); if (em) em.style.display = 'none';
    var eb = document.getElementById('sh-cm-exp-btn-' + id); if (eb) eb.classList.remove('sh-cm-btn-active');

    try {
      var dl = window.claude ? await window.claude.use('downloads') : null;
      if (dl) { await dl.save({ filename: filename, data: content }); return; }
    } catch(e) {}

    var blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
  };

  /* ── Close panels on outside click ────────────────────────── */
  document.addEventListener('click', function(e) {
    var el = e.target;
    while (el) {
      if (el.classList && el.classList.contains('sh-cm-controls')) return;
      el = el.parentElement;
    }
    _closeAll(null);
  });

  global.ShColMgr = ShColMgr;

})(window);
