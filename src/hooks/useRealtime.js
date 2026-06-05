import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

/**
 * useRealtime — subscribes to a Supabase Realtime channel for a given table.
 * Automatically cleans up the subscription on unmount.
 *
 * @param {object} options
 * @param {string}   options.table    - Supabase table name
 * @param {string}   options.filter   - Optional filter e.g. 'user_id=eq.abc-123'
 * @param {Function} options.onInsert - Callback for INSERT events
 * @param {Function} options.onUpdate - Callback for UPDATE events
 * @param {Function} options.onDelete - Callback for DELETE events
 * @param {boolean}  options.enabled  - Whether to subscribe (default: true)
 */
const useRealtime = ({ table, filter, onInsert, onUpdate, onDelete, enabled = true }) => {
  const channelRef = useRef(null);

  useEffect(() => {
    if (!enabled || !table) return;

    // Append a unique ID to the channel name to prevent conflicts 
    // when multiple components subscribe to the same table simultaneously.
    const channelName = `realtime:${table}${filter ? `:${filter}` : ''}:${Math.random().toString(36).substring(7)}`;
    let sub = supabase.channel(channelName);

    const cfg = { event: '*', schema: 'public', table };
    if (filter) cfg.filter = filter;

    sub = sub.on('postgres_changes', cfg, (payload) => {
      if (payload.eventType === 'INSERT' && onInsert) onInsert(payload.new);
      if (payload.eventType === 'UPDATE' && onUpdate) onUpdate(payload.new, payload.old);
      if (payload.eventType === 'DELETE' && onDelete) onDelete(payload.old);
    });

    sub.subscribe((status) => {
      console.log(`[Realtime:${table}] Status: ${status}`);
    });

    channelRef.current = sub;

    return () => {
      supabase.removeChannel(channelRef.current);
    };
  }, [table, filter, enabled]);
};

export default useRealtime;
