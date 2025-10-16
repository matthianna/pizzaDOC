# 📱 WhatsApp Integration Setup con WAHA

Questa guida spiega come configurare l'integrazione WhatsApp usando WAHA (WhatsApp HTTP API).

## 🎯 Architettura

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Vercel    │ ──HTTP─→│     WAHA     │ ──────→ │  WhatsApp   │
│  (PizzaDoc) │         │  (Railway)   │         │   Business  │
└─────────────┘         └──────────────┘         └─────────────┘
```

**Importante:** Vercel è serverless e NON supporta Docker, quindi WAHA deve essere hostato esternamente.

---

## 📋 Prerequisiti

- Account Railway (gratuito): https://railway.app
- Numero WhatsApp dedicato per i messaggi
- Account Vercel con il progetto PizzaDoc

---

## 🚀 Step 1: Deploy WAHA su Railway

### 1.1 Crea Nuovo Progetto

1. Vai su https://railway.app
2. Clicca "New Project"
3. Seleziona "Deploy from Docker Image"

### 1.2 Configura Container

```yaml
Image: devlikeapro/waha
Port: 3000
```

### 1.3 Aggiungi Variabili d'Ambiente

```env
WAHA_LOG_LEVEL=info
PORT=3000
```

### 1.4 Deploy

1. Railway farà il deploy automatico
2. Annota l'URL pubblico (es: `https://waha-production-xxx.up.railway.app`)

---

## 🔐 Step 2: Configura Vercel

### 2.1 Aggiungi Variabili d'Ambiente

Nel dashboard Vercel del progetto PizzaDoc:

```env
WAHA_URL=https://waha-production-xxx.up.railway.app
WAHA_SESSION=default
WHATSAPP_ENABLED=true
NEXT_PUBLIC_WAHA_URL=https://waha-production-xxx.up.railway.app
NEXT_PUBLIC_WAHA_SESSION=default
NEXT_PUBLIC_WHATSAPP_ENABLED=true
```

### 2.2 Redeploy

```bash
vercel --prod
```

---

## 📱 Step 3: Connetti WhatsApp

### 3.1 Accedi alla Dashboard WAHA

Apri l'URL di Railway nel browser:
```
https://waha-production-xxx.up.railway.app/dashboard
```

### 3.2 Verifica Sessione

La sessione **"default"** dovrebbe già essere attiva. Se non lo è:

1. Clicca "Add Session"
2. Nome: `default`
3. Start Session

### 3.3 Scansiona QR Code

1. Apparirà un QR code
2. Apri WhatsApp sul telefono
3. Vai in **Impostazioni → Dispositivi collegati**
4. Clicca "Collega dispositivo"
5. Scansiona il QR code

✅ Quando lo stato diventa `WORKING`, sei pronto!

---

## 🧪 Step 4: Test Integrazione

### 4.1 Accedi alla Pagina Test

```
https://tuodominio.com/admin/whatsapp-test
```

### 4.2 Verifica Stato

Dovresti vedere:
- ✅ Stato: **Connesso e funzionante**
- ✅ Configurazione: **Abilitato**
- ✅ Sessione: **WORKING**

### 4.3 Invia Messaggio di Test

1. Inserisci il tuo numero WhatsApp (formato: +393331234567)
2. Scrivi un messaggio
3. Clicca "Invia Messaggio"
4. Controlla WhatsApp sul telefono

---

## 🔧 Troubleshooting

### ❌ "WAHA_URL is not configured"

**Soluzione:**
- Verifica che `WAHA_URL` sia impostato in Vercel
- Redeploy con `vercel --prod`

### ❌ "Session not found"

**Soluzione:**
- Vai alla dashboard WAHA
- Verifica che la sessione `default` sia attiva
- Se non esiste, creala e fai Start Session

### ❌ "SCAN_QR_CODE"

**Soluzione:**
- Vai alla dashboard WAHA
- Scansiona il QR code con WhatsApp
- Aspetta che diventi `WORKING`

### ❌ "Failed to send message"

**Soluzione:**
- Verifica che il numero sia nel formato corretto: `+393331234567`
- Controlla che WhatsApp sia connesso (stato WORKING)
- Verifica i log in Railway

---

## 📊 Monitoraggio

### Dashboard WAHA
```
https://waha-production-xxx.up.railway.app/dashboard
```

### Swagger API Documentation
```
https://waha-production-xxx.up.railway.app/
```

### Railway Logs
```
Project → Deployments → View Logs
```

---

## 💰 Costi

### Railway
- **Free Tier:** $5 di crediti al mese
- **Costo stimato WAHA:** ~$5-10/mese
- **Trial:** 500 ore gratuite

### Alternative Hosting
- **Render:** Piano gratuito disponibile
- **VPS (Hetzner, DigitalOcean):** ~$5/mese
- **Docker su server proprio:** Gratis

---

## 🔒 Sicurezza

### Best Practices

1. **Non condividere WAHA_URL pubblicamente**
2. **Usa numeri WhatsApp dedicati** (non personali)
3. **Monitora l'uso** per evitare spam
4. **Backup sessione** periodicamente

### Rate Limiting

WhatsApp ha limiti sui messaggi:
- Max ~1000 messaggi/giorno
- Non inviare spam
- Rispetta le policy WhatsApp

---

## 📚 Documentazione Aggiuntiva

- **WAHA:** https://waha.devlike.pro
- **Railway:** https://docs.railway.app
- **WhatsApp Business Policy:** https://www.whatsapp.com/legal/business-policy

---

## 🎯 Use Cases in PizzaDoc

Una volta configurato, WhatsApp verrà usato per:

✅ **Sostituzioni:**
- Notifiche quando un turno è disponibile
- Alert agli utenti idonei
- Conferma quando approvato

✅ **Promemoria:**
- "Domani hai turno alle 18:00"
- "Hai ore da inviare per questa settimana"

✅ **Approvazioni:**
- "Le tue 8 ore sono state approvate"
- "Ore rifiutate, motivo: ..."

✅ **Piano Settimanale:**
- "Piano pubblicato per 20-26 Gennaio"

---

## 🆘 Support

Se hai problemi:
1. Controlla i log su Railway
2. Verifica lo stato nella pagina `/admin/whatsapp-test`
3. Consulta la documentazione WAHA
4. Controlla che WhatsApp sia ancora connesso

---

**Creato da:** PizzaDoc Team  
**Ultima modifica:** 2025-01-16

