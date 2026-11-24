const CPF_PATTERN = /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/;

function checkDigit(digits, length) {
  const sum = digits
    .slice(0, length)
    .reduce((total, digit, index) => total + digit * (length + 1 - index), 0);
  const rest = (sum * 10) % 11;
  return rest === 10 ? 0 : rest;
}

function isValidCpf(value) {
  if (typeof value !== 'string' || !CPF_PATTERN.test(value)) {
    return false;
  }
  const digits = value.replace(/\D/g, '').split('').map(Number);
  if (new Set(digits).size === 1) {
    return false;
  }
  return checkDigit(digits, 9) === digits[9] && checkDigit(digits, 10) === digits[10];
}

module.exports = { isValidCpf };
