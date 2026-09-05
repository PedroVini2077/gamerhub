import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

/**
 * ── O que esta trava existe para impedir ────────────────────────────────────
 *
 * Pedido explícito do dono em 02/09: *"garanta que nunca existam múltiplas
 * instâncias do áudio tocando simultaneamente"*.
 *
 * A primeira versão do `iniciarFonte` guardava só contra `fonte || vozes` — e
 * isso é insuficiente por um motivo que só aparece com arquivo: **entre o
 * clique e o download terminar, as duas variáveis continuam vazias.** Um
 * segundo clique nesse intervalo passava pela guarda e montava uma segunda
 * fonte. Duas trilhas tocando juntas, desafinadas pelo atraso entre elas.
 *
 * Achei isso relendo o próprio código antes de rodar, e não em teste. Este
 * arquivo existe para que a próxima pessoa não dependa de reler.
 */

/** Um `AudioContext` de mentira que CONTA quantas fontes foram criadas. */
function fabricarContexto() {
  const contagem = { fontes: 0, osciladores: 0, fechados: 0 };
  const param = () => ({
    value: 0,
    cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {},
  });
  class ContextoFalso {
    constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; }
    createGain() { return { gain: param(), connect() {} }; }
    createBiquadFilter() { return { type: '', frequency: { value: 0 }, Q: { value: 0 }, connect() {} }; }
    createOscillator() {
      contagem.osciladores += 1;
      return { type: '', frequency: { value: 0 }, connect() {}, start() {}, stop() {} };
    }
    createBufferSource() {
      contagem.fontes += 1;
      return { buffer: null, loop: false, loopStart: 0, loopEnd: 0, connect() {}, start() {}, stop() {} };
    }
    decodeAudioData(_dados, ok) { ok({ duration: 36 }); }
    resume() { this.state = 'running'; return Promise.resolve(); }
    close() { contagem.fechados += 1; }
  }
  return { ContextoFalso, contagem };
}

async function assentar() {
  // Duas voltas: uma para o fetch, outra para o decode.
  await Promise.resolve(); await Promise.resolve();
  await new Promise(r => setTimeout(r, 0));
  await new Promise(r => setTimeout(r, 0));
}

describe('som ambiente: uma instância, nunca duas', () => {
  let som;
  let contagem;

  beforeEach(async () => {
    vi.resetModules();
    const fab = fabricarContexto();
    contagem = fab.contagem;
    vi.stubGlobal('window', { AudioContext: fab.ContextoFalso });
    vi.stubGlobal('fetch', () => Promise.resolve({
      ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    }));
    som = await import('../somAmbiente');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('dois cliques DURANTE o download criam UMA fonte só', async () => {
    // O caso que a primeira versão errava. Os dois `ligarSom` acontecem antes
    // de o `fetch` resolver — que é a janela real de um clique nervoso.
    som.ligarSom();
    som.ligarSom();
    som.ligarSom();
    await assentar();

    expect(contagem.fontes,
      'mais de uma fonte = duas trilhas tocando juntas, desafinadas pelo atraso')
      .toBe(1);
  });

  it('clique logo depois da tentativa automática não duplica', async () => {
    // O caminho real: a intro acaba, o autoplay tenta, e a pessoa clica no
    // botão antes de o arquivo chegar.
    const p = som.tentarTocar({ sozinho: true });
    som.ligarSom();
    await p;
    await assentar();
    expect(contagem.fontes).toBe(1);
  });

  it('desligar no meio do download NÃO deixa o som ligar depois', async () => {
    // Sem o contador de geração, a montagem atrasada chegava depois do
    // `desligarSom` e religava o som que a pessoa acabou de desligar — e sem
    // nada para desligá-la de novo.
    som.ligarSom();
    som.desligarSom();
    await assentar();
    expect(contagem.fontes,
      'a montagem atrasada tinha que ter desistido ao ver a geração mudada')
      .toBe(0);
  });

  it('religar depois de desligar cria a fonte de novo', async () => {
    // O outro lado: a guarda não pode ser tão forte que impeça o uso normal.
    // Três correções de segurança deste projeto já derrubaram o site por só
    // testarem o lado que fecha (§1.3).
    som.ligarSom();
    await assentar();
    expect(contagem.fontes).toBe(1);

    som.desligarSom();
    await new Promise(r => setTimeout(r, 2700));
    som.ligarSom();
    await assentar();
    expect(contagem.fontes, 'religar tem que voltar a tocar').toBe(2);
  }, 10000);

  it('callback atrasado NÃO solta a flag de uma montagem mais nova', async () => {
    // ── O buraco que só apareceu ao PROVAR a trava ────────────────────────
    // ligar -> desligar -> ligar deixa DUAS montagens no ar. A antiga chega
    // atrasada; se ela zerar `montando` (que agora pertence à nova), um
    // clique seguinte monta uma segunda fonte. A geração diz de quem é a flag.
    som.ligarSom();          // montagem A começa
    som.desligarSom();       // A fica órfã
    som.ligarSom();          // montagem B começa
    await assentar();        // A e B chegam; só B vale
    som.ligarSom();          // o clique que explorava o buraco
    await assentar();

    expect(contagem.fontes,
      'o callback orfao soltou a flag da montagem nova e deixou duplicar')
      .toBe(1);
  });

  it('sem o arquivo, cai nas vozes sintetizadas em vez de ficar mudo', async () => {
    // Botão marcado como ligado com silêncio é a tela mentindo (§1.5).
    vi.stubGlobal('fetch', () => Promise.reject(new Error('rede fora')));
    som.ligarSom();
    await assentar();
    expect(contagem.fontes).toBe(0);
    expect(contagem.osciladores,
      'sem arquivo o plano B tem que entrar: 3 vozes').toBe(3);
  });

  it('sem Web Audio no navegador, devolve false sem estourar', () => {
    vi.stubGlobal('window', {});
    expect(som.ligarSom()).toBe(false);
  });
});
