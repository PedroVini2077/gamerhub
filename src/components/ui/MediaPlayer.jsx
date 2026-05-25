import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

export default function MediaPlayer({ src, title }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setProgress((audio.currentTime / audio.duration) * 100 || 0);
    const onLoad = () => setDuration(audio.duration);
    const onEnd = () => setPlaying(false);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onLoad);
    audio.addEventListener('ended', onEnd);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onLoad);
      audio.removeEventListener('ended', onEnd);
    };
  }, []);

  function togglePlay() {
    if (playing) { audioRef.current.pause(); }
    else { audioRef.current.play(); }
    setPlaying(p => !p);
  }

  function handleSeek(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = pct * duration;
  }

  function fmt(s) {
    if (sed -n '1,35p' ~/gamerhub/src/components/ui/AvatarPopup.jsx || isNaN(s)) return '0:00';
    return Math.floor(s / 60) + ':' + Math.floor(s % 60).toString().padStart(2, '0');
  }

  return (
    <div className="mt-3 rounded-lg border border-dark-400 bg-dark-800 overflow-hidden">
      <audio ref={audioRef} src={src} preload="metadata" muted={muted} />
      <div className="h-1 bg-dark-500 cursor-pointer" onClick={handleSeek}>
        <div className="h-full bg-neon-green transition-all" style={{ width: progress + '%', boxShadow: '0 0 6px #39ff14' }} />
      </div>
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={togglePlay} className="w-8 h-8 rounded-full bg-neon-green/10 border border-neon-green/30 flex items-center justify-center text-neon-green hover:bg-neon-green/20 transition-colors shrink-0">
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-mono text-gray-300 truncate">{title || 'Audio'}</p>
          <p className="text-xs font-mono text-gray-600">
            {fmt(audioRef.current ? audioRef.current.currentTime : 0)} / {fmt(duration)}
          </p>
        </div>
        <button onClick={() => setMuted(m => !m)} className="text-gray-500 hover:text-neon-green transition-colors">
          {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
      </div>
    </div>
  );
}
