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
XLSX = 'priorizacao-mvp.xlsx'      # planilha de revisao, gerada na mesma execucao

VERSAO = u'v2.5'
DATA = u'18/09/2026'
BASE_MAPA = u'Mapa de Funcionalidades v2.4'

# a planilha e aberta fora do site: os links para o PRD precisam ser absolutos
URL_DOCS = 'https://split-hubhq.github.io/app/docs/'


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


def carregar_grupos():
    """Le GROUPS do mapa: {indice do modulo: nome do grupo}."""
    s = io.open(BASE + 'mapa-funcionalidades.html', encoding='utf-8').read()
    bloco = s[s.index('var GROUPS'):s.index('var MODS')]
    out = {}
    for nome, mods in re.findall(r"num:'([^']+)'.*?mods:\[([\d,\s]+)\]", bloco, re.S):
        for m in mods.split(','):
            out[int(m)] = nome
    return out


def carregar_detalhe():
    """Le o Mapa detalhado: {(modulo, i): {'n', 't', 'd', 'p'}}.

    O detalhado e a fonte da descricao e do vinculo com o PRD. O resumido continua
    sendo a fonte da lista; os dois precisam concordar item a item, e a geracao
    falha quando nao concordam."""
    s = io.open(BASE + 'mapa-funcionalidades-detalhado.html', encoding='utf-8').read()
    pat = re.compile(r"\{n:'((?:[^'\\]|\\.)*)',\s*t:'(\w)'(?:,\s*d:'((?:[^'\\]|\\.)*)')?"
                     r"(?:,\s*p:'((?:[^'\\]|\\.)*)')?\}")
    out = {}
    for bi, b in enumerate(re.split(r"/\* \d+ \*/ \{", s)[1:]):
        for i, m in enumerate(pat.finditer(b)):
            out[(bi, i)] = {'n': m.group(1).replace("\\'", "'"), 't': m.group(2),
                            'd': (m.group(3) or '').replace("\\'", "'"), 'p': m.group(4)}
    return out


MODS = carregar_mapa()
GRUPO_DE = carregar_grupos()
DETALHE = carregar_detalhe()

# o resumido e o detalhado precisam listar as mesmas funcionalidades, na mesma ordem
for bi, nome, fs in MODS:
    for i, (n, t) in enumerate(fs):
        d = DETALHE.get((bi, i))
        assert d and d['n'] == n, (u'mapa resumido e detalhado divergem', nome, i, n, d and d['n'])
        assert d['d'], (u'funcionalidade sem descricao no mapa detalhado', nome, n)
        assert d['p'], (u'funcionalidade sem vinculo com o PRD no mapa detalhado', nome, n)
assert len(DETALHE) == sum(len(fs) for _, _, fs in MODS), u'o detalhado tem funcionalidade que o resumido nao tem'

_PRD_CACHE = {}


def prd_info(arq):
    """Titulo, blocos F e secoes de um PRD, para montar e conferir o link."""
    if arq not in _PRD_CACHE:
        caminho = BASE + arq
        assert os.path.exists(caminho), (u'PRD inexistente no vinculo', arq)
        s = io.open(caminho, encoding='utf-8').read()
        titulo = re.search(r'<title>PRD — ([^·<]+)', s)
        blocos = {}
        for m in re.finditer(r'<div class="feat" id="([^"]+)"[^>]*>\s*<div class="feat-hdr">\s*'
                             r'<span class="feat-id">([^<]+)</span>\s*<span class="feat-name">(.*?)</span>', s, re.S):
            blocos[m.group(1)] = (m.group(2).strip(), re.sub(r'<[^>]+>', '', m.group(3)).strip())
        secoes = {m.group(1): re.sub(r'<[^>]+>', '', m.group(2)).strip()
                  for m in re.finditer(r'id="(s\d+)".*?sec-title">([^<]+)', s, re.S)}
        _PRD_CACHE[arq] = {'titulo': titulo.group(1).strip() if titulo else arq, 'blocos': blocos, 'secoes': secoes}
    return _PRD_CACHE[arq]


def resolver_vinculo(p):
    """Interpreta o campo p do mapa. Link que nao leva a lugar nenhum derruba a geracao.

    Devolve {'nivel', 'href', 'rotulo', 'fid', 'destino'}:
      bloco   prd-x.html#f-04   secao   prd-x.html#s08   externo  https://...
      lacuna  !prd-x.html       sem     -"""
    if p == '-':
        return {'nivel': 'sem', 'href': None, 'rotulo': u'Sem PRD', 'fid': u'', 'destino': u''}
    if p.startswith('http'):
        return {'nivel': 'externo', 'href': p, 'rotulo': u'PRD do módulo, publicado à parte', 'fid': u'', 'destino': u''}
    if p.startswith('!'):
        info = prd_info(p[1:])
        return {'nivel': 'lacuna', 'href': p[1:], 'rotulo': u'Não descrita no PRD de ' + info['titulo'],
                'fid': u'', 'destino': u''}
    arq, anc = p.split('#', 1)
    info = prd_info(arq)
    if anc in info['blocos']:
        fid, fnome = info['blocos'][anc]
        return {'nivel': 'bloco', 'href': p, 'rotulo': u'PRD de ' + info['titulo'], 'fid': fid, 'destino': fnome}
    if anc in info['secoes']:
        return {'nivel': 'secao', 'href': p, 'rotulo': u'PRD de ' + info['titulo'],
                'fid': u'Seção ' + anc[1:], 'destino': info['secoes'][anc]}
    raise AssertionError((u'ancora inexistente no PRD', p))

# faixa por modulo: lista com a faixa de cada funcionalidade, na ordem do mapa
FAIXAS = {
    0: ['M0','M2','M2','M2','M0','M0','M1'],
    1: ['M0','M0','M0','M0','M2','M0','M2','M2','M2','M0','M0','M0','M0','M0','M1'],
    2: ['M0','M0','M1','M1','M0','M1','M1'],
    3:  ['M0','M0','M0','M0','M1','M1','M1','M0','M0','M1','M1','M0','M0','M0'],
    4: ['M0','M0','M0','M0','M0','M1','M0','M1','M0','M1'],
    5:  ['M0','M0','M0','M0','M0','M0','M0'],
    6:  ['M2']*7,
    7:  ['M2']*6,
    8:  ['M0','M0','M0','M0','M0','M1','M0'],
    9:  ['M0','M0','M1','M0','M2','M0','M0','M0','M0','M0','M0','M0'],
    10: ['M0','M2','M0','M0','M1','M1'],
    11: ['M0','M0','M1','M1','M1','M1','M1','M0','M1','M1','M0','M1'],
    12: ['M0','M0','M0','M0','M0','M0','M0','M0','M0','X','X','M0'],
    13: ['M0','M1','M1','M1','M1','M1','M0','M0','M1','M1','M1','M0','M1','M1','M1'],
    14: ['M1']*16,
    15: ['M0','M0','M0','M0','M1','M0','M0','M1'],
    16: ['M0','M1','M0','M0','M0','M0','M1','M1'],
    17: ['M2']*4,
    18: ['M1','M1','M1','M1','M1','M0','M0','M0','M0','M0','M0'],
    19: ['M1','M1','M1','M1','M1','M0'],
    # Ressarcimento — fora do M0 por decisão de 18/09/2026 (D16)
    20: ['M1','M2','M1','M1','M1','M1','M1','M1','M1','M2','M1','M1','M1','M1','M1'],
}

# ── revisoes de faixa ──────────────────────────────────────────────────────
# FAIXAS acima e a atribuicao original; aqui ficam as revisoes feitas depois,
# por quem revisou. A faixa anterior nao e declarada: e lida de FAIXAS na hora
# de aplicar, para o registro nunca divergir do que estava valendo.
# (modulo, trecho do nome da funcionalidade, nova faixa)
REVISOES = [
    (u'Revisão de priorização', u'Toshio', u'15/09/2026', [
        (u'Créditos IBS/CBS', u'Top 5 e Top 10 fornecedores', 'M0'),
        (u'Pagamentos RAD', u'Gestão de colunas e exportação CSV', 'M1'),
        (u'Pagamentos RAD', u'Aba Execução Programada', 'M0'),
        (u'Inconsistências', u'Filtros multiselect por tipo e DF', 'M1'),
        (u'Inconsistências', u'Atribuição de responsável', 'M0'),
        (u'Inteligência', u'Score de risco por fornecedor', 'M0'),
        (u'Inteligência', u'Critério: créditos em risco', 'M0'),
        (u'Inteligência', u'badge verde', 'M0'),
        (u'Inteligência', u'Ranking Top 5 Melhores e Top 5 Piores', 'M0'),
        (u'Inteligência', u'Mapa de bolhas risco', 'M0'),
        (u'Contratos', u'Modelo Split Payment', 'M2'),
        (u'Fornecedores', u'Revogação com motivo e trilha', 'M1'),
        (u'Fornecedores', u'Pré-visualização e relatório da importação', 'M1'),
        (u'Portal Fornecedor', u'Envio de comprovante RAD/PIX', 'M0'),
        (u'Execução RAD', u'Orquestração por CNPJ', 'M0'),
        (u'Execução RAD', u'Orquestração por contrato', 'M0'),
        (u'Execução RAD', u'Auditoria com diff campo a campo', 'M0'),
        (u'Integrações', u'Catálogo dos seis contextos da API', 'M0'),
        (u'Integrações', u'Comprovantes recebidos do ERP', 'M0'),
        (u'Conciliação', u'Próxima ação sugerida por documento', 'M0'),
        (u'Conciliação', u'Recorte por múltiplos períodos', 'M0'),
        (u'Automações', u'Integração ITSM por evento', 'M2'),
        (u'Usuários e Acessos', u'Painel de acessos externos', 'M0'),
    ]),
]


def _norm(t):
    import unicodedata
    t = unicodedata.normalize('NFKD', t.lower())
    t = u''.join(c for c in t if not unicodedata.combining(c))
    return re.sub(r'[^a-z0-9]+', ' ', t).strip()


def aplicar_revisoes():
    """Aplica REVISOES sobre FAIXAS. Devolve (faixas, historico).

    Falha quando o nome nao casa com exatamente uma funcionalidade do modulo:
    nome que mudou no mapa tem de ser corrigido aqui, nao ignorado em silencio.
    """
    fx = {bi: list(v) for bi, v in FAIXAS.items()}
    hist = []
    for titulo, autor, data, itens in REVISOES:
        for mod, trecho, para in itens:
            alvo = [m for m in MODS if _norm(m[1]) == _norm(mod)]
            assert len(alvo) == 1, (u'modulo da revisao nao resolvido', mod, len(alvo))
            bi, nome, fs = alvo[0]
            hits = [i for i, (n, _t) in enumerate(fs) if _norm(trecho) in _norm(n)]
            assert len(hits) == 1, (u'funcionalidade da revisao nao resolvida', nome, trecho, len(hits))
            i = hits[0]
            de = fx[bi][i]
            fx[bi][i] = para
            hist.append({'bi': bi, 'i': i, 'modulo': nome, 'func': fs[i][0],
                         'de': de, 'para': para, 'autor': autor, 'data': data, 'titulo': titulo})
    return fx, hist


FAIXAS_REV, REV_HIST = aplicar_revisoes()
REV_INDEX = {(h['bi'], h['i']): h for h in REV_HIST}

# justificativa do corte, por modulo
NOTA = {
    0:  u'Só o que responde “onde está meu crédito hoje”. Forecast e cockpit dependem de série histórica que o piloto ainda não tem. O <strong>card de saldo credor e ressarcimento</strong> entra em M1 (D17).',
    1:  u'O módulo que a tese defende entra quase inteiro: 11 de 14. Ficam fora três gráficos analíticos — eles explicam o crédito, não o garantem. O Top 5 e Top 10 de fornecedores subiu na revisão de 15/09: saber de quem cobrar primeiro é operação, não análise. O painel <strong>Ressarcimento no ciclo do crédito</strong> entra em M1 (D17): o M0 do módulo não muda.',
    2:  u'Débito entra só para a apuração fechar. O produto se vende pelo crédito. O aviso da trava da intenção de ressarcimento entra em M1 (D17).',
    3:  u'Entra a guia, o comprovante e o rastro dos três status. A entrega ao ERP passa ao M0 junto com a API. Na revisão de 15/09 a <strong>aba Execução Programada</strong> entrou e a gestão de colunas saiu: o piloto precisa ver o que está agendado, não configurar a própria grade. Entra também o <strong>aviso ao fornecedor</strong> do recolhimento — sem ele o fornecedor paga o mesmo tributo de novo.',
    4:  u'A inconsistência é o que impede o crédito de morrer em silêncio. Na revisão de 15/09 a <strong>atribuição de responsável</strong> entrou — inconsistência sem dono não é tratada — e os filtros multiselect saíram. A família Ressarcimento de inconsistências entra em M1 (D17).',
    5:  u'A porta de entrada inteira, inclusive por API: com a decisão de 14/09, o documento entra por arquivo ou por integração desde o primeiro dia.',
    6:  u'Projeção pressupõe base real acumulada. Não existe piloto que comece por aqui.',
    7:  u'<strong>Reclassificado em 15/09:</strong> 5 de 6 no M0. O score, o critério, o badge, o ranking e o mapa de bolhas deixam de ser argumento de renovação e passam a ser o que diz <em>de quem cobrar primeiro</em>. Só a evolução histórica do score fica para depois — ela exige série que o piloto ainda não tem.',
    8:  u'Dois dos três métodos são pré-requisito: sem saber quem recolhe, não há cadeia. Na revisão de 15/09 o <strong>Split Payment</strong> foi para M2 — o piloto cobre RAD e Fornecedor. O contrato como recorte de política acompanha Execução RAD.',
    9:  u'Deixou de ser só cadastro: ganhou a gestão de acesso do fornecedor e a importação em massa, implementadas em 14/09. Na revisão de 15/09 saíram a revogação com motivo e a pré-visualização da importação — são refinamentos do fluxo, não o fluxo. Score de conformidade e trilha de auditoria seguem depois.',
    10: u'Hierarquia e filtro de grupo econômico atravessam todas as telas — sem eles, nenhum número fecha. O enquadramento por órgão para o ressarcimento entra em M1 (D17).',
    11: u'Recortado em 14/09 e ampliado em 15/09: entram o painel inicial, a listagem dos documentos contra o comprador, os comprovantes de pagamento, o acesso por convite e — pela revisão — o <strong>envio de comprovante RAD/PIX</strong>. O fornecedor deixa de só se informar e passa a responder. Ver seção 06.',
    12: u'Login, perfis e o sistema de design, mais o selo de modo demonstração da troca de perfil. O SSO corporativo continua sendo a única funcionalidade do MVP que não existe em parte alguma.',
    13: u'O corte mais duro, afrouxado em 15/09: de 4 para 7 de 15. Entram a orquestração por CNPJ, por contrato e a auditoria com diff campo a campo — decidir <em>de quem</em> gerar a guia passa a ser do MVP; decidir <em>quando</em>, por faixa de valor e base de comparação, continua fora.',
    14: u'Duas das 16 no M0, pelas revisões de 14 e 15/09: o <strong>catálogo dos contextos</strong> e os <strong>comprovantes recebidos do ERP</strong>. O resto da gestão — conexões, credenciais, escopos, log — fica em M1, com a configuração por variável de ambiente. As quatro integrações externas a desenvolver seguem em M0 — ver seção 07.',
    15: u'A prova de que o recolhimento aconteceu. Sem conciliação, o crédito é uma afirmação sem lastro. Com a revisão de 15/09 o módulo entra <strong>inteiro</strong>: a próxima ação sugerida e o recorte por múltiplos períodos completam o que faltava.',
    16: u'A apuração é onde o crédito vira número exigível. Entra o ciclo calcular–concluir–reabrir. A saída para ressarcimento no transporte do saldo entra em M1 (D17); o ciclo do M0 não muda.',
    17: u'Depende de base legal indexada e de confiança que um piloto ainda não tem.',
    18: u'A <strong>régua de cobrança</strong> entra no M0 por decisão de 14/09: cobrança não feita é crédito perdido. Relatórios agendados ficam em M1 e a integração ITSM desceu a M2 em 15/09 — abrir chamado é rotina de time grande, não do piloto.',
    20: u'<strong>Fora do M0 por decisão de 18/09/2026.</strong> A cadeia do crédito fecha na apropriação; o ressarcimento é o passo seguinte — transformar o saldo que sobrou em dinheiro. E o primeiro pedido real só existe em 2027: saldos de 2026 não são ressarcíveis. Treze funcionalidades em M1, o ciclo que tira o analista da planilha — saldo, intenção, pedido, decisão, recebimento, prazos, conferência e impedimentos. Duas em M2: o comparativo compensar × ressarcir e a previsão de caixa, que explicam a decisão em vez de executá-la. Implementado no protótipo em simulação 2026.',
    19: u'Multiusuário interno é consequência de adoção. A exceção é o painel de acessos externos, que entrou no M0 junto com o acesso do fornecedor — e foi confirmado na revisão de 15/09.',
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

# vinculo com o PRD das funcionalidades que ainda nao existem: nenhuma esta especificada
NOVAS_PRD = {}

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
INFO = {}   # (modulo, i) -> tipo, descricao e vinculo resolvido
for (bi, i), d in DETALHE.items():
    INFO[(bi, i)] = {'t': d['t'], 'd': d['d'], 'v': resolver_vinculo(d['p'])}
for bi, nome, fs in MODS:
    f = list(FAIXAS_REV[bi])
    assert len(f) == len(fs), (bi, nome, len(f), len(fs))
    fs = [(n, t, False) for (n, t) in fs]
    p = list(PRIO.get(bi, []))
    for k, (n, t, fx, pr, d) in enumerate(NOVAS.get(bi, [])):
        INFO[(bi, len(fs))] = {'t': t, 'd': d, 'v': resolver_vinculo(NOVAS_PRD.get(n, '-'))}
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
TOT_ORIG = {'M0': 0, 'M1': 0, 'M2': 0, 'X': 0}
for bi in FAIXAS:
    for x in FAIXAS[bi]:
        TOT_ORIG[x] += 1
for bi, itens in NOVAS.items():
    for (_n, _t, fxn, _p, _d) in itens:
        TOT_ORIG[fxn] += 1

TOTAL = sum(tot.values())
DO_MAPA = TOTAL - NOVAS_N


def pct(n):
    return int(round(100.0 * n / TOTAL))


TIPO_ROTULO = {'l': u'Listagem', 'a': u'Ação', 'r': u'Risco/Inc.', 'g': u'Analítico', 'c': u'Configuração',
               'p': u'Transversal'}


def linha_expansivel(bi, i, n, novo, fx, pr=u''):
    """D1/D2: a linha fechada e a de sempre; aberta, traz o porque e a historia da faixa."""
    info = INFO[(bi, i)]
    h = REV_INDEX.get((bi, i))
    rv = u''
    if h and h['de'] != h['para']:
        rv = (u' <span class="rev-tag" title="%s → %s · %s · %s">%s → %s</span>'
              % (ROTULO[h['de']], ROTULO[h['para']], h['autor'], h['data'], ROTULO[h['de']], ROTULO[h['para']]))
    nv = u' <span class="chip warn">Novo</span>' if novo else u''
    if h and h['de'] != h['para']:
        faixa = u'%s → %s · %s · %s' % (ROTULO[h['de']], ROTULO[h['para']], h['autor'], h['data'])
    elif h:
        faixa = u'%s, confirmada · %s · %s' % (ROTULO[fx], h['autor'], h['data'])
    else:
        faixa = u'%s desde a proposta original' % ROTULO[fx]
    meta = [u'<span><b>Tipo</b> %s</span>' % TIPO_ROTULO.get(info['t'], info['t']),
            u'<span><b>Origem</b> %s</span>' % (u'Nova — ainda não existe no produto' if novo else u'Mapa'),
            u'<span><b>Faixa</b> %s</span>' % faixa]
    if pr:
        meta.append(u'<span><b>Ordem de construção</b> %s</span>' % pr)
    v = info['v']
    if v['nivel'] in ('bloco', 'secao'):
        lk = (u'<a class="prd-link" href="%s" target="_blank" rel="noopener">Descrição completa no %s '
              u'<span class="fid">%s</span> %s ↗</a>' % (v['href'], v['rotulo'], v['fid'], v['destino']))
    elif v['nivel'] == 'externo':
        lk = u'<a class="prd-link" href="%s" target="_blank" rel="noopener">%s ↗</a>' % (v['href'], v['rotulo'])
    elif v['nivel'] == 'lacuna':
        lk = u'<span class="prd-sem">%s — <a href="%s" target="_blank" rel="noopener">abrir o PRD ↗</a></span>' % (
            v['rotulo'], v['href'])
    else:
        lk = u'<span class="prd-sem">%s</span>' % (u'Sem PRD — ainda não especificada' if novo else u'Sem PRD')
    prs = u'<span class="pr">%s</span>' % pr if pr else u''
    return (u'<li><details class="fd%s"><summary><span class="chev" aria-hidden="true">▶</span>'
            u'<span class="fx">%s</span>%s<span class="nm">%s%s%s</span></summary>'
            u'<div class="fd-body"><div class="fd-desc">%s</div><div class="fd-meta">%s</div>%s</div></details></li>'
            % (' is-m0' if fx == 'M0' else '', chip(fx), prs, n, nv, rv, info['d'], u''.join(meta), lk))


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

/* ── Linha expansível ── */
.fx-list { list-style: none; margin: 0; padding: 4px 18px 14px; }
.fx-list > li { border-bottom: 1px solid var(--brd); }
.fx-list > li:last-child { border-bottom: none; }
.fd > summary { list-style: none; display: flex; gap: 10px; align-items: baseline; padding: 7px 0; cursor: pointer; font-size: 12.5px; color: var(--txt2); min-width: 0; }
.fd > summary::-webkit-details-marker { display: none; }
.fd > summary:focus-visible { outline: 2px solid var(--teal); outline-offset: 2px; border-radius: 4px; }
.fd > summary .chev { flex-shrink: 0; width: 12px; color: var(--txt3); font-size: 10px; transition: transform .15s; }
.fd[open] > summary .chev { transform: rotate(90deg); color: var(--teal); }
.fd > summary .fx { flex-shrink: 0; width: 42px; }
.fd > summary .pr { flex-shrink: 0; width: 24px; font-family: 'JetBrains Mono', monospace; font-size: 10.5px; font-weight: 700; color: var(--txt3); }
.fd > summary .nm { min-width: 0; flex: 1; overflow-wrap: anywhere; }
.fd.is-m0 > summary .nm { color: var(--txt1); font-weight: 600; }
.fd > summary:hover .nm { color: var(--teal); }
.fd-body { margin: 0 0 12px 64px; padding: 10px 14px; background: var(--sur2); border-left: 2px solid var(--teal); border-radius: 0 6px 6px 0; font-size: 12.5px; color: var(--txt2); }
.fd-desc { color: var(--txt1); line-height: 1.55; }
.fd-meta { display: flex; flex-wrap: wrap; gap: 6px 16px; margin-top: 8px; font-size: 11px; color: var(--txt3); }
.fd-meta b { color: var(--txt2); font-weight: 600; }
.prd-link { display: inline-flex; flex-wrap: wrap; align-items: baseline; gap: 6px; margin-top: 9px; font-size: 11.5px; font-weight: 600; color: var(--teal); text-decoration: none; border-bottom: 1px dotted var(--teal); }
.prd-link:hover { border-bottom-style: solid; }
.prd-link .fid { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; font-weight: 800; }
.prd-sem { display: inline-block; margin-top: 9px; font-size: 11.5px; font-weight: 600; color: var(--amber); }
.prd-sem a { color: var(--amber); }
.mod-tools { display: flex; flex-wrap: wrap; gap: 8px; padding: 8px 18px 0; }
.mini-btn { font-size: 11px; font-weight: 600; color: var(--teal); background: none; border: 1px solid var(--brd); border-radius: 20px; padding: 3px 11px; cursor: pointer; }
.mini-btn:hover { border-color: var(--teal); }
.mini-btn:focus-visible { outline: 2px solid var(--teal); outline-offset: 2px; }
@media (max-width: 600px) { .fd-body { margin-left: 0; } }
@media (prefers-reduced-motion: reduce) { .fd > summary .chev { transition: none; } }

/* ── Revisão de faixa ── */
.rev-tag { display: inline-block; font-family: 'JetBrains Mono', monospace; font-size: 9.5px; font-weight: 700; color: var(--amber); background: var(--amber-d); border-radius: 4px; padding: 1px 6px; margin-left: 6px; white-space: nowrap; vertical-align: 1px; }
.rev-aut { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; color: var(--txt2); background: var(--sur2); border: 1px solid var(--brd); border-radius: 20px; padding: 4px 12px; }
.rev-aut b { color: var(--txt1); }
.rev-de { font-family: 'JetBrains Mono', monospace; font-weight: 700; color: var(--txt3); }
.rev-para { font-family: 'JetBrains Mono', monospace; font-weight: 700; }
.sobe { color: var(--teal); }
.desce { color: var(--purple); }

/* ── Download da planilha ── */
.dl-pill { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 700; color: var(--sur); background: var(--teal); border-radius: 20px; padding: 5px 13px; text-decoration: none; white-space: nowrap; }
.dl-pill:hover { filter: brightness(1.08); }
.dl-card { display: flex; flex-wrap: wrap; gap: 18px; align-items: center; background: var(--sur); border: 1px solid var(--teal); border-radius: 10px; padding: 18px; margin: 18px 0 4px; box-shadow: var(--shadow-sm); }
.dl-card .dl-body { flex: 1 1 320px; min-width: 0; }
.dl-card .dl-title { font-size: 13.5px; font-weight: 700; color: var(--txt1); margin-bottom: 5px; }
.dl-card .dl-desc { font-size: 12.5px; color: var(--txt2); }
.dl-big { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; color: var(--sur); background: var(--teal); border-radius: 8px; padding: 11px 20px; text-decoration: none; white-space: nowrap; }
.dl-big:hover { filter: brightness(1.08); }
.dl-cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(0, 1fr)); gap: 0; margin-top: 12px; }

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
  u'<div class="meta-pill"><span class="meta-label">Versão</span><span class="meta-val">%s</span></div>'
  u'<div class="meta-pill"><span class="meta-label">Status</span><span class="chip ok">Aprovada · em implementação</span></div>'
  u'<div class="meta-pill"><span class="meta-label">Base</span><span class="meta-val">%s</span></div>'
  u'<div class="meta-pill"><span class="meta-label">Escopo</span><span class="meta-val">%d do mapa + %d novas · 20 módulos</span></div>'
  u'<div class="meta-pill"><span class="meta-label">Data</span><span class="meta-val">%s</span></div>'
  u'<div class="meta-pill" style="margin-left:auto"><a class="dl-pill" href="%s" download>↓ Planilha de revisão</a></div>'
  u'</div>' % (VERSAO, BASE_MAPA, DO_MAPA, NOVAS_N, DATA, XLSX))

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
A(u'<p class="sec-sub">Os 20 módulos na ordem do Mapa de Funcionalidades. Em destaque, o que entra no M0. '
  u'Clique numa funcionalidade para ver o que ela faz, a história da faixa e o link para a descrição completa no PRD '
  u'do módulo.</p>')
A(u'<div class="mod-tools" style="padding:4px 0 0"><button class="mini-btn" type="button" data-expandir="sec03" data-abrir="1">'
  u'Expandir todas as %d</button><button class="mini-btn" type="button" data-expandir="sec03" data-abrir="0">Recolher todas</button></div>' % TOTAL)
A(u'<div id="sec03">')
for bi, nome, fs, f, c, p in por_mod:
    resumo = u' · '.join(u'%s %d' % (ROTULO[k], c[k]) for k in ('M0', 'M1', 'M2', 'X') if c[k])
    A(u'<div class="mod">')
    A(u'<div class="mod-hdr"><span class="mod-name">%s</span>%s<span class="mod-count">%s · %d no total</span></div>'
      % (nome, chip('M0') if c['M0'] else u'', resumo, len(fs)))
    A(u'<div class="mod-note">%s</div>' % NOTA[bi])
    A(u'<div class="mod-tools"><button class="mini-btn" type="button" data-expandir="mod-%d" data-abrir="1">Expandir todas</button>'
      u'<button class="mini-btn" type="button" data-expandir="mod-%d" data-abrir="0">Recolher</button></div>' % (bi, bi))
    A(u'<ul class="fx-list" id="mod-%d">' % bi)
    for i, ((n, t, novo), fx) in enumerate(zip(fs, f)):
        A(linha_expansivel(bi, i, n, novo, fx, p[i] if p and i < len(p) and p[i] else u''))
    A(u'</ul></div>')
A(u'</div>')

# exportacao para revisao
A(u'<div class="dl-card">'
  u'<div class="dl-body">'
  u'<div class="dl-title">Revisar esta lista numa planilha</div>'
  u'<div class="dl-desc">A página é para ler; a planilha é para revisar. Cada uma das <strong>%d</strong> '
  u'funcionalidades vira uma linha, com a faixa proposta ao lado de três colunas em branco — '
  u'<em>faixa revisada</em>, <em>concorda?</em> e <em>comentário</em>. Sai da mesma execução que gera esta página, '
  u'então nunca descreve uma priorização diferente da que está acima.</div>'
  u'</div>'
  u'<a class="dl-big" href="%s" download>↓ Baixar .xlsx</a>'
  u'</div>' % (TOTAL, XLSX))
A(u'<div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>Aba</th><th>O que traz</th></tr></thead><tbody>'
  u'<tr><td><strong>Priorização</strong></td><td>Uma linha por funcionalidade: grupo, módulo, nome, tipo, origem '
  u'(do mapa ou nova), faixa proposta e ordem de construção. Filtro em todas as colunas e cabeçalho fixo; '
  u'as colunas de revisão têm lista de valores, para a resposta voltar padronizada</td></tr>'
  u'<tr><td><strong>Resumo</strong></td><td>Os 20 módulos com a contagem por faixa e a justificativa do corte — '
  u'a mesma que aparece acima, em texto puro</td></tr>'
  u'<tr><td><strong>Como revisar</strong></td><td>O critério, as quatro faixas, o que escrever em cada coluna, e '
  u'a ficha desta fotografia: versão, data e escopo</td></tr>'
  u'</tbody></table></div>')
A(u'<p class="sec-sub" style="margin-top:10px">A planilha é <strong>entrada</strong> da revisão, nunca fonte da '
  u'verdade: o que voltar preenchido é aplicado em <code>tools/gerar-priorizacao.py</code>, que regenera a página '
  u'e a própria planilha.</p>')
A(u'</div>')

# 04 revisoes de faixa
A(u'<div class="section">')
A(u'<div class="sec-hdr"><span class="sec-num">04</span><span class="sec-title">Revisões de faixa</span></div>')
A(u'<p class="sec-sub">A atribuição da seção 03 é a original. Toda mudança posterior fica registrada aqui — '
  u'de onde saiu, para onde foi, por quem e quando —, e é aplicada pelo gerador sobre a atribuição original. '
  u'Nenhuma faixa é reescrita em silêncio.</p>')
for titulo, autor, data, _itens in REVISOES:
    hs = [h for h in REV_HIST if h['autor'] == autor and h['data'] == data]
    mudou = [h for h in hs if h['de'] != h['para']]
    confirmou = [h for h in hs if h['de'] == h['para']]
    entrou = len([h for h in mudou if h['para'] == 'M0'])
    saiu = len([h for h in mudou if h['de'] == 'M0'])
    A(u'<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:16px 0 10px">'
      u'<span class="rev-aut">Revisto por <b>%s</b></span>'
      u'<span class="rev-aut">%s</span>'
      u'<span class="rev-aut">%s · %s</span>'
      u'<span class="rev-aut">M0 <span class="rev-de">%d</span> → <span class="rev-para sobe">%d</span></span>'
      u'</div>' % (autor, data,
                   u'%d mudança%s' % (len(mudou), u's' if len(mudou) != 1 else u''),
                   u'%d confirmação%s' % (len(confirmou), u'ões' if len(confirmou) != 1 else u''),
                   TOT_ORIG['M0'], tot['M0']))
    A(u'<div class="table-wrap"><table><thead><tr><th>Módulo</th><th>Funcionalidade</th><th>De</th><th>Para</th>'
      u'<th>Revisor</th></tr></thead><tbody>')
    for h in hs:
        if h['de'] == h['para']:
            mov = u'<span class="rev-para" style="color:var(--txt3)">mantida</span>'
        else:
            sobe = ('M0', 'M1', 'M2', 'X').index(h['para']) < ('M0', 'M1', 'M2', 'X').index(h['de'])
            mov = u'<span class="rev-para %s">%s</span>' % ('sobe' if sobe else 'desce', ROTULO[h['para']])
        A(u'<tr><td>%s</td><td>%s</td><td><span class="rev-de">%s</span></td><td>%s</td><td>%s · %s</td></tr>'
          % (h['modulo'], h['func'], ROTULO[h['de']], mov, h['autor'], h['data']))
    A(u'</tbody></table></div>')
    A(u'<p class="sec-sub" style="margin-top:10px">Saldo da revisão: <strong>%d</strong> funcionalidades entraram no '
      u'M0 e <strong>%d</strong> saíram. O MVP passa de %d para <strong>%d</strong> funcionalidades — '
      u'%d%% do produto.</p>' % (entrou, saiu, TOT_ORIG['M0'], tot['M0'], pct(tot['M0'])))
A(u'<div class="callout warn"><div class="callout-title">O que esta revisão muda no critério</div>'
  u'<p>O corte original dizia que <strong>Inteligência explica o crédito e não o garante</strong>, e por isso ficava '
  u'fora. Com o score de risco, o ranking e o mapa de bolhas no M0, o MVP passa a incluir a leitura de risco por '
  u'fornecedor — que é o que diz <em>de quem cobrar primeiro</em>. É uma extensão legítima do critério, e vale '
  u'registrá-la: não é mais só a cadeia mínima, é a cadeia mínima <strong>mais a priorização da cobrança</strong>.</p>'
  u'<p style="margin-top:8px">Na direção contrária, <strong>Split Payment</strong> sai do M0 e vai para M2: dos três '
  u'métodos de recolhimento, o piloto passa a cobrir RAD e Fornecedor. É a mudança de maior efeito sobre a seção 01 — '
  u'a cadeia deixa de conhecer os três métodos desde o primeiro dia.</p></div>')
A(u'</div>')

# 05 cortes que doem
A(u'<div class="section">')
A(u'<div class="sec-hdr"><span class="sec-num">05</span><span class="sec-title">O que foi decidido, e o corte que resta</span></div>')
A(u'<p class="sec-sub">Quatro decisões já foram tomadas em 14/09/2026 e estão refletidas na atribuição acima.</p>')
A(u'<div class="table-wrap"><table><thead><tr><th>Decisão</th><th>Efeito no M0</th><th>O que vem junto</th></tr></thead><tbody>')
A(u'<tr><td><strong>API em três contextos</strong></td><td>Ingestão de DFs, RAD ↔ ERP e garantia de crédito, '
  u'mais ingestão por API e entrega ao ERP</td>'
  u'<td>O comprovante deixa de depender de upload manual, e o prazo do piloto passa a incluir o calendário do time '
  u'de ERP do cliente</td></tr>')
A(u'<tr><td><strong>Módulo de Integrações fora do M0</strong></td>'
  u'<td>Catorze das 16 funcionalidades de gestão — conexões, credenciais, escopos, log de entregas — vão para M1. O catálogo dos contextos e os comprovantes recebidos do ERP voltaram ao M0 em 15/09</td>'
  u'<td>No primeiro momento a configuração é por <strong>variável de ambiente</strong>. O vínculo da política de '
  u'execução com a conexão de destino volta ao M1 junto: sem tela de conexões, não há o que vincular</td></tr>')
A(u'<tr><td><strong>Portal do Fornecedor — <em>recortado</em></strong></td>'
  u'<td>Quatro entregas: acesso por convite, painel inicial, listagem dos documentos contra o comprador e '
  u'comprovantes de pagamento. As outras oito vão para M1 — ver seção 06</td>'
  u'<td>Primeira superfície do produto exposta a quem não é do time. Com a revisão de 15/09 o fornecedor também <em>responde</em>: o envio de comprovante RAD/PIX entrou. Contestação e chat seguem para depois</td></tr>')
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
A(u'<div class="info-card"><div class="info-card-title">Execução RAD — 7 de 15 no M0, depois da revisão de 15/09</div><ul>'
  u'<li>É o módulo mais completo do protótipo e o que menos prova a tese.</li>'
  u'<li>Entram: a política de execução, a janela, os critérios de inclusão, a listagem com o lote ao vivo, e — pela '
  u'revisão de 15/09 — a orquestração por CNPJ, a orquestração por contrato e a auditoria com diff campo a campo.</li>'
  u'<li>Ficam fora: a orquestração por faixa de valor, as quatro bases de comparação, a simulação e os alertas '
  u'de sobreposição.</li>'
  u'<li>Racional revisto: o MVP precisa saber <strong>de quem</strong> gerar a guia — por isso a orquestração por '
  u'CNPJ e por contrato subiu. Decidir <em>quando</em>, com precisão, continua fora.</li>'
  u'<li>Revisar se o piloto tiver volume alto de documentos por dia — aí a orquestração vira necessidade operacional.</li>'
  u'</ul></div>')
A(u'</div>')

# 05 portal
A(u'<div class="section">')
A(u'<div class="sec-hdr"><span class="sec-num">06</span><span class="sec-title">Dentro do Portal do Fornecedor</span></div>')
A(u'<p class="sec-sub">O portal entrou inteiro no M0 em 14/09 e foi <strong>recortado no mesmo dia</strong>. '
  u'O MVP entrega o mínimo para o fornecedor se virar sozinho: saber o que deve, ver os documentos contra o '
  u'comprador, ter os comprovantes à mão e — pela revisão de 15/09 — enviar o próprio comprovante. O resto espera.</p>')

_, pnome, pfs, pf, pc, pp = por_mod[11]
_m0 = [(i, n, nv, fx) for i, ((n, t, nv), fx) in enumerate(zip(pfs, pf)) if fx == 'M0']
_dep = [(i, n, nv, fx) for i, ((n, t, nv), fx) in enumerate(zip(pfs, pf)) if fx != 'M0']

A(u'<div class="mod">')
A(u'<div class="mod-hdr"><span class="mod-name">O que entra no MVP</span>%s'
  u'<span class="mod-count">%d de %d</span></div>' % (chip('M0'), len(_m0), len(pfs)))
A(u'<div class="mod-note">O fornecedor entra com credencial própria, abre um painel que responde “preciso fazer '
  u'alguma coisa hoje?”, vê seus documentos contra o comprador, encontra o comprovante do que já foi recolhido '
  u'e envia o seu quando recolheu. É a única ação que o portal aceita no MVP.</div>')
A(u'<ul class="fx-list">')
for i, n, nv, fx in _m0:
    A(linha_expansivel(11, i, n, nv, fx))
A(u'</ul></div>')

A(u'<div class="mod">')
A(u'<div class="mod-hdr"><span class="mod-name">Adiado</span>%s'
  u'<span class="mod-count">%d de %d</span></div>' % (chip('M1'), len(_dep), len(pfs)))
A(u'<div class="mod-note">O que faz o fornecedor <em>discutir</em> pelo portal — contestar, conversar — e o que faz ele entender '
  u'contexto: grupo econômico, contratos, score. Enviar comprovante saiu desta lista em 15/09.</div>')
A(u'<ul class="fx-list">')
for i, n, nv, fx in _dep:
    A(linha_expansivel(11, i, n, nv, fx))
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
A(u'<div class="sec-hdr"><span class="sec-num">07</span><span class="sec-title">Dentro das Integrações</span></div>')
A(u'<p class="sec-sub">A API tem seis contextos. A decisão de 14/09 coloca <strong>três</strong> no M0 — os que movem '
  u'documento, dinheiro e crédito. Os outros três são cadastro e notificação, e a tela dá conta deles no volume de um piloto.</p>')
A(u'<div class="callout info"><div class="callout-title">Contexto é capacidade; módulo é tela</div>'
  u'<p>Os três contextos do M0 dizem <strong>o que trafega</strong>. O módulo de Integrações — as 16 '
  u'funcionalidades de catálogo, conexão, credencial, escopo e log — é <strong>como se administra isso pela '
  u'interface</strong>, e ficou em M1, com a configuração por variável de ambiente. Duas voltaram ao M0 em '
  u'15/09: o <em>catálogo dos contextos</em>, que é a documentação viva que o time de ERP consulta, e os '
  u'<em>comprovantes recebidos do ERP</em>.</p>'
  u'<p style="margin-top:8px">O que isso custa: sem tela, conexão nova exige deploy; a credencial é rotacionada por '
  u'quem tem acesso ao ambiente; e o <em>log de entregas com inspeção de payload</em> — que estava no M0 justamente '
  u'para a conversa com o time de ERP não virar troca de e-mails — sai junto. Depurar divergência no piloto passa a '
  u'depender do log do servidor.</p></div>')
A(u'<div class="table-wrap"><table><thead><tr><th>Faixa</th><th>Contexto</th><th>Direção</th><th>O que trafega</th></tr></thead><tbody>')
for nome, dire, fx, desc in CONTEXTOS:
    A(u'<tr><td>%s</td><td><strong>%s</strong></td><td>%s</td><td>%s</td></tr>' % (chip(fx), nome, dire, desc))
A(u'</tbody></table></div>')
A(u'<p class="sec-sub" style="margin-top:18px">As funcionalidades de plataforma — conexões nas duas direções, '
  u'assistente de nova conexão, emissão de credencial, exibição única do segredo, escopos, alcance por CNPJ, '
  u'exemplo da primeira chamada, log de entregas com payload, reenvio e teste de conexão — servem os três '
  u'contextos e ficam em M1. Elas não se multiplicam por contexto: o que o M1 adiciona é escopo, não '
  u'infraestrutura.</p>')
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
  u'o calendário de um time que não é o seu</strong> — e a ferramenta que tornaria essa conversa suportável, o '
  u'log de entregas com inspeção de payload, está em M1. No MVP, depurar divergência depende do log do '
  u'servidor.</p></div>')
A(u'</div>')

# 07 decisoes
A(u'<div class="section">')
A(u'<div class="sec-hdr"><span class="sec-num">08</span><span class="sec-title">Decisões</span></div>')
DEC = [
    ('ok', u'D17 · Ressarcimento de M1 em diante — o M0 não muda',
     u'<strong>Decidido em 18/09/2026.</strong> Tudo o que o ressarcimento trouxe aos outros módulos entra em M1: o card do Início, '
     u'o painel do Crédito, o aviso do Débito, a família de inconsistências, o enquadramento na Organização e a saída para '
     u'ressarcimento na Apuração. O próprio módulo segue com 13 em M1 e 2 em M2. O M0 continua em 114.'),
    ('?', u'D18 · Motor de compensação pela ordem do art. 53',
     u'<strong>Em aberto.</strong> Na base, o crédito dado como compensado e o débito dado como extinto por compensação não se '
     u'casam, e sobra crédito parado com débito do mesmo tributo em aberto. O motor casaria os dois lados por tributo e período. '
     u'Se aprovado, entra em M1 ou depois — o M0 não muda. Ver a validação dos hubs, v1.1.'),
    ('ok', u'D16 · Ressarcimento fora do M0',
     u'<strong>Decidido em 18/09/2026.</strong> O módulo foi implementado no protótipo, em simulação 2026, e entra no mapa com '
     u'15 funcionalidades — nenhuma no M0: 13 em M1 e 2 em M2. Substitui a sugestão da proposta, que levava 8 ao M0. '
     u'O M0 não muda de tamanho.'),
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
A(u'<div class="sec-hdr"><span class="sec-num">09</span><span class="sec-title">Histórico de versões</span></div>')
A(u'<div class="ver-row"><div class="ver-num">v2.5</div><div class="ver-desc">'
  u'18/09/2026 — Entram <strong>seis itens de ressarcimento nos outros módulos</strong>, todos em <strong>M1</strong> (D17): card do '
  u'Início, painel do Crédito, aviso do Débito, família de inconsistências, enquadramento na Organização e saída para ressarcimento '
  u'na Apuração. <strong>O M0 não muda.</strong> Descrições do método de extinção, da composição de créditos e do resumo da '
  u'apuração corrigidas pela auditoria. Nova decisão em aberto: motor de compensação do art. 53 (D18). Base: Mapa v2.4.</div></div>')
A(u'<div class="ver-row"><div class="ver-num">v2.4</div><div class="ver-desc">'
  u'18/09/2026 — Entra o módulo <strong>Ressarcimento</strong>, implementado no protótipo em simulação 2026: 15 funcionalidades, '
  u'<strong>nenhuma no M0</strong> (D16) — 13 em M1 e 2 em M2. O M0 não muda. Base: Mapa de Funcionalidades v2.3.</div></div>')
A(u'<div class="ver-row"><div class="ver-num">v2.3</div><div class="ver-desc">'
  u'16/09/2026 — <strong>Cada funcionalidade abre a própria descrição.</strong> Clicar na linha mostra o que ela '
  u'faz, o tipo, a origem, a história da faixa, a ordem de construção e o link para a descrição completa no PRD do '
  u'módulo — com botões para expandir um módulo ou a página inteira. Os vínculos foram conferidos um a um no texto '
  u'dos PRDs e ficam registrados no Mapa detalhado; o gerador falha se algum levar a uma âncora que não existe. '
  u'Onde não há PRD, a linha diz <em>sem PRD</em>. A planilha ganha as colunas Descrição e PRD.</div></div>')
A(u'<div class="ver-row"><div class="ver-num">v2.2</div><div class="ver-desc">'
  u'15/09/2026 — Entra o <strong>aviso ao fornecedor do recolhimento</strong> (Pagamentos RAD), em <strong>M0</strong>: '
  u'paga a guia, o fornecedor recebe o comprovante e o recado que impede o pagamento em duplicidade. É a contrapartida '
  u'do que o recorte do portal tinha deixado de fora, e chega por e-mail em vez de exigir que ele entre no portal. '
  u'O mapa vai de 183 para 184 funcionalidades; o M0, de 113 para %d.</div></div>' % tot['M0'])
A(u'<div class="ver-row"><div class="ver-num">v2.1</div><div class="ver-desc">'
  u'15/09/2026 — <strong>Revisão de faixa por Toshio:</strong> 22 mudanças e 1 confirmação, registradas uma a '
  u'uma na seção 04, com a faixa anterior ao lado da nova. O M0 passa de 102 para %d. As entradas de maior '
  u'efeito: <em>Inteligência</em> quase inteira (5 de 6), a orquestração de <em>Execução RAD</em> por CNPJ e por '
  u'contrato, <em>Conciliação</em> completa, e o envio de comprovante pelo portal. A saída de maior efeito: '
  u'<em>Split Payment</em> vai para M2, e o piloto passa a cobrir dois dos três métodos de recolhimento. '
  u'O gerador passa a aplicar as revisões sobre a atribuição original em vez de reescrevê-la, para que a faixa '
  u'anterior, o autor e a data sobrevivam à próxima revisão.</div></div>' % tot['M0'])
A(u'<div class="ver-row"><div class="ver-num">v2.0</div><div class="ver-desc">'
  u'15/09/2026 — <strong>A priorização passa a ser exportável para revisão.</strong> A mesma execução que gera esta '
  u'página grava <code>priorizacao-mvp.xlsx</code>: uma linha por funcionalidade, com a faixa proposta ao lado das '
  u'colunas em branco que o revisor preenche, mais o resumo por módulo e as instruções. Nenhuma faixa mudou — o que '
  u'muda é que revisar deixa de exigir transcrever a página à mão.</div></div>')
A(u'<div class="ver-row"><div class="ver-num">v1.9</div><div class="ver-desc">'
  u'14/09/2026 — <strong>Régua de cobrança entra no M0.</strong> Seis funcionalidades do módulo de Automações; '
  u'relatórios agendados e ITSM permanecem em M1. A decisão traz junto dois itens novos, ambos inexistentes: '
  u'o <em>motor de execução</em> — sem ele o módulo só desenha automações — e o <em>envio de e-mail transacional</em>, '
  u'que passa a atender também o convite do fornecedor. M0 passa de 94 para 102.</div></div>')
A(u'<div class="ver-row"><div class="ver-num">v1.8</div><div class="ver-desc">'
  u'14/09/2026 — <strong>Portal do Fornecedor recortado.</strong> O M0 fica com quatro entregas: acesso por convite, '
  u'<em>painel inicial</em> e <em>comprovantes de pagamento disponíveis ao fornecedor</em> — as duas novas, que não '
  u'existem hoje — e a listagem dos documentos contra o comprador. As outras oito vão para M1, inclusive o aviso de '
  u'recolhimento assumido, cujo custo está declarado na seção 06. M0 passa de 100 para 94.</div></div>')
A(u'<div class="ver-row"><div class="ver-num">v1.7</div><div class="ver-desc">'
  u'14/09/2026 — <strong>O módulo de Integrações sai do M0</strong>: no primeiro momento a configuração é por '
  u'variável de ambiente, e as 16 funcionalidades de gestão vão para M1, junto com o vínculo da política de execução '
  u'com a conexão de destino. Os três contextos da API e as quatro integrações externas <em>permanecem</em> no M0 — '
  u'contexto é capacidade, módulo é tela. M0 passa de 113 para 100.</div></div>')
A(u'<div class="ver-row"><div class="ver-num">v1.6</div><div class="ver-desc">'
  u'14/09/2026 — Entram quatro <strong>integrações externas a desenvolver</strong>, todas em M0: Receita Federal '
  u'(CBS), Comitê Gestor (IBS), RAD e Databricks para comprovantes. Nenhuma existe hoje. As duas primeiras são o '
  u'que transforma a conciliação em confronto de verdade — e trazem ao MVP uma data que o time não controla. '
  u'M0 passa de 109 para 113; as funcionalidades fora do mapa, de 1 para 5.</div></div>')
A(u'<div class="ver-row"><div class="ver-num">v1.5</div><div class="ver-desc">'
  u'14/09/2026 — O acesso do fornecedor por convite e a importação em massa por CSV foram <strong>implementados</strong>. '
  u'As onze funcionalidades deixam de ser previsão e entram no mapa, que vai de 172 para 183. '
  u'M0 passa de 99 para 109; das funcionalidades fora do mapa resta apenas o SSO corporativo.</div></div>')
A(u'<div class="ver-row"><div class="ver-num">v1.4</div><div class="ver-desc">'
  u'14/09/2026 — <strong>Proposta aprovada.</strong> D1 (o critério é a cadeia do crédito) e D2 (Execução RAD em 5 de 15) '
  u'aprovadas, fechando as seis decisões da proposta. Escopo do MVP definido em 99 funcionalidades.</div></div>')
A(u'<div class="ver-row"><div class="ver-num">v1.3</div><div class="ver-desc">'
  u'14/09/2026 — Removida a seção de pré-requisitos de fundação (persistência, autenticação, Apuração Assistida, '
  u'motor de automações e cálculo de juros e multa), e com ela a decisão D5, que existia só para aprová-los. '
  u'A proposta passa a tratar apenas do escopo funcional.</div></div>')
A(u'<div class="ver-row"><div class="ver-num">v1.2</div><div class="ver-desc">'
  u'14/09/2026 — A API no M0 passa a ter escopo declarado: três dos seis contextos (ingestão de DFs, RAD ↔ ERP e '
  u'garantia de crédito). D7 decidida — o fornecedor entra por convite com senha própria, o que acrescenta a segunda '
  u'funcionalidade nova. M0 em 99 de 173.</div></div>')
A(u'<div class="ver-row"><div class="ver-num">v1.1</div><div class="ver-desc">'
  u'14/09/2026 — Três decisões tomadas: <strong>API</strong>, <strong>Portal do Fornecedor</strong> e <strong>SSO</strong> '
  u'no M0. O MVP passa de 71 para 98 funcionalidades. Acrescenta a ordem de construção interna do portal (P1/P2/P3), '
  u'o SSO como funcionalidade nova fora do mapa, e a decisão D7 sobre o acesso do fornecedor externo.</div></div>')
A(u'<div class="ver-row"><div class="ver-num">v1.0</div><div class="ver-desc">'
  u'14/09/2026 — Primeira proposta, sobre o Mapa de Funcionalidades v2.1 (172 funcionalidades, 20 módulos). '
  u'Quatro faixas, atribuição item a item, cinco pré-requisitos de fundação e cinco decisões em aberto.</div></div>')
A(u'</div>')

A(u'''</div>
<script>
/* Expandir e recolher. As linhas abrem e fecham sem script; ele so move varias de uma vez. */
document.addEventListener('click', function (e) {
  var b = e.target.closest('[data-expandir]');
  if (!b) return;
  var alvo = document.getElementById(b.getAttribute('data-expandir'));
  if (!alvo) return;
  var abrir = b.getAttribute('data-abrir') === '1';
  alvo.querySelectorAll('details.fd').forEach(function (d) { d.open = abrir; });
});
</script>
</body>
</html>
''')

io.open(DEST, 'w', encoding='utf-8', newline='').write(head + u'\n'.join(B))
print('gerado', DEST)
print('M0=%d M1=%d M2=%d X=%d total=%d' % (tot['M0'], tot['M1'], tot['M2'], tot['X'], TOTAL))

# ── planilha de revisao ────────────────────────────────────────────────────
# A pagina e para ler; a planilha e para revisar. As duas saem da mesma fonte
# na mesma execucao, para nao existir versao da priorizacao que so uma conheca.
try:
    import priorizacao_xlsx
except ImportError:
    import sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    try:
        import priorizacao_xlsx
    except ImportError as e:
        priorizacao_xlsx = None
        print('AVISO: planilha nao gerada (%s). Instale com: pip install openpyxl' % e)

if priorizacao_xlsx:
    n = priorizacao_xlsx.gerar(
        BASE + XLSX, por_mod, NOTA, GRUPO_DE,
        {'tot': tot, 'total': TOTAL, 'do_mapa': DO_MAPA, 'novas': NOVAS_N,
         'mods': len(MODS), 'versao': VERSAO, 'data': DATA, 'base': BASE_MAPA},
        REV_INDEX, REV_HIST, INFO, URL_DOCS)
    print('gerado', BASE + XLSX, '-', n, 'linhas')
