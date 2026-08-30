export type Status = "parcial" | "concluido" | "erro" | "na_fila";
export type Confianca = "alta" | "media" | "baixa";

export interface EntradaFormulario {
  negocio: string;
  segmento: string;
  cidade: string;
  site?: string;
}

export interface EntradaLead {
  auditoria_id: string;
  nome: string;
  email?: string;
  whatsapp?: string;
  consentimento: boolean;
}

export interface Auditoria {
  auditoria_id: string;
  status: Status;
  negocio: { nome: string; segmento: string; cidade: string; site: string | null };
  corpus: Corpus;
  visibilidade: Visibilidade | null;
  site_resultado: SiteResultado | null;
  indice: Indice | null;
  laudo: LaudoResultado | null;
}

export interface Corpus {
  disponivel: boolean;
  gerado_em?: string;              // ISO — vira "varredura de agosto de 2026"
  motores?: string[];              // ["gemini"] — a copy LÊ daqui, nunca hardcode
  execucoes_por_pergunta?: number; // 3
  total_execucoes?: number;        // 15
  previsao_horas?: number;         // só quando disponivel = false
}

export interface Visibilidade {
  mencoes: number;
  execucoes_validas: number;
  taxa_mencao: number;
  posicao_media: number | null;
  share_of_voice: number;
  taxa_fonte: number;
  incertas: number;
  perguntas: PerguntaResultado[];
  concorrentes: Concorrente[];
  dominios_do_nicho: Dominio[];
}

export interface PerguntaResultado {
  id: string;
  texto: string;
  execucoes: number;
  mencoes: number;
  incertas: number;
  posicoes: number[];
  concorrentes_citados: string[];
  fontes: string[];
}

export interface Concorrente {
  nome: string;
  mencoes: number;
  posicao_media: number;
}

export interface Dominio {
  dominio: string;
  frequencia: number;
  cliente_presente: boolean | null;
}

export interface SiteResultado {
  avaliado: boolean;
  motivo?: "sem_site" | "inacessivel" | "timeout" | "erro";
  url_final?: string;
  tecnica?: {
    robots: { ua: string; familia: string; gravidade: "critica" | "alta" | "baixa"; permitido: boolean }[];
    acesso: { ua: string; status: number; bloqueado: boolean }[];
    bloqueio_silencioso: boolean;
    sitemap: { existe: boolean; urls: number | null; lastmod: string | null };
    html_estatico: { chars_bruto: number; suspeita_spa: boolean };
    psi_mobile: number | null;
  };
  estrutura?: {
    h1: number;
    h2: number;
    h3: number;
    salto_de_nivel: boolean;
    tabelas: number;
    listas: number;
    imagens: number;
    imagens_com_alt: number;
    video_com_transcricao: boolean | null;
  };
  dados_estruturados?: {
    presente: boolean;
    tipos: string[];
    campos_faltando: Record<string, string[]>;
    risco_avaliacao: boolean;
  };
  nap?: {
    nome: boolean;
    telefone: string | null;
    endereco: boolean;
    cep: string | null;
    horario: boolean;
    pagina_autor: boolean;
  };
  conteudo?: Record<string, { nota: number | null; por_que: string }> | null;
}

export interface Indice {
  valor: number;
  teto_aplicado: number | null;
  motivo_teto: string | null;
  pilares: { id: string; rotulo: string; peso: number; nota: number; confianca: Confianca }[];
}

export interface LaudoResultado {
  diagnostico: string;
  recomendacoes: { prioridade: 1 | 2 | 3; titulo: string; texto: string; dado: string; pilar: string }[];
  cta: { variante: string; titulo: string; subtitulo: string };
}
