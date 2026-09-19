import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `[19/09]` SEC-046 — o bônus de perfil exige caractere VISÍVEL.
 *
 * ── O achado que o levantamento externo deu como PASS ─────────────────────
 *
 * N3 ("campos vazios geravam XP") foi retestado com string vazia, string com
 * ESPAÇOS e NULL. Os três passaram, e o achado virou PASS. O teste estava
 * certo; o alcance é que era menor do que parecia:
 *
 *     trim() do PostgreSQL remove BRANCO ASCII. Só isso.
 *
 *     length(trim('   '))    = 0   <- o que foi testado
 *     length(trim(U+200B))   = 1   <- ZERO WIDTH SPACE
 *     length(trim(U+00A0))   = 1   <- NO-BREAK SPACE
 *     length(trim(U+FEFF))   = 1   <- BOM
 *
 * Medido, colando invisível em bio/avatar/discord/twitch/youtube:
 *
 *     ANTES profile_bonus = 125   ·   DEPOIS = 0
 *
 * ── Provada reinjetando o bug (§2) ───────────────────────────────────────
 *
 *   . a view volta a usar `length(trim(...))`  -> falha nomeando o U+200B
 *   . `texto_visivel` deixa de cobrir U+200B   -> falha nomeando o range
 */

const PASTA = 'supabase/migrations';
const SQL = (() => {
  const nomes = readdirSync(PASTA).filter(n => n.endsWith('.sql')).sort();
  if (nomes.length === 0) throw new Error(`Nenhuma migration em "${PASTA}".`);
  return nomes.map(n => readFileSync(join(PASTA, n), 'utf8')
    .replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ')).join('\n');
})();

/** A ÚLTIMA definição da view, que é a que vale hoje. */
const view = (() => {
  const m = SQL.match(/CREATE\s+OR\s+REPLACE\s+VIEW\s+(?:public\.)?xp_dos_usuarios[\s\S]*?;/gi);
  return m ? m[m.length - 1] : null;
})();

describe('SEC-046 — o XP só paga o que APARECE', () => {
  it('a função `texto_visivel` existe', () => {
    expect(SQL, [
      'A função `texto_visivel` sumiu das migrations.',
      'Ela responde "sobra algum caractere VISÍVEL?" — a pergunta que `trim`',
      'não responde, porque `trim` só tira branco ASCII.',
    ].join('\n')).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:public\.)?texto_visivel/i);
  });

  /** O corpo da ÚLTIMA definição de `texto_visivel`, que é a que vale hoje. */
  const fn = (() => {
    const m = SQL.match(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:public\.)?texto_visivel[\s\S]*?\$fn\$[\s\S]*?\$fn\$/gi);
    return m ? m[m.length - 1] : '';
  })();

  /**
   * A classe de caracteres da função, RECONSTRUÍDA e testada de verdade.
   *
   * Comparar o TEXTO não servia, e isso foi descoberto aqui: o arquivo pode
   * guardar `\u200b` como escape literal OU como o caractere já interpretado,
   * dependendo de quem escreveu a migration. Uma trava que casa texto reprova
   * (ou aprova) pela grafia, não pelo comportamento.
   *
   * Aqui os pedaços `E'...'` são concatenados, os escapes viram caractere, e a
   * classe é montada como RegExp — então o teste pergunta o que importa:
   * **esse caractere É removido?**
   */
  const classe = (() => {
    const corpo = fn.match(/'\['([\s\S]*?)\|\|\s*'\]'/);
    if (!corpo) return null;
    return corpo[1]
      .split('||')
      // Aceita `E'...'` E `'...'` sem o E. Ler so os `E'...'` deixava passar
      // caractere acrescentado por literal simples — provado reinjetando `a-z`,
      // que a versao anterior desta trava NAO pegou.
      .map(p => (p.match(/E?'([\s\S]*)'/) || [])[1] || '')
      .join('')
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  })();

  const INVISIVEIS = [
    ['200b', 'ZERO WIDTH SPACE — o mais fácil de colar, sai de qualquer site'],
    ['00a0', 'NO-BREAK SPACE — o que o Word e o navegador produzem sozinhos'],
    ['3000', 'IDEOGRAPHIC SPACE — teclado japonês/chinês gera direto'],
    ['feff', 'BOM — vem colado em texto copiado de arquivo'],
    ['2060', 'WORD JOINER'],
    ['0020', 'espaço comum — o único que `trim` já pegava'],
  ];

  it('a classe de caracteres foi reconstruída (senão o teste não olha nada)', () => {
    expect(classe, [
      'Não consegui reconstruir a classe de caracteres de `texto_visivel`.',
      'O formato mudou. Sem esta guarda, os testes abaixo passariam verdes sem',
      'nunca ter testado um caractere.',
    ].join('\n')).toBeTruthy();
    expect(classe.length, 'A classe veio vazia.').toBeGreaterThan(10);
  });

  it.each(INVISIVEIS)('U+%s é removido antes de contar (%s)', (hex, porque) => {
    const ch = String.fromCharCode(parseInt(hex, 16));
    const removido = new RegExp('[' + classe + ']', 'u').test(ch);

    expect(removido, [
      `O caractere U+${hex.toUpperCase()} saiu de \`texto_visivel\`.`,
      '',
      `Contexto: ${porque}.`,
      '',
      'Ele SOBREVIVE a `trim()` — medido: `length(trim(X)) = 1`. Sem ele na',
      'classe, colar esse caractere em bio/discord/twitch/youtube/avatar volta a',
      'pagar bônus de perfil com a tela mostrando VAZIO.',
      '',
      'Medido antes da correção: 125 XP de graça, e o teto é 140. XP alimenta o',
      '`check_staff_eligibility` (>= 1000 vira admin).',
    ].join('\n')).toBe(true);
  });

  it.each([['a','letra'],['9','número'],['🎮','emoji'],['ç','acento']])(
    'o caractere VISÍVEL %s (%s) NÃO é removido', (ch) => {
      expect(new RegExp('[' + classe + ']', 'u').test(ch), [
        `A classe passou a remover \`${ch}\`, que é VISÍVEL.`,
        '',
        'Isso não é endurecimento — é o contrário: um perfil preenchido de',
        'verdade passaria a não pagar bônus nenhum, e ninguém entenderia por quê.',
      ].join('\n')).toBe(false);
    });

  it('a view usa `texto_visivel`, e NÃO voltou para `trim`', () => {
    expect(view, 'A view `xp_dos_usuarios` sumiu das migrations.').toBeTruthy();

    expect(view, [
      'A view voltou a medir o bônus de perfil com `length(trim(...))`.',
      '',
      'Isso reabre o N3 pela porta do Unicode: `trim` remove branco ASCII e mais',
      'nada, então `U+200B` e companhia continuam contando como "preenchido".',
      '',
      'Use `texto_visivel(campo)` nos seis campos.',
    ].join('\n')).not.toMatch(/length\s*\(\s*trim\s*\(/i);

    const quantos = (view.match(/texto_visivel\s*\(/gi) || []).length;
    expect(quantos, [
      `Só ${quantos} dos 6 campos do bônus usam \`texto_visivel\`.`,
      '',
      'São seis: bio, avatar_url, platform, discord, twitch, youtube. Um campo',
      'de fora é um campo que continua pagando por caractere invisível — e a',
      'regra fica repetida em dois formatos, que é como ela diverge (§4).',
    ].join('\n')).toBe(6);
  });
});

describe('SEC-048 — os handles que viram href são lista BRANCA', () => {
  it('existe CHECK de formato nos três campos sociais', () => {
    expect(SQL, [
      'O CHECK `profiles_redes_sao_handles` sumiu.',
      '',
      'Esses campos são interpolados em `href` no `UserProfile.jsx`. Sem o',
      'CHECK, `discord`/`twitch`/`youtube` aceitam barra, `?`, `@host` e espaço.',
      '',
      'Não é redirecionamento aberto (o host é literal), mas produz link torto',
      'e é superfície que não precisa existir.',
    ].join('\n')).toMatch(/profiles_redes_sao_handles/i);
  });

  it('o `@` do YouTube continua permitido — foi a regressão que me pegou', () => {
    const check = SQL.match(/profiles_redes_sao_handles[\s\S]*?\)\);/i)?.[0] || '';
    expect(check, [
      'O padrão dos handles deixou de aceitar `@` no começo.',
      '',
      '`@fulano` é handle LEGÍTIMO do YouTube. A primeira versão desta regra era',
      'lista NEGRA de caracteres e barrava exatamente isso — minha própria',
      'regressão pegou. Lista negra esquece caso; lista branca diz o que É',
      'válido.',
    ].join('\n')).toMatch(/\^@\?/);
  });

  it('existe CHECK de tamanho (egress é a cota mais apertada)', () => {
    expect(SQL, [
      'O CHECK `profiles_tamanhos_razoaveis` sumiu.',
      'Uma `bio` de 5.000 caracteres viaja em TODO carregamento de perfil.',
    ].join('\n')).toMatch(/profiles_tamanhos_razoaveis/i);
  });
});
