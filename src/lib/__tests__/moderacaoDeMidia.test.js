import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Trava da moderação de mídia.
//
// ── O buraco que ela fecha ──────────────────────────────────────────────────
//
// Até 28/08/2026, vídeo era o único tipo de mídia que subia **sem nenhuma
// checagem**. Em `postService.js`, só `type === 'image'` entrava na lista
// mandada para a IA — texto, imagem e link eram moderados; vídeo passava
// direto. Ninguém escreveu esse buraco de propósito: ele nasceu no dia em que
// o formulário passou a aceitar vídeo e a moderação não acompanhou.
//
// É a forma de falha mais cara deste projeto: nada quebra, nada estoura, nada
// aparece em log. A funcionalidade simplesmente não acontece (§1.5).
//
// ── Por que um teste de contrato, e não um teste da extração ────────────────
//
// Testar `extrairQuadros` de verdade exigiria um `<video>` decodificando um
// arquivo real, o que não existe nos testes deste projeto. Mas o que quebrou
// aqui não foi a extração — foi alguém **esquecer de chamar** a moderação num
// caminho de mídia. É isso que este teste vigia.
//
// Para ver a trava funcionando: apague a chamada de `moderateVideos` no
// `usePostComposer.js` e rode de novo.

const SRC = join(dirname(fileURLToPath(import.meta.url)), '../..');

// Formulários que aceitam SÓ imagem, comprovado pelo `accept` do input. Se um
// deles passar a aceitar vídeo, tem que sair desta lista — e aí o teste vai
// exigir a moderação de vídeo junto.
const SO_IMAGEM = {
  'components/community/MuralForm.jsx': 'accept="image/*" — o mural não aceita vídeo',
};

function varrer(dir, achados = []) {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      if (nome === '__tests__') continue;
      varrer(caminho, achados);
    } else if (/\.(js|jsx)$/.test(nome)) {
      achados.push(caminho);
    }
  }
  return achados;
}

const arquivos = varrer(SRC).map(caminho => ({
  // Caminho relativo a `src/`, no formato que a lista acima usa.
  rel: caminho.slice(SRC.length + 1).replace(/\\/g, '/'),
  texto: readFileSync(caminho, 'utf8'),
}));

describe('todo caminho que modera imagem também modera vídeo', () => {
  const chamamImagem = arquivos.filter(
    a => /\bmoderateImages\s*\(/.test(a.texto) && !a.rel.startsWith('services/'),
  );

  it('existe pelo menos um caminho de publicação com mídia', () => {
    expect(
      chamamImagem.length,
      'nenhum arquivo chama moderateImages — ou a moderação de mídia sumiu, ou '
      + 'esta varredura parou de encontrar os arquivos e o teste virou decoração',
    ).toBeGreaterThan(0);
  });

  for (const arquivo of chamamImagem) {
    const motivo = SO_IMAGEM[arquivo.rel];

    it(`${arquivo.rel}${motivo ? ' (só imagem)' : ''}`, () => {
      if (motivo) {
        expect(
          /accept="image\/\*"/.test(arquivo.texto),
          `${arquivo.rel} está na lista de "só imagem" (${motivo}), mas o input `
          + 'não tem mais accept="image/*". Se ele passou a aceitar vídeo, tire-o '
          + 'da lista SO_IMAGEM e chame moderateVideos ali.',
        ).toBe(true);
        return;
      }

      expect(
        /\bmoderateVideos\s*\(/.test(arquivo.texto),
        `${arquivo.rel} manda imagem para a moderação e NÃO manda vídeo. Foi `
        + 'exatamente assim que vídeo ficou sem checagem nenhuma até 28/08: o '
        + 'formulário passou a aceitar vídeo e a moderação não acompanhou. '
        + 'Chame moderateVideos com os arquivos de type === "video", ou, se este '
        + 'caminho realmente só aceita imagem, registre-o em SO_IMAGEM com o motivo.',
      ).toBe(true);
    });
  }
});

describe('a extração de quadros não pode ficar sem teto', () => {
  const fonte = readFileSync(join(SRC, 'lib/framesDeVideo.js'), 'utf8');

  it('tem prazo máximo para desistir de um vídeo', () => {
    expect(
      /TEMPO_MAXIMO_MS\s*=\s*\d+/.test(fonte),
      'sem teto, um vídeo corrompido ou de codec desconhecido deixa a promessa '
      + 'pendurada para sempre e a publicação nunca termina (§0.3, regra 3)',
    ).toBe(true);
  });

  it('solta o object URL do vídeo', () => {
    expect(
      /revokeObjectURL/.test(fonte),
      'sem revokeObjectURL o arquivo de vídeo inteiro fica preso na memória do '
      + 'navegador depois da extração (§6.1, ciclo de vida)',
    ).toBe(true);
  });
});
