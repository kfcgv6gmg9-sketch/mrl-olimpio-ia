# MRL Gestão

Sistema online simples para uso pessoal do Murilo.

## Stack

- Next.js
- React
- Supabase
- PostgreSQL via Supabase
- Vercel futuramente

## Escopo da V1

- Agenda de Servicos interna, como caderneta digital de servicos
- Diario Operacional
- Relatorios por data, tecnico e periodo

Fora do escopo da V1: integracao com Google Agenda, financeiro, estoque, garantia, despesas de veiculos, assistente de voz e Node-RED.

## Agenda de Servicos

A Agenda de Servicos sera propria do sistema e nao tera integracao externa nesta versao.

Campos:

- Data
- Cliente
- Observacao

Funcionalidades previstas:

- Cadastrar servicos por data
- Visualizar servicos cadastrados
- Editar registros
- Excluir registros

## Rodar localmente no Windows

1. Instale o Node.js LTS.
2. Crie o projeto no Supabase.
3. Execute o script SQL em `supabase/schema.sql`.
4. Copie `.env.example` para `.env.local`.
5. Preencha as variaveis do Supabase em `.env.local`.
6. Instale as dependencias:

```powershell
npm install
```

7. Rode o projeto:

```powershell
npm run dev
```

8. Acesse:

```text
http://localhost:3000
```
