/* ══ Feature flags de entrega — features.js ════════════════════════════════
   Cada pacote de evolução (AV-xx) chega ao app atrás de flags e entra no
   master sozinho, depois de aprovado no ambiente de avaliação. O pacote se
   registra no topo do próprio arquivo, com o estado de cada flag:
     avaliacao  liga só no ambiente de avaliação e no servidor local
     aprovada   liga em todo ambiente — entrou no app depois da aprovação
     rejeitada  desliga em todo ambiente
   O estado é reescrito por tools/avaliacao.py promover, a partir das decisões
   de tools/avaliacao-features.json. Não se edita à mão.
   São duas camadas: a entrega (esta) decide se o recurso existe no ambiente;
   a organização (planos e exceções do backoffice, quando presente) decide,
   dentro do que a entrega liberou, quem usa.
   No ambiente de avaliação o avaliador desliga uma flag no painel da faixa,
   para ver o app sem ela. Vale só no navegador dele.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var PACOTES = {}, FLAGS = {}, ALVOS = {}, porOrg = null;
  var CHAVE = 'sh-ff-off';

  function ambiente() {
    if (window.SH_AMBIENTE) return window.SH_AMBIENTE;
    var h = location.hostname;
    if (location.protocol === 'file:' || h === 'localhost' || h === '127.0.0.1' || h === '[::1]') return 'local';
    return 'app';
  }
  function desligadasAqui() {
    if (ambiente() === 'app') return [];
    try { return JSON.parse(localStorage.getItem(CHAVE) || '[]'); } catch (e) { return []; }
  }

  function registrar(p) {
    PACOTES[p.id] = p;
    Object.keys(p.flags || {}).forEach(function (k) { FLAGS[k] = { pacote: p.id, estado: p.flags[k] }; });
    alvos(p.alvos || {});
  }
  function alvos(mapa) {
    Object.keys(mapa).forEach(function (k) {
      ALVOS[k] = ALVOS[k] || [];
      mapa[k].forEach(function (s) { if (ALVOS[k].indexOf(s) < 0) ALVOS[k].push(s); });
    });
  }
  // a entrega: flag fora do registro é de módulo que já está no app
  function entrega(k) {
    var f = FLAGS[k];
    if (!f) return true;
    if (f.estado === 'rejeitada') return false;
    if (desligadasAqui().indexOf(k) >= 0) return false;
    return f.estado === 'aprovada' || ambiente() !== 'app';
  }
  function ligada(k) {
    if (!entrega(k)) return false;
    if (porOrg) { try { return porOrg(k) !== false; } catch (e) { return true; } }
    return true;
  }
  function aplicar() {
    Object.keys(ALVOS).forEach(function (k) {
      var on = ligada(k);
      ALVOS[k].forEach(function (s) {
        document.querySelectorAll(s).forEach(function (el) {
          if (on) { if (el.getAttribute('data-ff-off')) { el.style.display = ''; el.removeAttribute('data-ff-off'); } }
          else if (!el.getAttribute('data-ff-off')) { el.style.display = 'none'; el.setAttribute('data-ff-off', k); }
        });
      });
    });
  }

  /* ── Painel do avaliador ──────────────────────────────────────────────── */
  var ROT = { avaliacao: ['em avaliação', 'amber'], aprovada: ['aprovada', 'teal'], rejeitada: ['rejeitada', 'red'] };
  var AMB = { avaliacao: 'ambiente de avaliação', local: 'servidor local', app: 'app' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function painel() {
    var id = 'ff-painel-ov', old = document.getElementById(id); if (old) old.remove();
    var off = desligadasAqui(), muda = ambiente() !== 'app';
    var corpo = Object.keys(PACOTES).map(function (pid) {
      var p = PACOTES[pid];
      var abrir = p.entrada && entrega(Object.keys(p.flags)[0]) ? ' · <a class="ff-link" href="' + esc(p.entrada) + '" onclick="document.getElementById(\'' + id + '\').remove()">abrir</a>' : '';
      return '<div class="ff-pac"><div class="ff-pac-h"><b>' + esc(p.id) + ' · ' + esc(p.nome) + '</b><span class="ff-sub">branch ' + esc(p.branch || '—') + abrir + '</span></div>'
        + Object.keys(p.flags).map(function (k) {
          var e = p.flags[k], r = ROT[e] || [e, 'amber'], on = entrega(k);
          return '<label class="ff-fl"><input type="checkbox" data-ff="' + esc(k) + '"' + (on ? ' checked' : '') + (muda && e !== 'rejeitada' ? '' : ' disabled') + '>'
            + '<span class="ff-min0"><span class="ff-mono">' + esc(k) + '</span>' + ((p.rotulos || {})[k] ? '<span class="ff-sub">' + esc(p.rotulos[k]) + '</span>' : '') + '</span>'
            + '<span class="ff-chip ' + r[1] + '">' + esc(r[0]) + '</span></label>';
        }).join('') + '</div>';
    }).join('') || '<p class="ff-sub">Nenhum pacote registrado neste ambiente.</p>';
    document.body.insertAdjacentHTML('beforeend', '<div id="' + id + '" class="moverlay" onclick="if(event.target===this)this.remove()">'
      + '<div class="mbox ff-mbox" role="dialog" aria-modal="true" aria-labelledby="' + id + '-t">'
      + '<div class="mbox-hdr"><div class="ff-min0"><div class="mbox-title" id="' + id + '-t">Features em avaliação</div><div class="mbox-sub">' + esc(AMB[ambiente()] || ambiente()) + (off.length ? ' · ' + off.length + ' desligada' + (off.length > 1 ? 's' : '') + ' neste navegador' : '') + '</div></div>'
      + '<button class="mbox-close" aria-label="Fechar" onclick="document.getElementById(\'' + id + '\').remove()">✕</button></div>'
      + '<div class="mbox-col">' + (muda ? '<p class="ff-p">Desmarque para ver o app sem a feature. Vale só neste navegador; o app recarrega ao aplicar.</p>' : '<p class="ff-p">No app só ficam ligadas as features aprovadas.</p>') + corpo + '</div>'
      + '<div class="ff-rodape"><a class="ff-link" href="https://split-hubhq.github.io/app/docs/relatorio-avaliacao.html" target="_blank" rel="noopener">Relatório de avaliação</a>'
      + (muda ? '<button class="btn" onclick="shFeature._todas()">Ligar todas</button><button class="btn btn-t" onclick="shFeature._aplicarPainel()">Aplicar</button>' : '') + '</div></div></div>');
  }
  function gravar(lista) { try { localStorage.setItem(CHAVE, JSON.stringify(lista)); } catch (e) {} location.reload(); }
  function _aplicarPainel() {
    var off = [];
    document.querySelectorAll('#ff-painel-ov input[data-ff]').forEach(function (c) { if (!c.checked && !c.disabled) off.push(c.getAttribute('data-ff')); });
    gravar(off);
  }

  window.shFeature = {
    registrar: registrar, alvos: alvos, entrega: entrega, ligada: ligada, aplicar: aplicar, ambiente: ambiente,
    porOrganizacao: function (fn) { porOrg = fn; aplicar(); },
    pacotes: function () { return PACOTES; }, estado: function (k) { return FLAGS[k] ? FLAGS[k].estado : null; },
    painel: painel, _aplicarPainel: _aplicarPainel, _todas: function () { gravar([]); }
  };
  // o botão escondido também não abre a tela: rota, link ou clique programado param aqui
  function bloqueado(btn) {
    var k = btn && btn.getAttribute && btn.getAttribute('data-ff-off');
    if (!k) return false;
    var t = document.getElementById('ff-toast'); if (t) t.remove();
    t = document.createElement('div'); t.id = 'ff-toast'; t.className = 'ff-toast'; t.setAttribute('role', 'status');
    t.textContent = entrega(k) ? 'Recurso não liberado para esta organização.' : 'Recurso ainda em avaliação: não liberado neste ambiente.';
    document.body.appendChild(t); setTimeout(function () { if (t.parentNode) t.remove(); }, 4000);
    return true;
  }
  function guardar(nome) {
    var fn = window[nome]; if (typeof fn !== 'function' || fn._ff) return;
    window[nome] = function (id, btn) {
      if (bloqueado(btn)) return;
      var r = fn.apply(this, arguments); setTimeout(aplicar, 120); return r;
    };
    window[nome]._ff = true;
  }
  // telas que montam alvos depois da carga (cards do Início, submenus) pedem nova passada
  function inicio() {
    aplicar();
    guardar('showView'); guardar('showAdminSub');
    window.addEventListener('hashchange', function () { setTimeout(aplicar, 300); });
    setTimeout(aplicar, 2500);
    if (/[?&]ff\b/.test(location.search)) painel();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(inicio, 250); });
  else setTimeout(inicio, 250);
})();
