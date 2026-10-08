import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

/**
 * `[08/10]` O SERVICE WORKER NÃO PODE PRENDER NINGUÉM NA VERSÃO VELHA.
 *
 * ── Por que esta trava é diferente de todas as outras ──────────────────────
 *
 * O service worker é o **único código deste projeto que sobrevive ao deploy**.
 * Um errado serve a versão velha para sempre, e **não há conserto pelo
 * servidor**: subir um site novo não alcança quem já tem o worker instalado. A
 * pessoa fica presa até limpar os dados do navegador — que ninguém sabe fazer,
 * e que apaga a sessão junto.
 *
 * Todas as outras travas protegem contra um bug. Esta protege contra um bug
 * **que não tem como ser consertado depois**.
 *
 * ── A regra única que sustenta a Fase 1 ────────────────────────────────────
 *
 * **HTML nunca é cacheado.** Toda navegação vai para a rede. Como o
 * `index.html` é quem aponta para os bundles, mantê-lo fresco faz um deploy
 * SEMPRE chegar: HTML novo pede hash novo, o worker não o tem, busca na rede.
 *
 * Isso elimina a classe inteira de "preso na versão velha" sem precisar de
 * aviso de atualização nem de janela de migração. É por isso que a Fase 1 é
 * segura — e é exatamente isso que esta trava vigia.
 *
 * ── O que ela NÃO cobre, dito antes que alguém confie demais ───────────────
 *
 * Ela lê o ARQUIVO, não o comportamento num navegador. Service worker de
 * verdade só se testa com um, e isso é roteiro de E2E — fica para a Fase 2,
 * anotado no `BACKLOG.md`. Aqui se trava o contrato: o que o arquivo pode e
 * não pode conter.
 */

const WORKER = 'public/sw.js';
const OFFLINE = 'public/offline.html';

const fonte = () => readFileSync(WORKER, 'utf8');

/** O arquivo sem comentário — o que ele FAZ, não o que ele explica. */
function semComentarios(js) {
  return js.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/[^\n]*/gm, ' ');
}

describe('o service worker não prende ninguém na versão velha', () => {
  it('existe, e a página de offline também', () => {
    expect(existsSync(WORKER), `\`${WORKER}\` sumiu.`).toBe(true);
    expect(
      existsSync(OFFLINE),
      `\`${OFFLINE}\` sumiu, e o worker a pré-carrega na instalação.\n`
      + 'Sem ela o `cache.add` falha, a instalação inteira falha, e o worker\n'
      + 'nunca passa a existir — em silêncio, porque falha de registro não\n'
      + 'quebra o site.',
    ).toBe(true);
  });

  it('a NAVEGAÇÃO vai para a rede, e o cache é só o socorro', () => {
    const js = semComentarios(fonte());

    const navegacao = js.match(/mode\s*===\s*'navigate'[\s\S]{0,320}?\n\s*return;/);
    expect(
      navegacao,
      'o tratamento de NAVEGAÇÃO sumiu do worker.\n'
      + 'Sem ele, a navegação cai na regra geral — e qualquer regra que sirva\n'
      + 'HTML do cache prende a pessoa na versão velha PARA SEMPRE.',
    ).not.toBeNull();

    expect(
      /fetch\(pedido\)\.catch\(\s*\(\)\s*=>\s*caches\.match/.test(navegacao[0]),
      'a navegação deixou de ser "rede primeiro, cache só no erro".\n'
      + 'Esta é a ordem que faz um deploy SEMPRE chegar: o HTML fresco pede\n'
      + 'hashes novos, que o worker não tem e busca na rede.\n'
      + 'Invertida, ela serve o site de ontem e não há conserto pelo servidor.',
    ).toBe(true);
  });

  it('só cacheia arquivo cujo NOME carrega o hash do conteúdo', () => {
    const js = semComentarios(fonte());

    const padrao = js.match(/const IMUTAVEL = (\/.+\/);/);
    expect(padrao, 'o padrão `IMUTAVEL` sumiu — o worker passou a cachear qualquer coisa.')
      .not.toBeNull();

    const re = eval(padrao[1]);

    for (const caminho of [
      '/assets/index-Bz5ALKRR.js',
      '/assets/vendor-supabase-Bl13M3oS.js',
      '/assets/2-campo-alta-828-prVmgroq.webp',
    ]) {
      expect(re.test(caminho), `\`${caminho}\` deixou de ser cacheável.`).toBe(true);
    }

    for (const [caminho, porque] of [
      ['/', 'a raiz é HTML'],
      ['/index.html', 'HTML cacheado prende na versão velha'],
      ['/sw.js', 'o próprio worker — cacheá-lo impede a própria atualização dele'],
      ['/manifest.webmanifest', 'o manifest muda sem mudar de nome'],
      ['/fonts/Orbitron.woff2', 'o nome não carrega hash, e já houve troca de fonte aqui'],
      ['/offline.html', 'ela entra pelo pré-carregamento, não pela regra geral'],
    ]) {
      expect(
        re.test(caminho),
        `\`${caminho}\` passou a ser cacheado para sempre — ${porque}.`,
      ).toBe(false);
    }
  });

  it('nada de outra origem entra no cache', () => {
    expect(
      /url\.origin\s*!==\s*self\.location\.origin[\s\S]{0,40}?return;/.test(semComentarios(fonte())),
      'o worker deixou de recusar origem de terceiro.\n'
      + 'Cachear resposta do Supabase aqui seria servir dado velho sem ninguém\n'
      + 'pedir — e o React Query já decide isso com regras que a tela conhece.',
    ).toBe(true);
  });

  it('cache de versão antiga é APAGADO ao ativar', () => {
    const js = semComentarios(fonte());
    expect(
      /caches\.keys\(\)[\s\S]{0,260}?filter\([\s\S]{0,80}?!==\s*VERSAO[\s\S]{0,120}?caches\.delete/.test(js),
      'a limpeza dos caches antigos sumiu do `activate`.\n'
      + 'Sem ela o armazenamento do aparelho só cresce, e um dia o navegador\n'
      + 'despeja tudo sozinho — inclusive a sessão guardada.',
    ).toBe(true);
  });

  it('só resposta 200 inteira é guardada', () => {
    expect(
      /resposta\.ok\s*&&\s*resposta\.status\s*===\s*200/.test(semComentarios(fonte())),
      'o worker voltou a guardar qualquer resposta.\n'
      + 'Um 404 ou um 206 no cache vira erro servido PARA SEMPRE, com o\n'
      + 'agravante de que recarregar não resolve.',
    ).toBe(true);
  });

  it('a chave geral existe e está DESLIGADA', () => {
    const js = fonte();
    expect(
      /const DESLIGADO = (true|false);/.test(js),
      'a chave geral sumiu do worker.\n'
      + 'Ela é o caminho de volta, e precisa morar NO PRÓPRIO ARQUIVO: qualquer\n'
      + 'outro lugar dependeria de o site carregar — e se o site não carrega,\n'
      + 'não há de onde desligar.',
    ).toBe(true);

    expect(
      /const DESLIGADO = false;/.test(js),
      'o worker está DESLIGADO no repositório.\n'
      + 'Se foi de propósito (um incidente), ótimo — e este teste é o lembrete\n'
      + 'de religar quando passar. Se não foi, o cache inteiro está desativado\n'
      + 'sem ninguém ter notado.',
    ).toBe(true);

    expect(
      /registration\.unregister\(\)/.test(js),
      'a chave geral deixou de DESREGISTRAR o worker.\n'
      + 'Apagar o cache não basta: o worker continua instalado e volta a\n'
      + 'cachear no próximo carregamento.',
    ).toBe(true);
  });

  it('o registro só acontece em produção', () => {
    const reg = readFileSync('src/lib/servicoDeCache.js', 'utf8');
    expect(
      /if \(!import\.meta\.env\.PROD\) return;/.test(reg),
      'o worker passou a registrar em DESENVOLVIMENTO.\n'
      + 'Ali o Vite serve módulos sem hash e recarrega a quente: o worker\n'
      + 'serviria arquivo velho e faria parecer que a edição não pegou — horas\n'
      + 'perdidas caçando um bug que não existe.',
    ).toBe(true);

    expect(
      /registrarErro\(/.test(reg),
      'falha de registro voltou a sumir em silêncio.\n'
      + 'Ela não quebra o site — e é exatamente por isso que ninguém notaria\n'
      + 'que o PWA parou de instalar (§1.5).',
    ).toBe(true);
  });
});
