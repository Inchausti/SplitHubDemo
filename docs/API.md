# SplitHub API Documentation

## Overview

A API SplitHub fornece acesso a dados de pagamentos, créditos, conciliação e análises tributárias.

## Base URL

```
https://api.splithub.com/v1
```

## Authentication

Todas as requisições requerem um token Bearer no header:

```bash
Authorization: Bearer YOUR_API_TOKEN
```

## Endpoints

### Dashboard

#### GET /dashboard

Retorna os KPIs principais do dashboard.

**Response:**
```json
{
  "creditosApropriados": 52300000,
  "creditosApropriar": 10900000,
  "creditosRisco": 2400000,
  "aliquotaEfetiva": 9.14,
  "ultimaAtualizacao": "2026-04-24T11:47:00Z"
}
```

### Pagamentos

#### GET /pagamentos

Retorna lista de pagamentos com filtros opcionais.

**Query Parameters:**
- `status`: pending, paid, overdue
- `tipo`: DARF_CBS, GUIA_IBS
- `mes`: YYYY-MM

**Response:**
```json
{
  "data": [
    {
      "id": "G-0048",
      "rf": "RF-001234",
      "fornecedor": "Vale S.A.",
      "tipo": "GUIA_IBS",
      "valor": 512000,
      "vencimento": "2026-04-24",
      "status": "pending"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20
}
```

#### POST /pagamentos/{id}/executar

Executa um pagamento.

**Request:**
```json
{
  "metodo": "PIX",
  "agendado": false
}
```

### Créditos

#### GET /creditos

Retorna posição de créditos IBS e CBS.

**Query Parameters:**
- `mes`: YYYY-MM
- `status`: apropriado, aguardando, risco, perdido

**Response:**
```json
{
  "totalCreditos": 65600000,
  "apropriados": 52300000,
  "aguardando": 10900000,
  "risco": 2400000,
  "perdido": 168000,
  "utilizados": 38900000
}
```

#### GET /creditos/{id}

Retorna detalhes de um crédito específico.

### Conciliação

#### GET /conciliacao

Retorna status de conciliação DF-e × RF × TF.

**Query Parameters:**
- `mes`: YYYY-MM

**Response:**
```json
{
  "dfRecebidos": 1852,
  "rfVinculados": 1836,
  "tfConfirmadas": 1812,
  "divergencias": 24
}
```

### Analytics

#### GET /analytics/evolucao-creditos

Retorna série histórica de créditos.

**Query Parameters:**
- `meses`: number (default: 7)
- `granularidade`: dia, semana, mes

**Response:**
```json
{
  "dados": [
    {
      "periodo": "2026-03",
      "apropriados": 49200000,
      "aguardando": 8900000,
      "risco": 1900000
    }
  ]
}
```

#### GET /analytics/eficiencia-pagamentos

Retorna métricas de pagamentos executados.

#### GET /analytics/saude-fornecedores

Retorna score e saúde de fornecedores.

## Error Handling

Todos os erros retornam JSON com a seguinte estrutura:

```json
{
  "error": {
    "code": "INSUFFICIENT_CREDITS",
    "message": "Créditos insuficientes para executar a ação",
    "timestamp": "2026-04-24T11:47:00Z"
  }
}
```

### Status Codes

- `200`: OK
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `429`: Too Many Requests
- `500`: Internal Server Error

## Rate Limiting

- **Limite:** 1000 requisições por hora
- **Header:** `X-RateLimit-Remaining`

## Webhooks

Configure webhooks para receber notificações de eventos:

```bash
POST /webhooks
{
  "url": "https://seu-servidor.com/webhooks",
  "eventos": ["pagamento.executado", "credito.apropriado"]
}
```

## SDKs

- **JavaScript:** `npm install @splithub/sdk-js`
- **Python:** `pip install splithub-sdk`

## Support

- **Docs:** https://docs.splithub.com
- **Email:** api-support@splithub.com
- **Status:** https://status.splithub.com
