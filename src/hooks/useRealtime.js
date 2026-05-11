import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export function useRealtime(table, callback) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const channel = supabase
      .channel(`realtime-${table}-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
        callbackRef.current(payload);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [table]);
}
