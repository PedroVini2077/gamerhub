// Capturado da versão 5 implantada em 23/08/2026 — ver ../README.md.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Função de limpeza já executada em 2026-06-12 (52 órfãos removidos do
// bucket post-media). Mantida como stub desativado — pode ser deletada
// pelo dashboard quando conveniente.
Deno.serve(() =>
  new Response(JSON.stringify({ status: "done", note: "limpeza ja executada em 2026-06-12" }), {
    status: 410,
    headers: { "Content-Type": "application/json" },
  }),
);
