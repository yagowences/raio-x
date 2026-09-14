# Formulário: campos vazios, "outro segmento" livre, estado + cidade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O formulário de entrada (`src/telas/Formulario.tsx`) não vem mais com dados de exemplo pré-preenchidos, captura o segmento real quando o usuário escolhe "outro segmento", e troca a lista fixa de 4 cidades de Goiás por estado (UF) + cidade em texto livre — com o estado sobrevivendo ao polling e a reloads no caminho real (backend Supabase), não só no mock.

**Architecture:** Front (React + TypeScript, Vite) fala com um backend real (Netlify Functions + Supabase) por padrão; fixtures (`src/api/mock.ts`) só entram com `?mock`/`?cenario=` na URL. `estado` entra como campo novo, ponta a ponta: tipo compartilhado (`src/api/tipos.ts`) → formulário → mock/fixtures (demonstração) e migration + Zod schema + SQL + mapper (caminho real). A lógica de "outro segmento vira texto livre" e "só segmentos do picklist têm fixture de demonstração" vira função pura testável em `src/dominio/segmento.ts`, seguindo o padrão já usado por `descreverSegmento`/`descreverCidade` nesse arquivo.

**Tech Stack:** React 18 + TypeScript, Vite, `node:test` + `tsx` (testes), Zod (validação no backend), `pg` (Postgres via Supabase), Netlify Functions.

## Global Constraints

- `npm run lint` (`tsc --noEmit`) e `npm test` são o portão — rodar os dois antes de considerar qualquer tarefa pronta.
- Português do Brasil, frases curtas, verbos no presente, zero elogio vazio (proibidas: revolucionário, único no mercado, transformador, disruptivo) em qualquer texto de UI novo.
- Nada em `src/` lê `process.env` ou `import.meta.env` — nenhuma chave de API no navegador.
- `null` só quer dizer "não verificamos"; nunca virar `false`/`0`.
- Todo número exibido tem que ser rastreável até a pergunta/execução que o produziu (não se aplica diretamente aqui — não há novos números — mas nenhuma mudança pode quebrar essa rastreabilidade nos pilares existentes).
- Este repositório **não tem** infraestrutura de teste de componente React (sem jsdom/Testing Library). Mudanças de UI puras são verificadas por `npm run lint` + checagem manual no navegador (`npm run dev`), não por teste automatizado — só lógica pura em `src/dominio/` ganha teste `node:test`, seguindo o padrão existente do repositório.
- `src/dominio/laudo.ts` e `src/telas/Fila.tsx` **não mudam** nesta feature — a copy que eles geram é regra de negócio (docs/03) e continua usando só `cidade`, nunca `estado`.
- `descreverSegmento`/`descreverCidade` (`src/dominio/segmento.ts`) e o teste "Caso real" que os cobre em `tests/laudo.test.ts` **não mudam** — ficam como proteção defensiva, mesmo inalcançáveis pelo novo formulário.

---

### Task 1: Domínio — `resolverSegmento`, `segmentoTemPicklist` e a lista de segmentos

**Files:**
- Modify: `src/dominio/segmento.ts`
- Create: `tests/segmento.test.ts`

**Interfaces:**
- Produces (usado pelas Tasks 2 e 3):
  - `SEGMENTOS_DISPONIVEIS: string[]` — picklist do formulário, item final `"outro segmento"`.
  - `resolverSegmento(selecionado: string, segmentoLivre: string): string` — quando `selecionado` é `"outro segmento"` (case-insensitive), devolve `segmentoLivre.trim()`; senão devolve `selecionado`.
  - `segmentoTemPicklist(segmento: string): boolean` — `true` só para os itens reais do picklist (exclui a válvula `"outro segmento"`), comparação case-insensitive.

- [ ] **Step 1: Ler o arquivo atual para confirmar o que já existe**

`src/dominio/segmento.ts` hoje tem só `descreverSegmento` e `descreverCidade`. Não mexer nessas duas funções — só adicionar as novas abaixo delas.

- [ ] **Step 2: Escrever o teste que falha primeiro**

Criar `tests/segmento.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolverSegmento, segmentoTemPicklist, SEGMENTOS_DISPONIVEIS } from "../src/dominio/segmento";

test("resolverSegmento usa o texto livre quando o select está em 'outro segmento'", () => {
  assert.equal(resolverSegmento("outro segmento", "fisioterapia"), "fisioterapia");
});

test("resolverSegmento ignora espaços nas pontas do texto livre", () => {
  assert.equal(resolverSegmento("outro segmento", "  fisioterapia  "), "fisioterapia");
});

test("resolverSegmento é case-insensitive no gatilho 'outro segmento'", () => {
  assert.equal(resolverSegmento("Outro Segmento", "pet shop de aves"), "pet shop de aves");
});

test("resolverSegmento mantém o valor do select fora do caso 'outro segmento'", () => {
  assert.equal(resolverSegmento("clínica de estética", "qualquer coisa"), "clínica de estética");
});

test("segmentoTemPicklist reconhece um segmento do picklist", () => {
  assert.equal(segmentoTemPicklist("barbearia"), true);
});

test("segmentoTemPicklist é case-insensitive", () => {
  assert.equal(segmentoTemPicklist("Barbearia"), true);
});

test("segmentoTemPicklist rejeita texto livre fora do picklist", () => {
  assert.equal(segmentoTemPicklist("fisioterapia"), false);
});

test("segmentoTemPicklist rejeita a válvula de escape 'outro segmento'", () => {
  assert.equal(segmentoTemPicklist("outro segmento"), false);
});

test("SEGMENTOS_DISPONIVEIS termina com a válvula de escape", () => {
  assert.equal(SEGMENTOS_DISPONIVEIS[SEGMENTOS_DISPONIVEIS.length - 1], "outro segmento");
});
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `npm test`
Expected: FAIL — `tests/segmento.test.ts` não compila/roda porque `resolverSegmento`, `segmentoTemPicklist` e `SEGMENTOS_DISPONIVEIS` não existem em `src/dominio/segmento.ts`.

- [ ] **Step 4: Implementar em `src/dominio/segmento.ts`**

Adicionar ao final do arquivo (depois de `descreverCidade`, sem tocar no que já existe):

```ts

// Picklist do formulário. "outro segmento" é a válvula de escape (a pessoa
// digita o segmento de verdade numa caixa que aparece só nesse caso) — nunca
// um segmento testado de verdade.
export const SEGMENTOS_DISPONIVEIS = [
  "clínica de estética",
  "salão de beleza",
  "barbearia",
  "pet shop",
  "clínica veterinária",
  "ótica",
  "nutricionista",
  "psicólogo",
  "outro segmento",
];

// resolverSegmento — o formulário manda o valor do select em `selecionado`.
// Quando esse valor é a válvula "outro segmento", o segmento de verdade é o
// texto que a pessoa digitou na caixa que aparece nesse caso (`segmentoLivre`).
// Fora desse caso, o valor do select já é o segmento.
export function resolverSegmento(selecionado: string, segmentoLivre: string): string {
  return /^outro segmento$/i.test(selecionado.trim()) ? segmentoLivre.trim() : selecionado;
}

// segmentoTemPicklist — só os itens "de verdade" do picklist (sem contar a
// válvula "outro segmento") têm fixture de demonstração. Usado por
// src/api/mock.ts para decidir se a consulta cai no cenário `fila` (nenhuma
// varredura de nicho disponível) ou num cenário com corpus de demonstração.
export function segmentoTemPicklist(segmento: string): boolean {
  const alvo = segmento.trim().toLowerCase();
  return SEGMENTOS_DISPONIVEIS.some((s) => s !== "outro segmento" && s.toLowerCase() === alvo);
}
```

- [ ] **Step 5: Rodar o teste de novo e confirmar que passa**

Run: `npm test`
Expected: PASS — todos os testes de `tests/segmento.test.ts` (incluindo os já existentes em `tests/laudo.test.ts`, que não foram tocados).

- [ ] **Step 6: Lint**

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add src/dominio/segmento.ts tests/segmento.test.ts
git commit -m "feat: resolverSegmento e segmentoTemPicklist em src/dominio/segmento.ts

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Contrato de dados, fixtures e Formulário — campos vazios, outro segmento livre, estado + cidade

Este é o conjunto que precisa mudar junto: adicionar `estado` como campo
obrigatório no tipo `EntradaFormulario`/`Auditoria.negocio` quebra a
compilação de qualquer fixture ou tela que não o preencha ainda — por isso
tipos, fixtures e o formulário (que é quem produz esse valor) andam numa
tarefa só. `npm run lint` só fica limpo no final desta tarefa, não no meio
dela.

**Files:**
- Modify: `src/api/tipos.ts`
- Modify: `src/api/fixtures/critico.ts`
- Modify: `src/api/fixtures/medio.ts`
- Modify: `src/api/fixtures/bom.ts`
- Modify: `src/api/fixtures/semSite.ts`
- Modify: `src/api/fixtures/fila.ts`
- Modify: `src/telas/Formulario.tsx`

**Interfaces:**
- Consumes: `SEGMENTOS_DISPONIVEIS`, `resolverSegmento` de `src/dominio/segmento.ts` (Task 1).
- Produces: `EntradaFormulario.estado: string` e `Auditoria.negocio.estado: string` — usados pelas Tasks 3, 4, 6 e 7.

- [ ] **Step 1: `src/api/tipos.ts` — adicionar `estado`**

Old:
```ts
export interface EntradaFormulario {
  negocio: string;
  segmento: string;
  cidade: string;
  site?: string;
}
```

New:
```ts
export interface EntradaFormulario {
  negocio: string;
  segmento: string;
  cidade: string;
  estado: string;
  site?: string;
}
```

Old:
```ts
  negocio: { nome: string; segmento: string; cidade: string; site: string | null };
```

New:
```ts
  negocio: { nome: string; segmento: string; cidade: string; estado: string; site: string | null };
```

- [ ] **Step 2: Fixtures — adicionar `estado: "GO"` (as cinco são cenários de Goiás)**

`src/api/fixtures/critico.ts`:

Old:
```ts
  negocio: {
    nome: "Clínica Vitalis",
    segmento: "clínica de estética",
    cidade: "Goiânia",
    site: "https://clinicavitalis.com.br",
  },
```

New:
```ts
  negocio: {
    nome: "Clínica Vitalis",
    segmento: "clínica de estética",
    cidade: "Goiânia",
    estado: "GO",
    site: "https://clinicavitalis.com.br",
  },
```

`src/api/fixtures/medio.ts`:

Old:
```ts
  negocio: {
    nome: "Estética Harmonize",
    segmento: "clínica de estética",
    cidade: "Goiânia",
    site: "https://esteticaharmonize.com.br",
  },
```

New:
```ts
  negocio: {
    nome: "Estética Harmonize",
    segmento: "clínica de estética",
    cidade: "Goiânia",
    estado: "GO",
    site: "https://esteticaharmonize.com.br",
  },
```

`src/api/fixtures/bom.ts`:

Old:
```ts
  negocio: {
    nome: "Clínica Bella Vitta",
    segmento: "clínica de estética",
    cidade: "Goiânia",
    site: "https://bellavitta.com.br",
  },
```

New:
```ts
  negocio: {
    nome: "Clínica Bella Vitta",
    segmento: "clínica de estética",
    cidade: "Goiânia",
    estado: "GO",
    site: "https://bellavitta.com.br",
  },
```

`src/api/fixtures/semSite.ts`:

Old:
```ts
  negocio: {
    nome: "Estética Harmonize",
    segmento: "clínica de estética",
    cidade: "Goiânia",
    site: null,
  },
```

New:
```ts
  negocio: {
    nome: "Estética Harmonize",
    segmento: "clínica de estética",
    cidade: "Goiânia",
    estado: "GO",
    site: null,
  },
```

`src/api/fixtures/fila.ts`:

Old:
```ts
  negocio: {
    nome: "Burger Gourmet Truck",
    segmento: "food truck",
    cidade: "Goiânia",
    site: "https://burgergourmettruck.com.br",
  },
```

New:
```ts
  negocio: {
    nome: "Burger Gourmet Truck",
    segmento: "food truck",
    cidade: "Goiânia",
    estado: "GO",
    site: "https://burgergourmettruck.com.br",
  },
```

- [ ] **Step 3: Rodar lint só para confirmar que os erros esperados aparecem em `Formulario.tsx`**

Run: `npm run lint`
Expected: FAIL — erro em `src/telas/Formulario.tsx` porque o objeto passado a `aoEnviar` não tem `estado` (o tipo `EntradaFormulario` agora exige). Esse é o sinal de que falta o Step 4.

- [ ] **Step 4: `src/telas/Formulario.tsx` — imports**

Old:
```tsx
import React, { useState } from "react";
import { EntradaFormulario } from "../api/tipos";
import { track } from "../analytics";
```

New:
```tsx
import React, { useState } from "react";
import { EntradaFormulario } from "../api/tipos";
import { track } from "../analytics";
import { SEGMENTOS_DISPONIVEIS, resolverSegmento } from "../dominio/segmento";
```

- [ ] **Step 5: Remover a lista local de segmentos e a lista fixa de cidades; adicionar a lista de estados**

Old:
```tsx
const SEGMENTOS_DISPONIVEIS = [
  "clínica de estética",
  "salão de beleza",
  "barbearia",
  "pet shop",
  "clínica veterinária",
  "ótica",
  "nutricionista",
  "psicólogo",
  "outro segmento",
];

const CIDADES_DISPONIVEIS = [
  "Goiânia",
  "Aparecida de Goiânia",
  "Anápolis",
  "Senador Canedo",
  "outra cidade",
];
```

New:
```tsx
const ESTADOS_DISPONIVEIS = [
  { sigla: "AC", nome: "Acre" },
  { sigla: "AL", nome: "Alagoas" },
  { sigla: "AP", nome: "Amapá" },
  { sigla: "AM", nome: "Amazonas" },
  { sigla: "BA", nome: "Bahia" },
  { sigla: "CE", nome: "Ceará" },
  { sigla: "DF", nome: "Distrito Federal" },
  { sigla: "ES", nome: "Espírito Santo" },
  { sigla: "GO", nome: "Goiás" },
  { sigla: "MA", nome: "Maranhão" },
  { sigla: "MT", nome: "Mato Grosso" },
  { sigla: "MS", nome: "Mato Grosso do Sul" },
  { sigla: "MG", nome: "Minas Gerais" },
  { sigla: "PA", nome: "Pará" },
  { sigla: "PB", nome: "Paraíba" },
  { sigla: "PR", nome: "Paraná" },
  { sigla: "PE", nome: "Pernambuco" },
  { sigla: "PI", nome: "Piauí" },
  { sigla: "RJ", nome: "Rio de Janeiro" },
  { sigla: "RN", nome: "Rio Grande do Norte" },
  { sigla: "RS", nome: "Rio Grande do Sul" },
  { sigla: "RO", nome: "Rondônia" },
  { sigla: "RR", nome: "Roraima" },
  { sigla: "SC", nome: "Santa Catarina" },
  { sigla: "SP", nome: "São Paulo" },
  { sigla: "SE", nome: "Sergipe" },
  { sigla: "TO", nome: "Tocantins" },
];
```

(`SEGMENTOS_DISPONIVEIS` agora vem de `src/dominio/segmento.ts`, importado no Step 4 — não fica mais declarado aqui.)

- [ ] **Step 6: Estado do componente — campos vazios, novo estado para `segmentoOutro` e `estado`**

Old:
```tsx
  const [negocio, setNegocio] = useState("Clínica Vitalis");
  const [segmento, setSegmento] = useState("clínica de estética");
  const [cidade, setCidade] = useState("Goiânia");
  const [site, setSite] = useState("https://clinicavitalis.com.br");
  const [buscaSegmento, setBuscaSegmento] = useState("");
```

New:
```tsx
  const [negocio, setNegocio] = useState("");
  const [segmento, setSegmento] = useState("");
  const [segmentoOutro, setSegmentoOutro] = useState("");
  const [estado, setEstado] = useState("");
  const [cidade, setCidade] = useState("");
  const [site, setSite] = useState("");
  const [buscaSegmento, setBuscaSegmento] = useState("");

  const segmentoEhOutro = /^outro segmento$/i.test(segmento);
```

- [ ] **Step 7: `handleSubmit` — valida a caixa de texto livre e envia o segmento resolvido + estado**

Old:
```tsx
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!negocio.trim() || negocio.trim().length < 2 || negocio.trim().length > 120) {
      return;
    }

    track("raiox_iniciado", {
      segmento,
      cidade,
      tem_site: !!site.trim(),
    });

    aoEnviar({
      negocio: negocio.trim(),
      segmento,
      cidade,
      site: site.trim() || undefined,
    });
  };
```

New:
```tsx
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!negocio.trim() || negocio.trim().length < 2 || negocio.trim().length > 120) {
      return;
    }
    if (segmentoEhOutro && !segmentoOutro.trim()) {
      return;
    }

    const segmentoFinal = resolverSegmento(segmento, segmentoOutro);

    track("raiox_iniciado", {
      segmento: segmentoFinal,
      cidade,
      tem_site: !!site.trim(),
    });

    aoEnviar({
      negocio: negocio.trim(),
      segmento: segmentoFinal,
      cidade: cidade.trim(),
      estado,
      site: site.trim() || undefined,
    });
  };
```

- [ ] **Step 8: Select de segmento — placeholder inicial e caixa de texto quando "outro segmento"**

Old:
```tsx
            <select
              id="campo-segmento"
              name="segmento"
              className="select-padrao"
              value={segmento}
              onChange={(e) => setSegmento(e.target.value)}
              disabled={enviando}
              required
            >
              {segmentosFiltrados.map((seg) => (
                <option key={seg} value={seg}>
                  {seg}
                </option>
              ))}
            </select>
          </div>
        </div>
```

New:
```tsx
            <select
              id="campo-segmento"
              name="segmento"
              className="select-padrao"
              value={segmento}
              onChange={(e) => setSegmento(e.target.value)}
              disabled={enviando}
              required
            >
              <option value="" disabled>
                Selecione o segmento
              </option>
              {segmentosFiltrados.map((seg) => (
                <option key={seg} value={seg}>
                  {seg}
                </option>
              ))}
            </select>
            {segmentoEhOutro && (
              <input
                id="campo-segmento-outro"
                type="text"
                className="input-padrao"
                placeholder="Ex.: fisioterapia"
                aria-label="Qual o segmento do seu negócio?"
                value={segmentoOutro}
                onChange={(e) => setSegmentoOutro(e.target.value)}
                minLength={2}
                maxLength={120}
                required
                disabled={enviando}
              />
            )}
          </div>
        </div>
```

- [ ] **Step 9: Campo Cidade — troca o `<select>` fixo por estado (UF) + cidade em texto livre**

Old:
```tsx
        {/* Campo 3: Cidade */}
        <div className="grupo-campo">
          <label htmlFor="campo-cidade" className="rotulo-campo">
            Cidade <span style={{ color: "var(--azul-profundo)" }}>*</span>
          </label>
          <select
            id="campo-cidade"
            name="cidade"
            className="select-padrao"
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            disabled={enviando}
            required
          >
            {CIDADES_DISPONIVEIS.map((cid) => (
              <option key={cid} value={cid}>
                {cid}
              </option>
            ))}
          </select>
        </div>
```

New:
```tsx
        {/* Campo 3: Estado */}
        <div className="grupo-campo">
          <label htmlFor="campo-estado" className="rotulo-campo">
            Estado <span style={{ color: "var(--azul-profundo)" }}>*</span>
          </label>
          <select
            id="campo-estado"
            name="estado"
            className="select-padrao"
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            disabled={enviando}
            required
          >
            <option value="" disabled>
              Selecione o estado
            </option>
            {ESTADOS_DISPONIVEIS.map((uf) => (
              <option key={uf.sigla} value={uf.sigla}>
                {uf.sigla} — {uf.nome}
              </option>
            ))}
          </select>
        </div>

        {/* Campo 3b: Cidade */}
        <div className="grupo-campo">
          <label htmlFor="campo-cidade" className="rotulo-campo">
            Cidade <span style={{ color: "var(--azul-profundo)" }}>*</span>
          </label>
          <input
            id="campo-cidade"
            name="cidade"
            type="text"
            className="input-padrao"
            placeholder="Ex.: Goiânia"
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            required
            disabled={enviando}
          />
        </div>
```

- [ ] **Step 10: Lint**

Run: `npm run lint`
Expected: sem erros. Se ainda houver erro em `Formulario.tsx`, é sinal de algum Step acima incompleto — revisar antes de seguir.

- [ ] **Step 11: `npm test`**

Run: `npm test`
Expected: PASS (nenhum teste de `src/dominio/` foi tocado por esta tarefa).

- [ ] **Step 12: Verificação manual no navegador**

Run: `npm run dev` (porta 3100), abrir `http://localhost:3100/?mock`.

Checklist:
- Nome do negócio, segmento e site aparecem vazios ao carregar.
- O select de segmento mostra "Selecione o segmento" até uma escolha ativa.
- Escolher "outro segmento" revela a caixa de texto "Qual o segmento do seu negócio?"; tentar enviar sem preenchê-la não submete.
- O select de estado mostra "Selecione o estado" até uma escolha ativa, com as 27 UF + DF.
- Cidade é um campo de texto livre.
- Preencher tudo (negócio, segmento "outro segmento" + "fisioterapia", estado "GO", cidade "Goiânia") e enviar leva à tela seguinte sem erro de console.

- [ ] **Step 13: Commit**

```bash
git add src/api/tipos.ts src/api/fixtures/critico.ts src/api/fixtures/medio.ts src/api/fixtures/bom.ts src/api/fixtures/semSite.ts src/api/fixtures/fila.ts src/telas/Formulario.tsx
git commit -m "feat: formulário sem campos pré-preenchidos, outro segmento livre, estado + cidade

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Mock — corrige a rota do cenário `fila` para segmento em texto livre

Antes desta feature, `mock.ts` mandava para o cenário `fila` qualquer
`segmento` que contivesse a palavra "outro" ou "food truck" — porque o
formulário antigo enviava literalmente `"outro segmento"`. Com
`resolverSegmento` (Task 1) em uso no formulário (Task 2), o valor enviado
passa a ser o texto digitado (ex.: "fisioterapia"), que não contém mais a
palavra "outro" — sem este ajuste, um segmento nunca testado cairia num
cenário aleatório com corpus fictício, violando a regra "só afirmar o que
foi testado".

**Files:**
- Modify: `src/api/mock.ts`

**Interfaces:**
- Consumes: `segmentoTemPicklist` de `src/dominio/segmento.ts` (Task 1).

- [ ] **Step 1: Import**

Old:
```ts
import { Auditoria, EntradaFormulario, EntradaLead } from "./tipos";
import { RaioxApi } from "./client";
```

New:
```ts
import { Auditoria, EntradaFormulario, EntradaLead } from "./tipos";
import { RaioxApi } from "./client";
import { segmentoTemPicklist } from "../dominio/segmento";
```

- [ ] **Step 2: Substituir a checagem por substring pela checagem de picklist**

Old:
```ts
    let cenario = detectarCenarioURL();
    if (!cenario) {
      if (!input.site || input.site.trim() === "") {
        cenario = "sem-site";
      } else if (input.segmento.toLowerCase().includes("food truck") || input.segmento.toLowerCase().includes("outro")) {
        cenario = "fila";
      } else {
        cenario = sortearCenario();
      }
    }
```

New:
```ts
    let cenario = detectarCenarioURL();
    if (!cenario) {
      if (!input.site || input.site.trim() === "") {
        cenario = "sem-site";
      } else if (!segmentoTemPicklist(input.segmento)) {
        cenario = "fila";
      } else {
        cenario = sortearCenario();
      }
    }
```

- [ ] **Step 3: Lint e testes**

Run: `npm run lint && npm test`
Expected: PASS.

- [ ] **Step 4: Verificação manual**

Com `npm run dev` rodando, abrir `http://localhost:3100/?mock` (sem `?cenario=`, para deixar o mock decidir):
- Preencher com segmento "outro segmento" + texto livre "fisioterapia", site preenchido → deve cair no cenário `fila` (tela "Falta a Varredura do Nicho").
- Preencher com segmento "barbearia" (do picklist), site preenchido → cai num cenário sorteado (crítico/médio/bom), não em `fila`.

- [ ] **Step 5: Commit**

```bash
git add src/api/mock.ts
git commit -m "fix: mock roteia p/ cenário fila por picklist, não por substring 'outro'

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Exibição — Análise e Resultado mostram "cidade, estado"

**Files:**
- Modify: `src/telas/Analise.tsx`
- Modify: `src/telas/Resultado.tsx`

- [ ] **Step 1: `src/telas/Analise.tsx`**

Old:
```tsx
          Lendo nossa {formatarDataVarredura(corpus.gerado_em)} para {negocio.segmento} em {negocio.cidade}
```

New:
```tsx
          Lendo nossa {formatarDataVarredura(corpus.gerado_em)} para {negocio.segmento} em {negocio.cidade}, {negocio.estado}
```

- [ ] **Step 2: `src/telas/Resultado.tsx`**

Old:
```tsx
          Negócio auditado: <strong>{negocio.nome}</strong> ({negocio.segmento} · {negocio.cidade})
```

New:
```tsx
          Negócio auditado: <strong>{negocio.nome}</strong> ({negocio.segmento} · {negocio.cidade}, {negocio.estado})
```

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 4: Verificação manual**

Com `npm run dev` rodando e `?mock&cenario=critico`: conferir que a tela de Análise mostra "... em Goiânia, GO" e a tela de Resultado mostra "(clínica de estética · Goiânia, GO)".

- [ ] **Step 5: Commit**

```bash
git add src/telas/Analise.tsx src/telas/Resultado.tsx
git commit -m "feat: Análise e Resultado mostram cidade e estado do negócio

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Migration Supabase — coluna `estado`

**Files:**
- Create: `supabase/migrations/0003_estado.sql`

- [ ] **Step 1: Criar a migration, no padrão de `0002_indice_completo.sql`**

```sql
-- 0003_estado.sql
-- Estado (sigla de UF) do negócio auditado, ao lado de `cidade`. Sem
-- `not null`: linhas gravadas antes desta coluna não têm valor.
alter table public.auditorias add column if not exists estado text;
```

- [ ] **Step 2: Confirmar com o usuário antes de aplicar**

Isto altera o schema de um banco Supabase real. Antes de rodar `supabase db
push` (ou aplicar via ferramenta MCP do Supabase), confirmar com o usuário
qual projeto Supabase é o alvo — não presumir. Este passo não é
auto-executável pelo plano; é um checkpoint humano.

- [ ] **Step 3: Aplicar a migration (depois da confirmação do Step 2)**

Run: `supabase db push` (ou o equivalente via MCP do Supabase, apontando pro projeto confirmado).
Expected: a migration `0003_estado.sql` aparece como aplicada; `select estado from public.auditorias limit 1;` não erra mais por coluna inexistente.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0003_estado.sql
git commit -m "feat: migration — coluna estado em public.auditorias

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Backend real (escrita) — `raiox.ts` valida e grava `estado`

**Files:**
- Modify: `netlify/functions/raiox.ts`

**Interfaces:**
- Consumes: coluna `estado` de `public.auditorias` (Task 5) — o `insert` falha em runtime (não em `tsc --noEmit`) se a migration não tiver sido aplicada.

- [ ] **Step 1: `EntradaSchema` — adicionar `estado`**

Old:
```ts
const EntradaSchema = z.object({
  negocio: z.string().trim().min(2).max(120),
  segmento: z.string().trim().min(1).max(120),
  cidade: z.string().trim().min(1).max(120),
  site: z.string().trim().min(3).max(300).optional(),
});
```

New:
```ts
const EntradaSchema = z.object({
  negocio: z.string().trim().min(2).max(120),
  segmento: z.string().trim().min(1).max(120),
  cidade: z.string().trim().min(1).max(120),
  estado: z.string().trim().length(2),
  site: z.string().trim().min(3).max(300).optional(),
});
```

- [ ] **Step 2: Destructuring de `validado.data`**

Old:
```ts
  const { negocio, segmento, cidade, site } = validado.data;
```

New:
```ts
  const { negocio, segmento, cidade, estado, site } = validado.data;
```

- [ ] **Step 3: Insert do caminho "sem site"**

Old:
```ts
    const r = await pool.query(
      `insert into auditorias (negocio, segmento, cidade, site, status, site_resultado, ip_hash)
       values ($1, $2, $3, null, 'na_fila', $4, $5)
       returning id, negocio, segmento, cidade, site, status, site_resultado, indice_completo, laudo`,
      [negocio, segmento, cidade, JSON.stringify({ avaliado: false, motivo: "sem_site" }), ipHash]
    );
```

New:
```ts
    const r = await pool.query(
      `insert into auditorias (negocio, segmento, cidade, estado, site, status, site_resultado, ip_hash)
       values ($1, $2, $3, $4, null, 'na_fila', $5, $6)
       returning id, negocio, segmento, cidade, estado, site, status, site_resultado, indice_completo, laudo`,
      [negocio, segmento, cidade, estado, JSON.stringify({ avaliado: false, motivo: "sem_site" }), ipHash]
    );
```

- [ ] **Step 4: Insert do caminho "com site"**

Old:
```ts
  const r = await pool.query(
    `insert into auditorias (negocio, segmento, cidade, site, status, ip_hash)
     values ($1, $2, $3, $4, 'parcial', $5)
     returning id, negocio, segmento, cidade, site, status, site_resultado, indice_completo, laudo`,
    [negocio, segmento, cidade, siteNormalizado, ipHash]
  );
```

New:
```ts
  const r = await pool.query(
    `insert into auditorias (negocio, segmento, cidade, estado, site, status, ip_hash)
     values ($1, $2, $3, $4, $5, 'parcial', $6)
     returning id, negocio, segmento, cidade, estado, site, status, site_resultado, indice_completo, laudo`,
    [negocio, segmento, cidade, estado, siteNormalizado, ipHash]
  );
```

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: sem erros (o retorno de `pool.query` não é tipado, então `mapearAuditoria` ainda aceita o resultado mesmo antes da Task 7 — mas o valor de `estado` só chega no front depois dela).

- [ ] **Step 6: Commit**

```bash
git add netlify/functions/raiox.ts
git commit -m "feat: raiox.ts valida e grava estado no insert

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Backend real (leitura) — `mapearAuditoria` e `raiox-status` devolvem `estado`

**Files:**
- Modify: `netlify/functions/lib/mapearAuditoria.ts`
- Modify: `netlify/functions/raiox-status.ts`

**Interfaces:**
- Consumes: `Auditoria.negocio.estado: string` (Task 2).

- [ ] **Step 1: `LinhaAuditoria` e o retorno de `mapearAuditoria`**

Old:
```ts
export interface LinhaAuditoria {
  id: string;
  negocio: string;
  segmento: string;
  cidade: string;
  site: string | null;
  status: string;
  site_resultado: SiteResultado | null;
  indice_completo: Indice | null;
  laudo: LaudoResultado | null;
}

export function mapearAuditoria(linha: LinhaAuditoria): Auditoria {
  return {
    auditoria_id: linha.id,
    status: linha.status as Status,
    negocio: { nome: linha.negocio, segmento: linha.segmento, cidade: linha.cidade, site: linha.site },
```

New:
```ts
export interface LinhaAuditoria {
  id: string;
  negocio: string;
  segmento: string;
  cidade: string;
  estado: string | null;
  site: string | null;
  status: string;
  site_resultado: SiteResultado | null;
  indice_completo: Indice | null;
  laudo: LaudoResultado | null;
}

export function mapearAuditoria(linha: LinhaAuditoria): Auditoria {
  return {
    auditoria_id: linha.id,
    status: linha.status as Status,
    negocio: {
      nome: linha.negocio,
      segmento: linha.segmento,
      cidade: linha.cidade,
      // Linhas gravadas antes da migration 0003 não têm estado — "" é o
      // valor de "não informado" aqui (não há sigla de UF vazia de verdade).
      estado: linha.estado ?? "",
      site: linha.site,
    },
```

- [ ] **Step 2: `raiox-status.ts` — incluir `estado` no `select` explícito**

Old:
```ts
  const r = await pool.query(
    `select id, negocio, segmento, cidade, site, status, site_resultado, indice_completo, laudo
     from auditorias where id = $1`,
    [id]
  );
```

New:
```ts
  const r = await pool.query(
    `select id, negocio, segmento, cidade, estado, site, status, site_resultado, indice_completo, laudo
     from auditorias where id = $1`,
    [id]
  );
```

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add netlify/functions/lib/mapearAuditoria.ts netlify/functions/raiox-status.ts
git commit -m "feat: mapearAuditoria e raiox-status devolvem estado

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Verificação manual fim-a-fim

**Files:** nenhum (só verificação — sem código novo).

- [ ] **Step 1: `npm run lint && npm test`**

Run: `npm run lint && npm test`
Expected: PASS nos dois.

- [ ] **Step 2: Caminho de demonstração (mock/fixture)**

Run: `npm run dev`, abrir `http://localhost:3100/?mock`.
- Submeter o formulário com negócio, "outro segmento" + texto livre, estado "GO", cidade "Goiânia", site preenchido.
- Confirmar que a tela seguinte (Análise ou Fila, dependendo do cenário sorteado) mostra "Goiânia, GO" onde antes só mostrava "Goiânia".

- [ ] **Step 3: Caminho real (backend Supabase), só depois da Task 5 confirmada e aplicada**

Run: `npx netlify dev` (porta 8888).
- Submeter o formulário com um site real acessível.
- Acompanhar o polling até a tela de Fila carregar o resultado do Módulo B.
- Confirmar no banco (`select estado from auditorias order by criado_em desc limit 1;`) que o valor gravado bate com o estado escolhido no formulário.
- Recarregar a página no meio do polling (ou aguardar o próximo tick) e confirmar que "estado" continua aparecendo — não é apagado pela resposta do polling.

- [ ] **Step 4: Reportar ao usuário**

Resumir o que foi verificado (prints ou trechos de log) e sinalizar qualquer divergência antes de considerar a feature pronta.
