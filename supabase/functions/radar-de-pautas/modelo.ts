// A CHAMADA AO MODELO — montar o pedido, mandar, e traduzir o que voltou.
//
// `[02/10]` Saiu do `index.ts` quando a Fase 4 entrou e ele passou de 300
// linhas (§4). O corte não é só por tamanho: enquanto este bloco vivia dentro
// do `Deno.serve`, nenhum teste alcançava a montagem do pedido — e é ela que
// carrega as três decisões que já custaram caro.
//
// ── As três, em uma linha cada ──────────────────────────────────────────
//
// `reasoning_effort: "low"` — o `gpt-oss-120b` gasta a cadeia de pensamento
// do MESMO `max_tokens` da resposta. Sem isso o `content` volta vazio e a
// Groq recusa com `json_validate_failed`, de forma intermitente.
//
// `json_schema` estrito, e não `json_object` — o segundo garante sintaxe, o
// primeiro garante FORMA. É o que faz "endereço inventado" não caber no
// formato, em vez de ser algo que se filtra depois.
//
// A tradução da falha é PURA e mora em `falhaDaGroq.ts` — erro embutido no
// fluxo não se exercita sem rede, e foi assim que toda recusa da Groq virou
// a mensagem errada na tela com o `admin_logs` certo.

import { INSTRUCAO, ESQUEMA_DA_RESPOSTA } from "./contrato.ts";
import { RESERVA_DE_SAIDA, TETO_DE_PAUTAS } from "./pedido.ts";
import { lerFalhaDaGroq } from "./falhaDaGroq.ts";

export const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

/**
 * `[26/09]` O `llama-3.3-70b-versatile` era modelo de PRODUÇÃO e dava `404`:
 * ele é Enterprise. A pergunta não é "é de produção?", é "está na tabela de
 * limites do plano que pagamos?". `modeloDaIaEhDoNossoPlano.test.js` trava.
 */
export const MODELO = "openai/gpt-oss-120b";

/** O modelo às vezes embrulha o JSON em cerca de markdown. */
const semCerca = (t: string) =>
  t.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

export type RespostaDoModelo =
  | { ok: true; resposta: unknown }
  | { ok: false; status: string; aviso: string; motivo: string; metadata: Record<string, unknown> };

/**
 * Pede a leitura editorial. **Nunca lança** — toda saída é um dos dois ramos,
 * porque quem chama precisa decidir o que devolver ao editor, e exceção
 * atravessando esta fronteira já produziu mensagem errada uma vez.
 */
export async function pedirAoModelo(
  lista: string,
  chars: number,
  itensNoPedido: number,
  chave: string,
): Promise<RespostaDoModelo> {
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODELO, temperature: 0.4, max_tokens: RESERVA_DE_SAIDA,
        reasoning_effort: "low",
        response_format: { type: "json_schema", json_schema: ESQUEMA_DA_RESPOSTA },
        messages: [
          { role: "system", content: INSTRUCAO },
          { role: "user", content: `MANCHETES COLETADAS HOJE:\n\n${lista}\n\n`
            + `Devolva no maximo ${TETO_DE_PAUTAS} pautas.` },
        ],
      }),
    });

    if (!res.ok) {
      const bruto = (await res.text()).slice(0, 300);
      const falha = lerFalhaDaGroq(res.status, bruto);
      return {
        ok: false, status: falha.status, aviso: falha.aviso, motivo: falha.motivo,
        metadata: { status: res.status, corpo: bruto, charsDaLista: chars, itensNoPedido },
      };
    }

    const json = await res.json();
    return { ok: true, resposta: JSON.parse(semCerca(json?.choices?.[0]?.message?.content ?? "{}")) };
  } catch (e) {
    return {
      ok: false,
      status: "erro_provedor",
      aviso: "A IA respondeu algo que eu nao entendi — segue a lista crua.",
      motivo: "falha ao chamar ou interpretar a Groq",
      metadata: { erro: String(e).slice(0, 300) },
    };
  }
}
