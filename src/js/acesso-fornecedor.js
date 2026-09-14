/* ══ Acesso do fornecedor e importação em massa ═════════════════════════════
   Implementa a proposta de 14/09/2026:
     · convite por e-mail com senha própria (D7)
     · vínculo pessoa × CNPJ — a mesma pessoa pode ter acessos independentes
       a fornecedores diferentes
     · revogação imediata, que não apaga o acesso (preserva autoria)
     · importação por CSV em três arquivos, com o grupo econômico montado
       no próprio arquivo de cadastro, em duas passadas

   O envio de e-mail é simulado: a mensagem e o link aparecem na tela.
   A troca de perfil em sessão continua existindo, como recurso de
   demonstração — ver o selo em acfSeloDemo().
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fechar(id) { var e = document.getElementById(id); if (e) e.remove(); }
  function hoje() { return new Date(); }
  function fmtD(d) {
    if (!d) return '—';
    var x = (d instanceof Date) ? d : new Date(d);
    return ('0' + x.getDate()).slice(-2) + '/' + ('0' + (x.getMonth() + 1)).slice(-2) + '/' + x.getFullYear();
  }
  function fmtDH(d) {
    var x = (d instanceof Date) ? d : new Date(d);
    return fmtD(x) + ' ' + ('0' + x.getHours()).slice(-2) + ':' + ('0' + x.getMinutes()).slice(-2);
  }
  function maisDias(n) { var d = hoje(); d.setDate(d.getDate() + n); return d; }
  function diasAte(d) { return Math.ceil((new Date(d) - hoje()) / 86400000); }

  function toast(msg, tipo, link) {
    fechar('acf-toast');
    var t = document.createElement('div');
    t.id = 'acf-toast';
    t.setAttribute('role', 'status');
    var cor = tipo === 'erro' ? 'var(--red)' : 'var(--teal)';
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9600;display:flex;'
      + 'align-items:center;gap:12px;flex-wrap:wrap;width:max-content;max-width:calc(100vw - 32px);box-sizing:border-box;'
      + 'background:var(--bg);color:var(--txt1);border:1px solid var(--brd);border-left:3px solid ' + cor + ';'
      + 'border-radius:8px;padding:10px 14px;font-size:12px;box-shadow:0 8px 24px rgba(0,0,0,.25)';
    t.innerHTML = '<span style="min-width:0">' + esc(msg) + '</span>'
      + (link ? '<button class="btn btn-t" style="font-size:11px;padding:4px 10px;white-space:nowrap" onclick="'
        + link.onclick + '">' + esc(link.rotulo) + '</button>' : '');
    document.body.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.remove(); }, link ? 7000 : 4500);
  }

  function cabecalho(id, icone, titulo, sub) {
    return '<div class="mbox-hdr"><div style="display:flex;align-items:center;gap:12px;min-width:0">'
      + '<div class="mbox-icon blue">' + icone + '</div><div style="min-width:0">'
      + '<div class="mbox-title" id="' + id + '-titulo">' + esc(titulo) + '</div>'
      + '<div class="mbox-sub">' + esc(sub) + '</div></div></div>'
      + '<button class="mbox-close" aria-label="Fechar" onclick="document.getElementById(\'' + id + '\').remove()">✕</button></div>';
  }
  function rodape(id, legenda, botaoId, rotulo, cls, onclick) {
    return '<div style="display:flex;justify-content:flex-end;align-items:center;gap:8px;flex-wrap:wrap;'
      + 'padding:14px 18px;border-top:1px solid var(--brd);flex-shrink:0">'
      + '<span id="' + botaoId + '-status" role="status" aria-live="polite" style="font-size:11px;color:var(--txt3);'
      + 'margin-right:auto;min-width:0">' + legenda + '</span>'
      + '<button class="btn" onclick="document.getElementById(\'' + id + '\').remove()">Cancelar</button>'
      + '<button class="' + cls + '" id="' + botaoId + '" onclick="' + onclick + '">' + esc(rotulo) + '</button></div>';
  }
  function caixa(rgbVar, titulo, corpo) {
    return '<div style="background:rgba(var(' + rgbVar + '),.08);border:1px solid rgba(var(' + rgbVar + '),.28);'
      + 'border-radius:8px;padding:10px 12px;margin-top:12px">'
      + '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;'
      + 'color:rgb(var(' + rgbVar + '));margin-bottom:4px">' + esc(titulo) + '</div>'
      + '<div style="font-size:12px;color:var(--txt2);line-height:1.55">' + corpo + '</div></div>';
  }
  function selo(txt, cor) {
    return '<span style="display:inline-block;font-size:9.5px;font-weight:700;letter-spacing:.04em;padding:2px 7px;'
      + 'border-radius:3px;background:rgba(' + cor + ',.12);color:rgb(' + cor + ');border:1px solid rgba(' + cor + ',.3);'
      + 'white-space:nowrap">' + esc(txt) + '</span>';
  }
  var COR = { verde: '29,158,117', ambar: '186,117,23', vermelho: '214,58,73', cinza: '138,146,163', azul: '29,95,204' };

  /* ── Estado ──────────────────────────────────────────────────────────────
     Nada persiste: como no resto do protótipo, o estado vive em memória e é
     recriado a cada carregamento. */
  var ST = window._acfState = {
    convites: [], acessos: [], eventos: [], lotes: [], seq: 0
  };
  function novoId(p) { ST.seq += 1; return p + '-' + ('000' + ST.seq).slice(-4); }

  function evento(tipo, ator, alvo, detalhe) {
    ST.eventos.push({ ts: new Date(), tipo: tipo, ator: ator, alvo: alvo, detalhe: detalhe || '' });
  }
  function usuario() { return 'José da Silva'; }

  function fornPorCnpj(cnpj) {
    return (window.fornecedores || []).filter(function (f) { return f.cnpj === cnpj; })[0] || null;
  }
  /* CNPJs do grupo: a matriz e todas as filiais que apontam para ela. */
  function grupoDe(cnpj) {
    var f = fornPorCnpj(cnpj);
    if (!f) return [cnpj];
    var raiz = f.cnpjMatriz || f.cnpj;
    var lista = [raiz];
    (window.fornecedores || []).forEach(function (x) {
      if (x.cnpjMatriz === raiz && lista.indexOf(x.cnpj) < 0) lista.push(x.cnpj);
    });
    return lista;
  }
  function acessosDe(cnpj) {
    return ST.acessos.filter(function (a) { return a.fornecedorCnpj === cnpj; });
  }
  function convitesDe(cnpj) {
    return ST.convites.filter(function (c) { return c.fornecedorCnpj === cnpj; });
  }
  function estadoConvite(c) {
    if (c.estado === 'enviado' && diasAte(c.expiraEm) < 0) return 'expirado';
    return c.estado;
  }
  var PAPEIS = { responsavel: 'Responsável', leitura: 'Leitura' };
  var MOTIVOS_REVOGA = {
    contrato_encerrado: 'Contrato encerrado',
    saiu_empresa: 'Pessoa saiu da empresa',
    troca_responsavel: 'Troca de responsável',
    seguranca: 'Suspeita de uso indevido',
    outro: 'Outro'
  };

  /* ── Seed de demonstração ───────────────────────────────────────────────── */
  function semear() {
    if (ST.acessos.length || !(window.fornecedores || []).length) return;
    var f = window.fornecedores;
    function pick(i) { return f[i] ? f[i].cnpj : null; }
    var sulpar = (f.filter(function (x) { return x.nome.indexOf('Sulpar') === 0; })[0] || f[3] || f[0]).cnpj;
    var outro = (f.filter(function (x) { return x.tipo === 'Matriz' && x.cnpj !== sulpar; })[0] || f[0]).cnpj;

    function acesso(cnpj, nome, email, papel, estado, dias) {
      var a = {
        id: novoId('ACF'), fornecedorCnpj: cnpj, nome: nome, email: email, papel: papel,
        cnpjs: grupoDe(cnpj), estado: estado, criadoEm: maisDias(-dias - 4),
        ultimoAcesso: estado === 'ativo' ? maisDias(-Math.max(0, dias)) : null,
        revogadoEm: estado === 'revogado' ? maisDias(-2) : null,
        revogadoPor: estado === 'revogado' ? usuario() : null,
        motivoRevogacao: estado === 'revogado' ? 'contrato_encerrado' : null
      };
      ST.acessos.push(a);
      evento('acesso_criado', usuario(), a.id, nome + ' · ' + cnpj);
      return a;
    }
    acesso(sulpar, 'Marina Alves', 'marina@sulpar.com.br', 'responsavel', 'ativo', 0);
    acesso(sulpar, 'Caio Ribeiro', 'caio@sulpar.com.br', 'leitura', 'ativo', 2);
    acesso(sulpar, 'Tereza Nunes', 'tereza@contabil.com', 'leitura', 'revogado', 9);
    acesso(outro, 'Tereza Nunes', 'tereza@contabil.com', 'leitura', 'ativo', 3);

    ST.convites.push({
      id: novoId('CNV'), fornecedorCnpj: sulpar, nome: 'Rui Barbosa', email: 'rui@sulpar.com.br',
      papel: 'responsavel', cnpjs: grupoDe(sulpar), estado: 'enviado', criadoEm: maisDias(-2),
      expiraEm: maisDias(5), criadoPor: usuario(), reenvios: 0
    });
    ST.convites.push({
      id: novoId('CNV'), fornecedorCnpj: sulpar, nome: 'Ana Prado', email: 'ana@sulpar.com.br',
      papel: 'leitura', cnpjs: grupoDe(sulpar), estado: 'enviado', criadoEm: maisDias(-20),
      expiraEm: maisDias(-13), criadoPor: usuario(), reenvios: 1
    });
  }

  /* ══ T-01 · aba Acessos no detalhe do fornecedor ═══════════════════════════ */
  window.acfAbaAcessos = function (cnpj) {
    semear();
    var acs = acessosDe(cnpj), cvs = convitesDe(cnpj).filter(function (c) {
      return ['enviado', 'expirado'].indexOf(estadoConvite(c)) >= 0;
    });
    var h = '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:10px">'
      + '<div style="min-width:0"><div style="font-size:13px;font-weight:700;color:var(--txt1)">Pessoas com acesso ao portal</div>'
      + '<div style="font-size:11px;color:var(--txt3);margin-top:2px">Cada acesso alcança apenas os CNPJs marcados.</div></div>'
      + '<button class="btn btn-t" style="font-size:12px;white-space:nowrap" onclick="acfAbrirConvite(\'' + cnpj + '\')">+ Convidar pessoa</button></div>';

    if (!acs.length) {
      h += '<div style="font-size:12px;color:var(--txt3);padding:18px 0;text-align:center;border:1px dashed var(--brd);border-radius:8px">'
        + 'Ninguém deste fornecedor acessa o portal ainda.</div>';
    } else {
      h += '<div class="twrap"><table style="width:100%;border-collapse:collapse;font-size:12px">'
        + '<thead><tr>' + ['Pessoa', 'E-mail', 'Papel', 'CNPJs', 'Último acesso', 'Situação', ''].map(function (c) {
          return '<th style="text-align:left;padding:7px 8px;font-size:9.5px;font-weight:700;letter-spacing:.05em;'
            + 'text-transform:uppercase;color:var(--txt3);border-bottom:1px solid var(--brd);white-space:nowrap">' + c + '</th>';
        }).join('') + '</tr></thead><tbody>';
      acs.forEach(function (a) {
        var st = a.estado === 'ativo' ? selo('ATIVO', COR.verde)
          : a.estado === 'bloqueado' ? selo('BLOQUEADO', COR.ambar) : selo('REVOGADO', COR.cinza);
        var acao = a.estado === 'revogado'
          ? '<button class="btn" style="font-size:10.5px;padding:3px 9px" onclick="acfReativar(\'' + a.id + '\')">Reativar</button>'
          : '<button class="btn" style="font-size:10.5px;padding:3px 9px" onclick="acfAbrirRevogar(\'' + a.id + '\')">Revogar</button>';
        h += '<tr><td style="padding:8px;border-bottom:1px solid var(--brd);color:var(--txt1);font-weight:600">' + esc(a.nome) + '</td>'
          + '<td style="padding:8px;border-bottom:1px solid var(--brd);color:var(--txt2)">' + esc(a.email) + '</td>'
          + '<td style="padding:8px;border-bottom:1px solid var(--brd);color:var(--txt2)">' + PAPEIS[a.papel] + '</td>'
          + '<td style="padding:8px;border-bottom:1px solid var(--brd);color:var(--txt2)">' + a.cnpjs.length + '</td>'
          + '<td style="padding:8px;border-bottom:1px solid var(--brd);color:var(--txt2);white-space:nowrap">'
          + (a.ultimoAcesso ? fmtDH(a.ultimoAcesso) : '—') + '</td>'
          + '<td style="padding:8px;border-bottom:1px solid var(--brd)">' + st + '</td>'
          + '<td style="padding:8px;border-bottom:1px solid var(--brd);text-align:right;white-space:nowrap">' + acao + '</td></tr>';
      });
      h += '</tbody></table></div>';
    }

    h += '<div style="font-size:13px;font-weight:700;color:var(--txt1);margin:20px 0 8px">Convites pendentes</div>';
    if (!cvs.length) {
      h += '<div style="font-size:12px;color:var(--txt3);padding:12px 0">Nenhum convite aguardando aceite.</div>';
    } else {
      h += '<div class="twrap"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr>'
        + ['Pessoa', 'E-mail', 'Papel', 'Enviado', 'Expira', 'Situação', ''].map(function (c) {
          return '<th style="text-align:left;padding:7px 8px;font-size:9.5px;font-weight:700;letter-spacing:.05em;'
            + 'text-transform:uppercase;color:var(--txt3);border-bottom:1px solid var(--brd);white-space:nowrap">' + c + '</th>';
        }).join('') + '</tr></thead><tbody>';
      cvs.forEach(function (c) {
        var e = estadoConvite(c), d = diasAte(c.expiraEm);
        var st = e === 'expirado' ? selo('EXPIRADO', COR.vermelho) : selo('ENVIADO', COR.ambar);
        var acoes = e === 'expirado'
          ? '<button class="btn" style="font-size:10.5px;padding:3px 9px" onclick="acfReenviar(\'' + c.id + '\')">Convidar de novo</button>'
          : '<button class="btn" style="font-size:10.5px;padding:3px 9px" onclick="acfVerEmail(\'' + c.id + '\')">Ver e-mail</button>'
          + ' <button class="btn" style="font-size:10.5px;padding:3px 9px" onclick="acfReenviar(\'' + c.id + '\')">Reenviar</button>'
          + ' <button class="btn" style="font-size:10.5px;padding:3px 9px" onclick="acfCancelar(\'' + c.id + '\')">Cancelar</button>';
        h += '<tr><td style="padding:8px;border-bottom:1px solid var(--brd);color:var(--txt1);font-weight:600">' + esc(c.nome) + '</td>'
          + '<td style="padding:8px;border-bottom:1px solid var(--brd);color:var(--txt2)">' + esc(c.email) + '</td>'
          + '<td style="padding:8px;border-bottom:1px solid var(--brd);color:var(--txt2)">' + PAPEIS[c.papel] + '</td>'
          + '<td style="padding:8px;border-bottom:1px solid var(--brd);color:var(--txt2);white-space:nowrap">' + fmtD(c.criadoEm) + '</td>'
          + '<td style="padding:8px;border-bottom:1px solid var(--brd);color:var(--txt2);white-space:nowrap">'
          + (e === 'expirado' ? 'expirou' : 'em ' + d + ' dia' + (d === 1 ? '' : 's')) + '</td>'
          + '<td style="padding:8px;border-bottom:1px solid var(--brd)">' + st + '</td>'
          + '<td style="padding:8px;border-bottom:1px solid var(--brd);text-align:right;white-space:nowrap">' + acoes + '</td></tr>';
      });
      h += '</tbody></table></div>';
    }
    return h;
  };

  /* ══ T-02 · convidar ═══════════════════════════════════════════════════════ */
  window.acfAbrirConvite = function (cnpj) {
    var f = fornPorCnpj(cnpj);
    if (!f) return;
    var id = 'acf-convite-overlay';
    fechar(id);
    var cnpjs = grupoDe(cnpj);
    var linhas = cnpjs.map(function (c, i) {
      var x = fornPorCnpj(c);
      return '<label style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--txt2);padding:4px 0;cursor:pointer">'
        + '<input type="checkbox" class="acf-cnpj" value="' + c + '"' + (i === 0 ? ' checked' : ' checked')
        + ' onchange="acfValidarConvite()" style="width:15px;height:15px;flex-shrink:0">'
        + '<span style="min-width:0"><span class="mono">' + esc(c) + '</span> · ' + esc(x ? x.nome : '—')
        + ' <span style="color:var(--txt3)">' + (x && x.tipo ? x.tipo : '') + '</span></span></label>';
    }).join('');

    var html = '<div id="' + id + '" class="moverlay" onclick="if(event.target===this)this.remove()">'
      + '<div class="mbox" style="width:560px" role="dialog" aria-modal="true" aria-labelledby="' + id + '-titulo">'
      + cabecalho(id, '✉', 'Convidar pessoa', f.nome)
      + '<div class="mbox-col" style="flex:1;min-height:0">'
      + '<div class="sh-fp-field"><label for="acf-nome">Nome</label>'
      + '<input id="acf-nome" type="text" oninput="acfValidarConvite()" placeholder="Nome de quem vai acessar" '
      + 'style="width:100%;box-sizing:border-box;font:inherit;font-size:12px;color:var(--txt1);background:var(--bg);'
      + 'border:1px solid var(--brd);border-radius:6px;padding:8px 10px"></div>'
      + '<div class="sh-fp-field" style="margin-top:12px"><label for="acf-email">E-mail</label>'
      + '<input id="acf-email" type="email" oninput="acfValidarConvite()" placeholder="nome@empresa.com.br" '
      + 'style="width:100%;box-sizing:border-box;font:inherit;font-size:12px;color:var(--txt1);background:var(--bg);'
      + 'border:1px solid var(--brd);border-radius:6px;padding:8px 10px"></div>'
      + '<div class="sh-fp-field" style="margin-top:12px"><label for="acf-papel">Papel</label>'
      + '<select id="acf-papel" onchange="acfValidarConvite()">'
      + '<option value="">Selecione…</option>'
      + '<option value="responsavel">Responsável — envia comprovante e contesta</option>'
      + '<option value="leitura">Leitura — vê os documentos, não age</option></select></div>'
      + '<div class="mbox-section-label" style="margin-top:16px">CNPJs que este acesso alcança</div>'
      + '<div style="max-height:150px;overflow:auto">' + linhas + '</div>'
      + caixa('--teal-alt-rgb', 'A senha é de quem recebe',
        'O convite vale <strong>7 dias</strong> e só pode ser usado uma vez. Quem define a senha é a própria pessoa, '
        + 'ao aceitar — nenhum operador do adquirente vê ou escolhe senha de fornecedor.')
      + '</div>'
      + rodape(id, 'Preencha nome, e-mail, papel e ao menos um CNPJ.', 'acf-conv-ok', 'Convidar', 'btn btn-t',
        'acfConfirmarConvite(\'' + cnpj + '\')')
      + '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    setTimeout(function () { var e = document.getElementById('acf-nome'); if (e) e.focus(); acfValidarConvite(); }, 30);
  };

  /* O botão nunca fica desabilitado: o rodapé diz o que falta, e o clique com
     pendência destaca o primeiro campo — mesmo padrão do recolhimento assumido. */
  window.acfValidarConvite = function (tentativa) {
    var nome = (document.getElementById('acf-nome') || {}).value || '';
    var email = (document.getElementById('acf-email') || {}).value || '';
    var papel = (document.getElementById('acf-papel') || {}).value || '';
    var marcados = [].slice.call(document.querySelectorAll('.acf-cnpj:checked'));
    var falta = [];
    if (!nome.trim()) falta.push('nome');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) falta.push('e-mail válido');
    if (!papel) falta.push('papel');
    if (!marcados.length) falta.push('ao menos um CNPJ');
    var st = document.getElementById('acf-conv-ok-status');
    if (st) {
      st.textContent = falta.length ? 'Falta: ' + falta.join(', ') : 'Tudo preenchido';
      st.style.color = falta.length ? 'var(--amber)' : 'var(--teal)';
    }
    if (tentativa && falta.length) {
      var alvo = !nome.trim() ? 'acf-nome' : falta[0] === 'e-mail válido' ? 'acf-email' : 'acf-papel';
      var e = document.getElementById(alvo);
      if (e) { e.style.borderColor = 'var(--amber)'; e.focus(); }
    }
    return !falta.length;
  };

  window.acfConfirmarConvite = function (cnpj) {
    if (!window.acfValidarConvite(true)) return;
    var nome = document.getElementById('acf-nome').value.trim();
    var email = document.getElementById('acf-email').value.trim().toLowerCase();
    var papel = document.getElementById('acf-papel').value;
    var cnpjs = [].slice.call(document.querySelectorAll('.acf-cnpj:checked')).map(function (i) { return i.value; });

    var jaAtivo = ST.acessos.filter(function (a) {
      return a.fornecedorCnpj === cnpj && a.email === email && a.estado === 'ativo';
    })[0];
    if (jaAtivo) { toast('Esta pessoa já tem acesso ativo a este fornecedor.', 'erro'); return; }

    var c = {
      id: novoId('CNV'), fornecedorCnpj: cnpj, nome: nome, email: email, papel: papel, cnpjs: cnpjs,
      estado: 'enviado', criadoEm: new Date(), expiraEm: maisDias(7), criadoPor: usuario(), reenvios: 0
    };
    ST.convites.push(c);
    evento('convite_enviado', usuario(), c.id, nome + ' <' + email + '> · ' + PAPEIS[papel]);
    fechar('acf-convite-overlay');
    acfRefresh(cnpj);
    toast('Convite enviado para ' + email + '.', 'ok', { rotulo: 'Ver e-mail', onclick: "acfVerEmail('" + c.id + "')" });
  };

  /* ══ T-03 · o e-mail (simulado) ════════════════════════════════════════════ */
  window.acfVerEmail = function (convId) {
    var c = ST.convites.filter(function (x) { return x.id === convId; })[0];
    if (!c) return;
    var f = fornPorCnpj(c.fornecedorCnpj);
    var id = 'acf-email-overlay';
    fechar(id);
    var html = '<div id="' + id + '" class="moverlay" onclick="if(event.target===this)this.remove()">'
      + '<div class="mbox" style="width:560px" role="dialog" aria-modal="true" aria-labelledby="' + id + '-titulo">'
      + cabecalho(id, '✉', 'E-mail de convite', 'Para: ' + c.email)
      + '<div class="mbox-col" style="flex:1;min-height:0">'
      + caixa('--amber-rgb', 'Envio simulado',
        'Não há infraestrutura de e-mail no protótipo. Esta é a mensagem que seria enviada — e o botão abaixo abre '
        + 'a página de aceite como o convidado a veria.')
      + '<div style="border:1px solid var(--brd);border-radius:10px;overflow:hidden;margin-top:14px">'
      + '<div style="background:var(--teal);color:#fff;padding:14px 18px;font-size:14px;font-weight:800">SplitHub</div>'
      + '<div style="padding:18px">'
      + '<div style="font-size:13px;font-weight:700;color:var(--txt1);line-height:1.5">Você foi convidado a acompanhar '
      + 'os documentos da ' + esc(f ? f.nome : '—') + '</div>'
      + '<div style="font-size:12px;color:var(--txt2);margin-top:10px;line-height:1.6">' + esc(c.criadoPor)
      + ', da Induspar Tecnologia, criou um acesso para você no portal do fornecedor do SplitHub.</div>'
      + '<div style="margin-top:14px"><button class="btn btn-t" style="font-size:12px" onclick="acfAbrirAceite(\''
      + c.id + '\')">Definir minha senha</button></div>'
      + '<div style="font-size:11px;color:var(--txt3);margin-top:16px">O link vale por 7 dias e só pode ser usado uma vez.</div>'
      + '<div style="font-size:11px;color:var(--txt3);margin-top:4px">Se você não esperava este convite, ignore esta mensagem.</div>'
      + '</div></div></div>'
      + '<div style="display:flex;justify-content:flex-end;padding:14px 18px;border-top:1px solid var(--brd)">'
      + '<button class="btn" onclick="document.getElementById(\'' + id + '\').remove()">Fechar</button></div>'
      + '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  };

  /* ══ T-04 · aceite do convite (simulado) ═══════════════════════════════════ */
  window.acfAbrirAceite = function (convId) {
    var c = ST.convites.filter(function (x) { return x.id === convId; })[0];
    if (!c) return;
    var e = estadoConvite(c);
    fechar('acf-email-overlay');
    var id = 'acf-aceite-overlay';
    fechar(id);
    var f = fornPorCnpj(c.fornecedorCnpj);

    /* Link inválido, usado e expirado mostram a mesma coisa — de propósito. */
    if (e !== 'enviado') {
      document.body.insertAdjacentHTML('beforeend',
        '<div id="' + id + '" class="moverlay" onclick="if(event.target===this)this.remove()">'
        + '<div class="mbox" style="width:420px">'
        + cabecalho(id, '⚠', 'Link inválido', 'Página pública de aceite')
        + '<div class="mbox-col"><div style="font-size:12.5px;color:var(--txt2);line-height:1.6">'
        + 'Este link não pode ser usado. Peça um novo convite a quem administra o acesso.</div></div>'
        + '<div style="display:flex;justify-content:flex-end;padding:14px 18px;border-top:1px solid var(--brd)">'
        + '<button class="btn" onclick="document.getElementById(\'' + id + '\').remove()">Fechar</button></div>'
        + '</div></div>');
      return;
    }

    var html = '<div id="' + id + '" class="moverlay" onclick="if(event.target===this)this.remove()">'
      + '<div class="mbox" style="width:420px" role="dialog" aria-modal="true" aria-labelledby="' + id + '-titulo">'
      + cabecalho(id, '🔑', 'Defina sua senha', 'Página pública · visão do convidado')
      + '<div class="mbox-col" style="flex:1;min-height:0">'
      + '<div style="text-align:center;margin-bottom:14px">'
      + '<div style="font-size:11.5px;color:var(--txt3)">Convite de ' + esc(c.criadoPor) + ' · Induspar Tecnologia</div>'
      + '<div style="font-size:12px;color:var(--txt2);font-weight:600;margin-top:3px">Acesso a: ' + esc(f ? f.nome : '—') + '</div></div>'
      + '<div class="sh-fp-field"><label>E-mail</label>'
      + '<input type="text" value="' + esc(c.email) + '" disabled style="width:100%;box-sizing:border-box;font:inherit;'
      + 'font-size:12px;color:var(--txt3);background:var(--sur2);border:1px solid var(--brd);border-radius:6px;padding:8px 10px"></div>'
      + '<div class="sh-fp-field" style="margin-top:12px"><label for="acf-senha">Nova senha</label>'
      + '<input id="acf-senha" type="password" oninput="acfValidarSenha()" style="width:100%;box-sizing:border-box;'
      + 'font:inherit;font-size:12px;color:var(--txt1);background:var(--bg);border:1px solid var(--brd);border-radius:6px;padding:8px 10px"></div>'
      + '<div class="sh-fp-field" style="margin-top:12px"><label for="acf-senha2">Confirmar senha</label>'
      + '<input id="acf-senha2" type="password" oninput="acfValidarSenha()" style="width:100%;box-sizing:border-box;'
      + 'font:inherit;font-size:12px;color:var(--txt1);background:var(--bg);border:1px solid var(--brd);border-radius:6px;padding:8px 10px"></div>'
      + '<div id="acf-senha-req" style="font-size:11px;color:var(--txt3);margin-top:10px;line-height:1.7"></div>'
      + '</div>'
      + rodape(id, 'A senha não é vista por ninguém do adquirente.', 'acf-aceite-ok', 'Criar acesso', 'btn btn-t',
        'acfConfirmarAceite(\'' + c.id + '\')')
      + '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    setTimeout(function () { var e2 = document.getElementById('acf-senha'); if (e2) e2.focus(); acfValidarSenha(); }, 30);
  };

  window.acfValidarSenha = function () {
    var s = (document.getElementById('acf-senha') || {}).value || '';
    var s2 = (document.getElementById('acf-senha2') || {}).value || '';
    var regras = [
      { ok: s.length >= 10, txt: 'pelo menos 10 caracteres' },
      { ok: /[a-zA-Z]/.test(s) && /\d/.test(s), txt: 'letras e números' },
      { ok: !!s && s === s2, txt: 'as duas iguais' }
    ];
    var el = document.getElementById('acf-senha-req');
    if (el) {
      el.innerHTML = regras.map(function (r) {
        return '<div style="color:' + (r.ok ? 'var(--teal)' : 'var(--txt3)') + '">' + (r.ok ? '✓' : '○') + '  ' + r.txt + '</div>';
      }).join('');
    }
    var falta = regras.filter(function (r) { return !r.ok; });
    var st = document.getElementById('acf-aceite-ok-status');
    if (st) {
      st.textContent = falta.length ? 'Falta: ' + falta.map(function (r) { return r.txt; }).join(', ')
        : 'A senha não é vista por ninguém do adquirente.';
      st.style.color = falta.length ? 'var(--amber)' : 'var(--txt3)';
    }
    return !falta.length;
  };

  window.acfConfirmarAceite = function (convId) {
    if (!window.acfValidarSenha()) { toast('A senha ainda não atende aos requisitos.', 'erro'); return; }
    var c = ST.convites.filter(function (x) { return x.id === convId; })[0];
    if (!c || estadoConvite(c) !== 'enviado') { toast('Este convite não está mais válido.', 'erro'); return; }
    c.estado = 'aceito';
    c.aceitoEm = new Date();
    var a = {
      id: novoId('ACF'), fornecedorCnpj: c.fornecedorCnpj, nome: c.nome, email: c.email, papel: c.papel,
      cnpjs: c.cnpjs.slice(), estado: 'ativo', criadoEm: new Date(), ultimoAcesso: new Date(),
      revogadoEm: null, revogadoPor: null, motivoRevogacao: null
    };
    ST.acessos.push(a);
    evento('convite_aceito', c.nome, a.id, 'acesso criado a partir de ' + c.id);
    fechar('acf-aceite-overlay');
    acfRefresh(c.fornecedorCnpj);
    toast(c.nome + ' agora tem acesso ao portal.', 'ok');
  };

  /* ══ reenviar, cancelar, reativar ══════════════════════════════════════════ */
  window.acfReenviar = function (convId) {
    var c = ST.convites.filter(function (x) { return x.id === convId; })[0];
    if (!c) return;
    c.estado = 'enviado';
    c.criadoEm = new Date();
    c.expiraEm = maisDias(7);
    c.reenvios = (c.reenvios || 0) + 1;
    evento('convite_reenviado', usuario(), c.id, 'token anterior invalidado · ' + c.reenvios + 'º reenvio');
    acfRefresh(c.fornecedorCnpj);
    toast('Convite reenviado. O link anterior deixou de funcionar.', 'ok',
      { rotulo: 'Ver e-mail', onclick: "acfVerEmail('" + c.id + "')" });
  };
  window.acfCancelar = function (convId) {
    var c = ST.convites.filter(function (x) { return x.id === convId; })[0];
    if (!c) return;
    c.estado = 'cancelado';
    evento('convite_cancelado', usuario(), c.id, c.email);
    acfRefresh(c.fornecedorCnpj);
    toast('Convite cancelado.', 'ok');
  };
  window.acfReativar = function (acId) {
    var a = ST.acessos.filter(function (x) { return x.id === acId; })[0];
    if (!a) return;
    a.estado = 'revogado';
    var c = {
      id: novoId('CNV'), fornecedorCnpj: a.fornecedorCnpj, nome: a.nome, email: a.email, papel: a.papel,
      cnpjs: a.cnpjs.slice(), estado: 'enviado', criadoEm: new Date(), expiraEm: maisDias(7),
      criadoPor: usuario(), reenvios: 0
    };
    ST.convites.push(c);
    evento('acesso_reativado', usuario(), a.id, 'novo convite ' + c.id + ' — exige nova definição de senha');
    acfRefresh(a.fornecedorCnpj);
    toast('Reativação exige nova senha: um convite foi enviado a ' + a.email + '.', 'ok',
      { rotulo: 'Ver e-mail', onclick: "acfVerEmail('" + c.id + "')" });
  };

  /* ══ T-07 · revogar ════════════════════════════════════════════════════════ */
  window.acfAbrirRevogar = function (acId) {
    var a = ST.acessos.filter(function (x) { return x.id === acId; })[0];
    if (!a) return;
    var id = 'acf-revogar-overlay';
    fechar(id);
    var opts = '<option value="">Selecione…</option>' + Object.keys(MOTIVOS_REVOGA).map(function (k) {
      return '<option value="' + k + '">' + esc(MOTIVOS_REVOGA[k]) + '</option>';
    }).join('');
    var html = '<div id="' + id + '" class="moverlay" onclick="if(event.target===this)this.remove()">'
      + '<div class="mbox" style="width:520px" role="dialog" aria-modal="true" aria-labelledby="' + id + '-titulo">'
      + cabecalho(id, '⛔', 'Revogar acesso de ' + a.nome, a.email + ' · ' + PAPEIS[a.papel] + ' · ' + a.cnpjs.length + ' CNPJs')
      + '<div class="mbox-col" style="flex:1;min-height:0">'
      + caixa('--status-red-rgb', 'O que acontece agora',
        'A sessão aberta dela <strong>cai imediatamente</strong>. Os comprovantes que ela enviou continuam no sistema, '
        + 'atribuídos a ela — o acesso some da operação, não da trilha.')
      + '<div class="sh-fp-field" style="margin-top:14px"><label for="acf-rev-motivo">Motivo</label>'
      + '<select id="acf-rev-motivo" onchange="acfValidarRevoga()">' + opts + '</select></div>'
      + '<div class="sh-fp-field" style="margin-top:12px"><label for="acf-rev-obs">Observação (opcional)</label>'
      + '<input id="acf-rev-obs" type="text" style="width:100%;box-sizing:border-box;font:inherit;font-size:12px;'
      + 'color:var(--txt1);background:var(--bg);border:1px solid var(--brd);border-radius:6px;padding:8px 10px"></div>'
      + '</div>'
      + rodape(id, 'Escolha o motivo — ele fica na trilha.', 'acf-rev-ok', 'Revogar', 'btn btn-d',
        'acfConfirmarRevogar(\'' + a.id + '\')')
      + '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  };
  window.acfValidarRevoga = function () {
    var m = (document.getElementById('acf-rev-motivo') || {}).value || '';
    var st = document.getElementById('acf-rev-ok-status');
    if (st) {
      st.textContent = m ? 'Pronto para revogar.' : 'Escolha o motivo — ele fica na trilha.';
      st.style.color = m ? 'var(--teal)' : 'var(--amber)';
    }
    return !!m;
  };
  window.acfConfirmarRevogar = function (acId) {
    if (!window.acfValidarRevoga()) {
      var e = document.getElementById('acf-rev-motivo');
      if (e) { e.style.borderColor = 'var(--amber)'; e.focus(); }
      return;
    }
    var a = ST.acessos.filter(function (x) { return x.id === acId; })[0];
    if (!a) return;
    var motivo = document.getElementById('acf-rev-motivo').value;
    var obs = (document.getElementById('acf-rev-obs') || {}).value || '';
    a.estado = 'revogado';
    a.revogadoEm = new Date();
    a.revogadoPor = usuario();
    a.motivoRevogacao = motivo;
    a.obsRevogacao = obs;
    evento('acesso_revogado', usuario(), a.id, MOTIVOS_REVOGA[motivo] + (obs ? ' — ' + obs : ''));
    fechar('acf-revogar-overlay');
    acfRefresh(a.fornecedorCnpj);
    toast('Acesso de ' + a.nome + ' revogado. Sessões abertas foram encerradas.', 'ok');
  };

  /* ══ T-08 · painel consolidado de acessos externos ═════════════════════════ */
  window.acfRenderPainel = function () {
    var alvo = document.getElementById('acf-painel');
    if (!alvo) return;
    semear();
    var busca = ((document.getElementById('acf-busca') || {}).value || '').toLowerCase();
    var filtro = (document.getElementById('acf-filtro-sit') || {}).value || '';

    var ativos = ST.acessos.filter(function (a) { return a.estado === 'ativo'; });
    var fornDistintos = {};
    ativos.forEach(function (a) { fornDistintos[a.fornecedorCnpj] = 1; });
    var pendentes = ST.convites.filter(function (c) { return estadoConvite(c) === 'enviado'; });
    var expirando = pendentes.filter(function (c) { return diasAte(c.expiraEm) <= 2; });
    var semUso = ativos.filter(function (a) {
      return !a.ultimoAcesso || (hoje() - new Date(a.ultimoAcesso)) / 86400000 > 60;
    });
    var revogados = ST.acessos.filter(function (a) { return a.estado === 'revogado'; });

    var kpis = [
      ['Acessos ativos', ativos.length, 'em ' + Object.keys(fornDistintos).length + ' fornecedores', 'var(--teal)'],
      ['Convites pendentes', pendentes.length, expirando.length + ' expiram em 48h', 'var(--amber)'],
      ['Sem acesso há 60 dias', semUso.length, 'candidatos a revisão', 'var(--txt2)'],
      ['Revogados', revogados.length, 'todos com motivo', 'var(--txt2)']
    ];
    var h = '<div class="kgrid k4" style="margin-bottom:16px">' + kpis.map(function (k) {
      return '<div class="kcard"><div class="klbl">' + k[0] + '</div>'
        + '<div class="kval" style="color:' + k[3] + '">' + k[1] + '</div><div class="ksub">' + k[2] + '</div></div>';
    }).join('') + '</div>';

    var linhas = ST.acessos.filter(function (a) {
      if (filtro && a.estado !== filtro) return false;
      if (!busca) return true;
      var f = fornPorCnpj(a.fornecedorCnpj);
      return (a.nome + ' ' + a.email + ' ' + (f ? f.nome : '')).toLowerCase().indexOf(busca) >= 0;
    });

    h += '<div class="twrap"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr>'
      + ['Pessoa', 'E-mail', 'Fornecedor', 'Papel', 'Último acesso', 'Situação'].map(function (c) {
        return '<th style="text-align:left;padding:8px;font-size:9.5px;font-weight:700;letter-spacing:.05em;'
          + 'text-transform:uppercase;color:var(--txt3);border-bottom:1px solid var(--brd);white-space:nowrap">' + c + '</th>';
      }).join('') + '</tr></thead><tbody>';
    if (!linhas.length) {
      h += '<tr><td colspan="6" style="text-align:center;color:var(--txt3);padding:22px">Nenhum acesso encontrado para este filtro.</td></tr>';
    }
    linhas.forEach(function (a) {
      var f = fornPorCnpj(a.fornecedorCnpj);
      var dias = a.ultimoAcesso ? (hoje() - new Date(a.ultimoAcesso)) / 86400000 : null;
      var st = a.estado === 'ativo'
        ? (dias !== null && dias > 60 ? selo('SEM USO', COR.ambar) : selo('ATIVO', COR.verde))
        : a.estado === 'bloqueado' ? selo('BLOQUEADO', COR.ambar) : selo('REVOGADO', COR.cinza);
      h += '<tr><td style="padding:8px;border-bottom:1px solid var(--brd);color:var(--txt1);font-weight:600">' + esc(a.nome) + '</td>'
        + '<td style="padding:8px;border-bottom:1px solid var(--brd);color:var(--txt2)">' + esc(a.email) + '</td>'
        + '<td style="padding:8px;border-bottom:1px solid var(--brd);color:var(--txt2)">' + esc(f ? f.nome : a.fornecedorCnpj) + '</td>'
        + '<td style="padding:8px;border-bottom:1px solid var(--brd);color:var(--txt2)">' + PAPEIS[a.papel] + '</td>'
        + '<td style="padding:8px;border-bottom:1px solid var(--brd);color:var(--txt2);white-space:nowrap">'
        + (a.ultimoAcesso ? fmtDH(a.ultimoAcesso) : '—') + '</td>'
        + '<td style="padding:8px;border-bottom:1px solid var(--brd)">' + st + '</td></tr>';
    });
    h += '</tbody></table></div>';

    var evs = ST.eventos.slice(-6).reverse();
    if (evs.length) {
      h += '<div style="font-size:12px;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:.06em;'
        + 'margin:20px 0 8px">Trilha recente</div><div style="display:flex;flex-direction:column;gap:6px">';
      evs.forEach(function (e) {
        h += '<div style="display:flex;gap:10px;font-size:11.5px;color:var(--txt2);padding:6px 0;border-bottom:1px solid var(--brd)">'
          + '<span style="color:var(--txt3);white-space:nowrap">' + fmtDH(e.ts) + '</span>'
          + '<span style="font-weight:600;color:var(--txt1);white-space:nowrap">' + esc(e.tipo.replace(/_/g, ' ')) + '</span>'
          + '<span style="min-width:0">' + esc(e.detalhe) + '</span>'
          + '<span style="margin-left:auto;color:var(--txt3);white-space:nowrap">' + esc(e.ator) + '</span></div>';
      });
      h += '</div>';
    }
    alvo.innerHTML = h;
  };

  /* ══ Importação por CSV ════════════════════════════════════════════════════
     Três arquivos. O grupo econômico é montado pela coluna cnpj_matriz do
     arquivo de cadastro, resolvida em segunda passada — a filial pode vir
     antes da matriz. */
  var TIPOS = {
    cadastro: {
      nome: 'Cadastro, atualização e grupo',
      sub: 'Cria quem não existe e atualiza quem existe, pelo CNPJ. A coluna cnpj_matriz monta o grupo.',
      cols: ['cnpj', 'razao_social', 'nome_fantasia', 'cnpj_matriz', 'email_contato', 'status', 'metodo_pagamento_padrao'],
      exemplo: '14.382.976/0001-09;Sulpar Implementos S.A.;Sulpar;;fiscal@sulpar.com.br;ativo;fornecedor\n'
        + '98.765.432/0001-10;Nortek Componentes Ltda;Nortek;14.382.976/0001-09;;ativo;rad'
    },
    status: {
      nome: 'Status em massa',
      sub: 'Ativar, inativar ou bloquear, com motivo.',
      cols: ['cnpj', 'status', 'motivo'],
      exemplo: '14.382.976/0001-09;inativo;Contrato encerrado em 31/08'
    },
    convites: {
      nome: 'Convites em massa',
      sub: 'Um convite por linha. Quem já tem acesso ativo ou convite válido é ignorado.',
      cols: ['cnpj', 'email', 'nome', 'papel'],
      exemplo: '14.382.976/0001-09;rui@sulpar.com.br;Rui Barbosa;responsavel'
    }
  };
  var _impTipo = 'cadastro';
  var _impPrev = null;

  window.acfAbrirImport = function (tipo) {
    semear();
    _impTipo = tipo || 'cadastro';
    _impPrev = null;
    var id = 'acf-import-overlay';
    fechar(id);
    var cards = Object.keys(TIPOS).map(function (k) {
      var t = TIPOS[k], at = k === _impTipo;
      return '<button onclick="acfImportTipo(\'' + k + '\')" style="flex:1;min-width:150px;text-align:left;cursor:pointer;'
        + 'background:var(--bg);border:' + (at ? '2px solid var(--teal)' : '1px solid var(--brd)') + ';border-radius:8px;'
        + 'padding:10px 12px;font-family:inherit">'
        + '<div style="font-size:12px;font-weight:700;color:' + (at ? 'var(--teal)' : 'var(--txt1)') + '">' + esc(t.nome) + '</div>'
        + '<div style="font-size:10.5px;color:var(--txt3);margin-top:3px;line-height:1.45">' + esc(t.sub) + '</div></button>';
    }).join('');

    var t = TIPOS[_impTipo];
    var html = '<div id="' + id + '" class="moverlay" onclick="if(event.target===this)this.remove()">'
      + '<div class="mbox" style="width:820px;max-width:100%" role="dialog" aria-modal="true" aria-labelledby="' + id + '-titulo">'
      + cabecalho(id, '⇥', 'Importar fornecedores', 'Três arquivos, o mesmo fluxo: escolher, conferir, confirmar')
      + '<div class="mbox-col" style="flex:1;min-height:0" id="acf-import-corpo">'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap">' + cards + '</div>'
      + '<div class="sh-fp-field" style="margin-top:16px"><label for="acf-csv">Conteúdo do arquivo CSV</label>'
      + '<textarea id="acf-csv" rows="7" placeholder="Cole aqui o conteúdo do CSV, com o cabeçalho na primeira linha" '
      + 'style="width:100%;box-sizing:border-box;resize:vertical;font-family:\'JetBrains Mono\',monospace;font-size:11px;'
      + 'color:var(--txt1);background:var(--bg);border:1px solid var(--brd);border-radius:6px;padding:8px 10px"></textarea></div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">'
      + '<button class="btn" style="font-size:11px" onclick="acfImportExemplo()">Preencher com exemplo</button>'
      + '<input type="file" id="acf-file" accept=".csv,text/csv" onchange="acfImportArquivo(this)" style="display:none">'
      + '<button class="btn" style="font-size:11px" onclick="document.getElementById(\'acf-file\').click()">Escolher arquivo…</button>'
      + '</div>'
      + '<div style="font-size:11px;color:var(--txt3);margin-top:12px">Separador <strong>;</strong> · UTF-8 · até 5.000 linhas</div>'
      + '<div style="font-family:\'JetBrains Mono\',monospace;font-size:10.5px;color:var(--blue);margin-top:6px;overflow-x:auto">'
      + esc(t.cols.join(';')) + '</div>'
      + (_impTipo === 'cadastro' ? caixa('--teal-alt-rgb', 'O grupo econômico vem no mesmo arquivo',
        'A coluna <code>cnpj_matriz</code> monta a hierarquia. <strong>A filial pode vir antes da matriz</strong> — '
        + 'os vínculos são resolvidos numa segunda passada, depois que todo o cadastro entra. '
        + 'Em branco preserva o vínculo atual; <code>SEM_GRUPO</code> desvincula.') : '')
      + '</div>'
      + rodape(id, 'Cole ou escolha um arquivo para conferir.', 'acf-imp-ok', 'Conferir', 'btn btn-t', 'acfImportConferir()')
      + '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  };
  window.acfImportTipo = function (k) { fechar('acf-import-overlay'); window.acfAbrirImport(k); };
  window.acfImportExemplo = function () {
    var t = TIPOS[_impTipo];
    var e = document.getElementById('acf-csv');
    if (e) e.value = t.cols.join(';') + '\n' + t.exemplo;
  };
  window.acfImportArquivo = function (input) {
    var f = input.files && input.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      var e = document.getElementById('acf-csv');
      if (e) e.value = String(r.result || '');
      toast('Arquivo ' + f.name + ' carregado. Confira antes de confirmar.', 'ok');
    };
    r.readAsText(f, 'UTF-8');
  };

  function parseCSV(texto) {
    var linhas = String(texto || '').split(/\r?\n/).filter(function (l) { return l.trim() !== ''; });
    if (!linhas.length) return { erro: 'O arquivo está vazio.' };
    var head = linhas[0].split(';').map(function (c) { return c.trim().toLowerCase(); });
    var esperado = TIPOS[_impTipo].cols;
    var faltando = esperado.filter(function (c) { return head.indexOf(c) < 0 && ['cnpj', 'email', 'nome', 'papel', 'status'].indexOf(c) >= 0; });
    if (head.indexOf('cnpj') < 0) return { erro: 'O cabeçalho não tem a coluna obrigatória cnpj.' };
    if (faltando.length) return { erro: 'Faltam colunas obrigatórias no cabeçalho: ' + faltando.join(', ') + '.' };
    var sobra = head.filter(function (c) { return esperado.indexOf(c) < 0; });
    if (sobra.length) return { erro: 'Colunas fora do modelo: ' + sobra.join(', ') + '.' };
    if (linhas.length - 1 > 5000) return { erro: 'O arquivo tem ' + (linhas.length - 1) + ' linhas; o limite é 5.000.' };
    var out = [];
    for (var i = 1; i < linhas.length; i++) {
      var cel = linhas[i].split(';');
      var o = { _linha: i + 1 };
      head.forEach(function (c, j) { o[c] = (cel[j] || '').trim(); });
      out.push(o);
    }
    return { head: head, linhas: out };
  }

  /* A base de demonstração usa CNPJs fictícios, cujo dígito verificador não
     confere. Por isso o DV é conferido mas não bloqueia aqui: a linha entra com
     aviso. Numa instalação real, CHECA_DV passa a true e o DV vira erro — é o
     que a proposta prevê. O formato (14 dígitos, não todos iguais) bloqueia
     sempre, nos dois modos. */
  var CHECA_DV = false;

  function formatoOk(c) {
    var n = String(c || '').replace(/\D/g, '');
    return n.length === 14 && !/^(\d)\1+$/.test(n);
  }
  function dvOk(c) {
    var n = String(c || '').replace(/\D/g, '');
    if (n.length !== 14) return false;
    function dig(base) {
      var p = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      var s = 0;
      for (var i = 0; i < base.length; i++) s += parseInt(base[i], 10) * p[i];
      var r = s % 11;
      return r < 2 ? 0 : 11 - r;
    }
    return dig(n.slice(0, 12)) === +n[12] && dig(n.slice(0, 13)) === +n[13];
  }

  /* Duas passadas: 1ª cadastro, 2ª vínculos de grupo contra a base já gravada. */
  function analisar(linhas) {
    var res = { criar: [], atualizar: [], ignorar: [], invalidas: [], vinculos: [], semVinculo: [] };
    var base = {};
    (window.fornecedores || []).forEach(function (f) { base[f.cnpj] = f; });
    var vaiExistir = {};
    Object.keys(base).forEach(function (c) { vaiExistir[c] = true; });

    /* 1ª passada — cadastro */
    linhas.forEach(function (l) {
      if (!formatoOk(l.cnpj)) {
        res.invalidas.push({ l: l, motivo: 'CNPJ fora do formato — precisa de 14 dígitos', fazer: 'Conferir o CNPJ na origem' });
        return;
      }
      if (CHECA_DV && !dvOk(l.cnpj)) {
        res.invalidas.push({ l: l, motivo: 'CNPJ com dígito verificador errado', fazer: 'Conferir o CNPJ na origem' });
        return;
      }
      l._avisoDV = !dvOk(l.cnpj);
      if (_impTipo === 'status') {
        if (!base[l.cnpj]) { res.invalidas.push({ l: l, motivo: 'fornecedor não existe no cadastro', fazer: 'Importar o cadastro antes' }); return; }
        if (['ativo', 'inativo', 'bloqueado'].indexOf((l.status || '').toLowerCase()) < 0) {
          res.invalidas.push({ l: l, motivo: 'status fora dos valores aceitos: "' + (l.status || '') + '"', fazer: 'Usar ativo, inativo ou bloqueado' }); return;
        }
        if (['inativo', 'bloqueado'].indexOf(l.status.toLowerCase()) >= 0 && !(l.motivo || '').trim()) {
          res.invalidas.push({ l: l, motivo: 'motivo obrigatório para inativo e bloqueado', fazer: 'Preencher a coluna motivo' }); return;
        }
        res.atualizar.push({ l: l, nota: 'status → ' + l.status.toLowerCase() });
        return;
      }
      if (_impTipo === 'convites') {
        if (!base[l.cnpj]) { res.invalidas.push({ l: l, motivo: 'fornecedor não existe no cadastro', fazer: 'Importar o cadastro antes' }); return; }
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(l.email || '')) {
          res.invalidas.push({ l: l, motivo: 'e-mail inválido', fazer: 'Conferir o endereço' }); return;
        }
        if (['responsavel', 'leitura'].indexOf((l.papel || '').toLowerCase()) < 0) {
          res.invalidas.push({ l: l, motivo: 'papel fora dos valores aceitos', fazer: 'Usar responsavel ou leitura' }); return;
        }
        var temAtivo = ST.acessos.some(function (a) {
          return a.fornecedorCnpj === l.cnpj && a.email === l.email.toLowerCase() && a.estado === 'ativo';
        });
        var temConvite = ST.convites.some(function (c) {
          return c.fornecedorCnpj === l.cnpj && c.email === l.email.toLowerCase() && estadoConvite(c) === 'enviado';
        });
        if (temAtivo || temConvite) {
          res.ignorar.push({ l: l, nota: temAtivo ? 'já tem acesso ativo' : 'já tem convite válido' });
          return;
        }
        res.criar.push({ l: l, nota: 'convite para ' + l.email });
        return;
      }
      /* cadastro */
      var existe = !!base[l.cnpj];
      if (!existe && !(l.razao_social || '').trim()) {
        res.invalidas.push({ l: l, motivo: 'razão social obrigatória na criação', fazer: 'Preencher a coluna razao_social' });
        return;
      }
      if (l.status && ['ativo', 'inativo', 'bloqueado'].indexOf(l.status.toLowerCase()) < 0) {
        res.invalidas.push({ l: l, motivo: 'status fora dos valores aceitos: "' + l.status + '"', fazer: 'Usar ativo, inativo ou bloqueado' });
        return;
      }
      vaiExistir[l.cnpj] = true;
      if (existe) {
        var mudou = [];
        if (l.razao_social && l.razao_social !== base[l.cnpj].nome) mudou.push('razão social');
        if (l.status && l.status.toLowerCase() !== base[l.cnpj].status) mudou.push('status');
        var av = l._avisoDV ? ' · dígito verificador não confere' : '';
        if (mudou.length) res.atualizar.push({ l: l, nota: mudou.join(' e ') + ' mudam' + av });
        else res.ignorar.push({ l: l, nota: 'nada mudou em relação ao cadastro' + av });
      } else {
        res.criar.push({ l: l, nota: 'novo fornecedor' + (l._avisoDV ? ' · dígito verificador não confere' : '') });
      }
    });

    /* 2ª passada — vínculos de grupo, só no arquivo de cadastro */
    if (_impTipo === 'cadastro') {
      linhas.forEach(function (l) {
        if (!formatoOk(l.cnpj) || !vaiExistir[l.cnpj]) return;
        var m = (l.cnpj_matriz || '').trim();
        if (!m) return;                                   /* branco preserva */
        if (m.toUpperCase() === 'SEM_GRUPO') { res.vinculos.push({ l: l, de: (base[l.cnpj] || {}).grupoNome || '—', para: 'sem grupo' }); return; }
        if (m === l.cnpj) {
          res.semVinculo.push({ l: l, motivo: 'a linha aponta para si mesma' });
          return;
        }
        if (!vaiExistir[m]) {
          res.semVinculo.push({ l: l, motivo: 'matriz citada não existe no arquivo nem na base' });
          return;
        }
        var matrizNaBase = base[m];
        var matrizNoArquivo = linhas.filter(function (x) { return x.cnpj === m; })[0];
        /* ciclo direto: A aponta para B e B aponta para A. Conferido antes do
           terceiro nível porque é a causa real, e nomear a causa certa é o que
           permite corrigir o arquivo. */
        if (matrizNoArquivo && (matrizNoArquivo.cnpj_matriz || '').trim() === l.cnpj) {
          res.semVinculo.push({ l: l, motivo: 'ciclo: esta linha e a matriz declarada apontam uma para a outra' });
          return;
        }
        /* terceiro nível: a matriz declarada já é filial de alguém */
        var matrizEhFilial = (matrizNoArquivo && (matrizNoArquivo.cnpj_matriz || '').trim()
          && matrizNoArquivo.cnpj_matriz.trim().toUpperCase() !== 'SEM_GRUPO')
          || (!matrizNoArquivo && matrizNaBase && matrizNaBase.cnpjMatriz);
        if (matrizEhFilial) {
          res.semVinculo.push({ l: l, motivo: 'a matriz declarada já é filial de outra — a hierarquia tem dois níveis' });
          return;
        }
        var atual = base[l.cnpj] && base[l.cnpj].cnpjMatriz;
        if (atual && atual !== m) {
          res.vinculos.push({ l: l, de: (base[atual] || {}).nome || atual, para: (base[m] || {}).nome || m, remaneja: true });
        } else if (!atual) {
          res.vinculos.push({ l: l, de: '—', para: (base[m] || {}).nome || m });
        }
      });
    }
    return res;
  }

  window.acfImportConferir = function () {
    var texto = (document.getElementById('acf-csv') || {}).value || '';
    var p = parseCSV(texto);
    if (p.erro) { toast(p.erro, 'erro'); return; }
    var r = analisar(p.linhas);
    _impPrev = { linhas: p.linhas, res: r };

    var tot = r.criar.length + r.atualizar.length;
    var kpis = [['Criar', r.criar.length, 'var(--teal)'], ['Atualizar', r.atualizar.length, 'var(--blue)'],
    ['Ignorar', r.ignorar.length, 'var(--txt2)'], ['Inválidas', r.invalidas.length, 'var(--red)']];

    var h = '<div style="font-size:12.5px;font-weight:700;color:var(--txt1)">Conferir antes de confirmar</div>'
      + '<div style="font-size:11px;color:var(--txt3);margin-bottom:12px">' + p.linhas.length
      + ' linhas · <strong>nada foi gravado ainda</strong></div>'
      + '<div class="kgrid k4">' + kpis.map(function (k) {
        return '<div class="kcard"><div class="klbl">' + k[0] + '</div><div class="kval" style="color:' + k[2] + '">'
          + k[1] + '</div></div>';
      }).join('') + '</div>';

    if (_impTipo === 'cadastro' && (r.vinculos.length || r.semVinculo.length)) {
      var remaneja = r.vinculos.filter(function (v) { return v.remaneja; }).length;
      var acessosAfetados = 0;
      r.vinculos.forEach(function (v) {
        acessosAfetados += ST.acessos.filter(function (a) {
          return a.estado === 'ativo' && (a.fornecedorCnpj === v.l.cnpj || a.cnpjs.indexOf(v.l.cnpj) >= 0);
        }).length;
      });
      var nv = r.vinculos.length;
      h += caixa('--amber-rgb', 'Grupo econômico — ' + nv + (nv === 1 ? ' vínculo muda' : ' vínculos mudam'),
        (nv - remaneja) + (nv - remaneja === 1 ? ' entra' : ' entram') + ' em um grupo · ' + remaneja
        + (remaneja === 1 ? ' muda' : ' mudam') + ' de grupo · ' + r.semVinculo.length
        + (r.semVinculo.length === 1 ? ' fica' : ' ficam') + ' sem vínculo<br>'
        + '<strong>Efeito no acesso:</strong> ' + acessosAfetados + ' acesso(s) ativo(s) mudam de alcance.');
    }

    function tabela(titulo, itens, cor, campo) {
      if (!itens.length) return '';
      var s = '<div style="font-size:12px;font-weight:700;color:' + cor + ';margin:16px 0 6px">' + titulo + '</div>'
        + '<div class="twrap"><table style="width:100%;border-collapse:collapse;font-size:11.5px"><thead><tr>'
        + ['Linha', 'CNPJ', 'Observação'].map(function (c) {
          return '<th style="text-align:left;padding:6px 8px;font-size:9px;font-weight:700;text-transform:uppercase;'
            + 'letter-spacing:.05em;color:var(--txt3);border-bottom:1px solid var(--brd)">' + c + '</th>';
        }).join('') + '</tr></thead><tbody>';
      itens.slice(0, 12).forEach(function (it) {
        s += '<tr><td style="padding:6px 8px;border-bottom:1px solid var(--brd);color:var(--txt3)" class="mono">#'
          + it.l._linha + '</td>'
          + '<td style="padding:6px 8px;border-bottom:1px solid var(--brd);color:var(--txt2)" class="mono">' + esc(it.l.cnpj) + '</td>'
          + '<td style="padding:6px 8px;border-bottom:1px solid var(--brd);color:var(--txt2)">' + esc(it[campo] || '') + '</td></tr>';
      });
      if (itens.length > 12) {
        s += '<tr><td colspan="3" style="padding:6px 8px;color:var(--txt3);font-size:10.5px">e mais '
          + (itens.length - 12) + '…</td></tr>';
      }
      return s + '</tbody></table></div>';
    }
    h += tabela('Criar', r.criar, 'var(--teal)', 'nota');
    h += tabela('Atualizar', r.atualizar, 'var(--blue)', 'nota');
    h += tabela('Vínculos de grupo', r.vinculos.map(function (v) {
      return { l: v.l, nota: v.remaneja ? 'muda de grupo: ' + v.de + ' → ' + v.para : 'entra em ' + v.para };
    }), 'var(--amber)', 'nota');
    h += tabela('Sem vínculo — o fornecedor entra, o vínculo não', r.semVinculo, 'var(--amber)', 'motivo');
    h += tabela('Ignorar', r.ignorar, 'var(--txt2)', 'nota');
    h += tabela('Inválidas — não impedem as demais', r.invalidas, 'var(--red)', 'motivo');

    var corpo = document.getElementById('acf-import-corpo');
    if (corpo) corpo.innerHTML = h;
    var b = document.getElementById('acf-imp-ok');
    if (b) {
      b.textContent = tot ? 'Confirmar ' + tot + ' alteraç' + (tot === 1 ? 'ão' : 'ões') : 'Nada a confirmar';
      b.setAttribute('onclick', tot ? 'acfImportConfirmar()' : '');
      b.disabled = !tot;
      b.style.opacity = tot ? '1' : '.5';
    }
    var st = document.getElementById('acf-imp-ok-status');
    if (st) {
      st.textContent = tot ? 'Nada foi gravado ainda.' : 'Nenhuma linha válida para gravar.';
      st.style.color = tot ? 'var(--txt3)' : 'var(--amber)';
    }
  };

  window.acfImportConfirmar = function () {
    if (!_impPrev) return;
    var r = _impPrev.res, base = {};
    (window.fornecedores || []).forEach(function (f) { base[f.cnpj] = f; });
    var criados = 0, atualizados = 0, convites = 0, vinculados = 0;

    if (_impTipo === 'cadastro') {
      r.criar.forEach(function (it) {
        var l = it.l;
        window.fornecedores.push({
          nome: l.razao_social, cnpj: l.cnpj, tipo: 'Matriz', grupoId: null, grupoNome: null, cnpjMatriz: null,
          volume: 0, cred: 0, status: (l.status || 'ativo').toLowerCase() === 'ativo' ? 'ok' : 'alerta',
          score: 70, pagtos: 0, pend: 0
        });
        criados++;
      });
      r.atualizar.forEach(function (it) {
        var f = base[it.l.cnpj];
        if (!f) return;
        if (it.l.razao_social) f.nome = it.l.razao_social;
        if (it.l.status) f.status = it.l.status.toLowerCase() === 'ativo' ? 'ok' : it.l.status.toLowerCase() === 'inativo' ? 'alerta' : 'risco';
        atualizados++;
      });
      /* 2ª passada aplicada */
      var mapa = {};
      (window.fornecedores || []).forEach(function (f) { mapa[f.cnpj] = f; });
      r.vinculos.forEach(function (v) {
        var f = mapa[v.l.cnpj];
        if (!f) return;
        var m = (v.l.cnpj_matriz || '').trim();
        if (m.toUpperCase() === 'SEM_GRUPO') {
          f.cnpjMatriz = null; f.tipo = 'Matriz'; f.grupoNome = null;
        } else {
          var matriz = mapa[m];
          f.cnpjMatriz = m; f.tipo = 'Filial';
          if (matriz) { f.grupoId = matriz.grupoId; f.grupoNome = matriz.grupoNome; }
        }
        vinculados++;
      });
      /* acessos existentes acompanham o novo alcance do grupo */
      ST.acessos.forEach(function (a) { a.cnpjs = grupoDe(a.fornecedorCnpj); });
    } else if (_impTipo === 'status') {
      r.atualizar.forEach(function (it) {
        var f = base[it.l.cnpj];
        if (!f) return;
        var s = it.l.status.toLowerCase();
        f.status = s === 'ativo' ? 'ok' : s === 'inativo' ? 'alerta' : 'risco';
        atualizados++;
        if (s !== 'ativo') {
          acessosDe(f.cnpj).filter(function (a) { return a.estado === 'ativo'; })
            .forEach(function (a) { a.revisar = true; });
        }
      });
    } else {
      r.criar.forEach(function (it) {
        var l = it.l;
        var c = {
          id: novoId('CNV'), fornecedorCnpj: l.cnpj, nome: l.nome, email: l.email.toLowerCase(),
          papel: l.papel.toLowerCase(), cnpjs: grupoDe(l.cnpj), estado: 'enviado', criadoEm: new Date(),
          expiraEm: maisDias(7), criadoPor: usuario(), reenvios: 0
        };
        ST.convites.push(c);
        convites++;
      });
    }

    var lote = {
      id: 'IMP-' + ('000' + (ST.lotes.length + 40)).slice(-4), tipo: _impTipo, quando: new Date(), autor: usuario(),
      linhas: _impPrev.linhas.length, ok: criados + atualizados + convites, erros: r.invalidas.length,
      semVinculo: r.semVinculo.length, vinculados: vinculados,
      detalhe: r.invalidas.map(function (i) { return { linha: i.l._linha, cnpj: i.l.cnpj, motivo: i.motivo, fazer: i.fazer }; })
        .concat(r.semVinculo.map(function (i) { return { linha: i.l._linha, cnpj: i.l.cnpj, motivo: i.motivo, fazer: 'Conferir a coluna cnpj_matriz' }; })),
      csv: (document.getElementById('acf-csv') || {}).value || ''
    };
    ST.lotes.unshift(lote);
    evento('importacao', usuario(), lote.id, TIPOS[_impTipo].nome + ' · ' + lote.ok + ' ok · ' + lote.erros + ' erros');

    acfImportRelatorio(lote);
    try { if (window.adminFornRenderTable) window.adminFornRenderTable(); } catch (e) {}
    try { if (window.adminFornRenderKPIs) window.adminFornRenderKPIs(); } catch (e) {}
    window.acfRenderPainel();
  };

  window.acfImportRelatorio = function (lote) {
    var corpo = document.getElementById('acf-import-corpo');
    if (!corpo) return;
    var h = caixa('--teal-alt-rgb', 'Importação concluída · lote ' + lote.id,
      '<strong>' + lote.ok + '</strong> registro' + (lote.ok === 1 ? '' : 's') + ' gravado' + (lote.ok === 1 ? '' : 's')
      + (lote.tipo === 'cadastro' ? ' · ' + lote.vinculados + ' vínculo' + (lote.vinculados === 1 ? '' : 's')
        + ' de grupo · ' + lote.semVinculo + ' sem vínculo' : '')
      + ' · <strong>' + lote.erros + '</strong> não entr' + (lote.erros === 1 ? 'ou' : 'aram')
      + '<br><span style="color:var(--txt3)">' + fmtDH(lote.quando) + ' · ' + esc(lote.autor) + ' · '
      + lote.linhas + ' linhas no arquivo</span>');

    if (lote.detalhe.length) {
      h += '<div style="font-size:12px;font-weight:700;color:var(--txt1);margin:16px 0 4px">O que não entrou</div>'
        + '<div style="font-size:11px;color:var(--txt3);margin-bottom:8px">Corrija estas linhas e importe de novo — '
        + 'o que já entrou não será duplicado.</div>'
        + '<div class="twrap"><table style="width:100%;border-collapse:collapse;font-size:11.5px"><thead><tr>'
        + ['Linha', 'CNPJ', 'Motivo', 'O que fazer'].map(function (c) {
          return '<th style="text-align:left;padding:6px 8px;font-size:9px;font-weight:700;text-transform:uppercase;'
            + 'letter-spacing:.05em;color:var(--txt3);border-bottom:1px solid var(--brd)">' + c + '</th>';
        }).join('') + '</tr></thead><tbody>';
      lote.detalhe.forEach(function (d) {
        h += '<tr><td style="padding:6px 8px;border-bottom:1px solid var(--brd);color:var(--txt3)" class="mono">#' + d.linha + '</td>'
          + '<td style="padding:6px 8px;border-bottom:1px solid var(--brd);color:var(--txt2)" class="mono">' + esc(d.cnpj) + '</td>'
          + '<td style="padding:6px 8px;border-bottom:1px solid var(--brd);color:var(--txt2)">' + esc(d.motivo) + '</td>'
          + '<td style="padding:6px 8px;border-bottom:1px solid var(--brd);color:var(--txt2)">' + esc(d.fazer) + '</td></tr>';
      });
      h += '</tbody></table></div>'
        + '<div style="margin-top:12px"><button class="btn" style="font-size:11px" onclick="acfBaixarErros(\''
        + lote.id + '\')">Baixar só as linhas com erro</button></div>';
    } else {
      h += '<div style="font-size:12px;color:var(--txt2);margin-top:14px">Nenhuma linha ficou de fora.</div>';
    }
    corpo.innerHTML = h;
    var b = document.getElementById('acf-imp-ok');
    if (b) {
      b.textContent = 'Fechar';
      b.setAttribute('onclick', "document.getElementById('acf-import-overlay').remove()");
      b.disabled = false;
      b.style.opacity = '1';
    }
    var st = document.getElementById('acf-imp-ok-status');
    if (st) { st.textContent = 'Lote ' + lote.id + ' registrado no histórico.'; st.style.color = 'var(--teal)'; }
    toast(lote.ok + ' registros gravados no lote ' + lote.id + '.', 'ok');
  };

  window.acfBaixarErros = function (loteId) {
    var l = ST.lotes.filter(function (x) { return x.id === loteId; })[0];
    if (!l) return;
    var csv = 'linha;cnpj;motivo\n' + l.detalhe.map(function (d) {
      return d.linha + ';' + d.cnpj + ';' + d.motivo;
    }).join('\n');
    var a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = 'erros-' + loteId + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  /* ══ T-12 · histórico de lotes ═════════════════════════════════════════════ */
  window.acfAbrirHistorico = function () {
    var id = 'acf-hist-overlay';
    fechar(id);
    var h = '';
    if (!ST.lotes.length) {
      h = '<div style="font-size:12px;color:var(--txt3);padding:20px 0;text-align:center">Nenhuma importação ainda.</div>';
    } else {
      h = '<div class="twrap"><table style="width:100%;border-collapse:collapse;font-size:11.5px"><thead><tr>'
        + ['Lote', 'Tipo', 'Quando', 'Autor', 'Resultado', ''].map(function (c) {
          return '<th style="text-align:left;padding:6px 8px;font-size:9px;font-weight:700;text-transform:uppercase;'
            + 'letter-spacing:.05em;color:var(--txt3);border-bottom:1px solid var(--brd)">' + c + '</th>';
        }).join('') + '</tr></thead><tbody>';
      ST.lotes.forEach(function (l) {
        h += '<tr><td style="padding:7px 8px;border-bottom:1px solid var(--brd);color:var(--txt1);font-weight:600" class="mono">'
          + l.id + '</td>'
          + '<td style="padding:7px 8px;border-bottom:1px solid var(--brd);color:var(--txt2)">' + esc(TIPOS[l.tipo].nome) + '</td>'
          + '<td style="padding:7px 8px;border-bottom:1px solid var(--brd);color:var(--txt2);white-space:nowrap">' + fmtDH(l.quando) + '</td>'
          + '<td style="padding:7px 8px;border-bottom:1px solid var(--brd);color:var(--txt2)">' + esc(l.autor) + '</td>'
          + '<td style="padding:7px 8px;border-bottom:1px solid var(--brd);color:var(--txt2)">' + l.ok + ' ok · ' + l.erros + ' erros</td>'
          + '<td style="padding:7px 8px;border-bottom:1px solid var(--brd);text-align:right">'
          + (l.detalhe.length ? '<button class="btn" style="font-size:10.5px;padding:3px 9px" onclick="acfBaixarErros(\''
            + l.id + '\')">Baixar erros</button>' : '<span style="color:var(--txt3)">—</span>') + '</td></tr>';
      });
      h += '</tbody></table></div>';
    }
    document.body.insertAdjacentHTML('beforeend',
      '<div id="' + id + '" class="moverlay" onclick="if(event.target===this)this.remove()">'
      + '<div class="mbox" style="width:760px;max-width:100%">'
      + cabecalho(id, '🗂', 'Histórico de importações', 'Todo lote guarda o arquivo original')
      + '<div class="mbox-col" style="flex:1;min-height:0">' + h + '</div>'
      + '<div style="display:flex;justify-content:flex-end;padding:14px 18px;border-top:1px solid var(--brd)">'
      + '<button class="btn" onclick="document.getElementById(\'' + id + '\').remove()">Fechar</button></div>'
      + '</div></div>');
  };

  /* ══ Selo de modo demonstração ═════════════════════════════════════════════
     A troca de perfil em sessão permanece — é recurso de demonstração, e sai
     do produto antes da primeira instalação com dados reais. Marcá-la na
     interface evita que a visão simulada seja confundida com a do fornecedor. */
  window.acfSeloDemo = function () {
    return '<span title="A troca de perfil existe para demonstrar o produto. Num ambiente real, o fornecedor entra '
      + 'por convite e senha própria." style="display:inline-block;font-size:9px;font-weight:700;letter-spacing:.05em;'
      + 'padding:2px 7px;border-radius:3px;background:rgba(var(--amber-rgb),.14);color:var(--amber);'
      + 'border:1px solid rgba(var(--amber-rgb),.35);white-space:nowrap">MODO DEMONSTRAÇÃO</span>';
  };

  /* ── Redesenho após qualquer ação ───────────────────────────────────────── */
  window.acfRefresh = function (cnpj) {
    var alvo = document.getElementById('acf-aba-acessos');
    if (alvo && cnpj) alvo.innerHTML = window.acfAbaAcessos(cnpj);
    try { window.acfRenderPainel(); } catch (e) {}
  };

  window.acfInit = function () {
    semear();
    try { window.acfRenderPainel(); } catch (e) {}
    var d = document.getElementById('sett-perfil-demo');
    if (d && !d.innerHTML) d.innerHTML = window.acfSeloDemo();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(window.acfInit, 300); });
  } else {
    setTimeout(window.acfInit, 300);
  }
})();
