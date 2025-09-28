# 🐘 PIZZADOC - SETUP POSTGRESQL SU VERCEL

## 📋 **STEP 1: DEPLOY INIZIALE**

1. Vai su [vercel.com](https://vercel.com)
2. Login con GitHub  
3. Import del repository "pizzaDOC"
4. **IMPORTANTE**: Prima del deploy, imposta queste variabili d'ambiente:
   ```env
   NEXTAUTH_SECRET=il-tuo-segreto-lungo-32-caratteri-min
   NEXTAUTH_URL=https://tuo-dominio.vercel.app
   DATABASE_URL=postgresql://temp:temp@temp:5432/temp
   ```
5. Deploy (fallirà per il database, è normale!)

## 🗄️ **STEP 2: CREA DATABASE VERCEL**

1. Nel dashboard Vercel del tuo progetto:
   - Vai su **"Storage"** tab
   - Clicca **"Create Database"**
   - Scegli **"Postgres"**
   - Nome: `pizzadoc-db`
   - Regione: **EU West (Dublin)** per l'Italia
   - Piano: **Hobby** (gratuito)

2. **Connetti al progetto**:
   - Seleziona il tuo progetto
   - Clicca **"Connect"**

## ⚙️ **STEP 3: VARIABILI D'AMBIENTE AUTO-GENERATE**

Vercel aggiungerà automaticamente queste variabili:
```env
POSTGRES_URL=postgresql://...
POSTGRES_PRISMA_URL=postgresql://...?pgbouncer=true&connect_timeout=15
POSTGRES_URL_NO_SSL=postgresql://...?sslmode=disable
POSTGRES_URL_NON_POOLING=postgresql://...?sslmode=require
POSTGRES_USER=username
POSTGRES_HOST=hostname
POSTGRES_PASSWORD=password
POSTGRES_DATABASE=database
```

## 🔄 **STEP 4: UPDATE VARIABILI**

Nel tuo progetto Vercel, vai su **"Settings" > "Environment Variables"** e:

1. **Sostituisci** `DATABASE_URL` con:
   ```env
   DATABASE_URL=${POSTGRES_PRISMA_URL}
   ```

2. **Verifica** che ci siano:
   ```env
   NEXTAUTH_SECRET=il-tuo-segreto-32-caratteri
   NEXTAUTH_URL=https://tuo-dominio.vercel.app
   ```

3. **Aggiungi** (opzionale, per debugging):
   ```env
   NODE_ENV=production
   ```

## 🚀 **STEP 5: REDEPLOY**

1. Vai su **"Deployments"**
2. Clicca sui **"..."** dell'ultimo deployment
3. Clicca **"Redeploy"**

## 🎯 **STEP 6: SEED DATABASE**

Dopo il deploy, vai su:
```
https://tuo-dominio.vercel.app/api/seed
```

Questo popolerà il database con l'admin iniziale (`admin` / `admin123`).

## ✅ **VERIFICA SETUP**

1. Vai su `https://tuo-dominio.vercel.app`
2. Login con `admin` / `admin123`
3. Cambia password al primo accesso
4. Crea i tuoi utenti della pizzeria!

---

## 🔧 **ALTERNATIVE DATABASE (se Vercel Postgres non disponibile)**

### **OPZIONE B: SUPABASE (GRATUITO)**
1. Vai su [supabase.com](https://supabase.com)
2. Crea nuovo progetto
3. Copia la connection string da Settings > Database
4. Su Vercel, imposta:
   ```
   DATABASE_URL=postgresql://postgres:[password]@[host]:5432/postgres
   ```

### **OPZIONE C: NEON (GRATUITO)**
1. Vai su [neon.tech](https://neon.tech)
2. Crea database
3. Copia connection string
4. Su Vercel, imposta come `DATABASE_URL`

---

## 🆘 **TROUBLESHOOTING**

**❌ Error: "relation does not exist"**
- Il database non è stato migrato
- Vai su `/api/seed` per inizializzare

**❌ Error: "Environment variable not found"**
- Verifica le variabili d'ambiente su Vercel
- Fai redeploy dopo aver impostato le variabili

**❌ Error: "Connection refused"**
- Database non raggiungibile
- Verifica la connection string
