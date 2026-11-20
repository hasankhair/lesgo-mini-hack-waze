// Subscribes to community report changes through Supabase Realtime
// (Postgres Changes). RLS decides which rows each subscriber receives.
export function subscribeToReports(client, { onInsert, onUpdate, onDelete, onStatus }) {
  if (!client) {
    onStatus?.('disabled');
    return () => {};
  }
  const channel = client
    .channel('public:traffic_reports')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'traffic_reports' }, (payload) => {
      if (payload.eventType === 'INSERT') onInsert?.(payload.new);
      else if (payload.eventType === 'UPDATE') onUpdate?.(payload.new);
      else if (payload.eventType === 'DELETE') onDelete?.(payload.old);
    })
    .subscribe((status) => {
      // SUBSCRIBED | CHANNEL_ERROR | TIMED_OUT | CLOSED
      onStatus?.(status === 'SUBSCRIBED' ? 'live' : status === 'CLOSED' ? 'offline' : status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' ? 'error' : 'connecting');
    });

  return () => {
    client.removeChannel(channel);
  };
}
