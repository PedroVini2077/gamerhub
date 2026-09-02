import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { ligarSom, desligarSom } from '../../lib/somAmbiente';

/**
 * O botão do som ambiente da landing.
 *
 * ── As três decisões que valem explicação ───────────────────────────────────
 *
 * **1. Desligado por padrão, e sem tentar autoplay.** Não é limitação técnica
 * contornável: Chrome, Safari e Firefox bloqueiam áudio antes de um gesto. E,
 * mesmo se deixassem, site que começa a tocar sozinho é o tipo de coisa que faz
 * a pessoa fechar a aba — o pedido era "sutil".
 *
 * **2. A preferência é lembrada, mas só para DESLIGAR sozinho.** Quem ligou uma
 * vez tem o som ligado na volta; quem nunca ligou continua no silêncio. O
 * navegador ainda exige o gesto, então a preferência salva serve para o botão
 * já aparecer no estado certo e ligar no primeiro clique em qualquer lugar.
 *
 * **3. Nada é alocado antes do clique.** O módulo do som não cria
 * `AudioContext` nenhum enquanto ninguém pedir — o custo de existir este botão
 * é o próprio botão.
 */

const CHAVE = 'gh_som_ambiente';

function preferenciaSalva() {
  try { return window.localStorage.getItem(CHAVE) === 'ligado'; } catch { return false; }
}

export default function BotaoDeSom() {
  const [ligado, setLigado] = useState(false);
  const [querLigado] = useState(preferenciaSalva);

  // Quem já tinha ligado antes liga no PRIMEIRO gesto — qualquer um, não só o
  // clique no botão. O navegador exige o gesto; a pessoa já disse o que quer.
  useEffect(() => {
    if (!querLigado || ligado) return undefined;
    const aoInteragir = () => { if (ligarSom()) setLigado(true); };
    window.addEventListener('pointerdown', aoInteragir, { once: true });
    window.addEventListener('keydown', aoInteragir, { once: true });
    return () => {
      window.removeEventListener('pointerdown', aoInteragir);
      window.removeEventListener('keydown', aoInteragir);
    };
  }, [querLigado, ligado]);

  // Sair da landing solta o áudio. Sem isto os osciladores seguiriam vivos.
  useEffect(() => () => desligarSom(), []);

  function alternar() {
    if (ligado) {
      desligarSom();
      setLigado(false);
      try { window.localStorage.removeItem(CHAVE); } catch { /* modo privado */ }
      return;
    }
    if (ligarSom()) {
      setLigado(true);
      try { window.localStorage.setItem(CHAVE, 'ligado'); } catch { /* modo privado */ }
    }
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-pressed={ligado}
      aria-label={ligado ? 'Desligar som ambiente' : 'Ligar som ambiente'}
      title={ligado ? 'Desligar som ambiente' : 'Som ambiente'}
      className={`fixed bottom-4 right-4 z-40 grid place-items-center w-11 h-11
                  rounded-full border backdrop-blur transition-colors
                  ${ligado
                    ? 'border-neon-green/40 bg-neon-green/10 text-neon-green'
                    : 'border-dark-500 bg-dark-800/80 text-gray-500 hover:text-gray-300'}`}
    >
      {ligado ? <Volume2 size={17} /> : <VolumeX size={17} />}
    </button>
  );
}
