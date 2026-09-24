import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { varrerFontes } from './varrerFontes';

/**
 * `[24/09]` A categoria saiu da experiência — e depois a coluna foi APAGADA.
 *
 * ── A história desta trava, porque ela mudou de forma no mesmo dia ────────
 *
 * Ela nasceu de manhã protegendo o CONTRÁRIO: reprovava qualquer migration que
 * derrubasse `posts.category`, porque o prompt do dono dizia, em maiúsculas,
 * *"NÃO REMOVER posts.category IMEDIATAMENTE"*.
 *
 * À tarde ele desfez isso com todas as letras — o trecho tinha vindo de outra
 * IA, preocupada com o número de lugares que mencionavam a coluna — e
 * autorizou o descarte **sob condição**: *"apenas dê uma olhada, se tiver de
 * boa e não quebrar nada"*.
 *
 * A olhada achou um leitor que a Fase 0 tinha perdido, e a trava fez o trabalho
 * dela: **reprovou o DROP** antes de ele ir para a `main`. O que mudou depois
 * não foi a trava estar errada — foi a decisão.
 *
 * ── O que ela protege AGORA ───────────────────────────────────────────────
 *
 * **1. Nenhuma função de trigger pode voltar a ler a coluna.** A coluna não
 * existe mais: `NEW.category` num trigger de `posts` vira
 * `record "new" has no field "category"` e **publicar para de funcionar**.
 * Medido em ROLLBACK antes do drop, com o trigger antigo:
 *
 *     INSERT INTO posts ... -> ERRO: record "new" has no field "category"
 *
 * Isso quebra alto, não em silêncio — mas quebra o caminho mais importante do
 * site, e um teste que falha em 200ms é mais barato que um CI de 5 minutos.
 *
 * **2. A classificação não volta para a tela.** Publicar não deve exigir que a
 * pessoa escolha uma gaveta para o que escreveu.
 *
 * ── Por que a varredura olha a ÚLTIMA migration, e não todas ──────────────
 *
 * As migrations são histórico: a que criava o trigger com `NEW.category`
 * continua no repositório, e tem de continuar — ela conta o que aconteceu.
 * Acusá-la seria reprovar o passado. O que importa é a **definição vigente**,
 * que é a da migration mais recente que toca a função.
 *
 * ── Provada reinjetando (§2) ──────────────────────────────────────────────
 *
 *   . migration nova pondo `NEW.category` de volta -> falhou nomeando-a
 *   . seletor de categoria de volta no feed        -> falhou nomeando o arquivo
 *   . CONTROLE: a migration histórica que lia      -> NÃO acusa
 */

const MIGRATIONS = 'supabase/migrations';
const ALVO = 'log_post_event';

/** Migrations que definem o trigger, da mais antiga para a mais nova. */
function migrationsQueDefinemOTrigger() {
  const todas = readdirSync(MIGRATIONS).filter((n) => n.endsWith('.sql')).sort();
  const definem = todas.filter((n) =>
    new RegExp(`FUNCTION\\s+(public\\.)?${ALVO}\\s*\\(`, 'i')
      .test(readFileSync(join(MIGRATIONS, n), 'utf8')));

  if (definem.length === 0) {
    throw new Error(
      `Nenhuma migration define \`${ALVO}\`.\n`
      + '  Ou ele mudou de nome, ou esta trava parou de enxergá-lo — e nos dois\n'
      + '  casos ela ficaria verde para sempre sem olhar nada.');
  }
  return definem;
}

describe('nada volta a ler a coluna `posts.category`, que foi apagada', () => {
  const definem = migrationsQueDefinemOTrigger();
  const vigente = definem[definem.length - 1];

  it('há histórico do trigger para varrer', () => {
    expect(definem.length).toBeGreaterThanOrEqual(1);
  });

  it(`a definição VIGENTE (${''}) não lê NEW.category nem OLD.category`, () => {
    const sql = readFileSync(join(MIGRATIONS, vigente), 'utf8')
      .replace(/^\s*--.*$/gm, '');   // prosa cita o campo ao explicar por que saiu

    const achados = [...sql.matchAll(/\b(NEW|OLD)\.category\b/g)].map((m) => m[0]);

    expect(achados, [
      `A definição vigente de \`${ALVO}\` (${vigente}) voltou a ler a coluna:`,
      `    ${[...new Set(achados)].join(', ')}`,
      '',
      '`posts.category` foi APAGADA em 24/09. Um trigger que a lê estoura com',
      '`record "new" has no field "category"` — e o INSERT não acontece, ou',
      'seja: PUBLICAR PARA DE FUNCIONAR para todo mundo.',
      '',
      'Medido em ROLLBACK antes do drop, exatamente com esse erro.',
      '',
      'Se a coluna precisar voltar, ela volta numa migration ANTES desta, e a',
      'decisão vai para `docs/DECISOES-DE-BANCO.md`.',
    ].join('\n')).toEqual([]);
  });

  it('nenhuma migration NOVA reintroduz a leitura fora do trigger', () => {
    // O corte é a data do drop: o que veio antes é história e fica.
    const DEPOIS_DO_DROP = '20260924201500';
    const novas = readdirSync(MIGRATIONS)
      .filter((n) => n.endsWith('.sql') && n > DEPOIS_DO_DROP);

    const culpadas = novas.filter((n) =>
      /\b(NEW|OLD)\.category\b/.test(
        readFileSync(join(MIGRATIONS, n), 'utf8').replace(/^\s*--.*$/gm, '')));

    expect(culpadas, [
      'Migration posterior ao drop voltou a ler `NEW.category`/`OLD.category`:',
      ...culpadas.map((c) => `    ${c}`),
      '',
      'A coluna não existe mais. Qualquer leitura dela num trigger de `posts`',
      'derruba o publicar.',
    ].join('\n')).toEqual([]);
  });
});

describe('a categoria não volta para a experiência', () => {
  const fontes = [
    ...varrerFontes('src/components/feed'),
    'src/pages/Home.jsx',
    'src/services/postService.js',
    'src/services/postSelect.js',
  ];

  it('há arquivos para varrer', () => {
    expect(fontes.length).toBeGreaterThan(5);
  });

  it.each(fontes)('%s não classifica post por categoria', (arquivo) => {
    const fonte = readFileSync(arquivo, 'utf8')
      // A prosa explica POR QUE a categoria saiu — citar não é usar.
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\/\/[^\n]*/g, ' ');

    const achados = [
      ...fonte.matchAll(/\bpost\.category\b|\bsetCategory\b|\bCATEGORIES\b|\bcategoryConfig\b/g),
    ].map((m) => m[0]);

    expect(achados, [
      `${arquivo} voltou a tratar categoria de post: ${[...new Set(achados)].join(', ')}`,
      '',
      'A coluna `posts.category` foi APAGADA do banco em 24/09 — isto não é só',
      'uma escolha de UI, é código que não tem mais onde se apoiar.',
      '',
      'Se a classificação voltar a fazer sentido, ela é decisão de produto e',
      'vai para `docs/DECISOES.md` antes de voltar para a tela — com a coluna',
      'recriada numa migration própria.',
    ].join('\n')).toEqual([]);
  });
});
