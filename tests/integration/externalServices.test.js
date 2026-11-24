const { createFraudNotifier } = require('../../src/services/fraudNotifier');
const { createDocumentValidator } = require('../../src/services/documentValidator');

describe('fraudNotifier', () => {
  const payload = { transferId: 't1', fromAccountId: 'a', toAccountId: 'b', amount: 10, createdAt: '2026-11-01T00:00:00.000Z' };

  test('envia POST JSON para o webhook configurado (mock)', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    const notifier = createFraudNotifier({ url: 'https://antifraude.example/webhook', fetchFn: fetchMock });

    const result = await notifier.notify(payload);

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://antifraude.example/webhook');
    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(options.body)).toEqual({ event: 'transfer.created', data: payload });
  });

  test('lanca erro quando o webhook responde com falha', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 503 });
    const notifier = createFraudNotifier({ url: 'https://antifraude.example/webhook', fetchFn: fetchMock });

    await expect(notifier.notify(payload)).rejects.toThrow('503');
  });

  test('nao chama o webhook quando a URL nao esta configurada', async () => {
    const fetchMock = jest.fn();
    const notifier = createFraudNotifier({ url: '', fetchFn: fetchMock });

    expect(await notifier.notify(payload)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('documentValidator', () => {
  test('usa a resposta fixa do servico cadastral externo (stub)', async () => {
    const fetchStub = async () => ({ ok: true, json: async () => ({ valid: false }) });
    const validator = createDocumentValidator({ url: 'https://cadastro.example', fetchFn: fetchStub });

    expect(await validator.isValid('52998224725')).toBe(false);
  });

  test('consulta a URL do documento no servico externo', async () => {
    const fetchStub = jest.fn(async () => ({ ok: true, json: async () => ({ valid: true }) }));
    const validator = createDocumentValidator({ url: 'https://cadastro.example', fetchFn: fetchStub });

    expect(await validator.isValid('529.982.247-25')).toBe(true);
    expect(fetchStub).toHaveBeenCalledWith('https://cadastro.example/documents/52998224725');
  });

  test('lanca erro quando o servico cadastral esta indisponivel', async () => {
    const fetchStub = async () => ({ ok: false, status: 500 });
    const validator = createDocumentValidator({ url: 'https://cadastro.example', fetchFn: fetchStub });

    await expect(validator.isValid('52998224725')).rejects.toThrow('500');
  });

  test('usa validacao local de CPF quando nao ha URL configurada', async () => {
    const validator = createDocumentValidator({});

    expect(await validator.isValid('52998224725')).toBe(true);
    expect(await validator.isValid('52998224724')).toBe(false);
  });
});
