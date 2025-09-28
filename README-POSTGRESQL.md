# 🐘 PizzaDOC - Setup PostgreSQL

## 🚀 **SETUP DEVELOPMENT LOCALE**

### **Opzione A: Docker (Consigliato)**

1. **Installa Docker** se non ce l'hai
2. **Avvia PostgreSQL**:
   ```bash
   docker-compose up -d postgres
   ```
3. **Copia environment**:
   ```bash
   cp env.example .env
   ```
4. **Verifica** che `.env` contenga:
   ```env
   DATABASE_URL="postgresql://postgres:password@localhost:5432/pizzadoc_dev"
   NEXTAUTH_SECRET="il-tuo-segreto-32-caratteri"
   NEXTAUTH_URL="http://localhost:3000"
   ```

### **Opzione B: PostgreSQL Locale**

1. **Installa PostgreSQL** sul tuo sistema
2. **Crea database**:
   ```sql
   CREATE DATABASE pizzadoc_dev;
   CREATE USER pizzadoc WITH PASSWORD 'password';
   GRANT ALL PRIVILEGES ON DATABASE pizzadoc_dev TO pizzadoc;
   ```
3. **Configura** `.env`:
   ```env
   DATABASE_URL="postgresql://pizzadoc:password@localhost:5432/pizzadoc_dev"
   ```

### **Opzione C: Servizio Cloud (Gratuito)**

#### **🟢 Supabase**
1. Vai su [supabase.com](https://supabase.com)
2. Crea nuovo progetto
3. Vai su Settings > Database
4. Copia "Connection string" e sostituisci `[YOUR-PASSWORD]`
5. Aggiungi in `.env`:
   ```env
   DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@[HOST]:5432/postgres"
   ```

#### **🟣 Neon**
1. Vai su [neon.tech](https://neon.tech)
2. Crea database
3. Copia connection string
4. Aggiungi in `.env`

## 🔧 **SETUP PROGETTO**

1. **Installa dipendenze**:
   ```bash
   npm install
   ```

2. **Genera Prisma Client**:
   ```bash
   npx prisma generate
   ```

3. **Esegui migration**:
   ```bash
   npx prisma migrate dev --name init
   ```

4. **Seed database**:
   ```bash
   npm run seed
   ```

5. **Avvia sviluppo**:
   ```bash
   npm run dev
   ```

6. **Accedi**:
   - URL: http://localhost:3000
   - Username: `admin`
   - Password: `admin123`

## 🛠️ **COMANDI UTILI**

### **Database**
```bash
# Visualizza database (Adminer)
docker-compose up -d adminer
# Vai su http://localhost:8080

# Reset database
npm run migrate:reset

# Applica modifiche schema
npm run db:push

# Nuova migration
npm run migrate

# Deploy migration (produzione)
npm run migrate:deploy
```

### **Development**
```bash
# Sviluppo con hot reload
npm run dev

# Build per produzione
npm run build

# Avvia produzione
npm start

# Lint
npm run lint
```

### **Seed & Test**
```bash
# Seed completo
npm run seed

# Seed solo utenti
npm run seed:users

# Seed disponibilità settimana
npm run seed:availability

# Test ore lavorate
npm run seed:hours-test
```

## 🐳 **Docker Compose Services**

```bash
# Avvia solo PostgreSQL
docker-compose up -d postgres

# Avvia PostgreSQL + Adminer
docker-compose up -d

# Stop tutti i servizi
docker-compose down

# Reset volumi (cancella dati)
docker-compose down -v
```

## 🔍 **Troubleshooting**

### **❌ Connection refused**
```bash
# Verifica che PostgreSQL sia attivo
docker-compose ps
# o
pg_isready -h localhost -p 5432
```

### **❌ Migration failed**
```bash
# Reset e riprova
npm run migrate:reset
npm run seed
```

### **❌ Prisma Client outdated**
```bash
npx prisma generate
```

### **❌ Port 5432 già in uso**
```bash
# Cambia porta nel docker-compose.yml
ports:
  - "5433:5432"
  
# E aggiorna DATABASE_URL
DATABASE_URL="postgresql://postgres:password@localhost:5433/pizzadoc_dev"
```

## 📊 **Database Schema**

```mermaid
graph TD
    User --> UserRole
    User --> UserTransport
    User --> Availability
    User --> Shift
    User --> WorkedHours
    User --> Substitution
    
    Schedule --> Shift
    Shift --> WorkedHours
    Shift --> Substitution
    
    ShiftLimit --> Schedule
```

### **Tabelle Principali**
- **users**: Utenti del sistema
- **schedules**: Piani settimanali
- **shifts**: Turni assegnati
- **availabilities**: Disponibilità dipendenti
- **worked_hours**: Ore lavorate
- **substitutions**: Richieste sostituzione
- **shift_limits**: Limiti personale per turno

## 🚀 **Deploy su Vercel**

Segui la guida completa in **`VERCEL-SETUP.md`**

TL;DR:
1. Deploy su Vercel
2. Aggiungi Vercel Postgres
3. Configura `DATABASE_URL=${POSTGRES_PRISMA_URL}`
4. Redeploy
5. Vai su `/api/seed`
