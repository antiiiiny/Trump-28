import type { Client } from 'colyseus';

export function sendPrivate(client: Client, type: string, payload: unknown) {
  try {
    if (!client || !client.sessionId) {
      console.warn('sendPrivate: Invalid client object');
      return;
    }
    console.log('sendPrivate: Sending', type, 'to client', client.sessionId, 'with payload:', JSON.stringify(payload).slice(0, 100));
    client.send(type, payload);
    console.log('sendPrivate: Successfully sent', type, 'to client', client.sessionId);
  } catch (err) {
    console.error('sendPrivate: Failed to send', type, 'to client', client.sessionId, 'error:', err);
    throw err; // Re-throw so caller can handle it
  }
}
