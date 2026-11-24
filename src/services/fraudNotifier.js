function createFraudNotifier({ url, fetchFn = fetch }) {
  return {
    async notify(transfer) {
      if (!url) {
        return false;
      }
      const response = await fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'transfer.created', data: transfer }),
      });
      if (!response.ok) {
        throw new Error(`Gateway anti-fraude respondeu com status ${response.status}`);
      }
      return true;
    },
  };
}

module.exports = { createFraudNotifier };
