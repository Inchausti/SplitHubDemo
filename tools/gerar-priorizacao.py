# -*- coding: utf-8 -*-
"""Gera src/docs/priorizacao-mvp.html a partir do Mapa de Funcionalidades.

    python tools/gerar-priorizacao.py

O mapa e a fonte da verdade do INVENTARIO; este arquivo e a fonte da verdade da
PRIORIZACAO. Ao acrescentar funcionalidade ao mapa, acrescente a faixa dela em
FAIXAS, na mesma posicao — o script falha se as duas listas divergirem, e essa
falha e proposital: e o que impede a priorizacao de envelhecer sem ninguem ver.

Faixas: M0 (MVP) · M1 (escala) · M2 (inteligencia) · X (sem faixa).
Ver a skill priorizacao-mvp para o procedimento completo.
"""
import io
import json
import os
import re

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(RAIZ, 'src', 'docs') + os.sep
DEST = BASE + 'priorizacao-mvp.html'


def carregar_mapa():
    """Le MODS do mapa resumido: [[indice, nome, [(funcionalidade, tipo)]]]."""
    s = io.open(BASE + 'mapa-funcionalidades.html', encoding='utf-8').read()
    blocos = re.split(r"/\* \d+ \*/ \{", s)[1:]
    out = []
    for bi, b in enumerate(blocos):
        nome = re.search(r"name:'([^']+)'", b).group(1)
        fs = re.findall(r"\{n:'([^']+)',\s*t:'(\w)'\}", b)
        out.append([bi, nome, fs])
    return out


MODS = carregar_mapa()

# faixa por modulo: lista com a faixa de cada funcionalidade, na ordem do mapa
FAIXAS = {
    0:  ['M0','M2','M2','M2','M0','M0'],
    1:  ['M0','M0','M0','M0','M2','M0','M2','M2','M2','M0','M0','M0','M0','M0'],
    2:  ['M0','M0','M1','M1','M0','M1'],
    3:  ['M0','M0','M0','M0','M1','M1','M1','M0','M0','M1','M1','M0','M0'],
    4:  ['M0','M0','M0','M0','M0','M1','M0','M1','M0'],
    5:  ['M0','M0','M0','M0','M0','M0','M0'],
    6:  ['M2']*7,
    7:  ['M2']*6,
    8:  ['M0','M0','M0','M0','M0','M1','M0'],
    9:  ['M0','M0','M1','M0','M2','M0','M0','M0','M0','M0','M0','M0'],
    10: ['M0','M2','M0','M0','M1'],
    11: ['M0','M0','M1','M1','M1','M1','M1','M0','M1','M1','M0','M1'],
    12: ['M0','M0','M0','M0','M0','M0','M0','M0','M0','X','X','M0'],
    13: ['M0','M1','M1','M1','M1','M1','M0','M0','M1','M1','M1','M0','M1','M1','M1'],
    14: ['M1']*16,
    15: ['M0','M0','M0','M0','M1','M0','M0','M1'],
    16: ['M0','M1','M0','M0','M0','M0','M1'],
    17: ['M2']*4,
    18: ['M1','M1','M1','M1','M1','M0','M0','M0','M0','M0','M0'],
    19: ['M1','M1','M1','M1','M1','M0'],
}

# justificativa do corte, por modulo
NOTA = {
    0:  u'Só o que responde “onde está meu crédito hoje”. Forecast e cockpit dependem de série histórica que o piloto ainda não tem.',
    1:  u'O módulo que a tese defende entra quase inteiro. Ficam fora os quatro gráficos analíticos — eles explicam o crédito, não o garantem.',
    2:  u'Débito entra só para a apuração fechar. O produto se vende pelo crédito.',
    3:  u'Entra a guia, o comprovante e o rastro dos três status. A entrega ao ERP passa ao M0 junto com a API. Fica fora o que depende de execução programada.',
    4:  u'A inconsistência é o que impede o crédito de morrer em silêncio. Fica fora só o que distribui trabalho entre pessoas.',
    5:  u'A porta de entrada inteira, inclusive por API: com a decisão de 14/09, o documento entra por arquivo ou por integração desde o primeiro dia.',
    6:  u'Projeção pressupõe base real acumulada. Não existe piloto que comece por aqui.',
    7:  u'Score de fornecedor é argumento de renovação, não de adoção.',
    8:  u'Os três métodos de pagamento são pré-requisito: sem saber quem recolhe, não há cadeia. O contrato como recorte de política acompanha Execução RAD.',
    9:  u'Deixou de ser só cadastro: ganhou a gestão de acesso do fornecedor e a importação em massa, implementadas em 14/09. Score de conformidade e trilha de auditoria seguem depois.',
    10: u'Hierarquia e filtro de grupo econômico atravessam todas as telas — sem eles, nenhum número fecha.',
    11: u'Recortado em 14/09: entram o painel inicial, a listagem dos documentos contra o comprador, os comprovantes de pagamento e o acesso por convite. O resto do portal — inclusive o que já está implementado — fica para depois. Ver seção 05.',
    12: u'Login, perfis e o sistema de design, mais o selo de modo demonstração da troca de perfil. O SSO corporativo continua sendo a única funcionalidade do MVP que não existe em parte alguma.',
    13: u'O corte mais duro: 4 de 15. O MVP precisa conseguir gerar a guia, não otimizar quando gerá-la. O vínculo com a conexão de destino volta ao M1: sem tela de conexões, não há o que vincular.',
    14: u'<strong>Nenhuma</strong> das 16 no M0, por revisão de 14/09: no primeiro momento a configuração é por variável de ambiente, e não por tela. As quatro integrações externas a desenvolver seguem em M0 — ver seção 06.',
    15: u'A prova de que o recolhimento aconteceu. Sem conciliação, o crédito é uma afirmação sem lastro.',
    16: u'A apuração é onde o crédito vira número exigível. Entra o ciclo calcular–concluir–reabrir.',
    17: u'Depende de base legal indexada e de confiança que um piloto ainda não tem.',
    18: u'A <strong>régua de cobrança</strong> entra no M0 por decisão de 14/09: cobrança não feita é crédito perdido. Relatórios agendados e ITSM ficam em M1 — esses automatizam trabalho, não protegem crédito.',
    19: u'Multiusuário interno é consequência de adoção. A exceção é o painel de acessos externos, que entrou no M0 junto com o acesso do fornecedor.',
}

CORES = {'M0': 'teal', 'M1': 'info', 'M2': 'ref', 'X': 'warn'}
ROTULO = {'M0': 'M0', 'M1': 'M1', 'M2': 'M2', 'X': 'Fora'}

# ordem de construcao dentro do M0, onde o modulo e grande demais para entrar de uma vez
PRIO = {

}
PRIO_NOTA = {
    'P1': u'Núcleo — sem isto o portal não tem razão de existir',
    'P2': u'Contexto — o fornecedor entende o que vê',
    'P3': u'Relacionamento — melhora a conversa, não a cadeia',
}

# funcionalidades que NAO existem no produto e entram na priorizacao mesmo assim
NOVAS = {
    18: [
        (u'Motor de execução das automações', 'c', 'M0', None,
         u'O que faz a régua disparar: avaliação diária dos registros contra as etapas, respeito ao teto de envios e '
         u'ao intervalo, e registro do disparo. Não existe hoje — o módulo desenha automações e não executa nenhuma.'),
        (u'Envio de e-mail transacional', 'c', 'M0', None,
         u'Provedor de envio, com registro de entrega e devolução. Serve à régua e também ao convite do fornecedor, '
         u'que hoje é simulado na tela. Sem ele, régua ativa é régua que não cobra ninguém.'),
    ],
    11: [
        (u'Painel inicial do fornecedor', 'g', 'M0', None,
         u'O que ele deve, o que já foi recolhido e o que vence a seguir, em quatro números. É a tela que responde '
         u'“preciso fazer alguma coisa hoje?” antes de qualquer listagem.'),
        (u'Comprovantes de pagamento disponíveis ao fornecedor', 'l', 'M0', None,
         u'Quando o adquirente recolhe — por RAD ou por recolhimento assumido —, o comprovante fica disponível ao '
         u'fornecedor no próprio documento. Hoje o fluxo existe só na direção contrária: o fornecedor envia o dele.'),
    ],
    14: [
        (u'Integração com a Receita Federal — CBS', 'c', 'M0', 'P1',
         u'Apuração assistida da CBS na Plataforma da RFB: autenticação, solicitação e retirada do resultado '
         u'apurado por período. É a metade federal do confronto que hoje a conciliação simula.'),
        (u'Integração com o Comitê Gestor — IBS', 'c', 'M0', 'P1',
         u'Apuração assistida do IBS no CG-IBS: credencial própria, recebimento por webhook e arquivo diferencial, '
         u'com a conta corrente fiscal por operação. É a outra metade do confronto.'),
        (u'Integração RAD', 'a', 'M0', 'P1',
         u'Geração e liquidação da guia de recolhimento pelo adquirente junto ao órgão arrecadador, com retorno do '
         u'pagamento. Hoje a guia é produzida dentro do produto e o comprovante volta à mão.'),
        (u'Integração Databricks para comprovantes', 'c', 'M0', 'P2',
         u'Ingestão de comprovantes de recolhimento a partir do lakehouse do cliente, em vez de upload arquivo a '
         u'arquivo. É o que alimenta a conciliação financeira em volume.'),
    ],
    12: [(u'Login via SSO corporativo', 'a', 'M0', 'P1',
          u'Entrada pelo provedor de identidade da empresa (SAML 2.0 ou OIDC), com provisionamento e revogação '
          u'vindos de lá. Não existe no produto: hoje o acesso é uma senha no código.')],
}

# contextos da API (src/js/integracoes.js), com a faixa de cada um
CONTEXTOS = [
    (u'Ingestão de documentos fiscais', u'entrada', 'M0',
     u'<code>POST /v1/dfs</code> individual e em lote, consulta e correção. É a porta de entrada do documento — '
     u'sem ela, todo piloto começa por upload de arquivo.'),
    (u'RAD ↔ ERP', u'as duas direções', 'M0',
     u'<code>rad.darf_recebida</code> leva a guia ao ERP; <code>POST /v1/rad/proofs</code> traz o comprovante de volta. '
     u'É o contexto que fecha o ciclo financeiro sem digitação.'),
    (u'Garantia de crédito', u'saída', 'M0',
     u'<code>credito.status_alterado</code> e <code>debito.status_alterado</code> — o ciclo de vida do crédito, '
     u'com o documento que o consumiu e os créditos que abateram cada débito. É o que a contabilidade do cliente consome.'),
    (u'Base de fornecedores', u'entrada', 'M1',
     u'Cadastro por API. No M0 o fornecedor é cadastrado na tela — o volume de um piloto não justifica a integração.'),
    (u'Contratos entre CNPJs', u'entrada', 'M1',
     u'Contrato por API. Mesma lógica: no M0 o contrato é cadastrado na tela, e é ele que define quem recolhe.'),
    (u'Automações', u'saída', 'M1',
     u'<code>automation.executed</code> e <code>automation.failed</code>. Acompanha o módulo de Automações, que é M1 inteiro.'),
]

# ── contagens ──────────────────────────────────────────────────────────────
tot = {'M0': 0, 'M1': 0, 'M2': 0, 'X': 0}
NOVAS_N = 0
por_mod = []
for bi, nome, fs in MODS:
    f = list(FAIXAS[bi])
    assert len(f) == len(fs), (bi, nome, len(f), len(fs))
    fs = [(n, t, False) for (n, t) in fs]
    p = list(PRIO.get(bi, []))
    for (n, t, fx, pr, d) in NOVAS.get(bi, []):
        fs.append((n, t, True))
        f.append(fx)
        if p:
            p.append(pr)
        NOVAS_N += 1
    c = {'M0': 0, 'M1': 0, 'M2': 0, 'X': 0}
    for x in f:
        c[x] += 1
        tot[x] += 1
    por_mod.append((bi, nome, fs, f, c, p))
TOTAL = sum(tot.values())
DO_MAPA = TOTAL - NOVAS_N


def pct(n):
    return int(round(100.0 * n / TOTAL))


def chip(faixa):
    return u'<span class="chip %s">%s</span>' % (CORES[faixa], ROTULO[faixa])


# ── head reaproveitado ─────────────────────────────────────────────────────
src = io.open(BASE + 'duplicata-escritural-rad-validacao.html', encoding='utf-8').read()
head = src[:src.index('</head>')]
head = head.replace(u'<title>Duplicata Escritural — Validação RAD · SplitHub</title>',
                    u'<title>Priorização para o MVP · SplitHub</title>')

EXTRA = u"""
/* ── Barra de faixas ── */
.faixa-bar { display: flex; height: 34px; border-radius: 8px; overflow: hidden; border: 1px solid var(--brd); margin: 18px 0 10px; }
.faixa-seg { display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; color: var(--sur); }
.seg-m0 { background: var(--teal); }
.seg-m1 { background: var(--blue); }
.seg-m2 { background: var(--purple); }
.seg-x  { background: var(--txt3); }
.faixa-key { display: flex; flex-wrap: wrap; gap: 16px; font-size: 11.5px; color: var(--txt2); }
.faixa-key span b { color: var(--txt1); }
.dot { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-right: 6px; }

/* ── Módulo ── */
.mod { background: var(--sur); border: 1px solid var(--brd); border-radius: 10px; margin: 14px 0; box-shadow: var(--shadow-sm); overflow: hidden; }
.mod-hdr { display: flex; flex-wrap: wrap; align-items: baseline; gap: 10px; padding: 13px 18px; background: var(--sur2); border-bottom: 1px solid var(--brd); }
.mod-name { font-size: 13.5px; font-weight: 700; color: var(--txt1); }
.mod-count { font-size: 11px; color: var(--txt3); font-weight: 600; margin-left: auto; white-space: nowrap; }
.mod-note { padding: 12px 18px 4px; font-size: 12.5px; color: var(--txt2); }
.mod-list { list-style: none; padding: 8px 18px 16px; display: flex; flex-direction: column; gap: 0; }
.mod-list li { display: flex; gap: 10px; align-items: baseline; padding: 6px 0; border-bottom: 1px solid var(--brd); font-size: 12.5px; color: var(--txt2); min-width: 0; }
.mod-list li:last-child { border-bottom: none; }
.mod-list .fx { flex-shrink: 0; width: 42px; }
.mod-list .pr { flex-shrink: 0; width: 24px; font-family: 'JetBrains Mono', monospace; font-size: 10.5px; font-weight: 700; color: var(--txt3); }
.mod-list .nm { min-width: 0; overflow-wrap: anywhere; }
.mod-list li.is-m0 .nm { color: var(--txt1); font-weight: 600; }

/* ── Decisão ── */
.dec { display: flex; gap: 14px; padding: 14px 0; border-bottom: 1px solid var(--brd); align-items: flex-start; }
.dec:last-child { border-bottom: none; }
.dec-num { font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 800; color: var(--teal); background: var(--teal-d); border-radius: 4px; padding: 2px 8px; flex-shrink: 0; }
.dec-body { min-width: 0; }
.dec-q { font-size: 13px; font-weight: 700; color: var(--txt1); margin-bottom: 4px; }
.dec-r { font-size: 12.5px; color: var(--txt2); }
.dec-r em { color: var(--teal); font-style: normal; font-weight: 700; }
"""
head = head.replace(u'</style>', EXTRA + u'</style>')

# ── corpo ──────────────────────────────────────────────────────────────────
B = []
A = B.append

A(u'</head>\n<body>\n<div class="doc">')
A(u'<a class="back" href="prds.html">← Hub de PRDs</a>')
A(u'<div class="eyebrow">SplitHub <span class="eyebrow-sep">·</span> Produto <span class="eyebrow-sep">·</span> Proposta</div>')
A(u'<h1>Priorização para o MVP</h1>')
A(u'<p class="subtitle">As %d funcionalidades do produto distribuídas em quatro faixas de entrega, '
  u'a partir de um único critério: a cadeia mínima que faz um crédito nascer, ser garantido e ser apropriado.</p>' % DO_MAPA)

A(u'<div class="meta-bar">'
  u'<div class="meta-pill"><span class="meta-label">Versão</span><span class="meta-val">v1.9</span></div>'
  u'<div class="meta-pill"><span class="meta-label">Status</span><span class="chip ok">Aprovada · em implementação</span></div>'
  u'<div class="meta-pill"><span class="meta-label">Base</span><span class="meta-val">Mapa de Funcionalidades v2.1</span></div>'
  u'<div class="meta-pill"><span class="meta-label">Escopo</span><span class="meta-val">%d do mapa + %d novas · 20 módulos</span></div>'
  u'<div class="meta-pill"><span class="meta-label">Data</span><span class="meta-val">14/09/2026</span></div>'
  u'</div>' % (DO_MAPA, NOVAS_N))

# 01 criterio
A(u'<div class="section">')
A(u'<div class="sec-hdr"><span class="sec-num">01</span><span class="sec-title">O critério</span></div>')
A(u'<p class="sec-sub">Um corte por módulo não serve. Quase todo módulo tem uma parte essencial e uma parte de conforto — '
  u'Crédito tem a listagem que sustenta a operação e quatro gráficos que a explicam; Execução RAD tem a geração da guia e '
  u'onze funcionalidades que decidem <em>quando</em> gerá-la. Cortar por módulo levaria as duas coisas juntas, nos dois sentidos.</p>')
A(u'<p class="sec-sub">O critério é a <strong>cadeia mínima do crédito</strong>. Uma funcionalidade entra no MVP se a cadeia '
  u'não se fecha sem ela:</p>')
A(u'<div class="flow">')
CADEIA = [
    (u'1', 'teal', u'O documento entra', u'Sem ingestão não há o que apurar. Documento rejeitado vira stub e inconsistência — não desaparece.'),
    (u'2', 'teal', u'O método de pagamento é conhecido', u'RAD, Fornecedor ou Split Payment. É o contrato que diz quem recolhe, e disso depende todo o resto.'),
    (u'3', 'blue', u'O tributo é recolhido', u'Pela via que couber: a guia gerada pela política, ou o recolhimento assumido pelo adquirente quando o fornecedor não recolhe.'),
    (u'4', 'blue', u'O recolhimento é confirmado', u'Conciliação contra a Apuração Assistida e contra o comprovante. Sem isso o crédito é afirmação sem lastro.'),
    (u'5', 'amber', u'O crédito é apropriado', u'A apuração da competência transforma o crédito confirmado em número exigível.'),
    (u'6', 'amber', u'O que falhou vira tratável', u'Toda quebra da cadeia aparece como inconsistência com dono, estado e histórico.'),
]
for i, (num, cor, tit, desc) in enumerate(CADEIA):
    A(u'<div class="flow-step"><div class="flow-left"><div class="flow-dot %s">%s</div>%s</div>'
      u'<div class="flow-body"><div class="flow-title">%s</div><div class="flow-desc">%s</div></div></div>'
      % (cor, num, u'' if i == len(CADEIA) - 1 else u'<div class="flow-connector"></div>', tit, desc))
A(u'</div>')
A(u'<div class="callout info"><div class="callout-title">Consequência do critério</div>'
  u'<p>Analytics, FCT e Inteligência ficam fora do MVP <strong>mesmo estando prontos</strong>. '
  u'Eles explicam o crédito; não o garantem. Prontidão não é argumento de prioridade.</p></div>')
A(u'</div>')

# 02 faixas
A(u'<div class="section">')
A(u'<div class="sec-hdr"><span class="sec-num">02</span><span class="sec-title">As quatro faixas</span></div>')
A(u'<div class="faixa-bar">')
for f, cls in (('M0', 'seg-m0'), ('M1', 'seg-m1'), ('M2', 'seg-m2'), ('X', 'seg-x')):
    A(u'<div class="faixa-seg %s" style="width:%d%%">%s</div>' % (cls, pct(tot[f]), ROTULO[f] if pct(tot[f]) > 4 else u''))
A(u'</div>')
A(u'<div class="table-wrap"><table><thead><tr><th>Faixa</th><th>Funcs.</th><th>%</th><th>O que é</th></tr></thead><tbody>')
FX = [
    ('M0', u'MVP', u'A cadeia do crédito, ponta a ponta, para uma operação e um time pequeno.'),
    ('M1', u'Escala', u'O que tira o operador do meio: orquestração, ERP, portal do fornecedor, automações, multiusuário.'),
    ('M2', u'Inteligência', u'Projeção, score e assistente — valor construído sobre a base que o M0 e o M1 produzem.'),
    ('X',  u'Sem faixa', u'Qualidade de engenharia transversal. Entra junto com o que precisa dela, não como item de escopo.'),
]
for f, nome, desc in FX:
    A(u'<tr><td>%s <strong>%s</strong></td><td><strong>%d</strong></td><td>%d%%</td><td>%s</td></tr>'
      % (chip(f), nome, tot[f], pct(tot[f]), desc))
A(u'</tbody></table></div>')
A(u'<div class="callout warn"><div class="callout-title">O que as decisões de 14/09 mudaram</div>'
  u'<p>O corte original deixava o MVP em 71 funcionalidades (41%%). Com <strong>API</strong>, <strong>Portal do Fornecedor</strong> '
  u'e <strong>SSO</strong> no M0, ele passa a <strong>%d</strong> (%d%%) — o MVP dobrou de peso e deixou de ser um subconjunto '
  u'enxuto para virar a maior parte do produto.</p>'
  u'<p style="margin-top:8px">Isso é uma escolha legítima: as três decisões trocam <em>tempo até o piloto</em> por '
  u'<em>capacidade de rodar sem operador no meio</em>. Mas elas trazem junto duas dependências externas — o calendário do ERP '
  u'e o do provedor de identidade — e nenhuma delas está sob o controle do time.</p></div>'
  % (tot['M0'], pct(tot['M0'])))
A(u'</div>')

# 03 modulo a modulo
A(u'<div class="section">')
A(u'<div class="sec-hdr"><span class="sec-num">03</span><span class="sec-title">Funcionalidade a funcionalidade</span></div>')
A(u'<p class="sec-sub">Os 20 módulos na ordem do Mapa de Funcionalidades. Em destaque, o que entra no M0.</p>')
for bi, nome, fs, f, c, p in por_mod:
    resumo = u' · '.join(u'%s %d' % (ROTULO[k], c[k]) for k in ('M0', 'M1', 'M2', 'X') if c[k])
    A(u'<div class="mod">')
    A(u'<div class="mod-hdr"><span class="mod-name">%s</span>%s<span class="mod-count">%s · %d no total</span></div>'
      % (nome, chip('M0') if c['M0'] else u'', resumo, len(fs)))
    A(u'<div class="mod-note">%s</div>' % NOTA[bi])
    A(u'<ul class="mod-list">')
    for i, ((n, t, novo), fx) in enumerate(zip(fs, f)):
        pr = u'<span class="pr">%s</span>' % p[i] if p else u''
        nv = u' <span class="chip warn">Novo</span>' if novo else u''
        A(u'<li class="%s"><span class="fx">%s</span>%s<span class="nm">%s%s</span></li>'
          % ('is-m0' if fx == 'M0' else '', chip(fx), pr, n, nv))
    A(u'</ul></div>')
A(u'</div>')

# 04 cortes que doem
A(u'<div class="section">')
A(u'<div class="sec-hdr"><span class="sec-num">04</span><span class="sec-title">O que foi decidido, e o corte que resta</span></div>')
A(u'<p class="sec-sub">Quatro decisões já foram tomadas em 14/09/2026 e estão refletidas na atribuição acima.</p>')
A(u'<div class="table-wrap"><table><thead><tr><th>Decisão</th><th>Efeito no M0</th><th>O que vem junto</th></tr></thead><tbody>')
A(u'<tr><td><strong>API em três contextos</strong></td><td>Ingestão de DFs, RAD ↔ ERP e garantia de crédito, '
  u'mais ingestão por API e entrega ao ERP</td>'
  u'<td>O comprovante deixa de depender de upload manual, e o prazo do piloto passa a incluir o calendário do time '
  u'de ERP do cliente</td></tr>')
A(u'<tr><td><strong>Módulo de Integrações fora do M0</strong></td>'
  u'<td>As 16 funcionalidades de gestão — catálogo, conexões, credenciais, escopos, log de entregas — vão para M1</td>'
  u'<td>No primeiro momento a configuração é por <strong>variável de ambiente</strong>. O vínculo da política de '
  u'execução com a conexão de destino volta ao M1 junto: sem tela de conexões, não há o que vincular</td></tr>')
A(u'<tr><td><strong>Portal do Fornecedor — <em>recortado</em></strong></td>'
  u'<td>Quatro entregas: acesso por convite, painel inicial, listagem dos documentos contra o comprador e '
  u'comprovantes de pagamento. As outras oito vão para M1 — ver seção 05</td>'
  u'<td>Primeira superfície do produto exposta a quem não é do time. No MVP o fornecedor <em>se informa</em>; '
  u'agir pelo portal — comprovante, contestação, chat — fica para depois</td></tr>')
A(u'<tr><td><strong>SSO corporativo</strong></td><td>Funcionalidade nova, que não existe no produto</td>'
  u'<td>Substitui a senha de acesso hoje escrita no código, e encerra a iniciativa pausada em 11/09</td></tr>')
A(u'<tr><td><strong>Fornecedor entra por convite</strong></td><td>Segunda funcionalidade nova, no núcleo do portal</td>'
  u'<td>Convite por e-mail com senha própria, redefinição e revogação — mais barato que link assinado ou federação</td></tr>')
A(u'</tbody></table></div>')
A(u'<div class="callout warn"><div class="callout-title">A decisão da régua é a única que exige software novo de '
  u'infraestrutura</div>'
  u'<p>Todas as outras recortam o que já existe. A régua em M0 exige <strong>motor de execução</strong> e '
  u'<strong>envio de e-mail</strong> — duas peças que o produto nunca teve, e que nenhum outro item do MVP obriga a '
  u'construir. Em compensação, o e-mail resolve junto o convite do fornecedor, hoje simulado na tela.</p></div>')
A(u'<p class="sec-sub" style="margin-top:22px">Com elas resolvidas, resta <strong>um</strong> corte duro:</p>')
A(u'<div class="info-card"><div class="info-card-title">Execução RAD — 5 de 15 no M0</div><ul>'
  u'<li>É o módulo mais completo do protótipo e o que menos prova a tese.</li>'
  u'<li>Entram: a política de execução, a janela, os critérios de inclusão, a listagem com o lote ao vivo e o vínculo '
  u'com a conexão de destino.</li>'
  u'<li>Ficam fora: orquestração por CNPJ, por contrato e por faixa de valor, as quatro bases de comparação, '
  u'a simulação e os alertas de sobreposição.</li>'
  u'<li>Racional: o MVP precisa <strong>conseguir gerar a guia</strong>, não decidir com precisão quando gerá-la.</li>'
  u'<li>Revisar se o piloto tiver volume alto de documentos por dia — aí a orquestração vira necessidade operacional.</li>'
  u'</ul></div>')
A(u'</div>')

# 05 portal
A(u'<div class="section">')
A(u'<div class="sec-hdr"><span class="sec-num">05</span><span class="sec-title">Dentro do Portal do Fornecedor</span></div>')
A(u'<p class="sec-sub">O portal entrou inteiro no M0 em 14/09 e foi <strong>recortado no mesmo dia</strong>. '
  u'O MVP entrega o mínimo para o fornecedor se informar sozinho: saber o que deve, ver os documentos contra o '
  u'comprador e ter os comprovantes de pagamento à mão. O resto — inclusive o que já está implementado — espera.</p>')

_, pnome, pfs, pf, pc, pp = por_mod[11]
_m0 = [(n, nv) for ((n, t, nv), fx) in zip(pfs, pf) if fx == 'M0']
_dep = [(n, nv) for ((n, t, nv), fx) in zip(pfs, pf) if fx != 'M0']

A(u'<div class="mod">')
A(u'<div class="mod-hdr"><span class="mod-name">O que entra no MVP</span>%s'
  u'<span class="mod-count">%d de %d</span></div>' % (chip('M0'), len(_m0), len(pfs)))
A(u'<div class="mod-note">O fornecedor entra com credencial própria, abre um painel que responde “preciso fazer '
  u'alguma coisa hoje?”, vê seus documentos contra o comprador e encontra ali o comprovante do que já foi '
  u'recolhido. Nada mais.</div>')
A(u'<ul class="mod-list">')
for n, nv in _m0:
    A(u'<li class="is-m0"><span class="fx">%s</span><span class="nm">%s%s</span></li>'
      % (chip('M0'), n, u' <span class="chip warn">Novo</span>' if nv else u''))
A(u'</ul></div>')

A(u'<div class="mod">')
A(u'<div class="mod-hdr"><span class="mod-name">Adiado</span>%s'
  u'<span class="mod-count">%d de %d</span></div>' % (chip('M1'), len(_dep), len(pfs)))
A(u'<div class="mod-note">Tudo o que faz o fornecedor <em>agir</em> pelo portal — enviar comprovante, contestar, '
  u'conversar — e o que faz ele entender contexto: grupo econômico, contratos, score. Sem ação, os dois papéis '
  u'deixam de ter o que distinguir, e por isso acompanham.</div>')
A(u'<ul class="mod-list">')
for n, nv in _dep:
    A(u'<li><span class="fx">%s</span><span class="nm">%s</span></li>' % (chip('M1'), n))
A(u'</ul></div>')

A(u'<div class="callout red"><div class="callout-title">O que o recorte deixa de fora, e custa dinheiro</div>'
  u'<p>O <strong>aviso de recolhimento assumido</strong> saiu do M0. É a marca que diz ao fornecedor '
  u'<em>não recolha — o adquirente já recolheu este documento</em>. Sem ela, o fornecedor recolhe de novo: '
  u'o excedente volta a ele em até três dias úteis (LC 214/2025, art. 36, § 3º, II), mas o caixa saiu duas vezes, '
  u'e a conversa sobra para o adquirente.</p>'
  u'<p style="margin-top:8px">Ela vive <strong>dentro da listagem que entra no M0</strong> — é uma marca na linha do '
  u'documento, não uma tela nova. Trazer de volta custa pouco, e essa é a razão de o corte estar registrado aqui '
  u'em vez de passar em silêncio.</p></div>')
A(u'<div class="callout ok"><div class="callout-title">Como o fornecedor entra — decidido em 14/09</div>'
  u'<p><strong>Convite por e-mail com senha própria.</strong> O SSO resolve o acesso do lado do cliente; o fornecedor '
  u'externo entra por convite, define sua própria senha, e o adquirente revoga quando o contrato termina. '
  u'Já está implementado, e permanece no M0: sem ele, nenhuma das outras três entregas do portal alcança quem '
  u'deveria usá-las.</p></div>')
A(u'</div>')

# 06 contextos da API
A(u'<div class="section">')
A(u'<div class="sec-hdr"><span class="sec-num">06</span><span class="sec-title">Dentro das Integrações</span></div>')
A(u'<p class="sec-sub">A API tem seis contextos. A decisão de 14/09 coloca <strong>três</strong> no M0 — os que movem '
  u'documento, dinheiro e crédito. Os outros três são cadastro e notificação, e a tela dá conta deles no volume de um piloto.</p>')
A(u'<div class="callout info"><div class="callout-title">Contexto é capacidade; módulo é tela</div>'
  u'<p>Os três contextos do M0 dizem <strong>o que trafega</strong>. O módulo de Integrações — as 16 '
  u'funcionalidades de catálogo, conexão, credencial, escopo e log — é <strong>como se administra isso pela '
  u'interface</strong>, e ficou em M1: no primeiro momento a configuração é por variável de ambiente.</p>'
  u'<p style="margin-top:8px">O que isso custa: sem tela, conexão nova exige deploy; a credencial é rotacionada por '
  u'quem tem acesso ao ambiente; e o <em>log de entregas com inspeção de payload</em> — que estava no M0 justamente '
  u'para a conversa com o time de ERP não virar troca de e-mails — sai junto. Depurar divergência no piloto passa a '
  u'depender do log do servidor.</p></div>')
A(u'<div class="table-wrap"><table><thead><tr><th>Faixa</th><th>Contexto</th><th>Direção</th><th>O que trafega</th></tr></thead><tbody>')
for nome, dire, fx, desc in CONTEXTOS:
    A(u'<tr><td>%s</td><td><strong>%s</strong></td><td>%s</td><td>%s</td></tr>' % (chip(fx), nome, dire, desc))
A(u'</tbody></table></div>')
A(u'<p class="sec-sub" style="margin-top:18px">As doze funcionalidades de plataforma que sobem ao M0 — conexões nas duas '
  u'direções, assistente de nova conexão, emissão de credencial, exibição única do segredo, escopos, alcance por CNPJ, '
  u'exemplo da primeira chamada, log de entregas com payload, reenvio, comprovantes do ERP e teste de conexão — servem '
  u'os três contextos. Elas não se multiplicam por contexto: o que o M1 adiciona é escopo, não infraestrutura.</p>')
A(u'<h3>6.1 As integrações externas, a desenvolver</h3>')
A(u'<p>Os seis contextos acima são a API <em>do SplitHub</em> — como o ERP do cliente conversa com o produto. '
  u'Falta o outro lado: como o produto conversa com quem está fora dele. Quatro integrações, nenhuma existente hoje, '
  u'todas em <strong>M0</strong> por decisão de 14/09.</p>')
A(u'<div class="table-wrap"><table><thead><tr><th>Faixa</th><th>Integração</th><th>Com quem</th>'
  u'<th>O que destrava</th></tr></thead><tbody>')
for nome, quem, o_que in [
    (u'Receita Federal — CBS', u'Plataforma da RFB',
     u'A apuração assistida da CBS. Sem ela, a conciliação CAPUR do lado federal continua sendo simulação.'),
    (u'Comitê Gestor — IBS', u'CG-IBS',
     u'A apuração assistida do IBS, com webhook, arquivo diferencial e a conta corrente fiscal por operação.'),
    (u'RAD', u'Órgão arrecadador',
     u'Gerar e liquidar a guia de verdade, com retorno do pagamento. Hoje a guia nasce dentro do produto e o comprovante volta à mão.'),
    (u'Databricks', u'Lakehouse do cliente',
     u'Comprovantes em volume, em vez de upload arquivo a arquivo. É o que faz a conciliação financeira escalar.'),
]:
    A(u'<tr><td>%s</td><td><strong>%s</strong></td><td>%s</td><td>%s</td></tr>' % (chip('M0'), nome, quem, o_que))
A(u'</tbody></table></div>')
A(u'<div class="callout red"><div class="callout-title">As duas primeiras mudam o que o produto pode afirmar</div>'
  u'<p>Enquanto a apuração assistida não chega da Receita e do Comitê Gestor, a conciliação compara o que o '
  u'SplitHub escriturou contra <strong>um resultado que ele mesmo gerou</strong>. O confronto só vira confronto '
  u'quando a outra leitura vem de fora — e é o confronto que sustenta a garantia do crédito.</p>'
  u'<p style="margin-top:8px">São também as duas que não dependem só do time: a API do IBS estava '
  u'<em>em construção</em> na última publicação consultada. O M0 passa a ter uma data que ninguém aqui controla.</p></div>')

A(u'<div class="callout warn"><div class="callout-title">A dependência que isto cria</div>'
  u'<p>Os três contextos do M0 são justamente os que precisam de alguém do outro lado: o ERP do cliente tem que enviar '
  u'documento, receber guia, devolver comprovante e consumir o evento de crédito. <strong>O prazo do MVP passa a incluir '
  u'o calendário de um time que não é o seu</strong> — e o log de entregas com inspeção de payload, no M0, existe '
  u'exatamente para que a conversa com esse time não vire troca de e-mails.</p></div>')
A(u'</div>')

# 07 decisoes
A(u'<div class="section">')
A(u'<div class="sec-hdr"><span class="sec-num">07</span><span class="sec-title">Decisões</span></div>')
DEC = [
    ('ok', u'D3 · API no M0, em três contextos — <em>revista</em>',
     u'<strong>Decidido em 14/09/2026, revisto no mesmo dia.</strong> Os três contextos continuam no M0: ingestão de '
     u'DFs, RAD ↔ ERP e garantia de crédito. Mas o <strong>módulo de Integrações sai do M0</strong>: no primeiro '
     u'momento a configuração é por variável de ambiente, e as 16 funcionalidades de gestão — catálogo, conexões, '
     u'credenciais, escopos, rotação, log de entregas — ficam para o M1, junto com o vínculo da política com a conexão.'),
    ('ok', u'D13 · As quatro integrações externas entram no M0',
     u'<strong>Decidido em 14/09/2026.</strong> Receita Federal (CBS), Comitê Gestor (IBS), RAD e Databricks para '
     u'comprovantes. Nenhuma existe hoje. As duas primeiras são o que transforma a conciliação em confronto de '
     u'verdade — e trazem ao MVP uma data que o time não controla.'),
    ('ok', u'D4 · Portal do Fornecedor no M0 — <em>recortado</em>',
     u'<strong>Decidido em 14/09/2026, recortado no mesmo dia.</strong> O M0 fica com quatro entregas: acesso por '
     u'convite, painel inicial, listagem dos documentos contra o comprador e disponibilização dos comprovantes de '
     u'pagamento. As outras oito — envio de comprovante, contestação, chat, score, grupo econômico, contratos, '
     u'papéis e o aviso de recolhimento assumido — vão para M1.'),
    ('ok', u'D15 · Régua de cobrança no M0',
     u'<strong>Decidido em 14/09/2026.</strong> As seis funcionalidades de régua — pré e pós-vencimento, etapas, '
     u'template, disparos e auditoria — entram no MVP; relatórios agendados e integração ITSM ficam em M1. '
     u'A decisão arrasta dois itens que <strong>não existem</strong>: o motor de execução e o envio de e-mail '
     u'transacional. Sem os dois, régua ativa é régua que não cobra ninguém.'),
    ('ok', u'D14 · O fornecedor se informa antes de agir',
     u'<strong>Decidido em 14/09/2026.</strong> O portal do MVP é de leitura: o fornecedor vê o que deve e encontra o '
     u'comprovante do que foi recolhido. Toda ação dele pelo portal fica para o M1 — e, até lá, continua acontecendo '
     u'por e-mail, como acontece hoje.'),
    ('ok', u'D6 · SSO corporativo no M0',
     u'<strong>Decidido em 14/09/2026.</strong> Funcionalidade nova, não presente no mapa nem no produto. '
     u'Substitui a senha de acesso que hoje está no código, e torna desnecessária a iniciativa pausada em 11/09.'),
    ('ok', u'D7 · Acesso do fornecedor externo por convite',
     u'<strong>Decidido em 14/09/2026.</strong> Convite por e-mail com senha própria, em vez de link assinado por '
     u'documento ou federação com o provedor do fornecedor. Entra como funcionalidade nova no núcleo do portal.'),
    ('ok', u'D1 · O critério é a cadeia do crédito, e não módulos inteiros',
     u'<strong>Aprovado em 14/09/2026.</strong> É o que autoriza cortar dentro de um módulo pronto: Crédito entra com '
     u'10 de 14, Execução RAD com 5 de 15, Integrações com 12 de 16. Sem esta decisão, o M0 deixaria de ser um recorte '
     u'e viraria uma lista de módulos.'),
    ('ok', u'D2 · Execução RAD reduzida a 5 de 15 no M0',
     u'<strong>Aprovado em 14/09/2026.</strong> Entram a política de execução, a janela, os critérios de inclusão, a '
     u'listagem com o lote ao vivo e o vínculo com a conexão de destino. Ficam fora a orquestração por CNPJ, por contrato '
     u'e por faixa de valor, as quatro bases de comparação, a simulação e os alertas de sobreposição. '
     u'<em>Revisar se o piloto tiver volume alto de documentos por dia</em> — aí a orquestração deixa de ser conforto.'),
]
for est, q, r in DEC:
    A(u'<div class="dec"><div class="dec-num" style="%s">%s</div><div class="dec-body">'
      u'<div class="dec-q">%s</div><div class="dec-r">%s</div></div></div>'
      % (u'color:var(--green);background:var(--green-d)' if est == 'ok' else u'',
         u'✓' if est == 'ok' else u'?', q, r))
A(u'<div class="callout ok"><div class="callout-title">Aprovada em 14/09/2026 · primeira parte implementada</div>'
  u'<p>As seis decisões estão fechadas e o escopo do MVP é o desta versão: <strong>%d funcionalidades</strong> no M0, '
  u'sendo %d do Mapa de Funcionalidades v2.1 e duas que ainda não existem — o SSO corporativo e o acesso do fornecedor '
  u'por convite.</p>'
  u'<p style="margin-top:8px"><strong>Já entregue:</strong> o acesso do fornecedor por convite e a importação em massa '
  u'por CSV, com o grupo econômico no mesmo arquivo. São as onze funcionalidades que o mapa ganhou entre 172 e 183 — '
  u'a única do M0 que ainda não existe em parte alguma é o SSO corporativo.</p>'
  u'<p style="margin-top:8px">Passo seguinte: levar a faixa de cada funcionalidade para dentro do próprio '
  u'<strong>Mapa de Funcionalidades</strong>, ao lado do tipo, para que a priorização e o inventário não voltem a '
  u'divergir — como divergiram até setembro de 2026, quando cinco módulos existiam no produto e não constavam do mapa.</p></div>'
  % (tot['M0'], tot['M0'] - NOVAS_N))
A(u'</div>')

# 07 historico
A(u'<div class="section">')
A(u'<div class="sec-hdr"><span class="sec-num">08</span><span class="sec-title">Histórico de versões</span></div>')
A(u'<div class="ver-row"><div class="ver-num">v1.9</div><div class="ver-desc">'
  u'14/09/2026 — <strong>Régua de cobrança entra no M0.</strong> Seis funcionalidades do módulo de Automações; '
  u'relatórios agendados e ITSM permanecem em M1. A decisão traz junto dois itens novos, ambos inexistentes: '
  u'o <em>motor de execução</em> — sem ele o módulo só desenha automações — e o <em>envio de e-mail transacional</em>, '
  u'que passa a atender também o convite do fornecedor. M0 passa de 94 para %d.</div></div>' % tot['M0'])
A(u'<div class="ver-row"><div class="ver-num">v1.8</div><div class="ver-desc">'
  u'14/09/2026 — <strong>Portal do Fornecedor recortado.</strong> O M0 fica com quatro entregas: acesso por convite, '
  u'<em>painel inicial</em> e <em>comprovantes de pagamento disponíveis ao fornecedor</em> — as duas novas, que não '
  u'existem hoje — e a listagem dos documentos contra o comprador. As outras oito vão para M1, inclusive o aviso de '
  u'recolhimento assumido, cujo custo está declarado na seção 05. M0 passa de 100 para %d.</div></div>' % tot['M0'])
A(u'<div class="ver-row"><div class="ver-num">v1.7</div><div class="ver-desc">'
  u'14/09/2026 — <strong>O módulo de Integrações sai do M0</strong>: no primeiro momento a configuração é por '
  u'variável de ambiente, e as 16 funcionalidades de gestão vão para M1, junto com o vínculo da política de execução '
  u'com a conexão de destino. Os três contextos da API e as quatro integrações externas <em>permanecem</em> no M0 — '
  u'contexto é capacidade, módulo é tela. M0 passa de 113 para %d.</div></div>' % tot['M0'])
A(u'<div class="ver-row"><div class="ver-num">v1.6</div><div class="ver-desc">'
  u'14/09/2026 — Entram quatro <strong>integrações externas a desenvolver</strong>, todas em M0: Receita Federal '
  u'(CBS), Comitê Gestor (IBS), RAD e Databricks para comprovantes. Nenhuma existe hoje. As duas primeiras são o '
  u'que transforma a conciliação em confronto de verdade — e trazem ao MVP uma data que o time não controla. '
  u'M0 passa de 109 para %d; as funcionalidades fora do mapa, de 1 para %d.</div></div>' % (tot['M0'], NOVAS_N))
A(u'<div class="ver-row"><div class="ver-num">v1.5</div><div class="ver-desc">'
  u'14/09/2026 — O acesso do fornecedor por convite e a importação em massa por CSV foram <strong>implementados</strong>. '
  u'As onze funcionalidades deixam de ser previsão e entram no mapa, que vai de 172 para 183. '
  u'M0 passa de 99 para %d; das funcionalidades fora do mapa resta apenas o SSO corporativo.</div></div>' % tot['M0'])
A(u'<div class="ver-row"><div class="ver-num">v1.4</div><div class="ver-desc">'
  u'14/09/2026 — <strong>Proposta aprovada.</strong> D1 (o critério é a cadeia do crédito) e D2 (Execução RAD em 5 de 15) '
  u'aprovadas, fechando as seis decisões da proposta. Escopo do MVP definido em %d funcionalidades.</div></div>' % tot['M0'])
A(u'<div class="ver-row"><div class="ver-num">v1.3</div><div class="ver-desc">'
  u'14/09/2026 — Removida a seção de pré-requisitos de fundação (persistência, autenticação, Apuração Assistida, '
  u'motor de automações e cálculo de juros e multa), e com ela a decisão D5, que existia só para aprová-los. '
  u'A proposta passa a tratar apenas do escopo funcional.</div></div>')
A(u'<div class="ver-row"><div class="ver-num">v1.2</div><div class="ver-desc">'
  u'14/09/2026 — A API no M0 passa a ter escopo declarado: três dos seis contextos (ingestão de DFs, RAD ↔ ERP e '
  u'garantia de crédito). D7 decidida — o fornecedor entra por convite com senha própria, o que acrescenta a segunda '
  u'funcionalidade nova. M0 em %d de %d.</div></div>' % (tot['M0'], TOTAL))
A(u'<div class="ver-row"><div class="ver-num">v1.1</div><div class="ver-desc">'
  u'14/09/2026 — Três decisões tomadas: <strong>API</strong>, <strong>Portal do Fornecedor</strong> e <strong>SSO</strong> '
  u'no M0. O MVP passa de 71 para %d funcionalidades. Acrescenta a ordem de construção interna do portal (P1/P2/P3), '
  u'o SSO como funcionalidade nova fora do mapa, e a decisão D7 sobre o acesso do fornecedor externo.</div></div>'
  % tot['M0'])
A(u'<div class="ver-row"><div class="ver-num">v1.0</div><div class="ver-desc">'
  u'14/09/2026 — Primeira proposta, sobre o Mapa de Funcionalidades v2.1 (172 funcionalidades, 20 módulos). '
  u'Quatro faixas, atribuição item a item, cinco pré-requisitos de fundação e cinco decisões em aberto.</div></div>')
A(u'</div>')

A(u'</div>\n</body>\n</html>\n')

io.open(DEST, 'w', encoding='utf-8', newline='').write(head + u'\n'.join(B))
print('gerado', DEST)
print('M0=%d M1=%d M2=%d X=%d total=%d' % (tot['M0'], tot['M1'], tot['M2'], tot['X'], TOTAL))
