import { Component } from 'react';
import { AlertTriangle, RotateCcw, WifiOff } from 'lucide-react';
import { registrarErro } from '../lib/monitoring';
import { ehFalhaDeRede } from '../lib/ehFalhaDeRede';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: null, semRede: false };
  }

  static getDerivedStateFromError(error) {
    // `[03/09]` A classificação acontece AQUI, e não no render, porque o render
    // roda a cada atualização: reavaliar `navigator.onLine` depois faria a tela
    // trocar de mensagem sozinha quando a rede voltasse, sem a pessoa ter
    // clicado em nada. O estado é o que era verdade no instante da falha.
    return {
      hasError: true,
      errorMessage: error?.message || null,
      semRede: ehFalhaDeRede(error),
    };
  }

  componentDidCatch(error, info) {
    console.error('[GamerHub] Erro não capturado:', error, info?.componentStack);

    // `[03/09]` Queda de rede NÃO vai para o Sentry.
    //
    // Não é economia de cota — é qualidade do sinal. O Sentry existe para
    // avisar que o SITE quebrou; Wi-Fi caindo no celular de quem usa não é
    // defeito nosso, e mandar isso enche o painel de ruído que ninguém pode
    // consertar. É a mesma lição do `edge_function_error` em 27/08: 68 de 68
    // eram "chamada recusada", e o alarme virou coisa de ignorar (§0.2, 4ª
    // regra).
    if (ehFalhaDeRede(error)) return;

    // O `console.error` acima serve pra depurar com o DevTools aberto — não é
    // tratamento (§1.5). Sem esta linha, a tela "Algo deu errado" aparecia pro
    // usuário e ninguém do outro lado ficava sabendo que ela apareceu.
    registrarErro(error, { componentStack: info?.componentStack });
  }

  render() {
    // `[03/09]` A rede caiu — e isso NÃO é "algo deu errado no site".
    //
    // O dono relatou a corrente de três mensagens quando o aparelho ficava
    // offline: "sem acesso ao banco", depois "algo deu errado", depois a página
    // do navegador. A do meio era mentira, e é a que manda investigar bug onde
    // não há nenhum (§1.5 — toda mensagem de erro tem que ser verdadeira).
    //
    // O texto também muda de conselho: "recarregar" numa queda de rede leva à
    // página de offline do navegador, que é o terceiro elo da corrente. O certo
    // é dizer para esperar a conexão e tentar de novo SEM recarregar.
    if (this.state.hasError && this.state.semRede) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8">
          <WifiOff size={40} className="text-neon-cyan" />
          <h2 className="font-display text-lg text-white">Sem conexão</h2>
          <p className="text-sm text-gray-500 font-mono text-center max-w-sm">
            O site não conseguiu falar com a internet. Isto não é um erro do
            GamerHub — quando a sua conexão voltar, clique em tentar de novo.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, errorMessage: null, semRede: false })}
            className="flex items-center gap-2 btn-neon py-2 px-5 text-sm"
          >
            <RotateCcw size={14} /> Tentar de novo
          </button>
        </div>
      );
    }

    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8">
          <AlertTriangle size={40} className="text-red-400" />
          <h2 className="font-display text-lg text-white">Algo deu errado</h2>
          <p className="text-sm text-gray-500 font-mono text-center max-w-sm">
            Ocorreu um erro inesperado. Tente novamente ou recarregue a página.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => this.setState({ hasError: false, errorMessage: null, semRede: false })}
              className="flex items-center gap-2 btn-neon py-2 px-5 text-sm"
            >
              <RotateCcw size={14} /> Tentar novamente
            </button>
            <button
              onClick={() => window.location.reload()}
              className="py-2 px-5 text-sm font-mono text-gray-400 border border-dark-400 rounded hover:bg-dark-700 transition-all"
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
