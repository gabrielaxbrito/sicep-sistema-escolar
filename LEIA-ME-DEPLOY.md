# Deploy no Netlify (sem Render)

Estrutura: `frontend/` = site estatico | `netlify/functions/api.mjs` = backend Express como funcao serverless.
O site chama `/api/...` e o `netlify.toml` redireciona para a funcao.

Variaveis de ambiente (Netlify > Site configuration > Environment variables):
- SUPABASE_URL
- SUPABASE_KEY
- GROQ_API_KEY
- JWT_SECRET  (copie o conteudo do seu backend/src/.auth-secret para manter os logins atuais)

Local: `npm install` na raiz e `npm run dev` (usa backend/src/.env).
