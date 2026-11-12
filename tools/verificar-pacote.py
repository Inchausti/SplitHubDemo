# -*- coding: utf-8 -*-
"""Confere um pacote de avaliação (AV-xx) num navegador headless, na branch dele.

Uso:
  python tools/verificar-pacote.py AV-GS                 o src/ da branch do pacote (git archive, pasta temporária)
  python tools/verificar-pacote.py AV-GS --aqui          o src/ deste checkout, como está
  opções: --rota "#/inconsistencias/kanban"   outra rota no lugar da entrada do pacote
          --navegador chrome | msedge | <caminho do executável>

O que faz:
  1. serve o src/ num servidor local (127.0.0.1, porta livre): as flags em avaliação ligam ali;
  2. entra sem login: sessionStorage.sh_auth = '1' e #lp-screen escondida. Nunca digita senha;
  3. abre a rota de entrada do pacote (campo "entrada" do bloco shFeature.registrar no arquivo de
     registro do pacote, ou "entrada" em tools/avaliacao-features.json);
  4. junta os erros do console, as exceções da página e os recursos que não carregaram;
  5. mede o estouro horizontal em 375, 768 e 1440 px pelo critério da skill de responsividade:
     document.body.scrollWidth === innerWidth. Os elementos com estouro interno aparecem como
     aviso, menos .twrap e o quadro do kanban, que rolam por definição.
Sai com 1 se houver erro no console ou página rolando na horizontal.

Sem dependência: usa o Chrome ou o Edge da máquina em modo headless, pelo DevTools Protocol, só
com a biblioteca padrão do Python (decisão de 12/11/2026: nada de Playwright)."""
import base64
import functools
import http.server
import io
import json
import mimetypes
import os
import re
import shutil
import socket
import struct
import subprocess
import sys
import tarfile
import tempfile
import threading
import time
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import avaliacao as av  # noqa: E402

LARGURAS = (375, 768, 1440)
ALTURA = 900
IGNORAR = '.twrap, #inc-kanban-board, .kanban-board'
ENTRAR = "try { sessionStorage.setItem('sh_auth', '1'); } catch (e) {}"
ESCONDER_LOGIN = """(() => {
  const lp = document.getElementById('lp-screen');
  const visivel = !!lp && lp.style.display !== 'none';
  if (lp) lp.style.display = 'none';
  if (visivel && window.shAplicarRota) window.shAplicarRota();
  return visivel;
})()"""
# o script da skill responsividade, com o critério de aprovação e o que rola por definição de fora
MEDIR = """((ignorar) => {
  const probs = [];
  document.querySelectorAll('*').forEach(x => {
    if (x.namespaceURI && x.namespaceURI.includes('svg')) return;
    if (x.closest(ignorar)) return;
    if (x.clientWidth > 4 && x.scrollWidth > x.clientWidth + 4 && getComputedStyle(x).overflowX === 'visible') {
      const nome = (typeof x.className === 'string' && x.className.trim()) ? '.' + x.className.trim().split(/\\s+/).join('.') : x.tagName.toLowerCase();
      probs.push((x.id ? '#' + x.id + ' ' : '') + nome + ' ' + x.clientWidth + '/' + x.scrollWidth);
    }
  });
  const vistas = [...document.querySelectorAll('.view.active')].map(v => v.id);
  return { scrollWidth: document.body.scrollWidth, innerWidth: innerWidth, hash: location.hash, vistas: vistas, probs: probs };
})(%s)"""
NAVEGADORES = {
    'chrome': [r'%ProgramFiles%\Google\Chrome\Application\chrome.exe', r'%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe',
               r'%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe', 'google-chrome', 'google-chrome-stable', 'chromium',
               '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
    'msedge': [r'%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe', r'%ProgramFiles%\Microsoft\Edge\Application\msedge.exe',
               'microsoft-edge', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
}


# ── WebSocket mínimo (RFC 6455), o bastante para o DevTools Protocol ────────
class WebSocket(object):
    def __init__(self, url, prazo=30):
        m = re.match(r'ws://([^/:]+):(\d+)(/.*)$', url)
        if not m:
            raise ValueError(url)
        self.s = socket.create_connection((m.group(1), int(m.group(2))), timeout=prazo)
        chave = base64.b64encode(os.urandom(16)).decode()
        # sem cabeçalho Origin: o Chrome só exige --remote-allow-origins quando ele vem
        self.s.sendall(('GET %s HTTP/1.1\r\nHost: %s:%s\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
                        'Sec-WebSocket-Key: %s\r\nSec-WebSocket-Version: 13\r\n\r\n' % (m.group(3), m.group(1), m.group(2), chave)).encode())
        self.buf = b''
        while b'\r\n\r\n' not in self.buf:
            parte = self.s.recv(4096)
            if not parte:
                raise ConnectionError('o navegador fechou a conexão do DevTools')
            self.buf += parte
        cab, self.buf = self.buf.split(b'\r\n\r\n', 1)
        if b' 101 ' not in cab.split(b'\r\n', 1)[0]:
            raise ConnectionError('o DevTools recusou o WebSocket: %s' % cab.split(b'\r\n', 1)[0].decode(errors='replace'))

    def _ler(self, n):
        while len(self.buf) < n:
            parte = self.s.recv(65536)
            if not parte:
                raise ConnectionError('o navegador fechou a conexão do DevTools')
            self.buf += parte
        out, self.buf = self.buf[:n], self.buf[n:]
        return out

    def enviar(self, texto, op=0x1):
        dados = texto.encode('utf-8') if isinstance(texto, str) else texto
        n = len(dados)
        cab = bytes([0x80 | op])
        if n < 126:
            cab += bytes([0x80 | n])
        elif n < 65536:
            cab += bytes([0x80 | 126]) + struct.pack('>H', n)
        else:
            cab += bytes([0x80 | 127]) + struct.pack('>Q', n)
        mascara = os.urandom(4)
        self.s.sendall(cab + mascara + bytes(b ^ mascara[i % 4] for i, b in enumerate(dados)))

    def receber(self, prazo):
        """Uma mensagem de texto inteira, ou None se o prazo vencer antes de ela começar."""
        self.s.settimeout(max(prazo, 0.01))
        partes = []
        while True:
            try:
                b0, b1 = self._ler(2)
            except socket.timeout:
                if partes:
                    raise
                return None
            self.s.settimeout(30)
            op, n = b0 & 0x0F, b1 & 0x7F
            if n == 126:
                n = struct.unpack('>H', self._ler(2))[0]
            elif n == 127:
                n = struct.unpack('>Q', self._ler(8))[0]
            mascara = self._ler(4) if b1 & 0x80 else None
            dados = self._ler(n)
            if mascara:
                dados = bytes(b ^ mascara[i % 4] for i, b in enumerate(dados))
            if op == 0x9:
                self.enviar(dados, 0xA)
                continue
            if op == 0x8:
                raise ConnectionError('o navegador fechou a conexão do DevTools')
            if op in (0x0, 0x1, 0x2):
                partes.append(dados)
                if b0 & 0x80:
                    return b''.join(partes).decode('utf-8', errors='replace')

    def fechar(self):
        try:
            self.s.close()
        except OSError:
            pass


class CDP(object):
    """Comandos e eventos do DevTools Protocol numa aba."""

    def __init__(self, url):
        self.ws, self.n, self.eventos = WebSocket(url), 0, []

    def _guardar(self, msg):
        if 'method' in msg:
            self.eventos.append(msg)

    def cmd(self, metodo, params=None, prazo=30):
        self.n += 1
        meu = self.n
        self.ws.enviar(json.dumps({'id': meu, 'method': metodo, 'params': params or {}}))
        fim = time.time() + prazo
        while time.time() < fim:
            txt = self.ws.receber(fim - time.time())
            if txt is None:
                break
            msg = json.loads(txt)
            if msg.get('id') == meu:
                if 'error' in msg:
                    raise RuntimeError('%s: %s' % (metodo, msg['error'].get('message')))
                return msg.get('result', {})
            self._guardar(msg)
        raise TimeoutError('%s sem resposta em %ds' % (metodo, prazo))

    def esperar(self, segundos, evento=None):
        """Junta eventos por alguns segundos, ou até chegar o evento pedido."""
        fim = time.time() + segundos
        while time.time() < fim:
            txt = self.ws.receber(fim - time.time())
            if txt is None:
                break
            msg = json.loads(txt)
            self._guardar(msg)
            if evento and msg.get('method') == evento:
                return True
        return False

    def avaliar(self, expr):
        r = self.cmd('Runtime.evaluate', {'expression': expr, 'returnByValue': True, 'awaitPromise': True})
        if r.get('exceptionDetails'):
            raise RuntimeError('o script de medida falhou: %s' % r['exceptionDetails'].get('text'))
        return r['result'].get('value')


# ── navegador, servidor e a rota do pacote ─────────────────────────────────
def achar_navegador(pedido):
    if pedido and os.path.isfile(pedido):
        return pedido
    nomes = [pedido] if pedido else ['chrome', 'msedge']
    for nome in nomes:
        for c in NAVEGADORES.get(nome, [nome]):
            c = os.path.expandvars(c)
            if os.path.isfile(c):
                return c
            if os.sep not in c and '/' not in c and shutil.which(c):
                return shutil.which(c)
    raise SystemExit('nenhum Chrome ou Edge encontrado (%s). Passe --navegador <caminho do executável>.' % ', '.join(nomes))


def abrir_navegador(exe):
    """Chrome/Edge headless num perfil temporário; devolve o processo, o perfil e os WebSockets da aba e do navegador."""
    perfil = tempfile.mkdtemp(prefix='sh-verificar-')
    proc = subprocess.Popen([exe, '--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + perfil,
                             '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-sync',
                             '--hide-scrollbars', '--mute-audio', '--disable-background-networking', 'about:blank'],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    porta_arq, fim = os.path.join(perfil, 'DevToolsActivePort'), time.time() + 30
    while time.time() < fim:
        if proc.poll() is not None:
            raise SystemExit('o navegador saiu logo ao abrir (código %s): %s' % (proc.returncode, exe))
        linhas = io.open(porta_arq, encoding='utf-8').read().split() if os.path.exists(porta_arq) else []
        if len(linhas) >= 2:
            porta = int(linhas[0])
            try:
                abas = [x for x in json.load(urllib.request.urlopen('http://127.0.0.1:%d/json/list' % porta, timeout=5)) if x.get('type') == 'page']
                if abas:
                    return proc, perfil, abas[0]['webSocketDebuggerUrl'], 'ws://127.0.0.1:%d%s' % (porta, linhas[1])
            except OSError:
                pass
        time.sleep(0.1)
    fechar_navegador(proc, perfil)
    raise SystemExit('o DevTools do navegador não respondeu em 30 s: %s' % exe)


def fechar_navegador(proc, perfil, ws_navegador=None):
    if ws_navegador and proc.poll() is None:
        try:  # Browser.close fecha o navegador inteiro, com os processos filhos que seguram o perfil
            ws = WebSocket(ws_navegador, prazo=5)
            ws.enviar(json.dumps({'id': 1, 'method': 'Browser.close'}))
            proc.wait(10)
            ws.fechar()
        except (OSError, ConnectionError, subprocess.TimeoutExpired):
            pass
    if proc.poll() is None:
        proc.kill()
        proc.wait(10)
    for _ in range(20):  # o Windows solta os arquivos do perfil um pouco depois
        shutil.rmtree(perfil, ignore_errors=True)
        if not os.path.exists(perfil):
            break
        time.sleep(0.25)


def exportar(ref):
    """O src/ da branch, em memória: git archive, sem worktree, sem gravar em disco e sem tocar na branch."""
    r = subprocess.run(['git', 'archive', '--format=tar', ref, 'src'], cwd=av.REPO, capture_output=True)
    if r.returncode:
        raise SystemExit('git archive %s falhou: %s' % (ref, r.stderr.decode(errors='replace').strip()))
    arqs = {}
    with tarfile.open(fileobj=io.BytesIO(r.stdout)) as t:
        for m in t:
            if m.isfile():
                arqs[m.name[len('src/'):]] = t.extractfile(m).read()
    return arqs


def entrada(ler, p):
    """A rota de entrada: do bloco @pacote no arquivo de registro, senão do registro JSON.

    ler(caminho relativo ao repositório) devolve o texto do arquivo, ou None."""
    t = ler(p['registro']) if p.get('registro') else None
    m = re.search(r'shFeature\.registrar\((\{.*?\})\);', t or '')
    if m:
        try:
            e = json.loads(m.group(1)).get('entrada')
            if e:
                return e
        except ValueError:
            pass
    return p.get('entrada')


TIPOS = {'.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
         '.svg': 'image/svg+xml', '.html': 'text/html; charset=utf-8'}


class DoDisco(http.server.SimpleHTTPRequestHandler):
    # o registro do Windows às vezes manda .js como text/plain
    extensions_map = dict(http.server.SimpleHTTPRequestHandler.extensions_map, **TIPOS)

    def log_message(self, *a):
        pass


class DaMemoria(http.server.BaseHTTPRequestHandler):
    arquivos = {}

    def do_GET(self):
        caminho = urllib.parse.unquote(self.path.split('?', 1)[0].split('#', 1)[0]).lstrip('/')
        if not caminho or caminho.endswith('/'):
            caminho += 'index.html'
        dados = self.arquivos.get(caminho)
        if dados is None:
            self.send_error(404, 'File not found')
            return
        ext = os.path.splitext(caminho)[1].lower()
        self.send_response(200)
        self.send_header('Content-Type', TIPOS.get(ext) or mimetypes.guess_type(caminho)[0] or 'application/octet-stream')
        self.send_header('Content-Length', str(len(dados)))
        self.end_headers()
        self.wfile.write(dados)

    def log_message(self, *a):
        pass


class Servidor(http.server.ThreadingHTTPServer):
    daemon_threads = True

    def handle_error(self, request, client_address):
        if isinstance(sys.exc_info()[1], ConnectionError):  # o navegador fechou a conexão ao sair
            return
        http.server.ThreadingHTTPServer.handle_error(self, request, client_address)


def servir(origem):
    """origem: a pasta src/ no disco, ou o dicionário {caminho: bytes} do git archive."""
    if isinstance(origem, dict):
        handler = type('Handler', (DaMemoria,), {'arquivos': origem})
    else:
        handler = functools.partial(DoDisco, directory=origem)
    srv = Servidor(('127.0.0.1', 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, 'http://127.0.0.1:%d' % srv.server_address[1]


# ── a medida ───────────────────────────────────────────────────────────────
def onde(url, linha):
    return (' (%s:%s)' % (url.rsplit('/', 1)[-1] or url, linha)) if url else ''


def erros_dos_eventos(eventos):
    out = []
    for ev in eventos:
        m, p = ev.get('method'), ev.get('params', {})
        if m == 'Runtime.consoleAPICalled':
            txt = ' '.join(str(a.get('value', a.get('description', ''))) for a in p.get('args', []))
            if p.get('type') == 'error' or (p.get('type') == 'warning' and txt.startswith('[rotas]')):
                fr = (p.get('stackTrace') or {}).get('callFrames') or [{}]
                out.append(txt.strip().splitlines()[0][:300] + onde(fr[0].get('url'), fr[0].get('lineNumber')))
        elif m == 'Runtime.exceptionThrown':
            d = p.get('exceptionDetails', {})
            txt = (d.get('exception') or {}).get('description') or d.get('text') or 'exceção'
            out.append('exceção: ' + txt.strip().splitlines()[0][:300] + onde(d.get('url'), d.get('lineNumber')))
        elif m == 'Log.entryAdded' and p.get('entry', {}).get('level') == 'error':
            e = p['entry']
            if (e.get('url') or '').endswith('/favicon.ico'):  # o navegador pede sozinho; a página não usa
                continue
            out.append(e.get('text', '').strip()[:300] + (' — ' + e['url'] if e.get('url') else ''))
    return out


def medir(cdp, raiz, rota, largura):
    """Carrega a página do zero na largura pedida (mobile: false, para o navegador não reduzir o zoom e esconder o estouro)."""
    cdp.cmd('Emulation.setDeviceMetricsOverride', {'width': largura, 'height': ALTURA, 'deviceScaleFactor': 1, 'mobile': False})
    del cdp.eventos[:]
    # ?w= muda a URL a cada largura: só o hash diferente seria navegação na mesma página, sem recarregar
    url = '%s/index.html?w=%d%s' % (raiz, largura, rota)
    cdp.cmd('Page.navigate', {'url': url})
    if not cdp.esperar(30, 'Page.loadEventFired'):
        raise SystemExit('a página não terminou de carregar em 30 s: %s' % url)
    cdp.avaliar(ESCONDER_LOGIN)
    cdp.esperar(1.5)  # a rota roda 400 ms depois do load e os filtros 250 ms depois dela
    r = cdp.avaliar(MEDIR % json.dumps(IGNORAR))
    r['erros'] = erros_dos_eventos(cdp.eventos)
    return r


def main(a):
    if not a or a[0] in ('-h', '--help'):
        print(__doc__)
        return 0
    try:
        sys.stdout.reconfigure(errors='replace')
    except AttributeError:
        pass
    pid, aqui = a[0], '--aqui' in a
    p = av.pacote(av.carregar(), pid)
    exe = achar_navegador(av.opcao(a, '--navegador'))
    if aqui:
        fonte, origem = os.path.join(av.REPO, 'src'), 'este checkout'

        def ler(rel):
            arq = os.path.join(av.REPO, rel)
            return io.open(arq, encoding='utf-8').read() if os.path.isfile(arq) else None
    else:
        ponta = av.git(['rev-parse', '--short', p['branch']]).strip()
        fonte, origem = exportar(ponta), '%s @ %s' % (p['branch'], ponta)

        def ler(rel):
            dados = fonte.get(rel.replace('\\', '/')[len('src/'):]) if rel.replace('\\', '/').startswith('src/') else None
            return dados.decode('utf-8', errors='replace') if dados is not None else None
    rota = av.opcao(a, '--rota') or entrada(ler, p)
    if not rota:
        raise SystemExit('%s não tem rota de entrada: passe --rota "#/..."' % pid)
    if not rota.startswith('#'):
        rota = '#/' + rota.lstrip('/')
    if not re.match(r'#/[\w\-/]+(\?.*)?$', rota):
        # no Git Bash, "#/x" vira caminho do Windows; lá use MSYS_NO_PATHCONV=1
        raise SystemExit('rota inválida: %s (formato: #/<tela>[/<aba>][?filtros])' % rota)
    srv, raiz = servir(fonte)
    proc = cdp = None
    try:
        proc, perfil, ws, ws_navegador = abrir_navegador(exe)
        cdp = CDP(ws)
        for dom in ('Page.enable', 'Runtime.enable', 'Log.enable'):
            cdp.cmd(dom)
        cdp.cmd('Page.addScriptToEvaluateOnNewDocument', {'source': ENTRAR})
        print('%s · %s · rota %s · %s headless' % (pid, origem, rota, os.path.basename(exe)))
        res = [(w, medir(cdp, raiz, rota, w)) for w in LARGURAS]
    finally:
        if cdp:
            cdp.ws.fechar()
        if proc:
            fechar_navegador(proc, perfil, ws_navegador)
        srv.shutdown()
    falhou, erros = False, []
    for w, r in res:
        rola = r['scrollWidth'] > r['innerWidth']
        falhou = falhou or rola or bool(r['erros'])
        print('  %4d px  %s (body.scrollWidth %d, innerWidth %d) · %d erro(s) no console · %d aviso(s) · view %s' % (
            w, 'página ROLA na horizontal' if rola else 'página não rola', r['scrollWidth'], r['innerWidth'], len(r['erros']),
            len(r['probs']), ', '.join(r['vistas']) or 'nenhuma ativa'))
        for x in r['probs'][:8]:
            print('           aviso: estouro interno em %s' % x)
        if len(r['probs']) > 8:
            print('           … e mais %d' % (len(r['probs']) - 8))
        for e in r['erros']:
            if e not in erros:
                erros.append(e)
    if erros:
        print('erros no console:')
        for e in erros:
            print('  ' + e)
    print('resultado: %s' % ('reprovado' if falhou else 'aprovado — sem erro no console e sem rolagem horizontal nas três larguras'))
    return 1 if falhou else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
