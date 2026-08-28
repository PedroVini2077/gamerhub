import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  modoDaCena, padraoDoAparelho, podeEscolher,
  lerPreferencia, gravarPreferencia,
  CHAVE_PREFERENCIA, LARGURA_MINIMA_3D, NUCLEOS_MINIMOS_3D,
} from '../cena3D';

// Trava da decisão "quem recebe a cena 3D".
//
// Ela vale 887 KB de JavaScript: afrouxar um portão por engano devolve o
// travamento de celular que a rodada de 28/08 consertou, e apertar demais tira
// a cena de um desktop que dava conta — o que já aconteceu uma vez, quando o
// corte de núcleos estava em `<= 4`.
//
// Nada disso quebra nada: a página carrega, o site funciona, e o único sintoma
// é "está lento" ou "sumiu o 3D". Falha silenciosa clássica (CLAUDE.md §1.5),
// e é por isso que ela precisa de teste e não de atenção.
//
// Não há DOM nos testes deste projeto, então o ambiente é montado à mão.

let armazem;

/** Monta um aparelho fictício. Cada campo omitido some do navegador. */
function aparelho({ largura = 1440, nucleos = 8, memoria = 8, conexao, reduzMovimento = false, storageQuebrado = false } = {}) {
  globalThis.window = {
    matchMedia: (consulta) => ({
      matches: consulta.includes('prefers-reduced-motion')
        ? reduzMovimento
        : largura < LARGURA_MINIMA_3D,
    }),
    localStorage: {
      getItem: (k) => { if (storageQuebrado) throw new Error('storage bloqueado'); return armazem.get(k) ?? null; },
      setItem: (k, v) => { if (storageQuebrado) throw new Error('storage bloqueado'); armazem.set(k, v); },
      removeItem: (k) => { if (storageQuebrado) throw new Error('storage bloqueado'); armazem.delete(k); },
    },
  };
  // `globalThis.navigator` é somente-leitura no Node 22: atribuir direto
  // estoura, e o efeito colateral é pior que o erro — os testes passariam
  // usando o `navigator` REAL do Node, que tem `hardwareConcurrency` e não tem
  // `deviceMemory`. Ou seja, passariam pelo motivo errado, medindo esta máquina
  // em vez do aparelho fictício. `defineProperty` é o que realmente substitui.
  const falso = {};
  if (nucleos !== undefined) falso.hardwareConcurrency = nucleos;
  if (memoria !== undefined) falso.deviceMemory = memoria;
  if (conexao) falso.connection = conexao;
  Object.defineProperty(globalThis, 'navigator', { value: falso, configurable: true, writable: true });
}

beforeEach(() => { armazem = new Map(); });
afterEach(() => {
  delete globalThis.window;
  // `delete` não funciona no `navigator` redefinido; devolver um objeto vazio
  // é o que garante que um teste não herde o aparelho do anterior.
  Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true, writable: true });
});

describe('padrão do aparelho', () => {
  it('desktop folgado recebe a cena completa', () => {
    aparelho();
    expect(padraoDoAparelho()).toBe('completo');
  });

  it('tela de celular recebe a versão leve', () => {
    aparelho({ largura: 390 });
    expect(
      padraoDoAparelho(),
      'a largura é o portão que de fato separa celular de PC — celular barato reporta 8 núcleos',
    ).toBe('leve');
  });

  it('desktop de 4 núcleos CONTINUA recebendo a cena completa', () => {
    aparelho({ largura: 1440, nucleos: 4 });
    expect(
      padraoDoAparelho(),
      'este caso é uma regressão real: o corte em <= 4 núcleos derrubou um desktop '
      + `de 1440px com 8 GB. O piso tem que continuar em ${NUCLEOS_MINIMOS_3D}.`,
    ).toBe('completo');
  });

  it.each([
    ['máquina de 2 núcleos', { nucleos: 2 }],
    ['1 GB de memória', { memoria: 1 }],
    ['modo de economia de dados', { conexao: { saveData: true } }],
    ['pedido de menos movimento', { reduzMovimento: true }],
  ])('%s recebe a versão leve mesmo em tela grande', (_, condicao) => {
    aparelho({ largura: 1440, ...condicao });
    expect(padraoDoAparelho()).toBe('leve');
  });

  it('não opina com base em API que o navegador não tem', () => {
    aparelho({ largura: 1440, nucleos: undefined, memoria: undefined });
    expect(
      padraoDoAparelho(),
      'Safari não expõe deviceMemory; ausência não pode virar veredicto de aparelho fraco',
    ).toBe('completo');
  });

  // Trava da correção de 28/08: a decisão precisa ser ESTÁVEL. Se `effectiveType`
  // voltar a decidir, a mesma máquina troca de modo entre visitas conforme o
  // navegador reestima a rede — foi o que o dono viu no notebook dele, e é o
  // tipo de comportamento que ninguém consegue explicar nem reproduzir.
  it('rede lenta NAO decide mais: a cena carrega depois do ocioso', () => {
    aparelho({ largura: 1440, conexao: { effectiveType: 'slow-3g' } });
    expect(
      padraoDoAparelho(),
      'effectiveType e o unico portao que muda com o tempo. Ele existia quando a '
      + 'cena estava no caminho critico; hoje ela carrega depois do ocioso, entao '
      + 'rede lenta atrasa um enfeite em vez de segurar a pagina.',
    ).toBe('completo');
  });

  it('saveData continua decidindo — e escolha explicita de quem usa', () => {
    aparelho({ largura: 1440, conexao: { saveData: true } });
    expect(padraoDoAparelho()).toBe('leve');
  });

  it('cai na versão leve se consultar o ambiente estourar', () => {
    globalThis.window = { matchMedia: () => { throw new Error('sem matchMedia'); } };
    expect(padraoDoAparelho()).toBe('leve');
  });
});

describe('escolha do visitante', () => {
  it('vence o padrão nos dois sentidos', () => {
    aparelho({ largura: 390 });
    gravarPreferencia('sim');
    expect(
      modoDaCena(),
      'quem clicou no botão leu o aviso e decidiu; palpite nosso não passa por cima disso',
    ).toBe('completo');

    aparelho({ largura: 1440 });
    gravarPreferencia('nao');
    expect(modoDaCena()).toBe('leve');
  });

  it('apagar a preferência devolve o controle ao aparelho', () => {
    aparelho({ largura: 390 });
    gravarPreferencia('sim');
    gravarPreferencia(null);
    expect(lerPreferencia()).toBeNull();
    expect(modoDaCena()).toBe('leve');
  });

  it('ignora valor estranho guardado no navegador', () => {
    aparelho({ largura: 1440 });
    armazem.set(CHAVE_PREFERENCIA, 'talvez');
    expect(
      lerPreferencia(),
      'valor desconhecido tem que virar "sem preferência", nunca um palpite (CLAUDE.md §4)',
    ).toBeNull();
    expect(modoDaCena()).toBe('completo');
  });

  it('avisa quando o navegador recusa guardar, em vez de mentir', () => {
    aparelho({ largura: 390, storageQuebrado: true });
    expect(
      gravarPreferencia('sim'),
      'sem este retorno a tela recarregaria igual e o botão pareceria quebrado',
    ).toBe(false);
  });
});

describe('quando o botão de troca aparece', () => {
  it('aparece no celular, que roda o modo leve', () => {
    aparelho({ largura: 390 });
    expect(podeEscolher()).toBe(true);
  });

  it('some no desktop rodando o padrão — não há o que desfazer', () => {
    aparelho({ largura: 1440 });
    expect(podeEscolher()).toBe(false);
  });

  it('aparece no desktop de quem escolheu a versão leve', () => {
    aparelho({ largura: 1440 });
    gravarPreferencia('nao');
    expect(
      podeEscolher(),
      'toda ação de estado precisa da inversa acessível a quem a executou (CLAUDE.md §5)',
    ).toBe(true);
  });
});
