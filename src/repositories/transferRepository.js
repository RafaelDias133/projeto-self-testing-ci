function createTransferRepository(db) {
  const insert = db.prepare(
    `INSERT INTO transfers (id, idempotency_key, from_account_id, to_account_id, amount_cents, created_at)
     VALUES (@id, @idempotencyKey, @fromAccountId, @toAccountId, @amountCents, @createdAt)`,
  );
  const selectByKey = db.prepare('SELECT * FROM transfers WHERE idempotency_key = ?');

  function toEntity(row) {
    return {
      id: row.id,
      idempotencyKey: row.idempotency_key,
      fromAccountId: row.from_account_id,
      toAccountId: row.to_account_id,
      amountCents: row.amount_cents,
      createdAt: row.created_at,
    };
  }

  return {
    create(transfer) {
      insert.run(transfer);
      return transfer;
    },
    findByIdempotencyKey(key) {
      const row = selectByKey.get(key);
      return row ? toEntity(row) : null;
    },
  };
}

module.exports = { createTransferRepository };
