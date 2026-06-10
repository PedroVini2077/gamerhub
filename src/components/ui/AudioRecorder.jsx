import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, Trash2, Check, MicOff } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AudioRecorder({ onRecorded, onCancel }) {
  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const audioRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      if (mediaRef.current) mediaRef.current.stop();
    };
  }, []);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = e => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const file = new File([blob], `audio-${Date.now()}.webm`, { type: 'audio/webm' });
        setRecorded({ url, file });
        stream.getTracks().forEach(t => t.stop());
      };

      recorder.start();
      setRecording(true);
      setTime(0);
      timerRef.current = setInterval(() => setTime(t => t + 1), 1000);
    } catch (err) {
      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        toast.error('Nenhum microfone encontrado neste dispositivo.');
      } else {
        setPermissionDenied(true);
      }
    }
  }

  function stopRecording() {
    mediaRef.current?.stop();
    setRecording(false);
    clearInterval(timerRef.current);
  }

  function togglePlay() {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  }

  function formatTime(s) {
    return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  }

  return (
    <div className="border border-dark-400 rounded-lg p-4 bg-dark-700 mb-3">
      <p className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-3">Gravador de Áudio</p>

      {permissionDenied ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-red-400">
            <MicOff size={14} />
            <span className="text-xs font-mono">Microfone bloqueado</span>
          </div>
          <p className="text-xs font-mono text-gray-500 leading-relaxed">
            Para liberar: toque no <span className="text-white">🔒 cadeado</span> na barra de endereço → Permissões do site → Microfone → Permitir.
          </p>
          <button
            onClick={() => { setPermissionDenied(false); startRecording(); }}
            className="text-xs font-mono text-neon-green hover:underline"
          >
            Tentar novamente
          </button>
        </div>
      ) : !recorded ? (
        <div className="flex items-center gap-3">
          {!recording ? (
            <button
              onClick={startRecording}
              className="flex items-center gap-2 btn-neon py-2 px-4 text-xs"
            >
              <Mic size={14} />
              Gravar
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 btn-purple py-2 px-4 text-xs animate-pulse"
            >
              <Square size={14} />
              Parar
            </button>
          )}
          {recording && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="font-mono text-sm text-red-400">{formatTime(time)}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <audio ref={audioRef} src={recorded.url} onEnded={() => setPlaying(false)} />
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="w-8 h-8 rounded-full bg-neon-green/10 border border-neon-green/30 flex items-center justify-center text-neon-green hover:bg-neon-green/20"
            >
              {playing ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <span className="text-xs font-mono text-gray-400">
              {formatTime(time)} gravado
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onRecorded(recorded.file)}
              className="btn-solid py-1.5 px-3 text-xs flex items-center gap-1"
            >
              <Check size={12} /> Usar áudio
            </button>
            <button
              onClick={() => { setRecorded(null); setTime(0); }}
              className="text-xs font-mono text-gray-500 hover:text-red-400 flex items-center gap-1"
            >
              <Trash2 size={12} /> Regravar
            </button>
            <button
              onClick={onCancel}
              className="text-xs font-mono text-gray-500 hover:text-white"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
