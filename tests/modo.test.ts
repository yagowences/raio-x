import { test } from "node:test";
import assert from "node:assert/strict";
import { deveUsarMock } from "../src/api/client";

test("sem pedido explícito, a consulta vai para a API real — inclusive em localhost", () => {
  // Caso real: consulta do Complexo Invictus rodada em localhost:3001 caiu no mock
  // e saiu um laudo com o nome do cliente sobre dados da fixture de clínica de estética.
  assert.equal(deveUsarMock(""), false);
  assert.equal(deveUsarMock("?utm_source=instagram"), false);
});

test("mock só com ?mock ou ?cenario= na URL", () => {
  assert.equal(deveUsarMock("?mock"), true);
  assert.equal(deveUsarMock("?cenario=critico"), true);
  assert.equal(deveUsarMock("?dev&cenario=fila"), true);
});
