import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[GamerHub] Erro não capturado:', error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8">
          <AlertTriangle size={40} className="text-red-400" />
          <h2 className="font-display text-lg text-white">Algo deu errado</h2>
          <p className="text-sm text-gray-500 font-mono text-center max-w-sm">
            Ocorreu um erro inesperado. Recarregue a página para continuar.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn-neon py-2 px-6 text-sm"
          >
            Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
