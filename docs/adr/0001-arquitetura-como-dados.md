# ADR 0001: arquitetura como dados, desenhada por um site estático

- Estado: proposto
- Data: 24/11/2026
- Decisor: arquiteto do projeto

## Contexto

A arquitetura do SUS Cidadão está espalhada em quatro repositórios, com diagramas Mermaid
escritos à mão em documentos diferentes. Eles envelhecem em silêncio: em 24/11, por exemplo,
nenhum diagrama mostrava a API paralela do Data-Science.

## Decisão

1. A arquitetura vive em `model/*.json`, com o commit de origem de cada visão. O site só desenha.
2. O site é Vite + TypeScript sem framework. Diagramas em SVG gerado por um layout puro
   (raias em colunas), testado com Vitest. O Plotly entra só na rota do projetor, por import
   dinâmico.
3. O projetor é Python com portas e adaptadores. Os embeddings saem do `bge-m3` no Ollama
   local, o mesmo modelo de embeddings do RAGAS do projeto. Nenhum texto sai da máquina.
4. A posição 3D é PCA (determinística, com sinal fixado). Os vizinhos são calculados por
   cosseno no espaço original, não na projeção, para não enganar quem lê.
5. O site é publicado no GitHub Pages pela Action `pages`.

## Consequências

- Um PR que muda a arquitetura é um diff de JSON, fácil de revisar.
- O modelo pode ficar desatualizado se ninguém o editar. Mitigação: `asOf` e `sources` aparecem
  na tela, e o checklist do PR pede o commit de origem.
- PCA preserva menos estrutura local que UMAP ou t-SNE. Foi escolhida por ser determinística e
  sem dependências pesadas. Se for preciso, um adaptador UMAP entra sem mudar o caso de uso.
