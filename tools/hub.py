# -*- coding: utf-8 -*-
"""Manutenção do Hub de PRDs: versões arquivadas, links e changelog.

Uso:
  python tools/hub.py indice     gera src/docs/versoes/index.html (e a cópia em docs/docs/versoes)
  python tools/hub.py checar     lista os links relativos quebrados em src/docs e src/docs/versoes
  python tools/hub.py arquivar src/docs/prd-x.html 1.4
                                 copia o documento atual para versoes/prd-x-v1.4.html, com os links
                                 ajustados para a pasta, antes de você editar a versão nova
  python tools/hub.py changelog <ver> <dd/mm/aaaa> "<módulo>" "<título>" "<corpo html>"
                                 insere a entrada com o próximo R-NNN no topo do prds.html e do
                                 changelog-hub.html; o hub fica com as 30 mais recentes

Desde 27/10/2026 (R-270) as versões antigas ficam em src/docs/versoes/, não ao lado das vigentes,
e o histórico completo do changelog fica em src/docs/changelog-hub.html.
Os links de dentro de uma versão arquivada apontam um nível acima (../), exceto para outras versões.
Depois de qualquer mudança: espelhar src/docs em docs/docs (e prds.html em docs/prds.html)."""
import io
import os
import re
import shutil
import sys
from html import escape as h

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(REPO, 'src', 'docs')
V = os.path.join(D, 'versoes')
ESPELHO = os.path.join(REPO, 'docs', 'docs')
VER = re.compile(r'^(?P<doc>.+)-v(?P<v>\d+(?:\.\d+)+)\.html$')
EXTERNO = re.compile(r'^(?:[a-z]+:|//|#|/)', re.I)
LINK = re.compile(r'((?:href|src)=")([^"]*)(")')


def _titulo(arq):
    t = io.open(arq, encoding='utf-8', errors='ignore').read(6000)
    m = re.search(r'<title>(.*?)</title>', t, re.S)
    return re.sub(r'\s+', ' ', m.group(1)).strip() if m else os.path.basename(arq)


def ajustar_para_versoes(txt, versoes):
    """Links de um documento que passa a morar em versoes/: tudo sobe um nível, menos as outras versões."""
    def f(m):
        url = m.group(2)
        if not url or EXTERNO.match(url) or url.startswith('../'):
            return m.group(0)
        base = re.split(r'[#?]', url)[0]
        if base in versoes or base.startswith('versoes/'):
            return m.group(1) + url.replace('versoes/', '', 1) + m.group(3)
        return m.group(1) + '../' + url + m.group(3)
    txt = LINK.sub(f, txt)
    return re.sub(r"url\((['\"]?)(?!https?:|data:|/|#|\.\./)([^)'\"]+)\1\)", r"url(\1../\2\1)", txt)


def indice():
    arqs = sorted(f for f in os.listdir(V) if VER.match(f))
    por = {}
    for f in arqs:
        m = VER.match(f)
        por.setdefault(m.group('doc'), []).append((tuple(int(x) for x in m.group('v').split('.')), m.group('v'), f))
    o = [u'<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
         u'<title>Versões Arquivadas · SplitHub</title>\n<style>\n'
         u':root { --bg:#F7F8FA; --sur:#FFFFFF; --brd:#DDE1EA; --txt1:#131720; --txt2:#4A5568; --txt3:#8A92A3; --teal:#0E9E8E; --teal-d:rgba(14,158,142,.1); }\n'
         u'@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg:#0D1117; --sur:#161C25; --brd:#262E3F; --txt1:#E4E8EF; --txt2:#8A99B4; --txt3:#4F5B73; --teal:#1FBAAA; --teal-d:rgba(31,186,170,.12); } }\n'
         u':root[data-theme="dark"] { --bg:#0D1117; --sur:#161C25; --brd:#262E3F; --txt1:#E4E8EF; --txt2:#8A99B4; --txt3:#4F5B73; --teal:#1FBAAA; --teal-d:rgba(31,186,170,.12); }\n'
         u'* { box-sizing: border-box; } body { margin: 0; background: var(--bg); color: var(--txt1); font: 14px/1.6 system-ui, sans-serif; padding: 40px 16px 80px; }\n'
         u'.doc { max-width: 900px; margin: 0 auto; } a { color: var(--teal); } .back { font-size: 12px; color: var(--txt3); text-decoration: none; }\n'
         u'h1 { font-size: 24px; margin: 20px 0 6px; } p { color: var(--txt2); font-size: 13px; }\n'
         u'.doc-v { background: var(--sur); border: 1px solid var(--brd); border-radius: 8px; padding: 12px 16px; margin: 10px 0; scroll-margin-top: 16px; }\n'
         u'.doc-v b { display: block; font-size: 13.5px; margin-bottom: 6px; overflow-wrap: anywhere; } .doc-v span { font-size: 11px; color: var(--txt3); }\n'
         u'.vs { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }\n'
         u'.vs a { font-size: 11px; font-weight: 700; padding: 2px 9px; border-radius: 20px; text-decoration: none; background: var(--teal-d); }\n'
         u'</style>\n</head>\n<body>\n<div class="doc">\n<a class="back" href="../prds.html">← Hub de PRDs</a>\n'
         u'<h1>Versões arquivadas</h1>\n<p>%d versões de %d documentos. A versão vigente de cada um está no hub; aqui ficam as anteriores, da mais nova para a mais antiga. '
         u'Gerado por <code>tools/hub_versoes.py indice</code>.</p>\n' % (len(arqs), len(por))]
    for doc in sorted(por):
        vs = sorted(por[doc], reverse=True)
        atual = os.path.join(D, doc + '.html')
        nome = _titulo(atual) if os.path.exists(atual) else _titulo(os.path.join(V, vs[0][2]))
        o.append(u'<div class="doc-v" id="%s"><b>%s</b><span>%s · %d versões%s</span><div class="vs">%s</div></div>\n' % (
            h(doc), h(nome), h(doc), len(vs), (u' · <a href="../%s.html">vigente</a>' % h(doc)) if os.path.exists(atual) else u'',
            u''.join(u'<a href="%s">v%s</a>' % (h(f), h(v)) for _, v, f in vs)))
    o.append(u'</div>\n</body>\n</html>\n')
    txt = u''.join(o)
    for pasta in (V, os.path.join(ESPELHO, 'versoes')):
        os.makedirs(pasta, exist_ok=True)
        io.open(os.path.join(pasta, 'index.html'), 'w', encoding='utf-8', newline='\n').write(txt)
    return len(arqs), len(por)


def checar(pastas=None):
    pastas = pastas or [D, V]
    quebrados = []
    for pasta in pastas:
        if not os.path.isdir(pasta):
            continue
        for f in sorted(os.listdir(pasta)):
            if not f.endswith('.html'):
                continue
            t = io.open(os.path.join(pasta, f), encoding='utf-8', errors='ignore').read()
            for m in LINK.finditer(t):
                url = m.group(2)
                if not url or EXTERNO.match(url) or '{' in url or "'" in url or '+' in url:
                    continue
                base = re.split(r'[#?]', url)[0]
                if not base:
                    continue
                if not os.path.exists(os.path.normpath(os.path.join(pasta, base))):
                    quebrados.append((os.path.relpath(os.path.join(pasta, f), REPO), url))
    return quebrados


def arquivar(caminho, versao):
    nome = os.path.basename(caminho)
    destino = os.path.join(V, nome[:-5] + '-v' + versao + '.html')
    if os.path.exists(destino):
        raise SystemExit('já existe: ' + destino)
    os.makedirs(V, exist_ok=True)
    versoes = set(f for f in os.listdir(V) if VER.match(f)) | {os.path.basename(destino)}
    txt = io.open(caminho, encoding='utf-8').read()
    io.open(destino, 'w', encoding='utf-8', newline='\n').write(ajustar_para_versoes(txt, versoes))
    os.makedirs(os.path.join(ESPELHO, 'versoes'), exist_ok=True)
    shutil.copyfile(destino, os.path.join(ESPELHO, 'versoes', os.path.basename(destino)))
    indice()
    return destino


NO_HUB = 30


def _bloco_div(t, i):
    n = 0
    for m in re.finditer(r'<div\b|</div>', t[i:]):
        n += 1 if m.group(0) == '<div' else -1
        if n == 0:
            return i + m.end()
    raise ValueError(i)


def changelog(ver, data, modulo, titulo, corpo):
    """Próximo R-NNN no topo dos dois changelogs; o hub guarda só as NO_HUB mais recentes."""
    hub, todo = os.path.join(D, 'prds.html'), os.path.join(D, 'changelog-hub.html')
    nums = [int(x) for f in (hub, todo) for x in re.findall(r'cl-rel">R-(\d+)', io.open(f, encoding='utf-8').read())]
    rel = 'R-%03d' % (max(nums) + 1)
    ent = (u'<div class="cl-entry">\n        <div class="cl-left">\n          <div class="cl-rel">%s</div>\n          <div class="cl-ver">%s</div>\n'
           u'          <div class="cl-date">%s</div>\n        </div>\n        <div class="cl-body">\n          <strong><span class="cl-mod">%s</span> %s</strong>\n'
           u'          %s\n        </div>\n      </div>') % (rel, h(ver), h(data), h(modulo), h(titulo), corpo)
    for f, limite in ((todo, None), (hub, NO_HUB)):
        t = io.open(f, encoding='utf-8').read()
        ini = t.index('<div id="changelog-entries">')
        fim = _bloco_div(t, ini)
        bloco = t[ini:fim]
        ents = [bloco[m.start():_bloco_div(bloco, m.start())] for m in re.finditer(r'<div class="cl-entry">', bloco)]
        ents = [ent] + ents
        if limite:
            ents = ents[:limite]
        novo = '<div id="changelog-entries">\n      ' + '\n      '.join(ents) + '\n    </div>'
        t = t[:ini] + novo + t[fim:]
        if f == hub:
            total = len(re.findall(r'class="cl-entry"', io.open(todo, encoding='utf-8').read()))
            t = re.sub(r'Histórico completo · \d+ entradas', u'Histórico completo · %d entradas' % total, t)
        else:
            t = re.sub(r'Todas as \d+ entradas', u'Todas as %d entradas' % len(ents), t)
        io.open(f, 'w', encoding='utf-8', newline='\n').write(t)
    return rel


if __name__ == '__main__':
    a = sys.argv[1:]
    if not a or a[0] in ('-h', '--help'):
        print(__doc__)
    elif a[0] == 'indice':
        print('%d versões de %d documentos' % indice())
    elif a[0] == 'checar':
        q = checar()
        for f, u in q:
            print('%s → %s' % (f, u))
        print('%d links quebrados' % len(q))
        sys.exit(1 if q else 0)
    elif a[0] == 'arquivar' and len(a) == 3:
        print('arquivado em', arquivar(a[1], a[2]))
    elif a[0] == 'changelog' and len(a) == 6:
        print('entrada', changelog(*a[1:]))
    else:
        print(__doc__)
        sys.exit(1)
