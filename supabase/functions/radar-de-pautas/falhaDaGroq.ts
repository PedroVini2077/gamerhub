// A LEITURA DA FALHA DA GROQ — traduzir o erro dela em verdade nossa.
//
// ============================================================================
// POR QUE ISTO É UM ARQUIVO, e não um `if` no meio do fluxo
// ============================================================================
//
// Duas razões, e a segunda é a que importa.
//
// **1.** O `index.ts` passou de 300 linhas quando a Fase 3 entrou (§4), e este
// bloco era o maior pedaço que não é orquestração.
//
// **2. A mensagem tem que ser VERDADEIRA (§1.5), e isso não se verifica
// olhando.** Em 01/10 o mesmo `HTTP 400` significou três coisas diferentes ao
// longo do dia — falta de espaço para o raciocínio, recusa de parâmetro, e
// JSON realmente malformado — e chamar qualquer uma delas de "cota acabou"
// mandaria o dono esperar até amanhã por um defeito que é nosso. Função pura
// com entrada e saída é o que permite travar as três com teste.
//
// A regra que governa cada frase daqui: **o aviso diz de quem é a culpa.**
// Defeito nosso se anuncia como defeito nosso; limite do fornecedor se
// anuncia como limite do fornecedor, com o prazo real de volta.

import { TPM_DO_PLANO } from "./pedido.ts";

export type FalhaDaGroq = {
  /** O que vai para `admin_logs` — técnico, para quem vai consertar. */
  motivo: string;
  /** O que vai para a tela — em português, para quem clicou. */
  aviso: string;
  /** `cota` separa "volte amanhã" de "é defeito nosso" para o cliente. */
  status: "cota" | "erro_provedor";
};

/**
 * Lê o status e o corpo da recusa, e devolve as três coisas que o resto do
 * sistema precisa. **Pura de propósito:** nada de rede, nada de log.
 */
export function lerFalhaDaGroq(status: number, corpo: string): FalhaDaGroq {
  // O 413 da Groq NÃO é "corpo grande demais" nem cota diária: é o teto por
  // minuto batido por uma requisição só. Já o 429 é dos dois tipos, e só o
  // corpo diz qual — `per day`/`RPD` é o diário.
  const porDia = /per day|\bRPD\b/i.test(corpo);

  // `failed_generation` VAZIO é o modelo não ter escrito nada: o raciocínio
  // comeu o `max_tokens` (ver RESERVA_DE_RACIOCINIO em `pedido.ts`).
  const ficouSemEspaco = /json_validate_failed/i.test(corpo)
    && /"failed_generation"\s*:\s*""/.test(corpo);
  // 400 citando um parâmetro é a Groq recusando o PEDIDO — o modelo deixou de
  // aceitar esquema estrito ou `reasoning_effort`, e aí é mudança do lado dela.
  const recusouOParametro = status === 400
    && /response_format|json_schema|reasoning_effort/i.test(corpo);

  if (status === 400 && ficouSemEspaco) {
    return {
      motivo: "o modelo nao escreveu nada — o raciocinio comeu o max_tokens (ver RESERVA_DE_RACIOCINIO)",
      aviso: "A IA recusou o pedido — e defeito nosso, ja registrado com o motivo. Segue a lista crua.",
      status: "erro_provedor",
    };
  }
  if (recusouOParametro) {
    return {
      motivo: "a Groq RECUSOU o pedido: json_schema estrito ou reasoning_effort deixaram de valer para este modelo",
      aviso: "A IA recusou o pedido — e defeito nosso, ja registrado com o motivo. Segue a lista crua.",
      status: "erro_provedor",
    };
  }
  if (status === 413) {
    return {
      motivo: `o pedido passou do teto por minuto da Groq (TPM ${TPM_DO_PLANO}) — o orcamento falhou`,
      aviso: "A IA recusou o pedido por tamanho — e defeito nosso, ja registrado. Segue a lista crua.",
      status: "erro_provedor",
    };
  }
  if (status === 429) {
    return porDia
      ? {
        motivo: "cota DIARIA da Groq estourada",
        aviso: "A cota diaria da IA acabou. Ela volta amanha — segue a lista crua.",
        status: "cota",
      }
      : {
        motivo: "teto por minuto da Groq — pedidos rapidos demais",
        aviso: "Muitos pedidos seguidos. Espere um minuto e tente de novo — segue a lista crua.",
        status: "erro_provedor",
      };
  }
  return {
    motivo: `Groq respondeu HTTP ${status}`,
    aviso: `A IA nao respondeu (HTTP ${status}) — segue a lista crua.`,
    status: "erro_provedor",
  };
}
