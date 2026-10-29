# GIO — Frontend

Aplicação autónoma Next.js 16 com TypeScript e Tailwind CSS 4. Não depende do pacote ou `.env` do backend; comunica com a API através de `NEXT_PUBLIC_API_URL`.

## Desenvolvimento

Requer Node.js 20.9+ e npm.

```powershell
Copy-Item .env.example .env.local
npm install
npm run dev
```

Abre http://localhost:3000. Configure `NEXT_PUBLIC_API_URL` no `.env.local` com o endereço da API. `APP_URL` define a origem canónica do site.

## Build

```powershell
npm run lint
npm run typecheck
npm run build
npm start
```

Para uniformizar o estilo do código, usa `npm run format`; para verificar sem editar, usa `npm run format:check`. O projecto usa Prettier, dois espaços e sem tabs.

## Deploy independente

Publica esta pasta como raiz do repositório frontend ou configura `frontend/` como Root Directory no alojamento. Na Vercel, define `NEXT_PUBLIC_API_URL` com o URL HTTPS da API e `APP_URL` com o domínio do site. Não coloques credenciais de PostgreSQL, sessão ou Cloudinary neste projecto.

O Next Image aceita `res.cloudinary.com`; as fotografias fornecidas são locais em `public/images`. O site foi concebido mobile-first. As larguras de referência (320, 360, 375, 390, 430, 768, 1024, 1280 e 1440 px) ainda aguardam teste visual no browser após a instalação das dependências.
