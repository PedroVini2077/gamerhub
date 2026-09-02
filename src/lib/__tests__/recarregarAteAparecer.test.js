import { describe, it, expect } from 'vitest';
import { recarregarAteAparecer } from '../recarregarAteAparecer';

/** Espera instantânea: o teste não precisa esperar de verdade. */
const semEsperar = { esperar: () => Promise.resolve() };

describe('recarregarAteAparecer', () => {
  it('aceita de primeira quando o item já veio', async () => {
    let chamadas = 0;
    const ok = await recarregarAteAparecer(
      async () => { chamadas++; return [{ id: 'a' }]; }, 'a', semEsperar);

    expect(ok).toBe(true);
    expect(chamadas, 'não devia insistir quando já apareceu').toBe(1);
  });

  it('INSISTE quando a leitura vem velha, e aceita quando o item chega', async () => {
    // É o caso real: as duas primeiras respostas são válidas e desatualizadas —
    // exatamente o que o pool devolveu no CI de 02/09.
    const respostas = [[{ id: 'antigo' }], [{ id: 'antigo' }], [{ id: 'antigo' }, { id: 'novo' }]];
    let i = 0;
    const ok = await recarregarAteAparecer(async () => respostas[i++], 'novo', semEsperar);

    expect(ok).toBe(true);
    expect(i, 'devia ter recarregado três vezes').toBe(3);
  });

  it('desiste depois das tentativas em vez de insistir para sempre', async () => {
    let chamadas = 0;
    const ok = await recarregarAteAparecer(
      async () => { chamadas++; return [{ id: 'outro' }]; }, 'sumido', semEsperar);

    expect(ok, 'devia devolver false: o item nunca apareceu').toBe(false);
    // 1 imediata + 3 tentativas. Insistir para sempre deixaria a tela travada,
    // que é trocar um defeito por outro.
    expect(chamadas).toBe(4);
  });

  it('sem id, só recarrega uma vez — é o caminho de deletar', async () => {
    let chamadas = 0;
    const ok = await recarregarAteAparecer(
      async () => { chamadas++; return []; }, undefined, semEsperar);

    expect(ok).toBe(true);
    expect(chamadas).toBe(1);
  });

  it('lista vazia não é confundida com "apareceu"', async () => {
    // Se `temOItem` tratasse vazio como sucesso, o bug voltaria calado: o feed
    // sem nenhum post pareceria "já atualizado".
    const ok = await recarregarAteAparecer(async () => [], 'novo', semEsperar);
    expect(ok).toBe(false);
  });
});
