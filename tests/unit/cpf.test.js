const { isValidCpf } = require('../../src/domain/cpf');

describe('isValidCpf', () => {
  test.each(['52998224725', '529.982.247-25', '11144477735'])('aceita CPF valido %s', (cpf) => {
    expect(isValidCpf(cpf)).toBe(true);
  });

  test.each(['52998224724', '11111111111', '123', '', '5299822472a5'])('rejeita CPF invalido %s', (cpf) => {
    expect(isValidCpf(cpf)).toBe(false);
  });

  test('rejeita valores que nao sao texto', () => {
    expect(isValidCpf(null)).toBe(false);
    expect(isValidCpf(52998224725)).toBe(false);
  });
});
