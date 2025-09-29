#!/usr/bin/env tsx

/**
 * SETUP COMPLETO DATABASE
 * 
 * Questo script inizializza completamente il database con:
 * - Utenti base del sistema
 * - Impostazioni di sistema
 * - Distribuzioni orari di inizio
 * - Limiti turni per ruoli
 * 
 * Uso: npm run setup:database
 */

import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/utils'
import { Role, TransportType } from '@prisma/client'
import { ro } from 'date-fns/locale'

const prisma = new PrismaClient()

// ================================
// CONFIGURAZIONE UTENTI
// ================================
interface UserData {
  username: string
  roles: Role[]
  primaryRole: Role
  transports?: TransportType[]
  primaryTransport?: TransportType
}

const users: UserData[] = [
  // ADMIN
  {
    username: 'admin',
    roles: [Role.ADMIN],
    primaryRole: Role.ADMIN
  },
  
  // PIZZAIOLI
  {
    username: 'mario.dipietro',
    roles: [Role.PIZZAIOLO, Role.CUCINA],
    primaryRole: Role.PIZZAIOLO
  },
  {
    username: 'valentino.dipietro',
    roles: [Role.PIZZAIOLO],
    primaryRole: Role.PIZZAIOLO
  },
  
  // FATTORINI
  {
    username: 'luis.rodrigues',
    roles: [Role.FATTORINO],
    primaryRole: Role.FATTORINO,
    transports: [TransportType.AUTO, TransportType.SCOOTER],
    primaryTransport: TransportType.AUTO
  },
  {
    username: 'brando.rizzo',
    roles: [Role.FATTORINO],
    primaryRole: Role.FATTORINO,
    transports: [TransportType.SCOOTER],
    primaryTransport: TransportType.SCOOTER
  },
  {
    username: 'matthias.iannarella',
    roles: [Role.FATTORINO],
    primaryRole: Role.FATTORINO,
    transports: [TransportType.AUTO, TransportType.SCOOTER],
    primaryTransport: TransportType.SCOOTER
  },
  {
    username: 'mathias.mencarelli',
    roles: [Role.FATTORINO],
    primaryRole: Role.FATTORINO,
    transports: [TransportType.SCOOTER],
    primaryTransport: TransportType.SCOOTER
  },
  {
    username: 'jacopo.alberti',
    roles: [Role.FATTORINO],
    primaryRole: Role.FATTORINO,
    transports: [TransportType.SCOOTER],
    primaryTransport: TransportType.SCOOTER
  },
  
  {
    username: 'davide.ferreira',
    roles: [Role.FATTORINO],
    primaryRole: Role.FATTORINO
  },
  {
    username: 'michele.caiazzo',
    roles: [Role.SALA, Role.FATTORINO],
    primaryRole: Role.SALA,
    transports: [TransportType.SCOOTER],
    primaryTransport: TransportType.SCOOTER
  },
  {
    username: 'damiano.crivelli',
    roles: [Role.FATTORINO],
    primaryRole: Role.FATTORINO,
    transports: [TransportType.SCOOTER],
    primaryTransport: TransportType.SCOOTER
  },
  
  // SALA
  {
    username: 'nadina.sherief',
    roles: [Role.FATTORINO],
    primaryRole: Role.FATTORINO,
    transports: [TransportType.SCOOTER, TransportType.AUTO],
    primaryTransport: TransportType.SCOOTER
  },
  {
    username: 'yannick.iannarella',
    roles: [Role.SALA, Role.FATTORINO, Role.CUCINA],
    primaryRole: Role.CUCINA,
    transports: [TransportType.SCOOTER],
    primaryTransport: TransportType.SCOOTER
  },
  {
    username: 'ioshua.muheim',
    roles: [Role.FATTORINO],
    primaryRole: Role.FATTORINO,
    transports: [TransportType.SCOOTER],
    primaryTransport: TransportType.SCOOTER
  },
  {
    username: 'michelle.muheim',
    roles: [Role.FATTORINO],
    primaryRole: Role.FATTORINO,
    transports: [TransportType.SCOOTER],
    primaryTransport: TransportType.SCOOTER
  },
  
  // ALTRI
  {
    username: 'alessio.guarneri',
    roles: [Role.FATTORINO, Role.SALA],
    primaryRole: Role.FATTORINO,
    transports: [TransportType.SCOOTER],
    primaryTransport: TransportType.SCOOTER
  },
  {
    username: 'simone.marinelli',
    roles: [Role.FATTORINO],
    primaryRole: Role.FATTORINO,
    transports: [TransportType.SCOOTER],
    primaryTransport: TransportType.SCOOTER
  },
  {
    username: 'simone.buccieri',
    roles: [Role.FATTORINO],
    primaryRole: Role.FATTORINO,
    transports: [TransportType.SCOOTER],
    primaryTransport: TransportType.SCOOTER
  },
  {
    username: 'fred.nunez',
    roles: [Role.CUCINA],
    primaryRole: Role.CUCINA
  },
  {
    username: 'riccardo.quinto',
    roles: [Role.CUCINA, Role.SALA, Role.FATTORINO],
    primaryRole: Role.CUCINA,
    transports: [TransportType.SCOOTER],
    primaryTransport: TransportType.SCOOTER
  },
  {
    username: 'francesco.desimone',
    roles: [Role.FATTORINO],
    primaryRole: Role.FATTORINO,
    transports: [TransportType.AUTO],
    primaryTransport: TransportType.AUTO
  },
  {
    username: 'alessio.tshimanga',
    roles: [Role.CUCINA],
    primaryRole: Role.CUCINA
  }
]

// ================================
// SETUP FUNCTIONS
// ================================

async function setupUsers() {
  console.log('👥 Creazione utenti...')
  
  for (const userData of users) {
    try {
      // Crea utente principale
      const hashedPassword = await hashPassword(userData.username.toLowerCase())
      
      const user = await prisma.user.upsert({
        where: { username: userData.username },
        update: {
          primaryRole: userData.primaryRole,
          primaryTransport: userData.primaryTransport || null,
          isActive: true
        },
        create: {
          username: userData.username,
          password: hashedPassword,
          primaryRole: userData.primaryRole,
          primaryTransport: userData.primaryTransport || null,
          isActive: true,
          isFirstLogin: true
        }
      })

      // Aggiorna ruoli
      await prisma.userRole.deleteMany({
        where: { userId: user.id }
      })

      for (const role of userData.roles) {
        await prisma.userRole.create({
          data: {
            userId: user.id,
            role: role
          }
        })
      }

      // Aggiorna trasporti
      if (userData.transports) {
        await prisma.userTransport.deleteMany({
          where: { userId: user.id }
        })

        for (const transport of userData.transports) {
          await prisma.userTransport.create({
            data: {
              userId: user.id,
              transport: transport
            }
          })
        }
      }

      console.log(`✅ Utente ${userData.username} (${userData.primaryRole})`)
    } catch (error) {
      console.error(`❌ Errore creando ${userData.username}:`, error)
    }
  }
}

async function setupSystemSettings() {
  console.log('⚙️ Configurazione impostazioni sistema...')
  
  const settings = [
    {
      key: 'scooter_count',
      value: '4',
      description: 'Numero massimo di scooter disponibili'
    }
  ]

  for (const setting of settings) {
    await prisma.systemSettings.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting
    })
    console.log(`✅ ${setting.key}: ${setting.value}`)
  }
}

async function setupShiftLimits() {
  console.log('📊 Configurazione limiti turni...')
  
  // Configurazione dettagliata basata sui dati reali del sistema
  const detailedLimits = [
    // Lunedì
    { dayOfWeek: 0, shiftType: 'PRANZO', role: 'FATTORINO', min: 2, max: 2 },
    { dayOfWeek: 0, shiftType: 'PRANZO', role: 'CUCINA', min: 2, max: 2 },
    { dayOfWeek: 0, shiftType: 'PRANZO', role: 'SALA', min: 1, max: 1 },
    { dayOfWeek: 0, shiftType: 'PRANZO', role: 'PIZZAIOLO', min: 1, max: 1 },
    { dayOfWeek: 0, shiftType: 'CENA', role: 'FATTORINO', min: 5, max: 5 },
    { dayOfWeek: 0, shiftType: 'CENA', role: 'CUCINA', min: 2, max: 2 },
    { dayOfWeek: 0, shiftType: 'CENA', role: 'SALA', min: 1, max: 1 },
    { dayOfWeek: 0, shiftType: 'CENA', role: 'PIZZAIOLO', min: 1, max: 1 },
    
    // Martedì
    { dayOfWeek: 1, shiftType: 'PRANZO', role: 'FATTORINO', min: 2, max: 2 },
    { dayOfWeek: 1, shiftType: 'PRANZO', role: 'CUCINA', min: 1, max: 1 },
    { dayOfWeek: 1, shiftType: 'PRANZO', role: 'SALA', min: 0, max: 0 },
    { dayOfWeek: 1, shiftType: 'PRANZO', role: 'PIZZAIOLO', min: 1, max: 1 },
    { dayOfWeek: 1, shiftType: 'CENA', role: 'FATTORINO', min: 3, max: 3 },
    { dayOfWeek: 1, shiftType: 'CENA', role: 'CUCINA', min: 1, max: 1 },
    { dayOfWeek: 1, shiftType: 'CENA', role: 'SALA', min: 1, max: 1 },
    { dayOfWeek: 1, shiftType: 'CENA', role: 'PIZZAIOLO', min: 1, max: 1 },
    
    // Mercoledì
    { dayOfWeek: 2, shiftType: 'PRANZO', role: 'FATTORINO', min: 2, max: 2 },
    { dayOfWeek: 2, shiftType: 'PRANZO', role: 'CUCINA', min: 1, max: 1 },
    { dayOfWeek: 2, shiftType: 'PRANZO', role: 'SALA', min: 0, max: 0 },
    { dayOfWeek: 2, shiftType: 'PRANZO', role: 'PIZZAIOLO', min: 1, max: 1 },
    { dayOfWeek: 2, shiftType: 'CENA', role: 'FATTORINO', min: 3, max: 3 },
    { dayOfWeek: 2, shiftType: 'CENA', role: 'CUCINA', min: 1, max: 1 },
    { dayOfWeek: 2, shiftType: 'CENA', role: 'SALA', min: 1, max: 1 },
    { dayOfWeek: 2, shiftType: 'CENA', role: 'PIZZAIOLO', min: 1, max: 1 },
    
    // Giovedì
    { dayOfWeek: 3, shiftType: 'PRANZO', role: 'FATTORINO', min: 2, max: 2 },
    { dayOfWeek: 3, shiftType: 'PRANZO', role: 'CUCINA', min: 1, max: 1 },
    { dayOfWeek: 3, shiftType: 'PRANZO', role: 'SALA', min: 0, max: 0 },
    { dayOfWeek: 3, shiftType: 'PRANZO', role: 'PIZZAIOLO', min: 1, max: 1 },
    { dayOfWeek: 3, shiftType: 'CENA', role: 'FATTORINO', min: 3, max: 3 },
    { dayOfWeek: 3, shiftType: 'CENA', role: 'CUCINA', min: 2, max: 2 },
    { dayOfWeek: 3, shiftType: 'CENA', role: 'SALA', min: 1, max: 1 },
    { dayOfWeek: 3, shiftType: 'CENA', role: 'PIZZAIOLO', min: 1, max: 1 },
    
    // Venerdì
    { dayOfWeek: 4, shiftType: 'PRANZO', role: 'FATTORINO', min: 2, max: 2 },
    { dayOfWeek: 4, shiftType: 'PRANZO', role: 'CUCINA', min: 2, max: 2 },
    { dayOfWeek: 4, shiftType: 'PRANZO', role: 'SALA', min: 1, max: 1 },
    { dayOfWeek: 4, shiftType: 'PRANZO', role: 'PIZZAIOLO', min: 1, max: 1 },
    { dayOfWeek: 4, shiftType: 'CENA', role: 'FATTORINO', min: 4, max: 4 },
    { dayOfWeek: 4, shiftType: 'CENA', role: 'CUCINA', min: 2, max: 2 },
    { dayOfWeek: 4, shiftType: 'CENA', role: 'SALA', min: 1, max: 1 },
    { dayOfWeek: 4, shiftType: 'CENA', role: 'PIZZAIOLO', min: 1, max: 1 },
    
    // Sabato
    { dayOfWeek: 5, shiftType: 'PRANZO', role: 'FATTORINO', min: 2, max: 2 },
    { dayOfWeek: 5, shiftType: 'PRANZO', role: 'CUCINA', min: 2, max: 2 },
    { dayOfWeek: 5, shiftType: 'PRANZO', role: 'SALA', min: 1, max: 1 },
    { dayOfWeek: 5, shiftType: 'PRANZO', role: 'PIZZAIOLO', min: 1, max: 1 },
    { dayOfWeek: 5, shiftType: 'CENA', role: 'FATTORINO', min: 5, max: 5 },
    { dayOfWeek: 5, shiftType: 'CENA', role: 'CUCINA', min: 2, max: 2 },
    { dayOfWeek: 5, shiftType: 'CENA', role: 'SALA', min: 1, max: 1 },
    { dayOfWeek: 5, shiftType: 'CENA', role: 'PIZZAIOLO', min: 1, max: 1 },
    
    // Domenica
    { dayOfWeek: 6, shiftType: 'PRANZO', role: 'FATTORINO', min: 2, max: 2 },
    { dayOfWeek: 6, shiftType: 'PRANZO', role: 'CUCINA', min: 2, max: 2 },
    { dayOfWeek: 6, shiftType: 'PRANZO', role: 'SALA', min: 1, max: 1 },
    { dayOfWeek: 6, shiftType: 'PRANZO', role: 'PIZZAIOLO', min: 1, max: 1 },
    { dayOfWeek: 6, shiftType: 'CENA', role: 'FATTORINO', min: 5, max: 5 },
    { dayOfWeek: 6, shiftType: 'CENA', role: 'CUCINA', min: 2, max: 2 },
    { dayOfWeek: 6, shiftType: 'CENA', role: 'SALA', min: 1, max: 1 },
    { dayOfWeek: 6, shiftType: 'CENA', role: 'PIZZAIOLO', min: 1, max: 1 },
  ]

  for (const limit of detailedLimits) {
    await prisma.shiftLimits.upsert({
      where: {
        dayOfWeek_shiftType_role: {
          dayOfWeek: limit.dayOfWeek,
          shiftType: limit.shiftType,
          role: limit.role
        }
      },
      update: {
        minStaff: limit.min,
        maxStaff: limit.max
      },
      create: {
        dayOfWeek: limit.dayOfWeek,
        shiftType: limit.shiftType,
        role: limit.role,
        minStaff: limit.min,
        maxStaff: limit.max
      }
    })
  }
  
  console.log('✅ Limiti turni configurati (56 configurazioni dettagliate)')
}

async function setupStartTimeDistributions() {
  console.log('🕒 Configurazione distribuzioni orari...')
  
  const distributions = [
    // PRANZO
    { shiftType: 'PRANZO', role: 'PIZZAIOLO', startTime: '11:00', targetCount: 1 },
    { shiftType: 'PRANZO', role: 'PIZZAIOLO', startTime: '11:30', targetCount: 1 },
    { shiftType: 'PRANZO', role: 'CUCINA', startTime: '11:00', targetCount: 2 },
    { shiftType: 'PRANZO', role: 'CUCINA', startTime: '11:30', targetCount: 2 },
    { shiftType: 'PRANZO', role: 'SALA', startTime: '11:30', targetCount: 2 },
    { shiftType: 'PRANZO', role: 'SALA', startTime: '12:00', targetCount: 2 },
    { shiftType: 'PRANZO', role: 'FATTORINO', startTime: '11:30', targetCount: 1 },
    { shiftType: 'PRANZO', role: 'FATTORINO', startTime: '12:00', targetCount: 2 },
    
    // CENA
    { shiftType: 'CENA', role: 'PIZZAIOLO', startTime: '17:00', targetCount: 1 },
    { shiftType: 'CENA', role: 'PIZZAIOLO', startTime: '18:00', targetCount: 1 },
    { shiftType: 'CENA', role: 'CUCINA', startTime: '17:00', targetCount: 1 },
    { shiftType: 'CENA', role: 'CUCINA', startTime: '18:00', targetCount: 2 },
    { shiftType: 'CENA', role: 'CUCINA', startTime: '18:30', targetCount: 1 },
    { shiftType: 'CENA', role: 'SALA', startTime: '18:00', targetCount: 2 },
    { shiftType: 'CENA', role: 'SALA', startTime: '18:30', targetCount: 2 },
    { shiftType: 'CENA', role: 'FATTORINO', startTime: '18:00', targetCount: 2 },
    { shiftType: 'CENA', role: 'FATTORINO', startTime: '18:30', targetCount: 2 },
    { shiftType: 'CENA', role: 'FATTORINO', startTime: '19:00', targetCount: 2 }
  ]

  for (const dist of distributions) {
    await prisma.shiftStartTimeDistribution.upsert({
      where: {
        shiftType_role_startTime: {
          shiftType: dist.shiftType,
          role: dist.role,
          startTime: dist.startTime
        }
      },
      update: {
        targetCount: dist.targetCount,
        isActive: true
      },
      create: {
        shiftType: dist.shiftType,
        role: dist.role,
        startTime: dist.startTime,
        targetCount: dist.targetCount,
        isActive: true
      }
    })
  }
  
  console.log('✅ Distribuzioni orari configurate')
}

// ================================
// MAIN EXECUTION
// ================================

async function main() {
  console.log('🍕 SETUP COMPLETO DATABASE PIZZADOC')
  console.log('===================================')
  
  try {
    await setupUsers()
    await setupSystemSettings()
    await setupShiftLimits()
    await setupStartTimeDistributions()
    
    console.log('')
    console.log('🎉 SETUP COMPLETATO CON SUCCESSO!')
    console.log('===================================')
    console.log('✅ Utenti creati e configurati')
    console.log('✅ Impostazioni sistema inizializzate')
    console.log('✅ Limiti turni configurati')
    console.log('✅ Distribuzioni orari configurate')
    console.log('')
    console.log('💡 CREDENZIALI DEFAULT:')
    console.log('   Username: [nome utente]')
    console.log('   Password: [nome utente in minuscolo]')
    console.log('')
    console.log('🚀 Il sistema è pronto per l\'uso!')
    
  } catch (error) {
    console.error('❌ ERRORE DURANTE IL SETUP:', error)
    process.exit(1)
  }
}

main()
  .catch((e) => {
    console.error('❌ Errore critico:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
