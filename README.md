# Smart Mail (Outlook / Microsoft 365)

Filtro inteligente para e-mails importantes: prioriza, resume e indica acoes a partir da sua conta corporativa no Outlook (Microsoft 365).

## Estrutura
- `server/`: backend Express. Recebe access token do Microsoft Graph, busca e-mails, aplica regras e chama IA (OpenAI) para classificar e resumir.
- `web/`: frontend React + Vite. Interface para filtrar por prioridade, periodo e visualizar resumos. Login Microsoft via MSAL (popup) para obter o token automaticamente.
- `supabase/schema.sql`: script de banco (Postgres/Supabase) para perfis, preferencias, cache de e-mails e estado de sync.
- `docker-compose.yml`: orquestra web + server (pensado para Coolify ou docker local).

## Autenticacao Microsoft (frontend)
Configure variaveis em `web/.env` ou via envs de build:
```
VITE_AAD_CLIENT_ID=<client_id_do_app_registrado>
VITE_AAD_TENANT_ID=<tenant_id_ou_common>
VITE_AAD_REDIRECT_URI=http://localhost:5173
VITE_API_BASE=http://localhost:4000   # em prod, use a URL publica do backend (https://api.sua-url.com)
VITE_SUPABASE_URL=https://<seu-projeto>.supabase.co
VITE_SUPABASE_ANON_KEY=<sua-anon-key>
```
Scopes usados: `Mail.Read` (e `offline_access` no cadastro do app). O login usa popup via MSAL; apos autenticar, o token e enviado ao backend em `Authorization: Bearer <token>`.

## Supabase / Postgres
Use `supabase/schema.sql` para criar as tabelas:
- `profiles`: vinculo usuario <-> Microsoft (oid, email).
- `preferences`: preferencias por usuario (lookback, VIPs, palavras-chave).
- `email_messages`: cache de e-mails priorizados (priority, resumo, acao sugerida, flags de visto/resolvido).
- `sync_state`: armazena delta token do Graph para sync incremental.

Importe o arquivo via Supabase SQL editor ou `psql`: `psql < schema.sql`.

## Pre-requisitos
- Node >= 18 recomendado (ambiente atual esta em Node 16; Express 4 funciona, mas Vite 7 recomenda 18+).
- Conta Microsoft 365 com permissao `Mail.Read`.
- App registrado no Azure AD (SPA ou Web) para OAuth2 PKCE.
- Chave de IA: `OPENAI_API_KEY` (OpenAI ou Azure OpenAI).
- Docker (para Compose/Coolify).

## Backend (`server`)
1) Copie `.env.example` para `.env` e preencha:
   ```
   PORT=4000
   OPENAI_API_KEY=...    # chave OpenAI/Azure OpenAI
   OPENAI_MODEL=gpt-4o-mini
   SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```
2) Instale dependencias e rode:
   ```bash
   cd server
   npm install
   npm start
   ```
3) Endpoints principais:
   - `GET /health` - status.
   - `GET /config` e `POST /config` - ajustar `vipSenders`, `urgentKeywords`, `lookbackDays`.
   - `GET /api/emails?days=2&unread=true&priority=high` - requer header `Authorization: Bearer <access_token>`. Retorna itens com prioridade, resumo, acao sugerida e deadline implicito.

> Observacao: o backend assume que o frontend (MSAL) ja obteve o access token; nao ha fluxo OAuth no servidor.

## Frontend (`web`)
1) Instale e rode:
   ```bash
   cd web
   npm install
   npm run dev
   ```
2) Defina variaveis `VITE_AAD_CLIENT_ID`, `VITE_AAD_TENANT_ID`, `VITE_AAD_REDIRECT_URI`, `VITE_API_BASE`.
3) Clique em **Login com Microsoft** para obter o token e traga os e-mails reais. Sem login, a UI exibe cards de exemplo.

## Fluxo esperado
- Frontend usa MSAL (popup) para obter access token (Mail.Read + offline_access).
- Envia `Authorization: Bearer <token>` para `GET /api/emails`.
- Backend usa Graph para buscar inbox, aplica regras (`vipSenders`, `urgentKeywords`) e chama IA para classificar (alta/media/baixa), resumir (2-3 frases) e indicar acao/deadline.
 - Config per-user: `/config` agora requer token e salva/obtém preferencias no Supabase (tabelas `profiles`, `preferences`). Necessita `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.

## Deploy com Docker Compose / Coolify
- Arquivo: `docker-compose.yml` (Node 20 + nginx para a UI).
- Copie `.env.example` para `.env` na raiz e preencha:
  - `SERVER_PORT`, `OPENAI_API_KEY`, `OPENAI_MODEL`
  - `VITE_AAD_CLIENT_ID`, `VITE_AAD_TENANT_ID`, `VITE_AAD_REDIRECT_URI`, `VITE_API_BASE`
  - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  - `WEB_PORT`
- Subir local: `docker compose up --build`
  - UI: `http://localhost:${WEB_PORT:-3000}`
  - API: `http://localhost:${SERVER_PORT:-4000}`
- No Coolify:
  1) Aponte para o repo e escolha docker compose.
  2) Defina as envs acima no painel do Coolify (ou importe .env).
  3) Deploy: `server` roda Express; `web` builda o Vite com os `VITE_*` e serve via nginx.

## Proximos passos sugeridos
- Conectar backend ao Supabase (schema pronto em `supabase/schema.sql`) para persistir preferencias e estado (visto/resolvido).
- Usar delta queries do Graph (`/me/mailFolders/inbox/messages/delta`) e gravar `sync_state`.
- Sanitizar corpo HTML e tratar anexos/menções para melhorar ranking.
- Substituir popup por redirect se preferir SSO silencioso em producao.
