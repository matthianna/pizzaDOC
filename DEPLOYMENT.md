# 🚀 GUIDA AL DEPLOYMENT DI PIZZADOC

## ⚠️ IMPORTANTE
PizzaDOC **NON può essere deployata** su Netlify con drag&drop perché usa:
- Database SQLite
- API Routes di Next.js  
- Autenticazione server-side

## 🌟 DEPLOYMENT SU VERCEL (CONSIGLIATO)

### Passaggio 1: Preparazione Repository
1. Vai su [GitHub](https://github.com) e crea un nuovo repository
2. Carica il progetto:
```bash
cd /Users/matthiasiannarella/Desktop/NewPIZZADOC/pizzadoc
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/USERNAME/pizzadoc.git
git push -u origin main
```

### Passaggio 2: Deploy su Vercel
1. Vai su [vercel.com](https://vercel.com)
2. Registrati/Login con GitHub
3. Clicca "New Project"
4. Importa il repository `pizzadoc`
5. Configurazione:
   - **Framework Preset**: Next.js
   - **Root Directory**: ./
   - **Build Command**: `vercel-build`
   - **Install Command**: `npm install`

### Passaggio 3: Variabili d'Ambiente
Aggiungi in Vercel > Settings > Environment Variables:
```
DATABASE_URL=file:./dev.db
NEXTAUTH_SECRET=your-super-secret-key-here-minimum-32-characters
NEXTAUTH_URL=https://your-app.vercel.app
```

### Passaggio 4: Deploy!
- Clicca "Deploy"
- Vercel automaticamente farà build e deploy
- Riceverai un URL tipo: `https://pizzadoc-xyz.vercel.app`

## 🔧 ALTERNATIVE

### Railway
1. Vai su [railway.app](https://railway.app)
2. Connetti GitHub
3. Deploy from repo
4. Aggiungi le stesse variabili d'ambiente

### Render
1. Vai su [render.com](https://render.com)
2. Connetti GitHub  
3. Seleziona "Web Service"
4. Configura build command: `npm run vercel-build`
5. Aggiungi variabili d'ambiente

## 🗄️ DATABASE PRODUCTION

⚠️ **SQLite non è ideale per production!**

### Upgrade a PostgreSQL (Consigliato)
1. Crea database su [Vercel Postgres](https://vercel.com/storage/postgres)
2. Aggiorna `DATABASE_URL` in env variables
3. Modifica `schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"  // Era "sqlite"
  url      = env("DATABASE_URL")
}
```
4. Run migration: `prisma db push`

## 📱 POST-DEPLOY SETUP

Dopo il primo deploy:
1. Vai al tuo URL pubblico
2. Esegui seed degli utenti: `https://your-app.vercel.app/api/seed`
3. Login con admin/admin123
4. Cambia password admin
5. Crea utenti del tuo team

## 🎉 FATTO!
La tua app PizzaDOC sarà online e accessibile da tutto il mondo!
