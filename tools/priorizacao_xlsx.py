# -*- coding: utf-8 -*-
"""Exporta a priorizacao para uma planilha de revisao (.xlsx).

Chamado por gerar-priorizacao.py. Requer openpyxl:

    pip install openpyxl

A planilha tem tres abas: Priorizacao (uma linha por funcionalidade, com as
colunas de revisao em branco), Resumo (contagem por modulo e a nota do corte)
e Como revisar (criterio, legendas e instrucoes).
"""
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

# paleta do produto
TEAL, AZUL, ROXO, CINZA = '0E9E8E', '1D5FCC', '6D28D9', '6B7280'
ESCURO, PAPEL, LINHA = '0F172A', 'F8FAFC', 'E2E8F0'

COR_FAIXA = {'M0': TEAL, 'M1': AZUL, 'M2': ROXO, 'X': CINZA}
FUNDO_FAIXA = {'M0': 'E6F5F3', 'M1': 'E8F0FC', 'M2': 'F0EAFB', 'X': 'F1F5F9'}
ROTULO = {'M0': 'M0', 'M1': 'M1', 'M2': 'M2', 'X': 'Fora'}

TIPO = {'l': u'Listagem', 'a': u'Ação', 'r': u'Risco/Inc.',
        'g': u'Analítico', 'c': u'Configuração', 'p': u'Transversal'}

COLS = [
    (u'#', 6), (u'Grupo', 14), (u'Módulo', 22), (u'Funcionalidade', 44), (u'Descrição', 70), (u'PRD', 40),
    (u'Tipo', 14), (u'Origem', 10), (u'Faixa atual', 12), (u'Faixa anterior', 13), (u'Revisto por', 18),
    (u'Prioridade', 11),
    (u'Faixa revisada', 15), (u'Concorda?', 11), (u'Comentário do revisor', 52),
]
# posicao das colunas pelo nome: acrescentar coluna nao desloca regra nenhuma
COL = dict((nome, i) for i, (nome, _l) in enumerate(COLS, 1))
FAIXA_COL = COL[u'Faixa atual']
REVISAO = (COL[u'Faixa revisada'], COL[u'Concorda?'], COL[u'Comentário do revisor'])
QUEBRA = (COL[u'Funcionalidade'], COL[u'Descrição'], COL[u'PRD'], COL[u'Comentário do revisor'])

borda = Border(bottom=Side(style='thin', color=LINHA))


def _cabecalho(ws, cols):
    for i, (nome, larg) in enumerate(cols, 1):
        c = ws.cell(row=1, column=i, value=nome)
        c.font = Font(bold=True, color='FFFFFF', size=10)
        c.fill = PatternFill('solid', fgColor=ESCURO if i not in REVISAO else TEAL)
        c.alignment = Alignment(vertical='center', horizontal='left', wrap_text=True)
        ws.column_dimensions[get_column_letter(i)].width = larg
    ws.row_dimensions[1].height = 26


def _prd_texto(v):
    """Rotulo da coluna PRD: o mesmo que a pagina mostra, em texto puro."""
    if v['nivel'] in ('bloco', 'secao'):
        return u'%s · %s %s' % (v['rotulo'], v['fid'], v['destino'])
    if v['nivel'] == 'sem':
        return u'Sem PRD'
    return v['rotulo']


def gerar(dest, por_mod, nota, grupo_de, meta, rev_index=None, rev_hist=None, info=None, url_docs=u''):
    """por_mod: [(bi, nome, [(func, tipo, nova)], [faixa], contagem, [prio])]
    info: {(bi, i): {'t', 'd', 'v'}} com a descricao e o vinculo resolvido com o PRD."""
    rev_index = rev_index or {}
    rev_hist = rev_hist or []
    info = info or {}
    wb = Workbook()

    # ── aba 1: uma linha por funcionalidade ────────────────────────────────
    ws = wb.active
    ws.title = u'Priorização'
    _cabecalho(ws, COLS)

    ln = 1
    n = 0
    for bi, nome, fs, faixas, _c, prios in por_mod:
        for i, ((func, tipo, nova), fx) in enumerate(zip(fs, faixas)):
            ln += 1
            n += 1
            pr = prios[i] if prios and i < len(prios) and prios[i] else u''
            h = rev_index.get((bi, i))
            anterior = ROTULO[h['de']] if h and h['de'] != h['para'] else u''
            quem = u'%s · %s' % (h['autor'], h['data']) if h else u''
            it = info.get((bi, i), {})
            vinc = it.get('v') or {'nivel': 'sem', 'rotulo': u'Sem PRD', 'href': None}
            valores = [n, grupo_de.get(bi, u''), nome, func, it.get('d', u''), _prd_texto(vinc),
                       TIPO.get(tipo, tipo), u'Nova' if nova else u'Mapa', ROTULO[fx], anterior, quem, pr,
                       u'', u'', u'']
            for j, v in enumerate(valores, 1):
                c = ws.cell(row=ln, column=j, value=v)
                c.font = Font(size=10)
                c.border = borda
                c.alignment = Alignment(vertical='top', wrap_text=(j in QUEBRA))
                if j in REVISAO:
                    c.fill = PatternFill('solid', fgColor='FFFDF5')
            cp = ws.cell(row=ln, column=COL[u'PRD'])
            if vinc.get('href'):
                href = vinc['href']
                cp.hyperlink = href if href.startswith('http') else url_docs + href
                cp.font = Font(size=10, color=TEAL, underline='single')
            elif vinc['nivel'] == 'sem':
                cp.font = Font(size=10, bold=True, color='B97A10')
            f = ws.cell(row=ln, column=FAIXA_COL)
            f.font = Font(size=10, bold=True, color=COR_FAIXA[fx])
            f.fill = PatternFill('solid', fgColor=FUNDO_FAIXA[fx])
            f.alignment = Alignment(horizontal='center', vertical='top')
            if nova:
                ws.cell(row=ln, column=COL[u'Origem']).font = Font(size=10, bold=True, color='B97A10')
            if anterior:
                ws.cell(row=ln, column=COL[u'Faixa anterior']).font = Font(size=10, bold=True, color='B97A10')

    ws.freeze_panes = 'D2'
    ws.auto_filter.ref = 'A1:%s%d' % (get_column_letter(len(COLS)), ln)

    dv_faixa = DataValidation(type='list', formula1=u'"M0,M1,M2,Fora"', allow_blank=True)
    dv_faixa.error = u'Use M0, M1, M2 ou Fora.'
    dv_faixa.promptTitle = u'Faixa revisada'
    dv_faixa.prompt = u'Preencha apenas quando discordar da faixa proposta.'
    ws.add_data_validation(dv_faixa)
    dv_faixa.add('%s2:%s%d' % (get_column_letter(REVISAO[0]), get_column_letter(REVISAO[0]), ln))

    dv_sn = DataValidation(type='list', formula1=u'"Sim,Não"', allow_blank=True)
    dv_sn.promptTitle = u'Concorda com a faixa proposta?'
    dv_sn.prompt = u'Deixe em branco o que ainda não revisou.'
    ws.add_data_validation(dv_sn)
    dv_sn.add('%s2:%s%d' % (get_column_letter(REVISAO[1]), get_column_letter(REVISAO[1]), ln))

    # ── aba 2: resumo por módulo ───────────────────────────────────────────
    r = wb.create_sheet(u'Resumo')
    _cabecalho(r, [(u'Grupo', 14), (u'Módulo', 24), (u'M0', 7), (u'M1', 7), (u'M2', 7),
                   (u'Fora', 7), (u'Total', 8), (u'Por que o corte é este', 92)])
    lr = 1
    for bi, nome, fs, faixas, c, _p in por_mod:
        lr += 1
        vals = [grupo_de.get(bi, u''), nome, c['M0'], c['M1'], c['M2'], c['X'], len(fs),
                _limpo(nota.get(bi, u''))]
        for j, v in enumerate(vals, 1):
            cel = r.cell(row=lr, column=j, value=v)
            cel.font = Font(size=10)
            cel.border = borda
            cel.alignment = Alignment(vertical='top', wrap_text=(j == 8))
        r.cell(row=lr, column=3).font = Font(size=10, bold=True, color=TEAL)
    lr += 2
    r.cell(row=lr, column=1, value=u'Total').font = Font(bold=True, size=10)
    for j, k in ((3, 'M0'), (4, 'M1'), (5, 'M2'), (6, 'X')):
        r.cell(row=lr, column=j, value=meta['tot'][k]).font = Font(bold=True, size=10)
    r.cell(row=lr, column=7, value=meta['total']).font = Font(bold=True, size=10)
    r.freeze_panes = 'C2'

    # ── aba 3: historico de revisoes ───────────────────────────────────────
    if rev_hist:
        h = wb.create_sheet(u'Revisões')
        _cabecalho(h, [(u'Revisão', 24), (u'Revisor', 14), (u'Data', 12), (u'Módulo', 22),
                       (u'Funcionalidade', 52), (u'De', 8), (u'Para', 8), (u'Movimento', 14)])
        lh = 1
        ordem = ('M0', 'M1', 'M2', 'X')
        for it in rev_hist:
            lh += 1
            if it['de'] == it['para']:
                mov, cor = u'mantida', CINZA
            elif ordem.index(it['para']) < ordem.index(it['de']):
                mov, cor = u'antecipada', TEAL
            else:
                mov, cor = u'adiada', ROXO
            vals = [it['titulo'], it['autor'], it['data'], it['modulo'], it['func'],
                    ROTULO[it['de']], ROTULO[it['para']], mov]
            for j, v in enumerate(vals, 1):
                c = h.cell(row=lh, column=j, value=v)
                c.font = Font(size=10)
                c.border = borda
                c.alignment = Alignment(vertical='top', wrap_text=(j == 5))
            h.cell(row=lh, column=7).font = Font(size=10, bold=True, color=COR_FAIXA[it['para']])
            h.cell(row=lh, column=8).font = Font(size=10, bold=True, color=cor)
        h.freeze_panes = 'D2'
        h.auto_filter.ref = 'A1:H%d' % lh

    # ── aba 3: como revisar ────────────────────────────────────────────────
    g = wb.create_sheet(u'Como revisar')
    g.column_dimensions['A'].width = 20
    g.column_dimensions['B'].width = 104
    lg = 0

    def linha(i, a, b, cabeca=False):
        ca = g.cell(row=i, column=1, value=a)
        cb = g.cell(row=i, column=2, value=b)
        ca.font = Font(bold=True, size=11 if cabeca else 10, color=TEAL if cabeca else ESCURO)
        ca.alignment = Alignment(vertical='top')
        cb.font = Font(size=10)
        cb.alignment = Alignment(vertical='top', wrap_text=True)

    def bloco(i, titulo, linhas):
        i += 1
        linha(i, titulo, u'', cabeca=True)
        for a, b in linhas:
            i += 1
            linha(i, a, b)
        return i + 1

    lg = bloco(lg, u'O critério', [
        (u'', u'Uma funcionalidade entra no MVP se a cadeia mínima do crédito não se fecha sem ela: '
              u'o documento entra · o método de pagamento é conhecido · o tributo é recolhido · '
              u'o recolhimento é confirmado · o crédito é apropriado · o que falhou vira tratável.'),
        (u'Consequência', u'Analytics, FCT e Inteligência ficam fora do MVP mesmo estando prontos. '
                          u'Eles explicam o crédito; não o garantem. Prontidão não é argumento de prioridade.'),
    ])
    lg = bloco(lg, u'As quatro faixas', [
        (u'M0', u'MVP — a cadeia do crédito, ponta a ponta, para uma operação e um time pequeno.'),
        (u'M1', u'Escala — o que tira o operador do meio: orquestração, ERP, portal, automações, multiusuário.'),
        (u'M2', u'Inteligência — projeção, score e assistente, sobre a base que o M0 e o M1 produzem.'),
        (u'Fora', u'Qualidade de engenharia transversal. Entra junto com o que precisa dela.'),
    ])
    lg = bloco(lg, u'Como preencher', [
        (u'Faixa revisada', u'Só quando discordar da proposta. Escolha M0, M1, M2 ou Fora na lista.'),
        (u'Concorda?', u'Sim ou Não. Em branco significa "ainda não revisei" — é assim que se sabe o que falta.'),
        (u'Comentário', u'O porquê. Uma linha basta; é ela que sustenta a mudança de faixa na próxima versão.'),
        (u'Origem', u'"Mapa" está no Mapa de Funcionalidades. "Nova" ainda não existe no produto e entra na '
                    u'priorização mesmo assim.'),
        (u'Prioridade', u'Ordem de construção dentro do M0, onde o módulo é grande demais para entrar de uma vez.'),
        (u'Descrição', u'O que a funcionalidade faz e por que existe, como está no Mapa de Funcionalidades detalhado.'),
        (u'PRD', u'Link para a descrição completa no PRD do módulo. "Sem PRD" quando o módulo não tem um; '
                 u'"Não descrita no PRD" quando o PRD existe e ainda não fala dela.'),
        (u'Faixa anterior', u'Preenchida quando a faixa já foi revisada uma vez. A coluna ao lado diz quem revisou e '
                            u'quando; o registro completo está na aba Revisões.'),
    ])
    lg = bloco(lg, u'Depois de revisar', [
        (u'', u'Devolva a planilha preenchida. As faixas revisadas voltam para tools/gerar-priorizacao.py, '
              u'que regenera a página — a planilha é a entrada da revisão, nunca a fonte da verdade.'),
        (u'Fonte da verdade', u'O inventário é o Mapa de Funcionalidades; a priorização é o gerador. '
                              u'Esta planilha é uma fotografia dos dois, tirada na data abaixo.'),
    ])
    lg = bloco(lg, u'Esta fotografia', [
        (u'Versão', meta['versao']),
        (u'Data', meta['data']),
        (u'Base', meta['base']),
        (u'Escopo', u'%d funcionalidades · %d módulos · %d do mapa + %d novas'
                    % (meta['total'], meta['mods'], meta['do_mapa'], meta['novas'])),
        (u'M0 · M1 · M2 · Fora', u'%d · %d · %d · %d'
                                 % (meta['tot']['M0'], meta['tot']['M1'], meta['tot']['M2'], meta['tot']['X'])),
    ])

    for aba in [x for x in wb.worksheets]:
        aba.sheet_view.showGridLines = False

    wb.save(dest)
    return ln - 1


def _limpo(html):
    """Tira as tags das notas do corte, que sao HTML na pagina."""
    import re
    return re.sub(r'<[^>]+>', '', html)
