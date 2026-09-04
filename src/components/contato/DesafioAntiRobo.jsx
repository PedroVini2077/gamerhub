import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, RotateCw, AlertTriangle } from 'lucide-react';
import { carregarTurnstile, CHAVE_PUBLICA_TURNSTILE } from '../../lib/turnstile';

/**
 * O desafio anti-robô do formulário de contato.
 *
 * ── O que ele resolve ───────────────────────────────────────────────────────
 *
 * Os limites do banco (3 mensagens por e-mail em 24 h, disjuntor de 60/hora)
 * impedem a tabela de virar depósito, mas não impedem um robô com muitos
 * endereços de **encher a hora e fechar o canal para todo mundo**.
 *
 * ── O caso que este componente existe para não esconder ─────────────────────
 *
 * O script vem do Cloudflare. Se ele não carregar — rede que bloqueia o
 * domínio, extensão agressiva, operadora ruim —, a pessoa fica sem conseguir
 * enviar. Isso é grave AQUI mais do que em qualquer outra tela: o `/contato` é
 * o canal de quem está banido ou trancado para fora, e não existe outro.
 *
 * Por isso a falha é **dita na tela, com um botão que tenta de novo**, e nunca
 * um `disabled` mudo. "O botão não funciona e não diz por quê" é o §1.5 na
 * pior versão — a pessoa conclui que o site quebrou e vai embora.
 */
export default function DesafioAntiRobo({ aoResolver, aoExpirar }) {
  const caixa = useRef(null);
  const [estado, setEstado] = useState('carregando'); // carregando | pronto | falhou
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let vivo = true;
    let idDoWidget = null;
    let api = null;

    carregarTurnstile()
      .then((turnstile) => {
        if (!vivo || !caixa.current) return;
        api = turnstile;
        idDoWidget = turnstile.render(caixa.current, {
          sitekey: CHAVE_PUBLICA_TURNSTILE,
          theme: 'dark',
          language: 'pt-br',
          callback: (token) => { if (vivo) { setEstado('pronto'); aoResolver(token); } },
          // O token do Turnstile vale poucos minutos. Sem este aviso, alguém
          // que abrisse a página e escrevesse com calma clicaria em enviar com
          // um token morto e receberia "não foi possível confirmar o captcha"
          // sem entender por quê.
          'expired-callback': () => { if (vivo) aoExpirar(); },
          'error-callback':   () => { if (vivo) { setEstado('falhou'); aoExpirar(); } },
        });
        setEstado('pronto');
      })
      .catch(() => { if (vivo) setEstado('falhou'); });

    return () => {
      vivo = false;
      // Sem isto, sair da página e voltar deixaria o widget antigo pendurado
      // no DOM e um segundo desafio apareceria por cima (§6.1, ciclo de vida).
      if (api && idDoWidget !== null) {
        try { api.remove(idDoWidget); } catch { /* já foi embora com o DOM */ }
      }
    };
  }, [tentativa, aoResolver, aoExpirar]);

  if (estado === 'falhou') {
    return (
      <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4 space-y-3">
        <p className="flex items-start gap-2 font-mono text-xs text-yellow-300">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>
            A verificação anti-robô não carregou. Ela vem do Cloudflare, e sem
            ela não dá para enviar. Pode ser bloqueio da sua rede ou de alguma
            extensão do navegador.
          </span>
        </p>
        <button
          type="button"
          onClick={() => { setEstado('carregando'); setTentativa((n) => n + 1); }}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-neon-green
                     hover:underline"
        >
          <RotateCw size={12} /> Tentar carregar de novo
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 font-mono text-[11px] text-gray-500">
        <ShieldCheck size={12} />
        {estado === 'carregando'
          ? 'Carregando a verificação anti-robô…'
          : 'Confirme que você não é um robô'}
      </p>
      <div ref={caixa} />
    </div>
  );
}
