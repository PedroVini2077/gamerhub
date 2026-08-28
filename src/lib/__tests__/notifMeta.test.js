import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { NOTIF_META, DESCONHECIDO, metaDaNotificacao } from '../notifMeta';

/**
 * Trava do sino de notificações — deriva entre o que o BANCO grava e o que a
 * tela sabe mostrar (`CLAUDE.md` §6 FASE 4).
 *
 * ── O que ela impede ───────────────────────────────────────────────────────
 *
 * O ícone de cada notificação vinha de dois ternários encadeados no
 * `Header.jsx`, com um `else` no fim. Todo tipo fora de `like` e `moderation`
 * caía nesse `else` e ganhava o ícone de "alguém te seguiu" — silenciosamente,
 * inclusive o `comment`, que já existia no banco havia meses.
 *
 * É a mesma família de bug do `chat` na fila de moderação: ninguém escreveu,
 * ele nasceu no dia em que o banco passou a gravar um valor novo. E o sintoma
 * é o pior de todos — nada quebra, nada loga, só fica errado na tela.
 *
 * ── Como ela confronta os dois lados ───────────────────────────────────────
 *
 * Os tipos nascem em `INSERT INTO notifications` dentro das funções e triggers
 * do banco, e essas funções estão versionadas em `supabase/migrations/` desde
 * que as migrations vieram para o repositório. Então dá para ler o lado do
 * servidor de dentro do Vitest, sem banco nenhum.
 *
 * Provado injetando o bug de volta: removendo `unban` do mapa, este arquivo
 * falha nomeando o tipo e a migration onde ele aparece.
 */

const MIGRATIONS = join(import.meta.dirname, '../../../supabase/migrations');

/**
 * Todo tipo literal que alguma migration insere em `notifications`, com o
 * arquivo onde ele aparece.
 *
 * O `INSERT` costuma quebrar linha entre as colunas e o `VALUES`, então o
 * casamento precisa atravessar quebras — por isso a flag `s`. Tipos passados
 * por variável (`p_type` no `notify_user`) não são literais e não dá para
 * conferir daqui; quem os fornece é sempre outra função, que cai neste mesmo
 * regex no ponto em que chama.
 */
function tiposGravadosPeloBanco() {
  const achados = new Map();
  for (const nome of readdirSync(MIGRATIONS)) {
    if (!nome.endsWith('.sql')) continue;
    const sql = readFileSync(join(MIGRATIONS, nome), 'utf8');
    for (const m of sql.matchAll(
      /INSERT\s+INTO\s+notifications\s*\([^)]*\)\s*VALUES\s*\(\s*[^,]+,\s*'([a-z_]+)'/gis,
    )) {
      if (!achados.has(m[1])) achados.set(m[1], nome);
    }
  }
  return achados;
}

describe('notifMeta — o contrato entre o que o banco grava e o que o sino mostra', () => {
  const gravados = tiposGravadosPeloBanco();

  it('acha tipos nas migrations (guarda contra o regex quebrar em silêncio)', () => {
    expect(
      [...gravados.keys()],
      'não consegui ler nenhum INSERT INTO notifications das migrations — '
      + 'se o regex parar de casar, este arquivo inteiro vira decoração',
    ).toContain('moderation');
  });

  it('todo tipo que o banco grava tem ícone e cor', () => {
    const orfaos = [...gravados]
      .filter(([tipo]) => !(tipo in NOTIF_META))
      .map(([tipo, arquivo]) => `${tipo} (${arquivo})`);

    expect(orfaos, orfaos.length
      ? 'Estes tipos chegam no sino e não têm ícone — caem no visual genérico\n'
        + 'sem ninguém perceber, que é como o `comment` ficou errado por meses.\n'
        + 'Acrescente em src/lib/notifMeta.js, no mapa NOTIF_META:\n  '
        + orfaos.join('\n  ')
      : undefined).toEqual([]);
  });

  it('cada entrada do mapa tem componente de ícone e classe de cor', () => {
    for (const [tipo, meta] of Object.entries(NOTIF_META)) {
      // Ícone do lucide-react é um `forwardRef` — objeto, não função. O que
      // importa aqui é que exista algo renderizável, não a forma dele.
      expect(meta.Icone, `${tipo} está sem componente de ícone`).toBeTruthy();
      expect(meta.cor, `${tipo} está sem classe de cor`).toMatch(/^text-/);
    }
  });

  it('tipo desconhecido cai num visual NEUTRO, nunca no de outro tipo', () => {
    const meta = metaDaNotificacao('tipo_que_ainda_nao_existe');
    expect(
      meta,
      'O desconhecido não pode herdar o ícone de nenhum tipo real — foi assim\n'
      + 'que toda notificação virou "alguém te seguiu" (§4, fallback silencioso).',
    ).toBe(DESCONHECIDO);
    expect(Object.values(NOTIF_META)).not.toContain(meta);
  });

  it('o Header não voltou a decidir ícone por conta própria', () => {
    const header = readFileSync(
      join(import.meta.dirname, '../../components/layout/Header.jsx'), 'utf8',
    );
    expect(
      header,
      'O ícone da notificação voltou a ser escolhido dentro do Header, com um\n'
      + '`else` que engole o tipo desconhecido. A decisão mora em notifMeta.js.',
    ).not.toMatch(/n\.type === '/);
  });
});
