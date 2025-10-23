/**
 * WhatsApp Service usando WAHA (WhatsApp HTTP API)
 * 
 * WAHA deve essere hostato esternamente (Railway, Render, VPS)
 * poiché Vercel è serverless e non supporta Docker.
 * 
 * Setup WAHA:
 * 1. Deploy WAHA su Railway: https://railway.app
 * 2. Usa l'immagine Docker: devlikeapro/waha
 * 3. Aggiungi l'URL in WAHA_URL nelle env vars di Vercel
 */

interface SendMessageParams {
  phoneNumber: string
  message: string
}

interface SendMessageResponse {
  success: boolean
  error?: string
  messageId?: string
}

export class WhatsAppService {
  private wahaUrl: string
  private session: string
  private enabled: boolean

  constructor() {
    // Supporta sia WAHA_URL che NEXT_PUBLIC_WAHA_URL
    let rawUrl = process.env.WAHA_URL || process.env.NEXT_PUBLIC_WAHA_URL || ''
    
    // Normalizza URL: aggiungi https:// se manca
    if (rawUrl && !rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
      rawUrl = `https://${rawUrl}`
    }
    
    this.wahaUrl = rawUrl
    this.session = process.env.WAHA_SESSION || process.env.NEXT_PUBLIC_WAHA_SESSION || 'default'
    this.enabled = (process.env.WHATSAPP_ENABLED === 'true') || (process.env.NEXT_PUBLIC_WHATSAPP_ENABLED === 'true')
    
    console.log('🔧 WhatsApp Service Config:', {
      wahaUrl: this.wahaUrl ? this.wahaUrl : 'Not set',
      session: this.session,
      enabled: this.enabled
    })
  }

  /**
   * Verifica se il servizio WhatsApp è configurato e abilitato
   */
  isConfigured(): boolean {
    return this.enabled && this.wahaUrl !== ''
  }

  /**
   * Invia un messaggio di testo via WhatsApp
   */
  async sendMessage({ phoneNumber, message }: SendMessageParams): Promise<SendMessageResponse> {
    if (!this.enabled) {
      return {
        success: false,
        error: 'WhatsApp service is disabled. Set WHATSAPP_ENABLED=true'
      }
    }

    if (!this.wahaUrl) {
      return {
        success: false,
        error: 'WAHA_URL is not configured'
      }
    }

    // ⚠️ Validazione parametri
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return {
        success: false,
        error: 'phoneNumber is required and must be a string'
      }
    }

    if (!message || typeof message !== 'string') {
      return {
        success: false,
        error: 'message is required and must be a string'
      }
    }

    // Se è già un group chat ID (contiene @g.us), usalo direttamente
    if (phoneNumber.includes('@g.us')) {
      try {
        const chatId = phoneNumber.trim()
        console.log(`📱 Sending WhatsApp message to GROUP ${chatId}`)
        
        const response = await fetch(`${this.wahaUrl}/api/sendText`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            session: this.session,
            chatId,
            text: message,
          }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error('❌ WAHA API error:', response.status, errorText)
          return {
            success: false,
            error: `WAHA API error: ${response.status} - ${errorText}`
          }
        }

        const data = await response.json()
        console.log('✅ WhatsApp group message sent successfully:', data)
        
        return {
          success: true,
          messageId: data.id
        }
      } catch (error) {
        console.error('📱 WhatsApp group service error:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }
    
    // Normalizza il numero per contatti individuali (rimuovi spazi, trattini, parentesi, + iniziale)
    let normalizedNumber = phoneNumber.replace(/[\s\-\(\)]/g, '')
    
    // Rimuovi il + iniziale se presente (WhatsApp non lo vuole nel chatId)
    if (normalizedNumber.startsWith('+')) {
      normalizedNumber = normalizedNumber.substring(1)
    }
    
    // Aggiungi @c.us se non presente
    const chatId = normalizedNumber.includes('@') ? normalizedNumber : `${normalizedNumber}@c.us`

    try {
      console.log(`📱 Sending WhatsApp message to ${chatId} (original: ${phoneNumber})`)
      
      const response = await fetch(`${this.wahaUrl}/api/sendText`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session: this.session,
          chatId,
          text: message,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ WAHA API error:', response.status, errorText)
        return {
          success: false,
          error: `WAHA API error: ${response.status} - ${errorText}`
        }
      }

      const data = await response.json()
      console.log('✅ WhatsApp message sent successfully:', data)
      
      return {
        success: true,
        messageId: data.id
      }
    } catch (error) {
      console.error('📱 WhatsApp service error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Verifica lo stato della sessione WAHA
   */
  async checkSession(): Promise<{
    success: boolean
    status?: string
    error?: string
  }> {
    if (!this.wahaUrl) {
      return {
        success: false,
        error: 'WAHA_URL is not configured'
      }
    }

    try {
      const response = await fetch(`${this.wahaUrl}/api/sessions/${this.session}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()
        return {
          success: true,
          status: data.status
        }
      } else {
        return {
          success: false,
          error: `Session not found or not started`
        }
      }
    } catch (error) {
      console.error('📱 Session check error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Ottiene il QR code per connettere WhatsApp
   */
  async getQRCode(): Promise<{
    success: boolean
    qr?: string
    error?: string
  }> {
    if (!this.wahaUrl) {
      return {
        success: false,
        error: 'WAHA_URL is not configured'
      }
    }

    try {
      const response = await fetch(`${this.wahaUrl}/api/sessions/${this.session}`, {
        method: 'GET',
      })

      if (response.ok) {
        const data = await response.json()
        return {
          success: true,
          qr: data.qr
        }
      } else {
        return {
          success: false,
          error: 'Could not get QR code'
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Invia notifica per nuova sostituzione disponibile
   */
  async sendSubstitutionNotification(data: {
    phoneNumber: string
    userName: string
    requesterName: string
    dayOfWeek: string
    shiftType: string
    date: string
    time: string
    role: string
    deadline: string
  }): Promise<SendMessageResponse> {
    const message = `
🔔 *Nuova Sostituzione Disponibile!*

👤 *Richiesta da:* ${data.requesterName}
📅 *Giorno:* ${data.dayOfWeek} ${data.date}
⏰ *Orario:* ${data.time}
👔 *Ruolo:* ${data.role}
🕐 *Turno:* ${data.shiftType}

⚠️ *Scadenza candidature:* ${data.deadline}

💡 Sei idoneo per questo turno!
Candidati subito: ${process.env.NEXTAUTH_URL}/substitutions

---
🍕 PizzaDoc - Sistema Gestione Turni
    `.trim()

    return this.sendMessage({
      phoneNumber: data.phoneNumber,
      message
    })
  }

  /**
   * Invia notifica di sostituzione approvata
   */
  async sendSubstitutionApproved(data: {
    phoneNumber: string
    userName: string
    dayOfWeek: string
    date: string
    time: string
  }): Promise<SendMessageResponse> {
    const message = `
✅ *Sostituzione Approvata!*

Ciao ${data.userName}! 

La tua candidatura è stata approvata!

📅 *Turno:* ${data.dayOfWeek} ${data.date}
⏰ *Orario:* ${data.time}

Ci vediamo al lavoro! 🍕

---
🍕 PizzaDoc
    `.trim()

    return this.sendMessage({
      phoneNumber: data.phoneNumber,
      message
    })
  }

  /**
   * Invia notifica al gruppo WhatsApp quando viene richiesta una sostituzione
   */
  async sendGroupSubstitutionNotification(data: {
    groupChatId: string
    requesterName: string
    dayOfWeek: string
    date: string
    shiftType: string
    role: string
    startTime?: string
    reason?: string
  }): Promise<SendMessageResponse> {
    if (!this.enabled) {
      console.log('📱 WhatsApp notifications disabled')
      return {
        success: false,
        error: 'WhatsApp service is disabled'
      }
    }

    if (!this.wahaUrl) {
      return {
        success: false,
        error: 'WAHA_URL is not configured'
      }
    }

    // Emoji per ruolo
    const roleEmoji: { [key: string]: string } = {
      'FATTORINO': '🏍️',
      'CUCINA': '👨‍🍳',
      'SALA': '🍽️',
      'PIZZAIOLO': '🍕'
    }

    // Emoji per turno
    const shiftEmoji = data.shiftType === 'PRANZO' ? '🌅' : '🌙'

    const message = `
🔔 *NUOVA SOSTITUZIONE RICHIESTA*

👤 *Richiesto da:* ${data.requesterName}
${roleEmoji[data.role] || '👔'} *Ruolo:* ${data.role}
📅 *Data:* ${data.dayOfWeek} ${data.date}
${shiftEmoji} *Turno:* ${data.shiftType}${data.startTime ? ` (inizio ore ${data.startTime})` : ''}
${data.reason ? `💬 *Motivo:* ${data.reason}` : ''}

✋ *Chi può sostituire?* Candidati subito nell'app!

    `.trim()

    try {
      console.log(`📱 Sending group notification to ${data.groupChatId}`)
      
      const response = await fetch(`${this.wahaUrl}/api/sendText`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session: this.session,
          chatId: data.groupChatId,
          text: message,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ WAHA API error:', response.status, errorText)
        return {
          success: false,
          error: `WAHA API error: ${response.status} - ${errorText}`
        }
      }

      const responseData = await response.json()
      console.log('✅ Group notification sent successfully:', responseData)
      
      return {
        success: true,
        messageId: responseData.id
      }
    } catch (error) {
      console.error('📱 WhatsApp group notification error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

// Export singleton instance
export const whatsappService = new WhatsAppService()

