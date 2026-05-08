import { NextRequest, NextResponse } from 'next/server'
import { seedDatabase } from '@/lib/seed'

export async function POST(request: NextRequest) {
  try {
    const locked =
      process.env.VERCEL === '1' || process.env.NODE_ENV === 'production'

    if (locked) {
      const seedSecret = process.env.SEED_SECRET
      const auth = request.headers.get('authorization')
      if (!seedSecret || auth !== `Bearer ${seedSecret}`) {
        return NextResponse.json(
          { error: 'Seed disabilitato senza SEED_SECRET valido' },
          { status: 403 }
        )
      }
    }

    await seedDatabase()
    return NextResponse.json({ message: 'Database seeded successfully' })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json(
      { error: 'Failed to seed database' },
      { status: 500 }
    )
  }
}
