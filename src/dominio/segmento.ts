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
