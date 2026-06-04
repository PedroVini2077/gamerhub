// STRESS TEST — descobre o ponto de quebra subindo VUs progressivamente
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import { BASE_URL, HEADERS } from './config.js';

const errors = new Counter('errors');

export const options = {
  stages: [
    { duration: '20s', target: 20  },  // normal
    { duration: '20s', target: 40  },  // acima do normal
    { duration: '20s', target: 60  },  // stress
    { duration: '20s', target: 80  },  // stress alto
    { duration: '20s', target: 100 },  // pico máximo
    { duration: '20s', target: 0   },  // recuperação
  ],
  thresholds: {
    http_req_failed:   ['rate<0.20'],   // aceita até 20% erro (stress test)
    http_req_duration: ['p(95)<5000'],  // 5s limite no stress
  },
};

export default function () {
  const feed = http.get(
    `${BASE_URL}/rest/v1/posts?select=id,title,category,created_at&order=created_at.desc&limit=10`,
    { headers: HEADERS }
  );
  const ok = check(feed, {
    'feed 200': r => r.status === 200,
    'sem timeout': r => r.timings.duration < 5000,
  });
  if (!ok) errors.add(1);

  sleep(0.5);
}
