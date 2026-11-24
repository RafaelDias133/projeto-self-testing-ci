function createAccountRepository(db) {
  const insert = db.prepare(
    'INSERT INTO accounts (id, owner, document, balance_cents, created_at) VALUES (@id, @owner, @document, @balanceCents, @createdAt)',
  );
  const selectById = db.prepare('SELECT * FROM accounts WHERE id = ?');
  const updateBalance = db.prepare('UPDATE accounts SET balance_cents = ? WHERE id = ?');

  function toEntity(row) {
    return {
      id: row.id,
      owner: row.owner,
      document: row.document,
      balanceCents: row.balance_cents,
      createdAt: row.created_at,
    };
  }

  return {
    create(account) {
      insert.run(account);
      return account;
    },
    findById(id) {
      const row = selectById.get(id);
      return row ? toEntity(row) : null;
    },
    updateBalance(id, balanceCents) {
      updateBalance.run(balanceCents, id);
    },
  };
}

module.exports = { createAccountRepository };
