// Transporte da rede: WebRTC via PeerJS. Só o "aperto de mão" passa pelo servidor público do PeerJS
// (precisa de internet); depois a luta vai direto de um computador para o outro pela rede local.
// As mensagens são objetos JSON; o anfitrião serializa uma vez e envia o mesmo texto para todos.
CK.Net = (() => {
  const PEERJS = 'https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.5/peerjs.min.js';
  const PREFIX = 'kolaboradores-kombat-';
  const JOIN_TIMEOUT = 12000;

  let lib = null;
  function load() {
    if (window.Peer) return Promise.resolve();
    lib = lib || new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = PEERJS;
      s.onload = res;
      s.onerror = () => { lib = null; s.remove(); rej(new Error('Sem internet: o modo em rede precisa de internet para conectar os computadores.')); };
      document.head.appendChild(s);
    });
    return lib;
  }

  // erros do PeerJS viram mensagens para gente
  function explain(err, code) {
    switch (err.type) {
      case 'peer-unavailable': return `Não achei a sala ${code}. Confira o código e se a sala ainda está aberta.`;
      case 'network':
      case 'server-error':
      case 'socket-error':
      case 'socket-closed': return 'Sem conexão com a internet. O modo em rede precisa dela para conectar os computadores.';
      case 'browser-incompatible': return 'Este navegador não suporta jogo em rede. Use Chrome, Edge ou Firefox atualizados.';
      case 'webrtc': return 'Não consegui ligar os computadores. Confira se estão no mesmo Wi-Fi/rede.';
      default: return 'Erro de conexão: ' + (err.message || err.type);
    }
  }

  const randomCode = () => String(1000 + Math.floor(Math.random() * 9000));
  const parse = (d) => { try { return typeof d === 'string' ? JSON.parse(d) : d; } catch (e) { return null; } };

  // anfitrião: registra a sala com um código de 4 dígitos (tenta outro se já estiver em uso)
  // h: { onJoin(id), onData(id, msg), onLeave(id) }
  async function host(h, tries = 5) {
    await load();
    const code = randomCode();
    const peer = new Peer(PREFIX + code, { debug: 0 });
    const conns = new Map();
    let closed = false;

    let up = false;
    const opened = await new Promise((res, rej) => {
      peer.on('open', () => { up = true; res(true); });
      peer.on('error', (err) => {
        if (up) return;   // depois de aberta, falhas do servidor não derrubam a sala (ver 'disconnected')
        peer.destroy();
        if (err.type === 'unavailable-id') res(false);
        else rej(new Error(explain(err, code)));
      });
    });
    if (!opened) {
      if (tries <= 1) throw new Error('Não consegui criar a sala. Tente de novo.');
      return host(h, tries - 1);
    }

    // perdeu o servidor de "aperto de mão": as lutas continuam, mas tenta voltar para aceitar novos jogadores
    peer.on('disconnected', () => { if (!closed) setTimeout(() => !closed && peer.reconnect(), 2000); });

    peer.on('connection', (conn) => {
      conn.on('open', () => {
        conns.set(conn.peer, conn);
        h.onJoin(conn.peer);
      });
      conn.on('data', (d) => {
        const msg = parse(d);
        if (msg && conns.has(conn.peer)) h.onData(conn.peer, msg);
      });
      const gone = () => { if (conns.delete(conn.peer)) h.onLeave(conn.peer); };
      conn.on('close', gone);
      conn.on('error', gone);
    });

    const raw = (id, text) => {
      const c = conns.get(id);
      if (c && c.open) try { c.send(text); } catch (e) { /* conexão caindo */ }
    };
    return {
      code,
      send: (id, msg) => raw(id, JSON.stringify(msg)),
      broadcast(msg, except) {
        const text = JSON.stringify(msg);
        for (const id of conns.keys()) if (id !== except) raw(id, text);
      },
      kick(id) {
        const c = conns.get(id);
        conns.delete(id);
        if (c) setTimeout(() => c.close(), 300);   // deixa a última mensagem chegar
      },
      close() {
        closed = true;
        setTimeout(() => peer.destroy(), 300);
      },
    };
  }

  // cliente: conecta na sala pelo código
  // h: { onData(msg), onClose() }
  async function join(code, h) {
    await load();
    const peer = new Peer({ debug: 0 });
    let conn = null;
    let ok = false;
    let closed = false;

    await new Promise((res, rej) => {
      const fail = (text) => { if (!ok) { ok = null; peer.destroy(); rej(new Error(text)); } };
      const timer = setTimeout(() => fail(`Não consegui entrar na sala ${code}. Confira se vocês estão no mesmo Wi-Fi/rede.`), JOIN_TIMEOUT);
      peer.on('error', (err) => {
        if (ok === false) { clearTimeout(timer); fail(explain(err, code)); }
      });
      peer.on('open', () => {
        conn = peer.connect(PREFIX + code, { serialization: 'raw', reliable: true });
        conn.on('open', () => {
          if (ok === null) return;
          ok = true;
          clearTimeout(timer);
          res();
        });
        conn.on('data', (d) => {
          const msg = parse(d);
          if (msg) h.onData(msg);
        });
        const gone = () => {
          if (!ok || closed) return;
          closed = true;
          peer.destroy();
          h.onClose();
        };
        conn.on('close', gone);
        conn.on('error', gone);
      });
    });

    return {
      send(msg) {
        if (conn && conn.open) try { conn.send(JSON.stringify(msg)); } catch (e) { /* conexão caindo */ }
      },
      close() {
        closed = true;
        setTimeout(() => peer.destroy(), 300);
      },
    };
  }

  return { host, join, load };
})();
