import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REGRAS, humanizarErroDoBanco } from '../errosDoBanco';
import { fail } from '../../services/result';

/**
 * `[26/09]` O Postgres cru não volta para a tela.
 *
 * ── O caso que originou ───────────────────────────────────────────────────
 *
 * O dono clicou em "Publicar" numa matéria sem corpo e leu isto na tela:
 *
 *     new row for relation "news_articles" violates check constraint
 *     "news_articles_corpo_exigido_no_ar"
 *
 * Havia um `traduzir()` dentro do `newsEditorialService` — com TRÊS constraints
 * escritas à mão, de 64 que o banco tem. A que ele esbarrou não era nenhuma
 * das três, e o `return error` do fim deixou o inglês passar.
 *
 * Por isso a trava olha a CLASSE, não o caso: o tradutor ser chamado do
 * `fail()` (um lugar, todos os services), o mapa não ter frase em inglês, e a
 * frase genérica continuar honesta quando a regra é desconhecida.
 */

const JARGAO = /violates|constraint|relation\s+"|duplicate key|null value in column|permission denied/i;

/** O erro exato que ele viu, como o supabase-js o entrega. */
const O_ERRO_DELE = {
  code: '23514',
  message: 'new row for relation "news_articles" violates check constraint '
         + '"news_articles_corpo_exigido_no_ar"',
};

describe('o erro que o dono viu', () => {
  it('vira uma frase que ensina o que fazer', () => {
    const { message, tecnico } = humanizarErroDoBanco(O_ERRO_DELE);
    expect(message).toMatch(/corpo/i);
    expect(message, 'a frase para o usuario ainda tem jargao de banco').not.toMatch(JARGAO);
    // E o original NÃO se perde: trocar erro verdadeiro por frase bonita é a
    // outra metade do §1.5.
    expect(tecnico).toBe(O_ERRO_DELE.message);
  });

  it('a traducao acontece no `fail()`, e nao em cada service', () => {
    // Esta é a trava de verdade. Se alguém tirar `humanizarErroDoBanco` do
    // `fail()`, cada service volta a decidir sozinho — que é exatamente o
    // estado em que o inglês chegou na tela.
    const { error } = fail(O_ERRO_DELE);
    expect(error.message, 'o `fail()` de services/result.js parou de traduzir. '
      + 'Sem ele, TODO service volta a devolver o texto cru do Postgres para a '
      + 'tela — foi assim que `violates check constraint` apareceu embaixo dos '
      + 'botoes do painel editorial.').not.toMatch(JARGAO);
  });
});

describe('o mapa de regras', () => {
  it('nao tem frase vazia nem jargao de banco', () => {
    const ruins = Object.entries(REGRAS).filter(
      ([, frase]) => !frase?.trim() || JARGAO.test(frase),
    );
    expect(ruins.map(([k]) => k)).toEqual([]);
  });

  it('cobre toda constraint NOMEADA nas migrations', () => {
    // O que esta checagem pega: migration nova declarando
    // `CONSTRAINT x CHECK (...)` sem ninguém escrever a frase. Sem isto, a
    // regra nova só é descoberta quando alguém a esbarra na tela — que foi
    // exatamente o caso do `corpo_exigido_no_ar`.
    const dir = 'supabase/migrations';
    const arquivos = readdirSync(dir).filter((n) => n.endsWith('.sql'));
    expect(arquivos.length, `${dir} nao tem migration nenhuma — a pasta mudou de `
      + 'lugar? Sem esta guarda a checagem passaria verde sem ler nada.')
      .toBeGreaterThan(50);

    const declaradas = new Set();
    for (const nome of arquivos) {
      const sql = readFileSync(join(dir, nome), 'utf8');
      for (const m of sql.matchAll(/\bCONSTRAINT\s+([a-z0-9_]+)\s+(?:CHECK|UNIQUE)\b/gi)) {
        declaradas.add(m[1].toLowerCase());
      }
      // `ADD CONSTRAINT x CHECK`, e o `DROP CONSTRAINT` que a desfaz.
      for (const m of sql.matchAll(/DROP\s+CONSTRAINT\s+(?:IF\s+EXISTS\s+)?([a-z0-9_]+)/gi)) {
        declaradas.delete(m[1].toLowerCase());
      }
    }

    const semFrase = [...declaradas].filter((c) => !(c in REGRAS)).sort();
    expect(semFrase, 'estas constraints existem nas migrations e nao tem frase em '
      + 'portugues em `REGRAS` (src/lib/errosDoBanco.js). Quem esbarrar nelas le o '
      + 'texto do Postgres em ingles na tela. Escreva a frase, ou — se a tela '
      + 'genuinamente nao alcanca a regra — acrescente com o motivo ao lado.')
      .toEqual([]);
  });
});

describe('o que a traducao NAO pode fazer', () => {
  it('nao mexe no `RAISE EXCEPTION` das nossas RPCs', () => {
    // `P0001` é nosso, e a frase já foi escrita em português para o toast
    // (docs/regras/BANCO.md). Traduzir de novo apagaria a boa.
    const nosso = { code: 'P0001', message: 'Suspensao deve ser de 1 a 30 dias.' };
    expect(humanizarErroDoBanco(nosso)).toBe(nosso);
  });

  it('devolve intacto o erro que nao reconheceu', () => {
    // Inventar frase para erro nao identificado seria trocar informação
    // verdadeira por chute (§4, fallback silencioso).
    const estranho = { code: 'XX000', message: 'algo muito esquisito' };
    expect(humanizarErroDoBanco(estranho)).toBe(estranho);
  });

  it('e honesta quando a REGRA e desconhecida mas a forma e conhecida', () => {
    const novo = {
      code: '23514',
      message: 'new row for relation "x" violates check constraint "x_regra_nova"',
    };
    const { message, tecnico, regra } = humanizarErroDoBanco(novo);
    expect(message).not.toMatch(JARGAO);
    expect(message, 'a frase generica precisa NOMEAR a regra — sem isso ninguem '
      + 'descobre qual constraint escrever no mapa').toMatch(/regra nova/);
    expect(regra).toBe('x_regra_nova');
    expect(tecnico).toBe(novo.message);
  });

  it('nao se engana com `null` nem com erro sem mensagem', () => {
    expect(humanizarErroDoBanco(null)).toBe(null);
    const vazio = { code: '23514' };
    expect(humanizarErroDoBanco(vazio)).toBe(vazio);
  });
});
