import { Component } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, errorMessage: error?.message || null };
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
            Ocorreu um erro inesperado. Tente novamente ou recarregue a página.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => this.setState({ hasError: false, errorMessage: null })}
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
