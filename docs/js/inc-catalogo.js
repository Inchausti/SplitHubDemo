/* ============================================================================
   Catálogo de tipos de inconsistência — fonte única
   ----------------------------------------------------------------------------
   Antes deste arquivo a lista de tipos vivia em cinco lugares que não
   conversavam: INC_TIPOS no index.html (4 rótulos legados), _tipoIncLbl no
   data-sync-fixed (14), R.TIPOS_INC no ressarcimento (5), C.TIPOS na
   conciliação (2) e E.TIPO_INC na integração com o ERP (1). O select de
   "Tipo Inconsistência" oferecia oito rótulos de origem que o mapeamento já
   havia convertido — nenhuma das opções alcançava uma linha sequer.

   Aqui ficam os 21 tipos em 6 famílias. Todo módulo que cria ocorrência lê
   daqui, e o filtro da listagem e o do kanban são montados a partir daqui.
   Acrescentar tipo é acrescentar uma linha em TIPOS — nada mais.
   ========================================================================== */
(function () {
  'use strict';

  var K = {};

  /* ── famílias: de onde a falha veio ─────────────────────────────────── */
  K.FAMILIAS = {
    documento:    { ordem: 1, letra: 'A', label: 'Documento',                 cor: '--red',
                    desc: 'O documento não passou na entrada. Sem registro fiscal, o crédito não chega a existir.' },
    fisco:        { ordem: 2, letra: 'B', label: 'Confronto com o Fisco',     cor: '--amber',
                    desc: 'O que a plataforma tem não bate com o que o órgão apurou. É a família que decide a apropriação.' },
    ciclo:        { ordem: 3, letra: 'C', label: 'Ciclo do crédito e do débito', cor: '--purple',
                    desc: 'O órgão mudou o estado do valor — glosa, prescrição, prazo. O produto segue e evidencia.' },
    financeiro:   { ordem: 4, letra: 'D', label: 'Recolhimento e comprovação', cor: '--blue',
                    desc: 'O recolhimento não aconteceu ou não bate com o comprovante. Sem extinção não há apropriação.' },
    ressarcimento:{ ordem: 5, letra: 'E', label: 'Ressarcimento',             cor: '--teal',
                    desc: 'Intenção, pedido, decisão e recebimento fora do esperado.' },
    integracao:   { ordem: 6, letra: 'F', label: 'Integração',                cor: '--gray',
                    desc: 'O evento não chegou ao sistema do cliente depois de esgotada a retentativa.' }
  };

  /* ── tipos ──────────────────────────────────────────────────────────────
     familia  · a que família pertence
     tributo  · IBS, CBS ou null quando vale para os dois
     origem   · módulo que cria a ocorrência
     gerado   · true quando a base sintética já produz o tipo hoje
  */
  K.TIPOS = {
    /* A — documento */
    chave_invalida:        { familia: 'documento',  tributo: null,  origem: 'ingestao',
                             label: 'Chave de acesso inválida' },
    cnpj_divergente:       { familia: 'documento',  tributo: null,  origem: 'ingestao',
                             label: 'CNPJ divergente' },
    duplicidade_rf:        { familia: 'documento',  tributo: null,  origem: 'ingestao',
                             label: 'RF duplicado' },

    /* B — confronto com o Fisco */
    capur_ibs_divergente:  { familia: 'fisco',      tributo: 'IBS', origem: 'conciliacao', gerado: true,
                             label: 'Valor IBS divergente da apuração' },
    capur_cbs_divergente:  { familia: 'fisco',      tributo: 'CBS', origem: 'conciliacao', gerado: true,
                             label: 'Valor CBS divergente da apuração' },
    capur_ibs_aliquota:    { familia: 'fisco',      tributo: 'IBS', origem: 'conciliacao', gerado: true,
                             label: 'Alíquota IBS incorreta' },
    capur_cbs_aliquota:    { familia: 'fisco',      tributo: 'CBS', origem: 'conciliacao', gerado: true,
                             label: 'Alíquota CBS incorreta' },
    apur_df_sem_registro:  { familia: 'fisco',      tributo: null,  origem: 'conciliacao', gerado: true,
                             label: 'DF sem registro na apuração assistida' },
    apur_registro_sem_df:  { familia: 'fisco',      tributo: null,  origem: 'conciliacao', gerado: true,
                             label: 'Registro na apuração assistida sem DF' },

    /* C — ciclo do crédito e do débito */
    glosa_credito:         { familia: 'ciclo',      tributo: null,  origem: 'glosa', gerado: true,
                             label: 'Glosa do crédito' },
    prazo_expirado:        { familia: 'ciclo',      tributo: null,  origem: 'apuracao',
                             label: 'Prazo de apuração expirado' },

    /* D — recolhimento e comprovação */
    cfin_ibs_split:        { familia: 'financeiro', tributo: 'IBS', origem: 'pagamentos', gerado: true,
                             label: 'Split IBS não executado' },
    cfin_cbs_split:        { familia: 'financeiro', tributo: 'CBS', origem: 'pagamentos', gerado: true,
                             label: 'Split CBS não executado' },
    cfin_ibs_valor:        { familia: 'financeiro', tributo: 'IBS', origem: 'pagamentos',
                             label: 'Comprovante IBS divergente' },
    cfin_cbs_valor:        { familia: 'financeiro', tributo: 'CBS', origem: 'pagamentos',
                             label: 'Comprovante CBS divergente' },

    /* E — ressarcimento */
    res_intencao_sem_pedido:  { familia: 'ressarcimento', tributo: null, origem: 'ressarcimento',
                                label: 'Intenção sem pedido no prazo' },
    res_saldo_divergente:     { familia: 'ressarcimento', tributo: null, origem: 'ressarcimento', gerado: true,
                                label: 'Saldo credor divergente da Receita' },
    res_pedido_indeferido:    { familia: 'ressarcimento', tributo: null, origem: 'ressarcimento',
                                label: 'Pedido de ressarcimento indeferido' },
    res_pagamento_divergente: { familia: 'ressarcimento', tributo: null, origem: 'ressarcimento', gerado: true,
                                label: 'Pagamento divergente do deferido' },
    res_impedimento_ibs:      { familia: 'ressarcimento', tributo: 'IBS', origem: 'ressarcimento',
                                label: 'Impedimento do IBS ao ressarcimento' },

    /* F — integração */
    integracao_erp:        { familia: 'integracao', tributo: null,  origem: 'integracao-erp', gerado: true,
                             label: 'Integração ao ERP falhou' }
  };

  /* ── rótulos de origem que a base sintética ainda emite ──────────────────
     Mantido aqui para que a conversão viva ao lado do catálogo. Quando a
     ingestão real substituir a semente, este mapa morre.                    */
  K.DE_ORIGEM = {
    'Valor IBS divergente':       'capur_ibs_divergente',
    'Valor CBS divergente':       'capur_cbs_divergente',
    'Alíquota IBS incorreta':     'capur_ibs_aliquota',
    'Alíquota CBS incorreta':     'capur_cbs_aliquota',
    'Prazo de apuração expirado': 'prazo_expirado',
    'Split IBS não executado':    'cfin_ibs_split',
    'Split CBS não executado':    'cfin_cbs_split',
    'Comprovante IBS divergente': 'cfin_ibs_valor',
    'Comprovante CBS divergente': 'cfin_cbs_valor',
    'Falha de Layout':            'chave_invalida',
    'Inconsistência de Dados':    'cnpj_divergente',
    'Rejeitado SEFAZ':            'chave_invalida',
    'Documento Duplicado':        'duplicidade_rf',
    /* legado */
    'Divergência de Valor':       'capur_ibs_divergente',
    'Valor imposto divergente':   'capur_ibs_aliquota',
    'Não conciliado':             'capur_ibs_divergente',
    'Sem Comprovante':            'cfin_ibs_split',
    'Vencido':                    'prazo_expirado'
  };

  /* ── consultas ─────────────────────────────────────────────────────────── */
  K.lista = function () {
    return Object.keys(K.TIPOS).sort(function (a, b) {
      var fa = K.FAMILIAS[K.TIPOS[a].familia], fb = K.FAMILIAS[K.TIPOS[b].familia];
      return (fa.ordem - fb.ordem) || K.TIPOS[a].label.localeCompare(K.TIPOS[b].label, 'pt-BR');
    });
  };

  K.label = function (tipo) {
    return (K.TIPOS[tipo] && K.TIPOS[tipo].label) || tipo || 'Inconsistência';
  };

  K.familia = function (tipo) {
    return (K.TIPOS[tipo] && K.TIPOS[tipo].familia) || null;
  };

  K.familiaLabel = function (tipo) {
    var f = K.familia(tipo);
    return f ? K.FAMILIAS[f].label : '—';
  };

  K.normalizar = function (valor) {
    if (!valor) return null;
    if (K.TIPOS[valor]) return valor;
    return K.DE_ORIGEM[valor] || null;
  };

  /** Mapa {chave: rótulo}, para quem só precisa do par. */
  K.rotulos = function () {
    var o = {};
    K.lista().forEach(function (t) { o[t] = K.TIPOS[t].label; });
    return o;
  };

  /** Famílias na ordem, com os tipos de cada uma. */
  K.porFamilia = function () {
    return Object.keys(K.FAMILIAS)
      .sort(function (a, b) { return K.FAMILIAS[a].ordem - K.FAMILIAS[b].ordem; })
      .map(function (f) {
        return {
          chave: f, letra: K.FAMILIAS[f].letra, label: K.FAMILIAS[f].label,
          cor: K.FAMILIAS[f].cor, desc: K.FAMILIAS[f].desc,
          tipos: K.lista().filter(function (t) { return K.TIPOS[t].familia === f; })
        };
      });
  };

  /**
   * Preenche um <select> com todos os tipos, agrupados por família.
   * Só lista o que existe no catálogo — não há opção que não alcance linha.
   */
  K.preencherSelect = function (el, rotuloVazio) {
    if (typeof el === 'string') el = document.getElementById(el);
    if (!el) return;
    var atual = el.value;
    var html = '<option value="">' + (rotuloVazio || 'Todas') + '</option>';
    K.porFamilia().forEach(function (f) {
      if (!f.tipos.length) return;
      html += '<optgroup label="' + f.letra + ' · ' + f.label + '">';
      f.tipos.forEach(function (t) {
        html += '<option value="' + t + '">' + K.TIPOS[t].label + '</option>';
      });
      html += '</optgroup>';
    });
    el.innerHTML = html;
    if (atual && K.TIPOS[atual]) el.value = atual;
  };

  /** Cor resolvida da família, para badge e gráfico. */
  K.cor = function (tipo) {
    var f = K.familia(tipo);
    var v = f ? K.FAMILIAS[f].cor : '--txt3';
    try {
      return getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#8A92A3';
    } catch (e) { return '#8A92A3'; }
  };

  window.IncCatalogo = K;
})();
