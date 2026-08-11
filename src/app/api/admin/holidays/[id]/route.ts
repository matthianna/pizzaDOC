import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAuditAction } from '@/lib/audit-logger'

// PUT - Aggiorna un giorno festivo
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || !session.user.roles?.includes('ADMIN')) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
    }

    const { id } = await params
    const { date, closureType, description } = await request.json()

    const existing = await prisma.holidays.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Giorno festivo non trovato' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    }

    if (date) {
      const holidayDate = new Date(date)
      holidayDate.setUTCHours(0, 0, 0, 0)
      updateData.date = holidayDate
    }

    if (closureType) {
      if (!['FULL_DAY', 'PRANZO_ONLY', 'CENA_ONLY'].includes(closureType)) {
        return NextResponse.json({ error: 'Tipo di chiusura non valido' }, { status: 400 })
      }
      updateData.closureType = closureType
    }

    if (description !== undefined) {
      updateData.description = description || null
    }

    if (updateData.date || updateData.closureType) {
      const conflictCheck = await prisma.holidays.findFirst({
        where: {
          id: { not: id },
          date: (updateData.date as Date) || existing.date,
          closureType: (updateData.closureType as typeof existing.closureType) || existing.closureType,
        },
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
      data: updateData,
    })

    await logAuditAction({
      userId: session.user.id,
      userUsername: session.user.username,
      action: 'HOLIDAY_EDIT',
      description: `Modificato giorno festivo: ${holiday.date.toISOString().split('T')[0]} (${holiday.closureType})`,
      metadata: { holidayId: id, changes: updateData },
    })

    return NextResponse.json(holiday)
  } catch (error) {
    console.error('Error updating holiday:', error)
    return NextResponse.json(
      { error: "Errore nell'aggiornamento del giorno festivo" },
      { status: 500 }
    )
  }
}

// DELETE - Elimina un giorno festivo
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || !session.user.roles?.includes('ADMIN')) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
    }

    const { id } = await params

    const existing = await prisma.holidays.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Giorno festivo non trovato' }, { status: 404 })
    }

    await prisma.holidays.delete({
      where: { id },
    })

    await logAuditAction({
      userId: session.user.id,
      userUsername: session.user.username,
      action: 'HOLIDAY_DELETE',
      description: `Eliminato giorno festivo: ${existing.date.toISOString().split('T')[0]} (${existing.closureType})`,
      metadata: { holidayId: id, date: existing.date, closureType: existing.closureType },
    })

    return NextResponse.json({ message: 'Giorno festivo eliminato con successo' })
  } catch (error) {
    console.error('Error deleting holiday:', error)
    return NextResponse.json(
      { error: "Errore nell'eliminazione del giorno festivo" },
      { status: 500 }
    )
  }
}
