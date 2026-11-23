import type { DataConnection, Peer as PeerType } from 'peerjs';
import { peerIdFor, type ToGuest, type ToHost } from './protocol';

/**
 * Dunne laag over PeerJS (WebRTC). Gebruikt de gratis openbare PeerJS-server alleen om
 * elkaar te vinden; daarna gaan berichten rechtstreeks tussen de browsers.
 * PeerJS wordt pas geladen als je online gaat spelen.
 */

async function newPeer(id?: string): Promise<PeerType> {
  const { Peer } = await import('peerjs');
  return new Promise((resolve, reject) => {
    const peer = id ? new Peer(id, { debug: 1 }) : new Peer({ debug: 1 });
    peer.once('open', () => resolve(peer));
    peer.once('error', (err) => reject(err));
  });
}

export interface HostHandlers {
  onJoin: (connId: string) => void;
  onMessage: (connId: string, msg: ToHost) => void;
  onLeave: (connId: string) => void;
  onError: (message: string) => void;
}

export interface HostLink {
  send: (connId: string, msg: ToGuest) => void;
  close: () => void;
}

/** Open een tafel onder deze code. Mislukt als de code al in gebruik is. */
export async function hostTable(code: string, h: HostHandlers): Promise<HostLink> {
  const peer = await newPeer(peerIdFor(code));
  const conns = new Map<string, DataConnection>();
  peer.on('connection', (conn) => {
    conn.on('open', () => {
      conns.set(conn.connectionId, conn);
      h.onJoin(conn.connectionId);
    });
    conn.on('data', (data) => h.onMessage(conn.connectionId, data as ToHost));
    conn.on('close', () => {
      conns.delete(conn.connectionId);
      h.onLeave(conn.connectionId);
    });
  });
  peer.on('error', (err) => h.onError(String(err.type ?? err)));
  peer.on('disconnected', () => peer.reconnect());
  return {
    send: (id, msg) => conns.get(id)?.send(msg),
    close: () => peer.destroy(),
  };
}

export interface GuestHandlers {
  onMessage: (msg: ToGuest) => void;
  onClose: () => void;
  onError: (message: string) => void;
}

export interface GuestLink {
  send: (msg: ToHost) => void;
  close: () => void;
}

/** Verbind met de tafel met deze code. */
export async function joinTable(code: string, h: GuestHandlers): Promise<GuestLink> {
  const peer = await newPeer();
  const conn = peer.connect(peerIdFor(code), { reliable: true });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), 12000);
    conn.once('open', () => {
      clearTimeout(timer);
      resolve();
    });
    peer.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
  conn.on('data', (data) => h.onMessage(data as ToGuest));
  conn.on('close', h.onClose);
  peer.on('error', (err) => h.onError(String(err.type ?? err)));
  return {
    send: (msg) => conn.send(msg),
    close: () => peer.destroy(),
  };
}
