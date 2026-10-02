import { describe, it, expect } from 'vitest';
import {
  sugerirEditoria, resumoAutomatico, avisosDaMateria, sugestoesPara, TETO_DO_RESUMO,
} from '../assistente';
import { editoriaValida } from '../editorias';

/**
 * `[25/09]` O ASSISTENTE SUGERE — ele nunca decide, e nunca inventa.
 *
 * ── A propriedade que esta trava existe para guardar ──────────────────────
 *
 * O dono aprovou recomendação no painel do News. A linha combinada é dura e é
 * ela que precisa sobreviver a qualquer mexida futura:
 *
 *   tudo o que o assistente devolve vem do texto que a PESSOA já escreveu.
 *
 * No dia em que alguém plugar um modelo aqui, a tentação óbvia é deixá-lo
 * escrever a matéria a partir do título. Isso produziria fato inventado com a
 * marca do GamerHub assinando — e a landing promete o contrário, na letra:
 * "apurado pela equipe, sem caça-clique e sem repost sem fonte".
 *
 * ── Provada reinjetando (§2) ──────────────────────────────────────────────
 *
 *   . `sugerirEditoria` com `?? 'gaming'` no fim  -> falhou no título neutro
 *   . casamento sem fronteira de palavra          -> falhou em "familia" -> ia
 *   . resumo cortando no meio da palavra          -> falhou na checagem de corte
 */

describe('o assistente sugere a partir do que já existe', () => {
  // `[02/10]` Este caso se chamava *"a pista mais longa ganha"*, e esse era o
  // BUG: `temporada` (9 letras) vencia `jogo` (4). O modelo agora é
  // evidência, e o porquê está em `editoriaProvavelNaoChuta.test.js`.
  it('editoria: casa palavra INTEIRA, e quem define ganha de quem acompanha', () => {
    expect(sugerirEditoria('Nova GPU da NVIDIA chega em novembro')).toBe('hardware');
    expect(sugerirEditoria('O filme de Zelda ganhou data')).toBe('filmes-series');
    expect(sugerirEditoria('Inteligência artificial no desenvolvimento')).toBe('ia');
  });

  it('NÃO chuta: título sem pista devolve null', () => {
    // Este é o coração da trava. `?? 'gaming'` no fim da função faria toda
    // matéria nascer numa editoria que ninguém escolheu — e campo já
    // preenchido é campo que ninguém confere.
    for (const neutro of ['Uma novidade por aqui', 'Comunicado da equipe', '', null]) {
      expect(sugerirEditoria(neutro), `"${neutro}" nao tem pista`).toBeNull();
    }
  });

  it('editoria sugerida SEMPRE existe no vocabulário', () => {
    const titulos = ['GPU nova', 'anime de sucesso', 'demissão no estúdio', 'patch do jogo'];
    for (const t of titulos) {
      const s = sugerirEditoria(t);
      if (s !== null) expect(editoriaValida(s), `"${s}" precisa existir em EDITORIAS`).toBe(true);
    }
  });

  it('"ia" não casa dentro de outra palavra', () => {
    // Sem fronteira de palavra, "familia", "policia" e "midia" virariam IA.
    for (const falso of ['A familia toda jogou', 'A policia confirmou', 'A midia repercutiu']) {
      expect(sugerirEditoria(falso), `"${falso}" nao e sobre IA`).not.toBe('ia');
    }
  });

  it('resumo sai do CORPO e vem sem marcação', () => {
    const corpo = 'A **nova** GPU chegou. Ela custa *caro* e vem com [3 saídas](https://x.com).';
    const r = resumoAutomatico(corpo);
    expect(r).not.toMatch(/\*|\[|\]\(/);
    expect(r).toContain('nova GPU chegou');
    expect(r).toContain('3 saídas');
  });

  it('resumo longo corta em fronteira, nunca no meio da palavra', () => {
    const frase = 'A placa chegou e mudou tudo para quem joga no computador. ';
    const r = resumoAutomatico(frase.repeat(20));

    expect(r.length).toBeLessThanOrEqual(TETO_DO_RESUMO + 1);
    // Ou termina uma frase, ou termina com reticências — nunca no meio.
    expect(r, `cortou no meio: ...${r.slice(-30)}`).toMatch(/[.!?]$|…$/);
  });

  it('corpo vazio devolve resumo vazio, não um placeholder', () => {
    for (const nada of ['', '   ', null, undefined]) {
      expect(resumoAutomatico(nada)).toBe('');
    }
  });

  it('os avisos apontam o que falta, e a FONTE vem primeiro', () => {
    const avisos = avisosDaMateria({ titulo: 'x', conteudo: 'curto', resumo: '', fonte_url: '', capa_url: '' });
    expect(avisos.length).toBeGreaterThan(0);
    expect(avisos[0], 'falta de fonte e a unica que contradiz o que a landing promete').toMatch(/fonte/i);
  });

  it('matéria completa não gera aviso nenhum', () => {
    // Sem isto, a trava passaria com uma função que devolve aviso sempre.
    expect(avisosDaMateria({
      titulo: 'Um título de tamanho normal',
      conteudo: 'a'.repeat(400),
      resumo: 'Tem resumo.',
      fonte_url: 'https://exemplo.com',
      capa_url: 'https://exemplo.com/capa.jpg',
    })).toEqual([]);
  });

  it('não sugere resumo quando a pessoa já escreveu um', () => {
    const s = sugestoesPara({ titulo: 'GPU nova', conteudo: 'Corpo longo aqui.', resumo: 'O meu resumo' });
    expect(s.resumo, 'sobrescrever o que a pessoa escreveu e decidir por ela').toBeNull();
  });
});

/**
 * `[02/10]` O QUE ELE RELATOU, e as duas coisas que saíram disso.
 *
 * ── 1. "as sugestões não estão aparecendo mais" ───────────────────────────
 *
 * **Não era bug — era o conserto da véspera funcionando.** Os rascunhos dele
 * vêm do radar e já nascem com `editoria` preenchida. O botão só aparece
 * quando a sugestão DISCORDA do que está escolhido; enquanto ela errava
 * (`filmes-series` para uma matéria de Diablo) ela discordava, e o botão
 * aparecia. Quando passou a acertar, concordou — e sumiu.
 *
 * Medido nos cinco títulos reais do site, com a regra antiga × a de hoje:
 *
 *     Diablo IV temporada 15 …      antes: filmes-series   hoje: gaming
 *     Sony traz upscaling por IA …  antes: ia              hoje: null (empate)
 *     Xbox / Nintendo (3 títulos)   antes: null            hoje: gaming
 *
 * **O defeito real era de TELA:** um bloco chamado "Sugestões" que só mostra
 * avisos parece quebrado, e silêncio é resposta ambígua — não dá para
 * distinguir *"conferi e está certo"* de *"não consegui dizer nada"*.
 *
 * ── 2. "esse aviso... não explica o que exatamente está faltando" ─────────
 *
 * E um dos avisos **mentia**: com o corpo em zero caractere ele dizia
 * *"confira se não ficou faltando o final"* — texto de truncamento para um
 * texto que nunca começou. Quem acabou de colar as notas e ainda não clicou
 * em "Redigir rascunho" lia aquilo e procurava um final que não existe.
 */
describe('os avisos dizem o que falta E onde', () => {
  const vazio = {
    titulo: 'Um título qualquer', conteudo: '', resumo: '', fonte_url: '', capa_url: '',
  };

  it('corpo VAZIO e corpo CURTO dão mensagens diferentes', () => {
    const doVazio = avisosDaMateria(vazio).find((a) => /corpo/i.test(a));
    const doCurto = avisosDaMateria({ ...vazio, conteudo: 'a'.repeat(100) })
      .find((a) => /corpo/i.test(a));

    expect(doVazio).toBeTruthy();
    expect(doCurto).toBeTruthy();
    expect(doVazio, 'vazio e curto sao estados diferentes e pedem acoes diferentes')
      .not.toBe(doCurto);
  });

  it('o aviso do corpo VAZIO nao fala em "final" — isso e texto de truncamento', () => {
    const aviso = avisosDaMateria(vazio).find((a) => /corpo/i.test(a));
    expect(aviso, 'com 0 caracteres nao existe final para conferir. Dizer isso '
      + 'manda a pessoa procurar um texto que nunca comecou — mensagem de erro '
      + 'tem de ser verdadeira (§1.5)')
      .not.toMatch(/final/i);
  });

  it('cada aviso diz O QUE FAZER, nao so o que falta', () => {
    // O pedido dele foi literal: "nao explica oq exatamente esta faltando".
    // Toda frase precisa nomear o campo ou a acao.
    const semAcao = avisosDaMateria(vazio).filter(
      (a) => !/campo|clique|cole|escreva|encurtar|confira/i.test(a),
    );
    expect(semAcao, 'estes avisos dizem que algo falta e nao dizem onde resolver')
      .toEqual([]);
  });
});
