function isValidCpf(value) {
  if (typeof value !== 'string' || !/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(value)) {
    return false;
  }
  const digits = value.replace(/\D/g, '').split('').map(Number);
  if (new Set(digits).size === 1) {
    return false;
  }
  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    sum += digits[i] * (10 - i);
  }
  let first = (sum * 10) % 11;
  if (first === 10) {
    first = 0;
  }
  if (first !== digits[9]) {
    return false;
  }
  sum = 0;
  for (let i = 0; i < 10; i += 1) {
    sum += digits[i] * (11 - i);
  }
  let second = (sum * 10) % 11;
  if (second === 10) {
    second = 0;
  }
  return second === digits[10];
}

module.exports = { isValidCpf };
