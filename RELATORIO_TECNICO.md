# Relatório Técnico — Wallet API

**Aluno:** _preencher_
**Repositório:** _preencher com o link do GitHub_

## 1. Visão Geral

A Wallet API é um microsserviço REST de carteira digital e conciliação bancária simplificada. Permite criar contas com saldo inicial, transferir valores entre contas com garantia de atomicidade e idempotência, consultar extratos filtrados e notificar um gateway anti-fraude externo a cada transferência.

## 2. Especificação de Requisitos (SRS)

### 2.1 Requisitos Funcionais

| ID | Descrição |
|----|-----------|
| RF01 | O sistema deve permitir criar uma conta digital informando titular, documento (CPF) e saldo inicial. |
| RF02 | O sistema deve validar o documento do titular em um serviço de validação cadastral antes de criar a conta. |
| RF03 | O sistema deve permitir consultar uma conta pelo identificador, retornando o saldo atual. |
| RF04 | O sistema deve permitir transferir saldo entre duas contas existentes. |
| RF05 | O sistema deve rejeitar transferências com saldo insuficiente, valor menor ou igual a zero ou com mais de duas casas decimais. |
| RF06 | O sistema deve garantir idempotência das transferências por meio do cabeçalho `Idempotency-Key`. |
| RF07 | O sistema deve registrar um lançamento de débito na conta de origem e um de crédito na conta de destino para cada transferência. |
| RF08 | O sistema deve permitir consultar o extrato de uma conta com filtros por data inicial, data final e tipo (`credit`/`debit`). |
| RF09 | O sistema deve notificar o gateway anti-fraude externo via webhook após cada transferência concluída. |

### 2.2 Requisitos Não Funcionais

| ID | Descrição |
|----|-----------|
| RNF01 | Transferências devem ser atômicas: débito, crédito e registro da transferência ocorrem na mesma transação de banco. |
| RNF02 | O sistema não pode gerar saldo negativo nem perder lançamentos sob concorrência de no mínimo 50 requisições simultâneas. |
| RNF03 | Valores monetários devem ser armazenados em centavos (inteiros) para evitar erros de ponto flutuante. |
| RNF04 | Falhas no gateway anti-fraude não podem desfazer nem bloquear uma transferência já concluída. |
| RNF05 | A suíte de testes deve atingir no mínimo 80% de cobertura de branches e 85% de linhas/statements. |
| RNF06 | Todo push e pull request nas branches monitoradas deve passar por lint, testes e coverage gate no GitHub Actions. |
| RNF07 | A latência média do endpoint de transferência deve ficar abaixo de 200 ms com 50 usuários simultâneos e taxa de erro abaixo de 1%. |
| RNF08 | Configurações sensíveis (URLs externas, porta, banco) devem vir de variáveis de ambiente (`.env`). |

## 3. Arquitetura

Arquitetura em camadas, com injeção de dependências para permitir o uso de test doubles:

```
HTTP (Express)
   └── controllers/walletController.js   -> rotas, status HTTP
         └── services/walletService.js   -> regras de negócio e orquestração
               ├── domain/money.js        -> cálculo puro de valores e transferências
               ├── domain/errors.js       -> erros de domínio
               ├── repositories/*         -> acesso ao SQLite (better-sqlite3)
               ├── services/fraudNotifier.js      -> webhook anti-fraude (externo)
               └── services/documentValidator.js  -> validação cadastral (externo)
```

### Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/health` | Verificação de saúde |
| POST | `/accounts` | Cria conta `{ owner, document, initialBalance }` |
| GET | `/accounts/:id` | Consulta conta e saldo |
| POST | `/transfers` | Transfere `{ fromAccountId, toAccountId, amount }` com cabeçalho `Idempotency-Key` |
| GET | `/accounts/:id/statement?from=AAAA-MM-DD&to=AAAA-MM-DD&type=credit\|debit` | Extrato filtrado |

### Concorrência e idempotência

O `better-sqlite3` é síncrono e o Node.js executa o código JavaScript em uma única thread. A verificação da chave de idempotência, a leitura dos saldos, o débito, o crédito e a gravação dos lançamentos acontecem dentro de um único `db.transaction()` sem nenhum `await` no meio, então nenhuma outra requisição consegue intercalar entre a leitura e a escrita. A coluna `idempotency_key` tem restrição `UNIQUE` como segunda barreira.

## 4. Estratégia de Branching

Modelo adotado: **Git Flow**.

- `main`: código em produção, recebe apenas merges de `release/*` e `hotfix/*`, sempre com tag de versão.
- `develop`: integração das funcionalidades.
- `feature/*`: uma branch por funcionalidade, criada a partir de `develop` e integrada com merge `--no-ff`.
- `release/*`: estabilização da versão antes de ir para `main`.
- `hotfix/*`: correções emergenciais criadas a partir de `main` e integradas em `main` e `develop`.

Convenção de commits: **Conventional Commits** (`feat`, `fix`, `test`, `refactor`, `docs`, `ci`, `chore`). Os commits do ciclo TDD são marcados com `[RED]`, `[GREEN]` e `[REFACTOR]`.

Proteção de branches no GitHub (Settings → Branches) para `main` e `develop`: exigir pull request, exigir o status check `CI / test` aprovado e bloquear push direto.
