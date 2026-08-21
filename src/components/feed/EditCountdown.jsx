import { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';

// Tempo restante da janela de edição de um post.
// Fica vermelho nos últimos 5 minutos.
export default function EditCountdown({ createdAt, limitMinutes }) {
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    function update() {
      const elapsed = (Date.now() - new Date(createdAt).getTime()) / 1000;
      const remaining = (limitMinutes * 60) - elapsed;
      if (remaining <= 0) { setCountdown('00:00'); return; }
      const m = Math.floor(remaining / 60).toString().padStart(2, '0');
      const s = Math.floor(remaining % 60).toString().padStart(2, '0');
      setCountdown(`${m}:${s}`);
    }
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [createdAt, limitMinutes]);

  return (
    <p className="text-xs font-mono flex items-center gap-1"
      style={{ color: countdown <= '05:00' ? '#ff4444' : '#6b7280' }}>
      <Timer size={11} /> Tempo restante: <span className="font-bold ml-1">{countdown}</span>
    </p>
  );
}
