// Núcleo puro: sem I/O, sem relógio, sem aleatoriedade. Tudo é dado + uma função.
//
// Primitivos (MODELO.md, seção 2):
//   1. estado   — objeto imutável {turno, lados:[{monstro,hp},{monstro,hp}], fim}
//   2. resolver — (estado, entradas) -> {estado, eventos}
// A ação ({golpe: <indice>}, uma por lado) não é primitivo: é a entrada do resolver.
// Todo o resto (dano, vantagem de tipo, ordem de ataque, fim de jogo) deriva destes dois.

// Anel de tipos: cada tipo vence o seguinte (e perde para o anterior). A tabela de
// vantagens inteira deriva dessa única ordem.
export const ANEL = ['brasa', 'folha', 'onda', 'raio'];

export const MONSTROS = {
  brasa: { tipo: 'brasa', hp: 100, vel: 60, golpes: [{ nome: 'chama', poder: 30, tipo: 'brasa' }] },
  folha: { tipo: 'folha', hp: 100, vel: 40, golpes: [{ nome: 'chicote', poder: 30, tipo: 'folha' }] },
  onda: { tipo: 'onda', hp: 100, vel: 50, golpes: [{ nome: 'jato', poder: 30, tipo: 'onda' }] },
  raio: { tipo: 'raio', hp: 100, vel: 70, golpes: [{ nome: 'faisca', poder: 30, tipo: 'raio' }] },
};

export function multiplicador(tipoAtaque, tipoDefesa) {
  const d = (ANEL.indexOf(tipoDefesa) - ANEL.indexOf(tipoAtaque) + ANEL.length) % ANEL.length;
  if (d === 1) return 2;
  if (d === ANEL.length - 1) return 0.5;
  return 1;
}

export function estadoInicial(monstroA, monstroB) {
  return {
    turno: 0,
    lados: [monstroA, monstroB].map((m) => ({ monstro: m, hp: MONSTROS[m].hp })),
    fim: null,
  };
}

export function resolver(estado, acoes) {
  const lados = estado.lados.map((l) => ({ ...l }));
  const eventos = [];
  let fim = estado.fim;

  // ordem: maior velocidade primeiro; empate favorece o lado 0
  const ordem = [0, 1].sort((a, b) => {
    const dv = MONSTROS[lados[b].monstro].vel - MONSTROS[lados[a].monstro].vel;
    return dv !== 0 ? dv : a - b;
  });

  for (const de of ordem) {
    if (fim !== null) break;
    const para = 1 - de;
    const golpe = MONSTROS[lados[de].monstro].golpes[acoes[de].golpe];
    const mult = multiplicador(golpe.tipo, MONSTROS[lados[para].monstro].tipo);
    const valor = Math.floor(golpe.poder * mult);
    lados[para].hp = Math.max(0, lados[para].hp - valor);
    eventos.push({ tipo: 'dano', de, para, valor });
    if (lados[para].hp === 0) fim = de;
  }

  return { estado: { turno: estado.turno + 1, lados, fim }, eventos };
}
