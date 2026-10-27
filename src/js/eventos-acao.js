/* ══ Evento fiscal e nota de ajuste como ação da inconsistência ══════════════
   Implementa a proposta aprovada em 27/10/2026 (v1.4, 25 de 25 decisões):
     · as 18 opções — 16 eventos da NT 2025.002-RTC e as notas de crédito e de
       débito — na inconsistência, com a sugestão em destaque, e no documento
     · a autoria pela norma decide o caminho: comando, pedido ao autor ou só o
       órgão (D-03, D-18)
     · dois modos por CNPJ: pelo ERP, por webhook, ou direto na SEFAZ, com a
       credencial e-CNPJ A1 (D-01, D-20 a D-24); notas sempre pelo ERP (D-21)
     · sem aprovador por ora (D-04, D-17)
     · atributo vale na autorização; valor no reflexo do órgão de cada tributo
       (D-05); ajuste imutável, revertido só pelo 110001 (D-10, D-11)
     · qualidade de serviço por ator (D-09, D-25)
   Tudo simulado (D-12): webhook, ERP, SEFAZ e o reflexo da Receita Federal e
   do Comitê Gestor. O estado vive em memória, como em usuarios.js.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fechar(id) { var e = document.getElementById(id); if (e) e.remove(); }
  function money(v) { return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function agora() { return new Date(); }
  function fmtDH(d) {
    var x = new Date(d);
    return ('0' + x.getDate()).slice(-2) + '/' + ('0' + (x.getMonth() + 1)).slice(-2) + ' ' + ('0' + x.getHours()).slice(-2) + ':' + ('0' + x.getMinutes()).slice(-2);
  }
  function usuario() {
    try { var u = window._usuState && window._usuState.usuarios[0]; if (u) return u.nome; } catch (e) {}
    return 'José da Silva';
  }
  function toast(msg, erro) {
    fechar('evf-toast');
    var t = document.createElement('div');
    t.id = 'evf-toast';
    t.className = 'evf-toast' + (erro ? ' erro' : '');
    t.setAttribute('role', 'status');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.remove(); }, 4500);
  }
  function overlay(id, largura, miolo) {
    fechar(id);
    document.body.insertAdjacentHTML('beforeend',
      '<div id="' + id + '" class="moverlay evf-ov" onclick="if(event.target===this)this.remove()">'
      + '<div class="mbox evf-mbox" style="--evf-w:' + largura + 'px" role="dialog" aria-modal="true" aria-labelledby="' + id + '-t">' + miolo + '</div></div>');
  }
  function cab(id, icone, titulo, sub) {
    return '<div class="mbox-hdr"><div class="evf-hdr-l"><div class="mbox-icon blue">' + icone + '</div><div class="evf-min0">'
      + '<div class="mbox-title" id="' + id + '-t">' + titulo + '</div><div class="mbox-sub">' + sub + '</div></div></div>'
      + '<button class="mbox-close" aria-label="Fechar" onclick="document.getElementById(\'' + id + '\').remove()">✕</button></div>';
  }

  /* ── Catálogo: os 16 eventos e as 2 notas ─────────────────────────────── */
  // autor: emitente | destinatario | emit_dest | sucessora | fisco | autor_evento
  // efeito: valor | atributo | titularidade | reversao
  var CAT = [
    { cod: '211110', nome: 'Solicitação de apropriação de crédito presumido', curto: 'Crédito presumido', autor: 'emit_dest', efeito: 'valor', item: true, campo: 'Crédito presumido do item' },
    { cod: '211124', nome: 'Perecimento, perda, roubo ou furto — transporte FOB', curto: 'Perecimento FOB', autor: 'destinatario', efeito: 'valor', item: true, campo: 'Crédito estornado do item' },
    { cod: '211128', nome: 'Aceite de débito por emissão de nota de crédito', curto: 'Aceite de nota de crédito', autor: 'destinatario', efeito: 'valor', item: false, campo: 'Crédito' },
    { cod: '211130', nome: 'Imobilização de item', curto: 'Imobilização de item', autor: 'destinatario', efeito: 'atributo', item: true, attr: ['não imobilizado', 'imobilizado'] },
    { cod: '211140', nome: 'Apropriação de crédito de combustível', curto: 'Crédito de combustível', autor: 'destinatario', efeito: 'valor', item: true, campo: 'Crédito do consumo' },
    { cod: '211150', nome: 'Apropriação de crédito de bens e serviços vinculados à atividade', curto: 'Crédito vinculado à atividade', autor: 'destinatario', efeito: 'valor', item: true, campo: 'Crédito condicionado' },
    { cod: '112110', nome: 'Informação de efetivo pagamento integral', curto: 'Pagamento integral', autor: 'emitente', efeito: 'atributo', item: false, attr: ['não informado', 'pagamento integral informado'] },
    { cod: '112120', nome: 'Importação em ALC/ZFM não convertida em isenção', curto: 'ALC/ZFM não convertida em isenção', autor: 'emitente', efeito: 'valor', item: true, campo: 'Tributo do item' },
    { cod: '112130', nome: 'Perecimento, perda, roubo ou furto — transporte CIF', curto: 'Perecimento CIF', autor: 'emitente', efeito: 'valor', item: true, campo: 'Valor estornado do item' },
    { cod: '112140', nome: 'Fornecimento não realizado com pagamento antecipado', curto: 'Fornecimento não realizado', autor: 'emitente', efeito: 'valor', item: true, campo: 'Valor do não fornecido' },
    { cod: '112150', nome: 'Atualização da data de previsão de entrega', curto: 'Nova previsão de entrega', autor: 'emitente', efeito: 'atributo', item: false, attr: ['previsão anterior', 'nova previsão de entrega'] },
    { cod: '212110', nome: 'Manifestação sobre transferência de crédito de IBS por sucessão', curto: 'Sucessão — IBS', autor: 'sucessora', efeito: 'titularidade', item: false },
    { cod: '212120', nome: 'Manifestação sobre transferência de crédito de CBS por sucessão', curto: 'Sucessão — CBS', autor: 'sucessora', efeito: 'titularidade', item: false },
    { cod: '412120', nome: 'Manifestação do Fisco sobre a transferência — IBS', curto: 'Manifestação do Comitê Gestor', autor: 'fisco', efeito: 'titularidade', item: false },
    { cod: '412130', nome: 'Manifestação do Fisco sobre a transferência — CBS', curto: 'Manifestação da Receita Federal', autor: 'fisco', efeito: 'titularidade', item: false },
    { cod: '110001', nome: 'Cancelamento de evento', curto: 'Cancelamento de evento', autor: 'autor_evento', efeito: 'reversao', item: false },
    { cod: 'NC', nome: 'Nota de crédito — tipo 04', curto: 'Nota de crédito', autor: 'emitente', efeito: 'valor', item: false, nota: true, campo: 'Valor por tributo' },
    { cod: 'ND', nome: 'Nota de débito — tipo 06', curto: 'Nota de débito', autor: 'cliente', efeito: 'valor', item: false, nota: true, campo: 'Valor por tributo' }
  ];
  function op(cod) { return CAT.filter(function (o) { return o.cod === cod; })[0]; }
  var AUTOR_ROT = { emitente: 'Emitente', destinatario: 'Destinatário', emit_dest: 'Emitente ou destinatário', sucessora: 'Empresa sucessora', fisco: 'Órgão', autor_evento: 'Autor do evento cancelado', cliente: 'O cliente' };

  /* ── Estado ───────────────────────────────────────────────────────────── */
  var ST = window._evfState = {
    seq: 0, solic: [], ajustes: [], hist: {}, entregas: [], trilhaCfg: [],
    modo: {},             // cnpj -> 'erp' | 'direto'
    credenciais: [],      // {id, titular, cnpj, validoAte, ambiente, cnpjs[], cadastradoPor, em}
    termo: null,          // {por, em}
    qos: [
      { k: 'cliente', rot: 'Sistema do cliente — ERP ou sistema fiscal', tempo: '30 s', ret: '10, dobrando a partir de 1 min', aviso: '24 h sem retorno', inc: '72 h', pausa: '72 h sem entrega', ultimo: 'há 5 min', prazo: '99%' },
      { k: 'psp', rot: 'PSP — prestador de serviço de pagamento', tempo: '30 s', ret: '5, dobrando a partir de 1 min', aviso: '24 h sem confirmação', inc: '72 h', pausa: '72 h sem entrega', ultimo: 'há 2 h', prazo: '98%' },
      { k: 'rfb', rot: 'Receita Federal — CBS', tempo: '60 s', ret: '3, a cada 1 h', aviso: '1 dia sem leitura', inc: '3 dias', pausa: '—', ultimo: 'hoje 06:00', prazo: '100%' },
      { k: 'cg', rot: 'Comitê Gestor — IBS', tempo: '— o Comitê Gestor envia', ret: '— quem reenvia é o Comitê Gestor', aviso: '1 dia sem arquivo', inc: '3 dias', pausa: '—', ultimo: 'hoje 06:00', prazo: '97%' },
      { k: 'sefaz', rot: 'SEFAZ — SVRS, só no modo direto', tempo: '30 s', ret: '5, a cada 5 min', aviso: '24 h na fila', inc: '72 h', pausa: '—', ultimo: 'há 1 h', prazo: '100%' }
    ]
  };
  function nid(p) { ST.seq += 1; return p + ('000' + ST.seq).slice(-4); }
  function cfgLog(acao, det) { ST.trilhaCfg.unshift({ em: agora(), por: usuario(), acao: acao, det: det || '' }); }

  function orgCnpjs() { return (window._orgCnpjs || []).filter(function (c) { return c.status === 'ativo'; }); }
  function semear() {
    if (ST._ok) return; ST._ok = true;
    orgCnpjs().forEach(function (c) { ST.modo[c.cnpj] = 'erp'; });
    var m = orgCnpjs()[0];
    if (m) {
      ST.credenciais.push({ id: 'CR-01', titular: m.razao, cnpj: m.cnpj, validoAte: '15/08/2027', ambiente: 'Homologação',
        cnpjs: orgCnpjs().filter(function (c) { return c.cnpj.slice(0, 10) === m.cnpj.slice(0, 10); }).map(function (c) { return c.cnpj; }),
        cadastradoPor: 'Implantação', em: new Date(agora().getTime() - 86400000 * 10) });
    }
  }

  /* ── Documento, papel do cliente e caminho ───────────────────────────── */
  function nfPorNumero(n) { return (window.nfListaFiltradaGlobal || []).filter(function (x) { return x.numero === n; })[0] || null; }
  function papel(nf) { return nf && nf.tipo === 'saida' ? 'emitente' : 'destinatario'; }
  function autorCnpj(nf) { return (nf && nf.cnpjComprador) || ((orgCnpjs()[0] || {}).cnpj) || ''; }
  // caminho: cmd (comando — pelo ERP ou direto) | pedido | orgao
  function caminho(o, nf) {
    var p = papel(nf);
    if (o.autor === 'fisco') return { k: 'orgao', rot: 'Só o órgão', cls: 'gray', quem: o.cod === '412120' ? 'Comitê Gestor' : 'Receita Federal' };
    if (o.cod === 'ND' || o.autor === 'cliente') return { k: 'cmd', rot: 'Comando ao ERP', cls: 'teal', quem: 'o cliente' };
    if (o.autor === 'emit_dest' || o.autor === 'sucessora' || o.autor === 'autor_evento') return modoRot(o, nf, 'o cliente');
    if (o.autor === p) return modoRot(o, nf, 'o cliente');
    return { k: 'pedido', rot: p === 'destinatario' ? 'Pedido ao fornecedor' : 'Pedido ao destinatário', cls: 'amber', quem: p === 'destinatario' ? 'o fornecedor' : 'o destinatário' };
  }
  function modoDe(nf) { return ST.modo[autorCnpj(nf)] || 'erp'; }
  function modoRot(o, nf, quem) {
    var direto = !o.nota && modoDe(nf) === 'direto';
    return { k: 'cmd', modo: direto ? 'direto' : 'erp', rot: direto ? 'Direto na SEFAZ' : 'Comando ao ERP', cls: direto ? 'blue' : 'teal', quem: quem };
  }

  /* ── Sugestão pela inconsistência ─────────────────────────────────────── */
  function sugestao(inc, nf) {
    var t = inc && inc.tipo, sai = nf && nf.tipo === 'saida';
    var S = {
      capur_ibs_divergente: sai ? ['NC', 'O IBS destacado na venda não bate com o apurado: a nota de crédito corrige o destaque a maior.'] : ['211128', 'O fornecedor emitiu nota de crédito e o Comitê Gestor já apurou o valor menor; falta o aceite.'],
      capur_cbs_divergente: sai ? ['NC', 'A CBS destacada na venda não bate com a apurada: a nota de crédito corrige o destaque a maior.'] : ['211128', 'O fornecedor emitiu nota de crédito e a Receita Federal já apurou o valor menor; falta o aceite.'],
      capur_ibs_aliquota: sai ? ['NC', 'Alíquota de IBS errada na venda: a nota de crédito corrige o destaque indevido.'] : ['NC', 'A alíquota de IBS está errada na nota do fornecedor: o ajuste é a nota de crédito dele.'],
      capur_cbs_aliquota: sai ? ['NC', 'Alíquota de CBS errada na venda: a nota de crédito corrige o destaque indevido.'] : ['NC', 'A alíquota de CBS está errada na nota do fornecedor: o ajuste é a nota de crédito dele.'],
      apur_df_sem_registro: sai ? ['112150', 'O documento de venda não aparece na apuração: se a entrega foi adiada, a nova previsão desloca a competência.'] : null,
      mov_orgao_sem_contrapartida: ['110001', 'O órgão registrou um movimento sem par no SplitHub: se veio de um evento do cliente registrado por engano, o cancelamento desfaz.'],
      prazo_expirado: sai ? ['112150', 'A previsão de entrega ficou desatualizada.'] : null,
      reconhecido_diferente_pago: sai ? ['112110', 'O cliente recebeu o pagamento integral e não informou.'] : null
    };
    var r = S[t];
    return r ? { cod: r[0], motivo: r[1] } : null;
  }

  /* ── Bloco no card da inconsistência ──────────────────────────────────── */
  function incPorId(id) { return (window._inconsistenciasGlobal || []).filter(function (i) { return i.id === id; })[0] || null; }
  function blocoCard(incId) {
    var inc = incPorId(incId); if (!inc) return '';
    var nf = nfPorNumero(inc.nfNumero), sg = sugestao(inc, nf), o = sg && op(sg.cod);
    var abertas = ST.solic.filter(function (s) { return s.incId === incId; });
    var h = '<div class="evf-card"><div class="evf-card-t">Evento fiscal ou nota</div>';
    if (o) {
      var c = caminho(o, nf);
      h += '<div class="evf-sug"><div class="evf-sug-h"><span class="evf-cod">' + esc(o.cod === 'NC' || o.cod === 'ND' ? o.cod : o.cod) + '</span> ' + esc(o.curto)
        + ' <span class="evf-chip teal">sugerido</span> <span class="evf-chip ' + c.cls + '">' + esc(c.rot) + '</span></div>'
        + '<div class="evf-sug-m">' + esc(sg.motivo) + '</div>'
        + '<button class="btn btn-t evf-btn-sm" onclick="shEvf.preparar(\'' + inc.nfNumero + '\',\'' + o.cod + '\',\'' + incId + '\',true)">Preparar o sugerido</button></div>';
    } else {
      h += '<div class="evf-sug evf-sem">Sem sugestão de evento para esta inconsistência. Todas as opções seguem disponíveis.</div>';
    }
    h += '<button class="btn evf-btn-sm evf-w100" onclick="shEvf.opcoes(\'' + inc.nfNumero + '\',\'' + incId + '\')">Ver todas as opções · ' + CAT.length + '</button>';
    if (abertas.length) h += '<div class="evf-mini">' + abertas.map(function (s) { return linhaSolic(s); }).join('') + '</div>';
    return h + '</div>';
  }
  function linhaSolic(s) {
    var o = op(s.cod);
    return '<button class="evf-mini-l" onclick="shEvf.acompanhar(\'' + s.id + '\')"><span class="evf-cod">' + esc(s.cod) + '</span> ' + esc(o ? o.curto : '')
      + ' <span class="evf-chip ' + SIT[s.sit].cls + '">' + esc(SIT[s.sit].rot) + '</span></button>';
  }

  /* ── Todas as opções ──────────────────────────────────────────────────── */
  function opcoes(nfNum, incId) {
    var nf = nfPorNumero(nfNum); if (!nf) return;
    var inc = incId ? incPorId(incId) : null, sg = inc ? sugestao(inc, nf) : null;
    var lista = CAT.slice();
    if (sg) lista.sort(function (a, b) { return (b.cod === sg.cod) - (a.cod === sg.cod); });
    var id = 'evf-op-ov';
    overlay(id, 760, cab(id, '⚑', 'Evento fiscal ou nota', 'NF-e ' + esc(nf.numero) + ' · o cliente é o ' + (papel(nf) === 'emitente' ? 'emitente' : 'destinatário') + (inc ? ' · ' + esc(inc.id) : ' · sem inconsistência'))
      + '<div class="mbox-col evf-col">'
      + '<p class="evf-p">Todas as opções aparecem. A norma diz quem registra cada uma, e isso decide o caminho: comando, pedido ao autor ou só o órgão.' + (sg ? ' Escolher fora da sugestão pede justificativa.' : ' Sem inconsistência, a justificativa é obrigatória.') + '</p>'
      + '<div class="evf-tw"><table class="evf-t"><thead><tr><th>Código</th><th>Evento ou nota</th><th>Quem registra</th><th>Caminho</th><th></th></tr></thead><tbody>'
      + lista.map(function (o) {
        var c = caminho(o, nf), su = sg && sg.cod === o.cod;
        return '<tr' + (su ? ' class="evf-tr-sug"' : '') + '><td class="evf-cod">' + esc(o.cod) + '</td><td>' + esc(o.curto) + (su ? ' <span class="evf-chip teal">sugerido</span>' : '') + '</td>'
          + '<td>' + esc(AUTOR_ROT[o.autor]) + '</td><td><span class="evf-chip ' + c.cls + '">' + esc(c.rot) + '</span></td>'
          + '<td class="r">' + (c.k === 'orgao' ? '<span class="evf-sub">chega pela importação</span>'
            : '<button class="btn evf-btn-sm" onclick="shEvf.preparar(\'' + nf.numero + '\',\'' + o.cod + '\',\'' + (incId || '') + '\',' + (su ? 'true' : 'false') + ')">' + (c.k === 'pedido' ? 'Pedir' : 'Preparar') + '</button>') + '</td></tr>';
      }).join('') + '</tbody></table></div></div>'
      + '<div class="evf-rodape"><button class="btn" onclick="document.getElementById(\'' + id + '\').remove()">Fechar</button></div>');
  }

  /* ── Formulário com a prévia ─────────────────────────────────────────── */
  function rfs(nf) { return (nf.registrosFiscais || []).slice().sort(function (a, b) { return a.tipoFiscal === 'cbs' ? -1 : 1; }); }
  function preparar(nfNum, cod, incId, sugerido) {
    var nf = nfPorNumero(nfNum), o = op(cod); if (!nf || !o) return;
    fechar('evf-op-ov');
    var inc = incId ? incPorId(incId) : null, c = caminho(o, nf), id = 'evf-form-ov';
    var precisaJust = !inc || !sugerido;
    var corpo = '';
    if (c.k === 'pedido') {
      corpo = '<p class="evf-p">' + esc(o.nome) + ' é registrado pelo <strong>' + esc(AUTOR_ROT[o.autor].toLowerCase()) + '</strong>. O SplitHub não pode emitir em nome dele: o pedido vai a ' + esc(c.quem) + ', e '
        + (inc ? 'o chamado fica em <em>aguardando emitente</em>, com o evento esperado.' : 'fica registrado no documento.') + '</p>'
        + campo('evf-just', 'Mensagem ao autor', 'textarea', 'O que se espera e por quê', true);
    } else {
      corpo = '<div class="evf-kv"><span>Chave de acesso</span><b class="evf-mono">' + esc(nf.chaveDF || '—') + '</b></div>'
        + '<div class="evf-kv"><span>Autor</span><b>' + esc(autorCnpj(nf)) + ' · ' + (papel(nf) === 'emitente' ? 'emitente' : 'destinatário') + '</b></div>'
        + '<div class="evf-kv"><span>Caminho</span><b><span class="evf-chip ' + c.cls + '">' + esc(c.rot) + '</span></b></div>'
        + (o.item ? campo('evf-item', 'Número do item, conferido com o XML', 'text', 'ex.: 2', false) : '')
        + camposEspecificos(o, nf, inc)
        + '<div id="evf-previa"></div>'
        + campo('evf-just', 'Justificativa' + (precisaJust ? ' — obrigatória' : ''), 'textarea', precisaJust ? (inc ? 'Por que esta opção, e não a sugerida' : 'Por que emitir sem inconsistência') : 'Opcional', false)
        + (c.modo === 'direto' || c.modo === 'erp' ? '<label class="evf-chk"><input type="checkbox" id="evf-rej"> Simular rejeição do autorizador — só no protótipo</label>' : '');
    }
    overlay(id, 600, cab(id, c.k === 'pedido' ? '✉' : (o.nota ? '🧾' : '⚑'), esc(o.cod) + ' · ' + esc(o.curto), 'NF-e ' + esc(nf.numero) + (inc ? ' · ' + esc(inc.id) : ' · pedido no documento'))
      + '<div class="mbox-col evf-col">' + corpo + '</div>'
      + '<div class="evf-rodape"><span id="evf-form-st" class="evf-rodape-st"></span><button class="btn" onclick="document.getElementById(\'' + id + '\').remove()">Cancelar</button>'
      + '<button class="btn btn-t" onclick="shEvf.solicitar(\'' + nf.numero + '\',\'' + o.cod + '\',\'' + (incId || '') + '\',' + (precisaJust ? 'true' : 'false') + ')">'
      + (c.k === 'pedido' ? 'Enviar pedido' : (o.nota ? 'Comandar ao ERP' : (c.modo === 'direto' ? 'Transmitir à SEFAZ' : 'Solicitar ao ERP'))) + '</button></div>');
    previa(nf.numero, o.cod);
  }
  function campo(id, rot, tipo, ph, req) {
    var el = tipo === 'textarea'
      ? '<textarea id="' + id + '" class="evf-in" rows="2" placeholder="' + esc(ph) + '"></textarea>'
      : '<input id="' + id + '" class="evf-in" type="text" placeholder="' + esc(ph) + '">';
    return '<div class="evf-campo"><label for="' + id + '">' + esc(rot) + '</label>' + el + '</div>';
  }
  // valores sugeridos: com inconsistência, a divergência no tributo dela e zero no outro;
  // sem inconsistência, 10% de cada tributo, para o analista corrigir
  function valoresSugeridos(nf, inc) {
    var v = {}, t0 = inc && String(inc.tipoFiscal || '').toUpperCase();
    rfs(nf).forEach(function (rf) {
      var t = rf.tipoFiscal.toUpperCase();
      if (t0 === 'IBS' || t0 === 'CBS') v[t] = t === t0 ? Number(inc.valor || 0) : 0;
      else v[t] = Math.round((rf.valor || 0) * 0.1);
    });
    return v;
  }
  function camposEspecificos(o, nf, inc) {
    if (o.efeito === 'valor') {
      var v = valoresSugeridos(nf, inc);
      return '<div class="evf-campo"><label>' + esc(o.campo) + ' — por tributo</label><div class="evf-duo">'
        + Object.keys(v).map(function (t) {
          return '<div class="evf-duo-i"><span class="evf-trib">' + t + '</span><input id="evf-v-' + t + '" class="evf-in" type="text" inputmode="decimal" value="' + Number(v[t]).toFixed(2).replace('.', ',') + '" oninput="shEvf.previa(\'' + nf.numero + '\',\'' + o.cod + '\')"></div>';
        }).join('') + '</div><div class="evf-sub">Valor em reais que o ajuste reduz' + (o.cod === 'ND' || o.cod === '112120' ? ' — na nota de débito e no 112120, que aumenta' : '') + '.</div></div>';
    }
    if (o.cod === '112150') return campo('evf-attr', 'Nova data de previsão de entrega', 'text', 'AAAA-MM-DD', false);
    if (o.cod === '211128') return '';
    if (o.efeito === 'titularidade') return '<div class="evf-campo"><label>Manifestação</label><select id="evf-attr" class="evf-in"><option>1 — aceita a transferência</option><option>0 — não aceita</option></select></div>';
    if (o.cod === '110001') {
      var ev = ST.solic.filter(function (s) { return s.nf === nf.numero && s.sit === 'aplicada' || (s.nf === nf.numero && s.sit === 'autorizada'); });
      return '<div class="evf-campo"><label>Evento a cancelar</label><select id="evf-attr" class="evf-in">'
        + (ev.length ? ev.map(function (s) { return '<option value="' + s.id + '">' + s.cod + ' · ' + s.id + ' · protocolo ' + (s.prot || '—') + '</option>'; }).join('') : '<option value="">nenhum evento do cliente neste documento</option>')
        + '</select></div>';
    }
    return '';
  }
  function lerValores(nf) {
    var v = {};
    rfs(nf).forEach(function (rf) {
      var t = rf.tipoFiscal.toUpperCase(), e = document.getElementById('evf-v-' + t);
      if (e) v[t] = Math.max(0, parseFloat(String(e.value).replace(/\./g, '').replace(',', '.')) || 0);
    });
    return v;
  }
  function efeitoPrevisto(nf, o) {
    var lin = [];
    if (o.efeito === 'valor') {
      var v = lerValores(nf), sinal = (o.cod === 'ND' || o.cod === '112120') ? 1 : -1;
      rfs(nf).forEach(function (rf) {
        var t = rf.tipoFiscal.toUpperCase(), d = v[t] || 0;
        if (!d) return;
        lin.push({ tributo: t, orgao: t === 'CBS' ? 'Receita Federal' : 'Comitê Gestor', campo: o.campo, antes: rf.valor || 0, depois: Math.max(0, (rf.valor || 0) + sinal * d), valor: true });
      });
    } else if (o.efeito === 'atributo') {
      var a = document.getElementById('evf-attr'), it = document.getElementById('evf-item');
      var depois = o.cod === '112150' ? 'previsão ' + ((a && a.value) || 'nova') : o.attr[1];
      lin.push({ tributo: null, campo: (o.item ? 'Item ' + ((it && it.value) || '?') + ' · ' : '') + o.curto, antes: o.attr[0], depois: depois, valor: false });
    } else if (o.efeito === 'titularidade') {
      lin.push({ tributo: o.cod === '212110' ? 'IBS' : 'CBS', campo: 'Titularidade do crédito', antes: 'empresa sucedida', depois: 'empresa sucessora', valor: false });
    }
    return lin;
  }
  function previa(nfNum, cod) {
    var nf = nfPorNumero(nfNum), o = op(cod), el = document.getElementById('evf-previa');
    if (!nf || !o || !el) return;
    var lin = efeitoPrevisto(nf, o);
    if (o.cod === '110001') { el.innerHTML = '<div class="evf-caixa"><div class="evf-caixa-t">Efeito</div>Os ajustes do evento cancelado ficam revertidos, com ajustes inversos. Nada é apagado.</div>'; return; }
    if (!lin.length) { el.innerHTML = ''; return; }
    el.innerHTML = '<div class="evf-caixa"><div class="evf-caixa-t">Prévia do efeito no documento</div>'
      + lin.map(function (l) {
        return '<div class="evf-kv"><span>' + esc(l.tributo ? l.tributo + ' · ' + l.campo : l.campo) + '</span><b><span class="evf-de">' + esc(l.valor ? money(l.antes) : l.antes) + '</span> → ' + esc(l.valor ? money(l.depois) : l.depois) + '</b></div>';
      }).join('')
      + '<div class="evf-sub">' + (o.efeito === 'valor' ? 'O valor só muda quando o órgão de cada tributo refletir' + (o.cod === 'NC' ? ', e depois do aceite do destinatário' : '') + '.' : 'O atributo vale na autorização.') + '</div></div>';
  }

  /* ── Solicitar ────────────────────────────────────────────────────────── */
  var SIT = {
    pedido: { rot: 'pedido ao autor', cls: 'amber' },
    solicitada: { rot: 'solicitada', cls: 'blue' },
    entregue: { rot: 'entregue', cls: 'blue' },
    autorizada: { rot: 'autorizada', cls: 'teal' },
    emitida: { rot: 'nota emitida', cls: 'teal' },
    aguardando_aceite: { rot: 'aguardando aceite do destinatário', cls: 'amber' },
    aplicada: { rot: 'aplicada', cls: 'teal' },
    rejeitada: { rot: 'rejeitada', cls: 'red' },
    cancelada: { rot: 'cancelada', cls: 'gray' }
  };
  function solicitar(nfNum, cod, incId, precisaJust) {
    var nf = nfPorNumero(nfNum), o = op(cod); if (!nf || !o) return;
    var c = caminho(o, nf), just = ((document.getElementById('evf-just') || {}).value || '').trim();
    var st = document.getElementById('evf-form-st');
    if ((precisaJust || c.k === 'pedido') && !just) {
      if (st) { st.textContent = 'Falta: ' + (c.k === 'pedido' ? 'a mensagem ao autor' : 'a justificativa'); st.className = 'evf-rodape-st amb'; }
      var e = document.getElementById('evf-just'); if (e) e.focus();
      return;
    }
    if (o.item && c.k === 'cmd') {
      var it =((document.getElementById('evf-item') || {}).value || '').trim();
      if (!it) { if (st) { st.textContent = 'Falta: o número do item'; st.className = 'evf-rodape-st amb'; } return; }
    }
    if (c.k === 'cmd' && c.modo === 'direto' && !credencialDe(autorCnpj(nf))) {
      if (st) { st.textContent = 'Sem credencial ativa para ' + autorCnpj(nf) + ': o modo direto está suspenso.'; st.className = 'evf-rodape-st amb'; }
      return;
    }
    var s = {
      id: nid(o.nota ? 'anr_' : (c.k === 'pedido' ? 'ped_' : 'fer_')), cod: o.cod, nf: nf.numero, incId: incId || null, just: just,
      caminho: c.k, modo: o.nota ? 'erp' : (c.modo || null), sit: c.k === 'pedido' ? 'pedido' : 'solicitada',
      efeito: c.k === 'pedido' ? [] : efeitoPrevisto(nf, o), rejeitar: !!(document.getElementById('evf-rej') || {}).checked,
      ref: o.cod === '110001' ? ((document.getElementById('evf-attr') || {}).value || null) : null,
      por: usuario(), linha: [], prot: null
    };
    s.linha.push({ em: agora(), t: c.k === 'pedido' ? 'Pedido ao autor' : 'Solicitado', d: c.k === 'pedido' ? 'enviado a ' + c.quem + ' · ' + just : (just || 'sugerido pelo SplitHub') });
    ST.solic.unshift(s);
    fechar('evf-form-ov');
    if (incId) moverInc(incId, 'aguardando_emitente', c.k === 'pedido' ? 'Pedido ao ' + c.quem.replace('o ', '') + ': registrar o ' + o.cod : 'Aguardando ' + (s.modo === 'direto' ? 'a SEFAZ' : 'o sistema do cliente') + ': ' + o.cod + ' · ' + s.id);
    if (c.k === 'cmd') avancar(s);
    toast(c.k === 'pedido' ? 'Pedido enviado a ' + c.quem + '.' : (o.nota ? 'Comando enviado ao ERP: ' : (s.modo === 'direto' ? 'Transmitindo à SEFAZ: ' : 'Solicitação enviada ao ERP: ')) + s.id);
    redesenhar();
    acompanhar(s.id);
  }
  function credencialDe(cnpj) { return ST.credenciais.filter(function (c) { return c.cnpjs.indexOf(cnpj) >= 0; })[0] || null; }

  // simulação: entrega → autorização (ou rejeição) → nota emitida
  function avancar(s) {
    var o = op(s.cod);
    setTimeout(function () {
      if (s.sit !== 'solicitada') return;
      s.sit = 'entregue';
      if (s.modo === 'direto') s.linha.push({ em: agora(), t: 'Transmitido à SVRS', d: 'NFeRecepcaoEvento 4.00 · assinado com a credencial ' + ((credencialDe(autorCnpj(nfPorNumero(s.nf))) || {}).id || '—') });
      else {
        var evt = nid('evt_'), tipo = o.nota ? 'adjustment_note.requested' : 'fiscal_event.requested';
        ST.entregas.unshift({ id: evt, tipo: tipo, solic: s.id, em: agora(), status: 200, ms: 400 });
        s.linha.push({ em: agora(), t: 'Webhook entregue', d: tipo + ' · ' + evt + ' · resposta 200 do ERP' });
      }
      redesenhar();
      setTimeout(function () {
        if (s.sit !== 'entregue') return;
        if (s.rejeitar) {
          s.sit = 'rejeitada';
          s.linha.push({ em: agora(), t: 'Rejeitado pelo autorizador', d: 'cStat 575 · autor do evento diverge do destinatário da NF-e (simulado)' });
          if (s.incId) moverInc(s.incId, 'em_analise', 'Evento ' + s.cod + ' rejeitado · cStat 575 · nova tentativa é solicitação nova');
          if (s.modo === 'direto') webhookErp('fiscal_event.rejected', s);
        } else if (o.nota) {
          s.sit = o.cod === 'NC' ? 'aguardando_aceite' : 'emitida';
          s.nota = 'NF-e ' + (900000 + ST.seq) + ' · ' + (o.cod === 'NC' ? 'nota de crédito' : 'nota de débito');
          s.linha.push({ em: agora(), t: 'Nota emitida pelo ERP', d: s.nota + ' · recebida pela ingestão de documentos, com o request_id' });
          if (o.cod === 'ND') registrarAjustes(s);
        } else {
          s.sit = 'autorizada';
          s.prot = '3' + '41' + '26' + ('0000000000' + (1000 + ST.seq)).slice(-10);
          s.linha.push({ em: agora(), t: 'Autorizado', d: 'protocolo ' + s.prot + (s.modo === 'direto' ? ' · resposta da SVRS' : ' · devolvido pelo ERP em POST /v1/fiscal-events') });
          if (s.modo === 'direto') webhookErp('fiscal_event.authorized', s);
          registrarAjustes(s);
        }
        redesenhar();
      }, 1400);
    }, 1200);
  }
  function webhookErp(tipo, s) {
    var evt = nid('evt_');
    ST.entregas.unshift({ id: evt, tipo: tipo, solic: s.id, em: agora(), status: 200, ms: 350 });
    s.linha.push({ em: agora(), t: 'ERP avisado', d: tipo + ' · ' + evt });
  }
  function registrarAjustes(s) {
    var o = op(s.cod);
    if (o.cod === '110001') {
      var alvo = ST.solic.filter(function (x) { return x.id === s.ref; })[0];
      ST.ajustes.filter(function (a) { return a.solic === s.ref && a.sit !== 'revertido'; }).forEach(function (a) {
        a.sit = 'revertido'; a.revertidoPor = s.id;
        ST.ajustes.unshift({ id: nid('AJ-'), nf: s.nf, solic: s.id, cod: s.cod, prot: s.prot, tributo: a.tributo, orgao: a.orgao, campo: a.campo, antes: a.depois, depois: a.antes, valor: a.valor, sit: a.valor ? 'aguardando_orgao' : 'declarado', inc: s.incId, por: s.por, em: agora(), inverso: a.id });
      });
      if (alvo) { alvo.sit = 'cancelada'; alvo.linha.push({ em: agora(), t: 'Cancelado pelo 110001', d: s.id + ' · protocolo ' + s.prot }); }
      return;
    }
    s.efeito.forEach(function (l) {
      ST.ajustes.unshift({ id: nid('AJ-'), nf: s.nf, solic: s.id, cod: s.cod, prot: s.prot, nota: s.nota || null, tributo: l.tributo, orgao: l.orgao, campo: l.campo,
        antes: l.antes, depois: l.depois, valor: l.valor, sit: l.valor ? 'aguardando_orgao' : 'declarado', inc: s.incId, por: s.por, em: agora() });
    });
  }
  function aceitar(sid) {
    var s = ST.solic.filter(function (x) { return x.id === sid; })[0]; if (!s || s.sit !== 'aguardando_aceite') return;
    s.sit = 'emitida';
    s.linha.push({ em: agora(), t: 'Aceite do destinatário', d: 'evento 211128 com aceite = 1 (simulado)' });
    registrarAjustes(s);
    redesenhar(); acompanhar(sid);
  }
  function refletir(ajId) {
    var a = ST.ajustes.filter(function (x) { return x.id === ajId; })[0]; if (!a || a.sit !== 'aguardando_orgao') return;
    a.sit = 'aplicado'; a.refletidoEm = agora();
    var s = ST.solic.filter(function (x) { return x.id === a.solic; })[0];
    if (s) {
      s.linha.push({ em: agora(), t: a.tributo + ' refletido', d: (a.orgao || '') + ' · ' + money(a.depois) + ' · ' + a.id + ' aplicado' });
      var pend = ST.ajustes.filter(function (x) { return x.solic === s.id && x.sit === 'aguardando_orgao'; });
      if (!pend.length && (s.sit === 'autorizada' || s.sit === 'emitida')) s.sit = 'aplicada';
      if (s.incId && !pend.length) histInc(s.incId, 'Ajuste refletido pelo órgão: o chamado pode ser resolvido com o desfecho preenchido');
    }
    redesenhar();
  }
  function resolverInc(incId) {
    var s = ST.solic.filter(function (x) { return x.incId === incId && (x.sit === 'aplicada' || x.sit === 'autorizada' || x.sit === 'emitida'); })[0];
    var desf = s ? 'Evento ' + s.cod + (s.prot ? ', protocolo ' + s.prot : '') + (s.nota ? ', ' + s.nota : '') + ', refletido pelo órgão' : 'Resolvido';
    moverInc(incId, 'resolvida', 'Resolvida pelo responsável · desfecho: ' + desf);
    toast(incId + ' resolvida.');
    redesenhar();
  }

  /* ── Inconsistência: estado e histórico ───────────────────────────────── */
  function histInc(incId, txt) { (ST.hist[incId] = ST.hist[incId] || []).unshift({ em: agora(), txt: txt, por: usuario() }); }
  function moverInc(incId, col, txt) {
    var inc = incPorId(incId);
    if (inc) inc.status = col;
    if (window._kanbanState) window._kanbanState[incId] = col;
    histInc(incId, txt);
    try { if (window.renderizarKanbanInconsistencias) window.renderizarKanbanInconsistencias(); } catch (e) {}
  }

  /* ── Acompanhamento ───────────────────────────────────────────────────── */
  function acompanhar(sid) {
    var s = ST.solic.filter(function (x) { return x.id === sid; })[0]; if (!s) return;
    var o = op(s.cod), id = 'evf-acomp-ov';
    var ajs = ST.ajustes.filter(function (a) { return a.solic === s.id; });
    overlay(id, 620, cab(id, '⏱', esc(s.id) + ' · ' + esc(s.cod) + ' ' + esc(o.curto), 'NF-e ' + esc(s.nf) + (s.incId ? ' · ' + esc(s.incId) : '') + (s.modo ? ' · ' + (s.modo === 'direto' ? 'direto na SEFAZ' : 'pelo ERP') : ''))
      + '<div class="mbox-col evf-col">'
      + '<div class="evf-kv"><span>Situação</span><b><span class="evf-chip ' + SIT[s.sit].cls + '">' + esc(SIT[s.sit].rot) + '</span></b></div>'
      + (s.prot ? '<div class="evf-kv"><span>Protocolo</span><b class="evf-mono">' + esc(s.prot) + '</b></div>' : '')
      + (s.nota ? '<div class="evf-kv"><span>Nota</span><b>' + esc(s.nota) + '</b></div>' : '')
      + (s.sit === 'aguardando_aceite' ? '<div class="evf-caixa amb"><div class="evf-caixa-t">Nota de crédito sem aceite</div>O ajuste só se consolida com o aceite do destinatário, o evento 211128. <button class="btn evf-btn-sm" onclick="shEvf.aceitar(\'' + s.id + '\')">Simular aceite do destinatário</button></div>' : '')
      + (ajs.length ? '<div class="evf-sec">Ajustes</div>' + ajs.map(function (a) { return linhaAjuste(a, true); }).join('') : '')
      + '<div class="evf-sec">Linha do tempo</div><div class="evf-tl">' + s.linha.slice().reverse().map(function (l) {
        return '<div class="evf-tl-l"><span class="evf-tl-q">' + fmtDH(l.em) + '</span><span class="evf-min0"><b>' + esc(l.t) + '</b><span class="evf-sub">' + esc(l.d) + '</span></span></div>';
      }).join('') + '</div>'
      + ((s.sit === 'autorizada' || s.sit === 'aplicada') && s.cod !== '110001' && s.caminho === 'cmd' ? '<button class="btn evf-btn-sm evf-mt" onclick="shEvf.preparar(\'' + s.nf + '\',\'110001\',\'' + (s.incId || '') + '\',false)">Cancelar pelo 110001</button>' : '')
      + (s.incId && ajs.length && !ajs.some(function (a) { return a.sit === 'aguardando_orgao'; }) && s.sit !== 'cancelada' && s.sit !== 'rejeitada' ? '<button class="btn btn-t evf-btn-sm evf-mt" onclick="shEvf.resolverInc(\'' + s.incId + '\')">Resolver ' + esc(s.incId) + ' com o desfecho preenchido</button>' : '')
      + '</div><div class="evf-rodape"><button class="btn" onclick="document.getElementById(\'' + id + '\').remove()">Fechar</button></div>');
  }
  var AJ_SIT = { declarado: ['declarado', 'teal'], aguardando_orgao: ['aguardando o órgão', 'amber'], aplicado: ['aplicado', 'teal'], revertido: ['revertido', 'gray'], divergente: ['divergente', 'red'] };
  function linhaAjuste(a, comAcao) {
    var sit = AJ_SIT[a.sit];
    return '<div class="evf-aj' + (a.sit === 'revertido' ? ' evf-aj-off' : '') + '"><div class="evf-min0"><b>' + esc(a.tributo ? a.tributo + ' · ' : '') + esc(a.campo) + '</b>'
      + '<span class="evf-sub"><span class="evf-de">' + esc(a.valor ? money(a.antes) : a.antes) + '</span> → ' + esc(a.valor ? money(a.depois) : a.depois) + ' · ' + esc(a.cod) + (a.prot ? ' · prot. …' + a.prot.slice(-4) : '') + (a.nota ? ' · ' + a.nota : '') + ' · ' + esc(a.id) + '</span></div>'
      + '<div class="evf-aj-d"><span class="evf-chip ' + sit[1] + '">' + esc(a.sit === 'aguardando_orgao' && a.orgao ? 'aguardando ' + (a.orgao === 'Receita Federal' ? 'a Receita Federal' : 'o Comitê Gestor') : sit[0]) + '</span>'
      + (comAcao && a.sit === 'aguardando_orgao' ? '<button class="btn evf-btn-sm" onclick="shEvf.refletir(\'' + a.id + '\')">Simular reflexo</button>' : '')
      + '<button class="btn evf-btn-sm" onclick="shEvf.trilha(\'' + a.id + '\')">Trilha</button></div></div>';
  }
  function trilha(ajId) {
    var a = ST.ajustes.filter(function (x) { return x.id === ajId; })[0]; if (!a) return;
    var s = ST.solic.filter(function (x) { return x.id === a.solic; })[0] || {};
    var id = 'evf-trilha-ov';
    function kv(k, v) { return '<div class="evf-kv"><span>' + k + '</span><b>' + v + '</b></div>'; }
    overlay(id, 520, cab(id, '≡', 'Ajuste ' + esc(a.id), esc(a.tributo ? a.tributo + ' · ' + a.orgao : 'atributo do documento'))
      + '<div class="mbox-col evf-col">'
      + kv('O que mudou', esc(a.campo) + ': <span class="evf-de">' + esc(a.valor ? money(a.antes) : a.antes) + '</span> → ' + esc(a.valor ? money(a.depois) : a.depois))
      + kv('Origem', esc(a.cod) + ' · ' + esc((op(a.cod) || {}).nome || '') + (a.prot ? ' · protocolo ' + esc(a.prot) : '') + (a.nota ? ' · ' + esc(a.nota) : ''))
      + kv('Solicitação', esc(a.solic) + ' · ' + (s.modo === 'direto' ? 'direto na SEFAZ' : 'pelo ERP'))
      + kv('Inconsistência', esc(a.inc || 'pedido no documento'))
      + kv('Pedido por', esc(a.por) + ' · ' + fmtDH(a.em))
      + kv('Aprovação', 'funcionalidade futura')
      + kv('Situação', esc(AJ_SIT[a.sit][0]) + (a.refletidoEm ? ' · refletido ' + fmtDH(a.refletidoEm) : '') + (a.revertidoPor ? ' · revertido por ' + esc(a.revertidoPor) : '') + (a.inverso ? ' · inverso de ' + esc(a.inverso) : ''))
      + kv('Justificativa', esc(s.just || '—'))
      + kv('Prova', '<span class="evf-mono">sha256 ' + (a.id + s.id).split('').map(function (c) { return c.charCodeAt(0).toString(16); }).join('').slice(0, 16) + '…</span>')
      + '<p class="evf-sub evf-mt">Ajuste não se edita nem se apaga: a correção é um ajuste novo, e a reversão é o cancelamento do evento.</p>'
      + '</div><div class="evf-rodape"><button class="btn" onclick="document.getElementById(\'' + id + '\').remove()">Fechar</button></div>');
  }

  /* ── Bloco no detalhe do documento e do RF ───────────────────────────── */
  function blocoDF(nf, tributo) {
    var ajs = ST.ajustes.filter(function (a) { return a.nf === nf.numero && (!tributo || !a.tributo || a.tributo === tributo); });
    var soma = {};
    rfs(nf).forEach(function (rf) {
      var t = rf.tipoFiscal.toUpperCase();
      if (tributo && t !== tributo) return;
      var aplic = ST.ajustes.filter(function (a) { return a.nf === nf.numero && a.tributo === t && a.valor && a.sit === 'aplicado'; });
      var pend = ST.ajustes.filter(function (a) { return a.nf === nf.numero && a.tributo === t && a.valor && a.sit === 'aguardando_orgao'; });
      var delta = aplic.reduce(function (x, a) { return x + (a.depois - a.antes); }, 0);
      var dp = pend.reduce(function (x, a) { return x + (a.depois - a.antes); }, 0);
      soma[t] = { xml: rf.valor || 0, delta: delta, pend: dp };
    });
    var ts = Object.keys(soma);
    return '<div class="evf-df" data-evf>'
      + '<div class="evf-df-h"><span class="mbox-section-label">Ajustes do documento · ' + ajs.length + '</span>'
      + '<button class="btn btn-t evf-btn-sm" onclick="shEvf.opcoes(\'' + nf.numero + '\',\'\')">Emitir evento ou nota</button></div>'
      + '<div class="evf-tw"><table class="evf-t"><thead><tr><th>Tributo</th><th class="r">No XML</th><th class="r">Ajustes aplicados</th><th class="r">Aguardando o órgão</th><th class="r">Ajustado</th></tr></thead><tbody>'
      + ts.map(function (t) {
        var x = soma[t];
        return '<tr><td><span class="evf-trib">' + t + '</span></td><td class="r">' + money(x.xml) + '</td><td class="r">' + (x.delta ? money(x.delta) : '—') + '</td><td class="r">' + (x.pend ? money(x.pend) : '—') + '</td><td class="r"><b>' + money(x.xml + x.delta) + '</b></td></tr>';
      }).join('') + '</tbody></table></div>'
      + (ajs.length ? ajs.map(function (a) { return linhaAjuste(a, true); }).join('') : '<div class="evf-sub">Nenhum ajuste por evento ou nota neste documento.</div>')
      + '</div>';
  }
  function injetarDF() {
    var ov = document.getElementById('nf-detalhe-overlay'); if (!ov) return;
    var col = ov.querySelector('.pp-col-r'); if (!col) return;
    var old = col.querySelector('[data-evf]'); if (old) old.remove();
    var nfNum = ov.getAttribute('data-evf-nf'); var nf = nfPorNumero(nfNum); if (!nf) return;
    var ancora = col.querySelector('.pp-nota-q');
    if (ancora) ancora.insertAdjacentHTML('afterend', blocoDF(nf, null));
    else col.insertAdjacentHTML('afterbegin', blocoDF(nf, null));
  }
  function injetarRF() {
    var ov = document.getElementById('rf-detalhe-overlay'); if (!ov) return;
    var rfId = ov.getAttribute('data-evf-rf'), ent = rfId && (window._rfIndex || {})[rfId]; if (!ent) return;
    var old = ov.querySelector('[data-evf]'); if (old) old.remove();
    var ancora = ov.querySelector('.pp-nota-q');
    var h = blocoDF(ent.nf, ent.rf.tipoFiscal.toUpperCase());
    if (ancora) ancora.insertAdjacentHTML('afterend', h);
  }
  function injetarCard() {
    var m = document.getElementById('kb-card-modal'); if (!m || !m._incId) return;
    var old = m.querySelector('[data-evf-card]'); if (old) old.remove();
    var rot = Array.prototype.filter.call(m.querySelectorAll('div'), function (d) { return d.children.length === 0 && d.textContent === 'Ações sugeridas'; })[0];
    if (rot) rot.insertAdjacentHTML('beforebegin', '<div data-evf-card>' + blocoCard(m._incId) + '</div><div style="height:1px;background:var(--brd);margin:14px 0"></div>');
    var tl = document.getElementById('kb-timeline-' + m._incId), hs = ST.hist[m._incId] || [];
    var antigo = tl && tl.querySelector('[data-evf-hist]'); if (antigo) antigo.remove();
    if (tl && hs.length) tl.insertAdjacentHTML('afterbegin', '<div data-evf-hist>' + hs.map(function (h) {
      return '<div class="evf-tl-l evf-tl-inc"><span class="evf-tl-q">' + fmtDH(h.em) + '</span><span class="evf-min0"><b>Evento fiscal</b><span class="evf-sub">' + esc(h.txt) + ' · ' + esc(h.por) + '</span></span></div>';
    }).join('') + '</div>');
  }
  function redesenhar() {
    try { injetarDF(); } catch (e) { console.error('[evf] df', e); }
    try { injetarRF(); } catch (e) { console.error('[evf] rf', e); }
    try { injetarCard(); } catch (e) { console.error('[evf] card', e); }
    try { if (document.getElementById('evf-root') && document.getElementById('admin-eventos').classList.contains('active')) renderCfg(); } catch (e) {}
    try { var ac = document.getElementById('evf-acomp-ov'); if (ac) { var sid = (ac.querySelector('.mbox-title') || {}).textContent; if (sid) acompanhar(sid.split(' ')[0]); } } catch (e) {}
  }

  /* ── Configurações › Eventos fiscais ──────────────────────────────────── */
  var ABA = 'solic';
  function renderCfg() {
    semear();
    var root = document.getElementById('evf-root'); if (!root) return;
    var abas = [['solic', 'Solicitações'], ['modo', 'Modo e credenciais'], ['qos', 'Qualidade de serviço'], ['hooks', 'Webhooks'], ['trilha', 'Trilha de configuração']];
    var h = '<div class="sechdr"><h2>Eventos fiscais</h2><p>Eventos da Reforma e notas de ajuste pedidos a partir das inconsistências e dos documentos. O modo de emissão é escolhido por CNPJ: pelo ERP, por webhook, ou direto na SEFAZ, com a credencial do cliente. Ambiente de protótipo: ERP, SEFAZ e órgãos simulados.</p></div>'
      + '<div class="stabs evf-tabs">' + abas.map(function (a) { return '<button class="stab' + (ABA === a[0] ? ' active' : '') + '" onclick="shEvf.aba(\'' + a[0] + '\')">' + a[1] + '</button>'; }).join('') + '</div>';
    if (ABA === 'solic') {
      h += ST.solic.length ? '<div class="evf-tw"><table class="evf-t"><thead><tr><th>Solicitação</th><th>Documento</th><th>Opção</th><th>Caminho</th><th>Situação</th><th>Inconsistência</th><th>Pedido por</th></tr></thead><tbody>'
        + ST.solic.map(function (s) {
          var o = op(s.cod);
          return '<tr class="evf-tr-click" onclick="shEvf.acompanhar(\'' + s.id + '\')"><td class="evf-mono">' + esc(s.id) + '</td><td>NF-e ' + esc(s.nf) + '</td><td><span class="evf-cod">' + esc(s.cod) + '</span> ' + esc(o.curto) + '</td>'
            + '<td>' + (s.caminho === 'pedido' ? 'Pedido ao autor' : (s.modo === 'direto' ? 'Direto na SEFAZ' : 'Pelo ERP')) + '</td><td><span class="evf-chip ' + SIT[s.sit].cls + '">' + esc(SIT[s.sit].rot) + '</span></td><td>' + esc(s.incId || '—') + '</td><td>' + esc(s.por) + '</td></tr>';
        }).join('') + '</tbody></table></div>'
        : '<div class="evf-vazio">Nenhuma solicitação ainda. Abra um chamado de inconsistência ou o detalhe de um documento e use <em>Evento fiscal ou nota</em>.</div>';
    } else if (ABA === 'modo') {
      h += '<div class="evf-sec">Modo de emissão por CNPJ autor</div><div class="evf-tw"><table class="evf-t"><thead><tr><th>CNPJ</th><th>Estabelecimento</th><th>Modo</th><th>Credencial</th></tr></thead><tbody>'
        + orgCnpjs().map(function (c) {
          var cr = credencialDe(c.cnpj), m = ST.modo[c.cnpj] || 'erp';
          return '<tr><td class="evf-mono">' + esc(c.cnpj) + '</td><td>' + esc(c.tipo + ' · ' + c.uf) + '</td><td><select class="evf-in evf-sel" onchange="shEvf.modo(\'' + c.cnpj + '\',this.value)">'
            + '<option value="erp"' + (m === 'erp' ? ' selected' : '') + '>Pelo ERP</option><option value="direto"' + (m === 'direto' ? ' selected' : '') + '>Direto na SEFAZ</option></select></td>'
            + '<td>' + (cr ? esc(cr.id) + ' · válida até ' + esc(cr.validoAte) + ' · ' + esc(cr.ambiente) : '<span class="evf-sub">sem credencial</span>') + '</td></tr>';
        }).join('') + '</tbody></table></div>'
        + '<div class="evf-sub">Notas de crédito e de débito saem sempre pelo ERP. A troca de modo vale para as próximas solicitações.' + (ST.termo ? ' Termo de transmissão aceito por ' + esc(ST.termo.por) + ' em ' + fmtDH(ST.termo.em) + '.' : '') + '</div>'
        + '<div class="evf-sec evf-mt">Credenciais da SEFAZ <button class="btn btn-t evf-btn-sm" onclick="shEvf.novaCredencial()">Adicionar certificado</button></div>'
        + '<div class="evf-tw"><table class="evf-t"><thead><tr><th>Credencial</th><th>Titular</th><th>Válida até</th><th>Ambiente</th><th>CNPJs vinculados</th><th></th></tr></thead><tbody>'
        + ST.credenciais.map(function (c) {
          return '<tr><td class="evf-mono">' + esc(c.id) + '</td><td>' + esc(c.titular) + '<span class="evf-sub">' + esc(c.cnpj) + '</span></td><td>' + esc(c.validoAte) + '</td><td>' + esc(c.ambiente) + '</td><td>' + c.cnpjs.length + '</td>'
            + '<td class="r"><button class="btn evf-btn-sm" onclick="shEvf.testar(\'' + c.id + '\')">Testar conexão</button></td></tr>';
        }).join('') + '</tbody></table></div>'
        + '<div class="evf-caixa amb"><div class="evf-caixa-t">O certificado é a chave fiscal da empresa</div>e-CNPJ A1, guardado cifrado. Depois de salvo, não pode ser baixado, e a senha não volta à tela. Só o Administrador gerencia. Aviso 30 dias antes do vencimento.</div>';
    } else if (ABA === 'qos') {
      h += '<div class="evf-tw"><table class="evf-t"><thead><tr><th>Ator</th><th>Tempo limite</th><th>Retentativas</th><th>Aviso</th><th>Inconsistência</th><th>Pausa</th><th>Último contato</th><th class="r">No prazo · 30 d</th><th></th></tr></thead><tbody>'
        + ST.qos.map(function (q) {
          return '<tr><td><b>' + esc(q.rot) + '</b></td><td>' + esc(q.tempo) + '</td><td>' + esc(q.ret) + '</td><td>' + esc(q.aviso) + '</td><td>' + esc(q.inc) + '</td><td>' + esc(q.pausa) + '</td><td>' + esc(q.ultimo) + '</td><td class="r">' + esc(q.prazo) + '</td>'
            + '<td class="r"><button class="btn evf-btn-sm" onclick="shEvf.editarQos(\'' + q.k + '\')">Editar</button></td></tr>';
        }).join('') + '</tbody></table></div><div class="evf-sub">Os prazos alimentam os avisos e a inconsistência de integração, da família F. Toda mudança fica na trilha de configuração.</div>';
    } else if (ABA === 'hooks') {
      h += ST.entregas.length ? '<div class="evf-tw"><table class="evf-t"><thead><tr><th>Evento</th><th>Tipo</th><th>Solicitação</th><th>Quando</th><th>Resposta</th></tr></thead><tbody>'
        + ST.entregas.map(function (e) { return '<tr><td class="evf-mono">' + esc(e.id) + '</td><td><code>' + esc(e.tipo) + '</code></td><td class="evf-mono">' + esc(e.solic) + '</td><td>' + fmtDH(e.em) + '</td><td>' + e.status + ' · ' + e.ms + ' ms</td></tr>'; }).join('') + '</tbody></table></div>'
        : '<div class="evf-vazio">Nenhuma entrega ainda. No modo pelo ERP, cada solicitação sai por <code>fiscal_event.requested</code> ou <code>adjustment_note.requested</code>; no modo direto, o ERP é avisado por <code>fiscal_event.authorized</code> ou <code>rejected</code>.</div>';
    } else {
      h += ST.trilhaCfg.length ? '<div class="evf-tl">' + ST.trilhaCfg.map(function (t) { return '<div class="evf-tl-l"><span class="evf-tl-q">' + fmtDH(t.em) + '</span><span class="evf-min0"><b>' + esc(t.acao) + '</b><span class="evf-sub">' + esc(t.det) + ' · ' + esc(t.por) + '</span></span></div>'; }).join('') + '</div>'
        : '<div class="evf-vazio">Sem mudanças de configuração nesta sessão.</div>';
    }
    root.innerHTML = h;
  }
  function aba(k) { ABA = k; renderCfg(); }
  function setModo(cnpj, m) {
    if (m === 'direto') {
      if (!credencialDe(cnpj)) { toast('Cadastre uma credencial e vincule ' + cnpj + ' antes de ligar o modo direto.', true); renderCfg(); return; }
      if (!ST.termo) { termo(cnpj); return; }
    }
    ST.modo[cnpj] = m;
    cfgLog('Modo de emissão alterado', cnpj + ' → ' + (m === 'direto' ? 'direto na SEFAZ' : 'pelo ERP'));
    toast('Modo de ' + cnpj + ': ' + (m === 'direto' ? 'direto na SEFAZ' : 'pelo ERP') + '. Vale para as próximas solicitações.');
    renderCfg();
  }
  function termo(cnpj) {
    var id = 'evf-termo-ov';
    overlay(id, 480, cab(id, '⚖', 'Termo de transmissão', 'Modo direto na SEFAZ')
      + '<div class="mbox-col evf-col"><p class="evf-p">No modo direto, o SplitHub assina e transmite eventos fiscais em nome da empresa, com o certificado cadastrado. A declaração continua sendo da empresa; o SplitHub registra cada transmissão, com o protocolo.</p>'
      + '<label class="evf-chk"><input type="checkbox" id="evf-termo-ok"> Aceito, em nome da empresa, como Administrador</label></div>'
      + '<div class="evf-rodape"><button class="btn" onclick="document.getElementById(\'' + id + '\').remove();shEvf.aba(\'modo\')">Cancelar</button>'
      + '<button class="btn btn-t" onclick="shEvf.aceitarTermo(\'' + cnpj + '\')">Ligar o modo direto</button></div>');
  }
  function aceitarTermo(cnpj) {
    if (!(document.getElementById('evf-termo-ok') || {}).checked) { toast('Marque o aceite para continuar.', true); return; }
    ST.termo = { por: usuario(), em: agora() };
    cfgLog('Termo de transmissão aceito', 'modo direto na SEFAZ');
    fechar('evf-termo-ov');
    setModo(cnpj, 'direto');
  }
  function novaCredencial() {
    var id = 'evf-cred-ov';
    overlay(id, 520, cab(id, '🔐', 'Adicionar certificado', 'Credencial da SEFAZ · e-CNPJ A1')
      + '<div class="mbox-col evf-col">'
      + '<div class="evf-campo"><label for="evf-c-arq">Arquivo .pfx ou .p12</label><input id="evf-c-arq" class="evf-in" type="file" accept=".pfx,.p12"></div>'
      + '<div class="evf-campo"><label for="evf-c-senha">Senha do certificado</label><input id="evf-c-senha" class="evf-in" type="password" autocomplete="new-password"></div>'
      + '<div class="evf-campo"><label for="evf-c-cnpj">Titular — no protótipo, escolha o CNPJ que o certificado traria</label><select id="evf-c-cnpj" class="evf-in">'
      + orgCnpjs().map(function (c) { return '<option value="' + c.cnpj + '">' + esc(c.cnpj + ' · ' + c.razao) + '</option>'; }).join('') + '</select></div>'
      + '<div class="evf-campo"><label for="evf-c-amb">Ambiente</label><select id="evf-c-amb" class="evf-in"><option>Homologação</option><option>Produção</option></select></div>'
      + '<p class="evf-sub">Vincula a todos os CNPJs da mesma raiz. O arquivo não é enviado a lugar nenhum no protótipo.</p></div>'
      + '<div class="evf-rodape"><button class="btn" onclick="document.getElementById(\'' + id + '\').remove()">Cancelar</button><button class="btn btn-t" onclick="shEvf.salvarCredencial()">Salvar credencial</button></div>');
  }
  function salvarCredencial() {
    var arq = document.getElementById('evf-c-arq'), senha = (document.getElementById('evf-c-senha') || {}).value || '';
    if (!arq || !arq.files || !arq.files.length) { toast('Escolha o arquivo do certificado.', true); return; }
    if (!senha) { toast('Informe a senha do certificado.', true); return; }
    var cnpj = document.getElementById('evf-c-cnpj').value, c = orgCnpjs().filter(function (x) { return x.cnpj === cnpj; })[0];
    var cr = { id: 'CR-' + ('0' + (ST.credenciais.length + 1)).slice(-2), titular: c.razao, cnpj: cnpj, validoAte: '10/03/2027', ambiente: document.getElementById('evf-c-amb').value,
      cnpjs: orgCnpjs().filter(function (x) { return x.cnpj.slice(0, 10) === cnpj.slice(0, 10); }).map(function (x) { return x.cnpj; }), cadastradoPor: usuario(), em: agora() };
    ST.credenciais.push(cr);
    cfgLog('Credencial cadastrada', cr.id + ' · ' + cr.titular + ' · ' + cr.ambiente + ' · ' + cr.cnpjs.length + ' CNPJs');
    fechar('evf-cred-ov');
    toast(cr.id + ' salva. O certificado não pode mais ser baixado, e a senha não volta à tela.');
    renderCfg();
  }
  function testar(id) {
    var c = ST.credenciais.filter(function (x) { return x.id === id; })[0]; if (!c) return;
    cfgLog('Teste de conexão', c.id + ' · SVRS · ' + c.ambiente + ' · serviço em operação (simulado)');
    toast('SVRS respondeu: serviço em operação · ' + c.ambiente + ' (simulado).');
    renderCfg();
  }
  function editarQos(k) {
    var q = ST.qos.filter(function (x) { return x.k === k; })[0]; if (!q) return;
    var id = 'evf-qos-ov';
    function f(n, r, v) { return '<div class="evf-campo"><label for="evf-q-' + n + '">' + r + '</label><input id="evf-q-' + n + '" class="evf-in" type="text" value="' + esc(v) + '"></div>'; }
    overlay(id, 480, cab(id, '⏲', 'Qualidade de serviço', esc(q.rot))
      + '<div class="mbox-col evf-col">' + f('tempo', 'Tempo limite', q.tempo) + f('ret', 'Retentativas', q.ret) + f('aviso', 'Aviso', q.aviso) + f('inc', 'Inconsistência de integração', q.inc) + f('pausa', 'Pausa automática', q.pausa) + '</div>'
      + '<div class="evf-rodape"><button class="btn" onclick="document.getElementById(\'' + id + '\').remove()">Cancelar</button><button class="btn btn-t" onclick="shEvf.salvarQos(\'' + k + '\')">Salvar</button></div>');
  }
  function salvarQos(k) {
    var q = ST.qos.filter(function (x) { return x.k === k; })[0]; if (!q) return;
    var mud = [];
    ['tempo', 'ret', 'aviso', 'inc', 'pausa'].forEach(function (n) {
      var v = (document.getElementById('evf-q-' + n) || {}).value;
      if (v != null && v !== q[n]) { mud.push(n + ': ' + q[n] + ' → ' + v); q[n] = v; }
    });
    if (mud.length) cfgLog('Qualidade de serviço alterada', q.rot + ' · ' + mud.join('; '));
    fechar('evf-qos-ov');
    renderCfg();
  }

  /* ── Ganchos ──────────────────────────────────────────────────────────── */
  function ganchos() {
    semear();
    var sub = document.getElementById('subnav-admin-eventos');
    if (sub && !sub._evf) { sub.addEventListener('click', function () { setTimeout(renderCfg, 0); }); sub._evf = true; }
    if (typeof window.kbAbrirCard === 'function' && !window.kbAbrirCard._evf) {
      var kb = window.kbAbrirCard;
      window.kbAbrirCard = function () { var r = kb.apply(this, arguments); try { injetarCard(); } catch (e) { console.error('[evf] card', e); } return r; };
      window.kbAbrirCard._evf = true;
    }
    if (typeof window.abrirDetalhesNFporNumero === 'function' && !window.abrirDetalhesNFporNumero._evf) {
      var df = window.abrirDetalhesNFporNumero;
      window.abrirDetalhesNFporNumero = function (n) {
        var r = df.apply(this, arguments);
        var ov = document.getElementById('nf-detalhe-overlay'); if (ov) ov.setAttribute('data-evf-nf', n);
        try { injetarDF(); } catch (e) { console.error('[evf] df', e); }
        return r;
      };
      window.abrirDetalhesNFporNumero._evf = true;
    }
    if (typeof window.abrirDetalheRF === 'function' && !window.abrirDetalheRF._evf) {
      var rf = window.abrirDetalheRF;
      window.abrirDetalheRF = function (id) {
        var r = rf.apply(this, arguments);
        var ov = document.getElementById('rf-detalhe-overlay'); if (ov) ov.setAttribute('data-evf-rf', id);
        try { injetarRF(); } catch (e) { console.error('[evf] rf', e); }
        return r;
      };
      window.abrirDetalheRF._evf = true;
    }
  }

  window.shEvf = {
    opcoes: opcoes, preparar: preparar, previa: previa, solicitar: solicitar, acompanhar: acompanhar, aceitar: aceitar,
    refletir: refletir, trilha: trilha, resolverInc: resolverInc, render: renderCfg, aba: aba, modo: setModo,
    aceitarTermo: aceitarTermo, novaCredencial: novaCredencial, salvarCredencial: salvarCredencial, testar: testar,
    editarQos: editarQos, salvarQos: salvarQos, _cat: CAT, _sugestao: sugestao, _caminho: caminho
  };

  // os outros módulos também embrulham estas funções: o gancho entra depois deles
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(ganchos, 200); });
  else setTimeout(ganchos, 200);
})();
