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
