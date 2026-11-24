const { ValidationError, InsufficientFundsError } = require('./errors');

function toCents(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ValidationError('Valor invalido');
  }
  const cents = Math.round(value * 100);
  if (Math.abs(value * 100 - cents) > 1e-6) {
    throw new ValidationError('Valor deve ter no maximo duas casas decimais');
  }
  return cents;
}

function fromCents(cents) {
  return cents / 100;
}

function calculateTransfer(fromBalance, toBalance, amount) {
  if (amount <= 0) {
    throw new ValidationError('Valor deve ser maior que zero');
  }
  if (fromBalance < amount) {
    throw new InsufficientFundsError();
  }
  return { fromBalance: fromBalance - amount, toBalance: toBalance + amount };
}

module.exports = { toCents, fromCents, calculateTransfer };
