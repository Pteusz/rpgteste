// M001 — esqueleto andante: um turno completo, ponta a ponta, por websocket.
// Contrato do protocolo (v0):
//   servidor -> {t:'inicio', lado, estado}      quando os 2 jogadores conectaram
//   cliente  -> {t:'acao', golpe:<indice>}      escolha do turno
//   servidor -> {t:'turno', eventos, estado}    quando os 2 enviaram (mesma msg para ambos)
// estado = {turno, lados:[{monstro,hp},{monstro,hp}], fim: null | <lado vencedor>}
// evento = {tipo:'dano', de, para, valor}
import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { criarServidor } from '../src/server.js';

function cliente(porta) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${porta}`);
    const fila = [];
    const esperando = [];
    ws.on('message', (d) => {
      const msg = JSON.parse(d.toString());
      const w = esperando.shift();
      if (w) w(msg);
      else fila.push(msg);
    });
    ws.once('error', reject);
    ws.once('open', () =>
      resolve({
        proxima: () =>
          new Promise((res, rej) => {
            if (fila.length) return res(fila.shift());
            const t = setTimeout(() => rej(new Error('timeout esperando mensagem')), 2000);
            esperando.push((m) => {
              clearTimeout(t);
              res(m);
            });
          }),
        enviar: (obj) => ws.send(JSON.stringify(obj)),
        fechar: () => ws.close(),
      }),
    );
  });
}

test('um turno completo, ponta a ponta', async () => {
  const srv = await criarServidor({ porta: 0 });
  const A = await cliente(srv.porta);
  const B = await cliente(srv.porta);
  try {
    const [iA, iB] = await Promise.all([A.proxima(), B.proxima()]);
    assert.equal(iA.t, 'inicio');
    assert.equal(iA.lado, 0);
    assert.equal(iB.lado, 1);
    assert.deepEqual(iA.estado, iB.estado);
    assert.deepEqual(iA.estado.lados, [
      { monstro: 'brasa', hp: 100 },
      { monstro: 'folha', hp: 100 },
    ]);
    assert.equal(iA.estado.turno, 0);
    assert.equal(iA.estado.fim, null);

    A.enviar({ t: 'acao', golpe: 0 });
    B.enviar({ t: 'acao', golpe: 0 });

    const [tA, tB] = await Promise.all([A.proxima(), B.proxima()]);
    assert.equal(tA.t, 'turno');
    assert.deepEqual(tA, tB, 'os dois jogadores recebem exatamente a mesma resolução');

    // brasa é mais rápida (ataca primeiro) e tem vantagem sobre folha (x2); folha ataca com desvantagem (x0.5)
    assert.deepEqual(
      tA.eventos.map((e) => [e.tipo, e.de, e.para, e.valor]),
      [
        ['dano', 0, 1, 60],
        ['dano', 1, 0, 15],
      ],
    );
    assert.deepEqual(
      tA.estado.lados.map((l) => l.hp),
      [85, 40],
    );
    assert.equal(tA.estado.turno, 1);
    assert.equal(tA.estado.fim, null);
  } finally {
    A.fechar();
    B.fechar();
    await srv.fechar();
  }
});
