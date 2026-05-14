import type { Client } from 'colyseus';

export function sendPrivate(client: Client, type: string, payload: unknown) {
  try {
    client.send(type, payload);
  } catch (err) {
    console.warn('sendPrivate failed for client', client.sessionId, err);
  }
}
