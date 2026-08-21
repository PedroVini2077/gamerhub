import { useEffect, useRef, useState } from 'react';

/**
 * Contagem regressiva antes de uma ação destrutiva, com janela pra cancelar.
 *
 * Existe como hook por causa de um bug real: no `PostCard` o `clearInterval`
 * morava num efeito que dependia das props de engajamento do post
 * (`like_count`, `liked_by_me`, `post_media`). Qualquer refetch do feed no meio
 * da contagem derrubava o timer SEM zerar o estado — o aviso "Excluindo post em
 * Ns..." congelava na tela e a exclusão nunca acontecia.
 *
 * Aqui a limpeza roda SÓ no desmonte, que é o único momento em que uma
 * contagem em andamento deve mesmo ser abandonada.
 */
export function useDeleteCountdown(seconds, onExpire) {
  const [remaining, setRemaining] = useState(null);
  const timerRef = useRef(null);

  // `onExpire` costuma ser uma função nova a cada render. Guardar em ref evita
  // que o intervalo tenha que ser recriado (e portanto reiniciado) por isso.
  const onExpireRef = useRef(onExpire);
  useEffect(() => { onExpireRef.current = onExpire; });

  useEffect(() => () => clearInterval(timerRef.current), []);

  function stop() {
    clearInterval(timerRef.current);
    timerRef.current = null;
    setRemaining(null);
  }

  function start() {
    clearInterval(timerRef.current);
    let count = seconds;
    setRemaining(count);
    timerRef.current = setInterval(() => {
      count -= 1;
      if (count > 0) { setRemaining(count); return; }
      stop();
      onExpireRef.current?.();
    }, 1000);
  }

  return { remaining, active: remaining !== null, start, cancel: stop };
}
