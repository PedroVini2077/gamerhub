import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { varrerFontes } from './varrerFontes';

/**
 * `[24/09]` A categoria saiu da EXPERIÊNCIA — e a coluna FICA no banco.
 *
 * ── As duas metades, e a segunda é a que o dono escreveu em maiúsculas ────
 *
 * **1. A tela não pede mais que a pessoa classifique o que escreveu.** Saíram
 * o seletor do compositor, o filtro do feed, o badge do card e os textos que
 * citavam "dicas, curiosidades, news". Um post da comunidade pode ser
 * pergunta, desabafo, conquista, dúvida — obrigar a escolher uma gaveta é
 * atrito sem ganho.
 *
 * **2. `posts.category` CONTINUA no banco.** Palavras do prompt dele: *"Não
 * executar DROP COLUMN simplesmente porque a UI não usa mais o campo."*
 *
 * A segunda metade é a que precisa de trava, e o motivo é o tempo: daqui a
 * dois meses alguém vai olhar uma coluna que ninguém lê e achar que está
 * limpando. A informação de que **isso foi uma decisão** só existe se estiver
 * escrita onde a pessoa vai esbarrar.
 *
 * ── O que a Fase 0 mediu, e por que isso torna o DROP tentador ────────────
 *
 * Nada no banco lê essa coluna: zero policy, função, view, índice ou
 * constraint. Todos os 404 posts eram `'dica'` — mas 403 eram de robô, então
 * a evidência de que "ninguém usa" se apoia em UM post humano. Não dá para
 * concluir que o recurso foi rejeitado; dá para concluir que **não há dado**.
 * Apagar a coluna com base nisso seria decidir no escuro.
 *
 * ── Provada reinjetando (§2) ──────────────────────────────────────────────
 *
 *   . `DROP COLUMN category` numa migration -> falhou citando o prompt
 *   . seletor de categoria de volta no feed -> falhou nomeando o arquivo
 */

const MIGRATIONS = 'supabase/migrations';

describe('a coluna `posts.category` não é apagada sem decisão do dono', () => {
  const arquivos = readdirSync(MIGRATIONS).filter((n) => n.endsWith('.sql'));

  it('há migrations para varrer', () => {
    expect(arquivos.length, [
      `Não achei migration nenhuma em ${MIGRATIONS}.`,
      '',
      'Sem elas esta trava não olha nada e fica verde para sempre.',
    ].join('\n')).toBeGreaterThan(50);
  });

  it('nenhuma migration derruba a coluna', () => {
    const culpadas = arquivos.filter((nome) => {
      const sql = readFileSync(join(MIGRATIONS, nome), 'utf8')
        .replace(/^\s*--.*$/gm, '');   // prosa cita comando; comentário não conta
      return /ALTER\s+TABLE\s+(public\.)?posts[\s\S]{0,200}?DROP\s+COLUMN[\s\S]{0,40}?category/i
        .test(sql);
    });

    expect(culpadas, [
      'Uma migration está derrubando `posts.category`:',
      '',
      ...culpadas.map((c) => `    ${c}`),
      '',
      'O prompt do dono é explícito, em maiúsculas:',
      '  "NÃO REMOVER posts.category IMEDIATAMENTE"',
      '  "Não executar DROP COLUMN simplesmente porque a UI não usa mais o campo."',
      '',
      'A coluna saiu da EXPERIÊNCIA em 24/09 — não do banco. O destino dela é',
      'decisão dele, depois de um ciclo inteiro sem ninguém sentir falta.',
      '',
      'Se ele decidiu, tire esta trava NO MESMO PR, com a decisão registrada',
      'em `docs/DECISOES-DE-BANCO.md`.',
    ].join('\n')).toEqual([]);
  });
});

describe('a categoria não volta para a experiência', () => {
  // O compositor, o card e o feed — os três lugares de onde ela saiu.
  const fontes = [
    ...varrerFontes('src/components/feed'),
    'src/pages/Home.jsx',
  ];

  it('há arquivos do feed para varrer', () => {
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
      'Publicar no feed não deve exigir que a pessoa classifique o que',
      'escreveu — um post da comunidade é pergunta, desabafo, conquista ou',
      'dúvida, e a gaveta é atrito sem ganho.',
      '',
      'Se a classificação voltar a fazer sentido, ela é decisão de produto e',
      'vai para `docs/DECISOES.md` antes de voltar para a tela. Tirar esta',
      'trava faz parte dessa decisão, não vem antes dela.',
    ].join('\n')).toEqual([]);
  });
});
