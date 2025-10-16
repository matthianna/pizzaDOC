import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { whatsappService } from '@/lib/whatsapp-service'

// POST /api/admin/whatsapp/test-group - Send test message to group
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { groupChatId } = await request.json()

    if (!groupChatId) {
      return NextResponse.json(
        { error: 'Group Chat ID is required' },
        { status: 400 }
      )
    }

    // Invia messaggio di test al gruppo
    const result = await whatsappService.sendGroupSubstitutionNotification({
      groupChatId,
      requesterName: 'Test Admin',
      dayOfWeek: 'Lunedì',
      date: new Date().toLocaleDateString('it-IT'),
      shiftType: 'CENA',
      role: 'FATTORINO',
      startTime: '18:00',
      reason: 'Questo è un messaggio di test dal sistema PizzaDoc'
    })

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Test message sent to group successfully',
        messageId: result.messageId
      })
    } else {
      return NextResponse.json(
        { 
          success: false,
          error: result.error 
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error sending test group message:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}




