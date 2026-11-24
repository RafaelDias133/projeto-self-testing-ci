const { toCents, fromCents, calculateTransfer } = require('../../src/domain/money');
const { ValidationError, InsufficientFundsError } = require('../../src/domain/errors');

describe('toCents', () => {
  test('converte reais para centavos', () => {
    expect(toCents(10.5)).toBe(1050);
    expect(toCents(0.1)).toBe(10);
    expect(toCents(19.99)).toBe(1999);
  });

  test('rejeita valores com mais de duas casas decimais', () => {
    expect(() => toCents(1.234)).toThrow(ValidationError);
  });

  test('rejeita valores que nao sao numeros finitos', () => {
    expect(() => toCents('10')).toThrow(ValidationError);
    expect(() => toCents(NaN)).toThrow(ValidationError);
    expect(() => toCents(Infinity)).toThrow(ValidationError);
    expect(() => toCents(undefined)).toThrow(ValidationError);
  });
});

describe('fromCents', () => {
  test('converte centavos para reais', () => {
    expect(fromCents(1050)).toBe(10.5);
    expect(fromCents(0)).toBe(0);
  });
});

describe('calculateTransfer', () => {
  test('debita a origem e credita o destino', () => {
    expect(calculateTransfer(10000, 500, 2500)).toEqual({ fromBalance: 7500, toBalance: 3000 });
  });

  test('permite transferir exatamente o saldo disponivel', () => {
    expect(calculateTransfer(1000, 0, 1000)).toEqual({ fromBalance: 0, toBalance: 1000 });
  });

  test('lanca erro quando o saldo e insuficiente', () => {
    expect(() => calculateTransfer(999, 0, 1000)).toThrow(InsufficientFundsError);
  });

  test('lanca erro quando o valor e zero ou negativo', () => {
    expect(() => calculateTransfer(1000, 0, 0)).toThrow(ValidationError);
    expect(() => calculateTransfer(1000, 0, -100)).toThrow(ValidationError);
  });
});
