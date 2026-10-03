// OS SINAIS ANEXADOS À PAUTA — e por que eles vivem fora do `index.ts`.
//
// `[02/10]` Saiu do `index.ts` quando a Fase 4 entrou: aquele arquivo estava
// em 302 linhas, acima do teto do §4, e os dois sinais são justamente a parte
// que dá para testar sem rede. Enquanto viviam dentro do `Deno.serve`, teste
// nenhum os alcançava.
//
// ── O que um SINAL é, e o que ele nunca pode virar ───────────────────────
//
// Sinal responde uma pergunta sobre pauta que JÁ existe — "isto está
// crescendo?", "tem vídeo falando disso hoje?". Ele nunca cria pauta, nunca
// reordena por conta própria e nunca encosta no campo de confiabilidade.
//
// Isto é a regra do plano: *"`tendencia` e `discussao` nunca viram `relato`
// por acumulação"*. Muita gente falando não é fato.
//
// ── A regra que os dois compartilham, e é a mais importante daqui ────────
//
// **Sinal que falha não custa pauta.** Os dois rodam DEPOIS de as pautas
// estarem prontas, cada um dentro do próprio `try`, e qualquer erro vira
// ausência de enfeite — nunca ausência de conteúdo. O editor que clicou
// recebe as pautas de qualquer jeito.

import { medirAceleracao, sinalDaPauta } from "./aceleracao.ts";
import { buscarVideos, type FalhaDeVideo } from "./youtube.ts";
import {
  contarVideosDaPauta, rotuloDeVideo, termosQueDistinguem,
} from "./contagemDeVideo.ts";

export type PautaComSinais<T extends { termos: string[] }> = T & { sinal: string; video: string };

type Fonte = { nome: string; url: string };
type Buscar = (url: string, tetoMs?: number) => Promise<{ ok: boolean; status: number; texto: string }>;

/**
 * Anexa os dois sinais às pautas.
 *
 * Os dois vão em **paralelo**: são redes diferentes (o nosso Postgres e a API
 * do Google) e serializá-los somaria as esperas na conta de quem clicou, sem
 * ganho nenhum — ao contrário da GDELT, cujo espaçamento era exigência da
 * cota dela.
 *
 * @returns as pautas com `sinal` e `video`, mais as falhas do lado do vídeo —
 *   que são DITAS na tela, porque fonte que ficou de fora em silêncio é a
 *   mesma classe do coletor que cai calado.
 */
export async function anexarSinais<T extends { termos: string[] }>(
  pautas: T[],
  opcoes: {
    chamarAceleracao: (termos: string[], dias: number) => PromiseLike<{ data: unknown; error: unknown }>;
    fontesDeVideo: Fonte[];
    chaveDoYoutube: string | undefined;
    buscar: Buscar;
    agora?: Date;
  },
): Promise<{ pautas: PautaComSinais<T>[]; falhasDeVideo: FalhaDeVideo[]; videosConsiderados: number }> {
  const termos = pautas.flatMap((p) => p.termos);

  const [medidas, doVideo] = await Promise.all([
    medirAceleracao(termos, opcoes.chamarAceleracao),
    buscarVideos(opcoes.fontesDeVideo, termos, opcoes.chaveDoYoutube, opcoes.buscar, opcoes.agora)
      // O `buscarVideos` ja engole o que acontece DENTRO dele; este catch cobre
      // o que acontece ANTES, como uma URL impossivel de montar.
      .catch((e): { videos: never[]; comFalha: FalhaDeVideo[] } => ({
        videos: [],
        comFalha: [{ nome: "YouTube", motivo: e instanceof Error ? e.message : String(e) }],
      })),
  ]);

  // Termo que serve a VARIAS pautas nao distingue nenhuma — ver o cabecalho
  // de `termosQueDistinguem`. Calculado uma vez, sobre o conjunto inteiro.
  const distinguem = termosQueDistinguem(pautas);

  return {
    pautas: pautas.map((p) => ({
      ...p,
      sinal: sinalDaPauta(p.termos, medidas),
      video: rotuloDeVideo(contarVideosDaPauta(p.termos, doVideo.videos, distinguem)),
    })),
    falhasDeVideo: doVideo.comFalha,
    // `[02/10]` O numero que teria me dado o diagnostico em um minuto. A 1a
    // versao do sinal nao achou nada e nao disse nada: sem erro e sem selo,
    // "a API falhou" e "achou videos e nenhuma pauta casou" eram
    // indistinguiveis de fora. Agora o estado intermediario aparece.
    videosConsiderados: doVideo.videos.length,
  };
}
