export type AgendaServico = {
  id: string;
  data: string;
  cliente: string;
  observacao: string | null;
  situacao_agendamento: "Realizado" | "Cancelado" | null;
  created_at: string;
  updated_at: string;
};

export type DiarioOperacional = {
  id: string;
  data: string;
  tecnico: string;
  cliente: string;
  servico_realizado: string;
  observacao: string | null;
  situacao_atendimento: "Finalizado" | "Retorno" | "Em Andamento" | "Orçamento Não Aprovado" | null;
  created_at: string;
  updated_at: string;
};

export type DespesaVeiculo = {
  id: string;
  data: string;
  placa: string;
  veiculo: string;
  tipo_despesa: "Combustível" | "Pedágio" | "Manutenção" | "Pneus" | "Outros";
  valor: number;
  observacao: string | null;
  created_at: string;
  updated_at: string;
};
