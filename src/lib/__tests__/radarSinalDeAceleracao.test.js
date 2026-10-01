import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  rotuloDaAceleracao, sinalDaPauta, medirAceleracao, JANELA_DE_DIAS,
} from '../../../supabase/functions/radar-de-pautas/aceleracao.ts';
import { lerFalhaDaGroq } from '../../../supabase/functions/radar-de-pautas/falhaDaGroq.ts';
import { seloDoSinal } from '../news/aceleracao';

/**
 * `[01/10]` FASE 3 do radar — o sinal de aceleração, e o bug que a extração
 * dele revelou.
 *
 * ── Por que o sinal precisa de trava ──────────────────────────────────────
 *
 * Ele é **enfeite informativo sobre dado real**, que é a combinação mais
 * perigosa que existe numa seção de jornalismo: um rótulo errado não quebra
 * nada, não loga nada, e empurra a decisão editorial para o lado errado com
 * ar de medição. É §1.5 na forma mais silenciosa — ninguém abre o banco para
 * conferir se "3x o normal" é verdade.
 *
 * As três perguntas daqui:
 *   1. o rótulo diz a verdade sobre os números que recebeu?
 *   2. o sinal falhando derruba as pautas?  (não pode)
 *   3. a mensagem de falha da Groq ainda é a verdadeira?
 *
 * ── A terceira é um BUG REAL, encontrado em 01/10 ao dividir o arquivo ────
 *
 * O `index.ts` montava a resposta num builder chamado `corpo()` — e dentro do
 * `if (!res.ok)` havia um `const corpo = await res.text()`. A string sombreava
 * o builder, então `corpo({...})` lançava `TypeError: corpo is not a
 * function`, o `try/catch` em volta engolia, e a tela dizia **"A IA respondeu
 * algo que eu nao entendi"** sobre um `429` de cota.
 *
 * O `admin_logs` ficava certo (o `gritar` acontece antes), então a mentira era
 * só para quem clicou — e é exatamente o caso que o §1.5 chama de pior do que
 * erro nenhum: "você não tem permissão" quando o motivo é outro manda a pessoa
 * investigar o lugar errado.
 *
 * **A causa raiz é de classe, não de caso:** tradução de erro embutida no
 * fluxo não tem como ser exercitada sem rede. Por isso ela virou
 * `falhaDaGroq.ts`, pura, e estes testes a executam de verdade.
 */

const INDEX = readFileSync('supabase/functions/radar-de-pautas/index.ts', 'utf8');

describe('o rotulo da aceleracao nao diz mais do que os numeros sustentam', () => {
  it('sem mencao hoje, nao ha sinal nenhum', () => {
    expect(rotuloDaAceleracao({ termo: 'x', hoje: 0, antes: 40, desde: null })).toBe('');
    expect(rotuloDaAceleracao(undefined)).toBe('');
  });

  it('sem passado, a palavra e "novo" — nunca um multiplicador', () => {
    // Dividir por zero daria Infinity, e "Infinityx o normal" na tela seria a
    // forma mais barata de o radar perder credibilidade.
    const r = rotuloDaAceleracao({ termo: 'x', hoje: 9, antes: 0, desde: null });
    expect(r).toBe('novo e forte');
    expect(r).not.toMatch(/Infinity|NaN/);
    expect(rotuloDaAceleracao({ termo: 'x', hoje: 1, antes: 0, desde: null })).toBe('novo');
  });

  it('o multiplicador bate com a conta que quem le consegue refazer', () => {
    expect(rotuloDaAceleracao({ termo: 'x', hoje: 16, antes: 4, desde: null })).toBe('4x o normal');
    expect(rotuloDaAceleracao({ termo: 'x', hoje: 6, antes: 3, desde: null })).toBe('crescendo');
  });

  it('assunto ESFRIANDO e dito, e assunto estavel nao ganha rotulo', () => {
    // Pauta velha disfarcada de novidade e o erro que um radar de atualidade
    // nao pode cometer — calar o "esfriando" seria so mostrar boa noticia.
    expect(rotuloDaAceleracao({ termo: 'x', hoje: 2, antes: 10, desde: null })).toBe('esfriando');
    expect(rotuloDaAceleracao({ termo: 'x', hoje: 10, antes: 9, desde: null })).toBe('');
  });

  it('a pauta herda o sinal MAIS FORTE dos termos dela, nao a media', () => {
    const medidas = new Map([
      ['nome proprio', { termo: 'nome proprio', hoje: 16, antes: 2, desde: null }],
      ['generico',     { termo: 'generico',     hoje: 10, antes: 10, desde: null }],
    ]);
    // Media diluiria justamente o termo que carrega o sinal.
    expect(sinalDaPauta(['nome proprio', 'generico'], medidas)).toBe('8x o normal');
    expect(sinalDaPauta(['nao medido'], medidas)).toBe('');
  });
});

describe('o sinal falhando nao pode custar as pautas', () => {
  it('erro do banco devolve mapa vazio em vez de estourar', async () => {
    const m = await medirAceleracao(['alguma coisa'],
      () => Promise.resolve({ data: null, error: { message: 'boom' } }));
    expect(m.size).toBe(0);
  });

  it('a RPC lancando tambem nao estoura', async () => {
    const m = await medirAceleracao(['alguma coisa'], () => { throw new Error('rede'); });
    expect(m.size).toBe(0);
  });

  it('uma chamada so, com os termos de TODAS as pautas e sem repetidos', async () => {
    const vistos = [];
    await medirAceleracao([' alfa ', 'alfa', 'beta', 'xx'], (termos, dias) => {
      vistos.push({ termos, dias });
      return Promise.resolve({ data: [], error: null });
    });
    expect(vistos).toHaveLength(1);              // 8 pautas nao viram 24 consultas
    expect(vistos[0].termos).toEqual(['alfa', 'beta']);  // 'xx' tem menos de 3 chars
    expect(vistos[0].dias).toBe(JANELA_DE_DIAS);
  });

  it('o sinal e a ULTIMA coisa do fluxo — pautas prontas antes dele', () => {
    // Se ele subisse para antes do `resolverPautas`, uma falha dele passaria a
    // custar o conteudo em vez de custar o enfeite.
    expect(INDEX.indexOf('medirAceleracao(')).toBeGreaterThan(INDEX.indexOf('resolverPautas('));
  });
});

describe('a mensagem de falha da Groq continua sendo a verdadeira', () => {
  const CORPO_429_DIA = '{"error":{"message":"Rate limit reached ... limit per day (RPD)"}}';
  const CORPO_429_MIN = '{"error":{"message":"Rate limit reached ... tokens per minute (TPM)"}}';
  const CORPO_SEM_ESPACO = '{"error":{"code":"json_validate_failed","failed_generation":""}}';

  it('cota DIARIA manda esperar amanha; teto por MINUTO manda esperar um minuto', () => {
    const dia = lerFalhaDaGroq(429, CORPO_429_DIA);
    expect(dia.status).toBe('cota');
    expect(dia.aviso).toMatch(/amanha/i);

    const minuto = lerFalhaDaGroq(429, CORPO_429_MIN);
    expect(minuto.status).toBe('erro_provedor');       // nao e "volte amanha"
    expect(minuto.aviso).toMatch(/um minuto/i);
  });

  it('413 e defeito NOSSO, e o aviso diz isso', () => {
    // Culpar a cota da Groq por um orcamento que nos erramos mandaria o dono
    // esperar ate amanha por algo que o proximo clique resolveria.
    const f = lerFalhaDaGroq(413, 'Request too large ... TPM: Limit 8000');
    expect(f.status).toBe('erro_provedor');
    expect(f.aviso).toMatch(/defeito nosso/i);
    expect(f.motivo).toMatch(/8000/);
  });

  it('400 com failed_generation VAZIO aponta o raciocinio, nao o JSON', () => {
    expect(lerFalhaDaGroq(400, CORPO_SEM_ESPACO).motivo).toMatch(/raciocinio|max_tokens/i);
  });

  it('status desconhecido diz o numero em vez de chutar a causa', () => {
    expect(lerFalhaDaGroq(502, 'bad gateway').motivo).toMatch(/502/);
  });

  /**
   * A TRAVA DO BUG, e ela e de CLASSE.
   *
   * O builder `corpo()` monta TODAS as respostas (ele existe porque cinco
   * caminhos esqueciam o campo `fontes`). Qualquer `const`/`let` chamado
   * `corpo` dentro do handler o sombreia, e o `try/catch` em volta transforma
   * o `TypeError` em mensagem errada na tela — sem erro, sem log, sem teste.
   */
  it('nada sombreia o builder `corpo()` dentro do handler', () => {
    const declaracoes = INDEX.match(/\b(?:const|let|var)\s+corpo\b/g) ?? [];
    expect(declaracoes, 'o builder `corpo()` tem que ser o UNICO `corpo` do arquivo — '
      + 'uma segunda declaracao o sombreia e `corpo({...})` vira TypeError, '
      + 'que o try/catch engole e vira "A IA respondeu algo que eu nao entendi"')
      .toHaveLength(1);
  });
});

describe('o vocabulario do sinal nao deriva entre o servidor e a tela', () => {
  /**
   * `[01/10]` São DUAS cópias: `aceleracao.ts` produz o texto, `news/aceleracao.js`
   * o desenha. O lado perigoso é o servidor ganhar um rótulo que a tela não
   * conhece — o sinal some da tela, e **nada estoura** (§1.5).
   *
   * A lista do servidor é levantada EXECUTANDO `rotuloDaAceleracao` sobre uma
   * grade de números, e não lendo o arquivo com regex: a mesma lição do
   * `vocabularioDoNewsNaoDeriva`, cuja extração descartava `in_review` em
   * silêncio por não aceitar `_`.
   */
  const produzidos = new Set();
  for (let hoje = 0; hoje <= 40; hoje++) {
    for (let antes = 0; antes <= 40; antes++) {
      const r = rotuloDaAceleracao({ termo: 't', hoje, antes, desde: null });
      if (r) produzidos.add(r);
    }
  }

  it('a grade produz rotulos de verdade (senao este teste nao testa nada)', () => {
    // Sem este controle, um `rotuloDaAceleracao` que passasse a devolver ''
    // sempre faria o teste abaixo passar sobre um conjunto vazio.
    expect(produzidos.size).toBeGreaterThan(5);
  });

  it('TODO rotulo que o servidor produz, a tela sabe desenhar', () => {
    const orfaos = [...produzidos].filter((r) => seloDoSinal(r) === null);
    expect(orfaos, 'rotulo que o servidor produz e a tela descarta — o sinal sumiria '
      + 'da tela sem erro nenhum. Acrescente em SINAIS de src/lib/news/aceleracao.js')
      .toEqual([]);
  });

  it('a tela RECUSA o que o servidor nao produz', () => {
    // Aceitar texto livre faria qualquer string virar selo — e ela entra numa
    // `className`, que e o caminho classico de um valor solto virar problema.
    expect(seloDoSinal('bombando')).toBeNull();
    expect(seloDoSinal('9999x o normal')).toBeNull();   // o servidor arredonda
    expect(seloDoSinal('')).toBeNull();
    expect(seloDoSinal(undefined)).toBeNull();
  });
});
