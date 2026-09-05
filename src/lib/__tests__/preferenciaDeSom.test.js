import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  preferenciaDeSom, gravarPreferenciaDeSom, podeTentarSozinho,
  LIGADO, DESLIGADO, SEM_DECISAO,
} from '../preferenciaDeSom';

/** localStorage de mentira, para o teste não depender do ambiente. */
function comArmazenamento(inicial = {}) {
  const dados = { ...inicial };
  vi.stubGlobal('window', {
    localStorage: {
      getItem: k => (k in dados ? dados[k] : null),
      setItem: (k, v) => { dados[k] = String(v); },
    },
  });
  return dados;
}

describe('preferência de som', () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it('sem chave nenhuma, ninguém decidiu ainda', () => {
    comArmazenamento();
    expect(preferenciaDeSom()).toBe(SEM_DECISAO);
  });

  it('DESLIGADO é gravado, e não some como antes', () => {
    // ── O bug de verdade ──────────────────────────────────────────────────
    // A versão anterior fazia `removeItem` ao desligar. Com autoplay, isso
    // significaria: a pessoa desliga o som, volta no dia seguinte, e o som
    // toca de novo — porque "desliguei" e "nunca escolhi" eram a mesma coisa.
    const dados = comArmazenamento();
    expect(gravarPreferenciaDeSom(DESLIGADO)).toBe(true);
    expect(dados.gh_som_ambiente).toBe('desligado');
    expect(preferenciaDeSom()).toBe(DESLIGADO);
    expect(podeTentarSozinho(preferenciaDeSom()),
      'quem desligou NAO pode ouvir o som voltar sozinho').toBe(false);
  });

  it('valor desconhecido na chave NÃO vira "ligado"', () => {
    // Lixo de versao antiga, extensao do navegador, alguem editando a mao.
    // Ligar som sozinho por causa de um valor que ninguem reconhece seria o
    // pior dos tres desfechos (§4: mapa fechado, sem palpite).
    comArmazenamento({ gh_som_ambiente: 'sim' });
    expect(preferenciaDeSom()).toBe(SEM_DECISAO);
  });

  it('armazenamento que LANÇA não derruba nada', () => {
    // Modo privado, cookies bloqueados, armazenamento cheio.
    vi.stubGlobal('window', {
      localStorage: {
        getItem() { throw new Error('bloqueado'); },
        setItem() { throw new Error('bloqueado'); },
      },
    });
    expect(preferenciaDeSom()).toBe(SEM_DECISAO);
    expect(gravarPreferenciaDeSom(LIGADO)).toBe(false);
  });

  it('só grava valor conhecido', () => {
    const dados = comArmazenamento();
    expect(gravarPreferenciaDeSom('talvez')).toBe(false);
    expect(dados.gh_som_ambiente).toBeUndefined();
  });

  it('quem tenta sozinho: ligado e sem-decisão sim, desligado nunca', () => {
    expect(podeTentarSozinho(LIGADO)).toBe(true);
    expect(podeTentarSozinho(SEM_DECISAO)).toBe(true);
    expect(podeTentarSozinho(DESLIGADO)).toBe(false);
  });
});
