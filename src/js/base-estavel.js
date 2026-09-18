/* Base estável — VERSÃO DE VALIDAÇÃO (branch motor-art53, local).
   Com ?estavel=1 na URL, o sorteio da base usa uma semente fixa: os mesmos
   documentos, valores e status a cada recarga. Sem o parâmetro, nada muda. */
(function () {
  if (!/[?&]estavel=1/.test(location.search)) return;
  var a = 20260918;
  Math.random = function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  window.SH_BASE_ESTAVEL = true;
})();
