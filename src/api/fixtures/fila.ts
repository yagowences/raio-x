import { Auditoria } from "../tipos";

export const fixtureFila: Auditoria = {
  auditoria_id: "aud_fila",
  status: "na_fila",
  negocio: {
    nome: "Burger Gourmet Truck",
    segmento: "food truck",
    cidade: "Goiânia",
    site: "https://burgergourmettruck.com.br",
  },
  corpus: {
    disponivel: false,
    previsao_horas: 24,
    motores: ["gemini"],
    execucoes_por_pergunta: 3,
    total_execucoes: 15,
  },
  visibilidade: null,
  site_resultado: {
    avaliado: true,
    url_final: "https://burgergourmettruck.com.br",
    tecnica: {
      robots: [
        { ua: "GPTBot", familia: "OpenAI", gravidade: "alta", permitido: true },
        { ua: "PerplexityBot", familia: "Perplexity", gravidade: "critica", permitido: true },
        { ua: "Googlebot", familia: "Google", gravidade: "baixa", permitido: true },
      ],
      acesso: [
        { ua: "GPTBot", status: 200, bloqueado: false },
        { ua: "PerplexityBot", status: 200, bloqueado: false },
        { ua: "Googlebot", status: 200, bloqueado: false },
      ],
      bloqueio_silencioso: false,
      sitemap: { existe: true, urls: 12, lastmod: "2026-07-20" },
      html_estatico: { chars_bruto: 11500, suspeita_spa: false },
      psi_mobile: 74,
    },
    estrutura: {
      h1: 1,
      h2: 4,
      h3: 2,
      salto_de_nivel: false,
      tabelas: 1,
      listas: 2,
      imagens: 10,
      imagens_com_alt: 8,
      video_com_transcricao: null,
    },
    dados_estruturados: {
      presente: true,
      tipos: ["FoodEstablishment"],
      campos_faltando: {
        FoodEstablishment: ["servesCuisine", "priceRange"],
      },
      risco_avaliacao: false,
    },
    nap: {
      nome: true,
      telefone: "(62) 99876-5432",
      endereco: true,
      cep: "74000-000",
      horario: true,
      pagina_autor: false,
    },
    conteudo: {
      cardapio: { nota: 8, por_que: "Cardápio detalhado em HTML estático" },
      localizacao: { nota: 7, por_que: "Horários e pontos de parada descritos" },
    },
  },
  indice: null,
  laudo: null,
};
