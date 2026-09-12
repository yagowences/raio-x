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
        { ua: "GPTBot", familia: "treinamento", gravidade: "alta", permitido: true },
        { ua: "PerplexityBot", familia: "recuperacao", gravidade: "critica", permitido: true },
        { ua: "Googlebot", familia: "busca", gravidade: "baixa", permitido: true },
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
      resposta_direta: { nota: 7, por_que: "O cardápio responde o que é servido logo na primeira dobra" },
      perguntas_reais: { nota: 5, por_que: "Horário e pontos de parada aparecem, mas não no formato de pergunta" },
      ganho_informacional: { nota: 8, por_que: "Cardápio detalhado em HTML estático, com ingredientes por item" },
      sinais_de_autoria: { nota: 2, por_que: "Nenhum responsável identificado no site" },
      prova_social: { nota: 4, por_que: "Avaliações citadas sem fonte nem data" },
      escaneabilidade: { nota: 7, por_que: "Horários e pontos de parada descritos em lista, 8 de 10 imagens com alt" },
    },
  },
  indice: {
    valor: 67,
    teto_aplicado: null,
    motivo_teto: null,
    versao_pesos: "1.0.0",
    pilares: [
      { id: "autoria_onpage", rotulo: "Sinais de autoria", peso: 10, nota: 18, confianca: "alta" },
      { id: "tecnica", rotulo: "Acessibilidade técnica", peso: 25, nota: 78, confianca: "alta" },
      { id: "local_nap", rotulo: "Presença local e NAP", peso: 20, nota: 85, confianca: "alta" },
      { id: "estrutura", rotulo: "Estrutura de conteúdo", peso: 12, nota: 66, confianca: "baixa" },
      { id: "dados_estruturados", rotulo: "Dados estruturados", peso: 8, nota: 55, confianca: "alta" },
    ],
  },
  laudo: {
    diagnostico:
      "Ainda não temos varredura de IA para food truck em Goiânia, então não há dado de menção nesta página. " +
      "O que auditamos foi o seu site: burgergourmettruck.com.br responde aos três robôs testados, tem sitemap e serve o cardápio em HTML. " +
      "O índice técnico é 67 de 100, calculado sobre os cinco pilares que dependem só do site.",
    recomendacoes: [
      {
        prioridade: 1,
        titulo: "Não há página que diga quem responde pelo conteúdo",
        texto:
          "burgergourmettruck.com.br não tem /sobre, /autor ou equivalente com pessoa identificável. " +
          "Sem rosto e sem nome, o conteúdo é anônimo, e conteúdo anônimo perde para conteúdo assinado.",
        dado: "nenhuma página de autor encontrada",
        pilar: "autoria_onpage",
      },
      {
        prioridade: 2,
        titulo: "Seus dados estruturados existem, mas estão incompletos",
        texto:
          "O schema FoodEstablishment declarado não traz servesCuisine nem priceRange. " +
          "Schema pela metade é tratado como schema ausente pela maioria dos consumidores.",
        dado: "campos faltando: servesCuisine, priceRange",
        pilar: "dados_estruturados",
      },
    ],
    cta: {
      variante: "gratuita_sem_corpus",
      titulo: "Esta é a parte que conseguimos medir sem varredura do seu nicho.",
      subtitulo:
        "Falta o pilar de autoridade externa, que vale 25 dos 100 pontos e depende da varredura de food truck em Goiânia. " +
        "Deixe seu contato acima e rodamos em até 24 horas.",
    },
  },
};
