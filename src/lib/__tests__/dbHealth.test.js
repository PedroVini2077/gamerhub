import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  bancoForaDoAr, observarSaudeDoBanco, fetchComSaude,
  _resetarParaTeste, _registrarResultadoParaTeste as registrar,
} from '../dbHealth';

// A sonda de confirmação usa `fetch` direto. Por padrão ela FALHA nos testes,
// simulando banco realmente fora; o teste que quer o contrário sobrescreve.
function sondaResponde(ok) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => (
    ok ? Promise.resolve({ status: 200 }) : Promise.reject(new Error('sem resposta'))
  )));
}

beforeEach(() => {
  _resetarParaTeste();
  sondaResponde(false);
  // A sondagem desiste cedo se as variáveis do Supabase não existirem. Sem
  // fixá-las aqui, o teste passava na minha máquina (que tem `.env.local`) e
  // falhava no CI, que não tem — foi o CI que pegou isso.
  vi.stubEnv('VITE_SUPABASE_URL', 'https://exemplo.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'chave-de-teste');
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

// O risco desta funcionalidade não é deixar de detectar a queda — é detectar
// queda que não houve. Derrubar o site inteiro para a tela de "fora do ar"
// porque o wi-fi de alguém piscou seria pior do que o problema original.
describe('o que NÃO pode derrubar o site', () => {
  it.each([200, 201, 204, 304])('resposta %i mantém o site de pé', async status => {
    for (let i = 0; i < 10; i++) await registrar(status);
    expect(bancoForaDoAr()).toBe(false);
  });

  // 4xx significa que o banco RESPONDEU: é erro de aplicação ou recusa da RLS,
  // não queda. Contar isso derrubaria o site em qualquer tela com permissão
  // negada — e a RLS negando é situação normal aqui.
  it.each([400, 401, 403, 404, 406, 409, 429])('erro %i não é queda de banco', async status => {
    for (let i = 0; i < 10; i++) await registrar(status);
    expect(bancoForaDoAr()).toBe(false);
  });

  it('duas falhas seguidas ainda não bastam', async () => {
    await registrar(500); await registrar(0);
    expect(bancoForaDoAr()).toBe(false);
  });

  // A defesa mais importante contra falso positivo: mesmo com três falhas, se
  // a sondagem independente encontrar o banco de pé, foi instabilidade — e o
  // site NÃO vai para a tela de fora do ar.
  it('três falhas NÃO derrubam se a sondagem encontrar o banco vivo', async () => {
    sondaResponde(true);
    await registrar(0); await registrar(0); await registrar(0);
    expect(bancoForaDoAr()).toBe(false);
  });

  it('uma resposta boa no meio zera a contagem', async () => {
    await registrar(0); await registrar(0);
    await registrar(200);
    await registrar(0); await registrar(0);
    expect(bancoForaDoAr()).toBe(false);
  });
});

describe('o que declara o site fora do ar', () => {
  it('três falhas de rede seguidas, com a sondagem também sem resposta', async () => {
    await registrar(0); await registrar(0); await registrar(0);
    expect(bancoForaDoAr()).toBe(true);
  });

  // O gateway da Supabase devolve 5xx com o projeto pausado — que é o caso de
  // uso que originou tudo isto.
  it.each([500, 502, 503, 540])('três respostas %i seguidas', async status => {
    await registrar(status); await registrar(status); await registrar(status);
    expect(bancoForaDoAr()).toBe(true);
  });

  it('volta sozinho quando o banco responde de novo', async () => {
    await registrar(0); await registrar(0); await registrar(0);
    expect(bancoForaDoAr()).toBe(true);
    await registrar(200);
    expect(bancoForaDoAr()).toBe(false);
  });

  it('avisa quem estiver observando, só quando o estado muda', async () => {
    const avisos = [];
    observarSaudeDoBanco(v => avisos.push(v));
    await registrar(0); await registrar(0);
    expect(avisos).toEqual([]);          // ainda não mudou nada
    await registrar(0);
    expect(avisos).toEqual([true]);
    await registrar(0);                  // segue fora do ar
    expect(avisos).toEqual([true]);      // não repete o aviso
    await registrar(200);
    expect(avisos).toEqual([true, false]);
  });

  it('ouvinte que estoura não impede os outros de serem avisados', async () => {
    const vistos = [];
    observarSaudeDoBanco(() => { throw new Error('ops'); });
    observarSaudeDoBanco(v => vistos.push(v));
    await registrar(0); await registrar(0); await registrar(0);
    expect(vistos).toEqual([true]);
  });
});

// O wrapper fica no caminho de TODA requisição do site. Se ele alterar
// qualquer coisa — engolir erro, mudar resposta, perder argumento — o estrago
// é geral. Estes testes travam a transparência dele.
describe('o fetch instrumentado é transparente', () => {
  it('devolve a mesma resposta e repassa os argumentos', async () => {
    const resp = { status: 200, marcador: 'original' };
    const espiao = vi.fn().mockResolvedValue(resp);
    vi.stubGlobal('fetch', espiao);

    const init = { method: 'POST' };
    await expect(fetchComSaude('/url', init)).resolves.toBe(resp);
    expect(espiao).toHaveBeenCalledWith('/url', init);
  });

  it('repassa o erro em vez de engolir', async () => {
    const erro = new Error('sem rede');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(erro));
    await expect(fetchComSaude('/url')).rejects.toBe(erro);
  });

  it('erro de rede pelo fetch conta como falha', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('falhou')));
    for (let i = 0; i < 3; i++) await fetchComSaude('/url').catch(() => {});
    expect(bancoForaDoAr()).toBe(true);
  });

  // Requisição cancelada pelo próprio app (troca de tela, guarda de corrida)
  // acontece o tempo todo em navegação rápida. Contar isso como queda seria
  // falso positivo garantido.
  it('requisição abortada NÃO conta como queda', async () => {
    const abort = new Error('abortada');
    abort.name = 'AbortError';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abort));
    for (let i = 0; i < 10; i++) await fetchComSaude('/url').catch(() => {});
    expect(bancoForaDoAr()).toBe(false);
  });
});
