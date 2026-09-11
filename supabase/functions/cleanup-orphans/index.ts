// Capturado da versão 5 implantada em 23/08/2026 — ver ../README.md.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// A impressao deste codigo. Gerada por `npm run impressao-edges` — NAO editar a
// mao. Um GET devolve este valor, e o portao do CI compara com o do repositorio:
// e assim que "editei a funcao e esqueci de implantar" passa a reprovar o PR.
const IMPRESSAO_DESTE_CODIGO = "ed63a8793e53a519";

// Função de limpeza já executada em 2026-06-12 (52 órfãos removidos do
// bucket post-media). Mantida como stub desativado — pode ser deletada
// pelo dashboard quando conveniente.
Deno.serve((req: Request) => {
  if (req.method === "GET") {
    return new Response(JSON.stringify({ impressao: IMPRESSAO_DESTE_CODIGO }), {
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ status: "done", note: "limpeza ja executada em 2026-06-12" }), {
    status: 410,
    headers: { "Content-Type": "application/json" },
  });
});
