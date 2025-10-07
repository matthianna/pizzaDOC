# 📸 Guida Step-by-Step con Screenshot Testuali

## 🎯 Obiettivo
Configurare le variabili d'ambiente su Vercel per connettere il database PostgreSQL.

---

## Passo 1️⃣: Ottieni Credenziali da Neon

### A. Vai su Neon Console
```
🌐 https://console.neon.tech/
```

### B. Seleziona il tuo progetto
```
┌─────────────────────────────────┐
│  My Projects                    │
├─────────────────────────────────┤
│  ► pizzadoc-db  ← Clicca qui    │
│    other-project                │
└─────────────────────────────────┘
```

### C. Trova Connection Details
```
┌─────────────────────────────────────────┐
│  Connection Details                     │
├─────────────────────────────────────────┤
│  Connection string                      │
│  ┌────────────────────────────────┐    │
│  │ Direct connection              │    │
│  │ Pooled connection ← QUESTO!    │    │
│  └────────────────────────────────┘    │
│                                         │
│  postgresql://user:pass@ep-xxx-pooler  │
│  .region.aws.neon.tech/db?sslmode=...  │
│                                         │
│  [Copy] ← Clicca per copiare           │
└─────────────────────────────────────────┘
```

**⚠️ IMPORTANTE:** Seleziona **Pooled connection** (non Direct)

### D. Verifica che l'URL contenga:
✅ `-pooler` nel nome host
✅ `?sslmode=require` alla fine

---

## Passo 2️⃣: Genera NEXTAUTH_SECRET

### Nel terminale del tuo Mac:

```bash
# Apri Terminal e digita:
openssl rand -base64 32
```

### Output esempio:
```
bMyXXfbOhkkW0/IYL3GgkunZZOpYEBwWqvr8S55EMtQ=
```

**📋 Copia questo valore** (sarà diverso per te)

---

## Passo 3️⃣: Configura Vercel

### A. Vai su Vercel Dashboard
```
🌐 https://vercel.com/dashboard
```

### B. Seleziona il tuo progetto
```
┌─────────────────────────────────┐
│  Your Projects                  │
├─────────────────────────────────┤
│  ► pizzadoc  ← Clicca qui       │
│    other-app                    │
└─────────────────────────────────┘
```

### C. Vai in Settings
```
┌──────────────────────────────────┐
│  pizzadoc                        │
├──────────────────────────────────┤
│  Deployments                     │
│  Analytics                       │
│  Settings  ← Clicca qui          │
└──────────────────────────────────┘
```

### D. Clicca su Environment Variables
```
┌──────────────────────────────────┐
│  Settings                        │
├──────────────────────────────────┤
│  General                         │
│  Domains                         │
│  Environment Variables ← Qui     │
│  Git                             │
└──────────────────────────────────┘
```

### E. Aggiungi le variabili (una alla volta)

#### Variabile 1: DATABASE_URL

```
┌────────────────────────────────────────┐
│  Add New Variable                      │
├────────────────────────────────────────┤
│  Key:                                  │
│  ┌────────────────────────────────┐   │
│  │ DATABASE_URL                   │   │
│  └────────────────────────────────┘   │
│                                        │
│  Value:                                │
│  ┌────────────────────────────────┐   │
│  │ postgresql://user:pass@ep-xxx  │   │
│  │ -pooler.region.aws.neon.tech/  │   │
│  │ db?sslmode=require&pgbouncer=  │   │
│  │ true&connect_timeout=15        │   │
│  └────────────────────────────────┘   │
│                                        │
│  Environments:                         │
│  ☑ Production                          │
│  ☑ Preview                             │
│  ☑ Development                         │
│                                        │
│  [Save]                                │
└────────────────────────────────────────┘
```

**Clicca Save**

#### Variabile 2: NEXTAUTH_URL

```
┌────────────────────────────────────────┐
│  Add New Variable                      │
├────────────────────────────────────────┤
│  Key:                                  │
│  ┌────────────────────────────────┐   │
│  │ NEXTAUTH_URL                   │   │
│  └────────────────────────────────┘   │
│                                        │
│  Value:                                │
│  ┌────────────────────────────────┐   │
│  │ https://pizzadoc.vercel.app    │   │
│  └────────────────────────────────┘   │
│                                        │
│  Environments:                         │
│  ☑ Production                          │
│  ☑ Preview                             │
│  ☑ Development                         │
│                                        │
│  [Save]                                │
└────────────────────────────────────────┘
```

**Sostituisci con il TUO dominio Vercel!**
**Clicca Save**

#### Variabile 3: NEXTAUTH_SECRET

```
┌────────────────────────────────────────┐
│  Add New Variable                      │
├────────────────────────────────────────┤
│  Key:                                  │
│  ┌────────────────────────────────┐   │
│  │ NEXTAUTH_SECRET                │   │
│  └────────────────────────────────┘   │
│                                        │
│  Value:                                │
│  ┌────────────────────────────────┐   │
│  │ bMyXXfbOhkkW0/IYL3GgkunZZOpY   │   │
│  │ EBwWqvr8S55EMtQ=               │   │
│  └────────────────────────────────┘   │
│                                        │
│  Environments:                         │
│  ☑ Production                          │
│  ☑ Preview                             │
│  ☑ Development                         │
│                                        │
│  [Save]                                │
└────────────────────────────────────────┘
```

**Usa il valore generato prima!**
**Clicca Save**

### F. Verifica che tutte e 3 siano presenti

```
┌────────────────────────────────────────┐
│  Environment Variables                 │
├────────────────────────────────────────┤
│  DATABASE_URL          ••••••••••      │
│  NEXTAUTH_URL          https://...     │
│  NEXTAUTH_SECRET       ••••••••••      │
└────────────────────────────────────────┘
```

---

## Passo 4️⃣: Redeploy

### A. Vai su Deployments
```
┌──────────────────────────────────┐
│  pizzadoc                        │
├──────────────────────────────────┤
│  Deployments  ← Clicca qui       │
│  Analytics                       │
│  Settings                        │
└──────────────────────────────────┘
```

### B. Trova il deployment più recente
```
┌─────────────────────────────────────┐
│  Production Deployments             │
├─────────────────────────────────────┤
│  main  Ready  2m ago  ⋮ ← Clicca   │
└─────────────────────────────────────┘
```

### C. Clicca sui tre puntini ⋮

```
┌─────────────────────┐
│  View Function Logs │
│  Visit               │
│  Redeploy ← Clicca   │
└─────────────────────┘
```

### D. Conferma Redeploy
```
┌────────────────────────────────────┐
│  Redeploy to Production?           │
├────────────────────────────────────┤
│  This will trigger a new build     │
│  with the latest environment       │
│  variables.                        │
│                                    │
│  [Cancel]  [Redeploy]              │
└────────────────────────────────────┘
```

**Clicca Redeploy**

### E. Attendi il build
```
┌─────────────────────────────────────┐
│  Building...  [████████░░] 80%      │
└─────────────────────────────────────┘
```

Tempo: ~2-3 minuti

---

## Passo 5️⃣: Verifica Funzionamento

### A. Vai su Function Logs
```
┌─────────────────────────────────────┐
│  main  Ready  just now  ⋮           │
└─────────────────────────────────────┘
            ↓
   Clicca sul deployment
```

### B. Seleziona "Functions" tab
```
┌──────────────────────────────────┐
│  Overview  Functions ← Qui       │
└──────────────────────────────────┘
```

### C. Cerca nei log:
```
┌────────────────────────────────────────┐
│  Function Logs                         │
├────────────────────────────────────────┤
│  [PRISMA] DATABASE_URL configured      │
│  (PostgreSQL - Pooled)                 │
│  [PRISMA] ✅ Database connected        │
│  successfully                          │
│  [PRISMA] Running on Vercel env        │
└────────────────────────────────────────┘
```

**✅ Se vedi questo messaggio = FUNZIONA!**

### D. Testa il sito
```
1. Vai su: https://tuo-progetto.vercel.app
2. Prova a fare login
3. Controlla che i dati vengano caricati
```

---

## ❌ Se Vedi Errori

### Errore: "Can't reach database server"

```
❌ [PRISMA] Database connection failed
   → Can't reach database server
   
✅ SOLUZIONE:
   1. Verifica che DATABASE_URL contenga -pooler
   2. Verifica che contenga ?sslmode=require
   3. Copia di nuovo da Neon (Pooled connection)
```

### Errore: "SSL connection required"

```
❌ [PRISMA] Database connection failed
   → SSL connection required
   
✅ SOLUZIONE:
   Aggiungi ?sslmode=require alla fine del DATABASE_URL
```

### Errore: "Too many connections"

```
❌ [PRISMA] Database connection failed
   → Too many connections
   
✅ SOLUZIONE:
   Usa la connessione Pooled (con -pooler) invece di Direct
```

---

## ✅ Checklist Completa

- [ ] Ho copiato la connessione **Pooled** da Neon (con -pooler)
- [ ] Ho generato NEXTAUTH_SECRET con `openssl rand -base64 32`
- [ ] Ho aggiunto DATABASE_URL su Vercel
- [ ] Ho aggiunto NEXTAUTH_URL su Vercel (con https://...)
- [ ] Ho aggiunto NEXTAUTH_SECRET su Vercel
- [ ] Ho selezionato tutti gli environments (Prod, Preview, Dev)
- [ ] Ho fatto Redeploy
- [ ] Il build è completato con successo
- [ ] Nei log vedo "✅ Database connected successfully"
- [ ] Il sito funziona e mostra i dati
- [ ] Riesco a fare login

---

## 🎉 Successo!

Se hai completato tutti i passaggi e la checklist è tutta spuntata, il problema è risolto!

Il tuo sito ora si connette correttamente al database PostgreSQL su Neon da Vercel.

---

**Hai ancora problemi?** 
Controlla i file:
- `VERCEL-DATABASE-SETUP.md` per troubleshooting dettagliato
- `VERCEL-QUICK-SETUP.md` per reference veloce

