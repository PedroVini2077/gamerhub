// Capturado da versão 9 implantada em 23/08/2026 — ver ../README.md.
//
// NEUTRALIZADA em 23/08/2026. Sobra de um experimento com Hugging Face.
//
// O que ela fazia: baixava uma imagem de teste e mandava para o modelo
// `Falconsai/nsfw_image_detection` usando a HUGGINGFACE_API_KEY. Era código de
// depuração de quando a moderação de imagem estava sendo avaliada. Nada no
// site chama isto.
//
// O problema: ficou ATIVA e com `verify_jwt: false`. Qualquer pessoa da
// internet chamava e, a cada chamada, gastava cota da chave do Hugging Face.
// Código morto não é só bagunça: é superfície de ataque que ninguém revisa,
// porque ninguém lembra que existe.
//
// ATENÇÃO ao apagar: o **secret** HUGGINGFACE_API_KEY continua em uso pelo
// fallback de texto dentro da `moderate-text`. Apagar esta função é seguro;
// apagar o secret junto tira a reserva do texto (ver docs/MODERACAO.md).
//
// Fica como lápide até ser apagada pelo dashboard (o MCP não apaga Edge
// Function). `verify_jwt` ligado, e não chama mais nada.

Deno.serve(() =>
  new Response(
    JSON.stringify({ status: "removida", motivo: "codigo de depuracao sem uso" }),
    { status: 410, headers: { "Content-Type": "application/json" } },
  )
);
