const http = require('node:http');
const request = require('supertest');
const { createApp } = require('../../src/app');
const { createDatabase } = require('../../src/repositories/database');
const { createWalletService } = require('../../src/services/walletService');
const { createDocumentValidator } = require('../../src/services/documentValidator');

let server;
let api;
let fraudNotifier;

beforeEach((done) => {
  fraudNotifier = { notify: jest.fn().mockResolvedValue(true) };
  const service = createWalletService({
    db: createDatabase(':memory:'),
    fraudNotifier,
    documentValidator: createDocumentValidator({}),
  });
  server = http.createServer(createApp({ service }));
  server.listen(0, () => {
    api = request(`http://127.0.0.1:${server.address().port}`);
    done();
  });
});

afterEach((done) => {
  server.close(done);
});

async function createAccount(body) {
  return api.post('/accounts').send({ document: '52998224725', ...body });
}

describe('Wallet API E2E', () => {
  test('GET /health responde ok', async () => {
    const response = await api.get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  test('fluxo completo: cria contas, transfere e gera extrato', async () => {
    const ana = await createAccount({ owner: 'Ana', initialBalance: 500 });
    const bruno = await createAccount({ owner: 'Bruno', document: '111.444.777-35', initialBalance: 50 });
    expect(ana.status).toBe(201);
    expect(bruno.status).toBe(201);

    const transfer = await api
      .post('/transfers')
      .set('Idempotency-Key', 'e2e-1')
      .send({ fromAccountId: ana.body.id, toAccountId: bruno.body.id, amount: 120.75 });
    expect(transfer.status).toBe(201);
    expect(transfer.body).toMatchObject({ amount: 120.75, replayed: false });

    const anaAccount = await api.get(`/accounts/${ana.body.id}`);
    expect(anaAccount.status).toBe(200);
    expect(anaAccount.body.balance).toBe(379.25);

    const statement = await api.get(`/accounts/${bruno.body.id}/statement`);
    expect(statement.status).toBe(200);
    expect(statement.body.account.balance).toBe(170.75);
    expect(statement.body.transactions.map((t) => [t.type, t.amount])).toEqual([
      ['credit', 50],
      ['credit', 120.75],
    ]);

    const debits = await api.get(`/accounts/${ana.body.id}/statement`).query({ type: 'debit' });
    expect(debits.body.transactions).toHaveLength(1);
    expect(debits.body.transactions[0]).toMatchObject({ type: 'debit', amount: 120.75, balanceAfter: 379.25 });

    expect(fraudNotifier.notify).toHaveBeenCalledTimes(1);
  });

  test('repetir a mesma Idempotency-Key retorna a transferencia original com 200', async () => {
    const a = await createAccount({ owner: 'A', initialBalance: 100 });
    const b = await createAccount({ owner: 'B' });
    const body = { fromAccountId: a.body.id, toAccountId: b.body.id, amount: 10 };

    const first = await api.post('/transfers').set('Idempotency-Key', 'repetida').send(body);
    const second = await api.post('/transfers').set('Idempotency-Key', 'repetida').send(body);

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);
    expect((await api.get(`/accounts/${a.body.id}`)).body.balance).toBe(90);
  });

  test('retorna os codigos de erro corretos', async () => {
    const a = await createAccount({ owner: 'A', initialBalance: 10 });
    const b = await createAccount({ owner: 'B' });

    expect((await createAccount({ owner: 'X', document: '12345678900' })).status).toBe(422);
    expect((await createAccount({ owner: '' })).status).toBe(400);
    expect((await api.get('/accounts/inexistente')).status).toBe(404);

    const semChave = await api.post('/transfers').send({ fromAccountId: a.body.id, toAccountId: b.body.id, amount: 1 });
    expect(semChave.status).toBe(400);

    const insuficiente = await api
      .post('/transfers')
      .set('Idempotency-Key', 'k')
      .send({ fromAccountId: a.body.id, toAccountId: b.body.id, amount: 11 });
    expect(insuficiente.status).toBe(422);
    expect(insuficiente.body.error).toBe('Saldo insuficiente');

    expect((await api.get(`/accounts/${a.body.id}/statement`).query({ from: 'ontem' })).status).toBe(400);
  });

  test('retorna 400 para JSON malformado', async () => {
    const response = await api.post('/accounts').set('Content-Type', 'application/json').send('{"owner":');
    expect(response.status).toBe(400);
  });

  test('retorna 500 sem expor detalhes em erro inesperado', async () => {
    const service = { getAccount: () => { throw new Error('falha interna'); } };
    const app = createApp({ service, logger: { error: jest.fn() } });

    const response = await request(app).get('/accounts/qualquer');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Erro interno' });
  });
});
