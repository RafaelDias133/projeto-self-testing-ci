function createTransactionRepository(db) {
  const insert = db.prepare(
    `INSERT INTO transactions (id, account_id, transfer_id, type, amount_cents, balance_after_cents, description, created_at)
     VALUES (@id, @accountId, @transferId, @type, @amountCents, @balanceAfterCents, @description, @createdAt)`,
  );

  function toEntity(row) {
    return {
      id: row.id,
      accountId: row.account_id,
      transferId: row.transfer_id,
      type: row.type,
      amountCents: row.amount_cents,
      balanceAfterCents: row.balance_after_cents,
      description: row.description,
      createdAt: row.created_at,
    };
  }

  return {
    create(transaction) {
      insert.run({ transferId: null, ...transaction });
      return transaction;
    },
    findByAccount(accountId, { from, to, type } = {}) {
      const conditions = ['account_id = @accountId'];
      const params = { accountId };
      if (from) {
        conditions.push('created_at >= @from');
        params.from = from;
      }
      if (to) {
        conditions.push('created_at <= @to');
        params.to = to;
      }
      if (type) {
        conditions.push('type = @type');
        params.type = type;
      }
      const sql = `SELECT * FROM transactions WHERE ${conditions.join(' AND ')} ORDER BY created_at, seq`;
      return db.prepare(sql).all(params).map(toEntity);
    },
  };
}

module.exports = { createTransactionRepository };
