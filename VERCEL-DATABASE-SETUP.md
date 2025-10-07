# 🚀 Configurazione Database Vercel

## Problema
Il sito funziona in locale con SQLite ma non su Vercel perché mancano le variabili d'ambiente per PostgreSQL.

## ✅ Soluzione

### Passo 1: Configurare Variabili d'Ambiente su Vercel

1. Vai su **[Vercel Dashboard](https://vercel.com/dashboard)**
2. Seleziona il tuo progetto
3. Vai su **Settings** → **Environment Variables**
4. Aggiungi le seguenti variabili:

#### Variabili Richieste:

**DATABASE_URL** (con Neon PostgreSQL):
```
postgresql://user:password@ep-xxx-pooler.region.aws.neon.tech/dbname?sslmode=require&pgbouncer=true&connect_timeout=15
```

**NEXTAUTH_URL** (il tuo dominio Vercel):
```
https://tuo-progetto.vercel.app
```

**NEXTAUTH_SECRET** (chiave generata):
```
bMyXXfbOhkkW0/IYL3GgkunZZOpYEBwWqvr8S55EMtQ=
```
*(O genera una nuova con: `openssl rand -base64 32`)*

### Passo 2: Ottenere il DATABASE_URL da Neon

Se usi **Neon PostgreSQL** (consigliato):

1. Vai su [Neon Console](https://console.neon.tech/)
2. Seleziona il tuo progetto
3. Nella sezione **Connection Details**, copia:
   - **Pooled connection** (con pgbouncer) - QUESTO è quello da usare su Vercel!
   
Il formato sarà simile a:
```
postgresql://username:password@ep-xxx-pooler.region.aws.neon.tech/dbname?sslmode=require
```

**⚠️ IMPORTANTE:** Usa la connessione **pooled** (con `-pooler` nell'URL) per Vercel, non quella diretta!

### Passo 3: Parametri Aggiuntivi Raccomandati

Per ottimizzare la connessione su Vercel, aggiungi questi parametri all'URL:

```
?sslmode=require&pgbouncer=true&connect_timeout=15&connection_limit=1
```

URL completo di esempio:
```
postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/db?sslmode=require&pgbouncer=true&connect_timeout=15
```

### Passo 4: Applicare le Variabili

Dopo aver aggiunto le variabili su Vercel:

1. Seleziona **Apply to all environments** (Production, Preview, Development)
2. Clicca **Save**
3. Vai su **Deployments**
4. Clicca sui tre puntini del deployment più recente
5. Seleziona **Redeploy**

### Passo 5: Verificare la Connessione

Dopo il redeploy:

1. Vai sul tuo sito Vercel
2. Controlla i log: **Deployments** → seleziona il deployment → **View Function Logs**
3. Cerca il messaggio: `[PRISMA] Database connected successfully`
4. Se vedi errori, controlla che:
   - Il DATABASE_URL sia corretto
   - Usi la connessione pooled (con `-pooler`)
   - I parametri SSL siano presenti

## 🔍 Troubleshooting

### Errore: "Can't reach database server"
- ✅ Verifica che usi la connessione **pooled** (con `-pooler`)
- ✅ Controlla che `sslmode=require` sia presente
- ✅ Verifica username/password corretti

### Errore: "Too many connections"
- ✅ Usa `connection_limit=1` nell'URL
- ✅ Verifica di usare la connessione pooled

### Errore: "SSL connection required"
- ✅ Aggiungi `?sslmode=require` all'URL

## 📝 Note Importanti

- ⚠️ **NON committare** file `.env` con credenziali reali
- ✅ Il file `env.example` contiene solo esempi
- ✅ Le variabili d'ambiente su Vercel sono sicure e criptate
- ✅ Il contenuto del database NON verrà modificato (solo configurazione connessione)

## 🗄️ Database già configurato

Il tuo database PostgreSQL su Neon contiene già i dati (vedi backup in `backups/neon_backup_20251006_145324.sql`).

Questa configurazione serve SOLO per permettere a Vercel di connettersi al database esistente.

