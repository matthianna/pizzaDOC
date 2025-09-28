import { prisma } from '../src/lib/prisma'
import { hashPassword } from '../src/lib/utils'
import { Role, TransportType } from '@prisma/client'

interface UserData {
  username: string
  roles: Role[]
  primaryRole: Role
  transports?: TransportType[]
  primaryTransport?: TransportType
}

const users: UserData[] = [
  {
    username: 'Matthias',
    roles: [Role.FATTORINO],
    primaryRole: Role.FATTORINO,
    transports: [TransportType.AUTO, TransportType.SCOOTER],
    primaryTransport: TransportType.AUTO
  },
  {
    username: 'Yannick',
    roles: [Role.FATTORINO, Role.SALA, Role.CUCINA],
    primaryRole: Role.FATTORINO,
    transports: [TransportType.AUTO, TransportType.SCOOTER],
    primaryTransport: TransportType.AUTO
  },
  {
    username: 'Alessio',
    roles: [Role.CUCINA],
    primaryRole: Role.CUCINA
  },
  {
    username: 'Jacopo',
    roles: [Role.FATTORINO, Role.SALA],
    primaryRole: Role.FATTORINO,
    transports: [TransportType.AUTO, TransportType.SCOOTER],
    primaryTransport: TransportType.AUTO
  },
  {
    username: 'Billone',
    roles: [Role.FATTORINO],
    primaryRole: Role.FATTORINO,
    transports: [TransportType.AUTO, TransportType.SCOOTER],
    primaryTransport: TransportType.AUTO
  },
  {
    username: 'Nadina',
    roles: [Role.FATTORINO],
    primaryRole: Role.FATTORINO,
    transports: [TransportType.AUTO, TransportType.SCOOTER],
    primaryTransport: TransportType.AUTO
  },
  {
    username: 'Brando',
    roles: [Role.FATTORINO],
    primaryRole: Role.FATTORINO,
    transports: [TransportType.AUTO, TransportType.SCOOTER],
    primaryTransport: TransportType.AUTO
  },
  {
    username: 'Alessietto',
    roles: [Role.FATTORINO, Role.SALA],
    primaryRole: Role.FATTORINO,
    transports: [TransportType.AUTO, TransportType.SCOOTER],
    primaryTransport: TransportType.AUTO
  },
  {
    username: 'Francesco',
    roles: [Role.FATTORINO],
    primaryRole: Role.FATTORINO,
    transports: [TransportType.AUTO, TransportType.SCOOTER],
    primaryTransport: TransportType.AUTO
  },
  {
    username: 'Ioshua',
    roles: [Role.FATTORINO],
    primaryRole: Role.FATTORINO,
    transports: [TransportType.AUTO, TransportType.SCOOTER],
    primaryTransport: TransportType.AUTO
  },
  {
    username: 'Damiano',
    roles: [Role.FATTORINO],
    primaryRole: Role.FATTORINO,
    transports: [TransportType.AUTO, TransportType.SCOOTER],
    primaryTransport: TransportType.AUTO
  },
  {
    username: 'Simone',
    roles: [Role.FATTORINO],
    primaryRole: Role.FATTORINO,
    transports: [TransportType.AUTO, TransportType.SCOOTER],
    primaryTransport: TransportType.AUTO
  },
  {
    username: 'Simone2',
    roles: [Role.FATTORINO],
    primaryRole: Role.FATTORINO,
    transports: [TransportType.AUTO, TransportType.SCOOTER],
    primaryTransport: TransportType.AUTO
  }
]

async function seedUsers() {
  try {
    console.log('🍕 Aggiunta utenti PizzaDOC...\n')

    for (const userData of users) {
      // Verifica se l'utente esiste già
      const existingUser = await prisma.user.findUnique({
        where: { username: userData.username }
      })

      if (existingUser) {
        console.log(`⚠️  Utente ${userData.username} già esistente - saltato`)
        continue
      }

      // Crea password hashata (password = username)
      const hashedPassword = await hashPassword(userData.username.toLowerCase())

      // Crea l'utente
      const user = await prisma.user.create({
        data: {
          username: userData.username,
          password: hashedPassword,
          primaryRole: userData.primaryRole,
          primaryTransport: userData.primaryTransport || null,
          userRoles: {
            create: userData.roles.map(role => ({ role }))
          },
          userTransports: userData.transports ? {
            create: userData.transports.map(transport => ({ transport }))
          } : undefined
        }
      })

      const roleNames = userData.roles.map(role => {
        switch(role) {
          case Role.FATTORINO: return 'Fattorino'
          case Role.CUCINA: return 'Cucina'
          case Role.SALA: return 'Sala'
          case Role.ADMIN: return 'Admin'
          default: return role
        }
      }).join(', ')

      const transportInfo = userData.transports ? 
        ` | Mezzi: ${userData.transports.map(t => t === TransportType.AUTO ? 'Auto' : 'Scooter').join(', ')}` : 
        ''

      console.log(`✅ ${userData.username} - Ruoli: ${roleNames}${transportInfo}`)
    }

    console.log('\n🎉 Tutti gli utenti sono stati aggiunti con successo!')
    console.log('\n📋 Credenziali di accesso:')
    console.log('Username: [nome utente]')
    console.log('Password: [nome utente in minuscolo]')
    console.log('\nEsempio: Matthias / matthias')
    console.log('\n⚠️  Ogni utente dovrà cambiare la password al primo accesso')
    
  } catch (error) {
    console.error('❌ Errore durante l\'aggiunta degli utenti:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

seedUsers()
  .then(() => {
    console.log('\n✅ Script completato!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Script fallito:', error)
    process.exit(1)
  })
