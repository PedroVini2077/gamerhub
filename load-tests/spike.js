// SPIKE TEST — simula um pico súbito (post viral, menção em rede social)
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, HEADERS } from './config.js';

export const options = {
  stages: [
    { duration: '10s', target: 5  },   // tráfego normal baixo
    { duration: '5s',  target: 80 },   // PICO SÚBITO
    { duration: '20s', target: 80 },   // mantém o pico
    { duration: '5s',  target: 5  },   // retorno ao normal
    { duration: '10s', target: 0  },   // fim
  ],
  thresholds: {
    http_req_failed:   ['rate<0.20'],
    http_req_duration: ['p(95)<6000'],
  },
};

export default function () {
  const res = http.get(
    `${BASE_URL}/rest/v1/posts?select=id,title,content,category,created_at,is_live&order=created_at.desc&limit=20`,
    { headers: HEADERS }
  );
  check(res, {
    'spike: 200':       r => r.status === 200,
    'spike: sem crash': r => r.status < 500,
  });
  sleep(0.2);
}
