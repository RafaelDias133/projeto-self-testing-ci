const { randomUUID } = require('node:crypto');
const { toCents, fromCents, calculateTransfer } = require('../domain/money');
const { ValidationError, NotFoundError, InvalidDocumentError } = require('../domain/errors');
const { createAccountRepository } = require('../repositories/accountRepository');
const { createTransferRepository } = require('../repositories/transferRepository');
const { createTransactionRepository } = require('../repositories/transactionRepository');

const TRANSACTION_TYPES = ['credit', 'debit'];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value, field) {
  if (value === undefined) {
    return undefined;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!DATE_PATTERN.test(value) || Number.isNaN(date.getTime())) {
    throw new ValidationError(`Parametro ${field} deve estar no formato AAAA-MM-DD`);
  }
  return value;
}

function createWalletService({
  db,
  fraudNotifier,
  documentValidator,
  clock = () => new Date(),
  idGenerator = randomUUID,
  logger = console,
}) {
  const accounts = createAccountRepository(db);
  const transfers = createTransferRepository(db);
  const transactions = createTransactionRepository(db);

  function accountView(account) {
    return {
      id: account.id,
      owner: account.owner,
      document: account.document,
      balance: fromCents(account.balanceCents),
      createdAt: account.createdAt,
    };
  }

  function transferView(transfer, replayed) {
    return {
      id: transfer.id,
      fromAccountId: transfer.fromAccountId,
      toAccountId: transfer.toAccountId,
      amount: fromCents(transfer.amountCents),
      createdAt: transfer.createdAt,
      replayed,
    };
  }

  function transactionView(transaction) {
    return {
      id: transaction.id,
      transferId: transaction.transferId,
      type: transaction.type,
      amount: fromCents(transaction.amountCents),
      balanceAfter: fromCents(transaction.balanceAfterCents),
      description: transaction.description,
      createdAt: transaction.createdAt,
    };
  }

  function findAccountOrFail(id) {
    const account = accounts.findById(id);
    if (!account) {
      throw new NotFoundError(`Conta ${id} nao encontrada`);
    }
    return account;
  }

  const persistAccount = db.transaction((account) => {
    accounts.create(account);
    if (account.balanceCents > 0) {
      transactions.create({
        id: idGenerator(),
        accountId: account.id,
        type: 'credit',
        amountCents: account.balanceCents,
        balanceAfterCents: account.balanceCents,
        description: 'Saldo inicial',
        createdAt: account.createdAt,
      });
    }
    return account;
  });

  const executeTransfer = db.transaction(({ fromAccountId, toAccountId, amountCents, idempotencyKey }) => {
    const existing = transfers.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      return { transfer: existing, replayed: true };
    }
    const from = findAccountOrFail(fromAccountId);
    const to = findAccountOrFail(toAccountId);
    const balances = calculateTransfer(from.balanceCents, to.balanceCents, amountCents);
    const createdAt = clock().toISOString();
    const transfer = transfers.create({
      id: idGenerator(),
      idempotencyKey,
      fromAccountId,
      toAccountId,
      amountCents,
      createdAt,
    });
    accounts.updateBalance(from.id, balances.fromBalance);
    accounts.updateBalance(to.id, balances.toBalance);
    transactions.create({
      id: idGenerator(),
      accountId: from.id,
      transferId: transfer.id,
      type: 'debit',
      amountCents,
      balanceAfterCents: balances.fromBalance,
      description: `Transferencia para ${to.id}`,
      createdAt,
    });
    transactions.create({
      id: idGenerator(),
      accountId: to.id,
      transferId: transfer.id,
      type: 'credit',
      amountCents,
      balanceAfterCents: balances.toBalance,
      description: `Transferencia de ${from.id}`,
      createdAt,
    });
    return { transfer, replayed: false };
  });

  return {
    async createAccount({ owner, document, initialBalance = 0 }) {
      if (typeof owner !== 'string' || owner.trim() === '') {
        throw new ValidationError('Titular e obrigatorio');
      }
      if (typeof document !== 'string') {
        throw new ValidationError('Documento e obrigatorio');
      }
      const balanceCents = toCents(initialBalance);
      if (balanceCents < 0) {
        throw new ValidationError('Saldo inicial nao pode ser negativo');
      }
      if (!(await documentValidator.isValid(document))) {
        throw new InvalidDocumentError();
      }
      const account = persistAccount({
        id: idGenerator(),
        owner: owner.trim(),
        document,
        balanceCents,
        createdAt: clock().toISOString(),
      });
      return accountView(account);
    },

    getAccount(id) {
      return accountView(findAccountOrFail(id));
    },

    async transfer({ fromAccountId, toAccountId, amount, idempotencyKey }) {
      if (!idempotencyKey) {
        throw new ValidationError('Cabecalho Idempotency-Key e obrigatorio');
      }
      const amountCents = toCents(amount);
      const { transfer, replayed } = executeTransfer({ fromAccountId, toAccountId, amountCents, idempotencyKey });
      const view = transferView(transfer, replayed);
      if (!replayed) {
        try {
          await fraudNotifier.notify({
            transferId: view.id,
            fromAccountId: view.fromAccountId,
            toAccountId: view.toAccountId,
            amount: view.amount,
            createdAt: view.createdAt,
          });
        } catch (error) {
          logger.error(`Falha ao notificar anti-fraude da transferencia ${view.id}: ${error.message}`);
        }
      }
      return view;
    },

    getStatement(accountId, { from, to, type } = {}) {
      const account = findAccountOrFail(accountId);
      if (type !== undefined && !TRANSACTION_TYPES.includes(type)) {
        throw new ValidationError('Parametro type deve ser credit ou debit');
      }
      const filters = { from: parseDate(from, 'from'), to: parseDate(to, 'to'), type };
      return {
        account: accountView(account),
        filters,
        transactions: transactions.findByAccount(account.id, filters).map(transactionView),
      };
    },
  };
}

module.exports = { createWalletService };
