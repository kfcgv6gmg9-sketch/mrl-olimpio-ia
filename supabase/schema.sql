create extension if not exists pgcrypto;

-- =========================
-- AGENDA DE SERVIÇOS
-- =========================
create table if not exists public.agenda_servicos (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  horario time,
  cliente text not null,
  endereco text,
  servico text,
  tecnico text,
  observacao text,
  situacao_agendamento text check (
    situacao_agendamento in ('Agendado', 'Realizado', 'Cancelado', 'Remarcado')
    or situacao_agendamento is null
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- DIÁRIO OPERACIONAL
-- =========================
create table if not exists public.diario_operacional (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  tecnico text not null,
  cliente text not null,
  servico_realizado text not null,
  observacao text,
  situacao_atendimento text check (
    situacao_atendimento in ('Realizado', 'Pendente', 'Retorno', 'Cancelado')
    or situacao_atendimento is null
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.diario_movimentacoes (
  id uuid primary key default gen_random_uuid(),
  diario_id uuid not null references public.diario_operacional(id) on delete cascade,
  data date not null,
  tecnico text not null,
  servico_realizado text not null,
  observacao text,
  status_atendimento text not null check (
    status_atendimento in ('Em andamento', 'Finalizado')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- AUDITORIA
-- =========================
create table if not exists public.auditoria (
  id uuid primary key default gen_random_uuid(),
  usuario text not null,
  data date not null,
  hora time not null,
  modulo text not null check (modulo in ('Agenda', 'Diário', 'Veículos', 'Usuários')),
  acao text not null check (acao in ('Criar', 'Editar', 'Excluir', 'Finalizar', 'Cancelar')),
  registro_afetado text not null,
  created_at timestamptz not null default now()
);

-- =========================
-- CADASTRO DE VEÍCULOS
-- =========================
create table if not exists public.veiculos (
  id uuid primary key default gen_random_uuid(),
  placa text not null unique,
  modelo text,
  marca text,
  ano integer,
  motorista_responsavel text,
  observacao text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- DIÁRIO / DESPESAS DE VEÍCULOS
-- =========================
create table if not exists public.despesas_veiculos (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  placa text not null references public.veiculos(placa) on update cascade,
  tipo_despesa text not null check (
    tipo_despesa in (
      'Combustível',
      'Manutenção',
      'Pedágio',
      'Estacionamento',
      'Lavagem',
      'Pneu',
      'Óleo',
      'Multa',
      'Seguro',
      'Documento',
      'Outros'
    )
  ),
  descricao text,
  km_atual numeric,
  valor numeric(12,2) not null default 0,
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- MANUTENÇÕES DE VEÍCULOS
-- =========================
create table if not exists public.manutencoes_veiculos (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  placa text not null references public.veiculos(placa) on update cascade,
  servico text not null,
  fornecedor text,
  km_atual numeric,
  valor numeric(12,2) not null default 0,
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- RELATÓRIO POR DATA E TÉCNICO
-- =========================
create or replace view public.relatorio_operacional as
select
  movimentacoes.data,
  movimentacoes.tecnico,
  diario.cliente,
  movimentacoes.servico_realizado,
  movimentacoes.status_atendimento as situacao_atendimento,
  movimentacoes.observacao
from public.diario_movimentacoes movimentacoes
join public.diario_operacional diario on diario.id = movimentacoes.diario_id
order by movimentacoes.data desc, movimentacoes.tecnico, diario.cliente;

-- =========================
-- RELATÓRIO DE DESPESAS POR VEÍCULO
-- =========================
create or replace view public.relatorio_despesas_veiculos as
select
  data,
  placa,
  tipo_despesa,
  descricao,
  km_atual,
  valor,
  observacao
from public.despesas_veiculos
order by data desc, placa;

-- =========================
-- RESUMO DE GASTOS POR VEÍCULO
-- =========================
create or replace view public.resumo_gastos_veiculos as
select
  placa,
  sum(valor) as total_gasto
from public.despesas_veiculos
group by placa
order by placa;

-- =========================
-- FUNÇÃO DE UPDATED_AT
-- =========================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- =========================
-- TRIGGERS UPDATED_AT
-- =========================
drop trigger if exists set_updated_at_agenda_servicos on public.agenda_servicos;
create trigger set_updated_at_agenda_servicos
before update on public.agenda_servicos
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_diario_operacional on public.diario_operacional;
create trigger set_updated_at_diario_operacional
before update on public.diario_operacional
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_diario_movimentacoes on public.diario_movimentacoes;
create trigger set_updated_at_diario_movimentacoes
before update on public.diario_movimentacoes
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_veiculos on public.veiculos;
create trigger set_updated_at_veiculos
before update on public.veiculos
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_despesas_veiculos on public.despesas_veiculos;
create trigger set_updated_at_despesas_veiculos
before update on public.despesas_veiculos
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_manutencoes_veiculos on public.manutencoes_veiculos;
create trigger set_updated_at_manutencoes_veiculos
before update on public.manutencoes_veiculos
for each row execute function public.set_updated_at();
