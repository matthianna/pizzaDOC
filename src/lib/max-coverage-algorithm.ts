import { prisma } from './prisma'
import { Role, ShiftType, TransportType } from '@prisma/client'

interface UserProfile {
  id: string
  username: string
  primaryRole: Role
  roles: Role[]
  primaryTransport: TransportType | null
  transports: TransportType[]
  availabilities: {
    dayOfWeek: number
    shiftType: ShiftType
    isAvailable: boolean
  }[]
}

interface ShiftRequirement {
  dayOfWeek: number
  shiftType: ShiftType
  role: Role
  requiredStaff: number
  priority: number
}

interface ScheduleShift {
  userId: string
  dayOfWeek: number
  shiftType: ShiftType
  role: Role
  startTime: string
  endTime: string
  priority: number
  score: number
}

interface ScheduleResult {
  shifts: ScheduleShift[]
  statistics: {
    totalShifts: number
    rolesAssigned: Record<Role, number>
    userWorkload: Record<string, number>
    gaps: {
      dayOfWeek: number
      shiftType: ShiftType
      role: Role
      required: number
      assigned: number
      missing: number
    }[]
    quality: {
      coverageScore: number
      overallScore: number
    }
  }
}

export class MaxCoverageAlgorithm {
  
  private async getTransportLimits(): Promise<{ maxScooter: number }> {
    const scooterSetting = await prisma.SystemSettings.findUnique({
      where: { key: 'scooter_count' }
    })
    
    return {
      maxScooter: parseInt(scooterSetting?.value || '4')
    }
  }
  
  private async checkScooterLimit(
    candidate: UserProfile,
    currentSchedule: ScheduleShift[],
    dayOfWeek: number,
    shiftType: ShiftType,
    maxScooter: number
  ): Promise<boolean> {
    // Se il candidato non è fattorino, può sempre essere assegnato
    if (!candidate.roles.includes('FATTORINO')) {
      return true
    }
    
    // Se non usa scooter, può sempre essere assegnato
    if (candidate.primaryTransport !== 'SCOOTER') {
      return true
    }
    
    // Conta scooter già assegnati per questo turno
    const sameShiftFattorini = currentSchedule.filter(s => 
      s.dayOfWeek === dayOfWeek && 
      s.shiftType === shiftType &&
      s.role === 'FATTORINO'
    )
    
    // Per ogni fattorino assegnato, verifica il trasporto
    let scooterCount = 0
    for (const shift of sameShiftFattorini) {
      const user = await prisma.User.findUnique({
        where: { id: shift.userId },
        select: { primaryTransport: true }
      })
      if (user?.primaryTransport === 'SCOOTER') {
        scooterCount++
      }
    }
    
    // Controlla se possiamo aggiungere un altro scooter
    return scooterCount < maxScooter
  }

  private getGlobalShiftTimes(shiftType: ShiftType): { start: string; end: string } {
    return shiftType === 'PRANZO' 
      ? { start: '11:30', end: '14:00' }
      : { start: '18:00', end: '22:00' }
  }

  private async getOptimalStartTime(
    shiftType: ShiftType, 
    role: Role, 
    dayOfWeek: number,
    assignedUsers: Map<string, number>
  ): string {
    // Carica le distribuzioni configurate per questo giorno specifico
    const distributions = await prisma.shift_start_time_distributions.findMany({
      where: {
        dayOfWeek: dayOfWeek,
        shiftType: shiftType,
        role: role,
        isActive: true
      },
      orderBy: {
        startTime: 'asc'
      }
    })

    console.log(`🕐 getOptimalStartTime - Giorno: ${dayOfWeek}, Turno: ${shiftType}, Ruolo: ${role}`)
    console.log(`📋 Distribuzioni trovate: ${distributions.length}`, distributions.map(d => `${d.startTime}: ${d.targetCount}`))

    // Filtra solo le distribuzioni con targetCount > 0 (le altre non sono slot validi)
    const activeDistributions = distributions.filter(d => d.targetCount > 0)
    
    console.log(`✅ Distribuzioni attive (targetCount > 0): ${activeDistributions.length}`, activeDistributions.map(d => `${d.startTime}: ${d.targetCount}`))

    if (activeDistributions.length === 0) {
      // Se non ci sono distribuzioni attive, usa l'orario standard
      const defaultTime = shiftType === 'PRANZO' ? '11:30' : '18:00'
      console.log(`⚠️ Nessuna distribuzione attiva, uso default: ${defaultTime}`)
      return defaultTime
    }

    // STRATEGIA RANDOM: Trova tutti gli slot con spazio disponibile e scegli casualmente
    const slotsWithSpace: string[] = []
    
    for (const dist of activeDistributions) {
      const key = `${dayOfWeek}_${shiftType}_${role}_${dist.startTime}`
      const currentCount = assignedUsers.get(key) || 0
      
      console.log(`  🔍 Slot ${dist.startTime}: ${currentCount}/${dist.targetCount}`)
      
      // Se c'è spazio in questo slot, aggiungilo alla lista
      if (currentCount < dist.targetCount) {
        slotsWithSpace.push(dist.startTime)
      }
    }
    
    // Se ci sono slot disponibili, scegline uno RANDOM
    if (slotsWithSpace.length > 0) {
      const randomIndex = Math.floor(Math.random() * slotsWithSpace.length)
      const selectedTime = slotsWithSpace[randomIndex]
      console.log(`  🎲 Scelto RANDOM tra ${slotsWithSpace.length} slot disponibili: ${selectedTime}`)
      return selectedTime
    }
    
    // Se tutti gli slot sono pieni, scegli random tra tutti
    const allSlots = activeDistributions.map(d => d.startTime)
    const randomIndex = Math.floor(Math.random() * allSlots.length)
    const fallbackTime = allSlots[randomIndex] || '18:00'
    console.log(`  ⚠️ Tutti gli slot pieni, uso slot RANDOM: ${fallbackTime}`)
    return fallbackTime
  }

  private getRolePriority(role: Role): number {
    // Priorità: PIZZAIOLO > CUCINA > FATTORINO > SALA > ADMIN
    const priorities = {
      'PIZZAIOLO': 10,
      'CUCINA': 8,
      'FATTORINO': 6,
      'SALA': 4,
      'ADMIN': 1
    }
    return priorities[role] || 0
  }

  private getShiftPriority(dayOfWeek: number, shiftType: ShiftType): number {
    // Weekend e cene hanno priorità più alta
    let priority = 1
    if (dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0) priority += 2 // Ven/Sab/Dom
    if (shiftType === 'CENA') priority += 1
    return priority
  }

  async generateMaxCoverageSchedule(weekStart: Date): Promise<ScheduleResult> {
    console.log('🚀 Generazione schedule con algoritmo MAX COVERAGE AVANZATO...')
    console.log(`📅 Settimana: ${weekStart.toISOString().split('T')[0]}`)
    
    // 1. Carica dati
    const users = await this.loadUserProfiles(weekStart)
    const requirements = await this.loadShiftRequirements()
    const existingShifts = await this.loadExistingShifts(weekStart)
    
    console.log(`👥 Utenti caricati: ${users.length}`)
    console.log(`📋 Requisiti caricati: ${requirements.length}`)
    console.log(`🔄 Turni esistenti: ${existingShifts.length}`)
    
    // Log dettagliato disponibilità
    const totalAvailabilities = users.reduce((sum, u) => sum + u.availabilities.filter(a => a.isAvailable).length, 0)
    const usersWithAvailabilities = users.filter(u => u.availabilities.some(a => a.isAvailable)).length
    console.log(`✅ Disponibilità TOTALI per questa settimana: ${totalAvailabilities}`)
    console.log(`✅ Utenti con almeno 1 disponibilità: ${usersWithAvailabilities}/${users.length}`)
    
    if (usersWithAvailabilities === 0) {
      console.warn('⚠️  ATTENZIONE: NESSUN utente ha disponibilità per questa settimana!')
      console.warn(`⚠️  Verifica che gli utenti abbiano inserito disponibilità per ${weekStart.toISOString().split('T')[0]}`)
    }
    
    // 2. Ordina requisiti per priorità
    const sortedRequirements = this.prioritizeRequirements(requirements)
    
    // 3. PASSAGGIO 1: Assegna con ruoli PRIMARI
    console.log('\n🥇 PASSAGGIO 1: Assegnamento con ruoli primari...')
    let schedule = await this.assignShiftsMaxCoverage(users, sortedRequirements, existingShifts, 'primary')
    
    // 4. PASSAGGIO 2: Completa con ruoli SECONDARI per gap rimanenti
    let gaps = this.findGaps(schedule, requirements)
    if (gaps.length > 0) {
      console.log(`\n🥈 PASSAGGIO 2: Completamento con ruoli secondari (${gaps.length} gap)...`)
      schedule = await this.assignShiftsMaxCoverage(users, this.gapsToRequirements(gaps, requirements), schedule, 'secondary')
    }
    
    // 5. PASSAGGIO 3: Riempimento AGGRESSIVO - chiunque disponibile
    gaps = this.findGaps(schedule, requirements)
    if (gaps.length > 0) {
      console.log(`\n🥉 PASSAGGIO 3: Riempimento aggressivo (${gaps.length} gap)...`)
      schedule = await this.assignShiftsMaxCoverage(users, this.gapsToRequirements(gaps, requirements), schedule, 'aggressive')
    }
    
    // 6. PASSAGGIO 4: Riempimento ULTRA-AGGRESSIVO - ignora vincoli riposo
    gaps = this.findGaps(schedule, requirements)
    if (gaps.length > 0) {
      console.log(`\n🔥 PASSAGGIO 4: Ultra-aggressivo senza vincoli riposo (${gaps.length} gap)...`)
      schedule = await this.assignShiftsMaxCoverage(users, this.gapsToRequirements(gaps, requirements), schedule, 'ultra')
    }
    
    // 7. PASSAGGIO 5: Tentativo FINALE - considera anche chi ha già turni simili
    gaps = this.findGaps(schedule, requirements)
    if (gaps.length > 0) {
      console.log(`\n⚡ PASSAGGIO 5: Tentativo finale massimo (${gaps.length} gap)...`)
      schedule = await this.assignShiftsMaxCoverage(users, this.gapsToRequirements(gaps, requirements), schedule, 'final')
    }
    
    // 8. PASSAGGIO 6: DESPERATE - Ignora TUTTI i vincoli tranne quelli fondamentali
    gaps = this.findGaps(schedule, requirements)
    if (gaps.length > 0) {
      console.log(`\n🆘 PASSAGGIO 6: DESPERATE - Ignora tutti i vincoli (${gaps.length} gap)...`)
      schedule = await this.assignShiftsMaxCoverage(users, this.gapsToRequirements(gaps, requirements), schedule, 'desperate')
    }
    
    // 9. Calcola statistiche finali
    const statistics = this.calculateStatistics(schedule, requirements, users)
    
    const finalGaps = this.findGaps(schedule, requirements)
    console.log(`\n✅ Schedule generato: ${schedule.length} turni`)
    console.log(`📊 Copertura: ${(statistics.quality.coverageScore * 100).toFixed(1)}%`)
    console.log(`⚠️  Gap rimanenti: ${finalGaps.length}`)
    
    if (finalGaps.length > 0) {
      console.log('\n📋 Gap non risolti:')
      finalGaps.slice(0, 10).forEach(gap => {
        // Trova chi potrebbe fare questo turno (ignora vincoli)
        const potentialCandidates = users.filter(u => 
          u.roles.includes(gap.role) && 
          !schedule.some(s => 
            s.userId === u.id && 
            s.dayOfWeek === gap.dayOfWeek && 
            s.shiftType === gap.shiftType
          )
        )
        
        console.log(`   - ${this.getDayName(gap.dayOfWeek)} ${gap.shiftType} ${gap.role}: mancano ${gap.missing} (${potentialCandidates.length} persone hanno il ruolo e non sono già assegnate)`)
        
        // Mostra chi potrebbe fare questo turno
        if (potentialCandidates.length > 0 && potentialCandidates.length <= 5) {
          console.log(`     Potenziali: ${potentialCandidates.map(c => c.username).join(', ')}`)
        }
      })
    }
    
    return {
      shifts: schedule,
      statistics
    }
  }

  private getDayName(dayOfWeek: number): string {
    const days = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']
    return days[dayOfWeek] || 'Unknown'
  }

  private findGaps(schedule: ScheduleShift[], requirements: ShiftRequirement[]): ScheduleResult['statistics']['gaps'] {
    const gaps: ScheduleResult['statistics']['gaps'] = []
    
    requirements.forEach(req => {
      const assigned = schedule.filter(s => 
        s.dayOfWeek === req.dayOfWeek && 
        s.shiftType === req.shiftType && 
        s.role === req.role
      ).length

      const missing = Math.max(0, req.requiredStaff - assigned)
      if (missing > 0) {
        gaps.push({
          dayOfWeek: req.dayOfWeek,
          shiftType: req.shiftType,
          role: req.role,
          required: req.requiredStaff,
          assigned,
          missing
        })
      }
    })

    return gaps
  }

  private gapsToRequirements(gaps: ScheduleResult['statistics']['gaps'], originalRequirements: ShiftRequirement[]): ShiftRequirement[] {
    return gaps.map(gap => {
      const original = originalRequirements.find(r => 
        r.dayOfWeek === gap.dayOfWeek && 
        r.shiftType === gap.shiftType && 
        r.role === gap.role
      )
      
      return {
        dayOfWeek: gap.dayOfWeek,
        shiftType: gap.shiftType,
        role: gap.role,
        requiredStaff: gap.missing,
        priority: original?.priority || 1
      }
    })
  }

  private async loadUserProfiles(weekStart: Date): Promise<UserProfile[]> {
    console.log(`📥 Caricamento profili utenti per settimana: ${weekStart.toISOString().split('T')[0]}`)
    
    // Calcola weekEnd per query assenze
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)
    
    const users = await prisma.user.findMany({
      where: { isActive: true },
      include: {
        user_roles: true,
        user_transports: true,
        availabilities: {
          where: {
            weekStart // ⭐ FILTRA DISPONIBILITÀ PER QUESTA SETTIMANA SPECIFICA
          }
        },
        absences: {
          where: {
            OR: [
              {
                AND: [
                  { startDate: { lte: weekEnd } },
                  { endDate: { gte: weekStart } }
                ]
              }
            ]
          }
        }
      }
    })

    return users
      .filter(user => !user.user_roles.some(ur => ur.role === 'ADMIN'))
      .map(user => {
        // Filtra disponibilità per giorni non in assenza
        const absences = user.absences || []
        const filteredAvailabilities = user.availabilities.filter(av => {
          // Calcola la data effettiva del giorno
          const dayDate = new Date(weekStart)
          dayDate.setDate(weekStart.getDate() + av.dayOfWeek)
          dayDate.setHours(12, 0, 0, 0)

          // Verifica se questo giorno cade in un periodo di assenza
          const isAbsent = absences.some(absence => {
            const absStart = new Date(absence.startDate)
            const absEnd = new Date(absence.endDate)
            absStart.setHours(12, 0, 0, 0)
            absEnd.setHours(12, 0, 0, 0)
            return dayDate >= absStart && dayDate <= absEnd
          })

          return !isAbsent
        })

        return {
          id: user.id,
          username: user.username,
          primaryRole: user.primaryRole,
          roles: user.user_roles.map(ur => ur.role),
          primaryTransport: user.primaryTransport,
          transports: user.user_transports.map(ut => ut.transport),
          availabilities: filteredAvailabilities
        }
      })
  }

  private async loadShiftRequirements(): Promise<ShiftRequirement[]> {
    const shiftLimits = await prisma.shift_limits.findMany()
    
    return shiftLimits.map(limit => ({
      dayOfWeek: limit.dayOfWeek,
      shiftType: limit.shiftType as ShiftType,
      role: limit.role as Role,
      requiredStaff: limit.requiredStaff,
      priority: this.getRolePriority(limit.role as Role) + 
               this.getShiftPriority(limit.dayOfWeek, limit.shiftType as ShiftType)
    }))
  }

  private async loadExistingShifts(weekStart: Date): Promise<ScheduleShift[]> {
    const schedule = await prisma.schedules.findUnique({
      where: { weekStart },
      include: {
        shifts: true
      }
    })

    if (!schedule) return []

    return schedule.shifts.map(shift => ({
      userId: shift.userId,
      dayOfWeek: shift.dayOfWeek,
      shiftType: shift.shiftType,
      role: shift.role,
      startTime: shift.startTime,
      endTime: shift.endTime,
      priority: 0,
      score: 0
    }))
  }

  private prioritizeRequirements(requirements: ShiftRequirement[]): ShiftRequirement[] {
    // Calcola scarsità per ogni ruolo (più il ruolo è scarso, più priorità ha)
    const roleCounts = requirements.reduce((acc, req) => {
      acc[req.role] = (acc[req.role] || 0) + req.requiredStaff
      return acc
    }, {} as Record<Role, number>)
    
    return requirements.sort((a, b) => {
      // 1. Priorità configurata
      if (b.priority !== a.priority) {
        return b.priority - a.priority
      }
      
      // 2. Ruoli più richiesti hanno priorità (massimizza copertura dei ruoli critici)
      const aTotal = roleCounts[a.role] || 0
      const bTotal = roleCounts[b.role] || 0
      if (bTotal !== aTotal) {
        return bTotal - aTotal
      }
      
      // 3. Requisiti più grandi per primi (riempi i turni grandi prima)
      if (b.requiredStaff !== a.requiredStaff) {
        return b.requiredStaff - a.requiredStaff
      }
      
      // 4. Weekend ha priorità (venerdì=4, sabato=5, domenica=6)
      const aIsWeekend = a.dayOfWeek >= 4 ? 1 : 0
      const bIsWeekend = b.dayOfWeek >= 4 ? 1 : 0
      if (bIsWeekend !== aIsWeekend) {
        return bIsWeekend - aIsWeekend
      }
      
      // 5. A parità, ordina per giorno
      return a.dayOfWeek - b.dayOfWeek
    })
  }

  private async assignShiftsMaxCoverage(
    users: UserProfile[], 
    requirements: ShiftRequirement[], 
    existingShifts: ScheduleShift[],
    mode: 'primary' | 'secondary' | 'aggressive' | 'ultra' | 'final' | 'desperate' = 'primary'
  ): Promise<ScheduleShift[]> {
    const schedule: ScheduleShift[] = [...existingShifts]
    const assignedStartTimes = new Map<string, number>()
    const transportLimits = await this.getTransportLimits()

    console.log(`   Modalità: ${mode}`)

    // Inizializza contatori orari esistenti
    existingShifts.forEach(shift => {
      const key = `${shift.dayOfWeek}_${shift.shiftType}_${shift.role}_${shift.startTime}`
      assignedStartTimes.set(key, (assignedStartTimes.get(key) || 0) + 1)
    })

    // Per ogni requisito, assegna il massimo possibile
    for (const req of requirements) {
      const assignedCount = schedule.filter(s => 
        s.dayOfWeek === req.dayOfWeek && 
        s.shiftType === req.shiftType && 
        s.role === req.role
      ).length

      const needed = req.requiredStaff - assignedCount

      if (needed <= 0) continue

      // Trova candidati in base alla modalità
      const candidates = this.findAllAvailableCandidates(users, req, schedule, mode)
      
      console.log(`   📋 ${this.getDayName(req.dayOfWeek)} ${req.shiftType} ${req.role}: trovati ${candidates.length} candidati per ${needed} posizioni`)
      
      // Log dettagliato in modalità desperate
      if (mode === 'desperate' && candidates.length > 0) {
        console.log(`      🆘 DESPERATE - Candidati trovati: ${candidates.map(c => c.username).join(', ')}`)
      }
      if (mode === 'desperate' && candidates.length === 0) {
        // Verifica dettagliata del perché non ci sono candidati
        console.log(`      🆘 DESPERATE - Nessun candidato disponibile!`)
        console.log(`      📊 Analisi dettagliata:`)
        
        const withRole = users.filter(u => u.roles.includes(req.role))
        console.log(`         - ${withRole.length} persone hanno il ruolo ${req.role}`)
        
        const alreadyAssigned = users.filter(u => schedule.some(s => 
          s.userId === u.id && 
          s.dayOfWeek === req.dayOfWeek && 
          s.shiftType === req.shiftType
        ))
        console.log(`         - ${alreadyAssigned.length} persone già assegnate a ${req.shiftType} giorno ${req.dayOfWeek}`)
        console.log(`         - Già assegnate: ${alreadyAssigned.map(u => u.username).join(', ')}`)
        
        const notAssigned = users.filter(u => !alreadyAssigned.some(a => a.id === u.id))
        console.log(`         - ${notAssigned.length} persone NON ancora assegnate a questo turno`)
        
        if (notAssigned.length > 0 && notAssigned.length <= 10) {
          console.log(`         - Non assegnate: ${notAssigned.map(u => `${u.username}(${u.primaryRole})`).join(', ')}`)
        }
      }
      
      // Assegna candidati
      let assignedThisReq = 0
      
      for (let i = 0; i < candidates.length && assignedThisReq < needed; i++) {
        const candidate = candidates[i]
        
        // Controlla solo il limite scooter
        const canAssign = await this.checkScooterLimit(
          candidate,
          schedule,
          req.dayOfWeek,
          req.shiftType,
          transportLimits.maxScooter
        )
        
        if (!canAssign) {
          console.log(`⚠️ ${candidate.username}: limite scooter raggiunto`)
          continue
        }
        
        // Ottieni orario
        const startTime = await this.getOptimalStartTime(req.shiftType, req.role, req.dayOfWeek, assignedStartTimes)
        const { end } = this.getGlobalShiftTimes(req.shiftType)
        
        const newShift: ScheduleShift = {
          userId: candidate.id,
          dayOfWeek: req.dayOfWeek,
          shiftType: req.shiftType,
          role: req.role,
          startTime,
          endTime: end,
          priority: req.priority,
          score: candidate.score
        }

        schedule.push(newShift)
        assignedThisReq++
        
        // Aggiorna contatore orari
        const key = `${req.dayOfWeek}_${req.shiftType}_${req.role}_${startTime}`
        assignedStartTimes.set(key, (assignedStartTimes.get(key) || 0) + 1)
        
        // Log con verifica disponibilità
        const userAvailability = candidate.availabilities.find(av => 
          av.dayOfWeek === req.dayOfWeek && av.shiftType === req.shiftType
        )
        const availStatus = userAvailability?.isAvailable ? '✅ disponibile' : '❌ NON disponibile'
        console.log(`   ✅ ${candidate.username} (${candidate.primaryRole === req.role ? 'primario' : 'secondario'}, ${availStatus}) → ${this.getDayName(req.dayOfWeek)} ${req.shiftType} ${req.role} ${startTime}`)
      }
      
      if (assignedThisReq < needed) {
        console.log(`⚠️ ATTENZIONE: Richiesti ${needed}, assegnati ${assignedThisReq} per ${req.dayOfWeek} ${req.shiftType} ${req.role}`)
      }
    }

    return schedule
  }

  private findAllAvailableCandidates(
    users: UserProfile[], 
    requirement: ShiftRequirement,
    currentSchedule: ScheduleShift[],
    mode: 'primary' | 'secondary' | 'aggressive' | 'ultra' | 'final' | 'desperate' = 'primary'
  ): (UserProfile & { score: number })[] {
    
    const candidates = users
      .filter(user => {
        // 1. Deve avere il ruolo richiesto (primario O secondario)
        // MODALITÀ DESPERATE: Accetta CHIUNQUE sia attivo, ignora completamente i ruoli
        if (mode !== 'desperate') {
          if (!user.roles.includes(requirement.role)) return false
          
          // MODALITÀ PRIMARY: solo ruoli primari
          if (mode === 'primary' && user.primaryRole !== requirement.role) return false
          
          // MODALITÀ SECONDARY: solo ruoli secondari (non primari)
          if (mode === 'secondary' && user.primaryRole === requirement.role) return false
          
          // MODALITÀ AGGRESSIVE: tutti (già filtrato al punto 1)
        }
        
        // 2. Deve essere disponibile
        // ⚠️  VINCOLO FONDAMENTALE: Se uno non è disponibile, NON PUÒ lavorare!
        // Questo vale SEMPRE, anche in modalità desperate!
        const availability = user.availabilities.find(av => 
          av.dayOfWeek === requirement.dayOfWeek && 
          av.shiftType === requirement.shiftType
        )
        if (!availability?.isAvailable) return false
        
        // 2.5 VINCOLO DISPONIBILITÀ TOTALI: Non può superare il numero totale di disponibilità
        // Se ha dichiarato N disponibilità, non può avere più di N turni assegnati
        const totalAvailabilities = user.availabilities.filter(av => av.isAvailable).length
        const currentlyAssignedShifts = currentSchedule.filter(shift => shift.userId === user.id).length
        
        // Modalità FINAL e DESPERATE: permettono di superare le disponibilità come ultima risorsa
        if (mode !== 'final' && mode !== 'desperate' && currentlyAssignedShifts >= totalAvailabilities) {
          return false
        }
        
        // 3. VINCOLO FONDAMENTALE: Una persona può fare SOLO UN RUOLO per turno
        // Non può fare sala+cucina allo stesso turno (stesso giorno + stesso shiftType)
        // MA può fare sala a pranzo e cucina a cena (turni diversi)
        const alreadyAssignedThisShift = currentSchedule.some(shift => 
          shift.userId === user.id && 
          shift.dayOfWeek === requirement.dayOfWeek && 
          shift.shiftType === requirement.shiftType
        )
        if (alreadyAssignedThisShift) return false
        
        // 4. VINCOLO RIPOSO: Non può fare cena + pranzo giorno dopo (turni consecutivi)
        // ULTRA, FINAL e DESPERATE: ignorano questo vincolo per massimizzare copertura
        if (mode !== 'ultra' && mode !== 'final' && mode !== 'desperate') {
          if (requirement.shiftType === 'PRANZO') {
            const workedPrevEvening = currentSchedule.some(shift => 
              shift.userId === user.id && 
              shift.dayOfWeek === (requirement.dayOfWeek - 1 + 7) % 7 && 
              shift.shiftType === 'CENA'
            )
            if (workedPrevEvening) return false
          }
          
          if (requirement.shiftType === 'CENA') {
            const worksNextMorning = currentSchedule.some(shift => 
              shift.userId === user.id && 
              shift.dayOfWeek === (requirement.dayOfWeek + 1) % 7 && 
              shift.shiftType === 'PRANZO'
            )
            if (worksNextMorning) return false
          }
        }
        
        return true
      })
      .map(user => {
        // Score dinamico in base alla modalità
        let score = 100
        
        if (user.primaryRole === requirement.role) {
          score += 50 // Grande bonus ruolo primario
        } else {
          // Ruolo secondario
          score += 20 // Bonus minore per ruolo secondario
        }
        
        // Conta quanti turni ha già assegnati
        const userShifts = currentSchedule.filter(s => s.userId === user.id).length
        
        // Penalità workload in base alla modalità
        if (mode === 'ultra' || mode === 'final') {
          score -= userShifts * 0.1 // Penalità quasi nulla (massima copertura)
        } else if (mode === 'aggressive') {
          score -= userShifts * 0.5 // Penalità minima
        } else {
          score -= userShifts * 2 // Penalità normale
        }
        
        // Bonus se ha pochi turni (distribuzione equa) - solo in modi non estremi
        if (userShifts === 0 && mode !== 'ultra' && mode !== 'final') {
          score += 10
        }
        
        return { ...user, score }
      })
      .sort((a, b) => b.score - a.score)

    return candidates
  }

  private calculateStatistics(
    schedule: ScheduleShift[], 
    requirements: ShiftRequirement[], 
    users: UserProfile[]
  ): ScheduleResult['statistics'] {
    const rolesAssigned: Record<Role, number> = {
      PIZZAIOLO: 0,
      CUCINA: 0,
      FATTORINO: 0,
      SALA: 0,
      ADMIN: 0
    }
    const userWorkload: Record<string, number> = {}
    const gaps: ScheduleResult['statistics']['gaps'] = []

    // Conta assegnazioni per ruolo e workload
    schedule.forEach(shift => {
      rolesAssigned[shift.role]++
      userWorkload[shift.userId] = (userWorkload[shift.userId] || 0) + 1
    })

    // Calcola gaps
    requirements.forEach(req => {
      const assigned = schedule.filter(s => 
        s.dayOfWeek === req.dayOfWeek && 
        s.shiftType === req.shiftType && 
        s.role === req.role
      ).length

      const missing = Math.max(0, req.requiredStaff - assigned)
      if (missing > 0 || assigned < req.requiredStaff) {
        gaps.push({
          dayOfWeek: req.dayOfWeek,
          shiftType: req.shiftType,
          role: req.role,
          required: req.requiredStaff,
          assigned,
          missing
        })
      }
    })

    // Calcola coverage
    const totalRequired = requirements.reduce((sum, req) => sum + req.requiredStaff, 0)
    const totalAssigned = schedule.length
    const coverageScore = totalRequired > 0 ? totalAssigned / totalRequired : 0

    return {
      totalShifts: schedule.length,
      rolesAssigned,
      userWorkload,
      gaps,
      quality: {
        coverageScore,
        overallScore: coverageScore
      }
    }
  }
}


