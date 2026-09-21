/* Semente da base sintética.
   A base do protótipo é sorteada a cada carga. Com semente fixa ela sai
   idêntica sempre: os mesmos documentos, valores e status — que é o que
   permite auditar indicadores, repetir uma demonstração e comparar duas
   versões da aplicação sem que o chão se mexa.
   Para ver a aplicação com uma base diferente, use ?aleatorio=1 na URL. */
(function () {
  if (/[?&]aleatorio=1/.test(location.search)) { window.SH_BASE_SEMENTE = false; return; }
  var a = 20260918;
  Math.random = function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  window.SH_BASE_SEMENTE = true;
})();
