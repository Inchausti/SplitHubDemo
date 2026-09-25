# -*- coding: utf-8 -*-
"""
Gera src/docs/catalogo-inconsistencias.html a partir da tabela CATALOGO abaixo.

Este arquivo e a fonte unica do catalogo de inconsistencias possiveis do
SplitHub. O HTML e derivado: nunca edite o HTML a mao, edite a tabela e rode

    python tools/gerar-catalogo-inconsistencias.py

O script escreve src/docs/catalogo-inconsistencias.html e espelha em
docs/docs/catalogo-inconsistencias.html.

Campos de cada entrada:
  cod         codigo estavel INC-<MOD>-nn; nunca reaproveitar um codigo retirado
  titulo      nome curto da ocorrencia
  fam         chave de familia (ver FAMILIAS)
  gatilho     o fato que a produz, ancorado na regra de negocio do PRD
  regra       codigo(s) de RN / artigo que sustenta o gatilho
  deteccao    como o produto percebe
  crit        critica | alta | media | baixa
  contorno    o que fazer para resolver
  onde        dentro | fora | misto  (onde a acao de resolucao acontece)
  estado      vivo (existe em src/js/inc-catalogo.js) | proposto
  chave       chave em inc-catalogo.js quando estado == vivo
"""
import io
import os
import re
import html as H

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VERSAO = '1.0'
DATA = '25/09/2026'

# ---------------------------------------------------------------- familias --
FAMILIAS = {
    'documento':    ('A', 'Documento', '--red',
                     u'O documento n&atilde;o passou na entrada. Sem registro fiscal, o cr&eacute;dito n&atilde;o chega a existir.', 'vivo'),
    'cadastro':     ('G', 'Cadastro e v&iacute;nculo', '--amber',
                     u'O documento est&aacute; certo, mas aquilo contra o que ele resolve &mdash; estabelecimento, fornecedor, contrato, acesso &mdash; n&atilde;o est&aacute;. Fam&iacute;lia proposta.', 'proposto'),
    'fg':           ('H', 'Fato gerador e compet&ecirc;ncia', '--purple',
                     u'A data ou a regra que define quando o fato ocorreu n&atilde;o fecha. Fam&iacute;lia proposta.', 'proposto'),
    'fisco':        ('B', 'Confronto com o Fisco', '--amber',
                     u'O que a plataforma tem n&atilde;o bate com o que o &oacute;rg&atilde;o apurou. &Eacute; a fam&iacute;lia que decide a apropria&ccedil;&atilde;o.', 'vivo'),
    'ciclo':        ('C', 'Ciclo do cr&eacute;dito e do d&eacute;bito', '--purple',
                     u'O &oacute;rg&atilde;o mudou o estado do valor &mdash; glosa, prescri&ccedil;&atilde;o, prazo. O produto segue e evidencia.', 'vivo'),
    'financeiro':   ('D', 'Recolhimento e comprova&ccedil;&atilde;o', '--blue',
                     u'O recolhimento n&atilde;o aconteceu ou n&atilde;o bate com o comprovante. Sem extin&ccedil;&atilde;o n&atilde;o h&aacute; apropria&ccedil;&atilde;o.', 'vivo'),
    'ressarcimento': ('E', 'Ressarcimento', '--teal',
                      u'Inten&ccedil;&atilde;o, pedido, decis&atilde;o e recebimento fora do esperado.', 'vivo'),
    'integracao':   ('F', 'Integra&ccedil;&atilde;o', '--gray',
                     u'O evento n&atilde;o chegou ao sistema do cliente depois de esgotada a retentativa.', 'vivo'),
}

FAM_ORDEM = ['documento', 'cadastro', 'fg', 'fisco', 'ciclo', 'financeiro',
             'ressarcimento', 'integracao']

CRIT = {
    'critica': ('Cr&iacute;tica', '--red'),
    'alta':    ('Alta', '--amber'),
    'media':   (u'M&eacute;dia', '--blue'),
    'baixa':   ('Baixa', '--gray'),
}

ONDE = {
    'dentro': (u'No SplitHub', '--green'),
    'misto':  (u'SplitHub + terceiro', '--amber'),
    'fora':   (u'Fora do SplitHub', '--red'),
}

# ---------------------------------------------------------------- modulos ---
# (chave, titulo, prd, abertura)
MODULOS = [
    ('ING', u'Ingest&atilde;o', 'prd-ingestao.html',
     u'A porta de entrada. Toda ocorr&ecirc;ncia daqui tem a mesma consequ&ecirc;ncia: '
     u'o registro fiscal n&atilde;o nasce, e sem registro fiscal n&atilde;o h&aacute; cr&eacute;dito a apropriar '
     u'(RN-ING-02). &Eacute; a fam&iacute;lia mais barata de resolver e a mais cara de ignorar.'),
    ('CAD', u'Cadastro &mdash; organiza&ccedil;&atilde;o, fornecedor e contrato',
     'prd-organizacao.html',
     u'O documento chega correto e mesmo assim n&atilde;o encontra onde pousar. '
     u'S&atilde;o falhas de base, n&atilde;o de documento &mdash; e por isso hoje n&atilde;o viram ocorr&ecirc;ncia '
     u'em nenhum m&oacute;dulo. &Eacute; o maior vazio do cat&aacute;logo atual.'),
    ('FG', u'Classifica&ccedil;&atilde;o de fato gerador', 'prd-classificacao-fg.html',
     u'A data do fato gerador decide a compet&ecirc;ncia, e a compet&ecirc;ncia decide contra qual '
     u'apura&ccedil;&atilde;o o documento ser&aacute; confrontado. Errar aqui produz uma diverg&ecirc;ncia de '
     u'confronto que parece erro de valor e n&atilde;o &eacute;.'),
    ('CONC', u'Concilia&ccedil;&atilde;o com a apura&ccedil;&atilde;o assistida', 'prd-conciliacao.html',
     u'O confronto entre o que a plataforma escriturou e o que o &oacute;rg&atilde;o apurou. '
     u'&Eacute; onde nasce a maior parte das ocorr&ecirc;ncias vivas hoje, e onde a '
     u'aus&ecirc;ncia da API do IBS mais pesa.'),
    ('CRE', u'Cr&eacute;dito', 'prd-credito.html',
     u'O ciclo do direito: nasce, apropria, utiliza, prescreve. As ocorr&ecirc;ncias aqui '
     u'quase nunca s&atilde;o err&oacute;, s&atilde;o prazo &mdash; e prazo n&atilde;o se negocia depois de vencido.'),
    ('DEB', u'D&eacute;bito', 'prd-debito.html',
     u'O outro lado. D&eacute;bito n&atilde;o extinto acumula multa e juros e, no caso do fornecedor, '
     u'trava o cr&eacute;dito do adquirente pelo art. 47.'),
    ('APU', u'Apura&ccedil;&atilde;o', 'prd-apuracao.html',
     u'A ordem do art. 53 e a separa&ccedil;&atilde;o IBS/CBS s&atilde;o as duas regras que, quebradas, '
     u'produzem um saldo que parece certo e est&aacute; errado.'),
    ('PAG', u'Pagamentos e RAD', 'prd-pagamentos.html',
     u'Onde o dinheiro efetivamente sai. Toda ocorr&ecirc;ncia deste bloco tem custo '
     u'imediato em caixa &mdash; ou porque n&atilde;o saiu, ou porque saiu duas vezes.'),
    ('EXR', u'Execu&ccedil;&atilde;o RAD &mdash; pol&iacute;ticas', 'prd-execucao-rad.html',
     u'A r&eacute;gua que decide quais guias saem sozinhas. A maior parte dos conflitos &eacute; '
     u'barrada no salvamento; sobram os que s&oacute; se medem sobre registros concretos.'),
    ('RES', u'Ressarcimento', 'prd-ressarcimento.html',
     u'Cinco tipos vivos e um conjunto de prazos que correm contra o &oacute;rg&atilde;o. '
     u'CBS e IBS s&atilde;o processos independentes: nada soma (RN-RES-01).'),
    ('INT', u'Integra&ccedil;&otilde;es', 'prd-integracoes.html',
     u'O canal com o ERP. S&oacute; vira ocorr&ecirc;ncia depois de esgotada a retentativa '
     u'(RN-INC-08) &mdash; antes disso &eacute; ru&iacute;do.'),
    ('AUT', u'Automa&ccedil;&otilde;es', 'prd-automacoes.html',
     u'Automa&ccedil;&atilde;o notifica, nunca decide (RN-AUT-01). As ocorr&ecirc;ncias aqui s&atilde;o sobre '
     u'a r&eacute;gua ter falado com quem n&atilde;o devia, ou n&atilde;o ter falado com quem devia.'),
    ('POR', u'Portal do fornecedor', 'prd-portal-fornecedor.html',
     u'Um terceiro dentro da plataforma. As duas ocorr&ecirc;ncias poss&iacute;veis s&atilde;o de '
     u'isolamento, e ambas s&atilde;o cr&iacute;ticas por natureza.'),
]

# ---------------------------------------------------------------- catalogo --
C = []


def add(cod, titulo, fam, gatilho, regra, deteccao, crit, contorno, onde,
        estado='proposto', chave=None):
    C.append(dict(cod=cod, titulo=titulo, fam=fam, gatilho=gatilho, regra=regra,
                  deteccao=deteccao, crit=crit, contorno=contorno, onde=onde,
                  estado=estado, chave=chave))


# ---- ING -------------------------------------------------------------------
add('INC-ING-01', u'Chave de acesso inv&aacute;lida', 'documento',
    u'A chave de 44 posi&ccedil;&otilde;es n&atilde;o passa na valida&ccedil;&atilde;o de estrutura ou de d&iacute;gito verificador.',
    'RN-ING-01, RN-ING-02',
    u'Valida&ccedil;&atilde;o sint&aacute;tica no pipeline de ingest&atilde;o, antes de gerar o RF.',
    'critica',
    u'Reimportar o documento com a chave correta. Se o XML de origem estiver &iacute;ntegro, '
    u'o erro est&aacute; no extrator do ERP &mdash; corrigir l&aacute; evita a recorr&ecirc;ncia.',
    'misto', 'vivo', 'chave_invalida')

add('INC-ING-02', u'Chave repetida &mdash; documento j&aacute; existente', 'documento',
    u'A chave j&aacute; est&aacute; na base. Aceitar contaria o mesmo cr&eacute;dito duas vezes.',
    'RN-ING-01',
    u'Confronto da chave contra a base na entrada.',
    'critica',
    u'Descartar a reimporta&ccedil;&atilde;o. Se os dois documentos tiverem valores diferentes, '
    u'&eacute; o ERP que est&aacute; emitindo chave duplicada &mdash; escalar ao time t&eacute;cnico do cliente.',
    'misto', 'vivo', 'duplicidade_rf')

add('INC-ING-03', u'Leiaute ilegível ou fora do esquema', 'documento',
    u'O arquivo n&atilde;o &eacute; interpret&aacute;vel: XML malformado, esquema de vers&atilde;o n&atilde;o suportada, '
    u'campo obrigat&oacute;rio ausente.',
    'RN-ING-07, RN-INI-05',
    u'Falha de parse registrada com a verifica&ccedil;&atilde;o que reprovou.',
    'alta',
    u'Reenviar o arquivo. Vers&atilde;o de esquema n&atilde;o suportada &eacute; item de roadmap, '
    u'n&atilde;o de opera&ccedil;&atilde;o &mdash; deve escalar ao produto, n&atilde;o ao fiscal.',
    'misto')

add('INC-ING-04', u'CNPJ divergente entre documento e cadastro', 'documento',
    u'O CNPJ do emitente ou do destinat&aacute;rio no documento n&atilde;o corresponde ao cadastrado.',
    'RN-ING-05, RN-ORG-01',
    u'Confronto com a base de estabelecimentos e de fornecedores.',
    'alta',
    u'Corrigir o cadastro quando o documento estiver certo; pedir carta de corre&ccedil;&atilde;o '
    u'ou novo documento ao emitente quando for o inverso.',
    'misto', 'vivo', 'cnpj_divergente')

add('INC-ING-05', u'Destinat&aacute;rio n&atilde;o cadastrado ou inativo', 'cadastro',
    u'O CNPJ destinat&aacute;rio n&atilde;o existe na base ou existe inativo. O documento n&atilde;o &eacute; '
    u'associado ao grupo e o cr&eacute;dito existe no papel, n&atilde;o na plataforma.',
    'RN-ING-05, RN-ORG-01',
    u'Resolu&ccedil;&atilde;o do v&iacute;nculo falha na associa&ccedil;&atilde;o ao grupo.',
    'critica',
    u'Cadastrar ou reativar o estabelecimento e reprocessar a ingest&atilde;o. '
    u'Enquanto n&atilde;o for feito, o documento n&atilde;o aparece em nenhum KPI &mdash; '
    u'&eacute; a ocorr&ecirc;ncia que mais some da vista.',
    'dentro')

add('INC-ING-06', u'Emitente fora da base de fornecedores', 'cadastro',
    u'O emitente n&atilde;o est&aacute; cadastrado; sem fornecedor n&atilde;o h&aacute; contrato, '
    u'e sem contrato o m&eacute;todo de pagamento do RF nasce indeterminado.',
    'RN-FORN-01, RN-FORN-02, RN-CTR-09',
    u'Resolu&ccedil;&atilde;o do emitente na ingest&atilde;o.',
    'alta',
    u'Cadastrar o fornecedor e o contrato. At&eacute; l&aacute;, o padr&atilde;o legal &eacute; Split Payment '
    u'(RN-CTR-16) &mdash; o documento anda, mas sem m&eacute;todo escolhido.',
    'dentro')

add('INC-ING-07', u'Data de emiss&atilde;o ausente ou n&atilde;o interpret&aacute;vel', 'fg',
    u'Sem data de emiss&atilde;o n&atilde;o h&aacute; fato gerador, e o cr&eacute;dito &eacute; classificado como '
    u'curto prazo por falha para o lado seguro.',
    'RN-ING-03, RN-CRE-06',
    u'Normaliza&ccedil;&atilde;o de datas na ingest&atilde;o.',
    'alta',
    u'Corrigir a data na origem e reprocessar. A classifica&ccedil;&atilde;o conservadora evita perder '
    u'prazo, mas infla o curto prazo do dashboard enquanto durar.',
    'misto')

add('INC-ING-08', u'Documento sem os dois registros fiscais esperados', 'documento',
    u'Um DF gera tipicamente um RF de IBS e um de CBS. Sair com um s&oacute; significa '
    u'tributo n&atilde;o reconhecido no documento ou falha de gera&ccedil;&atilde;o.',
    'RN-ING-06',
    u'Contagem de RFs por DF ao final da ingest&atilde;o.',
    'alta',
    u'Conferir os grupos de IBS e CBS no XML. Documento leg&iacute;timo com um tributo s&oacute; '
    u'(imunidade, suspens&atilde;o) precisa ser marcado como tal, n&atilde;o tratado como falha.',
    'dentro')

add('INC-ING-09', u'Documento recusado na verifica&ccedil;&atilde;o fiscal', 'documento',
    u'Alguma verifica&ccedil;&atilde;o de conte&uacute;do reprovou &mdash; CST inv&aacute;lido, base incompat&iacute;vel '
    u'com al&iacute;quota, tributo ausente onde &eacute; obrigat&oacute;rio.',
    'RN-ING-02, RN-ING-07',
    u'Bateria de verifica&ccedil;&otilde;es de conte&uacute;do, antes de gerar o RF.',
    'critica',
    u'A corre&ccedil;&atilde;o &eacute; do emitente: carta de corre&ccedil;&atilde;o quando cab&iacute;vel, substitui&ccedil;&atilde;o '
    u'quando n&atilde;o. O SplitHub s&oacute; registra o motivo e cobra pela r&eacute;gua de automa&ccedil;&atilde;o.',
    'fora')

# ---- CAD -------------------------------------------------------------------
add('INC-CAD-01', u'Vig&ecirc;ncias de contrato sobrepostas no mesmo CNPJ', 'cadastro',
    u'Dois contratos vigentes na mesma data tornam amb&iacute;guo qual m&eacute;todo se aplica '
    u'&agrave; nota emitida naquele dia.',
    'RN-CTR-02, RN-FORN-04',
    u'Valida&ccedil;&atilde;o no cadastro; a ocorr&ecirc;ncia s&oacute; existe para bases importadas, '
    u'onde a valida&ccedil;&atilde;o n&atilde;o rodou linha a linha.',
    'alta',
    u'Encerrar ou corrigir a vig&ecirc;ncia de um dos contratos e reprocessar os RFs '
    u'do per&iacute;odo sobreposto &mdash; o m&eacute;todo aplicado pode ter sido o errado.',
    'dentro')

add('INC-CAD-02', u'Contrato com datas inv&aacute;lidas', 'cadastro',
    u'Data n&atilde;o interpret&aacute;vel isola o contrato no estado <code>invalido</code>; '
    u'ele deixa de participar da resolu&ccedil;&atilde;o de vig&ecirc;ncia.',
    'RN-CTR-06',
    u'Deriva&ccedil;&atilde;o de status na leitura do contrato.',
    'alta',
    u'Corrigir as datas. Enquanto durar, as notas daquele fornecedor caem no padr&atilde;o '
    u'Split Payment sem que ningu&eacute;m tenha decidido isso.',
    'dentro')

add('INC-CAD-03', u'Nota emitida em janela sem contrato vigente', 'cadastro',
    u'O contrato expirou e o fornecedor continua emitindo. A cobertura cai abaixo '
    u'de 100% e o m&eacute;todo passa a ser o padr&atilde;o legal, n&atilde;o o contratado.',
    'RN-CTR-11, RN-CTR-16, RN-ING-04',
    u'KPI de cobertura e resolu&ccedil;&atilde;o de m&eacute;todo na ingest&atilde;o.',
    'alta',
    u'Renovar o contrato. Se a renova&ccedil;&atilde;o for retroativa, reprocessar os RFs '
    u'do intervalo para aplicar o m&eacute;todo correto.',
    'misto')

add('INC-CAD-04', u'M&eacute;todo do RF divergente do m&eacute;todo do contrato', 'cadastro',
    u'O RF carrega um m&eacute;todo que n&atilde;o &eacute; o do contrato vigente na emiss&atilde;o &mdash; '
    u'sem que haja recolhimento assumido que justifique a troca.',
    'RN-CTR-07, RN-ING-04, RN-CRE-17',
    u'Confronto entre <code>metodoPagamento</code> e <code>metodoPagamentoContrato</code>.',
    'alta',
    u'Quando houve recolhimento assumido, a diverg&ecirc;ncia &eacute; leg&iacute;tima e deve ser suprimida. '
    u'Fora disso, reprocessar a resolu&ccedil;&atilde;o de m&eacute;todo do RF.',
    'dentro')

add('INC-CAD-05', u'CNPJ duplicado na base de estabelecimentos', 'cadastro',
    u'O mesmo CNPJ cadastrado duas vezes faz o documento ser associado duas vezes.',
    'RN-ORG-04, RN-FORN-01',
    u'Unicidade da chave de neg&oacute;cio; alcan&ccedil;a bases importadas.',
    'critica',
    u'Consolidar os dois cadastros e reapontar os documentos. &Eacute; trabalho de migra&ccedil;&atilde;o, '
    u'n&atilde;o de opera&ccedil;&atilde;o &mdash; deve envolver o time t&eacute;cnico.',
    'dentro')

add('INC-CAD-06', u'Agrupamento econ&ocirc;mico resolvido por fallback', 'cadastro',
    u'Sem <code>grupoId</code>, o produto agrupa pela raiz do CNPJ. Grupos reais re&uacute;nem '
    u'entidades de ra&iacute;zes distintas &mdash; o agrupamento fica plaus&iacute;vel e errado.',
    'RN-CTR-14, RN-ORG-02',
    u'Uso do caminho de fallback na resolu&ccedil;&atilde;o de grupo.',
    'media',
    u'Preencher o <code>grupoId</code> de todos os estabelecimentos. '
    u'At&eacute; l&aacute;, os filtros por grupo do dashboard n&atilde;o s&atilde;o confi&aacute;veis.',
    'dentro')

add('INC-CAD-07', u'Score e classifica&ccedil;&atilde;o do fornecedor em desacordo', 'cadastro',
    u'A classifica&ccedil;&atilde;o deve derivar do score de 0 a 100. Dois campos independentes '
    u'contam hist&oacute;rias diferentes sobre o mesmo fornecedor.',
    'RN-FORN-05',
    u'Confronto entre o score e a faixa declarada.',
    'baixa',
    u'Recalcular a classifica&ccedil;&atilde;o a partir do score. N&atilde;o afeta apura&ccedil;&atilde;o &mdash; '
    u'afeta a prioridade com que o time cobra o fornecedor.',
    'dentro')

add('INC-CAD-08', u'Acesso ao portal ativo sem contrato vigente', 'cadastro',
    u'Contrato encerrado ou fornecedor inativado, e o acesso externo continua de p&eacute;. '
    u'&Eacute; a forma mais comum de acesso que sobrevive ao v&iacute;nculo.',
    'RN-CTR-22, RN-FORN-14',
    u'Revis&atilde;o obrigat&oacute;ria disparada pelo encerramento; a ocorr&ecirc;ncia registra os '
    u'que n&atilde;o foram revisados.',
    'alta',
    u'Revogar ou reconfirmar cada acesso. Acesso revogado n&atilde;o &eacute; apagado, para '
    u'preservar a autoria dos comprovantes j&aacute; enviados (RN-FORN-10).',
    'dentro')

add('INC-CAD-09', u'Filial remanejada de grupo sem aviso', 'cadastro',
    u'A hierarquia define o alcance dos acessos concedidos. Mud&aacute;-la muda quem '
    u'enxerga o qu&ecirc;, e isso n&atilde;o pode ser silencioso.',
    'RN-FORN-13',
    u'Trilha de auditoria do cadastro.',
    'media',
    u'Conferir os acessos do grupo de origem e do de destino. '
    u'A a&ccedil;&atilde;o &eacute; de revis&atilde;o, n&atilde;o de corre&ccedil;&atilde;o &mdash; o remanejamento pode estar certo.',
    'dentro')

# ---- FG --------------------------------------------------------------------
add('INC-FG-01', u'Documento sem regra de fato gerador aplic&aacute;vel', 'fg',
    u'Nenhuma regra do mapa cobre a combina&ccedil;&atilde;o de tipo de documento, opera&ccedil;&atilde;o e '
    u'natureza. O fato gerador cai no padr&atilde;o.',
    u'PRD de classifica&ccedil;&atilde;o, se&ccedil;&atilde;o 03',
    u'Cobertura do mapa de regras no pipeline de ingest&atilde;o.',
    'media',
    u'Cadastrar a regra no cockpit de fato gerador. O padr&atilde;o costuma acertar; '
    u'o problema &eacute; ningu&eacute;m saber que foi o padr&atilde;o que decidiu.',
    'dentro')

add('INC-FG-02', u'Compet&ecirc;ncia de escritura&ccedil;&atilde;o diferente da compet&ecirc;ncia do fato', 'fg',
    u'A apura&ccedil;&atilde;o se orienta pela data de emiss&atilde;o; usar a data de ingest&atilde;o fecha '
    u'a compet&ecirc;ncia errada.',
    'RN-ING-03',
    u'Confronto entre a compet&ecirc;ncia do RF e o m&ecirc;s da data de emiss&atilde;o.',
    'alta',
    u'Reabrir a compet&ecirc;ncia e reclassificar. Se a compet&ecirc;ncia j&aacute; foi transmitida, '
    u'a corre&ccedil;&atilde;o &eacute; retificadora &mdash; a&ccedil;&atilde;o fora do SplitHub.',
    'misto')

add('INC-FG-03', u'Fato gerador divergente do apurado pelo &oacute;rg&atilde;o', 'fg',
    u'O documento aparece na apura&ccedil;&atilde;o assistida de outra compet&ecirc;ncia. '
    u'Aparenta diverg&ecirc;ncia de valor e &eacute; diverg&ecirc;ncia de data.',
    'RN-CONC-01, RN-ING-03',
    u'Confronto de compet&ecirc;ncia no extrato do &oacute;rg&atilde;o.',
    'alta',
    u'Corrigir a classifica&ccedil;&atilde;o local quando o &oacute;rg&atilde;o estiver certo. '
    u'Quando o &oacute;rg&atilde;o estiver errado, o caminho &eacute; a impugna&ccedil;&atilde;o &mdash; fora do produto.',
    'misto')

# ---- CONC ------------------------------------------------------------------
add('INC-CONC-01', u'Valor de IBS divergente da apura&ccedil;&atilde;o', 'fisco',
    u'O valor de IBS escriturado n&atilde;o bate com o apurado pelo Comit&ecirc; Gestor.',
    'RN-CONC-01, RN-CONC-07',
    u'Confronto CAPUR, no n&iacute;vel do documento.',
    'critica',
    u'Comparar campo a campo com o extrato. Erro local: reprocessar. '
    u'Erro do &oacute;rg&atilde;o: retifica&ccedil;&atilde;o pelo emitente, a&ccedil;&atilde;o fora do SplitHub.',
    'misto', 'vivo', 'capur_ibs_divergente')

add('INC-CONC-02', u'Valor de CBS divergente da apura&ccedil;&atilde;o', 'fisco',
    u'O valor de CBS escriturado n&atilde;o bate com o apurado pela Receita Federal.',
    'RN-CONC-01, RN-CONC-07',
    u'Confronto CAPUR, no n&iacute;vel do documento.',
    'critica',
    u'Mesmo caminho do IBS, com a diferen&ccedil;a de que a API da CBS permite '
    u'reconferir o extrato sob demanda.',
    'misto', 'vivo', 'capur_cbs_divergente')

add('INC-CONC-03', u'Al&iacute;quota de IBS incorreta', 'fisco',
    u'A al&iacute;quota do documento n&atilde;o &eacute; a vigente para a UF, o munic&iacute;pio e a '
    u'classifica&ccedil;&atilde;o tribut&aacute;ria da opera&ccedil;&atilde;o.',
    'RN-CONC-01',
    u'Confronto de al&iacute;quota, independente de recolhimento.',
    'critica',
    u'Corrigir a parametriza&ccedil;&atilde;o no ERP para os pr&oacute;ximos; para os emitidos, '
    u'a corre&ccedil;&atilde;o &eacute; documental e cabe ao emitente.',
    'fora', 'vivo', 'capur_ibs_aliquota')

add('INC-CONC-04', u'Al&iacute;quota de CBS incorreta', 'fisco',
    u'Mesma falha na parcela federal.',
    'RN-CONC-01',
    u'Confronto de al&iacute;quota, independente de recolhimento.',
    'critica',
    u'Id&ecirc;ntico ao IBS. Divergir nos dois tributos ao mesmo tempo aponta '
    u'erro de cadastro de produto, n&atilde;o de opera&ccedil;&atilde;o.',
    'fora', 'vivo', 'capur_cbs_aliquota')

add('INC-CONC-05', u'DF sem registro na apura&ccedil;&atilde;o assistida', 'fisco',
    u'O documento existe na plataforma e n&atilde;o aparece no extrato do &oacute;rg&atilde;o. '
    u'S&oacute; vira ocorr&ecirc;ncia 30 dias depois da emiss&atilde;o.',
    'RN-INC-07, art. 46',
    u'Confronto CAPUR por aus&ecirc;ncia, com carência de 30 dias.',
    'critica',
    u'Conferir se o documento foi efetivamente transmitido. '
    u'Documento n&atilde;o transmitido n&atilde;o gera cr&eacute;dito &mdash; a a&ccedil;&atilde;o &eacute; do emitente.',
    'misto', 'vivo', 'apur_df_sem_registro')

add('INC-CONC-06', u'Registro na apura&ccedil;&atilde;o assistida sem DF', 'fisco',
    u'O &oacute;rg&atilde;o apurou um documento que a plataforma n&atilde;o tem. '
    u'&Eacute; cr&eacute;dito dispon&iacute;vel que ningu&eacute;m est&aacute; aproveitando.',
    'RN-CONC-06',
    u'Confronto CAPUR reverso, a partir do extrato.',
    'alta',
    u'Importar o documento faltante. Se o ERP n&atilde;o o tem, a origem &eacute; uma '
    u'opera&ccedil;&atilde;o fora do fluxo &mdash; investigar antes de importar manualmente.',
    'misto', 'vivo', 'apur_registro_sem_df')

add('INC-CONC-07', u'Base de c&aacute;lculo divergente', 'fisco',
    u'Valor e al&iacute;quota batem, a base n&atilde;o. Acontece com desconto, frete e '
    u'exclus&otilde;es tratados de forma diferente pelos dois lados.',
    'RN-CONC-07',
    u'Confronto de <code>vBC</code> no extrato.',
    'alta',
    u'Conferir a composi&ccedil;&atilde;o da base. &Eacute; o tipo que mais frequentemente revela '
    u'erro de parametriza&ccedil;&atilde;o do ERP, n&atilde;o erro pontual.',
    'misto')

add('INC-CONC-08', u'Classifica&ccedil;&atilde;o tribut&aacute;ria divergente', 'fisco',
    u'CST ou <code>cClassTrib</code> do documento diferente do que o &oacute;rg&atilde;o reconheceu. '
    u'Muda o regime, n&atilde;o o valor &mdash; e muda o direito ao cr&eacute;dito.',
    'RN-CONC-01, art. 48',
    u'Confronto de classifica&ccedil;&atilde;o no extrato.',
    'critica',
    u'Reclassificar exige documento novo. Enquanto n&atilde;o houver, o cr&eacute;dito '
    u'deve ser tratado como em risco, n&atilde;o como apropri&aacute;vel.',
    'fora')

add('INC-CONC-09', u'Cr&eacute;dito presumido divergente', 'fisco',
    u'O valor de <code>vCredPres</code> declarado n&atilde;o bate com o reconhecido, '
    u'ou o c&oacute;digo <code>cCredPres</code> n&atilde;o admite o grupo informado.',
    u'arts. 168&ndash;171; NT 2025.002-RTC',
    u'Confronto do grupo de presumido no extrato, quando dispon&iacute;vel.',
    'alta',
    u'Conferir o c&oacute;digo contra a tabela e o indicador de dedu&ccedil;&atilde;o. '
    u'Presumido indevido &eacute; glosa certa &mdash; ver o detalhamento em '
    u'<a href="creditos-sem-df.html#s04">cr&eacute;ditos sem DF</a>.',
    'misto')

add('INC-CONC-10', u'Conciliação financeira avaliada antes da fiscal', 'fisco',
    u'A CFIN s&oacute; deve ser avaliada depois de a CAPUR concluir. Antes disso, '
    u'confirma-se pagamento contra um valor ainda n&atilde;o validado.',
    'RN-CONC-03',
    u'Ordena&ccedil;&atilde;o das duas etapas no motor de concilia&ccedil;&atilde;o.',
    'media',
    u'&Eacute; defeito de orquestra&ccedil;&atilde;o, n&atilde;o de dado. A ocorr&ecirc;ncia serve para '
    u'detectar regress&atilde;o; a corre&ccedil;&atilde;o &eacute; de engenharia.',
    'dentro')

add('INC-CONC-11', u'IBS sem confer&ecirc;ncia autom&aacute;tica dispon&iacute;vel', 'fisco',
    u'Enquanto a integra&ccedil;&atilde;o com a API do Comit&ecirc; Gestor n&atilde;o estiver ligada, '
    u'a detec&ccedil;&atilde;o do lado do IBS depende de confer&ecirc;ncia manual.',
    'RN-INC-06',
    u'Aus&ecirc;ncia de extrato do &oacute;rg&atilde;o para a compet&ecirc;ncia.',
    'alta',
    u'Conferir manualmente pelo portal do Comit&ecirc; Gestor at&eacute; a integra&ccedil;&atilde;o entrar. '
    u'O MOC v1.10 j&aacute; publicou as APIs &mdash; ver '
    u'<a href="integracao-apis-reforma.html#f">cronograma</a>.',
    'fora')

# ---- CRE -------------------------------------------------------------------
add('INC-CRE-01', u'Glosa do cr&eacute;dito', 'ciclo',
    u'O &oacute;rg&atilde;o recusou o cr&eacute;dito. Qualquer RF glosado p&otilde;e o DF inteiro em glosado.',
    'RN-CRE-02, RN-CRE-09, RN-APU-07',
    u'Retorno do &oacute;rg&atilde;o ou marca&ccedil;&atilde;o manual.',
    'critica',
    u'A revers&atilde;o vive no contencioso, n&atilde;o na fila de inconsist&ecirc;ncias '
    u'(RN-INC-05). Reunir a documenta&ccedil;&atilde;o de suporte e impugnar.',
    'fora', 'vivo', 'glosa_credito')

add('INC-CRE-02', u'Prazo de apropria&ccedil;&atilde;o expirado', 'ciclo',
    u'A apropria&ccedil;&atilde;o vence no &uacute;ltimo dia do m&ecirc;s seguinte ao da emiss&atilde;o e '
    u'o cr&eacute;dito passou dessa data sem ser apropriado.',
    'RN-CRE-04, RN-CRE-05',
    u'R&eacute;gua de vencimento sobre a data de emiss&atilde;o.',
    'critica',
    u'Apropriar na compet&ecirc;ncia corrente com a justificativa do atraso. '
    u'Cr&eacute;dito fora de prazo &eacute; o caso mais direto de perda do KPI central.',
    'dentro', 'vivo', 'prazo_expirado')

add('INC-CRE-03', u'Cr&eacute;dito prescrito pelo decurso de cinco anos', 'ciclo',
    u'A data do documento &eacute; anterior a hoje menos cinco anos. Prescri&ccedil;&atilde;o do art. 54 '
    u'opera mesmo sem status expl&iacute;cito, e n&atilde;o se confunde com vencido recuper&aacute;vel.',
    'RN-CRE-07, RN-CRE-08, art. 54',
    u'Deriva&ccedil;&atilde;o por data, independente de status.',
    'critica',
    u'N&atilde;o h&aacute; contorno: o direito acabou. A ocorr&ecirc;ncia existe para documentar a perda '
    u'e para apontar o que est&aacute; a menos de doze meses da mesma sorte.',
    'dentro')

add('INC-CRE-04', u'Documento parado em estado parcial', 'ciclo',
    u'IBS e CBS do mesmo DF em estados diferentes por mais de uma compet&ecirc;ncia. '
    u'O DF fica em <code>parc_apropriado</code> e ningu&eacute;m o v&ecirc; como pendente.',
    'RN-CRE-10, RN-CRE-11',
    u'Idade do estado parcial no n&iacute;vel do DF.',
    'alta',
    u'Tratar o tributo atrasado. O estado parcial &eacute; leg&iacute;timo por alguns dias e '
    u'suspeito depois disso &mdash; os dois tributos t&ecirc;m ciclos distintos, n&atilde;o prazos distintos.',
    'dentro')

add('INC-CRE-05', u'Cr&eacute;dito apropriado sem extin&ccedil;&atilde;o do d&eacute;bito do fornecedor', 'financeiro',
    u'O art. 47 condiciona o cr&eacute;dito &agrave; extin&ccedil;&atilde;o do d&eacute;bito correspondente. '
    u'Apropriar antes disso &eacute; antecipar um direito que ainda n&atilde;o nasceu.',
    'RN-CONC-02, art. 47, art. 48',
    u'Confronto CFIN contra a apropria&ccedil;&atilde;o j&aacute; registrada.',
    'critica',
    u'Reverter a apropria&ccedil;&atilde;o at&eacute; a confirma&ccedil;&atilde;o do recolhimento, ou assumir o '
    u'recolhimento pelo RAD quando o contrato e o art. 36 permitirem.',
    'misto')

add('INC-CRE-06', u'Cr&eacute;dito com veda&ccedil;&atilde;o do art. 48 j&aacute; apropriado', 'ciclo',
    u'Bem ou servi&ccedil;o de uso e consumo pessoal apropriado como cr&eacute;dito.',
    'art. 48',
    u'Confronto da natureza da opera&ccedil;&atilde;o com a lista de veda&ccedil;&otilde;es.',
    'critica',
    u'Estornar a apropria&ccedil;&atilde;o na compet&ecirc;ncia corrente. Manter &eacute; risco de glosa '
    u'com multa, n&atilde;o apenas de glosa.',
    'dentro')

add('INC-CRE-07', u'Convers&atilde;o para recolhimento assumido sobre d&eacute;bito j&aacute; extinto',
    'financeiro',
    u'O valor pago pelo RAD s&oacute; quita d&eacute;bito n&atilde;o extinto; o excedente vai ao '
    u'fornecedor pelo art. 36, &sect; 3&ordm;.',
    'RN-CRE-18, art. 36 &sect; 3&ordm;',
    u'Valida&ccedil;&atilde;o na a&ccedil;&atilde;o de assumir o recolhimento.',
    'critica',
    u'A a&ccedil;&atilde;o &eacute; bloqueada quando algum RF j&aacute; est&aacute; apropriado ou utilizado. '
    u'Se a guia saiu mesmo assim, o caminho &eacute; a restitui&ccedil;&atilde;o &mdash; fora do produto.',
    'fora')

# ---- DEB -------------------------------------------------------------------
add('INC-DEB-01', u'D&eacute;bito vencido e n&atilde;o extinto', 'financeiro',
    u'O vencimento n&atilde;o extingue: apenas acrescenta multa e juros. O d&eacute;bito segue devido.',
    'RN-DEB-02, RN-DEB-06',
    u'R&eacute;gua de vencimento sobre os registros de sa&iacute;da.',
    'critica',
    u'Recolher com os acr&eacute;scimos. Quanto mais tarde, maior o principal &mdash; '
    u'&eacute; a &uacute;nica ocorr&ecirc;ncia do cat&aacute;logo cujo custo cresce sozinho.',
    'dentro')

add('INC-DEB-02', u'D&eacute;bito extinto sem m&eacute;todo ou data registrados', 'financeiro',
    u'O documento consta extinto e nenhum registro traz o m&eacute;todo ou a data. '
    u'A extin&ccedil;&atilde;o existe no status e n&atilde;o na evid&ecirc;ncia.',
    'RN-DEB-04',
    u'Primeiro valor n&atilde;o vazio entre os registros resulta vazio.',
    'alta',
    u'Recuperar o comprovante na origem. Extin&ccedil;&atilde;o sem evid&ecirc;ncia n&atilde;o sustenta '
    u'o cr&eacute;dito do adquirente numa fiscaliza&ccedil;&atilde;o.',
    'misto')

add('INC-DEB-03', u'Documento de sa&iacute;da sem registro de d&eacute;bito', 'documento',
    u'Documento de sa&iacute;da importado que n&atilde;o gerou registro de d&eacute;bito.',
    'RN-DEB-01, RN-ING-06',
    u'Contagem de registros por DF de sa&iacute;da.',
    'alta',
    u'Reprocessar a ingest&atilde;o. Sa&iacute;da sem d&eacute;bito subdeclara a apura&ccedil;&atilde;o do per&iacute;odo &mdash; '
    u'o erro aparece como saldo a recolher menor do que o devido.',
    'dentro')

add('INC-DEB-04', u'D&eacute;bito retido por inconsist&ecirc;ncia aberta', 'ciclo',
    u'D&eacute;bito com ocorr&ecirc;ncia aberta fica fora da fila de extin&ccedil;&atilde;o. &Eacute; consequ&ecirc;ncia '
    u'desejada, mas cria um estoque que ningu&eacute;m acompanha.',
    'RN-APU-05, D-DB-02',
    u'Cruzamento da fila de extin&ccedil;&atilde;o com ocorr&ecirc;ncias abertas.',
    'alta',
    u'Resolver a ocorr&ecirc;ncia de origem. A reten&ccedil;&atilde;o protege contra extinguir valor '
    u'errado; ela vira problema quando dura mais que o vencimento.',
    'dentro')

# ---- APU -------------------------------------------------------------------
add('INC-APU-01', u'Cr&eacute;dito compensado antes do per&iacute;odo de apropria&ccedil;&atilde;o', 'ciclo',
    u'O cr&eacute;dito s&oacute; compensa a partir do per&iacute;odo em que foi apropriado.',
    'RN-APU-01, art. 47',
    u'Confronto entre a compet&ecirc;ncia de uso e a de apropria&ccedil;&atilde;o.',
    'critica',
    u'Refazer a apura&ccedil;&atilde;o do per&iacute;odo. Se j&aacute; transmitida, a corre&ccedil;&atilde;o &eacute; retificadora.',
    'misto')

add('INC-APU-02', u'Ordem do art. 53 n&atilde;o respeitada', 'ciclo',
    u'A ordem &eacute; saldo vencido, d&eacute;bitos do per&iacute;odo, saldo credor. Fora dela, '
    u'o saldo fecha certo e a composi&ccedil;&atilde;o fica errada.',
    'RN-APU-02, art. 53',
    u'Auditoria da sequ&ecirc;ncia de consumo no motor de apura&ccedil;&atilde;o.',
    'alta',
    u'Reexecutar o motor. O efeito pr&aacute;tico aparece meses depois, quando o vencido '
    u'que deveria ter sido consumido primeiro prescreve.',
    'dentro')

add('INC-APU-03', u'Cr&eacute;dito reservado ainda compensando', 'ressarcimento',
    u'Cr&eacute;dito com inten&ccedil;&atilde;o registrada ou inclu&iacute;do em pedido sai do saldo compens&aacute;vel. '
    u'Compensar e ressarcir o mesmo valor &eacute; pedi-lo duas vezes.',
    'RN-APU-06, RN-RES-11, art. 39',
    u'Cruzamento das marcas de reserva com a base compens&aacute;vel.',
    'critica',
    u'Cancelar a inten&ccedil;&atilde;o ou refazer a compensa&ccedil;&atilde;o. O remanescente volta a '
    u'compensar automaticamente quando o pedido &eacute; parcial ou indeferido (RN-RES-09).',
    'dentro')

add('INC-APU-04', u'Cr&eacute;dito glosado dentro da apura&ccedil;&atilde;o', 'ciclo',
    u'Cr&eacute;dito glosado fica fora da apura&ccedil;&atilde;o enquanto a glosa n&atilde;o for revertida.',
    'RN-APU-07, RN-CRE-02',
    u'Cruzamento do status de glosa com a base compensada.',
    'critica',
    u'Retirar da apura&ccedil;&atilde;o e reprocessar. A revers&atilde;o da glosa recoloca o valor; '
    u'antecip&aacute;-la n&atilde;o.',
    'dentro')

add('INC-APU-05', u'Saldo a recolher coberto por cr&eacute;dito futuro', 'ciclo',
    u'O saldo do per&iacute;odo n&atilde;o espera cr&eacute;dito futuro. Compensar com o que ainda '
    u'vai nascer produz recolhimento a menor.',
    'RN-APU-08, art. 53',
    u'Confronto entre a data de apropria&ccedil;&atilde;o e o fechamento do per&iacute;odo.',
    'critica',
    u'Recolher a diferen&ccedil;a com acr&eacute;scimos e refazer a apura&ccedil;&atilde;o.',
    'misto')

add('INC-APU-06', u'IBS e CBS somados no mesmo saldo', 'ciclo',
    u'Os dois tributos s&atilde;o apurados separadamente e nenhuma ocorr&ecirc;ncia soma os dois.',
    'RN-APU-03, RN-INC-01, RN-RES-01',
    u'Auditoria de agrega&ccedil;&atilde;o por tributo.',
    'critica',
    u'Defeito de engenharia, n&atilde;o de dado. A ocorr&ecirc;ncia existe para barrar regress&atilde;o: '
    u'&eacute; a regra que mais se quebra em refatora&ccedil;&atilde;o.',
    'dentro')

# ---- PAG -------------------------------------------------------------------
add('INC-PAG-01', u'Split de IBS n&atilde;o executado', 'financeiro',
    u'O documento previa reten&ccedil;&atilde;o na liquida&ccedil;&atilde;o e o valor de IBS n&atilde;o foi segregado '
    u'pelo prestador de servi&ccedil;o de pagamento.',
    'RN-CONC-02, art. 31',
    u'Confronto CFIN por aus&ecirc;ncia de reten&ccedil;&atilde;o.',
    'critica',
    u'Cobrar o PSP. Se a liquida&ccedil;&atilde;o j&aacute; ocorreu sem reten&ccedil;&atilde;o, o d&eacute;bito segue com o '
    u'fornecedor &mdash; o PSP n&atilde;o &eacute; respons&aacute;vel tribut&aacute;rio (Decreto 12.955/2026, art. 31, V-b).',
    'fora', 'vivo', 'cfin_ibs_split')

add('INC-PAG-02', u'Split de CBS n&atilde;o executado', 'financeiro',
    u'Mesma falha na parcela federal.',
    'RN-CONC-02, art. 31',
    u'Confronto CFIN por aus&ecirc;ncia de reten&ccedil;&atilde;o.',
    'critica',
    u'Id&ecirc;ntico ao IBS. Falhar nos dois na mesma liquida&ccedil;&atilde;o aponta configura&ccedil;&atilde;o '
    u'do meio de pagamento, n&atilde;o falha pontual.',
    'fora', 'vivo', 'cfin_cbs_split')

add('INC-PAG-03', u'Comprovante de IBS divergente', 'financeiro',
    u'O valor recolhido n&atilde;o corresponde ao devido no registro.',
    'RN-CONC-02, RN-CONC-07',
    u'Confronto CFIN por valor.',
    'critica',
    u'Complementar quando a menor; pedir restitui&ccedil;&atilde;o quando a maior. '
    u'A menor trava a apropria&ccedil;&atilde;o pelo art. 47.',
    'misto', 'vivo', 'cfin_ibs_valor')

add('INC-PAG-04', u'Comprovante de CBS divergente', 'financeiro',
    u'Mesma falha na parcela federal.',
    'RN-CONC-02, RN-CONC-07',
    u'Confronto CFIN por valor.',
    'critica',
    u'Mesmo caminho do IBS, com recolhimento complementar pelo c&oacute;digo de receita 5952.',
    'misto', 'vivo', 'cfin_cbs_valor')

add('INC-PAG-05', u'Guia RAD vencida sem pagamento', 'financeiro',
    u'A guia vence 15 dias depois da data do registro e passou dessa data em aberto.',
    'RN-PAG-09',
    u'R&eacute;gua de vencimento sobre as guias geradas.',
    'critica',
    u'Gerar nova guia com multa e juros. O adquirente que assumiu o recolhimento '
    u'assume tamb&eacute;m os acr&eacute;scimos do atraso que ele pr&oacute;prio causou.',
    'dentro')

add('INC-PAG-06', u'Guia gerada em duplicidade', 'financeiro',
    u'O mesmo registro entrou em dois lotes e saiu em duas guias. Produz cobran&ccedil;a '
    u'em duplicidade.',
    'RN-EXR-02, RN-EXR-03, RN-EXR-05',
    u'Unicidade de guia por registro fiscal.',
    'critica',
    u'Cancelar a segunda guia antes do vencimento. Depois de paga, o caminho &eacute; '
    u'a restitui&ccedil;&atilde;o junto ao &oacute;rg&atilde;o &mdash; a&ccedil;&atilde;o fora do produto.',
    'misto')

add('INC-PAG-07', u'C&oacute;digo de receita incorreto', 'financeiro',
    u'IBS recolhe em 6912 e CBS em 5952. N&atilde;o h&aacute; terceiro caso.',
    'RN-PAG-10',
    u'Confronto do c&oacute;digo com o tributo do registro.',
    'critica',
    u'Recolhimento em c&oacute;digo errado n&atilde;o extingue o d&eacute;bito certo. &Eacute; preciso '
    u'recolher no c&oacute;digo correto e pedir restitui&ccedil;&atilde;o do primeiro.',
    'fora')

add('INC-PAG-08', u'Recebedor incorreto na guia', 'financeiro',
    u'IBS recebe o Comit&ecirc; Gestor; CBS recebe a Receita Federal. S&atilde;o CNPJs distintos '
    u'no comprovante.',
    'RN-PAG-11',
    u'Confronto do recebedor com o tributo do registro.',
    'critica',
    u'Mesmo tratamento do c&oacute;digo de receita: recolher de novo no destino certo '
    u'e pedir restitui&ccedil;&atilde;o.',
    'fora')

add('INC-PAG-09', u'Comprovante sem guia correspondente', 'financeiro',
    u'O ERP enviou comprovante de um recolhimento que a plataforma n&atilde;o gerou.',
    'RN-INT-12',
    u'Confronto do comprovante recebido contra a base de guias.',
    'media',
    u'Vincular manualmente quando o recolhimento for leg&iacute;timo. '
    u'Comprovante rejeitado nunca &eacute; descartado em sil&ecirc;ncio (RN-INT-12).',
    'dentro')

add('INC-PAG-10', u'Recolhimento em duplicidade &mdash; fornecedor e adquirente', 'financeiro',
    u'O fornecedor recolheu e o adquirente tamb&eacute;m emitiu a guia. &Eacute; o risco que o '
    u'aviso do portal existe para evitar.',
    'RN-POR-05, art. 36 &sect; 3&ordm;, II',
    u'Confronto entre comprovante do fornecedor e guia do adquirente no mesmo registro.',
    'critica',
    u'Um dos dois pede restitui&ccedil;&atilde;o. O contorno real &eacute; preventivo: o aviso ao '
    u'fornecedor sai cerca de doze minutos depois do pagamento da guia (RN-PAG-16).',
    'fora')

add('INC-PAG-11', u'Registro RAD sem guia e sem comprovante', 'financeiro',
    u'Registro de m&eacute;todo RAD que atravessou o per&iacute;odo sem guia gerada. '
    u'N&atilde;o se confunde com recolhimento assumido, que aguarda guia (RN-CRE-21).',
    'RN-PAG-08, RN-CRE-21',
    u'Bucketing de pagamentos: pendente que n&atilde;o virou guia.',
    'alta',
    u'Gerar a guia. Se o registro estava retido por marca de risco, resolver a marca '
    u'devolve o registro ao lote (RN-EXR-09).',
    'dentro')

# ---- EXR -------------------------------------------------------------------
add('INC-EXR-01', u'Registro retido por marca de risco', 'financeiro',
    u'A nota foi separada do lote por uma marca de risco e est&aacute; fora da gera&ccedil;&atilde;o '
    u'autom&aacute;tica at&eacute; a causa ser resolvida.',
    'RN-EXR-09',
    u'Fila de retidos da pol&iacute;tica, com o motivo.',
    'alta',
    u'Resolver a marca de origem. O registro volta ao pool sozinho &mdash; '
    u'descart&aacute;-lo esconderia cr&eacute;dito em risco.',
    'dentro')

add('INC-EXR-02', u'Sobreposi&ccedil;&atilde;o entre pol&iacute;ticas de modelos diferentes', 'financeiro',
    u'Uma pol&iacute;tica por CNPJ e outra por faixa de valor alcan&ccedil;am o mesmo registro. '
    u'N&atilde;o d&aacute; para decidir no salvamento; s&oacute; se mede sobre registros concretos.',
    'RN-EXR-06, RN-EXR-07',
    u'Medi&ccedil;&atilde;o de interse&ccedil;&atilde;o sobre os registros do per&iacute;odo.',
    'alta',
    u'Ajustar o escopo de uma das duas. A listagem nomeia o par &mdash; '
    u'a decis&atilde;o de qual ajustar &eacute; do time fiscal.',
    'dentro')

add('INC-EXR-03', u'Pol&iacute;tica ativa sem conex&atilde;o de destino', 'integracao',
    u'A pol&iacute;tica gera a guia e a mant&eacute;m na plataforma. A gera&ccedil;&atilde;o tem valor; '
    u'o que n&atilde;o se pode &eacute; fingir que entregou.',
    'RN-EXR-12',
    u'Aus&ecirc;ncia de conex&atilde;o <code>rad_erp</code> vinculada &agrave; pol&iacute;tica ativa.',
    'media',
    u'Vincular a conex&atilde;o ou baixar as guias manualmente. '
    u'O risco &eacute; o ERP n&atilde;o saber que a guia existe.',
    'dentro')

add('INC-EXR-04', u'Pol&iacute;tica apontando para conex&atilde;o desativada', 'integracao',
    u'A conex&atilde;o foi desativada e a pol&iacute;tica continua ativa. A entrega das guias '
    u'daquelas pol&iacute;ticas est&aacute; interrompida.',
    'RN-INT-10, RN-EXR-11',
    u'Confronto entre o estado da conex&atilde;o e as pol&iacute;ticas que a usam.',
    'alta',
    u'Reativar a conex&atilde;o ou repontar a pol&iacute;tica. A desativa&ccedil;&atilde;o pede confirma&ccedil;&atilde;o '
    u'nomeando o impacto &mdash; a ocorr&ecirc;ncia cobre quem confirmou e n&atilde;o voltou.',
    'dentro')

# ---- RES -------------------------------------------------------------------
add('INC-RES-01', u'Inten&ccedil;&atilde;o registrada sem pedido no prazo', 'ressarcimento',
    u'A inten&ccedil;&atilde;o trava o cr&eacute;dito em M+1 e o pedido n&atilde;o foi protocolado at&eacute; o '
    u'&uacute;ltimo dia &uacute;til do m&ecirc;s seguinte.',
    'RN-RES-03, RN-RES-04',
    u'R&eacute;gua de prazo sobre as inten&ccedil;&otilde;es abertas.',
    'alta',
    u'Protocolar o pedido ou cancelar a inten&ccedil;&atilde;o. Inten&ccedil;&atilde;o vencida devolve '
    u'o remanescente &agrave; compensa&ccedil;&atilde;o (RN-RES-09) &mdash; mas s&oacute; depois de vencer.',
    'dentro', 'vivo', 'res_intencao_sem_pedido')

add('INC-RES-02', u'Saldo do pedido divergente do saldo credor', 'ressarcimento',
    u'O valor pedido n&atilde;o corresponde ao saldo apropriado, n&atilde;o utilizado e sem veda&ccedil;&atilde;o.',
    'RN-RES-02, RN-RES-11',
    u'Confronto do valor bloqueado com a base ressarc&iacute;vel.',
    'alta',
    u'Retificar o pedido antes da decis&atilde;o. Depois dela, a diferen&ccedil;a vira '
    u'indeferimento parcial.',
    'misto', 'vivo', 'res_saldo_divergente')

add('INC-RES-03', u'Pedido indeferido', 'ressarcimento',
    u'O &oacute;rg&atilde;o recusou o ressarcimento, total ou parcialmente.',
    'RN-RES-09',
    u'Retorno da decis&atilde;o.',
    'alta',
    u'O remanescente volta a compensar automaticamente. A contesta&ccedil;&atilde;o do '
    u'indeferimento &eacute; processo administrativo, fora do produto.',
    'fora', 'vivo', 'res_pedido_indeferido')

add('INC-RES-04', u'Pagamento do ressarcimento divergente', 'ressarcimento',
    u'O valor recebido n&atilde;o bate com o deferido, ou chegou sem a corre&ccedil;&atilde;o devida.',
    'RN-RES-07',
    u'Confronto do cr&eacute;dito em conta com o valor deferido mais corre&ccedil;&atilde;o.',
    'alta',
    u'Conferir a Selic aplicada a partir do segundo m&ecirc;s mais 1%. '
    u'Diferen&ccedil;a de corre&ccedil;&atilde;o &eacute; pedido administrativo, n&atilde;o ajuste interno.',
    'misto', 'vivo', 'res_pagamento_divergente')

add('INC-RES-05', u'Impedimento do art. 486 no IBS', 'ressarcimento',
    u'O contribuinte incorre em um dos impedimentos que barram o ressarcimento do IBS.',
    'RN-RES-08, art. 486',
    u'Alerta na abertura do pedido de IBS.',
    'alta',
    u'Regularizar o impedimento antes de pedir. Pedir com impedimento ativo '
    u'consome o prazo sem chance de deferimento.',
    'fora', 'vivo', 'res_impedimento_ibs')

add('INC-RES-06', u'Prazo de an&aacute;lise vencido sem manifesta&ccedil;&atilde;o', 'ressarcimento',
    u'Passaram 30, 60 ou 180 dias conforme o caso e o &oacute;rg&atilde;o n&atilde;o se manifestou. '
    u'Sem manifesta&ccedil;&atilde;o, o pagamento &eacute; devido em 15 dias.',
    'RN-RES-05, RN-RES-06',
    u'R&eacute;gua de prazo sobre os pedidos protocolados.',
    'alta',
    u'Cobrar o pagamento pelos 15 dias. Fiscaliza&ccedil;&atilde;o suspende o prazo por at&eacute; '
    u'360 dias &mdash; a ocorr&ecirc;ncia precisa distinguir sil&ecirc;ncio de suspens&atilde;o.',
    'fora')

add('INC-RES-07', u'Cr&eacute;dito ressarcido abatendo d&eacute;bito na apura&ccedil;&atilde;o', 'ressarcimento',
    u'Ressarcimento n&atilde;o &eacute; compensa&ccedil;&atilde;o: o valor recebido em dinheiro n&atilde;o abate '
    u'd&eacute;bito.',
    'RN-RES-12',
    u'Cruzamento dos pedidos pagos com a base compensada.',
    'critica',
    u'Refazer a apura&ccedil;&atilde;o. &Eacute; a mesma falha do INC-APU-03 no outro extremo do '
    u'ciclo &mdash; o valor foi aproveitado duas vezes.',
    'dentro')

# ---- INT -------------------------------------------------------------------
add('INC-INT-01', u'Falha de entrega ao ERP ap&oacute;s esgotada a retentativa', 'integracao',
    u'O evento n&atilde;o chegou ao sistema do cliente e a pol&iacute;tica de retentativa terminou. '
    u'Antes disso n&atilde;o vira ocorr&ecirc;ncia.',
    'RN-INC-08, RN-INT-11',
    u'Fim da fila de retentativa sem <code>200 OK</code>.',
    'alta',
    u'Time t&eacute;cnico, do lado do cliente ou do SplitHub. Prazo sugerido de 1 dia &uacute;til &mdash; '
    u'&eacute; a fam&iacute;lia com o menor prazo do cat&aacute;logo.',
    'misto', 'vivo', 'integracao_erp')

add('INC-INT-02', u'Credencial rotacionada com janela vencida', 'integracao',
    u'A rota&ccedil;&atilde;o mant&eacute;m o segredo anterior aceito por 24 horas. Passada a janela, '
    u'o ERP que n&atilde;o trocou para de autenticar.',
    'RN-INT-03',
    u'Erros de autentica&ccedil;&atilde;o concentrados ap&oacute;s uma rota&ccedil;&atilde;o.',
    'alta',
    u'Atualizar o segredo no ERP. O segredo n&atilde;o &eacute; recuper&aacute;vel (RN-INT-02): '
    u'perdido o valor, a sa&iacute;da &eacute; nova rota&ccedil;&atilde;o.',
    'misto')

add('INC-INT-03', u'Chamada fora do escopo declarado', 'integracao',
    u'O ERP chama um endpoint que a conex&atilde;o n&atilde;o autoriza e recebe <code>403</code>.',
    'RN-INT-05',
    u'Concentra&ccedil;&atilde;o de <code>403</code> na mesma conex&atilde;o.',
    'media',
    u'Ampliar o escopo da conex&atilde;o, se leg&iacute;timo, ou corrigir o ERP. '
    u'Escopo s&oacute; vale se for aplicado &mdash; ampliar por conveni&ecirc;ncia anula a prote&ccedil;&atilde;o.',
    'misto')

add('INC-INT-04', u'Credencial de sandbox em uso produtivo', 'integracao',
    u'Chave com prefixo <code>test</code> chamando o ambiente de produ&ccedil;&atilde;o, ou o inverso.',
    'RN-INT-04',
    u'Confronto do prefixo da credencial com o ambiente de origem.',
    'critica',
    u'Trocar a credencial imediatamente. O prefixo &eacute; a &uacute;ltima defesa contra usar '
    u'a chave errada &mdash; se ele foi acionado, tudo antes falhou.',
    'misto')

add('INC-INT-05', u'Conex&atilde;o sem tr&aacute;fego', 'integracao',
    u'Aus&ecirc;ncia de tr&aacute;fego n&atilde;o &eacute; estado de falha: integra&ccedil;&atilde;o ociosa e morta '
    u'chegam id&ecirc;nticas ao painel.',
    'RN-INT-08',
    u'Janela sem chamadas em conex&atilde;o ativa.',
    'baixa',
    u'Sondar a conex&atilde;o, quando o tipo permitir (RN-INT-07). '
    u'A ocorr&ecirc;ncia &eacute; um convite a conferir, n&atilde;o um diagn&oacute;stico.',
    'dentro')

add('INC-INT-06', u'Comprovante rejeitado na entrada', 'integracao',
    u'O ERP enviou comprovante que a valida&ccedil;&atilde;o recusou. O ERP acharia que pagou '
    u'e o SplitHub n&atilde;o teria registro.',
    'RN-INT-12',
    u'Recusa na rota de comprovantes.',
    'alta',
    u'Corrigir e reenviar. O comprovante rejeitado fica vis&iacute;vel com o motivo &mdash; '
    u'nunca &eacute; descartado em sil&ecirc;ncio.',
    'misto')

# ---- AUT -------------------------------------------------------------------
add('INC-AUT-01', u'R&eacute;gua disparando sobre registro j&aacute; resolvido', 'integracao',
    u'A condi&ccedil;&atilde;o da etapa deveria filtrar o disparo; a cobran&ccedil;a saiu para quem '
    u'j&aacute; pagou. O texto sai em nome da organiza&ccedil;&atilde;o e chega a terceiro.',
    'RN-AUT-06, RN-AUT-08',
    u'Confronto do envio com o estado do registro no momento do disparo.',
    'alta',
    u'Corrigir a condi&ccedil;&atilde;o da etapa. O dano &eacute; reputacional e imediato &mdash; '
    u'n&atilde;o h&aacute; como recolher a mensagem enviada.',
    'dentro')

add('INC-AUT-02', u'Teto de envios excedido', 'integracao',
    u'O teto vale por registro, n&atilde;o por fornecedor. Estourar significa mesma '
    u'cobran&ccedil;a repetida al&eacute;m do configurado.',
    'RN-AUT-05',
    u'Contagem de envios por registro contra <code>maxEnvios</code>.',
    'media',
    u'Revisar a r&eacute;gua. O teto existe para n&atilde;o transformar cobran&ccedil;a em ass&eacute;dio.',
    'dentro')

add('INC-AUT-03', u'R&eacute;gua pr&eacute;-vencimento sem escalada', 'integracao',
    u'A &uacute;ltima etapa da r&eacute;gua pr&eacute; deve escalar para a p&oacute;s. Sem isso, '
    u'o registro vence e ningu&eacute;m &eacute; avisado.',
    'RN-AUT-03, RN-AUT-04',
    u'Auditoria da configura&ccedil;&atilde;o da r&eacute;gua.',
    'media',
    u'Ligar a escalada. &Eacute; falha de configura&ccedil;&atilde;o que s&oacute; aparece no dia do vencimento.',
    'dentro')

add('INC-AUT-04', u'Par&acirc;metro alterado sem justificativa na trilha', 'integracao',
    u'Altera&ccedil;&atilde;o de par&acirc;metro de r&eacute;gua exige justificativa. A regra est&aacute; declarada '
    u'e n&atilde;o &eacute; aplicada pelo produto hoje.',
    'RN-AUT-07',
    u'Trilha de auditoria com justificativa vazia.',
    'baixa',
    u'Registrar a justificativa retroativamente. A aus&ecirc;ncia n&atilde;o afeta apura&ccedil;&atilde;o &mdash; '
    u'afeta a defesa numa auditoria.',
    'dentro')

# ---- POR -------------------------------------------------------------------
add('INC-POR-01', u'Documento vis&iacute;vel a acesso sem v&iacute;nculo', 'cadastro',
    u'Um acesso enxergou documento de CNPJ a que n&atilde;o est&aacute; vinculado. '
    u'A filtragem &eacute; do servidor, nunca da tela.',
    'RN-POR-01, RN-POR-06',
    u'Auditoria de leitura contra os v&iacute;nculos do acesso.',
    'critica',
    u'Incidente de isolamento: revogar o acesso, apurar o alcance e notificar. '
    u'N&atilde;o &eacute; ocorr&ecirc;ncia fiscal &mdash; escala para seguran&ccedil;a, n&atilde;o para o fiscal.',
    'dentro')

add('INC-POR-02', u'Comprovante enviado por acesso revogado', 'cadastro',
    u'O acesso foi revogado e um envio chegou depois. O acesso revogado n&atilde;o '
    u'&eacute; apagado, para preservar a autoria dos envios anteriores.',
    'RN-FORN-10, RN-POR-03',
    u'Confronto da data do envio com a data da revoga&ccedil;&atilde;o.',
    'alta',
    u'Conferir a validade do comprovante antes de aceitar. A revoga&ccedil;&atilde;o &eacute; ato do '
    u'adquirente; envio posterior indica sess&atilde;o que sobreviveu &agrave; revoga&ccedil;&atilde;o.',
    'dentro')

# ---------------------------------------------------------------- render ----


def chip(txt, cor):
    return (u'<span class="tag" style="background:color-mix(in srgb, var(%s) 12%%, transparent);'
            u'color:var(%s)">%s</span>' % (cor, cor, txt))


def linha(e):
    fl, fnome, fcor, _, _ = FAMILIAS[e['fam']]
    ct, ccor = CRIT[e['crit']]
    ot, ocor = ONDE[e['onde']]
    est = (u'<span class="tag ok">no produto</span>' if e['estado'] == 'vivo'
           else u'<span class="tag pend">proposta</span>')
    ch = (u'<br><code>%s</code>' % e['chave']) if e['chave'] else ''
    return (u'''      <tr id="%(cod)s">
        <td class="mono"><strong>%(cod)s</strong>%(ch)s</td>
        <td><strong>%(titulo)s</strong><div class="cel-sub">%(gatilho)s</div>
            <div class="cel-reg">%(regra)s</div></td>
        <td>%(fam)s</td>
        <td>%(crit)s</td>
        <td>%(deteccao)s</td>
        <td>%(contorno)s<div class="cel-onde">%(onde)s</div></td>
        <td>%(est)s</td>
      </tr>
''' % dict(cod=e['cod'], ch=ch, titulo=e['titulo'], gatilho=e['gatilho'],
           regra=e['regra'], fam=chip(u'%s &middot; %s' % (fl, fnome), fcor),
           crit=chip(ct, ccor), deteccao=e['deteccao'], contorno=e['contorno'],
           onde=chip(ot, ocor), est=est))


def bloco(mod):
    ch, titulo, prd, abertura = mod
    itens = [e for e in C if e['cod'].split('-')[1] == ch]
    if not itens:
        return ''
    vivos = sum(1 for e in itens if e['estado'] == 'vivo')
    o = [u'<h3 id="m-%s">%s</h3>' % (ch.lower(), titulo)]
    o.append(u'<p>%s</p>' % abertura)
    o.append(u'<p class="cel-reg">%d ocorr&ecirc;ncias &middot; %d no produto hoje &middot; '
             u'%d propostas &middot; <a href="%s">PRD do m&oacute;dulo</a></p>'
             % (len(itens), vivos, len(itens) - vivos, prd))
    o.append(u'<div class="table-wrap"><table class="tbl-cat"><thead><tr>'
             u'<th>C&oacute;digo</th><th>Ocorr&ecirc;ncia e gatilho</th><th>Fam&iacute;lia</th>'
             u'<th>Criticidade</th><th>Como o produto percebe</th>'
             u'<th>Contorno sugerido</th><th>Estado</th>'
             u'</tr></thead><tbody>')
    o.extend(linha(e) for e in itens)
    o.append(u'</tbody></table></div>')
    return '\n'.join(o)


def placar():
    tot = len(C)
    vivos = sum(1 for e in C if e['estado'] == 'vivo')
    por_crit = {}
    por_onde = {}
    por_fam = {}
    for e in C:
        por_crit[e['crit']] = por_crit.get(e['crit'], 0) + 1
        por_onde[e['onde']] = por_onde.get(e['onde'], 0) + 1
        por_fam[e['fam']] = por_fam.get(e['fam'], 0) + 1
    return tot, vivos, por_crit, por_onde, por_fam


TOT, VIVOS, POR_CRIT, POR_ONDE, POR_FAM = placar()
PROP = TOT - VIVOS

CSS = u'''
:root {
  --bg: #F7F8FA; --sur: #FFFFFF; --sur2: #F0F2F6; --sur3: #E8EBF2; --brd: #DDE1EA;
  --txt1: #131720; --txt2: #4A5568; --txt3: #8A92A3;
  --teal: #0E9E8E; --teal-d: rgba(14,158,142,.1);
  --blue: #1D5FCC; --blue-d: rgba(29,95,204,.08);
  --red: #D63A49; --red-d: rgba(214,58,73,.08);
  --amber: #B97A10; --amber-d: rgba(185,122,16,.08);
  --green: #1A7940; --green-d: rgba(26,121,64,.08);
  --purple: #6B3FA0; --purple-d: rgba(107,63,160,.08);
  --gray: #6B7280; --gray-d: rgba(107,114,128,.08);
  --mono: #EDF0F5;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #0D1117; --sur: #161C25; --sur2: #1E2533; --sur3: #232C3D; --brd: #262E3F;
    --txt1: #E4E8EF; --txt2: #8A99B4; --txt3: #4F5B73;
    --teal: #1FBAAA; --teal-d: rgba(31,186,170,.12);
    --blue: #4D9FFF; --blue-d: rgba(77,159,255,.1);
    --red: #F04B5C; --red-d: rgba(240,75,92,.1);
    --amber: #F59E0B; --amber-d: rgba(245,158,11,.1);
    --green: #22C55E; --green-d: rgba(34,197,94,.1);
    --purple: #A78BFA; --purple-d: rgba(167,139,250,.1);
    --gray: #9CA3AF; --gray-d: rgba(156,163,175,.1);
    --mono: #1A2030;
  }
}
:root[data-theme="dark"] {
  --bg: #0D1117; --sur: #161C25; --sur2: #1E2533; --sur3: #232C3D; --brd: #262E3F;
  --txt1: #E4E8EF; --txt2: #8A99B4; --txt3: #4F5B73;
  --teal: #1FBAAA; --teal-d: rgba(31,186,170,.12);
  --blue: #4D9FFF; --blue-d: rgba(77,159,255,.1);
  --red: #F04B5C; --red-d: rgba(240,75,92,.1);
  --amber: #F59E0B; --amber-d: rgba(245,158,11,.1);
  --green: #22C55E; --green-d: rgba(34,197,94,.1);
  --purple: #A78BFA; --purple-d: rgba(167,139,250,.1);
  --gray: #9CA3AF; --gray-d: rgba(156,163,175,.1);
  --mono: #1A2030;
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { background: var(--bg); color: var(--txt1); font: 14px/1.65 'Inter', system-ui, sans-serif; padding: 40px 20px 80px; }
.doc { max-width: 1240px; margin: 0 auto; }
.back { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--txt3); text-decoration: none; margin-bottom: 28px; }
.back:hover { color: var(--teal); }
.eyebrow { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: var(--teal); margin-bottom: 10px; }
h1 { font-size: 29px; font-weight: 800; line-height: 1.16; margin-bottom: 8px; text-wrap: balance; }
.subtitle { font-size: 14.5px; color: var(--txt2); margin-bottom: 24px; max-width: 840px; }
.meta-bar { display: flex; flex-wrap: wrap; gap: 10px 18px; padding: 14px 18px; background: var(--sur); border: 1px solid var(--brd); border-radius: 8px; margin-bottom: 20px; align-items: center; }
.meta-pill { display: flex; align-items: center; gap: 5px; font-size: 11px; }
.meta-label { color: var(--txt3); font-weight: 500; }
.meta-val { color: var(--txt1); font-weight: 700; }

.toc { background: var(--sur); border: 1px solid var(--brd); border-radius: 8px; padding: 18px 22px; margin-bottom: 40px; }
.toc-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--txt3); margin-bottom: 12px; }
.toc-list { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; list-style: none; }
@media (max-width: 620px) { .toc-list { grid-template-columns: 1fr; } }
.toc-list a { font-size: 12.5px; color: var(--txt2); text-decoration: none; display: flex; gap: 8px; }
.toc-list a:hover { color: var(--teal); }
.toc-num { color: var(--txt3); font-family: 'JetBrains Mono', monospace; font-size: 11px; flex-shrink: 0; }

.section { margin-bottom: 52px; scroll-margin-top: 20px; }
.sec-hdr { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; padding-bottom: 10px; border-bottom: 2px solid var(--brd); }
.sec-num { font-size: 11px; font-weight: 700; color: var(--teal); background: var(--teal-d); border-radius: 4px; padding: 2px 7px; font-family: 'JetBrains Mono', monospace; }
.sec-title { font-size: 18px; font-weight: 700; color: var(--txt1); }
h3 { font-size: 15px; font-weight: 700; color: var(--txt1); margin: 34px 0 8px; scroll-margin-top: 20px; }
p { font-size: 13px; color: var(--txt2); margin-bottom: 10px; }
p strong { color: var(--txt1); }
a { color: var(--teal); }
ul.plain { list-style: none; display: flex; flex-direction: column; gap: 7px; margin: 10px 0; }
ul.plain li { font-size: 13px; color: var(--txt2); display: flex; align-items: baseline; gap: 8px; }
ul.plain li::before { content: "\\00B7"; color: var(--teal); font-weight: 900; flex-shrink: 0; }
ul.plain li strong { color: var(--txt1); }

.callout { border-radius: 8px; padding: 14px 18px; margin: 14px 0; border-left: 3px solid; }
.callout.warn { background: var(--amber-d); border-color: var(--amber); }
.callout.warn .ct { color: var(--amber); }
.callout.info { background: var(--blue-d); border-color: var(--blue); }
.callout.info .ct { color: var(--blue); }
.callout.ok { background: var(--green-d); border-color: var(--green); }
.callout.ok .ct { color: var(--green); }
.callout.red { background: var(--red-d); border-color: var(--red); }
.callout.red .ct { color: var(--red); }
.ct { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 5px; }
.callout p:last-child { margin-bottom: 0; }

.table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; margin: 14px 0; border-radius: 8px; border: 1px solid var(--brd); }
table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
thead tr { background: var(--sur2); }
th { padding: 9px 13px; text-align: left; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--txt2); border-bottom: 1px solid var(--brd); white-space: nowrap; }
td { padding: 11px 13px; border-bottom: 1px solid var(--brd); color: var(--txt2); vertical-align: top; }
tbody tr:last-child td { border-bottom: none; }
tbody tr:hover { background: var(--sur2); }
tbody tr:target { background: var(--teal-d); }
td strong { color: var(--txt1); font-weight: 600; }
td code, th code, p code, li code { background: var(--mono); border-radius: 3px; padding: 1px 5px; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--blue); }
td.mono { font-family: 'JetBrains Mono', monospace; font-size: 11px; white-space: nowrap; }
.cel-sub { font-size: 12px; color: var(--txt2); margin-top: 4px; font-weight: 400; }
/* o catalogo tem sete colunas de texto: abaixo de ~1080px ele rola em vez de espremer */
.tbl-cat { min-width: 1080px; }
.tbl-cat th:nth-child(2), .tbl-cat td:nth-child(2) { min-width: 320px; }
.tbl-cat th:nth-child(5), .tbl-cat td:nth-child(5) { min-width: 170px; }
.tbl-cat th:nth-child(6), .tbl-cat td:nth-child(6) { min-width: 280px; }
.cel-reg { font-size: 11px; color: var(--txt3); margin-top: 5px; font-family: 'JetBrains Mono', monospace; }
.cel-onde { margin-top: 6px; }
.tag { display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; white-space: nowrap; }
.tag.ok { background: var(--green-d); color: var(--green); }
.tag.pend { background: var(--amber-d); color: var(--amber); }

.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; margin: 16px 0; }
.kpi { background: var(--sur); border: 1px solid var(--brd); border-radius: 8px; padding: 14px 16px; }
.kpi-n { font-size: 26px; font-weight: 800; color: var(--txt1); font-variant-numeric: tabular-nums; line-height: 1.1; }
.kpi-l { font-size: 11px; color: var(--txt3); font-weight: 600; text-transform: uppercase; letter-spacing: .05em; margin-top: 4px; }
.kpi-d { font-size: 12px; color: var(--txt2); margin-top: 6px; }

.bar-row { display: grid; grid-template-columns: 170px 1fr 52px; gap: 12px; align-items: center; margin-bottom: 7px; font-size: 12px; }
.bar-lab { color: var(--txt2); font-weight: 600; }
.bar-track { background: var(--sur3); border-radius: 4px; height: 16px; overflow: hidden; }
.bar-fill { height: 100%; border-radius: 4px; }
.bar-val { text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 11.5px; color: var(--txt2); font-variant-numeric: tabular-nums; }
@media (max-width: 620px) { .bar-row { grid-template-columns: 110px 1fr 44px; } }

.flow { display: flex; flex-wrap: wrap; align-items: stretch; gap: 8px; margin: 16px 0; }
.flow-step { flex: 1 1 150px; background: var(--sur); border: 1px solid var(--brd); border-left: 3px solid var(--teal); border-radius: 6px; padding: 11px 13px; }
.flow-k { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--teal); }
.flow-t { font-size: 12.5px; font-weight: 700; color: var(--txt1); margin-top: 3px; }
.flow-d { font-size: 11.5px; color: var(--txt2); margin-top: 4px; }
'''

TOC = [
    ('01', u'Por que este cat&aacute;logo existe', 's01'),
    ('02', u'Taxonomia: as fam&iacute;lias', 's02'),
    ('03', u'A r&eacute;gua de criticidade', 's03'),
    ('04', u'A fronteira: o que n&atilde;o vira ocorr&ecirc;ncia', 's04'),
    ('05', u'Cat&aacute;logo por m&oacute;dulo', 's05'),
    ('06', u'Eventos fiscais', 's06'),
    ('07', u'Placar: cobertura e distribui&ccedil;&atilde;o', 's07'),
    ('08', u'Onde cada ocorr&ecirc;ncia se resolve', 's08'),
    ('09', u'Decis&otilde;es em aberto', 's09'),
    ('10', u'Como manter este cat&aacute;logo', 's10'),
]


def barras(dic, mapa, ordem):
    o = []
    mx = max(dic.values()) if dic else 1
    for k in ordem:
        if k not in dic:
            continue
        rot, cor = mapa[k]
        pct = int(round(dic[k] * 100.0 / mx))
        o.append(u'<div class="bar-row"><div class="bar-lab">%s</div>'
                 u'<div class="bar-track"><div class="bar-fill" style="width:%d%%;background:var(%s)"></div></div>'
                 u'<div class="bar-val">%d</div></div>' % (rot, pct, cor, dic[k]))
    return '\n'.join(o)


FAM_CURTO = {
    'documento': 'Documento', 'cadastro': 'Cadastro', 'fg': 'Fato gerador',
    'fisco': 'Fisco', 'ciclo': 'Ciclo', 'financeiro': 'Recolhimento',
    'ressarcimento': 'Ressarcimento', 'integracao': u'Integra&ccedil;&atilde;o',
}
FAM_MAPA = dict((k, (u'%s &middot; %s' % (FAMILIAS[k][0], FAM_CURTO[k]), FAMILIAS[k][2]))
                for k in FAMILIAS)

HTML = u'''<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Cat&aacute;logo de inconsist&ecirc;ncias</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap">
<style>%(css)s</style>
</head>
<body>
<div class="doc">
<a class="back" href="prds.html">&larr; Hub de PRDs</a>
<div class="eyebrow">M&oacute;dulo de Inconsist&ecirc;ncias &middot; documento de apoio</div>
<h1>Cat&aacute;logo de inconsist&ecirc;ncias poss&iacute;veis</h1>
<p class="subtitle">Todas as ocorr&ecirc;ncias que o fluxo do SplitHub pode produzir, lidas uma a uma
nas regras de neg&oacute;cio dos dezenove PRDs vivos. Cada uma com o gatilho que a cria, a fam&iacute;lia a
que pertence, a criticidade sugerida, o contorno e o lugar onde a a&ccedil;&atilde;o de resolu&ccedil;&atilde;o
acontece &mdash; que nem sempre &eacute; dentro do produto.</p>

<div class="meta-bar">
  <div class="meta-pill"><span class="meta-label">Vers&atilde;o</span><span class="meta-val">v%(versao)s</span></div>
  <div class="meta-pill"><span class="meta-label">Data</span><span class="meta-val">%(data)s</span></div>
  <div class="meta-pill"><span class="meta-label">Ocorr&ecirc;ncias</span><span class="meta-val">%(tot)d</span></div>
  <div class="meta-pill"><span class="meta-label">No produto hoje</span><span class="meta-val">%(vivos)d</span></div>
  <div class="meta-pill"><span class="meta-label">Propostas</span><span class="meta-val">%(prop)d</span></div>
  <div class="meta-pill"><span class="meta-label">PRDs lidos</span><span class="meta-val">19</span></div>
</div>

<div class="toc">
  <div class="toc-title">Neste documento</div>
  <ul class="toc-list">%(toc)s</ul>
</div>

<div class="section" id="s01">
  <div class="sec-hdr"><span class="sec-num">01</span><span class="sec-title">Por que este cat&aacute;logo existe</span></div>
  <p>O m&oacute;dulo de Inconsist&ecirc;ncias tem hoje <strong>%(vivos)d tipos</strong> em
  <code>src/js/inc-catalogo.js</code>, e esses tipos chegaram l&aacute; por acr&eacute;scimo: cada m&oacute;dulo
  que precisou abrir uma ocorr&ecirc;ncia inventou o seu r&oacute;tulo. O resultado &eacute; um cat&aacute;logo que
  descreve bem o que a base sint&eacute;tica produz e mal o que a aplica&ccedil;&atilde;o pode produzir.</p>
  <p>Este documento faz o caminho inverso. Partiu das <strong>regras de neg&oacute;cio dos dezenove
  PRDs vivos</strong> e perguntou, regra a regra: <em>o que acontece quando esta regra &eacute;
  violada?</em> Quando a resposta foi &ldquo;o produto barra na entrada&rdquo;, a regra virou uma
  valida&ccedil;&atilde;o &mdash; e est&aacute; na se&ccedil;&atilde;o 04. Quando foi &ldquo;o dado entra errado e algu&eacute;m
  precisa resolver&rdquo;, virou uma linha do cat&aacute;logo.</p>
  <p>O resultado s&atilde;o <strong>%(tot)d ocorr&ecirc;ncias</strong>, das quais %(vivos)d j&aacute; existem no
  produto e <strong>%(prop)d s&atilde;o propostas</strong>. Nenhuma das propostas &eacute; especula&ccedil;&atilde;o:
  cada uma cita a regra que a sustenta.</p>
  <div class="callout info">
    <div class="ct">O crit&eacute;rio que ordena tudo</div>
    <p>A pergunta que classifica cada ocorr&ecirc;ncia &eacute; sempre a mesma: <strong>quanto isso amea&ccedil;a a
    apropria&ccedil;&atilde;o do cr&eacute;dito de IBS e CBS?</strong> &Eacute; o que separa uma diverg&ecirc;ncia de
    al&iacute;quota &mdash; cr&iacute;tica, porque o Fisco glosa &mdash; de uma conex&atilde;o sem tr&aacute;fego &mdash;
    baixa, porque ningu&eacute;m perde dinheiro enquanto ela dorme.</p>
  </div>
</div>

<div class="section" id="s02">
  <div class="sec-hdr"><span class="sec-num">02</span><span class="sec-title">Taxonomia: as fam&iacute;lias</span></div>
  <p>A fam&iacute;lia responde <strong>de onde a falha veio</strong>, e por consequ&ecirc;ncia quem a resolve.
  Seis fam&iacute;lias j&aacute; existem no produto. A leitura dos PRDs mostrou duas lacunas, propostas aqui.</p>
  <div class="table-wrap"><table><thead><tr>
    <th>Letra</th><th>Fam&iacute;lia</th><th>O que re&uacute;ne</th><th>Ocorr&ecirc;ncias</th><th>Estado</th>
  </tr></thead><tbody>%(famtab)s</tbody></table></div>
  <div class="callout warn">
    <div class="ct">Duas fam&iacute;lias novas, e por qu&ecirc;</div>
    <p><strong>G &mdash; Cadastro e v&iacute;nculo</strong> re&uacute;ne %(g)d ocorr&ecirc;ncias que hoje n&atilde;o t&ecirc;m
    onde morar. O documento chega perfeito e mesmo assim n&atilde;o produz cr&eacute;dito, porque o
    estabelecimento n&atilde;o est&aacute; cadastrado, o contrato venceu ou duas vig&ecirc;ncias se sobrep&otilde;em.
    N&atilde;o &eacute; falha de documento &mdash; for&ccedil;&aacute;-las na fam&iacute;lia A faria o time fiscal procurar
    o erro no XML, onde ele n&atilde;o est&aacute;.</p>
    <p><strong>H &mdash; Fato gerador e compet&ecirc;ncia</strong> re&uacute;ne %(h)d ocorr&ecirc;ncias de data.
    Elas se disfar&ccedil;am de diverg&ecirc;ncia de valor no confronto com o &oacute;rg&atilde;o: o documento aparece
    na apura&ccedil;&atilde;o de outro m&ecirc;s, e o operador procura a diferen&ccedil;a de reais que n&atilde;o existe.
    Separar a fam&iacute;lia &eacute; o que faz o diagn&oacute;stico certo aparecer no lugar certo.</p>
  </div>
</div>

<div class="section" id="s03">
  <div class="sec-hdr"><span class="sec-num">03</span><span class="sec-title">A r&eacute;gua de criticidade</span></div>
  <p>A criticidade da tabela &eacute; a <strong>criticidade de tipo</strong>: o quanto aquela esp&eacute;cie de
  falha amea&ccedil;a a apropria&ccedil;&atilde;o, independentemente do valor envolvido. &Eacute; diferente da
  <strong>prioridade da ocorr&ecirc;ncia concreta</strong>, que o produto calcula somando valor em risco
  e prazo corrente, e que nunca &eacute; digitada pelo usu&aacute;rio (RN-INC-03).</p>
  <div class="callout info">
    <div class="ct">Como as duas se combinam</div>
    <p>A criticidade de tipo &eacute; o <strong>piso</strong>. Uma ocorr&ecirc;ncia de tipo cr&iacute;tico nunca
    entra na fila abaixo de Alta, mesmo com valor baixo; uma de tipo baixo pode subir at&eacute;
    Cr&iacute;tica se o valor for alto e o prazo estiver correndo. O tipo diz o quanto aquilo
    costuma custar; a ocorr&ecirc;ncia diz quanto custa hoje.</p>
  </div>
  <div class="table-wrap"><table><thead><tr>
    <th>N&iacute;vel</th><th>Quando o tipo recebe este n&iacute;vel</th><th>Exemplo do cat&aacute;logo</th><th>Tipos</th>
  </tr></thead><tbody>
    <tr><td>%(c_crit)s</td>
      <td>Impede a apropria&ccedil;&atilde;o do cr&eacute;dito, extingue o d&eacute;bito errado, ou faz dinheiro sair
      duas vezes. O preju&iacute;zo &eacute; direto e muitas vezes irrevers&iacute;vel.</td>
      <td><a href="#INC-CRE-03">INC-CRE-03</a> &mdash; cr&eacute;dito prescrito. N&atilde;o h&aacute; contorno: o direito acabou.</td>
      <td class="mono">%(n_crit)d</td></tr>
    <tr><td>%(c_alta)s</td>
      <td>O cr&eacute;dito existe e est&aacute; preso a um prazo que corre. Resolve-se, mas a janela fecha.</td>
      <td><a href="#INC-RES-01">INC-RES-01</a> &mdash; inten&ccedil;&atilde;o sem pedido: o cr&eacute;dito est&aacute; travado at&eacute; protocolar.</td>
      <td class="mono">%(n_alta)d</td></tr>
    <tr><td>%(c_media)s</td>
      <td>Diverg&ecirc;ncia de informa&ccedil;&atilde;o sem efeito imediato sobre saldo. Precisa ser explicada,
      n&atilde;o corrida.</td>
      <td><a href="#INC-CAD-06">INC-CAD-06</a> &mdash; agrupamento por fallback: o n&uacute;mero fecha, a leitura por grupo n&atilde;o.</td>
      <td class="mono">%(n_media)d</td></tr>
    <tr><td>%(c_baixa)s</td>
      <td>Cadastral ou operacional. N&atilde;o toca saldo nem prazo; toca a confiabilidade do que
      se l&ecirc; na tela.</td>
      <td><a href="#INC-INT-05">INC-INT-05</a> &mdash; conex&atilde;o sem tr&aacute;fego: pode ser ociosa, pode estar morta.</td>
      <td class="mono">%(n_baixa)d</td></tr>
  </tbody></table></div>
  <p>Os prazos sugeridos por fam&iacute;lia est&atilde;o na
  <a href="prd-inconsistencias.html#s05">se&ccedil;&atilde;o 05 do PRD</a>. Este documento n&atilde;o os redefine.</p>
</div>

<div class="section" id="s04">
  <div class="sec-hdr"><span class="sec-num">04</span><span class="sec-title">A fronteira: o que n&atilde;o vira ocorr&ecirc;ncia</span></div>
  <p>Nem toda regra violada produz uma inconsist&ecirc;ncia. Tr&ecirc;s categorias de regra foram lidas e
  deliberadamente deixadas fora do cat&aacute;logo &mdash; e sab&ecirc;-lo &eacute; t&atilde;o &uacute;til quanto a lista.</p>
  <div class="flow">
    <div class="flow-step"><div class="flow-k">n&atilde;o entra</div><div class="flow-t">Valida&ccedil;&atilde;o bloqueante</div>
      <div class="flow-d">O produto recusa no salvamento. N&atilde;o h&aacute; estado inconsistente para registrar.</div></div>
    <div class="flow-step"><div class="flow-k">n&atilde;o entra</div><div class="flow-t">Estado derivado</div>
      <div class="flow-d">O valor &eacute; calculado a cada leitura. N&atilde;o pode divergir de si mesmo.</div></div>
    <div class="flow-step"><div class="flow-k">n&atilde;o entra</div><div class="flow-t">Car&ecirc;ncia declarada</div>
      <div class="flow-d">O fato existe e ainda n&atilde;o &eacute; ocorr&ecirc;ncia. S&oacute; vira depois do prazo.</div></div>
  </div>
  <div class="table-wrap"><table><thead><tr>
    <th>Regra</th><th>Por que n&atilde;o vira ocorr&ecirc;ncia</th><th>Categoria</th>
  </tr></thead><tbody>
    <tr><td class="mono">RN-EXR-03<br>RN-EXR-04<br>RN-EXR-05</td>
      <td>Um CNPJ em duas pol&iacute;ticas, um contrato em duas pol&iacute;ticas e faixas cruzadas sobre a
      mesma base s&atilde;o <strong>barrados no salvamento</strong>. O conflito nunca chega a existir.
      O que sobra &eacute; a sobreposi&ccedil;&atilde;o entre modelos diferentes, que s&oacute; se mede sobre registros
      concretos &mdash; essa sim est&aacute; no cat&aacute;logo, em <a href="#INC-EXR-02">INC-EXR-02</a>.</td>
      <td>Valida&ccedil;&atilde;o bloqueante</td></tr>
    <tr><td class="mono">RN-CTR-05<br>RN-CTR-20</td>
      <td>Contrato com fim anterior ao in&iacute;cio &eacute; rejeitado; altera&ccedil;&atilde;o vazia &eacute; recusada com
      aviso. Nada &eacute; gravado, nada precisa ser reconciliado depois.</td>
      <td>Valida&ccedil;&atilde;o bloqueante</td></tr>
    <tr><td class="mono">RN-CTR-03<br>RN-FORN-03<br>RN-DEB-02</td>
      <td>Status de contrato, situa&ccedil;&atilde;o contratual do fornecedor e status do documento de
      d&eacute;bito s&atilde;o <strong>derivados na leitura, nunca armazenados</strong>. N&atilde;o existe um segundo
      valor com que possam divergir.</td>
      <td>Estado derivado</td></tr>
    <tr><td class="mono">RN-INC-07</td>
      <td>DF sem registro na apura&ccedil;&atilde;o assistida <strong>s&oacute; vira ocorr&ecirc;ncia 30 dias depois da
      emiss&atilde;o</strong>. Antes disso, a aus&ecirc;ncia &eacute; esperada &mdash; o &oacute;rg&atilde;o ainda est&aacute; processando.</td>
      <td>Car&ecirc;ncia declarada</td></tr>
    <tr><td class="mono">RN-INC-08</td>
      <td>Falha de integra&ccedil;&atilde;o <strong>s&oacute; vira ocorr&ecirc;ncia depois de esgotada a retentativa</strong>.
      Abrir antes transformaria ru&iacute;do de rede em fila de trabalho.</td>
      <td>Car&ecirc;ncia declarada</td></tr>
    <tr><td class="mono">RN-CRE-21</td>
      <td>A convers&atilde;o para recolhimento assumido <strong>n&atilde;o gera &ldquo;Sem comprovante&rdquo;</strong>:
      o registro est&aacute; aguardando guia, n&atilde;o em falta. &Eacute; a &uacute;nica supress&atilde;o expl&iacute;cita
      declarada em PRD.</td>
      <td>Car&ecirc;ncia declarada</td></tr>
    <tr><td class="mono">RN-AUT-01</td>
      <td>Automa&ccedil;&atilde;o notifica e nunca decide. Nenhuma r&eacute;gua altera documento, m&eacute;todo ou valor &mdash;
      logo, nenhuma r&eacute;gua pode produzir diverg&ecirc;ncia fiscal. As ocorr&ecirc;ncias do bloco AUT s&atilde;o
      sobre <em>com quem a r&eacute;gua falou</em>, n&atilde;o sobre o que ela mudou.</td>
      <td>Fronteira de m&oacute;dulo</td></tr>
    <tr><td class="mono">RN-INC-10</td>
      <td>Nenhum outro m&oacute;dulo resolve ocorr&ecirc;ncia; todos podem criar. Uma ocorr&ecirc;ncia fechada
      em outro m&oacute;dulo n&atilde;o &eacute; inconsist&ecirc;ncia de dados &mdash; &eacute; defeito, e vai para a
      <a href="prd-inconsistencias.html#s14">lista de decis&otilde;es</a>.</td>
      <td>Fronteira de m&oacute;dulo</td></tr>
  </tbody></table></div>
</div>

<div class="section" id="s05">
  <div class="sec-hdr"><span class="sec-num">05</span><span class="sec-title">Cat&aacute;logo por m&oacute;dulo</span></div>
  <p>Treze blocos, na ordem do pipeline: o documento entra, encontra o cadastro, ganha
  compet&ecirc;ncia, &eacute; confrontado com o &oacute;rg&atilde;o, vira cr&eacute;dito e d&eacute;bito, apura, paga, ressarce.
  Cada linha tem uma &acirc;ncora est&aacute;vel &mdash; <code>#INC-CONC-05</code> abre direto na ocorr&ecirc;ncia.</p>
  %(blocos)s
</div>

<div class="section" id="s06">
  <div class="sec-hdr"><span class="sec-num">06</span><span class="sec-title">Eventos fiscais</span></div>
  <p>Os eventos fiscais da NT 2025.002-RTC produzem uma fam&iacute;lia pr&oacute;pria de inconsist&ecirc;ncias,
  j&aacute; catalogada em separado: <strong>quarenta tipos</strong>, segregados por tipo de documento e
  tipo de evento, no
  <a href="eventos-fiscais-dossie.html#s07">dossi&ecirc; de eventos fiscais, se&ccedil;&atilde;o 07</a>.</p>
  <p>Aquele cat&aacute;logo n&atilde;o &eacute; repetido aqui por uma raz&atilde;o de m&eacute;todo: ele nasce de um
  <strong>leiaute externo ainda em homologa&ccedil;&atilde;o</strong>, e muda quando a nota t&eacute;cnica muda.
  Este cat&aacute;logo nasce das regras de neg&oacute;cio do produto, e muda quando o produto muda.
  Misturar os dois faria cada revis&atilde;o da NT reabrir o documento inteiro.</p>
  <div class="callout warn">
    <div class="ct">O achado que liga os dois</div>
    <p>Dos quarenta tipos de inconsist&ecirc;ncia de evento fiscal, <strong>apenas sete se resolvem
    dentro do SplitHub</strong> &mdash; os outros trinta e tr&ecirc;s dependem do emitente, do ERP ou do
    &oacute;rg&atilde;o. Neste cat&aacute;logo a propor&ccedil;&atilde;o &eacute; quase oposta: <strong>%(n_dentro)d das %(tot)d
    fecham dentro</strong>. A diferen&ccedil;a n&atilde;o &eacute; ru&iacute;do &mdash; ela diz de onde vem cada cat&aacute;logo.
    Inconsist&ecirc;ncia de evento nasce de um leiaute que terceiros preenchem, e por isso terceiros
    a corrigem. Inconsist&ecirc;ncia de fluxo nasce das nossas pr&oacute;prias regras, e a maior parte
    delas &eacute; nossa para resolver.</p>
  </div>
</div>

<div class="section" id="s07">
  <div class="sec-hdr"><span class="sec-num">07</span><span class="sec-title">Placar: cobertura e distribui&ccedil;&atilde;o</span></div>
  <div class="cards">
    <div class="kpi"><div class="kpi-n">%(tot)d</div><div class="kpi-l">Ocorr&ecirc;ncias mapeadas</div>
      <div class="kpi-d">Lidas nas regras de neg&oacute;cio de dezenove PRDs.</div></div>
    <div class="kpi"><div class="kpi-n">%(vivos)d</div><div class="kpi-l">J&aacute; no produto</div>
      <div class="kpi-d">Existem em <code>inc-catalogo.js</code> e alcan&ccedil;am o filtro e o kanban.</div></div>
    <div class="kpi"><div class="kpi-n">%(prop)d</div><div class="kpi-l">Propostas</div>
      <div class="kpi-d">Cada uma cita a regra de neg&oacute;cio que a sustenta.</div></div>
    <div class="kpi"><div class="kpi-n">%(cob)d%%</div><div class="kpi-l">Cobertura atual</div>
      <div class="kpi-d">Fra&ccedil;&atilde;o do cat&aacute;logo que o produto j&aacute; sabe abrir.</div></div>
  </div>
  <h3>Por criticidade</h3>
  %(bar_crit)s
  <h3>Por fam&iacute;lia</h3>
  %(bar_fam)s
  <div class="callout red">
    <div class="ct">O que o placar diz</div>
    <p><strong>%(n_crit)d ocorr&ecirc;ncias s&atilde;o de tipo cr&iacute;tico e %(n_alta)d de tipo alto</strong> &mdash;
    juntas, %(pct_ca)d%% do cat&aacute;logo toca saldo ou prazo. A cobertura atual do produto se
    concentra em tr&ecirc;s fam&iacute;lias, B, E e D, que s&atilde;o exatamente as que a base sint&eacute;tica j&aacute;
    produz. As fam&iacute;lias <strong>G (cadastro) e H (fato gerador) t&ecirc;m cobertura zero</strong>:
    s&atilde;o %(gh)d ocorr&ecirc;ncias reais, com regra de neg&oacute;cio escrita, que hoje ningu&eacute;m v&ecirc; porque
    nenhum m&oacute;dulo as abre.</p>
  </div>
</div>

<div class="section" id="s08">
  <div class="sec-hdr"><span class="sec-num">08</span><span class="sec-title">Onde cada ocorr&ecirc;ncia se resolve</span></div>
  <p>A coluna <em>contorno</em> do cat&aacute;logo carrega uma marca que vale ler em conjunto: onde a
  a&ccedil;&atilde;o de resolu&ccedil;&atilde;o realmente acontece. &Eacute; a informa&ccedil;&atilde;o que decide se a fila do m&oacute;dulo
  &eacute; uma fila de trabalho ou uma fila de espera.</p>
  %(bar_onde)s
  <div class="table-wrap"><table><thead><tr>
    <th>Lugar</th><th>O que significa para a fila</th><th>Ocorr&ecirc;ncias</th>
  </tr></thead><tbody>
    <tr><td>%(o_dentro)s</td>
      <td>O operador abre a ocorr&ecirc;ncia e resolve. Corrigir cadastro, reprocessar, gerar guia,
      vincular comprovante. S&atilde;o as &uacute;nicas em que o prazo do SLA &eacute; inteiramente nosso.</td>
      <td class="mono">%(n_dentro)d</td></tr>
    <tr><td>%(o_misto)s</td>
      <td>Come&ccedil;a dentro e termina fora, ou o inverso. Pedir carta de corre&ccedil;&atilde;o e depois
      reprocessar; cobrar o ERP e depois revalidar. O prazo depende de terceiro, e a fila
      precisa de um estado que diga isso &mdash; &eacute; o que <code>ag_emitente</code> faz (RN-INC-09).</td>
      <td class="mono">%(n_misto)d</td></tr>
    <tr><td>%(o_fora)s</td>
      <td>O SplitHub evidencia e n&atilde;o resolve. Impugna&ccedil;&atilde;o de glosa, restitui&ccedil;&atilde;o de
      recolhimento indevido, corre&ccedil;&atilde;o de al&iacute;quota no documento j&aacute; emitido. Para estas, o
      valor do produto est&aacute; em <strong>descobrir cedo</strong>, n&atilde;o em fechar r&aacute;pido.</td>
      <td class="mono">%(n_fora)d</td></tr>
  </tbody></table></div>
  <div class="callout info">
    <div class="ct">Consequ&ecirc;ncia de produto</div>
    <p>Com %(pct_fora)d%% das ocorr&ecirc;ncias dependendo de terceiro para fechar, um indicador de
    &ldquo;tempo m&eacute;dio de resolu&ccedil;&atilde;o&rdquo; medido sem distinguir os tr&ecirc;s lugares mede, na
    maior parte, a velocidade de quem n&atilde;o usa o SplitHub. O KPI honesto &eacute; o
    <strong>tempo at&eacute; a detec&ccedil;&atilde;o</strong> &mdash; esse &eacute; inteiramente nosso.</p>
  </div>
</div>

<div class="section" id="s09">
  <div class="sec-hdr"><span class="sec-num">09</span><span class="sec-title">Decis&otilde;es em aberto</span></div>
  <div class="table-wrap"><table><thead><tr>
    <th>#</th><th>Decis&atilde;o</th><th>Por que precisa ser decidida</th><th>Trava</th>
  </tr></thead><tbody>
    <tr><td class="mono">DC-01</td>
      <td>Criar as fam&iacute;lias <strong>G &mdash; Cadastro e v&iacute;nculo</strong> e
      <strong>H &mdash; Fato gerador e compet&ecirc;ncia</strong> em <code>inc-catalogo.js</code>?</td>
      <td>S&atilde;o %(gh)d ocorr&ecirc;ncias sem casa. For&ccedil;&aacute;-las nas fam&iacute;lias existentes manda o operador
      procurar o erro no lugar errado.</td>
      <td class="mono">%(gh)d tipos</td></tr>
    <tr><td class="mono">DC-02</td>
      <td>Qual subconjunto das %(prop)d propostas entra na pr&oacute;xima vers&atilde;o?</td>
      <td>Implementar todas de uma vez encheria a fila de ocorr&ecirc;ncias que ningu&eacute;m tem
      processo para tratar. A sugest&atilde;o &eacute; come&ccedil;ar pelas cr&iacute;ticas de resolu&ccedil;&atilde;o interna.</td>
      <td class="mono">roadmap</td></tr>
    <tr><td class="mono">DC-03</td>
      <td>A criticidade de tipo deve <strong>limitar por baixo</strong> a prioridade calculada, ou
      apenas informar?</td>
      <td>A se&ccedil;&atilde;o 03 prop&otilde;e que limite. Sem isso, uma prescri&ccedil;&atilde;o de valor baixo entra na
      fila como Baixa e prescreve na posi&ccedil;&atilde;o em que entrou.</td>
      <td class="mono">RN-INC-03</td></tr>
    <tr><td class="mono">DC-04</td>
      <td>Os prazos por fam&iacute;lia da
      <a href="prd-inconsistencias.html#resp">se&ccedil;&atilde;o 05 do PRD</a> foram estendidos &agrave;s seis
      fam&iacute;lias vivas nesta revis&atilde;o. Falta decidir o prazo das duas propostas, G e H.</td>
      <td>G e H s&atilde;o de resolu&ccedil;&atilde;o interna e quase sempre r&aacute;pidas &mdash; mas travam documentos
      inteiros enquanto duram. Um prazo longo demais esconde cr&eacute;dito que nem chegou &agrave; base.</td>
      <td class="mono">2 fam&iacute;lias</td></tr>
    <tr><td class="mono">DC-05</td>
      <td>Ocorr&ecirc;ncias de isolamento (<a href="#INC-POR-01">INC-POR-01</a>) devem entrar na mesma
      fila das fiscais?</td>
      <td>S&atilde;o cr&iacute;ticas, mas quem resolve &eacute; seguran&ccedil;a, n&atilde;o o time fiscal. Misturar as duas
      filas atrasa as duas.</td>
      <td class="mono">2 tipos</td></tr>
    <tr><td class="mono">DC-06</td>
      <td>Ocorr&ecirc;ncias que s&atilde;o defeito de engenharia &mdash; <a href="#INC-APU-06">INC-APU-06</a>,
      <a href="#INC-CONC-10">INC-CONC-10</a> &mdash; devem virar ocorr&ecirc;ncia ou teste de regress&atilde;o?</td>
      <td>Como ocorr&ecirc;ncia, aparecem para o cliente. Como teste, nunca chegam a produ&ccedil;&atilde;o.
      A recomenda&ccedil;&atilde;o &eacute; teste, com a ocorr&ecirc;ncia como rede de seguran&ccedil;a.</td>
      <td class="mono">3 tipos</td></tr>
  </tbody></table></div>
</div>

<div class="section" id="s10">
  <div class="sec-hdr"><span class="sec-num">10</span><span class="sec-title">Como manter este cat&aacute;logo</span></div>
  <p>Este HTML &eacute; <strong>derivado</strong>. A fonte &eacute; a tabela <code>CATALOGO</code> em
  <code>tools/gerar-catalogo-inconsistencias.py</code>. Editar o HTML &agrave; m&atilde;o faz a pr&oacute;xima
  gera&ccedil;&atilde;o apagar a edi&ccedil;&atilde;o.</p>
  <div class="flow">
    <div class="flow-step"><div class="flow-k">1</div><div class="flow-t">A funcionalidade muda</div>
      <div class="flow-d">Nova regra de neg&oacute;cio, novo estado, novo campo, nova integra&ccedil;&atilde;o.</div></div>
    <div class="flow-step"><div class="flow-k">2</div><div class="flow-t">Pergunte pela viola&ccedil;&atilde;o</div>
      <div class="flow-d">O que acontece quando esta regra n&atilde;o vale? Barra, deriva, ou entra errado?</div></div>
    <div class="flow-step"><div class="flow-k">3</div><div class="flow-t">Entra ou n&atilde;o entra</div>
      <div class="flow-d">Barra e deriva v&atilde;o para a se&ccedil;&atilde;o 04. Entra errado vira linha do cat&aacute;logo.</div></div>
    <div class="flow-step"><div class="flow-k">4</div><div class="flow-t">Regere e espelhe</div>
      <div class="flow-d">Rode o script, espelhe em <code>docs/docs/</code>, atualize o card e o changelog.</div></div>
  </div>
  <p>O procedimento completo &mdash; incluindo quando tamb&eacute;m se mexe em <code>inc-catalogo.js</code>,
  no PRD e no mapa de funcionalidades &mdash; est&aacute; na skill
  <code>catalogo-inconsistencias</code>, que roda automaticamente depois de qualquer altera&ccedil;&atilde;o
  de funcionalidade.</p>
  <div class="callout ok">
    <div class="ct">Regra de c&oacute;digo</div>
    <p>C&oacute;digos <code>INC-&lt;MOD&gt;-nn</code> s&atilde;o <strong>est&aacute;veis e n&atilde;o se reaproveitam</strong>.
    Uma ocorr&ecirc;ncia retirada do cat&aacute;logo deixa o n&uacute;mero vago para sempre &mdash; &eacute; o que permite
    que um chamado de dois anos atr&aacute;s ainda signifique alguma coisa.</p>
  </div>
</div>

<div class="section" id="chg">
  <div class="sec-hdr"><span class="sec-num">&mdash;</span><span class="sec-title">Hist&oacute;rico</span></div>
  <div class="table-wrap"><table><thead><tr>
    <th>Vers&atilde;o</th><th>Data</th><th>Mudan&ccedil;a</th>
  </tr></thead><tbody>
    <tr><td class="mono">v1.0</td><td class="mono">%(data)s</td>
      <td>Primeira edi&ccedil;&atilde;o. %(tot)d ocorr&ecirc;ncias lidas nas regras de neg&oacute;cio dos dezenove PRDs
      vivos, em oito fam&iacute;lias &mdash; seis existentes e duas propostas. Se&ccedil;&atilde;o de fronteira
      com as oito regras que deliberadamente n&atilde;o produzem ocorr&ecirc;ncia. Documento gerado por
      <code>tools/gerar-catalogo-inconsistencias.py</code>.</td></tr>
  </tbody></table></div>
</div>

</div>
</body>
</html>
'''

famtab = []
for k in FAM_ORDEM:
    letra, nome, cor, desc, est = FAMILIAS[k]
    n = POR_FAM.get(k, 0)
    nv = sum(1 for e in C if e['fam'] == k and e['estado'] == 'vivo')
    tag = (u'<span class="tag ok">no produto</span>' if est == 'vivo'
           else u'<span class="tag pend">proposta</span>')
    famtab.append(u'<tr><td>%s</td><td><strong>%s</strong></td><td>%s</td>'
                  u'<td class="mono">%d<div class="cel-reg">%d no produto</div></td><td>%s</td></tr>'
                  % (chip(letra, cor), nome, desc, n, nv, tag))

toc = ''.join(u'<li><a href="#%s"><span class="toc-num">%s</span>%s</a></li>' % (a, n, t)
              for n, t, a in TOC)

saida = HTML % dict(
    css=CSS, versao=VERSAO, data=DATA, toc=toc,
    tot=TOT, vivos=VIVOS, prop=PROP,
    cob=int(round(VIVOS * 100.0 / TOT)),
    famtab='\n'.join(famtab),
    g=POR_FAM.get('cadastro', 0), h=POR_FAM.get('fg', 0),
    gh=POR_FAM.get('cadastro', 0) + POR_FAM.get('fg', 0),
    c_crit=chip(CRIT['critica'][0], CRIT['critica'][1]),
    c_alta=chip(CRIT['alta'][0], CRIT['alta'][1]),
    c_media=chip(CRIT['media'][0], CRIT['media'][1]),
    c_baixa=chip(CRIT['baixa'][0], CRIT['baixa'][1]),
    n_crit=POR_CRIT.get('critica', 0), n_alta=POR_CRIT.get('alta', 0),
    n_media=POR_CRIT.get('media', 0), n_baixa=POR_CRIT.get('baixa', 0),
    blocos='\n'.join(bloco(m) for m in MODULOS),
    bar_crit=barras(POR_CRIT, CRIT, ['critica', 'alta', 'media', 'baixa']),
    bar_fam=barras(POR_FAM, FAM_MAPA, FAM_ORDEM),
    bar_onde=barras(POR_ONDE, ONDE, ['dentro', 'misto', 'fora']),
    o_dentro=chip(ONDE['dentro'][0], ONDE['dentro'][1]),
    o_misto=chip(ONDE['misto'][0], ONDE['misto'][1]),
    o_fora=chip(ONDE['fora'][0], ONDE['fora'][1]),
    n_dentro=POR_ONDE.get('dentro', 0), n_misto=POR_ONDE.get('misto', 0),
    n_fora=POR_ONDE.get('fora', 0),
    pct_fora=int(round((POR_ONDE.get('fora', 0) + POR_ONDE.get('misto', 0)) * 100.0 / TOT)),
    pct_ca=int(round((POR_CRIT.get('critica', 0) + POR_CRIT.get('alta', 0)) * 100.0 / TOT)),
)

for destino in (os.path.join(RAIZ, 'src', 'docs', 'catalogo-inconsistencias.html'),
                os.path.join(RAIZ, 'docs', 'docs', 'catalogo-inconsistencias.html')):
    io.open(destino, 'w', encoding='utf-8').write(saida)

print('catalogo-inconsistencias.html  %d ocorrencias  %d vivas  %d propostas  %d bytes'
      % (TOT, VIVOS, PROP, len(saida)))
cods = [e['cod'] for e in C]
assert len(cods) == len(set(cods)), 'codigo duplicado'
