const Database = require('better-sqlite3');

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    owner TEXT NOT NULL,
    document TEXT NOT NULL,
    balance_cents INTEGER NOT NULL CHECK (balance_cents >= 0),
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS transfers (
    id TEXT PRIMARY KEY,
    idempotency_key TEXT NOT NULL UNIQUE,
    from_account_id TEXT NOT NULL REFERENCES accounts(id),
    to_account_id TEXT NOT NULL REFERENCES accounts(id),
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS transactions (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    id TEXT NOT NULL UNIQUE,
    account_id TEXT NOT NULL REFERENCES accounts(id),
    transfer_id TEXT REFERENCES transfers(id),
    type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
    amount_cents INTEGER NOT NULL,
    balance_after_cents INTEGER NOT NULL,
    description TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions (account_id, created_at);
`;

function createDatabase(filename = ':memory:') {
  const db = new Database(filename);
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}

module.exports = { createDatabase };
