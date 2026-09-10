import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { varrerFontes } from './varrerFontes';

/**
 * TRAVA: todo `delete()` no banco tem que CONFERIR quantas linhas caíram.
 *
 * ── O achado que produziu esta trava (auditoria de 10/09) ───────────────────
 *
 * O painel do admin apagava post da lixeira com
 * `supabase.from('posts').delete().eq('id', postId)` — sem `count`. E a RLS de
 * `posts` tem uma assimetria **proposital**:
 *
 * | operação | regra |
 * | --- | --- |
 * | VER a lixeira | `role_rank(...) >= 2` — plana, qualquer admin vê tudo |
 * | APAGAR | `can_moderate_content(user_id)` — hierarquia ESTRITA (`>`) |
 *
 * As duas estão certas separadamente. Juntas, elas criam o caso em que o admin
 * **enxerga na tela** um post que **não pode apagar** — o do owner, o de outro
 * admin. E `DELETE` recusado pela RLS devolve **0 linhas e nenhum erro**.
 *
 * Medido em ROLLBACK, com um post do owner na lixeira:
 *
 * ```
 * 1_admin_ve_na_lixeira  1 linha(s) — SIM, aparece na tela dele
 * 2_delete_individual    0 linha(s) apagada(s) — BLOQUEADO pela RLS, E SEM ERRO
 * 3_apagar_todos         a tela conta 176, o banco apaga 175 -> A TELA MENTE
 * ```
 *
 * O estrago não é o post sobreviver — é o site **dizer que apagou**: o toast
 * dava "apagado permanentemente" e o `logAudit` gravava
 * `admin_permanent_delete_post` na trilha. Uma exclusão que nunca aconteceu,
 * escrita na trilha de auditoria do dono (§1.5, e BANCO.md: *"a trilha passa a
 * mentir"*).
 *
 * ── Por que a trava varre a CLASSE e não conserta o caso ────────────────────
 *
 * §1.3: *"onde mais esse mesmo padrão existe?"*. Eram três chamadas iguais em
 * três arquivos diferentes, e a próxima nasce na próxima tela de admin. O
 * `handleDeletePosts`, no mesmo arquivo, já fazia certo desde sempre — o padrão
 * existia e não estava sendo seguido, que é o caso clássico do §4.
 *
 * ── A saída de emergência, e por que ela exige texto ────────────────────────
 *
 * Existe um caso legítimo de 0 linhas: descurtir. `delete().eq('user_id', ...)`
 * na própria curtida devolve 0 quando a curtida **já não existe** — objetivo
 * atingido, não falha (§1.5, "0 linhas é AMBÍGUO"). Esses ganham o marcador
 * `0-linhas-ok:` com o motivo escrito ao lado.
 *
 * O marcador exige motivo de propósito: silenciar a trava tem que custar uma
 * frase, senão vira o `eslint-disable` que a §6.1 proíbe.
 */

/** O marcador que dispensa a conferência — precisa vir com motivo. */
const MARCADOR = /\/\/\s*0-linhas-ok:\s*\S+/;

/** Quantas linhas antes da chamada ainda contam como "ao lado dela". */
const ALCANCE = 3;

/**
 * `[10/09]` A trava passou a cobrir `update()` também.
 *
 * Ela nasceu só para `delete()`, e o `update()` ficou registrado no backlog com
 * o número medido. Ao auditá-los, **oito** não conferiam a contagem, e dois
 * eram os piores da lista: o item da fila de moderação que podia não sair de
 * `pending` depois de o conteúdo já ter sido ocultado, e os dois pedidos de
 * reativação de live, que não checavam **nem `error`, nem contagem**.
 *
 * A contagem antiga do backlog dizia "13". O número certo é menor: aquele
 * `grep` era por LINHA, e chamada quebrada em várias linhas põe o
 * `{ count: 'exact' }` numa linha diferente da do `.update(` — o
 * `contatoService.js` já estava correto e foi contado como faltando.
 */
const VERBOS = /\.(delete|update)\(/;

/**
 * Acha as escritas que falam com o BANCO, separando-as das que mexem em
 * `Set`/`Map` — `objectUrls.js` e `dbHealth.js` têm `.delete(x)` que não tem
 * nada a ver com Supabase, e reprovar por eles seria ruído (§0.2, 4ª regra).
 */
function apagamentosDeBanco(fonte) {
  const achados = [];
  const linhas = fonte.split('\n');

  for (let i = 0; i < linhas.length; i++) {
    if (!VERBOS.test(linhas[i])) continue;

    // A chamada do Supabase é sempre `.from('tabela')` em algum ponto do mesmo
    // encadeamento. Olhar 3 linhas para trás cobre o estilo quebrado em
    // várias linhas que este projeto usa.
    const janela = linhas.slice(Math.max(0, i - ALCANCE), i + 1).join('\n');
    if (!/\.from\(/.test(janela)) continue;

    // `update()` recebe os campos primeiro, e o `{ count: 'exact' }` vem como
    // SEGUNDO argumento — muitas vezes linhas abaixo, quando o objeto de campos
    // é multilinha. Então a busca precisa olhar um trecho, não a linha.
    //
    // **Mas o trecho tem que parar no fim DESTA chamada.** A primeira versão
    // olhava 14 linhas fixas e por isso não pegava nada: o `count` da chamada
    // SEGUINTE caía dentro da janela e dava por conferida a chamada anterior.
    // Reinjetei o bug em `updateReportStatus` e o teste passou — trava que não
    // falha com o bug presente é decoração (§2). O `;` fecha o statement.
    const trecho = [];
    for (let j = i; j < Math.min(linhas.length, i + 14); j++) {
      trecho.push(linhas[j]);
      if (linhas[j].includes(';')) break;
    }
    const confere = /count:\s*'exact'/.test(trecho.join('\n'));
    const dispensado = linhas
      .slice(Math.max(0, i - ALCANCE), i + 1)
      .some((l) => MARCADOR.test(l));

    if (!confere && !dispensado) achados.push({ linha: i + 1, texto: linhas[i].trim() });
  }
  return achados;
}

describe('apagar no banco confere quantas linhas caíram', () => {
  const arquivos = [...varrerFontes('src')].filter((c) => !c.includes('__tests__'));

  it('a varredura leu arquivos de verdade', () => {
    // Sem isto, renomear a pasta deixaria a trava verde para sempre.
    expect(arquivos.length, 'a varredura não achou fonte nenhuma em src/')
      .toBeGreaterThan(50);
    expect(
      arquivos.some((c) => c.includes('useAdminContentActions')),
      'não achei useAdminContentActions.js — o arquivo do achado saiu do lugar?',
    ).toBe(true);
  });

  it('nenhum delete() do Supabase ignora o número de linhas', () => {
    const faltando = [];
    for (const caminho of arquivos) {
      for (const a of apagamentosDeBanco(readFileSync(caminho, 'utf8'))) {
        faltando.push(`${caminho}:${a.linha}  ${a.texto}`);
      }
    }

    expect(faltando.join('\n'),
      'apagamento no banco SEM conferir quantas linhas caíram:\n\n'
      + `    ${faltando.join('\n    ')}\n\n`
      + '  DELETE recusado pela RLS devolve 0 linhas e NENHUM erro. Sem o\n'
      + '  `count`, o site mostra "apagado com sucesso" e grava a exclusao na\n'
      + '  trilha de auditoria — para uma exclusao que nao aconteceu.\n\n'
      + '  Foi medido em 10/09 no painel do admin: ver a lixeira e role_rank>=2\n'
      + '  (plana), mas apagar e can_moderate_content (hierarquia estrita), entao\n'
      + '  o admin ENXERGA o post do owner e nao pode apaga-lo.\n\n'
      + '  Conserto:\n'
      + "      .delete({ count: 'exact' })    e tratar `!count` como falha.\n\n"
      + '  Se 0 linhas for MESMO o caso normal aqui (descurtir: a linha ja nao\n'
      + '  existe, objetivo atingido), escreva o motivo ao lado:\n'
      + '      // 0-linhas-ok: descurtir duas vezes nao e erro\n')
      .toBe('');
  });
});
