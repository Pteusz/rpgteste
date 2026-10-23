# Kit de missões (versão mínima)

Três peças: **ponteiro** (`MISSAO.md`), **teste travado** (`tests/`), **commit a cada verde** (tag `save/Mxxx`).

## Instalar
Copie para a raiz do projeto: `m`, `CLAUDE.md`, `.mestre.conf`, `PENDENCIAS.md`, `DECISOES.md`.
Ajuste `TESTE_CMD` e `TESTE_DIR` em `.mestre.conf`. Requer bash e git.

## Ciclo
```
./m novo "fazendo X" "para Y" "pronto quando Z"   # abre a missão (ponteiro)
# escreva o teste em tests/ — ele precisa FALHAR
./m travar                                        # congela tests/ e confirma que falha
# o agente implementa; a cada passo:
./m check                                         # vermelho/verde, e avisa se o teste foi mexido
./m fechar                                        # verde: commit + tag save/Mxxx
./m voltar [--sim]                                # algo quebrou: volta ao último save
./m status                                        # mostra o ponteiro
```

## Quando crescer (só quando doer)
- Esqueceu o porquê de algo → use `DECISOES.md`.
- Detalhes invadindo a missão → use `PENDENCIAS.md`.
- Mudar um módulo quebra outro → crie `MAPA.md` e rode só os testes dos vizinhos.
- Testes lentos → separe `check` rápido e `check` total em background.
- Agente mexe onde não deve → hook/permissão bloqueando edição fora do escopo.
