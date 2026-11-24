const { fromCents } = require('../domain/money');

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

module.exports = { accountView, transferView, transactionView };
