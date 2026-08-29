import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Trava de DERIVA entre o navegador e a Edge Function (auditoria, FASE 4).
 *
 * ── O que ela protege ───────────────────────────────────────────────────────
 *
 * Quando a extração de quadros falha, o navegador manda um corpo com o campo
 * `falha_de_extracao` para a `moderate-image`, e a função grava a falha em
 * `admin_logs`. São dois arquivos que precisam concordar sobre UM nome de
 * campo, em duas linguagens, um deles implantado à parte do site.
 *
 * A deriva aqui não estoura em lugar nenhum: o cliente dispara e descarta
 * (fire-and-forget), então um campo renomeado de um lado só vira a função
 * respondendo 400 para ninguém. O sintoma seria exatamente o que já custou
 * duas rodadas de investigação — o vídeo passa sem análise e nada acusa.
 *
 * ── Por que ler o fonte, e não chamar a função ──────────────────────────────
 *
 * Chamar a `moderate-image` de verdade exigiria um JWT de usuário e uma linha
 * de conteúdo no banco. O que precisa ser garantido aqui é que os dois lados
 * escrevam o MESMO nome, e isso é legível direto.
 */

const raiz = join(import.meta.dirname, '../../..');
const CLIENTE = readFileSync(join(raiz, 'src/services/moderationAiService.js'), 'utf8');
const FUNCAO = readFileSync(join(raiz, 'supabase/functions/moderate-image/index.ts'), 'utf8');

const RECADO = (lado) =>
  `O campo \`falha_de_extracao\` sumiu do ${lado}.\n`
  + 'Ele é o único caminho pelo qual "o navegador não conseguiu extrair quadros"\n'
  + 'chega ao `admin_logs`. Sem ele a falha volta a existir só num toast de\n'
  + '12 segundos e no Sentry — e o vídeo fica publicado sem análise nenhuma,\n'
  + 'sem nada que denuncie isso depois que a aba fecha (§1.5).';

describe('relato de falha de vídeo — navegador × moderate-image', () => {
  it('o cliente manda `falha_de_extracao` quando não sai nenhum quadro', () => {
    expect(CLIENTE, RECADO('cliente (moderationAiService.js)')).toContain('falha_de_extracao');
  });

  it('a Edge Function lê `falha_de_extracao` e aceita corpo sem imagens', () => {
    expect(FUNCAO, RECADO('servidor (moderate-image/index.ts)')).toContain('falha_de_extracao');
    expect(
      FUNCAO,
      'A função voltou a exigir `image_urls`. O relato de falha é justamente o\n'
      + 'caso em que NÃO há imagem nenhuma para mandar — com a exigência de\n'
      + 'volta, ele é recusado com 400 e a falha some outra vez.',
    ).toMatch(/!image_urls\?\.length && falha_de_extracao/);
  });

  it('o relato só passa DEPOIS da checagem de dono do conteúdo', () => {
    const posDono = FUNCAO.indexOf('tentou moderar');
    const posRelato = FUNCAO.indexOf('if (!image_urls?.length && falha_de_extracao)');
    expect(posDono).toBeGreaterThan(-1);
    expect(
      posRelato,
      'O ramo do relato de falha subiu para antes da checagem de dono.\n'
      + 'É essa checagem que impede qualquer conta autenticada de fabricar\n'
      + 'entradas na trilha de auditoria sobre conteúdo alheio — o mesmo erro do\n'
      + 'antigo `register_login_attempt`, que era aberto e por isso saiu do banco.',
    ).toBeGreaterThan(posDono);
  });

  it('cada motivo de falha do navegador tem texto próprio', () => {
    const FRAMES = readFileSync(join(raiz, 'src/lib/framesDeVideo.js'), 'utf8');
    const motivos = [
      'recusou criar a URL',
      'não decodificou o arquivo',
      'não soube dizer a duração',
      'não expôs as dimensões',
      'estourou o teto',
      'quadro(s) em branco',
      'recusou desenhar',
      'nenhum salto no vídeo chegou a completar',
    ];
    for (const m of motivos) {
      expect(
        FRAMES,
        `O motivo "${m}" sumiu de framesDeVideo.js.\n`
        + 'Cada um destes é uma causa DIFERENTE com uma correção diferente —\n'
        + 'formato que o navegador não abre, mídia que nunca carrega, canvas\n'
        + 'que não desenha. Colapsar dois deles numa mensagem só devolve o\n'
        + 'problema de 28/08: um sintoma, cinco causas, nenhuma pista.',
      ).toContain(m);
    }
  });
});
