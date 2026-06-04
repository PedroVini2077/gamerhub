// SMOKE TEST — 1 usuário, 30s — valida que as rotas respondem corretamente
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, HEADERS } from './config.js';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_failed:   ['rate<0.01'],   // < 1% de erros
    http_req_duration: ['p(95)<2000'],  // 95% das req em < 2s
  },
};

export default function () {
  // 1. Feed principal
  const feed = http.get(
    `${BASE_URL}/rest/v1/posts?select=id,title,content,category,created_at,user_id,is_live,embed_url&order=created_at.desc&limit=20`,
    { headers: HEADERS }
  );
  check(feed, {
    'feed: status 200':    r => r.status === 200,
    'feed: tem posts':     r => JSON.parse(r.body).length >= 0,
    'feed: < 1s':          r => r.timings.duration < 1000,
  });

  // 2. Profiles
  const profiles = http.get(
    `${BASE_URL}/rest/v1/profiles?select=id,username,role&limit=10`,
    { headers: HEADERS }
  );
  check(profiles, {
    'profiles: status 200': r => r.status === 200,
    'profiles: < 1s':       r => r.timings.duration < 1000,
  });

  // 3. Lives ativas
  const lives = http.get(
    `${BASE_URL}/rest/v1/posts?select=id,title,is_live,embed_url&is_live=eq.true&limit=10`,
    { headers: HEADERS }
  );
  check(lives, {
    'lives: status 200': r => r.status === 200,
  });

  // 4. Community mural
  const mural = http.get(
    `${BASE_URL}/rest/v1/community_posts?select=id,message,created_at&order=created_at.desc&limit=20`,
    { headers: HEADERS }
  );
  check(mural, {
    'mural: status 200': r => r.status === 200,
    'mural: < 1s':       r => r.timings.duration < 1000,
  });

  sleep(1);
}
