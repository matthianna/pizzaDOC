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
    username: 'Mario',
    roles: [Role.PIZZAIOLO, Role.CUCINA],
    primaryRole: Role.PIZZAIOLO
  },
  {
    username: 'Valentino',
    roles: [Role.PIZZAIOLO],
    primaryRole: Role.PIZZAIOLO
  },
  
  // FATTORINI
  {
    username: 'Luis',
    roles: [Role.FATTORINO],
    primaryRole: Role.FATTORINO,
    transports: [TransportType.AUTO, TransportType.SCOOTER],
    primaryTransport: TransportType.AUTO
  },
  {
    username: 'Matthias',
    roles: [Role.FATTORINO],
    primaryRole: Role.FATTORINO,
    transports: [TransportType.AUTO, TransportType.SCOOTER],
    primaryTransport: TransportType.SCOOTER
  },
  {
    username: 'Mathias',
    roles: [Role.FATTORINO],
    primaryRole: Role.FATTORINO,
    transports: [TransportType.SCOOTER],
    primaryTransport: TransportType.SCOOTER
  },
  {
    username: 'Jacopo',
    roles: [Role.FATTORINO],
    primaryRole: Role.FATTORINO,
    transports: [TransportType.SCOOTER],
    primaryTransport: TransportType.SCOOTER
  },
  
  // CUCINA
  {
    username: 'Davide',
    roles: [Role.CUCINA],
    primaryRole: Role.CUCINA
  },
  {
    username: 'Mike',
    roles: [Role.CUCINA],
    primaryRole: Role.CUCINA
  },
  {
    username: 'Damiano',
    roles: [Role.CUCINA],
    primaryRole: Role.CUCINA
  },
  
  // SALA
  {
    username: 'Nadina',
    roles: [Role.SALA],
    primaryRole: Role.SALA
  },
  {
    username: 'Yannick',
    roles: [Role.SALA, Role.FATTORINO],
    primaryRole: Role.SALA,
    transports: [TransportType.SCOOTER],
    primaryTransport: TransportType.SCOOTER
  },
  {
    username: 'Ioshua',
    roles: [Role.SALA],
    primaryRole: Role.SALA
  },
  {
    username: 'Michelle',
    roles: [Role.SALA],
    primaryRole: Role.SALA
  },
  
  // ALTRI
  {
    username: 'Alessietto',
    roles: [Role.FATTORINO],
    primaryRole: Role.FATTORINO,
    transports: [TransportType.SCOOTER],
    primaryTransport: TransportType.SCOOTER
  },
  {
    username: 'Simone',
    roles: [Role.CUCINA],
    primaryRole: Role.CUCINA
  },
  {
    username: 'Fred',
    roles: [Role.CUCINA],
    primaryRole: Role.CUCINA
  },
  {
    username: 'Riccardo',
    roles: [Role.CUCINA, Role.SALA],
    primaryRole: Role.CUCINA
  },
  {
    username: 'Alessio',
    roles: [Role.CUCINA, Role.SALA],
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
  
  const roles = [Role.PIZZAIOLO, Role.CUCINA, Role.SALA, Role.FATTORINO]
  const shiftTypes = ['PRANZO', 'CENA']
  
  // Limiti per giorni della settimana (1=Lunedì, 7=Domenica)
  const limits = {
    PIZZAIOLO: { PRANZO: { min: 1, max: 2 }, CENA: { min: 1, max: 2 } },
    CUCINA: { PRANZO: { min: 2, max: 4 }, CENA: { min: 2, max: 4 } },
    SALA: { PRANZO: { min: 2, max: 4 }, CENA: { min: 2, max: 4 } },
    FATTORINO: { PRANZO: { min: 1, max: 3 }, CENA: { min: 3, max: 6 } }
  }

  for (let dayOfWeek = 1; dayOfWeek <= 7; dayOfWeek++) {
    for (const role of roles) {
      for (const shiftType of shiftTypes) {
        const limit = limits[role][shiftType as keyof typeof limits.PIZZAIOLO]
        
        await prisma.shiftLimits.upsert({
          where: {
            dayOfWeek_shiftType_role: {
              dayOfWeek,
              shiftType,
              role
            }
          },
          update: {
            minStaff: limit.min,
            maxStaff: limit.max
          },
          create: {
            dayOfWeek,
            shiftType,
            role,
            minStaff: limit.min,
            maxStaff: limit.max
          }
        })
      }
    }
  }
  
  console.log('✅ Limiti turni configurati')
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
