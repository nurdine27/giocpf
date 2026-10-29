# GIO — Backend

API autónoma NestJS 11 com Prisma e PostgreSQL 16. Todo o estado e os segredos da base de dados pertencem a esta pasta. O backend tem o seu próprio `package.json`, `.env.example`, `.gitignore`, migration e Compose.

## Desenvolvimento local

Requer Node.js 20.9+, npm e Docker Desktop.

```powershell
Copy-Item .env.example .env
npm install
docker compose up -d postgres
npm run prisma:migrate
npm run prisma:seed
npm run admin:create
npm run start:dev
```

A API fica em http://localhost:4000. Define `APP_URL` como a origem frontend autorizada. O serviço PostgreSQL publica a porta 5432 apenas em loopback. Para pará-lo sem remover os dados: `docker compose stop postgres`.

## Variáveis de ambiente

- `DATABASE_URL`: ligação PostgreSQL usada pelo Prisma.
- `POSTGRES_PASSWORD`: palavra-passe local do container; mantém-na sincronizada com `DATABASE_URL`.
- `API_PORT`: porta NestJS.
- `APP_URL`: origem frontend permitida por CORS e validação da sessão.
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` e `CLOUDINARY_API_SECRET`: opcionais, exclusivamente no backend.

O `.env` é local e ignorado pelo Git. Não partilhes a mesma cópia entre frontend e backend.

## Administração e rotas

Cria o primeiro administrador com `npm run admin:create`; a ferramenta pede e-mail e palavra-passe sem credenciais padrão. O cookie de sessão é HttpOnly, SameSite=Lax e Secure em produção. A API verifica autorização no servidor.

- Pública: `GET /courses`, `POST /registrations`.
- Sessão: `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`.
- Protegidas: `GET /admin/dashboard`, operações `/admin/courses`, `/admin/registrations`.

## Testes e deploy

`npm test` executa os testes unitários das regras de localização, área, disponibilidade do curso, abertura de inscrições, referências e estados. `npm run format` aplica o estilo Prettier (dois espaços, sem tabs); `npm run format:check` verifica o formato. Executa `npm run typecheck`, `npm run lint` e `npm run build` antes de publicar.

Publica esta pasta como repositório backend independente. Define `DATABASE_URL`, `APP_URL`, `API_PORT` e, quando usados, segredos Cloudinary no ambiente do serviço. O PostgreSQL deve ser acessível apenas pela rede privada do backend; não exponhas a porta do banco publicamente. Executa `npx prisma migrate deploy` no deploy. O frontend pode ficar na Vercel e usa o endpoint HTTPS desta API em `NEXT_PUBLIC_API_URL`.

O conteúdo-seed dos cursos foi copiado do HTML original para `src/catalog.ts`; o backend não importa ficheiros, pacotes ou variáveis privadas do frontend.
