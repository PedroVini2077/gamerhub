// LOAD TEST — simula uso real com 20 usuários simultâneos por 2 minutos
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { BASE_URL, HEADERS } from './config.js';

const feedLatency     = new Trend('feed_latency');
const profilesLatency = new Trend('profiles_latency');
const errors          = new Counter('errors');

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // warm-up: sobe para 10 VUs
    { duration: '60s', target: 20 },   // load: mantém 20 VUs por 1min
    { duration: '30s', target: 0  },   // cool-down: desce
  ],
  thresholds: {
    http_req_failed:   ['rate<0.05'],   // < 5% de erros
    http_req_duration: ['p(95)<3000'],  // 95% das req em < 3s
    feed_latency:      ['p(90)<2000'],  // feed em < 2s no p90
    errors:            ['count<10'],    // máx 10 erros absolutos
  },
};

export default function () {
  group('Feed Principal', () => {
    const res = http.get(
      `${BASE_URL}/rest/v1/posts?select=id,title,content,category,created_at,is_live&order=created_at.desc&limit=20`,
      { headers: HEADERS }
    );
    feedLatency.add(res.timings.duration);
    const ok = check(res, {
      'feed 200':    r => r.status === 200,
      'feed rápido': r => r.timings.duration < 3000,
    });
    if (!ok) errors.add(1);
    sleep(0.5);
  });

  group('Perfis', () => {
    const res = http.get(
      `${BASE_URL}/rest/v1/profiles?select=id,username,avatar_url,role&limit=20`,
      { headers: HEADERS }
    );
    profilesLatency.add(res.timings.duration);
    check(res, { 'profiles 200': r => r.status === 200 });
    sleep(0.3);
  });

  group('Comentários', () => {
    const res = http.get(
      `${BASE_URL}/rest/v1/comments?select=id,content,created_at,user_id&order=created_at.desc&limit=30`,
      { headers: HEADERS }
    );
    check(res, { 'comments 200': r => r.status === 200 });
    sleep(0.3);
  });

  group('Mural Comunidade', () => {
    const res = http.get(
      `${BASE_URL}/rest/v1/community_posts?select=id,message,created_at&order=created_at.desc&limit=20`,
      { headers: HEADERS }
    );
    check(res, { 'mural 200': r => r.status === 200 });
  });

  sleep(1);
}
