import { Mail } from 'lucide-react';
import { InputWrap } from './InputWrap';
import CampoDeSenha from '../ui/CampoDeSenha';

export default function LoginForm({ email, setEmail, password, setPassword, loading, onSubmit, onForgot, onSwitchToRegister }) {

  return (
    <>
      <div className="flex border border-dark-400 rounded overflow-hidden mb-6">
        <button type="button" className="flex-1 py-2.5 text-xs font-display tracking-widest uppercase bg-neon-green/10 text-neon-green">
          Entrar
        </button>
        <button type="button" onClick={onSwitchToRegister}
          className="flex-1 py-2.5 text-xs font-display tracking-widest uppercase text-gray-500 hover:text-gray-300">
          Registrar
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs text-gray-400 font-mono mb-1.5 uppercase tracking-wider">Email</label>
          <InputWrap>
            <span className="pl-3 pr-2 text-gray-500 shrink-0"><Mail size={14} /></span>
            <input id="email" aria-label="Email" type="email"
              className="flex-1 bg-transparent py-2.5 pr-3 text-sm text-white placeholder-gray-600 outline-none font-body"
              placeholder="gamer@email.com" value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onSubmit()} />
          </InputWrap>
        </div>

        <CampoDeSenha
          id="password" rotulo="Senha" valor={password} aoMudar={setPassword}
          aoTeclar={e => e.key === 'Enter' && onSubmit()}
        />

        <button onClick={onSubmit} disabled={loading}
          className="btn-solid w-full py-3 mt-2 disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? 'Aguarde...' : '// ENTRAR'}
        </button>

        <button type="button" onClick={onForgot}
          className="w-full text-center text-xs text-gray-600 hover:text-gray-400 font-mono transition-colors">
          Esqueci minha senha
        </button>
      </div>
    </>
  );
}
