// src/dominio/segmento.ts
//
// "outro segmento" e "outra cidade" são opções de escape do formulário, não
// nomes de nicho. Na copy viravam "varredura de IA para outro segmento em
// outra cidade". O valor bruto continua gravado e no analytics; só a frase muda.

export function descreverSegmento(segmento: string): string {
  return /^outro segmento$/i.test(segmento.trim()) ? "seu segmento" : segmento;
}

export function descreverCidade(cidade: string): string {
  return /^outra cidade$/i.test(cidade.trim()) ? "sua cidade" : cidade;
}

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
