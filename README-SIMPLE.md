# 🍕 PizzaDOC - Sistema di Gestione Pizzeria

Sistema completo per la gestione del personale, turni e ore lavorate per pizzerie.

## 🚀 Caratteristiche

- 👥 **Gestione Utenti**: Admin e dipendenti
- 📅 **Disponibilità**: Inserimento settimanale 
- ⚡ **Piano Automatico**: Generazione automatica turni
- ⏰ **Ore Lavorate**: Tracking e approvazione
- 🔄 **Sostituzioni**: Sistema di richiesta sostituzioni
- 📊 **Report**: Esportazione PDF e riepiloghi

## 💻 Tecnologie

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, NextAuth.js
- **Database**: SQLite con Prisma ORM
- **UI**: Headless UI, Heroicons, Lucide React

## 🏃‍♂️ Avvio Locale

```bash
# Installa dipendenze
npm install

# Setup database
npm run db:generate
npm run db:push

# Seed database con utenti di esempio
npm run seed

# Avvia sviluppo
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000)

**Login Default**: `admin` / `admin123`

## 🌐 Deploy

Vedi [DEPLOYMENT.md](./DEPLOYMENT.md) per istruzioni complete.

**Raccomandato**: Vercel (supporto nativo Next.js + database)

## 📱 Utilizzo

1. **Admin**: Gestisce utenti, genera piani, approva ore
2. **Dipendenti**: Inseriscono disponibilità, vedono piano, registrano ore

---

**Sviluppato per PizzaDOC - Dal 2011**

