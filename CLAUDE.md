# Raio-X de IA — Intellectus Digital

Protótipo visual da ferramenta de auditoria de visibilidade de negócios locais em
respostas de IA generativa.

**Este repositório é só o front.** Não há backend aqui. Todas as telas consomem
fixtures através de `src/api/mock.ts`. O dia em que o backend existir, o único
arquivo que muda é `src/api/client.ts` (`USE_MOCK = false`).

## Comandos

```bash
npm run dev      # vite, porta 3000
npm run build    # build de produção
npm run lint     # tsc --noEmit — é o único verificador do projeto hoje
```

Não existe runner de testes. `npm run lint` é o portão. Rode antes de dizer que algo
está pronto.

## Regras que o código não pode violar

Estas seis vêm da tech-spec e valem para qualquer alteração, por menor que seja.
A versão longa está em `docs/01-principios-e-escopo.md`.

1. **Nenhuma chave de API no navegador.** Nada em `src/` lê `process.env` ou
   `import.meta.env`, e isso é intencional. Se você precisar de uma chave para
   fazer algo funcionar, o que você está fazendo pertence ao backend.
2. **Só afirmar o que foi testado.** A lista de motores sai de `corpus.motores`.
   Nunca escreva "ChatGPT", "Gemini" ou "Perplexity" literalmente na copy.
3. **Nunca inventar dado.** `null` quer dizer "não verificamos" e a interface tem
   que dizer isso com todas as letras. Trocar `null` por `false` ou por zero
   transforma ausência de medição em acusação contra o cliente.
4. **`incerto` não é menção nem ausência.** Sai do numerador, e o número de
   incertos aparece no laudo. Esconder isso derruba a credibilidade do laudo inteiro.
5. **Execução inválida sai do denominador.** Falha de motor nunca vira "não citado".
6. **Evidência recuperável.** Todo número exibido tem que ser rastreável até a
   pergunta e a execução que o produziram.

## Regras de escrita

Português do Brasil, frases curtas, verbos no presente. Tratar o dono do negócio
como adulto: dizer o que o resultado custa em clientes, não vender o serviço.

**Zero elogio vazio.** Proibidas: revolucionário, único no mercado, transformador,
disruptivo. Detalhe em `docs/04-regras-de-copy.md`.

## Onde está o quê

| Caminho | O que é |
|---|---|
| `docs/` | Documentação que governa o desenvolvimento. Leia antes de mexer em regra de negócio |
| `config/pesos.json` | Pesos dos pilares do índice. Fonte única de verdade |
| `config/gatilhos.json` | Biblioteca de recomendações do laudo (ainda não ligada ao código) |
| `src/api/tipos.ts` | Contrato de dados compartilhado com o backend futuro |
| `src/api/fixtures/` | Os cinco cenários de demonstração |
| `src/telas/` | Uma tela por etapa do fluxo |
| `src/componentes/` | Blocos reutilizáveis do resultado |

## A etapa gratuita

O cenário `fila` — site auditado, nicho sem corpus — **não é degradação**. É a
configuração que atende qualquer negócio sem investimento prévio: 75 dos 100 pontos
do índice e 12 dos 14 gatilhos saem só do site.

A fixture `fila` entrega índice 67 sobre 75 e duas recomendações, e `Fila.tsx` monta
`Indice`, `Metrica`, `BlocoBloqueio`, `AuditoriaSite` e `Recomendacao`.

Não trate esse cenário como consolação ao escrever copy para ele. E não invente uma
terceira recomendação para a lista ficar redonda — só dois gatilhos disparam contra
os dados dessa fixture, e preencher o resto seria inventar dado.

## Dívidas conhecidas

As divergências entre fixtures e tech-spec foram todas fechadas (seção
"Divergências" de `docs/02-contrato-de-dados.md`). Sobra uma coisa, e é de produto:

**Nenhuma fixture demonstra o teto de 30.** O teto está implementado e as invariantes
passam, mas o site do `critico` é ruim em todos os pilares e seu bruto dá 20,64 —
passa por baixo do teto em vez de ser cortado por ele. Demonstrar exigiria um site
bem construído e bloqueado. Três saídas em I-2 de `docs/05-cenarios-e-fixtures.md`.

Antes de mexer em qualquer fixture, leia as 18 invariantes de
`docs/05-cenarios-e-fixtures.md` e refaça a conta do índice com `config/pesos.json`.
Com `nota` de 0 a 100 e peso inteiro, a fórmula é `Σ(peso × nota) / Σ(peso)` — sem o
`100 ×` da tech-spec, que assume nota de 0 a 1.
