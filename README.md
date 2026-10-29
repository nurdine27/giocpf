# GIO Centro de Formação

O website e a API estão separados em duas pastas independentes para poderem ser publicados em repositórios e alojamentos diferentes:

- [`frontend/`](frontend/) — Next.js 16, TypeScript e Tailwind CSS. Tem o seu próprio `package.json` e `.env.example`.
- [`backend/`](backend/) — NestJS, Prisma e PostgreSQL. Tem o seu próprio `package.json`, `.env.example`, migration e `docker-compose.yml`.

Não existe workspace npm na raiz. Instala e executa cada projecto a partir da pasta correspondente. O frontend só precisa do URL público da API; as credenciais da base de dados e do Cloudinary ficam apenas no backend.

Para os passos completos, variáveis, migrations e deploy, consulta [frontend/README.md](frontend/README.md) e [backend/README.md](backend/README.md).

O HTML original `index (GIO).html` e a fonte fornecida `material-symbols-outlined.woff2` permanecem nesta pasta como referência. Os recursos usados em produção já estão copiados para `frontend/public/`.

## Validação

- `npm test` em `backend/`: 7 testes de regras passaram.
- O código em `frontend/` e `backend/` foi formatado com Prettier, dois espaços e sem tabs.
- `backend/`: `npm run typecheck`, `npm run lint` e a verificação de formato passaram.
- `frontend/`: Prettier, typecheck, lint e build de produção passaram.
- PostgreSQL 16 iniciou em Docker e respondeu a uma consulta. A migration SQL foi testada numa transacção e revertida.
- A análise sintáctica TypeScript/TSX passou.
- A instalação npm não terminou por problema de acesso/DNS ao registry. Por isso ainda faltam build/typecheck, migration Prisma real e testes visuais no browser. As larguras de 320 px a 1440 px e superiores continuam por validar; não são declaradas como testadas.
