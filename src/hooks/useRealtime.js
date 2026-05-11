import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export function useRealtime(table, callback) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const channelName = `realtime-${table}-${Math.random().toString(36).slice(2)}`;
    
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
        callbackRef.current(payload);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table]);
}
