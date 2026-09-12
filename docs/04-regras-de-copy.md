# 04 — Regras de copy

Vem do §8.4 da tech-spec. Vale para tudo que o visitante lê: telas, rótulos, estados
vazios, mensagens de erro e o laudo.

O laudo é o produto. Se o texto soar como panfleto, o número perde autoridade junto.

## O tom

Português do Brasil. Frases curtas. Verbos no presente.

Tratar o dono do negócio como adulto: explicar o que o resultado **custa em
clientes**, não vender o serviço. Quem chegou até aqui já demonstrou interesse; a
venda acontece quando o diagnóstico é bom, não quando o texto insiste.

## Zero elogio vazio

**Proibidas:** revolucionário, único no mercado, transformador, disruptivo.

Proibido também o elogio de cortesia. "Parabéns pelo seu perfil" destrói a
credibilidade do laudo inteiro, porque revela que o texto teria sido escrito igual
com qualquer dado. Quando algo está bom, diga o que está bom e mostre o número.

Errado — elogio sem conteúdo:
> Parabéns! Seu site está muito bem estruturado e você está no caminho certo.

Certo — o mesmo fato, com dado:
> As seis páginas do sitemap têm h1 único e hierarquia contínua. Isso é o que
> permite extrair um trecho de resposta sem ambiguidade.

## Nunca nomear motor que não foi testado

Esta é a regra que mais se quebra sem má-fé.

A lista sai de `corpus.motores`. No MVP é `["gemini"]` — um motor. Nenhuma string
literal de componente escreve o nome de um motor.

Errado:
> Testamos como as principais IAs do mercado respondem sobre o seu negócio.

Errado, e pior, porque é específico e falso:
> Perguntamos ao ChatGPT, ao Gemini e ao Perplexity.

Certo, porque acompanha o array:
> Rodamos 5 perguntas, 3 vezes cada, em {corpus.motores.length} motor de busca com IA.

O plural e o próprio nome saem do dado. No dia em que o segundo motor entrar, a copy
acompanha sozinha — e é exatamente isso que o princípio P3 pede.

## Nunca transformar ausência de medição em fato

`null` significa "não verificamos". A copy tem que dizer isso, e não fingir
conhecimento.

| Dado | Errado | Certo |
|---|---|---|
| `cliente_presente: null` | "Você não está no Doctoralia" | "Verifique se você tem perfil no Doctoralia" |
| `posicao_media: null` | "Posição média: 0" | "Sem menções, não há posição a medir" |
| `psi_mobile: null` | "Desempenho ruim" | *(omitir o item)* |
| `conteudo: null` | "Conteúdo fraco" | *(omitir o bloco inteiro)* |

Omitir é sempre melhor que preencher. Um laudo com menos itens continua defensável;
um laudo com um item inventado não.

## Falha nossa não vira culpa do cliente

Quando uma execução é inválida ou o site não pôde ser lido, o texto diz o que
aconteceu — do nosso lado.

Errado:
> Seu site não foi encontrado pelos motores de IA.

Certo:
> Não conseguimos acessar {url} dentro do tempo limite. As métricas de visibilidade
> abaixo não dependem disso e seguem válidas.

## Incertos aparecem, sempre

Quando `visibilidade.incertas > 0`, o número aparece em letra pequena, com a razão:

> 1 execução teve casamento incerto: o nome é curto demais para confirmar sem
> ambiguidade. Ela não conta como menção nem como ausência.

Ninguém pede isso. É justamente por isso que constrói confiança.

## Números na tela

- Taxa de menção como fração do real — "2 de 15 execuções", não só "13%". A fração
  mostra o tamanho da amostra
- Posição média com uma casa decimal
- Índice inteiro, sempre com o "/100" ao lado
- Quando o teto agir, o motivo aparece junto do número, não numa nota de rodapé

## Antes de publicar qualquer texto novo

1. Contém elogio que teria sido escrito com qualquer dado? Corte
2. Nomeia motor que não está em `corpus.motores`? Corte
3. Afirma algo que a auditoria não mediu? Corte
4. Alguma frase passa de duas linhas? Divida
5. Culpa o cliente por falha nossa? Reescreva
6. Alguma recomendação está sem número? Ela não entra
