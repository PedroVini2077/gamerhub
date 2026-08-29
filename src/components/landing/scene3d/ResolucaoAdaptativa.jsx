import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  DEGRAUS_DE_RESOLUCAO, QUADROS_POR_AMOSTRA, LENTO_MS, degrauInicial,
  proximoDegrau, quedaDeEmergencia,
} from '../../../lib/resolucaoDaCena';

/**
 * Aplica a regra de `lib/resolucaoDaCena.js` a cada amostra de quadros.
 *
 * A cena começa no melhor que o aparelho pede e só DESCE — ver lá o porquê, e
 * o relato do dono que fez a versão anterior (que começava baixa e subia) ser
 * jogada fora.
 */
export default function ResolucaoAdaptativa({ aoSofrerNoPiso }) {
  const setDpr = useThree(estado => estado.setDpr);
  const degrau = useRef(degrauInicial(
    typeof window === 'undefined' ? 1 : window.devicePixelRatio,
  ));
  const amostras = useRef([]);

  const cair = (novo) => {
    if (novo === degrau.current) return;
    degrau.current = novo;
    amostras.current = [];
    setDpr(DEGRAUS_DE_RESOLUCAO[novo]);
  };

  useFrame((_, delta) => {
    const ms = delta * 1000;

    // Um quadro absurdo derruba na hora, sem esperar a amostra. Sem isto, um
    // aparelho fraco pagava 10 quadros na resolução cheia antes de a cena cair
    // — o CI mediu 1.938 ms de bloqueio numa janela de 2.000 ms.
    if (quedaDeEmergencia(ms)) {
      if (degrau.current > 0) { cair(degrau.current - 1); return; }
      // Já está no piso e AINDA não dá conta. Aqui a resolução acabou: quem
      // ainda pesa é o `antialias`, que não se troca com a cena montada (é
      // opção do contexto WebGL). Quem resolve isso é `LandingScene`.
      aoSofrerNoPiso?.();
      return;
    }

    amostras.current.push(ms);
    if (amostras.current.length < QUADROS_POR_AMOSTRA) return;

    // Mediana, e não média: um único quadro de 500 ms (aba em segundo plano,
    // coleta de lixo) arrastaria a média e rebaixaria a cena de uma máquina
    // que está perfeitamente bem.
    const ordenado = [...amostras.current].sort((a, b) => a - b);
    const mediana = ordenado[Math.floor(ordenado.length / 2)];
    amostras.current = [];

    const novo = proximoDegrau({ degrau: degrau.current, mediana });
    if (novo !== degrau.current) { cair(novo); return; }

    // JÁ NO PISO E AINDA LENTO — e este caminho faltava.
    //
    // O CI mediu 165 desenhos em 2 s, ou seja ~60 ms por quadro: lento o
    // bastante para a amostra reprovar, e **abaixo** do limite de emergência de
    // 100 ms. Resultado: no piso, `proximoDegrau` devolvia o mesmo degrau,
    // nada acontecia, e o desligamento do antialias nunca era alcançado.
    //
    // O aviso tem que sair da MESMA decisão que a queda, senão ele só existe no
    // papel — foi exatamente o que aconteceu, e o número piorou de 1.938 para
    // 2.029 ms enquanto eu achava que tinha resolvido.
    if (degrau.current === 0 && mediana > LENTO_MS) aoSofrerNoPiso?.();
  });

  return null;
}
