/**
 * `[26/09]` As fontes que foram CONFERIDAS para escrever português.
 *
 * ── Por que este arquivo existe ────────────────────────────────────────────
 *
 * O dono viu no print: o título dizia *"Um feed que **nào** para"*. O código
 * sempre teve "não" — era a **Orbitron**, que desenha o til achatado e
 * deslocado. A 190 px é um til; a 28–64 px, que é o tamanho real dos títulos,
 * rasteriza como uma crase. Ela escrevia "nào", "opçòes", "CORAÇÀO".
 *
 * Nosso arquivo não estava corrompido: md5 **idêntico** ao que a Google serve.
 * Não era bug nosso, e não tinha conserto do nosso lado.
 *
 * ── Por que a trava é uma LISTA ESCRITA, e não um teste automático ─────────
 *
 * Isto é honestidade sobre o limite, e está sob a mesma régua do
 * `docs/regras/MECANISMOS.md` — *"fingir que verifica seria pior do que não
 * verificar"*.
 *
 * Eu tentei achar um teste determinístico e **não existe um barato**:
 *
 * | o que eu testaria | por que NÃO pega a Orbitron |
 * | --- | --- |
 * | o glifo `U+00E3` existe? | existe — `atilde` = `a` + `tildecomb` |
 * | o til é um glifo diferente da crase? | é: 15 pontos contra 5 |
 * | o til é largo o bastante? | é — 340 unidades, mais largo que a crase |
 * | comparar o bitmap de `ã` com o de `à` | são diferentes; o defeito é que **parecem** iguais a 40 px |
 *
 * O defeito é **perceptual**: uma onda rasa demais lida por um olho humano num
 * tamanho específico. Nenhuma das quatro medições acima o pega.
 *
 * Então o mecanismo é o mais fraco que resolve, e é declarado como tal: uma
 * lista fechada com a data e o MÉTODO da conferência. O teste
 * `fonteEscrevePortugues.test.js` exige que a fonte de display do
 * `tailwind.config.js` esteja aqui — e fonte nova só entra depois de alguém
 * renderizar "não opções CORAÇÃO" no tamanho real e OLHAR.
 */

/**
 * Mapa explícito. Fonte que não está aqui reprova o teste — o desconhecido
 * não vira palpite (§4).
 */
export const FONTES_CONFERIDAS = {
  Oxanium: {
    conferida: '2026-09-26',
    metodo: 'renderizada em Chromium com "não opções CORAÇÃO" a 21, 38 e 54 px, '
          + 'nos pesos 600/700/900, e comparada lado a lado com 10 candidatas',
    papel: 'display',
    observacao: 'Vai até o peso 800; o site usa 900 em um lugar só '
              + '(o "GAMER HUB" do hero). O navegador limita a 800 e o título '
              + 'continua pesado — conferido no print antes de trocar.',
  },
  Rajdhani: {
    conferida: '2026-09-26',
    metodo: 'renderizada junto com a Orbitron na mesma investigação: o til dela '
          + 'é um til em todos os tamanhos testados',
    papel: 'corpo',
  },
  'Share Tech Mono': {
    conferida: '2026-09-26',
    metodo: 'usada só em dado técnico e rótulo curto; conferida na mesma rodada',
    papel: 'mono',
  },
};

/**
 * As REPROVADAS, com o motivo. Elas ficam escritas de propósito: sem isto,
 * alguém — inclusive eu, daqui a três meses — reintroduz a Orbitron porque
 * "é a fonte gamer padrão", que é exatamente o argumento que a trouxe.
 */
export const FONTES_REPROVADAS = {
  Orbitron: 'O til é uma onda achatada e deslocada: vira CRASE no tamanho dos '
          + 'títulos. Escrevia "nào", "opçòes", "CORAÇÀO". Medido em 26/09, e o '
          + 'arquivo era byte a byte o da Google — não era defeito nosso.',
};

/** A fonte está liberada para escrever português? */
export const fonteConferida = (nome) => Object.hasOwn(FONTES_CONFERIDAS, nome);
