# Wallet API

API REST de carteira digital com conciliação bancária simplificada.

## Como rodar

```bash
npm install
cp .env.example .env
npm start
```

## Testes

```bash
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:coverage
npm run lint
```

## Teste de carga

Com a API rodando em `http://localhost:3000`:

```bash
npm run load
```

A documentação completa está em [RELATORIO_TECNICO.md](RELATORIO_TECNICO.md).
