# 🔑 FIX ERRORE 401 - Configurazione API Key WAHA

## 🎯 IL PROBLEMA

```
❌ 401 Unauthorized
Failed to load https://waha-production-ce21.up.railway.app/api/sessions/default
```

**Causa:** WAHA richiede un'**API Key** per autenticare le richieste, ma non l'abbiamo configurata! 🔐

---

## ✅ SOLUZIONE RAPIDA (5 MIN)

### **OPZIONE A: Disabilita l'Autenticazione su Railway (PIÙ SEMPLICE)**

#### 1. Vai su Railway Dashboard
```
https://railway.app/dashboard
→ Progetto "WAHA"
→ Variables
```

#### 2. Aggiungi questa variabile:
```env
WHATSAPP_API_KEY_ENABLED = false
```

#### 3. Redeploy
Il servizio si riavvierà automaticamente.

#### 4. Test
Ricarica la pagina PizzaDOC dopo 30 secondi:
```
https://pizzadoc.vercel.app/admin/settings
→ Dovresti vedere: ✅ Connesso
```

---

### **OPZIONE B: Configura l'API Key (PIÙ SICURO)**

Se vuoi mantenere l'autenticazione per sicurezza:

#### 1. Crea un'API Key su Railway

Vai su Railway → Progetto WAHA → **Variables** e aggiungi:

```env
WHATSAPP_API_KEY = tua-chiave-segreta-qui-123456789
```

**💡 Genera una chiave sicura:**
```bash
# Su Mac/Linux
openssl rand -hex 32

# Oppure usa un generatore online
# https://www.uuidgenerator.net/
```

Esempio:
```env
WHATSAPP_API_KEY = 9f86d081884c7d659a2feaa0c55ad015
```

#### 2. Aspetta il Redeploy

Railway riavvierà automaticamente WAHA con la nuova variabile.

#### 3. Configura Vercel

Vai su Vercel → PizzaDOC → **Settings** → **Environment Variables**

**Aggiungi queste 2 nuove variabili** (per tutti e 3 gli ambienti):

```env
WAHA_API_KEY = 9f86d081884c7d659a2feaa0c55ad015
NEXT_PUBLIC_WAHA_API_KEY = 9f86d081884c7d659a2feaa0c55ad015
```

⚠️ **IMPORTANTE:** Usa la **STESSA chiave** che hai messo su Railway!

#### 4. Redeploy Vercel

1. **Deployments** → ultimo deploy → **"..."** → **"Redeploy"**
2. Aspetta che completi (~2-3 min)

#### 5. Test

```
https://pizzadoc.vercel.app/admin/settings
→ Stato: ✅ Connesso | Status: WORKING
```

---

## 🧪 TEST LOCALE (Opzionale)

Se vuoi testare in locale, crea `.env.local` con:

```env
# ... altre variabili ...

WAHA_API_KEY=9f86d081884c7d659a2feaa0c55ad015
NEXT_PUBLIC_WAHA_API_KEY=9f86d081884c7d659a2feaa0c55ad015
```

Poi:
```bash
npx tsx scripts/test-waha.ts
```

---

## 🔒 QUALE OPZIONE SCEGLIERE?

### **OPZIONE A: Disabilita autenticazione**
✅ **Pros:**
- Setup velocissimo (1 variabile)
- Nessuna configurazione extra

❌ **Cons:**
- Meno sicuro (chiunque con l'URL può usare WAHA)
- OK per testing/sviluppo
- Sconsigliato per produzione

**👉 USA QUESTA se:** È solo per uso interno del team

---

### **OPZIONE B: API Key**
✅ **Pros:**
- Più sicuro (solo chi ha la chiave può usare WAHA)
- Best practice per produzione

❌ **Cons:**
- Richiede 2 variabili extra su Vercel
- Setup leggermente più lungo

**👉 USA QUESTA se:** Vuoi massima sicurezza

---

## 📋 CHECKLIST

### Opzione A (Disabilita Auth):
- [ ] ✅ Aggiunta `WHATSAPP_API_KEY_ENABLED=false` su Railway
- [ ] ✅ Aspettato redeploy automatico Railway
- [ ] ✅ Test su PizzaDOC → ✅ Connesso

### Opzione B (API Key):
- [ ] ✅ Generata API key sicura
- [ ] ✅ Aggiunta `WHATSAPP_API_KEY` su Railway
- [ ] ✅ Aspettato redeploy Railway
- [ ] ✅ Aggiunte `WAHA_API_KEY` e `NEXT_PUBLIC_WAHA_API_KEY` su Vercel
- [ ] ✅ Redeploy manuale Vercel
- [ ] ✅ Test su PizzaDOC → ✅ Connesso

---

## ❌ TROUBLESHOOTING

### Ancora 401 dopo aver disabilitato l'auth

**Causa:** Railway non ha ancora riavviato il servizio.

**Soluzione:**
1. Railway Dashboard → Progetto WAHA
2. Vai su **Deployments**
3. Controlla che sia completato (verde "Success")
4. Se non si è riavviato, clicca **"Redeploy"** manualmente

---

### API Key non funziona

**Causa:** La chiave su Railway e Vercel sono diverse.

**Soluzione:**
1. Verifica che la chiave sia **ESATTAMENTE LA STESSA** su Railway e Vercel
2. Controlla che non ci siano spazi prima/dopo
3. Controlla che su Vercel ci siano **ENTRAMBE** le variabili:
   - `WAHA_API_KEY`
   - `NEXT_PUBLIC_WAHA_API_KEY`

---

### "apiKeyConfigured: false" nei log

**Causa:** Vercel non vede le variabili WAHA_API_KEY.

**Soluzione:**
1. Vercel → Settings → Environment Variables
2. Verifica che `WAHA_API_KEY` e `NEXT_PUBLIC_WAHA_API_KEY` esistano
3. Controlla che siano selezionati **tutti e 3 gli ambienti**
4. Fai **Redeploy manuale**

---

## 🎯 COSA HO FATTO?

Ho modificato `whatsapp-service.ts` per:

1. ✅ Aggiunto supporto per `WAHA_API_KEY` / `NEXT_PUBLIC_WAHA_API_KEY`
2. ✅ Creato metodo `getHeaders()` che include l'header `X-Api-Key` se configurato
3. ✅ Aggiornato tutte le chiamate `fetch()` per usare l'autenticazione
4. ✅ Aggiunto log `apiKeyConfigured: true/false` per debug

**Commit message:**
```
🔑 Add WAHA API Key authentication support

- Add WAHA_API_KEY and NEXT_PUBLIC_WAHA_API_KEY env vars
- Create getHeaders() method with X-Api-Key header
- Update all fetch calls to use authentication
- Fix 401 Unauthorized errors from WAHA
```

---

## 🚀 PROSSIMI PASSI

1. **Scegli un'opzione** (A o B)
2. **Segui gli step** (5 minuti)
3. **Testa** su `/admin/settings`
4. **Deploy su Vercel** (se hai scelto Opzione B)
5. **✅ FATTO!** WAHA funziona! 🎉

---

## 💡 RACCOMANDAZIONE

Per il tuo caso (uso interno team), ti consiglio **OPZIONE A** (disabilita auth):
- ✅ Setup velocissimo
- ✅ Nessuna variabile extra
- ✅ Perfetto per uso interno

Se in futuro vuoi più sicurezza, puoi sempre passare all'Opzione B.

---

**Creato:** 2025-11-07
**Fix per:** `401 Unauthorized` error

