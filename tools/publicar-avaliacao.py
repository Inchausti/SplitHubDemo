# -*- coding: utf-8 -*-
"""Publica o protótipo no ambiente de avaliação (E-01).

Uso:  python tools/avaliacao.py montar --publicar "mensagem do lote"     (o caminho normal)
      SH_BRANCH=<branch> python tools/publicar-avaliacao.py "mensagem"     (uma branch avulsa)

Sem SH_BRANCH, publica a branch avaliacao: o master com os pacotes pendentes, montada por
tools/avaliacao.py. Monta o site a partir de src/ na ponta da branch, sem passar pela árvore de
trabalho, marca o ambiente (SH_AMBIENTE, que liga as flags em avaliação), põe a faixa com o painel
de features e o relatório no index.html e envia para a main de
https://github.com/split-hubhq/split-hubhq-app-avaliacao (Pages na raiz da main).
Até 23/10/2026 o ambiente ficava em Inchausti/split-hubhq-app-avaliacao; o histórico foi levado inteiro."""
import io
import os
import shutil
import subprocess
import sys
import tempfile

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# a branch publicada vem da variável SH_BRANCH; sem ela, a integração montada por tools/avaliacao.py
BRANCH = os.environ.get('SH_BRANCH', 'avaliacao')
RELATORIO = 'https://split-hubhq.github.io/app/docs/relatorio-avaliacao.html'
DEST_URL = 'https://github.com/split-hubhq/split-hubhq-app-avaliacao.git'
SITE_URL = 'https://split-hubhq.github.io/split-hubhq-app-avaliacao/'
TRAB = os.path.join(tempfile.gettempdir(), 'splithub-avaliacao')
SITE = os.path.join(TRAB, 'site')
MSG = sys.argv[1] if len(sys.argv) > 1 else 'publica o protótipo da branch'


def run(cmd, cwd):
    print('$', ' '.join(cmd))
    return subprocess.run(cmd, cwd=cwd, check=True, capture_output=True, text=True, encoding='utf-8').stdout


def _rw(f, p, _):
    os.chmod(p, 0o700)
    f(p)


# 1. clone limpo do destino (ou pasta nova se o repositório estiver vazio)
if os.path.exists(SITE):
    shutil.rmtree(SITE, onerror=_rw)
os.makedirs(SITE)
run(['git', 'init', '-q', '-b', 'main'], SITE)
run(['git', 'remote', 'add', 'origin', DEST_URL], SITE)
try:
    run(['git', 'fetch', '-q', 'origin', 'main'], SITE)
    run(['git', 'checkout', '-q', '-B', 'main', 'origin/main'], SITE)
except subprocess.CalledProcessError:
    print('destino vazio: primeira publicação')

# 2. conteúdo de src/ na ponta da branch
for nome in os.listdir(SITE):
    if nome != '.git':
        p = os.path.join(SITE, nome)
        shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)
arq = os.path.join(TRAB, 'avaliacao-src.tar')
run(['git', 'archive', '--format=tar', '-o', arq, BRANCH, 'src'], REPO)
run(['tar', '-xf', arq.replace('\\', '/'), '--strip-components=1', '-C', SITE.replace('\\', '/')], TRAB)
os.remove(arq)
for lixo in ('index-backup.html',):
    p = os.path.join(SITE, lixo)
    if os.path.exists(p):
        os.remove(p)
sha = run(['git', 'rev-parse', '--short', BRANCH], REPO).strip()

# 3. faixa de ambiente de avaliação, só nesta cópia
idx = os.path.join(SITE, 'index.html')
t = io.open(idx, encoding='utf-8').read()
FAIXA = (u'<div id="sh-avaliacao-faixa" role="note" style="position:fixed;left:0;right:0;bottom:0;z-index:99999;'
         u'background:var(--amber);color:var(--bg);font:600 12px/1.4 system-ui,sans-serif;padding:5px 12px;text-align:center">'
         u'Ambiente de avaliação · branch <code>%s</code> · versão %s · '
         u'<button type="button" onclick="window.shFeature&&shFeature.painel()" style="font:inherit;color:inherit;background:none;border:0;padding:0;text-decoration:underline;cursor:pointer">features</button> · '
         u'<a href="%s" style="color:inherit;text-decoration:underline">relatório de avaliação</a>'
         u'</div>' % (BRANCH, sha, RELATORIO))
i = t.index(u'<body')
j = t.index(u'>', i) + 1
t = t[:j] + u'\n' + FAIXA + t[j:]
# o ambiente se declara antes do features.js: flag em avaliação liga aqui
i = t.index(u'<head')
j = t.index(u'>', i) + 1
t = t[:j] + u"\n<script>window.SH_AMBIENTE='avaliacao';</script>" + t[j:]
io.open(idx, 'w', encoding='utf-8', newline='\n').write(t)
io.open(os.path.join(SITE, '.nojekyll'), 'w').write('')
io.open(os.path.join(SITE, 'README.md'), 'w', encoding='utf-8').write(
    u'# SplitHub — ambiente de avaliação\n\nProtótipo da branch `%s` do repositório split-hubhq/app, publicado só para avaliação do time, '
    u'em %s. Não é o protótipo oficial. Cada pacote aprovado entra no master sozinho, atrás de feature flag, e este ambiente é refeito com o que ainda está pendente. '
    u'Relatório de avaliação: ' + RELATORIO + u'\n\n'
    u'Publicado por `tools/publicar-avaliacao.py`, no repositório do hub. Versão publicada: `%s`.\n' % (BRANCH, SITE_URL, sha))

# 4. commit e envio
run(['git', 'add', '-A'], SITE)
st = run(['git', 'status', '--porcelain'], SITE)
if not st.strip():
    print('nada mudou')
    sys.exit(0)
run(['git', 'commit', '-q', '-m', '%s (%s @ %s)' % (MSG, BRANCH, sha), '-m', 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>'], SITE)
run(['git', 'push', '-q', 'origin', 'main'], SITE)
print('publicado', sha, '→', SITE_URL)
