# 🚀 Guida PWA - PizzaDOC

## ✅ Configurazione Completa PWA

La tua app è già configurata come PWA! Ecco tutto ciò che è già attivo:

### 1. **Manifest (`/public/manifest.json`)** ✅
- Nome app: "PizzaDOC"
- Icone in tutte le dimensioni (72px - 512px)
- Display: standalone (si apre come app nativa)
- Start URL: `/dashboard`
- Theme color: `#EA580C` (arancione)
- Shortcuts per Dashboard, Disponibilità, Ore

### 2. **Service Worker (`/public/sw.js`)** ✅
- Registrazione automatica in `layout.tsx`
- Cache delle risorse statiche
- Funzionamento offline

### 3. **Meta Tags (`/src/app/layout.tsx`)** ✅
- Apple Web App capable
- Mobile-friendly viewport
- Icone per iOS e Android
- Splash screen per iOS

---

## 📱 Prompt di Installazione PWA

### Implementazione: Componente PWA Install Prompt

Questo componente mostra automaticamente il banner di installazione PWA quando l'utente fa login e non ha ancora installato l'app.

#### **Caratteristiche:**
- ✅ Appare automaticamente dopo il primo login
- ✅ Non appare se l'app è già installata
- ✅ Non appare se l'utente ha già chiuso il banner (localStorage)
- ✅ Design nativo iOS/Android
- ✅ Animazioni fluide
- ✅ Supporto per tutte le piattaforme (iOS Safari, Chrome Android, Desktop)

---

## 🛠️ Installazione

### Step 1: Creare il componente PWA Install

Il componente è stato creato in:
```
src/components/pwa/install-prompt.tsx
```

### Step 2: Integrarlo nella Dashboard

Il componente è già stato integrato nella Dashboard (`/src/app/dashboard/page.tsx`).

Si attiverà automaticamente quando:
1. L'utente fa login
2. L'app non è già installata
3. L'utente non ha già chiuso il banner in passato

### Step 3: Testare l'installazione

#### **Su Desktop (Chrome/Edge):**
1. Apri DevTools → Application → Manifest
2. Verifica che il manifest sia caricato correttamente
3. Clicca su "Add to Homescreen" per testare
4. Il banner dovrebbe apparire automaticamente

#### **Su Android (Chrome):**
1. Apri l'app in Chrome
2. Dopo il login, il banner apparirà automaticamente
3. Clicca "Installa" per aggiungere alla home
4. L'app si aprirà come app nativa

#### **Su iOS (Safari):**
iOS non supporta l'API `beforeinstallprompt`, quindi il banner mostrerà le istruzioni manuali:
1. Tocca il pulsante Condividi (icona con freccia verso l'alto)
2. Scorri e tocca "Aggiungi alla schermata Home"
3. Tocca "Aggiungi"

---

## 📋 Checklist Finale

✅ Manifest configurato correttamente
✅ Service Worker registrato
✅ Meta tags PWA presenti
✅ Icone in tutte le dimensioni
✅ Componente install prompt implementato
✅ Integrato nella dashboard dopo login
✅ Supporto per iOS, Android, Desktop

---

## 🎨 Personalizzazione

### Cambiare il design del banner:
Modifica il file `src/components/pwa/install-prompt.tsx`:

```tsx
// Colori
bg-orange-600 → bg-tuo-colore

// Testo
title="Installa PizzaDOC" → title="Tuo titolo"

// Posizione (default: bottom)
bottom-4 → top-4 (per banner in alto)
```

### Cambiare quando appare:
Nel componente `install-prompt.tsx`, modifica la logica:

```tsx
// Esempio: mostra solo se admin
const isAdmin = session?.user.roles.includes('ADMIN')
if (!isAdmin) return null

// Esempio: mostra dopo 5 secondi
useEffect(() => {
  const timer = setTimeout(() => setShow(true), 5000)
  return () => clearTimeout(timer)
}, [])
```

---

## 🐛 Troubleshooting

### Il banner non appare?

1. **Verifica HTTPS**: Le PWA funzionano solo su HTTPS (o localhost)
   - Su Vercel: ✅ HTTPS automatico
   - Locale: `http://localhost:3000` va bene

2. **Verifica Service Worker**:
   ```javascript
   // Apri DevTools → Console
   navigator.serviceWorker.getRegistrations()
   // Dovrebbe restituire un array con il SW registrato
   ```

3. **Verifica Manifest**:
   - DevTools → Application → Manifest
   - Controlla che tutti i campi siano corretti

4. **Cancella LocalStorage** (per testare):
   ```javascript
   localStorage.removeItem('pwa-prompt-dismissed')
   ```

5. **iOS Safari**: Il banner mostrerà le istruzioni manuali (iOS non supporta install prompt automatico)

---

## 📊 Analytics (Opzionale)

Per tracciare quanti utenti installano l'app:

```tsx
// In install-prompt.tsx, nella funzione handleInstall:

// Log analytics
fetch('/api/analytics/pwa-install', {
  method: 'POST',
  body: JSON.stringify({ userId: session?.user.id })
})
```

---

## 🚀 Deploy

Dopo aver fatto il commit e push:

```bash
git add .
git commit -m "✨ Add PWA install prompt after login"
git push
```

Vercel farà il redeploy automatico.

---

## 📱 Risultato Finale

Dopo l'installazione, l'utente avrà:

✅ Icona PizzaDOC sulla home screen
✅ App che si apre come app nativa (senza browser chrome)
✅ Funzionamento offline (se configurato nel service worker)
✅ Splash screen all'avvio (iOS)
✅ Shortcuts rapidi (Android/Chrome)

---

## 🎯 Best Practices

1. **Non essere invadente**: Il banner appare solo una volta e può essere chiuso
2. **Timing**: Appare solo dopo il login, non subito
3. **Design nativo**: UI adattata al sistema operativo dell'utente
4. **Persistenza**: Se chiuso, non riappare più (localStorage)

---

**Fatto! 🍕**

La tua PWA è pronta. Gli utenti vedranno il prompt di installazione dopo il login!
