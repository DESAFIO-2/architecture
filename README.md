# architecture

Repositório de arquitetura do **SUS Cidadão** (organização DESAFIO-2). É de responsabilidade
do arquiteto do projeto: **nenhuma mudança entra na `main` sem a aprovação dele**
(veja [GOVERNANCE.md](GOVERNANCE.md)).

O site tem três visões, todas desenhadas a partir de arquivos versionados:

| Visão | Fonte | O que mostra |
| --- | --- | --- |
| Arquitetura atual | [`model/system.json`](model/system.json) | Os quatro repositórios, de onde vêm os dados até os clientes, e os achados do arquiteto |
| Arquitetura de IA | [`model/ai.json`](model/ai.json) | Guardrails, agentes, recuperação, modelos e avaliação, com as métricas como foram publicadas |
| Projetor de embeddings | [`model/agents.json`](model/agents.json) | Para cada agente, o que ele consulta, projetado em 3D a partir do `bge-m3` |

## Estrutura

```text
model/        fonte única: arquitetura como dados (JSON), com o commit de origem de cada visão
site/         Vite + TypeScript, sem framework; desenha o modelo em SVG e o projetor com Plotly
projector/    Python: lê os datasets de cada agente, gera embeddings no Ollama local, faz PCA 3D
governance/   ruleset da main e script que o aplica no GitHub
docs/adr/     decisões deste repositório
```

O projetor segue portas e adaptadores: `build.py` (caso de uso) depende de `Embedder` e
`DocumentSource` (`ports.py`). `ollama.py` e `sources.py` são as implementações, e `cli.py` é
o único lugar que as escolhe. Os testes usam um embedder falso e não precisam do Ollama.

## Rodar localmente

Requer Node 22+, [uv](https://docs.astral.sh/uv/) e, para regenerar o projetor, Ollama com `bge-m3`.

```bash
make install
make dev                                    # site em http://localhost:5173
make check                                  # tipos, testes e build do site; ruff, mypy e pytest do projetor
make projector SOURCE=../development        # regenera site/public/data/projector a partir de um clone
```

## Como atualizar

1. **Mudou a arquitetura?** Edite `model/system.json` ou `model/ai.json`, atualize `asOf` e o
   commit em `sources`. Métrica entra como foi publicada; reprovada continua `"pass": false`.
2. **Novo agente?** Acrescente uma entrada em `model/agents.json` com os datasets que ele
   consulta e rode `make projector`. A aba nova aparece sozinha no site.
3. Abra um PR. A CI (`site` e `projector`) precisa passar e o arquiteto precisa aprovar.

O projetor lê só dados públicos do `development`. **Nunca** inclua um holdout cego: projetar
um conjunto de teste expõe os casos e invalida a medição.
