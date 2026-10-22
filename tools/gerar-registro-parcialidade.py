# -*- coding: utf-8 -*-
"""Gera o registro de alterações da parcialidade do crédito a partir de tools/registro-parcialidade.json.

Toda mudança da parcialidade — documento do hub, API da plataforma, protótipo ou ambiente de avaliação —
entra no JSON e o documento é regerado:  python tools/gerar-registro-parcialidade.py
Escreve src/docs/parcialidade-registro-alteracoes.html e o espelho em docs/docs/."""
import io
import json
import os

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DADOS = os.path.join(RAIZ, 'tools', 'registro-parcialidade.json')
SAIDAS = [os.path.join(RAIZ, 'src', 'docs', 'parcialidade-registro-alteracoes.html'),
          os.path.join(RAIZ, 'docs', 'docs', 'parcialidade-registro-alteracoes.html')]
BASE = os.path.join(RAIZ, 'src', 'docs', 'dere-referencia.html')

d = json.load(io.open(DADOS, encoding='utf-8'))
SIT = {
    'publicado': (u'Publicado', 'ok'),
    'branch': (u'Na branch', 'info'),
    'aguardando': (u'Aguardando você', 'warn'),
    'planejado': (u'A fazer', 'pend'),
    'aberto': (u'Sem decisão', 'nao'),
}

base = io.open(BASE, encoding='utf-8').read()
TB = u'<title>DeRE — Referência · SplitHub v1.0</title>'
assert TB in base
head = base[:base.index('</head>')].replace(TB, u'<title>Parcialidade — registro de alterações · SplitHub v%s</title>' % d['versao'])
head += u'''<style>
.rg-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; margin: 4px 0 18px; }
.rg-kpi { border: 1px solid var(--brd); border-radius: 8px; background: var(--sur); padding: 8px 12px; }
.rg-kpi b { display: block; font-family: 'JetBrains Mono', monospace; font-size: 20px; color: var(--txt1); }
.rg-kpi span { font-size: 11.5px; color: var(--txt3); }
.rg table { min-width: 720px; }
.rg td:nth-child(4) { min-width: 220px; }
.rg td:nth-child(5), .rg td:nth-child(6) { min-width: 80px; }
.rg td { vertical-align: top; }
.rg td:first-child { font-weight: 600; color: var(--txt1); }
.rg .ver { font-family: 'JetBrains Mono', monospace; font-size: 11.5px; white-space: nowrap; }
.rg .ref, .rg .dec { font-size: 11px; color: var(--txt3); }
.st { display: inline-block; font-size: 10.5px; font-weight: 700; border-radius: 999px; padding: 1px 8px; white-space: nowrap; }
.st.ok { color: var(--green); background: var(--green-d); } .st.info { color: var(--teal); background: var(--teal-d); }
.st.warn { color: var(--amber); background: var(--amber-d); } .st.pend { color: var(--txt2); background: var(--sur3); }
.st.nao { color: var(--purple); background: var(--sur3); }
</style>
'''


def esc(s):
    return s.replace(u'&', u'&amp;').replace(u'<', u'&lt;').replace(u'>', u'&gt;')


cont = {}
for g in d['grupos']:
    for it in g['itens']:
        cont[it['situacao']] = cont.get(it['situacao'], 0) + 1
total = sum(cont.values())

secs = []
toc = []
for n, g in enumerate(d['grupos'], 1):
    num = u'%02d' % n
    toc.append(u'<li><a href="#s%s"><span class="toc-num">%s</span> %s</a></li>' % (num, num, esc(g['titulo'])))
    linhas = u''
    for it in g['itens']:
        rot, cls = SIT[it['situacao']]
        nome = esc(it['artefato'])
        if it.get('link'):
            nome = u'<a class="xref" href="%s">%s</a>' % (it['link'], nome)
        ver = esc(it['agora']) if it['antes'] in (u'—', u'') else u'%s → %s' % (esc(it['antes']), esc(it['agora']))
        linhas += (u'<tr><td>%s</td><td class="ver">%s</td><td class="ver">%s</td><td>%s</td><td class="dec">%s</td><td class="ref">%s</td><td><span class="st %s">%s</span></td></tr>\n'
                   % (nome, ver, esc(it['data']), esc(it['mudou']), esc(it['decisoes']), esc(it['ref']), cls, rot))
    secs.append(u'<div class="section" id="s%s">\n<div class="sec-hdr"><span class="sec-num">%s</span><span class="sec-title">%s</span></div>\n'
                u'<p class="sec-sub">%s · %d artefatos</p>\n<div class="table-wrap rg"><table><thead><tr><th>Artefato</th><th>Versão</th><th>Data</th><th>O que mudou</th><th>Decisões</th><th>Referência</th><th>Situação</th></tr></thead><tbody>\n%s</tbody></table></div>\n</div>\n'
                % (num, num, esc(g['titulo']), esc(g['sub']), len(g['itens']), linhas))

kpis = u''.join(u'<div class="rg-kpi"><b>%d</b><span>%s</span></div>' % (cont.get(k, 0), SIT[k][0]) for k in ('publicado', 'branch', 'aguardando', 'planejado', 'aberto'))
corpo = (u'</head>\n<body>\n<div class="doc">\n<a class="back" href="prds.html">← Hub de PRDs</a>\n'
         u'<div class="eyebrow">Registro · Parcialidade do crédito</div>\n<h1>Registro de alterações</h1>\n'
         u'<p class="subtitle">Todo artefato que a parcialidade do crédito mudou — documentação do hub, API da plataforma e protótipo — e o que ainda vai mudar, com a versão, a data, a decisão que sustenta a mudança e a situação. Atualizado a cada alteração.</p>\n'
         u'<div class="meta-bar"><div class="meta-pill"><span class="meta-label">Versão</span>&nbsp;<span class="meta-val">%s</span></div>'
         u'<div class="meta-pill"><span class="meta-label">Atualizado</span>&nbsp;<span class="meta-val">%s</span></div>'
         u'<div class="meta-pill"><span class="meta-label">Artefatos</span>&nbsp;<span class="meta-val">%d</span></div></div>\n'
         % (d['versao'], d['atualizado'], total)
         + u'<div class="rg-kpis">' + kpis + u'</div>\n'
         + u'<div class="toc"><div class="toc-title">Índice</div><ul class="toc-list">\n' + u'\n'.join(toc) + u'\n</ul></div>\n'
         + u''.join(secs)
         + u'<p class="sec-sub">Mantido a partir de <code>tools/registro-parcialidade.json</code>. Detalhe das decisões na <a class="xref" href="proposta-parcialidade-aprovacao.html">proposta de aprovação por partes</a>; leitura de uma página no <a class="xref" href="parcialidade-resumo-executivo.html">resumo executivo</a>.</p>\n'
         u'</div>\n</body>\n</html>\n')
for s in SAIDAS:
    io.open(s, 'w', encoding='utf-8', newline='\n').write(head + corpo)
print('ok', total, 'artefatos', cont)
