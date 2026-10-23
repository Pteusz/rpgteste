// Servidor websocket: só transporta. Toda regra do jogo está em core.js.
// M001 (esqueleto): uma única partida fixa, brasa x folha; o 1º a conectar é o lado 0.
import { WebSocketServer } from 'ws';
import { estadoInicial, resolver, MONSTROS } from './core.js';

export function criarServidor({ porta = 0 } = {}) {
  return new Promise((resolve, reject) => {
    const wss = new WebSocketServer({ port: porta });
    const jogadores = []; // índice = lado
    let estado = null;
    let pendentes = [null, null];

    const enviar = (ws, obj) => ws.send(JSON.stringify(obj));
    const todos = (obj) => jogadores.forEach((ws) => enviar(ws, obj));

    wss.on('connection', (ws) => {
      if (jogadores.length >= 2) {
        ws.close(1013, 'partida cheia');
        return;
      }
      const lado = jogadores.push(ws) - 1;

      if (jogadores.length === 2) {
        estado = estadoInicial('brasa', 'folha');
        jogadores.forEach((j, l) => enviar(j, { t: 'inicio', lado: l, estado }));
      }

      ws.on('message', (dados) => {
        let msg;
        try {
          msg = JSON.parse(dados.toString());
        } catch {
          return enviar(ws, { t: 'erro', motivo: 'json inválido' });
        }
        if (!estado || estado.fim !== null) return enviar(ws, { t: 'erro', motivo: 'sem partida ativa' });
        const golpes = MONSTROS[estado.lados[lado].monstro].golpes;
        if (msg.t !== 'acao' || !Number.isInteger(msg.golpe) || msg.golpe < 0 || msg.golpe >= golpes.length) {
          return enviar(ws, { t: 'erro', motivo: 'ação inválida' });
        }
        if (pendentes[lado] !== null) return enviar(ws, { t: 'erro', motivo: 'ação já enviada neste turno' });
        pendentes[lado] = { golpe: msg.golpe };

        if (pendentes[0] && pendentes[1]) {
          const r = resolver(estado, pendentes);
          estado = r.estado;
          pendentes = [null, null];
          todos({ t: 'turno', eventos: r.eventos, estado });
        }
      });
    });

    wss.once('error', reject);
    wss.once('listening', () =>
      resolve({
        porta: wss.address().port,
        fechar: () =>
          new Promise((res) => {
            wss.clients.forEach((c) => c.terminate());
            wss.close(() => res());
          }),
      }),
    );
  });
}
