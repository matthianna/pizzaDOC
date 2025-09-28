# 🍕 PizzaDOC - Gestionale Piano di Lavoro Pizzeria

Sistema completo di gestione piano di lavoro per pizzerie con sistema di ruoli, disponibilità, generazione automatica del piano e gestione ore lavorate.

## 🚀 Caratteristiche Principali

### 👥 **Gestione Utenti**
- **Creazione utenti** con ruoli multipli (Admin, Fattorino, Cucina, Sala)
- **Password iniziale** uguale al nome utente, cambio obbligatorio al primo accesso
- **Attivazione/Disattivazione** utenti
- **Gestione mezzi di trasporto** per fattorini (Auto/Scooter)

### 📅 **Sistema Disponibilità**
- **Disponibilità settimanale** per settimane future
- **Due turni giornalieri**: Pranzo (11:30-14:00) e Cena (18:00-22:00)
- **Checkbox "Assente tutta la settimana"**
- **Modifica bloccata** per settimane passate/correnti

### ⚙️ **Configurazione Limiti Turni**
- **Limiti min/max** personalizzabili per ogni ruolo e turno
- **Configurazione per ogni giorno** della settimana
- **Utilizzati dall'algoritmo** di generazione automatica

### 🤖 **Algoritmo Generazione Piano**
- **Bilanciamento automatico** dei turni
- **Preferenza ruolo principale** per utenti multi-ruolo
- **Copertura limiti minimi** con segnalazione buchi
- **Distribuzione ottimizzata** del carico di lavoro

### ⏰ **Gestione Ore Lavorate**
- **Inserimento ore** con incrementi di 0.5h
- **Sblocco automatico** a turno finito
- **Approvazione/Rifiuto** da parte degli admin
- **Report mensili** per utente

### 🔄 **Sistema Sostituzioni**
- **Candidature** per turni vacanti
- **Deadline configurabili** per sostituzioni
- **Approvazione/Rifiuto** con notifiche
- **Gestione scadenze** automatica

### 📊 **Dashboard e Reporting**
- **Dashboard personalizzate** per admin e utenti
- **Statistiche** generali del sistema
- **Report ore** mensili
- **Visualizzazione buchi** nel piano

## 🛠 Tecnologie Utilizzate

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: SQLite con Prisma ORM
- **Autenticazione**: NextAuth.js
- **UI Components**: Lucide React Icons
- **Date Management**: date-fns
- **Styling**: Tailwind CSS

## 📦 Installazione e Setup

### Prerequisiti
- Node.js 18+ 
- npm o yarn

### 1. Clona il repository
```bash
git clone <repository-url>
cd pizzadoc
```

### 2. Installa le dipendenze
```bash
npm install
```

### 3. Configura l'ambiente
```bash
# Copia il file di esempio delle variabili d'ambiente
cp .env.example .env

# Modifica le variabili in .env:
# DATABASE_URL="file:./dev.db"
# NEXTAUTH_SECRET="your-secret-key-here-change-in-production"
# NEXTAUTH_URL="http://localhost:3000"
```

### 4. Configura il database
```bash
# Genera il client Prisma
npm run db:generate

# Applica lo schema al database
npm run db:push

# Inizializza il database con dati di esempio
npm run seed
```

### 5. Avvia l'applicazione
```bash
npm run dev
```

L'applicazione sarà disponibile su `http://localhost:3000`

## 🔐 Credenziali Iniziali

Dopo aver eseguito il seed del database:

- **Username**: `admin`
- **Password**: `admin`

⚠️ **Importante**: Cambia la password al primo accesso!

## 📁 Struttura del Progetto

```
src/
├── app/                    # App Router di Next.js
│   ├── api/               # API Routes
│   ├── auth/              # Pagine di autenticazione
│   ├── admin/             # Interfacce admin
│   ├── availability/      # Gestione disponibilità
│   ├── hours/             # Gestione ore lavorate
│   ├── substitutions/     # Sistema sostituzioni
│   └── dashboard/         # Dashboard principale
├── components/            # Componenti React riutilizzabili
│   └── layout/           # Componenti di layout
├── lib/                  # Utilities e configurazioni
│   ├── auth.ts           # Configurazione NextAuth
│   ├── prisma.ts         # Client Prisma
│   ├── utils.ts          # Utility functions
│   ├── date-utils.ts     # Gestione date
│   ├── seed.ts           # Script di inizializzazione
│   └── schedule-algorithm.ts # Algoritmo piano lavoro
└── types/                # Type definitions TypeScript
```

## 🎯 Funzionalità per Ruolo

### **Admin**
- ✅ Gestione completa utenti
- ✅ Configurazione limiti turni
- ✅ Generazione piano automatico
- ✅ Approvazione ore lavorate
- ✅ Gestione sostituzioni
- ✅ Dashboard con statistiche complete

### **Dipendenti (Fattorino/Cucina/Sala)**
- ✅ Gestione disponibilità personale
- ✅ Inserimento ore lavorate
- ✅ Richiesta sostituzioni
- ✅ Dashboard personale
- ✅ Visualizzazione turni assegnati

## 🔧 Comandi Utili

```bash
# Sviluppo
npm run dev              # Avvia in modalità sviluppo
npm run build            # Build per produzione
npm run start            # Avvia in produzione

# Database
npm run db:generate      # Genera client Prisma
npm run db:push          # Applica schema al database
npm run seed             # Inizializza database

# Linting
npm run lint             # Controllo codice
```

## 🚀 Deploy in Produzione

### Vercel (Raccomandato)
1. Collega il repository a Vercel
2. Configura le variabili d'ambiente:
   - `DATABASE_URL`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL`
3. Deploy automatico

### Altre piattaforme
1. Build dell'applicazione: `npm run build`
2. Configura database di produzione
3. Esegui migration: `npm run db:push`
4. Inizializza: `npm run seed`
5. Avvia: `npm start`

## 🔒 Sicurezza

- ✅ **Autenticazione** con NextAuth.js
- ✅ **Hash password** con bcryptjs
- ✅ **Controllo ruoli** su ogni API
- ✅ **Validazione input** lato server
- ✅ **Session management** sicura

## 🤝 Contribuire

1. Fork del progetto
2. Crea un branch per la feature (`git checkout -b feature/nuova-funzionalita`)
3. Commit delle modifiche (`git commit -am 'Aggiunge nuova funzionalità'`)
4. Push del branch (`git push origin feature/nuova-funzionalita`)
5. Apri una Pull Request

## 📝 Roadmap

- [ ] **Generazione PDF** del piano settimanale
- [ ] **Notifiche push** per sostituzioni
- [ ] **App mobile** con React Native
- [ ] **Integrazione calendario** (Google Calendar, Outlook)
- [ ] **Report avanzati** con grafici
- [ ] **Multi-location** per catene di pizzerie

## 📞 Supporto

Per domande o supporto:
- Apri un **Issue** su GitHub
- Contatta gli sviluppatori

## 📄 Licenza

Questo progetto è rilasciato sotto licenza MIT. Vedi il file `LICENSE` per i dettagli.

---

**PizzaDOC** - Gestione professionale del piano di lavoro per pizzerie 🍕