import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { whatsappService } from '@/lib/whatsapp-service'

// POST /api/admin/whatsapp/test - Test WhatsApp message
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { phoneNumber, message } = await request.json()

    if (!phoneNumber || !message) {
      return NextResponse.json(
        { error: 'Phone number and message are required' },
        { status: 400 }
      )
    }

    // Invia messaggio
    const result = await whatsappService.sendMessage({
      phoneNumber,
      message
    })

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Message sent successfully',
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
    console.error('Error testing WhatsApp:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/admin/whatsapp/test - Check WhatsApp status
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user.roles.includes('ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isConfigured = whatsappService.isConfigured()
    
    if (!isConfigured) {
      return NextResponse.json({
        configured: false,
        enabled: process.env.WHATSAPP_ENABLED === 'true',
        wahaUrl: process.env.WAHA_URL ? 'Set' : 'Not set',
        message: 'WhatsApp service not fully configured'
      })
    }

    // Verifica sessione WAHA
    const sessionStatus = await whatsappService.checkSession()

    return NextResponse.json({
      configured: true,
      enabled: true,
      wahaUrl: process.env.WAHA_URL,
      session: process.env.WAHA_SESSION,
      sessionStatus: sessionStatus.success ? sessionStatus.status : 'Error',
      sessionError: sessionStatus.error
    })
  } catch (error) {
    console.error('Error checking WhatsApp status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

