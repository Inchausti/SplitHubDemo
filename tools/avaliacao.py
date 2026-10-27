# -*- coding: utf-8 -*-
"""Avaliação por pacote e promoção ao app — o merge por feature.

Cada evolução do protótipo é um pacote (AV-xx) numa branch própria, atrás de flags de entrega
(src/js/features.js). O ambiente de avaliação mostra o master com todos os pacotes pendentes; o
avaliador decide item a item no relatório; o pacote aprovado entra no master sozinho.

Uso:
  python tools/avaliacao.py status                      situação de cada pacote e o que falta decidir
  python tools/avaliacao.py relatorio                   gera src/docs/relatorio-avaliacao.html (e a cópia em docs/docs)
  python tools/avaliacao.py montar [--publicar "msg"]   refaz a branch avaliacao = master + pacotes pendentes
  python tools/avaliacao.py promover AV-EV [--enviar]   merge do pacote aprovado no master; sem --enviar, só simula

As decisões ficam em tools/avaliacao-features.json (campo decisao de cada item: pendente, aprovado,
alterar ou rejeitado). A promoção lê o arquivo como está no master: decisão não commitada não vale.
Um pacote vai para o app quando todos os itens da flag principal estão aprovados. As outras flags
do pacote chegam aprovadas, rejeitadas ou ainda em avaliação — desligadas no app — conforme os
itens delas."""
import datetime
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from html import escape as h

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REG = os.path.join('tools', 'avaliacao-features.json')
REL = os.path.join('src', 'docs', 'relatorio-avaliacao.html')
REL_ESPELHO = os.path.join('docs', 'docs', 'relatorio-avaliacao.html')
COAUTOR = 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>'


def git(args, cwd=REPO, ok=False):
    r = subprocess.run(['git'] + args, cwd=cwd, capture_output=True, text=True, encoding='utf-8')
    if r.returncode and not ok:
        raise SystemExit('git %s falhou:\n%s' % (' '.join(args), (r.stderr or r.stdout).strip()))
    return r if ok else r.stdout


def carregar(base=REPO):
    return json.load(io.open(os.path.join(base, REG), encoding='utf-8'))


def gravar(dados, base):
    io.open(os.path.join(base, REG), 'w', encoding='utf-8', newline='\n').write(json.dumps(dados, ensure_ascii=False, indent=2) + '\n')


def pacote(dados, pid):
    for p in dados['pacotes']:
        if p['id'] == pid:
            return p
    raise SystemExit('pacote %s não existe em %s' % (pid, REG))


def no_master(p, base=REPO):
    if p.get('situacao') == 'promovido':
        return True
    return git(['merge-base', '--is-ancestor', p['branch'], 'master'], base, ok=True).returncode == 0


def avaliar(p):
    """Estado de cada flag, itens que seguram o pacote e se ele pode ir para o app."""
    itens, principal = p['itens'], p.get('principal')

    def estado(k):
        ds = [i['decisao'] for i in itens if i['flag'] == k]
        if 'rejeitado' in ds:
            return 'rejeitada'
        if ds and all(d == 'aprovado' for d in ds):
            return 'aprovada'
        return 'avaliacao'

    flags = dict((k, estado(k)) for k in p['flags'])
    base = [i for i in itens if i['flag'] in (None, principal)]
    segura = [i for i in base if i['decisao'] != 'aprovado']
    return flags, segura, not segura


def cadeia(dados, pid, base=REPO, vistos=None):
    """O pacote e as dependências que ainda não estão no master, na ordem de merge."""
    vistos = vistos if vistos is not None else []
    p = pacote(dados, pid)
    for d in p['depende']:
        if not no_master(pacote(dados, d), base):
            cadeia(dados, d, base, vistos)
    if p['id'] not in vistos:
        vistos.append(p['id'])
    return vistos


def reescrever_registro(base, p, flags):
    """Troca o estado das flags no bloco @pacote do arquivo do pacote."""
    if not p.get('registro'):
        return None
    arq = os.path.join(base, p['registro'])
    t = io.open(arq, encoding='utf-8').read()
    m = re.search(r'(window\.shFeature && shFeature\.registrar\()(\{.*?\})(\);)', t)
    if not m:
        raise SystemExit('bloco @pacote não encontrado em %s' % p['registro'])
    reg = json.loads(m.group(2))
    reg['flags'] = dict((k, flags.get(k, v)) for k, v in reg['flags'].items())
    novo = m.group(1) + json.dumps(reg, ensure_ascii=False) + m.group(3)
    io.open(arq, 'w', encoding='utf-8', newline='').write(t[:m.start()] + novo + t[m.end():])
    return p['registro']


def worktree_temp(ref='master'):
    d = tempfile.mkdtemp(prefix='sh-avaliacao-')
    os.rmdir(d)
    git(['worktree', 'add', '--detach', d, ref])
    return d


def remover_worktree(d):
    git(['worktree', 'remove', '--force', d], ok=True)
    if os.path.exists(d):
        shutil.rmtree(d, ignore_errors=True)


# ── status ─────────────────────────────────────────────────────────────────
def cmd_status():
    dados = carregar()
    for p in dados['pacotes']:
        flags, segura, pronto = avaliar(p)
        dec = sum(1 for i in p['itens'] if i['decisao'] != 'pendente')
        sit = 'no app' if no_master(p) else ('pode ir para o app' if pronto else 'em avaliação')
        print('%-6s %-48s %s · %d de %d itens decididos · %s' % (p['id'], p['nome'][:48], p['branch'], dec, len(p['itens']), sit))
        for k, e in flags.items():
            print('         flag %-24s %s' % (k, e))
        if segura and not no_master(p):
            print('         segura: ' + ', '.join('%s (%s)' % (i['id'], i['decisao']) for i in segura))


# ── montar a integração ────────────────────────────────────────────────────
def cmd_montar(publicar=None):
    dados = carregar()
    pend = [p for p in dados['pacotes'] if p.get('situacao') not in ('promovido', 'rejeitado') and not no_master(p)]
    ordem = []
    for p in pend:
        for x in cadeia(dados, p['id']):
            if x not in ordem:
                ordem.append(x)
    d = worktree_temp('master')
    try:
        for pid in ordem:
            p = pacote(dados, pid)
            r = git(['merge', '--no-ff', '-m', 'avaliacao: %s %s' % (pid, p['nome']), p['branch']], d, ok=True)
            if r.returncode:
                conf = git(['diff', '--name-only', '--diff-filter=U'], d, ok=True).stdout.strip()
                git(['merge', '--abort'], d, ok=True)
                raise SystemExit('conflito ao juntar %s (%s):\n%s' % (pid, p['branch'], conf))
            print('juntou', pid, p['branch'])
        sha = git(['rev-parse', 'HEAD'], d).strip()
    finally:
        remover_worktree(d)
    r = git(['branch', '-f', dados['integracao'], sha], ok=True)
    if r.returncode:
        raise SystemExit('não deu para mover a branch %s: %s\nTire-a de qualquer worktree (git switch --detach) e rode de novo.' % (dados['integracao'], r.stderr.strip()))
    print('%s = master + %s → %s' % (dados['integracao'], ' + '.join(ordem) or 'nada', sha[:7]))
    if publicar:
        env = dict(os.environ, SH_BRANCH=dados['integracao'])
        subprocess.run([sys.executable, '-X', 'utf8', os.path.join(REPO, 'tools', 'publicar-avaliacao.py'), publicar], cwd=REPO, env=env, check=True)


# ── promover ───────────────────────────────────────────────────────────────
def cmd_promover(pid, enviar=False):
    if git(['diff', '--quiet', 'HEAD', '--', REG], ok=True).returncode:
        print('aviso: %s tem mudança não commitada; a promoção usa o que está no master' % REG)
    d = worktree_temp('master')
    try:
        if not os.path.exists(os.path.join(d, REG)):
            raise SystemExit('%s ainda não está no master: faça o commit das decisões antes de promover' % REG)
        dados = carregar(d)
        ordem = cadeia(dados, pid, d)
        travados = []
        for x in ordem:
            p = pacote(dados, x)
            flags, segura, pronto = avaliar(p)
            if not pronto:
                travados.append('%s: %s' % (x, ', '.join('%s %s' % (i['id'], i['decisao']) for i in segura)))
        if travados:
            raise SystemExit('não promovido — falta aprovar:\n  ' + '\n  '.join(travados))
        if not ordem or all(no_master(pacote(dados, x), d) for x in ordem):
            raise SystemExit('%s já está no app' % pid)
        hoje = datetime.date.today().strftime('%d/%m/%Y')
        for x in ordem:
            p = pacote(dados, x)
            flags, _, _ = avaliar(p)
            ponta = git(['rev-parse', '--short', p['branch']], d).strip()
            r = git(['merge', '--no-ff', '--no-commit', p['branch']], d, ok=True)
            if r.returncode:
                conf = git(['diff', '--name-only', '--diff-filter=U'], d, ok=True).stdout.strip()
                git(['merge', '--abort'], d, ok=True)
                raise SystemExit('conflito ao promover %s:\n%s' % (x, conf))
            arq = reescrever_registro(d, p, flags)
            p['situacao'] = 'promovido'
            p['promovido'] = {'data': hoje, 'branch': p['branch'], 'ponta': ponta, 'flags': flags}
            gravar(dados, d)
            gerar_relatorio(dados, d)
            git(['add', REG, REL, REL_ESPELHO] + ([arq] if arq else []), d)
            corpo = '\n'.join('%s %s' % (i['id'], i['titulo']) for i in p['itens'] if i['decisao'] == 'aprovado')
            corpo += '\n\nFlags: ' + ', '.join('%s=%s' % kv for kv in flags.items()) if flags else ''
            git(['commit', '-q', '-m', 'feat(%s): %s promovido ao app depois de aprovado' % (x, p['nome']),
                 '-m', 'Merge da branch %s @ %s, aprovada no relatorio de avaliacao.\n\n%s' % (p['branch'], ponta, corpo), '-m', COAUTOR], d)
            if arq and shutil.which('node'):
                subprocess.run(['node', '--check', os.path.join(d, arq)], check=True)
            print('promovido', x, '←', p['branch'], ponta)
        sha = git(['rev-parse', 'HEAD'], d).strip()
        print(git(['log', '--oneline', 'master..HEAD'], d))
        print(git(['diff', '--stat', 'master', 'HEAD'], d))
        if not enviar:
            print('simulação: nada foi enviado. Para enviar ao app: python tools/avaliacao.py promover %s --enviar' % pid)
            return
        for remoto in carregar(d)['app']['remotes']:
            git(['push', remoto, 'HEAD:master'], d)
            print('enviado a', remoto)
    finally:
        remover_worktree(d)
    # o master local acompanha: avanço rápido onde ele estiver aberto
    lista = git(['worktree', 'list', '--porcelain'])
    onde = re.findall(r'worktree (.+)\n(?:.+\n)*?branch refs/heads/master', lista)
    if onde:
        r = git(['merge', '--ff-only', sha], onde[0].strip(), ok=True)
        print('master local' + (' atualizado' if not r.returncode else ' não avançou: ' + r.stderr.strip()))
    else:
        git(['update-ref', 'refs/heads/master', sha])
    print('Agora refaça a avaliação sem o pacote: python tools/avaliacao.py montar --publicar "pacote %s no app"' % pid)


# ── relatório ──────────────────────────────────────────────────────────────
DEC = {'pendente': ('pendente', 'gray'), 'aprovado': ('aprovado', 'ok'), 'alterar': ('alterar', 'warn'), 'rejeitado': ('rejeitado', 'red')}
FLG = {'avaliacao': ('em avaliação', 'warn'), 'aprovada': ('aprovada', 'ok'), 'rejeitada': ('rejeitada', 'red')}
SITP = {'em_avaliacao': ('em avaliação', 'warn'), 'promovido': ('no app', 'ok'), 'rejeitado': ('rejeitado', 'red')}

CSS = u"""
:root { --bg:#F7F8FA; --sur:#FFFFFF; --sur2:#F0F2F6; --brd:#DDE1EA; --txt1:#131720; --txt2:#4A5568; --txt3:#8A92A3;
  --teal:#0E9E8E; --teal-d:rgba(14,158,142,.1); --blue:#1D5FCC; --blue-d:rgba(29,95,204,.08); --red:#D63A49; --red-d:rgba(214,58,73,.08);
  --amber:#B97A10; --amber-d:rgba(185,122,16,.08); --green:#1A7940; --green-d:rgba(26,121,64,.08); --gray:#6B7280; --gray-d:rgba(107,114,128,.08); --mono:#EDF0F5; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg:#0D1117; --sur:#161C25; --sur2:#1E2533; --brd:#262E3F; --txt1:#E4E8EF; --txt2:#8A99B4; --txt3:#4F5B73;
  --teal:#1FBAAA; --teal-d:rgba(31,186,170,.12); --blue:#4D9FFF; --blue-d:rgba(77,159,255,.1); --red:#F04B5C; --red-d:rgba(240,75,92,.1);
  --amber:#F59E0B; --amber-d:rgba(245,158,11,.1); --green:#22C55E; --green-d:rgba(34,197,94,.1); --gray:#9CA3AF; --gray-d:rgba(156,163,175,.1); --mono:#1A2030; } }
:root[data-theme="dark"] { --bg:#0D1117; --sur:#161C25; --sur2:#1E2533; --brd:#262E3F; --txt1:#E4E8EF; --txt2:#8A99B4; --txt3:#4F5B73;
  --teal:#1FBAAA; --teal-d:rgba(31,186,170,.12); --blue:#4D9FFF; --blue-d:rgba(77,159,255,.1); --red:#F04B5C; --red-d:rgba(240,75,92,.1);
  --amber:#F59E0B; --amber-d:rgba(245,158,11,.1); --green:#22C55E; --green-d:rgba(34,197,94,.1); --gray:#9CA3AF; --gray-d:rgba(156,163,175,.1); --mono:#1A2030; }
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { background: var(--bg); color: var(--txt1); font: 14px/1.65 'Inter', system-ui, sans-serif; padding: 40px 16px 80px; }
.doc { max-width: 960px; margin: 0 auto; }
.back { display: inline-flex; font-size: 12px; font-weight: 600; color: var(--txt3); text-decoration: none; margin-bottom: 28px; }
.back:hover { color: var(--amber); }
.eyebrow { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: var(--amber); margin-bottom: 10px; }
h1 { font-size: 27px; font-weight: 800; line-height: 1.2; margin-bottom: 8px; text-wrap: balance; }
.subtitle { font-size: 14px; color: var(--txt2); margin-bottom: 24px; max-width: 700px; }
.meta-bar { display: flex; flex-wrap: wrap; gap: 10px 16px; padding: 14px 18px; background: var(--sur); border: 1px solid var(--brd); border-radius: 8px; margin-bottom: 20px; align-items: center; }
.meta-pill { font-size: 11px; display: flex; gap: 5px; align-items: center; }
.meta-label { color: var(--txt3); font-weight: 500; }
.meta-val { color: var(--txt1); font-weight: 700; }
.chip { display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; white-space: nowrap; }
.chip.ok { background: var(--green-d); color: var(--green); } .chip.warn { background: var(--amber-d); color: var(--amber); }
.chip.red { background: var(--red-d); color: var(--red); } .chip.gray { background: var(--gray-d); color: var(--gray); }
.chip.info { background: var(--blue-d); color: var(--blue); } .chip.teal { background: var(--teal-d); color: var(--teal); }
.toc { background: var(--sur); border: 1px solid var(--brd); border-radius: 8px; padding: 18px 22px; margin-bottom: 40px; }
.toc-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--txt3); margin-bottom: 12px; }
.toc-list { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; list-style: none; }
@media (max-width: 620px) { .toc-list { grid-template-columns: 1fr; } }
.toc-list a { font-size: 12.5px; color: var(--txt2); text-decoration: none; display: flex; gap: 8px; }
.toc-list a:hover { color: var(--amber); }
.toc-num { color: var(--txt3); font-family: 'JetBrains Mono', monospace; font-size: 11px; flex-shrink: 0; }
.section { margin-bottom: 46px; scroll-margin-top: 20px; }
.sec-hdr { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 18px; padding-bottom: 10px; border-bottom: 2px solid var(--brd); }
.sec-num { font-size: 11px; font-weight: 700; color: var(--amber); background: var(--amber-d); border-radius: 4px; padding: 2px 7px; font-family: 'JetBrains Mono', monospace; }
.sec-title { font-size: 17px; font-weight: 700; }
p { font-size: 13px; color: var(--txt2); margin-bottom: 10px; }
p strong { color: var(--txt1); }
h3 { font-size: 14px; font-weight: 700; margin: 22px 0 8px; }
ul.plain, ol.plain { display: flex; flex-direction: column; gap: 6px; margin: 8px 0 10px 18px; }
ul.plain li, ol.plain li { font-size: 13px; color: var(--txt2); }
.callout { border-radius: 8px; padding: 14px 18px; margin: 14px 0; border-left: 3px solid var(--blue); background: var(--blue-d); }
.callout.ok { border-color: var(--green); background: var(--green-d); }
.callout.warn { border-color: var(--amber); background: var(--amber-d); }
.ct { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 5px; color: var(--txt1); }
.callout p:last-child { margin-bottom: 0; }
.table-wrap { overflow-x: auto; margin: 14px 0; border-radius: 8px; border: 1px solid var(--brd); }
table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
thead tr { background: var(--sur2); }
th { padding: 9px 13px; text-align: left; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--txt2); border-bottom: 1px solid var(--brd); white-space: nowrap; }
td { padding: 10px 13px; border-bottom: 1px solid var(--brd); color: var(--txt2); vertical-align: top; }
tbody tr:last-child td { border-bottom: none; }
td strong { color: var(--txt1); }
code { background: var(--mono); border-radius: 3px; padding: 1px 5px; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--blue); overflow-wrap: anywhere; }
td.rid { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 600; color: var(--amber); white-space: nowrap; }
.code-block { background: var(--mono); border: 1px solid var(--brd); border-radius: 8px; padding: 14px 16px; margin: 10px 0; overflow-x: auto; }
.code-block code { background: none; padding: 0; color: var(--txt1); white-space: pre; display: block; line-height: 1.75; font-size: 11.5px; }
.code-block .c { color: var(--txt3); font-style: italic; }
.passos { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 14px 0; }
@media (max-width: 760px) { .passos { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 420px) { .passos { grid-template-columns: minmax(0, 1fr); } }
.passo { background: var(--sur); border: 1px solid var(--brd); border-radius: 8px; padding: 12px 14px; }
.passo b { display: block; font-size: 12.5px; color: var(--txt1); margin-bottom: 4px; }
.passo span { font-size: 12px; color: var(--txt2); }
.passo i { font-style: normal; font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: var(--amber); }
.feat { background: var(--sur); border: 1px solid var(--brd); border-radius: 10px; margin: 16px 0; overflow: hidden; scroll-margin-top: 20px; }
.feat-hdr { padding: 12px 18px; background: var(--sur2); border-bottom: 1px solid var(--brd); display: flex; align-items: center; gap: 8px 10px; flex-wrap: wrap; }
.feat-id { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; color: var(--amber); background: var(--amber-d); padding: 2px 8px; border-radius: 4px; }
.feat-title { font-size: 14px; font-weight: 700; flex: 1; min-width: 200px; }
.feat-body { padding: 14px 18px; }
.kv { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 6px 14px; font-size: 13px; }
@media (max-width: 620px) { .kv { grid-template-columns: minmax(0, 1fr); } .kv dt { margin-top: 6px; } }
.kv dt { color: var(--txt3); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; padding-top: 2px; }
.kv dd { color: var(--txt2); min-width: 0; }
.kv dd ol { margin-left: 18px; display: flex; flex-direction: column; gap: 3px; }
.decide { margin-top: 14px; padding-top: 12px; border-top: 1px dashed var(--brd); display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; }
.decide-t { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--txt3); }
.opt { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--txt1); cursor: pointer; border: 1px solid var(--brd); border-radius: 20px; padding: 4px 12px; }
.opt:has(input:checked) { border-color: var(--teal); background: var(--teal-d); }
.obs { width: 100%; font: inherit; font-size: 12.5px; color: var(--txt1); background: var(--bg); border: 1px solid var(--brd); border-radius: 6px; padding: 7px 10px; resize: vertical; }
.reg { font-size: 11px; color: var(--txt3); margin-left: auto; }
.barra { position: sticky; bottom: 12px; margin-top: 24px; background: var(--sur); border: 1px solid var(--brd); border-radius: 10px; padding: 12px 16px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; box-shadow: 0 8px 24px rgba(0,0,0,.12); }
.barra span { font-size: 12.5px; color: var(--txt2); margin-right: auto; }
.btn { font: inherit; font-size: 12.5px; font-weight: 700; border-radius: 6px; padding: 8px 14px; cursor: pointer; border: 1px solid var(--brd); background: var(--sur2); color: var(--txt1); }
.btn.pri { background: var(--teal); border-color: var(--teal); color: var(--sur); }
textarea.saida { width: 100%; min-height: 160px; font-family: 'JetBrains Mono', monospace; font-size: 11.5px; color: var(--txt1); background: var(--mono); border: 1px solid var(--brd); border-radius: 8px; padding: 12px; margin-top: 10px; }
.foot { margin-top: 40px; font-size: 11.5px; color: var(--txt3); }
"""

JS = u"""
(function () {
  var CHAVE = 'sh-relatorio-avaliacao';
  function ler() { try { return JSON.parse(localStorage.getItem(CHAVE) || '{}'); } catch (e) { return {}; } }
  function gravar(o) { try { localStorage.setItem(CHAVE, JSON.stringify(o)); } catch (e) {} }
  var st = ler();
  document.querySelectorAll('.decide').forEach(function (d) {
    var id = d.getAttribute('data-item'), v = st[id] || {};
    d.querySelectorAll('input[type=radio]').forEach(function (r) {
      if (r.value === v.d) r.checked = true;
      r.addEventListener('change', function () { st[id] = st[id] || {}; st[id].d = r.value; gravar(st); contar(); });
    });
    var t = d.querySelector('textarea');
    if (t) { t.value = v.o || ''; t.addEventListener('input', function () { st[id] = st[id] || {}; st[id].o = t.value; gravar(st); }); }
  });
  function contar() {
    var n = Object.keys(st).filter(function (k) { return st[k].d; }).length, tot = document.querySelectorAll('.decide').length;
    var e = document.getElementById('cont'); if (e) e.textContent = n + ' de ' + tot + ' itens com decisão neste navegador';
  }
  contar();
  window.copiarDecisoes = function () {
    var linhas = [];
    document.querySelectorAll('.decide').forEach(function (d) {
      var id = d.getAttribute('data-item'), v = st[id]; if (!v || !v.d) return;
      linhas.push(id + ': ' + v.d + (v.o ? ' — ' + v.o.replace(/\\s+/g, ' ').trim() : ''));
    });
    var txt = linhas.length ? 'Decisões do relatório de avaliação\\n' + linhas.join('\\n') : 'Nenhuma decisão marcada.';
    var s = document.getElementById('saida'); s.value = txt; s.hidden = false; s.select();
    var aviso = document.getElementById('copiado');
    try {
      navigator.clipboard.writeText(txt).then(function () { aviso.textContent = 'Copiado. Cole na conversa.'; },
        function () { aviso.textContent = 'Selecione o texto abaixo e copie.'; });
    } catch (e) { aviso.textContent = 'Selecione o texto abaixo e copie.'; }
  };
  window.limparDecisoes = function () { st = {}; gravar(st); location.reload(); };
})();
"""


def chip(c, t):
    return u'<span class="chip %s">%s</span>' % (c, h(t))


def gerar_relatorio(dados, base=REPO):
    P = dados['pacotes']
    n_it = sum(len(p['itens']) for p in P)
    n_ap = sum(1 for p in P for i in p['itens'] if i['decisao'] == 'aprovado')
    n_pe = sum(1 for p in P for i in p['itens'] if i['decisao'] == 'pendente')
    toc = [(u's01', u'O que está na avaliação e não está no app'), (u's02', u'Como funciona o merge por feature')]
    toc += [(u's%02d' % (k + 3), u'%s · %s' % (p['id'], p['nome'])) for k, p in enumerate(P)]
    toc += [(u's%02d' % (len(P) + 3), u'Suas decisões')]
    o = []
    o.append(u'<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
             u'<title>Relatório de Avaliação · SplitHub</title>\n'
             u'<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap">\n'
             u'<style>' + CSS + u'</style>\n</head>\n<body>\n<div class="doc">\n')
    o.append(u'<a class="back" href="prds.html">← Hub de PRDs</a>\n<div class="eyebrow">Avaliação · Repositório de avaliação → app do SplitHub</div>\n'
             u'<h1>Relatório de funcionalidades em avaliação</h1>\n'
             u'<p class="subtitle">Tudo o que está no ambiente de avaliação e ainda não está no app do SplitHub, ponto a ponto: o que foi construído, onde ver, como testar e o campo da sua decisão. '
             u'Cada pacote entra no app sozinho, depois de aprovado, atrás de feature flag.</p>\n')
    o.append(u'<div class="meta-bar">'
             + u''.join(u'<span class="meta-pill"><span class="meta-label">%s</span><span class="meta-val">%s</span></span>' % (h(a), b) for a, b in [
                 (u'Versão', h(dados['versao'])), (u'Atualizado', h(dados['atualizado'])), (u'Pacotes', str(len(P))), (u'Itens', str(n_it)),
                 (u'Aprovados', str(n_ap)), (u'Pendentes', str(n_pe))])
             + u'<span class="meta-pill" style="margin-left:auto"><a class="chip info" href="%s" target="_blank" rel="noopener">Abrir o ambiente de avaliação ↗</a></span></div>\n' % h(dados['ambiente']))
    o.append(u'<div class="toc"><div class="toc-title">Conteúdo</div><ul class="toc-list">'
             + u''.join(u'<li><a href="#%s"><span class="toc-num">%s</span>%s</a></li>' % (a, a[1:], h(b)) for a, b in toc) + u'</ul></div>\n')

    # 01 comparação
    c = dados['comparacao']
    o.append(u'<div class="section" id="s01"><div class="sec-hdr"><span class="sec-num">01</span><span class="sec-title">O que está na avaliação e não está no app</span></div>'
             u'<p>%s</p>' % h(c['texto']))
    o.append(u'<div class="table-wrap"><table><thead><tr><th>Pacote</th><th>Branch</th><th>Flags</th><th>Depende de</th><th>Itens</th><th>Situação</th></tr></thead><tbody>')
    for p in P:
        flags, segura, pronto = avaliar(p)
        dec = sum(1 for i in p['itens'] if i['decisao'] != 'pendente')
        s = SITP.get(p.get('situacao'), SITP['em_avaliacao'])
        if p.get('situacao') != 'promovido' and pronto:
            s = (u'pronto para o app', 'teal')
        o.append(u'<tr><td><strong>%s</strong> · %s</td><td><code>%s</code></td><td>%s</td><td>%s</td><td>%d de %d decididos</td><td>%s</td></tr>' % (
            h(p['id']), h(p['nome']), h(p['branch']), u' '.join(u'<code>%s</code>' % h(k) for k in p['flags']) or u'—',
            h(u', '.join(p['depende']) or u'—'), dec, len(p['itens']), chip(s[1], s[0])))
    o.append(u'</tbody></table></div></div>\n')

    # 02 modelo
    o.append(u'<div class="section" id="s02"><div class="sec-hdr"><span class="sec-num">02</span><span class="sec-title">Como funciona o merge por feature</span></div>'
             u'<p>Cada evolução é um <strong>pacote</strong> numa branch própria, criada a partir do master, e se registra com o estado das próprias flags. O ambiente de avaliação mostra o master com todos os pacotes pendentes. '
             u'Você decide item a item; o pacote aprovado entra no master sozinho, sem levar os outros.</p>'
             u'<div class="passos">'
             u'<div class="passo"><i>1 · branch</i><b>Pacote</b><span>Construído em <code>feat/…</code>, atrás de flag, sem tocar nos outros pacotes.</span></div>'
             u'<div class="passo"><i>2 · avaliação</i><b>Ambiente de avaliação</b><span>master + pacotes pendentes. Flag em avaliação liga só aqui.</span></div>'
             u'<div class="passo"><i>3 · decisão</i><b>Este relatório</b><span>Aprovar, alterar ou rejeitar cada item. Alterar volta para a branch.</span></div>'
             u'<div class="passo"><i>4 · app</i><b>Promoção</b><span>Merge só do pacote aprovado, com as flags reescritas, nos dois remotes.</span></div></div>'
             u'<h3>Duas camadas de flag</h3><ul class="plain">'
             u'<li><strong>Entrega</strong> (<code>features.js</code>): decide se o recurso existe no ambiente. <code>avaliacao</code> liga só na avaliação e no servidor local; <code>aprovada</code> liga em todo ambiente; <code>rejeitada</code> desliga.</li>'
             u'<li><strong>Organização</strong> (backoffice): dentro do que a entrega liberou, decide quem usa, por plano e exceção.</li></ul>'
             u'<h3>Quando um pacote vai para o app</h3><ul class="plain">'
             u'<li>Todos os itens da <strong>flag principal</strong> aprovados. Um item em <em>alterar</em> segura o pacote até a nova versão ser aprovada.</li>'
             u'<li>As outras flags do pacote entram conforme os itens delas: aprovados ligam; rejeitado desliga; pendente entra desligado no app e continua em avaliação.</li>'
             u'<li>As dependências precisam estar no app ou aprovadas: a promoção leva as duas, na ordem.</li></ul>'
             u'<div class="code-block"><code><span class="c"># situação de cada pacote</span>\npython tools/avaliacao.py status\n'
             u'<span class="c"># simula a promoção e mostra o que entraria no app</span>\npython tools/avaliacao.py promover AV-EV\n'
             u'<span class="c"># faz o merge no master e envia a origin e splithub</span>\npython tools/avaliacao.py promover AV-EV --enviar\n'
             u'<span class="c"># refaz e publica a avaliação com o que ainda está pendente</span>\npython tools/avaliacao.py montar --publicar "pacote AV-EV no app"</code></div></div>\n')

    # pacotes
    for k, p in enumerate(P):
        sid = u's%02d' % (k + 3)
        flags, segura, pronto = avaliar(p)
        s = SITP.get(p.get('situacao'), SITP['em_avaliacao'])
        o.append(u'<div class="section" id="%s"><div class="sec-hdr"><span class="sec-num">%s</span><span class="sec-title">%s · %s</span>%s</div>' % (sid, sid[1:], h(p['id']), h(p['nome']), chip(s[1], s[0])))
        o.append(u'<p>%s</p>' % h(p['resumo']))
        if p.get('proposta'):
            o.append(u'<p>Proposta: <a href="%s">%s</a></p>' % (h(p['proposta']), h(p['proposta'])))
        o.append(u'<div class="table-wrap"><table><thead><tr><th>Branch</th><th>Depende de</th><th>Promoção</th></tr></thead><tbody><tr><td><code>%s</code></td><td>%s</td><td>%s</td></tr></tbody></table></div>' % (
            h(p['branch']), h(u', '.join(p['depende']) or u'—'),
            (u'no app desde %s · %s' % (h(p['promovido']['data']), h(p['promovido']['ponta']))) if p.get('promovido') else u'<code>python tools/avaliacao.py promover %s --enviar</code>' % h(p['id'])))
        if p['flags']:
            o.append(u'<div class="table-wrap"><table><thead><tr><th>Flag</th><th>O que liga</th><th>Itens</th><th>Estado pelas decisões</th></tr></thead><tbody>')
            for fk, rot in p['flags'].items():
                its = [i['id'] for i in p['itens'] if i['flag'] == fk]
                e = FLG[flags[fk]]
                o.append(u'<tr><td><code>%s</code>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>' % (
                    h(fk), u' ' + chip('info', u'principal') if fk == p.get('principal') else u'', h(rot), h(u', '.join(its)), chip(e[1], e[0])))
            o.append(u'</tbody></table></div>')
        if segura and p.get('situacao') != 'promovido':
            o.append(u'<div class="callout warn"><div class="ct">Segura o pacote</div><p>%s</p></div>' % h(u', '.join(u'%s (%s)' % (i['id'], i['decisao']) for i in segura)))
        for i in p['itens']:
            d = DEC.get(i['decisao'], DEC['pendente'])
            o.append(u'<div class="feat" id="%s"><div class="feat-hdr"><span class="feat-id">%s</span><span class="feat-title">%s</span>%s%s</div><div class="feat-body"><dl class="kv">' % (
                h(i['id'].lower()), h(i['id']), h(i['titulo']), (chip('info', i['flag']) if i['flag'] else u''), chip(d[1], u'registrado: ' + d[0])))
            o.append(u'<dt>Construído</dt><dd>%s</dd>' % h(i['construido']))
            o.append(u'<dt>Onde ver</dt><dd>%s</dd>' % h(i['onde']))
            if i.get('testar'):
                o.append(u'<dt>Como testar</dt><dd><ol>%s</ol></dd>' % u''.join(u'<li>%s</li>' % h(t) for t in i['testar']))
            if i.get('atende'):
                o.append(u'<dt>Atende</dt><dd>%s</dd>' % h(i['atende']))
            if i.get('limites'):
                o.append(u'<dt>Limites</dt><dd>%s</dd>' % h(i['limites']))
            if i.get('obs'):
                o.append(u'<dt>Observação registrada</dt><dd>%s</dd>' % h(i['obs']))
            o.append(u'</dl>')
            if p.get('situacao') != 'promovido':
                nm = u'd-' + i['id']
                o.append(u'<div class="decide" data-item="%s"><span class="decide-t">Sua decisão</span>%s<span class="reg">fica neste navegador até você copiar</span>'
                         u'<textarea class="obs" rows="2" placeholder="Observação: o que alterar, ou por que rejeitar" aria-label="Observação sobre %s"></textarea></div>' % (
                             h(i['id']), u''.join(u'<label class="opt"><input type="radio" name="%s" value="%s"> %s</label>' % (h(nm), v, r) for v, r in [
                                 (u'aprovar', u'Aprovar'), (u'alterar', u'Alterar'), (u'rejeitar', u'Rejeitar')]), h(i['id'])))
            o.append(u'</div></div>')
        o.append(u'</div>\n')

    sid = u's%02d' % (len(P) + 3)
    o.append(u'<div class="section" id="%s"><div class="sec-hdr"><span class="sec-num">%s</span><span class="sec-title">Suas decisões</span></div>'
             u'<p>Marque cada item acima e copie as decisões para a conversa. Elas entram no registro (<code>tools/avaliacao-features.json</code>) e no relatório; o pacote aprovado segue para o app pela promoção.</p>'
             u'<textarea id="saida" class="saida" hidden aria-label="Decisões copiadas"></textarea></div>\n' % (sid, sid[1:]))
    o.append(u'<div class="barra"><span id="cont"></span><span id="copiado"></span><button class="btn" onclick="limparDecisoes()">Limpar</button><button class="btn pri" onclick="copiarDecisoes()">Copiar decisões</button></div>\n')
    o.append(u'<div class="foot">Gerado por <code>tools/avaliacao.py relatorio</code> a partir de <code>tools/avaliacao-features.json</code>. Não edite este arquivo à mão.</div>\n')
    o.append(u'</div>\n<script>' + JS + u'</script>\n</body>\n</html>\n')
    txt = u''.join(o)
    for rel in (REL, REL_ESPELHO):
        arq = os.path.join(base, rel)
        if os.path.isdir(os.path.dirname(arq)):
            io.open(arq, 'w', encoding='utf-8', newline='\n').write(txt)
    return os.path.join(base, REL)


def main(a):
    if not a or a[0] in ('-h', '--help'):
        print(__doc__)
        return
    c = a[0]
    if c == 'status':
        cmd_status()
    elif c == 'relatorio':
        print('gerado', gerar_relatorio(carregar()))
    elif c == 'montar':
        cmd_montar(a[a.index('--publicar') + 1] if '--publicar' in a else None)
    elif c == 'promover' and len(a) > 1:
        cmd_promover(a[1], '--enviar' in a)
    else:
        print(__doc__)
        sys.exit(1)


if __name__ == '__main__':
    main(sys.argv[1:])
