const { createDatabase } = require('../../src/repositories/database');
const { createWalletService } = require('../../src/services/walletService');
const {
  ValidationError,
  NotFoundError,
  InsufficientFundsError,
  InvalidDocumentError,
} = require('../../src/domain/errors');

const VALID_CPF = '52998224725';

function documentValidatorStub(valid = true) {
  return { isValid: async () => valid };
}

function fixedClock(isoDates) {
  let index = 0;
  return () => new Date(isoDates[Math.min(index++, isoDates.length - 1)]);
}

function build(overrides = {}) {
  const db = createDatabase(':memory:');
  const fraudNotifier = { notify: jest.fn().mockResolvedValue(true) };
  const logger = { error: jest.fn() };
  const service = createWalletService({
    db,
    fraudNotifier,
    documentValidator: documentValidatorStub(true),
    logger,
    ...overrides,
  });
  return { db, service, fraudNotifier, logger };
}

describe('createAccount', () => {
  test('cria conta com saldo inicial e lancamento de credito', async () => {
    const { service } = build();
    const account = await service.createAccount({ owner: 'Ana', document: VALID_CPF, initialBalance: 150.25 });

    expect(account).toMatchObject({ owner: 'Ana', document: VALID_CPF, balance: 150.25 });
    expect(account.id).toEqual(expect.any(String));

    const statement = service.getStatement(account.id, {});
    expect(statement.transactions).toHaveLength(1);
    expect(statement.transactions[0]).toMatchObject({ type: 'credit', amount: 150.25, balanceAfter: 150.25 });
  });

  test('cria conta sem saldo inicial e sem lancamentos', async () => {
    const { service } = build();
    const account = await service.createAccount({ owner: 'Bia', document: VALID_CPF });

    expect(account.balance).toBe(0);
    expect(service.getStatement(account.id, {}).transactions).toHaveLength(0);
  });

  test('rejeita documento reprovado pelo servico de validacao cadastral (stub)', async () => {
    const { service } = build({ documentValidator: documentValidatorStub(false) });

    await expect(service.createAccount({ owner: 'Ana', document: '00000000000' })).rejects.toThrow(InvalidDocumentError);
  });

  test('rejeita titular vazio e saldo inicial negativo', async () => {
    const { service } = build();

    await expect(service.createAccount({ owner: ' ', document: VALID_CPF })).rejects.toThrow(ValidationError);
    await expect(service.createAccount({ owner: 'Ana', document: 123 })).rejects.toThrow(ValidationError);
    await expect(service.createAccount({ owner: 'Ana', document: VALID_CPF, initialBalance: -1 })).rejects.toThrow(ValidationError);
  });
});

describe('getAccount', () => {
  test('lanca NotFoundError para conta inexistente', () => {
    const { service } = build();
    expect(() => service.getAccount('nao-existe')).toThrow(NotFoundError);
  });
});

describe('transfer', () => {
  async function twoAccounts(service, fromBalance = 100, toBalance = 0) {
    const from = await service.createAccount({ owner: 'Origem', document: VALID_CPF, initialBalance: fromBalance });
    const to = await service.createAccount({ owner: 'Destino', document: VALID_CPF, initialBalance: toBalance });
    return { from, to };
  }

  test('transfere saldo e atualiza as duas contas', async () => {
    const { service } = build();
    const { from, to } = await twoAccounts(service);

    const result = await service.transfer({ fromAccountId: from.id, toAccountId: to.id, amount: 30.5, idempotencyKey: 'k1' });

    expect(result).toMatchObject({ fromAccountId: from.id, toAccountId: to.id, amount: 30.5, replayed: false });
    expect(service.getAccount(from.id).balance).toBe(69.5);
    expect(service.getAccount(to.id).balance).toBe(30.5);
  });

  test('notifica o gateway anti-fraude uma unica vez com os parametros da transferencia (mock)', async () => {
    const { service, fraudNotifier } = build();
    const { from, to } = await twoAccounts(service);

    const result = await service.transfer({ fromAccountId: from.id, toAccountId: to.id, amount: 10, idempotencyKey: 'k1' });

    expect(fraudNotifier.notify).toHaveBeenCalledTimes(1);
    expect(fraudNotifier.notify).toHaveBeenCalledWith({
      transferId: result.id,
      fromAccountId: from.id,
      toAccountId: to.id,
      amount: 10,
      createdAt: result.createdAt,
    });
  });

  test('e idempotente: a mesma chave nao debita duas vezes nem notifica de novo', async () => {
    const { service, fraudNotifier } = build();
    const { from, to } = await twoAccounts(service);
    const request = { fromAccountId: from.id, toAccountId: to.id, amount: 40, idempotencyKey: 'mesma-chave' };

    const first = await service.transfer(request);
    const second = await service.transfer(request);

    expect(second.id).toBe(first.id);
    expect(second.replayed).toBe(true);
    expect(service.getAccount(from.id).balance).toBe(60);
    expect(fraudNotifier.notify).toHaveBeenCalledTimes(1);
  });

  test('rejeita saldo insuficiente sem alterar saldos e sem notificar', async () => {
    const { service, fraudNotifier } = build();
    const { from, to } = await twoAccounts(service, 10);

    await expect(
      service.transfer({ fromAccountId: from.id, toAccountId: to.id, amount: 10.01, idempotencyKey: 'k1' }),
    ).rejects.toThrow(InsufficientFundsError);

    expect(service.getAccount(from.id).balance).toBe(10);
    expect(service.getAccount(to.id).balance).toBe(0);
    expect(fraudNotifier.notify).not.toHaveBeenCalled();
  });

  test('rejeita conta inexistente, chave ausente e valor invalido', async () => {
    const { service } = build();
    const { from, to } = await twoAccounts(service);

    await expect(service.transfer({ fromAccountId: from.id, toAccountId: 'x', amount: 1, idempotencyKey: 'a' })).rejects.toThrow(NotFoundError);
    await expect(service.transfer({ fromAccountId: 'x', toAccountId: to.id, amount: 1, idempotencyKey: 'b' })).rejects.toThrow(NotFoundError);
    await expect(service.transfer({ fromAccountId: from.id, toAccountId: to.id, amount: 1 })).rejects.toThrow(ValidationError);
    await expect(service.transfer({ fromAccountId: from.id, toAccountId: to.id, amount: 0, idempotencyKey: 'c' })).rejects.toThrow(ValidationError);
  });

  test('rejeita transferencia para a propria conta', async () => {
    const { service, fraudNotifier } = build();
    const { from } = await twoAccounts(service);

    await expect(
      service.transfer({ fromAccountId: from.id, toAccountId: from.id, amount: 10, idempotencyKey: 'k1' }),
    ).rejects.toThrow(ValidationError);
    expect(service.getStatement(from.id, {}).transactions).toHaveLength(1);
    expect(fraudNotifier.notify).not.toHaveBeenCalled();
  });

  test('falha no gateway anti-fraude nao desfaz a transferencia', async () => {
    const fraudNotifier = { notify: jest.fn().mockRejectedValue(new Error('gateway fora do ar')) };
    const { service, logger } = build({ fraudNotifier });
    const { from, to } = await twoAccounts(service);

    const result = await service.transfer({ fromAccountId: from.id, toAccountId: to.id, amount: 25, idempotencyKey: 'k1' });

    expect(result.replayed).toBe(false);
    expect(service.getAccount(from.id).balance).toBe(75);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  test('50 transferencias concorrentes nao geram saldo negativo', async () => {
    const { service } = build();
    const { from, to } = await twoAccounts(service, 30);

    const results = await Promise.allSettled(
      Array.from({ length: 50 }, (_, i) =>
        service.transfer({ fromAccountId: from.id, toAccountId: to.id, amount: 1, idempotencyKey: `c-${i}` }),
      ),
    );

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(30);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(20);
    expect(service.getAccount(from.id).balance).toBe(0);
    expect(service.getAccount(to.id).balance).toBe(30);
  });
});

describe('getStatement', () => {
  async function scenario() {
    const clock = fixedClock([
      '2026-11-01T10:00:00.000Z',
      '2026-11-01T10:00:00.000Z',
      '2026-11-10T09:00:00.000Z',
      '2026-11-20T15:30:00.000Z',
    ]);
    const ctx = build({ clock });
    const a = await ctx.service.createAccount({ owner: 'A', document: VALID_CPF, initialBalance: 100 });
    const b = await ctx.service.createAccount({ owner: 'B', document: VALID_CPF });
    await ctx.service.transfer({ fromAccountId: a.id, toAccountId: b.id, amount: 20, idempotencyKey: 't1' });
    await ctx.service.transfer({ fromAccountId: b.id, toAccountId: a.id, amount: 5, idempotencyKey: 't2' });
    return { ...ctx, a, b };
  }

  test('retorna todos os lancamentos em ordem cronologica', async () => {
    const { service, a } = await scenario();
    const statement = service.getStatement(a.id, {});

    expect(statement.account.balance).toBe(85);
    expect(statement.transactions.map((t) => [t.type, t.amount, t.balanceAfter])).toEqual([
      ['credit', 100, 100],
      ['debit', 20, 80],
      ['credit', 5, 85],
    ]);
  });

  test('filtra por tipo', async () => {
    const { service, a } = await scenario();

    expect(service.getStatement(a.id, { type: 'debit' }).transactions).toHaveLength(1);
    expect(service.getStatement(a.id, { type: 'credit' }).transactions).toHaveLength(2);
  });

  test('filtra por periodo', async () => {
    const { service, a } = await scenario();
    const statement = service.getStatement(a.id, { from: '2026-11-05', to: '2026-11-15' });

    expect(statement.transactions).toHaveLength(1);
    expect(statement.transactions[0]).toMatchObject({ type: 'debit', amount: 20 });
  });

  test('rejeita filtros invalidos e conta inexistente', async () => {
    const { service, a } = await scenario();

    expect(() => service.getStatement(a.id, { type: 'outro' })).toThrow(ValidationError);
    expect(() => service.getStatement(a.id, { from: '01/11/2026' })).toThrow(ValidationError);
    expect(() => service.getStatement(a.id, { to: '2026-13-45' })).toThrow(ValidationError);
    expect(() => service.getStatement('x', {})).toThrow(NotFoundError);
  });
});
