# MODELO — jogo de turno com 4 monstros, batalha online

Este arquivo é a fonte da verdade sobre **o que o jogo é**. O código e os testes são derivados dele, nunca o contrário.
Legenda: `[Mateus decidiu]` = veio dele; `[Mateus aprovou]` = proposta do Claude que ele aprovou.
**Aprovação:** em 2026-10-23 o Mateus aprovou o modelo desta versão (resposta "ok"), incluindo a regra R7 como está escrita (o `valor` do evento é o dano calculado). Qualquer mudança nasce de uma missão de renegociação.

**Como conferir sem ler código:** pegue os exemplos da seção 5, aplique as regras da seção 2 à mão e veja se o resultado bate.
Se a regra estiver errada, o exemplo vai parecer errado para você. É nesse momento que o modelo se corrige.

---

## 1. Premissas e quem decidiu

| # | Premissa | Origem |
|---|----------|--------|
| P1 | Tudo deve derivar de poucos primitivos | [Mateus decidiu] |
| P2 | Jogo de turno, estilo Pokémon, com somente 4 monstros | [Mateus decidiu] |
| P3 | Batalhas online por websocket | [Mateus decidiu] |
| P4 | A linguagem é escolha do Claude | [Mateus decidiu] |
| P5 | Os dois jogadores escolhem em segredo e a resolução só acontece quando ambos escolheram | [Mateus aprovou] |
| P6 | Os ataques de um turno são resolvidos **em sequência**, do mais rápido para o mais lento (não são simultâneos) | [Mateus decidiu] |
| P7 | Sem aleatoriedade: mesma entrada, sempre a mesma saída | [Mateus aprovou] |
| P8 | Um monstro por jogador por partida, sem troca | [Mateus aprovou] |
| P9 | O servidor é autoritativo: o cliente só envia a intenção, nunca o resultado | [Mateus aprovou] |
| P10 | Um golpe por monstro nesta fase (poder 30, do próprio tipo) | [Mateus aprovou] |
| P11 | A ação não é um primitivo: é apenas a entrada do `resolver` | [Mateus decidiu] |

## 2. Primitivos e derivações

### Os primitivos [dois, por decisão do Mateus (P11); a forma de cada um é proposta do Claude]
1. **Estado**: um valor imutável com `turno`, os dois `lados` (`monstro` e `hp` de cada um) e `fim` (nulo, ou o lado vencedor).
2. **Resolver**: uma função pura `resolver(estado, entradas) → {novo estado, eventos}`.

A **ação** (a escolha de um lado em um turno; hoje, só `golpe`: qual golpe usar) não é primitivo: é o dado que entra no `resolver`, uma por lado, como `entradas = [ação do lado 0, ação do lado 1]`.

Tudo que o jogo faz é aplicar `resolver` repetidamente. Não existe outra forma de o estado mudar.

### Dados (não são primitivos, são tabelas) [Mateus aprovou]
- **Anel de tipos:** `brasa → folha → onda → raio → (volta a brasa)`. Cada tipo vence o seguinte.
- **Monstros:** cada um tem tipo, `hp` e `vel` (velocidade).

| monstro | tipo | hp | vel | golpe (poder 30) |
|---------|------|----|-----|------------------|
| brasa | brasa | 100 | 60 | chama |
| folha | folha | 100 | 40 | chicote |
| onda  | onda  | 100 | 50 | jato |
| raio  | raio  | 100 | 70 | faísca |

### Regras derivadas [Mateus aprovou]
- **R1. Multiplicador.** Conte quantos passos o tipo do defensor está à frente do tipo do atacante no anel. 1 passo: x2. 3 passos (ou seja, 1 para trás): x0,5. 0 ou 2 passos: x1.
  Então: brasa vence folha, folha vence onda, onda vence raio, raio vence brasa. Brasa × onda e folha × raio são neutros.
- **R2. Dano.** `dano = arredondar para baixo (poder do golpe × multiplicador)`. Com poder 30 só existem três valores: 60, 30 ou 15.
- **R3. Ordem.** Ataca primeiro o monstro de maior `vel`. Em empate, ataca primeiro o lado 0.
- **R4. Aplicação.** Cada ataque tira o dano do `hp` do alvo, sem passar de zero.
- **R5. Fim.** Se um ataque leva o `hp` do alvo a zero, `fim` passa a ser o lado do atacante, e o resto do turno **não acontece** (quem caiu não ataca).
- **R6. Turno.** Após resolver, `turno` aumenta em 1.
- **R7. Evento.** Cada ataque gera um evento `dano {de, para, valor}`. O `valor` é o dano calculado em R2, **mesmo que o hp restante seja menor** (ver pergunta Q4).

### Protocolo (como o servidor conversa com os clientes) [Mateus aprovou]
- Quando o 2º jogador conecta, o servidor manda `inicio {lado, estado}` para ambos. O 1º a conectar é o lado 0.
- Cada cliente manda `acao {golpe}` uma única vez por turno.
- Quando as duas ações chegaram, o servidor manda a **mesma** mensagem `turno {eventos, estado}` para ambos.
- Ação inválida, repetida no mesmo turno, ou fora de partida → mensagem `erro {motivo}` só para quem errou.
- Um 3º cliente é recusado (partida cheia).

## 3. Invariantes (devem valer sempre) [Mateus aprovou]
- `hp` nunca é negativo e nunca passa do `hp` inicial.
- Mesma entrada produz a mesma saída (P7).
- Os dois jogadores recebem exatamente a mesma resolução de um turno.
- Depois que `fim` deixa de ser nulo, o estado não muda mais.

## 4. O que este modelo ainda não cobre
Escolha de monstro, salas e matchmaking, desconexão no meio da partida, mais de um golpe por monstro, reconexão, cliente jogável.

## 5. Exemplos resolvidos à mão
Convenção: lado 0 e lado 1; ambos usam o golpe 0 (o único). `hp` escrito como `[lado0, lado1]`.

**E1. Vantagem e velocidade.** brasa (lado 0) × folha (lado 1), ambos com 100.
1. R3: brasa (vel 60) é mais rápida que folha (vel 40), então brasa ataca primeiro.
2. R1: folha está 1 passo à frente de brasa no anel → x2. R2: 30 × 2 = 60. folha: 100 → 40.
3. folha ataca: brasa está 3 passos à frente de folha (1 para trás) → x0,5. 30 × 0,5 = 15. brasa: 100 → 85.
Resultado: hp `[85, 40]`, turno 1, fim nulo. Eventos: `0→1 valor 60`, `1→0 valor 15`.

**E2. Neutro.** brasa (lado 0) × onda (lado 1), ambos com 100.
1. brasa (60) é mais rápida que onda (50): brasa ataca primeiro.
2. onda está 2 passos de brasa → x1. 30. onda: 100 → 70.
3. onda ataca: brasa está 2 passos → x1. 30. brasa: 100 → 70.
Resultado: hp `[70, 70]`, turno 1, fim nulo. Eventos: `0→1 30`, `1→0 30`.

**E3. O lado 1 é o mais rápido.** brasa (lado 0) × raio (lado 1), ambos com 100.
1. raio (vel 70) é mais rápido que brasa (60): **o lado 1 ataca primeiro**.
2. raio contra brasa: brasa está 1 passo à frente de raio (o anel volta) → x2. 60. brasa: 100 → 40.
3. brasa contra raio: raio está 3 passos à frente → x0,5. 15. raio: 100 → 85.
Resultado: hp `[40, 85]`, turno 1. Eventos: `1→0 60`, `0→1 15` (ordem inversa dos lados).

**E4. Empate de velocidade.** brasa × brasa, ambos com 100.
1. Mesma vel (60): R3 dá a vez primeiro ao lado 0.
2. Mesmo tipo: 0 passos → x1. 30 em cada ataque.
Resultado: hp `[70, 70]`, turno 1. Eventos: `0→1 30`, `1→0 30`.

**E5. Fim do jogo corta o turno.** Partida em andamento: brasa (lado 0) com 85, folha (lado 1) com 40, turno 1 (o resultado de E1). Ambos usam o golpe 0 de novo.
1. brasa ataca primeiro: 60. folha: 40 − 60 → **0** (R4, não fica negativo).
2. R5: `fim` = lado 0. folha **não ataca**.
Resultado: hp `[85, 0]`, turno 2, fim = 0. Um único evento: `0→1 valor 60` (R7: o valor é o calculado, não os 40 que realmente restavam).

**E6. O mais lento vence.** brasa (lado 0) com 10, onda (lado 1) com 100. Ambos usam o golpe 0.
1. brasa (60) ataca primeiro: neutro, 30. onda: 100 → 70.
2. onda ataca: neutro, 30. brasa: 10 − 30 → 0. `fim` = lado 1.
Resultado: hp `[0, 70]`, turno 1, fim = 1. Dois eventos: `0→1 30`, `1→0 30`.

## 6. Perguntas (todas resolvidas nesta versão)
- **Q1.** ~~Sequência por velocidade ou simultâneo?~~ Resolvida: sequência por velocidade (P6).
- **Q2.** ~~Sem aleatoriedade?~~ Resolvida: sem aleatoriedade (P7). Se vier depois, entra como entrada explícita do `resolver`.
- **Q3.** ~~Quantos primitivos?~~ Resolvida: dois, estado e `resolver`; a ação é só a entrada (P11).
- **Q4.** ~~Valor calculado ou removido?~~ Resolvida: calculado (R7, 60 em E5). Lido a partir do "ok" sobre o texto como estava escrito.
- **Q5.** ~~Time e troca agora?~~ Resolvida: um monstro por jogador, sem troca (P8), nesta fase.
- **Q6.** ~~Algum número tem significado?~~ Resolvida: são placeholders, ajustáveis depois por missão de renegociação.
