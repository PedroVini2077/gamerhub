import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  DEGRAUS_DE_RESOLUCAO, QUADROS_POR_AMOSTRA, degrauInicial, proximoDegrau,
} from '../../../lib/resolucaoDaCena';

/**
 * Aplica a regra de `lib/resolucaoDaCena.js` a cada amostra de quadros.
 *
 * A cena começa no melhor que o aparelho pede e só DESCE — ver lá o porquê, e
 * o relato do dono que fez a versão anterior (que começava baixa e subia) ser
 * jogada fora.
 */
export default function ResolucaoAdaptativa() {
  const setDpr = useThree(estado => estado.setDpr);
  const degrau = useRef(degrauInicial(
    typeof window === 'undefined' ? 1 : window.devicePixelRatio,
  ));
  const amostras = useRef([]);

  useFrame((_, delta) => {
    amostras.current.push(delta * 1000);
    if (amostras.current.length < QUADROS_POR_AMOSTRA) return;

    // Mediana, e não média: um único quadro de 500 ms (aba em segundo plano,
    // coleta de lixo) arrastaria a média e rebaixaria a cena de uma máquina
    // que está perfeitamente bem.
    const ordenado = [...amostras.current].sort((a, b) => a - b);
    const mediana = ordenado[Math.floor(ordenado.length / 2)];
    amostras.current = [];

    const novo = proximoDegrau({ degrau: degrau.current, mediana });
    if (novo === degrau.current) return;
    degrau.current = novo;
    setDpr(DEGRAUS_DE_RESOLUCAO[novo]);
  });

  return null;
}
