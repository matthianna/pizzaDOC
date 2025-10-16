import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { whatsappService } from '@/lib/whatsapp-service'

// GET /api/admin/whatsapp/settings - Get WhatsApp settings
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Recupera le impostazioni dal database
    const groupChatIdSetting = await prisma.systemSettings.findUnique({
      where: { key: 'whatsapp_group_chat_id' }
    })

    const enabledSetting = await prisma.systemSettings.findUnique({
      where: { key: 'whatsapp_notifications_enabled' }
    })

    // Verifica lo stato della connessione WAHA
    const wahaStatus = await whatsappService.checkSession()

    return NextResponse.json({
      groupChatId: groupChatIdSetting?.value || '',
      notificationsEnabled: enabledSetting?.value === 'true',
      wahaConfigured: whatsappService.isConfigured(),
      wahaStatus: wahaStatus.success ? wahaStatus.status : 'Error',
      wahaError: wahaStatus.error
    })
  } catch (error) {
    console.error('Error fetching WhatsApp settings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/admin/whatsapp/settings - Update WhatsApp settings
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { groupChatId, notificationsEnabled } = await request.json()

    // Valida il formato del chatId se fornito
    if (groupChatId && !groupChatId.includes('@g.us')) {
      return NextResponse.json(
        { error: 'Invalid group chat ID format. Must end with @g.us' },
        { status: 400 }
      )
    }

    // Aggiorna o crea l'impostazione del groupChatId
    if (groupChatId !== undefined) {
      await prisma.systemSettings.upsert({
        where: { key: 'whatsapp_group_chat_id' },
        update: {
          value: groupChatId,
          updatedAt: new Date(),
        },
        create: {
          id: `whatsapp_group_${Date.now()}`,
          key: 'whatsapp_group_chat_id',
          value: groupChatId,
          description: 'WhatsApp Group Chat ID per notifiche sostituzioni',
          updatedAt: new Date(),
        },
      })
    }

    // Aggiorna o crea l'impostazione notificationsEnabled
    if (notificationsEnabled !== undefined) {
      await prisma.systemSettings.upsert({
        where: { key: 'whatsapp_notifications_enabled' },
        update: {
          value: notificationsEnabled ? 'true' : 'false',
          updatedAt: new Date(),
        },
        create: {
          id: `whatsapp_enabled_${Date.now()}`,
          key: 'whatsapp_notifications_enabled',
          value: notificationsEnabled ? 'true' : 'false',
          description: 'Abilita/disabilita notifiche WhatsApp per sostituzioni',
          updatedAt: new Date(),
        },
      })
    }

    console.log('✅ WhatsApp settings updated:', { groupChatId, notificationsEnabled })

    return NextResponse.json({
      success: true,
      message: 'Settings updated successfully'
    })
  } catch (error) {
    console.error('Error updating WhatsApp settings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}




