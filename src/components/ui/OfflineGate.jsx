import { lazy, Suspense, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DatabaseZap, Loader2 } from 'lucide-react';
import SplashScreen from './SplashScreen';

const Landing = lazy(() => import('../../pages/Landing'));

const SEGUNDOS_ATE_REDIRECIONAR = 4;

/**
 * O que aparece quando o site perde o banco.
 *
 * Primeiro um aviso em cima de tudo, explicando o que aconteceu e que vai
 * redirecionar. Depois a landing, que é a única página do site que **não
 * depende do banco para nada** — por isso ela funciona mesmo com tudo fora.
 *
 * A URL vai para `/` junto com o aviso: se a pessoa recarregar, cai num lugar
 * coerente em vez de numa rota interna quebrada.
 */
export default function OfflineGate() {
  const [restam, setRestam] = useState(SEGUNDOS_ATE_REDIRECIONAR);
  const navigate = useNavigate();

  useEffect(() => {
    // `replace` de propósito: a rota interna que quebrou não deve ficar no
    // histórico, senão o botão "voltar" leva de volta para a tela quebrada.
    navigate('/', { replace: true });
  }, [navigate]);

  useEffect(() => {
    if (restam <= 0) return;
    const t = setTimeout(() => setRestam(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [restam]);

  return (
    <>
      <Suspense fallback={<SplashScreen />}>
        <Landing />
      </Suspense>

      {restam > 0 && (
        <div
          role="alert"
          className="fixed inset-0 z-[9999] flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.92)' }}
        >
          <div className="w-full max-w-sm space-y-5 animate-fade-up text-center">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center">
                <DatabaseZap size={28} className="text-yellow-400" />
              </div>
            </div>

            <div className="space-y-1">
              <h1 className="font-display text-xl text-yellow-400 uppercase tracking-widest">
                Sem conexão com o banco
              </h1>
              <p className="text-xs text-gray-400 font-mono leading-relaxed">
                O site perdeu acesso ao banco de dados e não consegue carregar
                nem salvar nada agora.
              </p>
            </div>

            <p className="flex items-center justify-center gap-2 text-xs font-mono text-gray-500">
              <Loader2 size={13} className="animate-spin" />
              Redirecionando para a página inicial em{' '}
              <span translate="no" className="notranslate text-yellow-400 font-bold tabular-nums">
                {restam}s
              </span>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
