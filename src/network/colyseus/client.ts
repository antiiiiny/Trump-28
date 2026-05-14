import { Client } from 'colyseus.js';

const endpoint = import.meta.env.VITE_COLYSEUS_ENDPOINT ?? 'ws://localhost:2567';

export const colyseusClient = new Client(endpoint);
