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

## 5. Estratégia de Testes (Pirâmide)

| Camada | Pasta | Testes | O que valida |
|--------|-------|--------|--------------|
| Unitários | `tests/unit` | 17 | Regras puras: conversão para centavos, cálculo de transferência, saldo insuficiente, validação de CPF |
| Integração | `tests/integration` | 25 | Serviço + repositórios em SQLite `:memory:`, idempotência, concorrência, filtros do extrato, adaptadores externos |
| E2E | `tests/e2e` | 6 | Requisições HTTP reais (servidor em porta efêmera + Supertest): criação de contas, transferência, extrato e códigos de erro |

Ferramentas: Jest (runner e cobertura via Istanbul), Supertest (HTTP), better-sqlite3 (banco em memória).

### 5.1 Evidência do ciclo Red-Green-Refactor

Cada funcionalidade de domínio foi desenvolvida em três commits consecutivos, visíveis com `git log --oneline --grep "\[RED\]\|\[GREEN\]\|\[REFACTOR\]"`:

1. `test(...) [RED]`: testes escritos antes do código, falhando.
2. `feat(...) [GREEN]`: implementação mínima até os testes passarem.
3. `refactor(...) [REFACTOR]`: melhoria de estrutura sem mudar comportamento.

Ciclos realizados: cálculo de valores e transferência, validação de CPF, serviço da carteira e API REST. Os dois hotfixes também começaram por um teste que reproduzia o defeito.

## 6. Test Doubles

| Tipo | Onde | Uso |
|------|------|-----|
| **Mock** | `walletService.test.js` | `fraudNotifier.notify = jest.fn()`: verifica que o gateway anti-fraude é chamado **exatamente uma vez** por transferência, com `transferId`, contas, valor e data; que **não** é chamado em replay idempotente nem em saldo insuficiente. |
| **Mock** | `externalServices.test.js` | `fetch` mockado: verifica URL, método `POST`, cabeçalhos e corpo JSON enviados ao webhook. |
| **Stub** | `walletService.test.js` | `documentValidatorStub(true/false)`: devolve resposta fixa da validação cadastral para controlar a entrada. |
| **Stub** | `walletService.test.js` | `fixedClock([...])`: datas fixas para testar os filtros de extrato de forma determinística. |
| **Stub** | `externalServices.test.js` | `fetch` com resposta fixa `{ valid: true/false }` do serviço cadastral. |
| **Fake** | todos | SQLite em memória (`:memory:`) no lugar de um banco real. |

Diferença aplicada: o mock é usado para **verificar interações de saída** (o que o sistema enviou para fora); o stub apenas **fornece dados de entrada controlados**, sem asserções sobre ele.

## 7. Cobertura de Código

Medida com Istanbul (`jest --coverage`). Limites configurados em `package.json` (`coverageThreshold`); o Jest encerra com erro se algum ficar abaixo.

| Métrica | Mínimo exigido | Obtido |
|---------|----------------|--------|
| Branches | 80% | 93,47% |
| Linhas | 85% | 100% |
| Statements | 85% | 100% |
| Funções | — | 100% |

## 8. Pipeline de Integração Contínua

Arquivo `.github/workflows/ci.yml`:

- **Disparo:** `push` em `main`, `develop`, `feature/**`, `release/**`, `hotfix/**` e `pull_request` para `main` e `develop`.
- **Job `lint`:** ESLint (análise estática).
- **Job `test`:** testes unitários, de integração e E2E em etapas separadas, depois cobertura com gate. Os logs de cada etapa são gravados em `logs/` e publicados como artefato `test-logs`; o relatório de cobertura (HTML/lcov) é publicado como artefato `coverage-report`.
- **Job `load-test`:** sobe a API e executa o script k6, publicando `k6-summary.json` como artefato.
- **Bloqueio de merge:** com a proteção de branch exigindo o status check `test`, um pull request com testes quebrados ou cobertura abaixo do mínimo não pode ser mesclado.

## 9. Teste de Desempenho e Carga

Script: `load/transfer-load.js` (k6). Cenário: 50 usuários virtuais simultâneos (`constant-vus`) durante 30 segundos, todos chamando `POST /transfers` com chaves de idempotência únicas. Limites: taxa de erro < 1% e latência média < 200 ms. Ao final, o `teardown` confere que a soma dos saldos não mudou.

Execução: `npm start` e, em outro terminal, `npm run load`.

Resultado medido localmente (50 clientes concorrentes, 30 s, mesmo cenário do script):

| Métrica | Valor |
|---------|-------|
| Requisições | 122.222 |
| Vazão | ~4.074 req/s |
| Taxa de erro | 0,00% |
| Latência média | 12,27 ms |
| Latência p95 | 23,62 ms |
| Latência máxima | 154,16 ms |
| Soma dos saldos antes / depois | 1.000.000,00 / 1.000.000,00 |

Não houve travamento nem inconsistência de saldo sob concorrência, atendendo ao RNF02 e ao RNF07. O mesmo cenário é executado pelo k6 no job `load-test` do CI, cujo resumo fica no artefato `load-test-report`.

## 10. Histórico de Versões

| Versão | Tipo | Descrição |
|--------|------|-----------|
| v1.0.0 | release | Primeira versão com contas, transferências, extrato, anti-fraude e CI |
| v1.0.1 | hotfix | Bloqueio de transferência para a própria conta |
| v1.0.2 | hotfix | Filtro `to` do extrato passou a incluir o dia inteiro da data final |
