import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAuditAction } from '@/lib/audit-logger'

// PUT - Aggiorna un giorno festivo
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || !session.user.roles?.includes('ADMIN')) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
    }

    const { id } = params
    const { date, closureType, description } = await request.json()

    // Verifica che il giorno festivo esista
    const existing = await prisma.holidays.findUnique({
      where: { id }
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Giorno festivo non trovato' },
        { status: 404 }
      )
    }

    // Prepara i dati di aggiornamento
    const updateData: any = {
      updatedAt: new Date()
    }

    if (date) {
      const holidayDate = new Date(date)
      holidayDate.setUTCHours(0, 0, 0, 0)
      updateData.date = holidayDate
    }

    if (closureType) {
      if (!['FULL_DAY', 'PRANZO_ONLY', 'CENA_ONLY'].includes(closureType)) {
        return NextResponse.json(
          { error: 'Tipo di chiusura non valido' },
          { status: 400 }
        )
      }
      updateData.closureType = closureType
    }

    if (description !== undefined) {
      updateData.description = description || null
    }

    // Verifica conflitti se data o tipo cambiano
    if (updateData.date || updateData.closureType) {
      const conflictCheck = await prisma.holidays.findFirst({
        where: {
          id: { not: id },
          date: updateData.date || existing.date,
          closureType: updateData.closureType || existing.closureType
        }
      })

      if (conflictCheck) {
        return NextResponse.json(
          { error: 'Esiste già un giorno festivo per questa data e tipo di chiusura' },
          { status: 409 }
        )
      }
    }

    const holiday = await prisma.holidays.update({
      where: { id },
      data: updateData
    })

    // Log audit
    await logAuditAction({
      userId: session.user.id,
      userUsername: session.user.username,
      action: 'HOLIDAY_EDIT',
      description: `Modificato giorno festivo: ${holiday.date.toISOString().split('T')[0]} (${holiday.closureType})`,
      metadata: { holidayId: id, changes: updateData }
    })

    return NextResponse.json(holiday)
  } catch (error) {
    console.error('Error updating holiday:', error)
    return NextResponse.json({ error: 'Errore nell\'aggiornamento del giorno festivo' }, { status: 500 })
  }
}

// DELETE - Elimina un giorno festivo
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || !session.user.roles?.includes('ADMIN')) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
    }

    const { id } = params

    // Verifica che il giorno festivo esista
    const existing = await prisma.holidays.findUnique({
      where: { id }
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Giorno festivo non trovato' },
        { status: 404 }
      )
    }

    await prisma.holidays.delete({
      where: { id }
    })

    // Log audit
    await logAuditAction({
      userId: session.user.id,
      userUsername: session.user.username,
      action: 'HOLIDAY_DELETE',
      description: `Eliminato giorno festivo: ${existing.date.toISOString().split('T')[0]} (${existing.closureType})`,
      metadata: { holidayId: id, date: existing.date, closureType: existing.closureType }
    })

    return NextResponse.json({ message: 'Giorno festivo eliminato con successo' })
  } catch (error) {
    console.error('Error deleting holiday:', error)
    return NextResponse.json({ error: 'Errore nell\'eliminazione del giorno festivo' }, { status: 500 })
  }
}

