const { ValidationError, InsufficientFundsError } = require('./errors');

const CENTS_PER_UNIT = 100;
const PRECISION_TOLERANCE = 1e-6;

function toCents(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ValidationError('Valor invalido');
  }
  const raw = value * CENTS_PER_UNIT;
  const cents = Math.round(raw);
  if (Math.abs(raw - cents) > PRECISION_TOLERANCE) {
    throw new ValidationError('Valor deve ter no maximo duas casas decimais');
  }
  return cents;
}

function fromCents(cents) {
  return cents / CENTS_PER_UNIT;
}

function assertPositive(amount) {
  if (amount <= 0) {
    throw new ValidationError('Valor deve ser maior que zero');
  }
}

function calculateTransfer(fromBalance, toBalance, amount) {
  assertPositive(amount);
  if (fromBalance < amount) {
    throw new InsufficientFundsError();
  }
  return { fromBalance: fromBalance - amount, toBalance: toBalance + amount };
}

module.exports = { toCents, fromCents, calculateTransfer };
