# ⚡ Quick Setup Vercel - 5 Minuti

## 🎯 Checklist Rapida

### 1️⃣ Ottieni il DATABASE_URL da Neon

1. Vai su [console.neon.tech](https://console.neon.tech/)
2. Seleziona il tuo progetto
3. **Connection Details** → Copia la **Pooled connection** (quella con `-pooler`)

Esempio:
```
postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/db?sslmode=require
```

### 2️⃣ Genera NEXTAUTH_SECRET

Nel terminale:
```bash
openssl rand -base64 32
```

Output esempio:
```
bMyXXfbOhkkW0/IYL3GgkunZZOpYEBwWqvr8S55EMtQ=
```

### 3️⃣ Configura su Vercel

1. [vercel.com/dashboard](https://vercel.com/dashboard)
2. Seleziona progetto → **Settings** → **Environment Variables**
3. Aggiungi:

| Nome | Valore |
|------|--------|
| `DATABASE_URL` | La stringa di connessione pooled da Neon |
| `NEXTAUTH_URL` | `https://tuo-progetto.vercel.app` |
| `NEXTAUTH_SECRET` | La chiave generata sopra |

4. **Apply to all environments** ✅
5. **Save**

### 4️⃣ Redeploy

1. **Deployments** tab
2. Clicca sui **...** del deployment più recente
3. **Redeploy**

### 5️⃣ Verifica

1. Vai sul sito live
2. Controlla i **Function Logs**
3. Cerca: `✅ Database connected successfully`

---

## ❌ Problemi Comuni

| Errore | Soluzione |
|--------|-----------|
| Can't reach database | Usa connessione **pooled** (con `-pooler`) |
| SSL required | Aggiungi `?sslmode=require` all'URL |
| Too many connections | Verifica di usare connessione pooled |

---

## 📝 Formato Completo DATABASE_URL

```
postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/db?sslmode=require&pgbouncer=true&connect_timeout=15
```

**Elementi chiave:**
- ✅ `-pooler` nell'hostname
- ✅ `?sslmode=require`
- ✅ `&pgbouncer=true` (opzionale ma raccomandato)

---

Per maggiori dettagli: vedi `VERCEL-DATABASE-SETUP.md`

