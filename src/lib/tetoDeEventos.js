// Teto de eventos por sessão do Sentry.
//
// ── Por que existe ─────────────────────────────────────────────────────────
//
// O plano Free do Sentry são 5.000 eventos/mês. Estourando, ele **descarta em
// silêncio** pelo resto do mês — ou seja, a ferramenta que existe para acabar
// com falha silenciosa passa a falhar em silêncio (CLAUDE.md §0.2). É uma das
// duas cotas do projeto que não gritam.
//
// Com 3 usuários, 166 eventos/dia não se esgotam por uso normal. O jeito
// realista de estourar é **rajada**: um bug num laço de render ou de retry
// disparando centenas de eventos em minutos. `ignoreErrors` não pega isso — ele
// filtra por mensagem conhecida, e um laço produz erro legítimo, repetido.
//
// ── A ideia ────────────────────────────────────────────────────────────────
//
// Passado o teto, em vez das duas saídas ruins — mandar tudo (queima a cota) ou
// ficar mudo (some do radar) — manda-se **UM evento que conta a história**,
// carregando o último erro real junto. A rajada vira um aviso legível em vez de
// 3.000 linhas ou de nada.
//
// O `fingerprint` fixo agrupa todos esses avisos num único issue do Sentry, de
// modo que nem eles se multiplicam entre sessões.

/** Quanto uma sessão pode gastar antes de ser contida. */
export const LIMITE_PADRAO = 20;

/**
 * Cria o limitador. Puro de propósito: nada de Sentry aqui dentro, para poder
 * ser testado sem navegador e sem rede.
 *
 * @param {number} limite  quantos eventos reais a sessão pode mandar
 * @returns {{ filtrar: (evento: object) => object|null, enviados: () => number }}
 *   `filtrar` devolve o evento (envia), um evento-aviso (o marcador), ou
 *   `null` (descarta).
 */
export function criarLimitador(limite = LIMITE_PADRAO) {
  let enviados = 0;
  let jaAvisou = false;

  return {
    enviados: () => enviados,

    filtrar(evento) {
      if (enviados < limite) {
        enviados += 1;
        return evento;
      }

      // Estourou. O primeiro depois do teto vira o aviso; os demais somem.
      if (jaAvisou) return null;
      jaAvisou = true;

      return {
        ...evento,
        // Sem `exception`, senão o Sentry agrupa pelo stack do erro original e
        // o aviso se perde dentro do issue da rajada.
        exception: undefined,
        level: 'warning',
        message:
          `Teto de ${limite} eventos por sessão atingido. O resto desta sessão `
          + 'foi descartado no cliente para não queimar a cota mensal do Sentry. '
          + 'Isto quase sempre significa erro em laço — investigar o último erro abaixo.',
        // Agrupa todos os avisos num issue só, entre sessões.
        fingerprint: ['teto-de-eventos-por-sessao'],
        extra: {
          ...(evento.extra ?? {}),
          teto: limite,
          ultimo_erro:
            evento.exception?.values?.[0]?.value ?? evento.message ?? '(sem mensagem)',
        },
      };
    },
  };
}
