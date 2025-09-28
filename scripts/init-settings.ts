import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function initSettings() {
  console.log('🔧 Inizializzazione impostazioni sistema...')

  const defaultSettings = [
    {
      key: 'scooter_count',
      value: '3',
      description: 'Numero di scooter disponibili per le consegne'
    },
    {
      key: 'max_shifts_per_week',
      value: '6',
      description: 'Numero massimo di turni per dipendente a settimana'
    },
    {
      key: 'auto_schedule_enabled',
      value: 'true',
      description: 'Abilita o disabilita la pianificazione automatica dei turni'
    }
  ]

  for (const setting of defaultSettings) {
    try {
      await prisma.systemSettings.upsert({
        where: { key: setting.key },
        update: {}, // Non sovrascrivere se già esiste
        create: setting
      })
      console.log(`✅ Impostazione ${setting.key} inizializzata`)
    } catch (error) {
      console.error(`❌ Errore inizializzando ${setting.key}:`, error)
    }
  }

  console.log('🎉 Inizializzazione completata!')
}

initSettings()
  .catch((e) => {
    console.error('❌ Errore durante l\'inizializzazione:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
