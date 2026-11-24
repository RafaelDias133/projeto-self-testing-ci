import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const headers = { 'Content-Type': 'application/json' };

export const options = {
  scenarios: {
    transferencias_concorrentes: {
      executor: 'constant-vus',
      vus: 50,
      duration: '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['avg<200', 'p(95)<500'],
  },
};

function createAccount(owner, initialBalance) {
  const response = http.post(
    `${BASE_URL}/accounts`,
    JSON.stringify({ owner, document: '52998224725', initialBalance }),
    { headers },
  );
  return response.json('id');
}

export function setup() {
  return {
    from: createAccount('Origem Carga', 100000000),
    to: createAccount('Destino Carga', 0),
  };
}

export default function (accounts) {
  const response = http.post(
    `${BASE_URL}/transfers`,
    JSON.stringify({ fromAccountId: accounts.from, toAccountId: accounts.to, amount: 1 }),
    { headers: { ...headers, 'Idempotency-Key': `vu-${__VU}-it-${__ITER}` } },
  );
  check(response, { 'status 201': (r) => r.status === 201 });
}

export function teardown(accounts) {
  const from = http.get(`${BASE_URL}/accounts/${accounts.from}`).json('balance');
  const to = http.get(`${BASE_URL}/accounts/${accounts.to}`).json('balance');
  console.log(`saldo origem=${from} destino=${to} soma=${from + to}`);
}
