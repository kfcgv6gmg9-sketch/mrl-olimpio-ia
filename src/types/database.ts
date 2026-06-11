export type AgendaServico = {
  id: string;
  data: string;
  cliente: string;
  cidade: string | null;
  observacao: string | null;
  situacao_agendamento: "Serviço Técnico" | "Retorno" | "Garantia" | null;
  status_agendamento: "Agendado" | "Reagendado" | "Cancelado" | null;
  bloqueado: boolean | null;
  created_at: string;
  updated_at: string;
};

export type DiarioOperacional = {
  id: string;
  data: string;
  tecnico: string;
  cliente: string;
  tipo_atendimento: "Cliente" | "Serviço interno" | null;
  cidade: string | null;
  servico_realizado: string;
  observacao: string | null;
  situacao_atendimento: string | null;
  status_atendimento:
    | "Aberto"
    | "Em andamento"
    | "Aguardando Cliente"
    | "Aguardando Peça"
    | "Finalizado"
    | "Cancelado"
    | null;
  agendamento_id: string | null;
  bloqueado: boolean | null;
  created_at: string;
  updated_at: string;
};

export type DiarioMovimentacao = {
  id: string;
  diario_id: string;
  data: string;
  tecnico: string;
  servico_realizado: string;
  observacao: string | null;
  status_atendimento:
    | "Aberto"
    | "Em andamento"
    | "Aguardando Cliente"
    | "Aguardando Peça"
    | "Finalizado"
    | "Cancelado";
  created_at: string;
  updated_at: string;
};

export type Funcionario = {
  id: string;
  nome: string;
  ativo: boolean | null;
  created_at?: string;
  updated_at?: string;
};

export type DiarioAjudante = {
  id?: string;
  diario_id: string;
  funcionario_id: string;
  created_at?: string;
};

export type DiarioMovimentacaoAjudante = {
  id?: string;
  movimentacao_id: string;
  funcionario_id: string;
  created_at?: string;
};

export type DespesaVeiculo = {
  id: string;
  data: string;
  placa: string;
  veiculo: string;
  motorista: string | null;
  tipo_despesa: "Abastecimento" | "Manutenção" | "Lavagem" | "Pedágio" | "Outros";
  valor: number;
  quilometragem: number | null;
  descricao: string | null;
  observacao: string | null;
  created_at: string;
  updated_at: string;
};

export type Auditoria = {
  id: string;
  usuario: string;
  data: string;
  hora: string;
  modulo: "Agenda" | "Diário" | "Veículos" | "Usuários";
  acao: "Criar" | "Editar" | "Excluir" | "Finalizar" | "Cancelar";
  registro_afetado: string;
  created_at: string;
};
