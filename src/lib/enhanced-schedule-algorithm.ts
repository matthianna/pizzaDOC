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
  // Statistiche per bilanciamento
  weeklyHours: number
  consecutiveShifts: number
  lastWorkedShift: { dayOfWeek: number; shiftType: ShiftType } | null
}

interface ShiftRequirement {
  dayOfWeek: number
  shiftType: ShiftType
  role: Role
  minStaff: number
  maxStaff: number
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
      balanceScore: number
      coverageScore: number
      fairnessScore: number
      overallScore: number
    }
  }
}

export class EnhancedScheduleAlgorithm {
  
  private async getTransportLimits(): Promise<{ maxScooter: number; maxAuto: number }> {
    const scooterSetting = await prisma.systemSettings.findUnique({
      where: { key: 'scooter_count' }
    })
    
    // Default limits se non configurati
    return {
      maxScooter: parseInt(scooterSetting?.value || '4'),
      maxAuto: 10 // Assume limite alto per auto
    }
  }
  
  private async checkTransportLimits(
    candidate: UserProfile,
    currentSchedule: ScheduleShift[],
    dayOfWeek: number,
    shiftType: ShiftType,
    maxScooter: number,
    maxAuto: number,
    allUsers: UserProfile[]
  ): Promise<{ canUse: boolean; suggestedTransport?: TransportType }> {
    // Se il candidato non è fattorino, non ha limiti di trasporto
    if (!candidate.roles.includes('FATTORINO')) {
      return { canUse: true }
    }
    
    // Conta mezzi già assegnati per questo turno
    const sameShiftFattorini = currentSchedule.filter(s => 
      s.dayOfWeek === dayOfWeek && 
      s.shiftType === shiftType &&
      s.role === 'FATTORINO'
    )
    
    // Conta trasporti già usati
    let scooterCount = 0
    let autoCount = 0
    
    for (const shift of sameShiftFattorini) {
      const user = allUsers.find(u => u.id === shift.userId)
      if (user?.primaryTransport === 'SCOOTER') scooterCount++
      if (user?.primaryTransport === 'AUTO') autoCount++
    }
    
    console.log(`🚗 Trasporti usati ${dayOfWeek} ${shiftType}: SCOOTER=${scooterCount}/${maxScooter}, AUTO=${autoCount}/${maxAuto}`)
    
    // Controlla se il candidato può essere aggiunto
    const candidateTransports = candidate.transports
    
    // Se ha solo un mezzo, controlla se può usarlo
    if (candidateTransports.length === 1) {
      if (candidateTransports[0] === 'SCOOTER' && scooterCount >= maxScooter) {
        console.log(`❌ ${candidate.username}: troppi scooter (${scooterCount}/${maxScooter})`)
        return { canUse: false }
      }
      if (candidateTransports[0] === 'AUTO' && autoCount >= maxAuto) {
        console.log(`❌ ${candidate.username}: troppe auto (${autoCount}/${maxAuto})`)
        return { canUse: false }
      }
      return { canUse: true, suggestedTransport: candidateTransports[0] }
    }
    
    // Se ha entrambi i mezzi, scegli quello con più disponibilità
    if (candidateTransports.includes('SCOOTER') && candidateTransports.includes('AUTO')) {
      if (scooterCount < maxScooter) {
        console.log(`✅ ${candidate.username}: assegnato SCOOTER (${scooterCount + 1}/${maxScooter})`)
        return { canUse: true, suggestedTransport: 'SCOOTER' }
      } else if (autoCount < maxAuto) {
        console.log(`✅ ${candidate.username}: assegnato AUTO (${autoCount + 1}/${maxAuto})`)
        return { canUse: true, suggestedTransport: 'AUTO' }
      } else {
        console.log(`❌ ${candidate.username}: tutti i mezzi sono al limite`)
        return { canUse: false }
      }
    }
    
    return { canUse: true }
  }
  
  private getGlobalShiftTimes(shiftType: ShiftType): { start: string; end: string } {
    // Orari globali fissi
    return shiftType === 'PRANZO' 
      ? { start: '11:00', end: '14:00' }
      : { start: '17:00', end: '22:00' }
  }

  private async getOptimalStartTime(shiftType: ShiftType, role: Role, dayOfWeek: number, assignedUsers: Map<string, number>): Promise<string> {
    // SEMPRE carica distribuzioni configurate per questo ruolo e turno
    const distributions = await prisma.shiftStartTimeDistribution.findMany({
      where: {
        shiftType,
        role,
        isActive: true
      },
      orderBy: { startTime: 'asc' }
    })

    if (distributions.length === 0) {
      console.error(`❌ NESSUNA DISTRIBUZIONE trovata per ${role} ${shiftType}!`)
      throw new Error(`Nessuna distribuzione configurata per ${role} ${shiftType}`)
    }

    // Applica vincoli specifici solo per la cena e se ci sono distribuzioni valide
    if (shiftType === 'CENA') {
      const constrainedStartTime = this.applyRoleConstraints(shiftType, role, dayOfWeek, assignedUsers, distributions)
      if (constrainedStartTime) {
        return constrainedStartTime
      } else if (constrainedStartTime === null && (role === 'FATTORINO' || role === 'SALA')) {
        // Se applyRoleConstraints restituisce null per FATTORINO/SALA, significa che non ci sono slot
        console.log(`❌ Nessun slot disponibile per ${role} ${shiftType} - candidato rifiutato`)
        throw new Error(`NO_SLOT_AVAILABLE: ${role} ${shiftType}`)
      }
    }

    // PRIORITÀ: Riempi SEQUENZIALMENTE ogni slot fino al target
    for (const dist of distributions) {
      const key = `${dayOfWeek}_${shiftType}_${role}_${dist.startTime}`
      const currentCount = assignedUsers.get(key) || 0
      
      if (currentCount < dist.targetCount) {
        return dist.startTime
      }
    }

    // Se tutti i target sono raggiunti, distribuisci equamente sui primi slot
    return distributions[0].startTime
  }

  private applyRoleConstraints(
    shiftType: ShiftType, 
    role: Role, 
    dayOfWeek: number,
    assignedUsers: Map<string, number>,
    distributions: { startTime: string; targetCount: number }[]
  ): string | null {
    // Solo per la cena applicare vincoli
    if (shiftType !== 'CENA') return null

    if (role === 'FATTORINO' || role === 'SALA') {
      // VINCOLO: Usa SOLO gli orari configurati nelle distribuzioni
      const availableSlots = distributions.map(d => d.startTime).sort()
      
      // PRIORITÀ: Riempire prima gli slot precedenti
      // NOTA: assignedUsers contiene contatori per GIORNO + ORARIO, non globali
      for (const slot of availableSlots) {
        const key = `${dayOfWeek}_${shiftType}_${role}_${slot}`
        const currentCount = assignedUsers.get(key) || 0
        const dist = distributions.find(d => d.startTime === slot)
        const targetCount = dist?.targetCount || 0
        
        if (currentCount < targetCount) {
          return slot
        }
      }
      // Se tutti i slot sono saturi, rifiuta il candidato
      return null
    }

    if (role === 'PIZZAIOLO' || role === 'CUCINA') {
      // VINCOLO: Solo 1 persona alle 17:00, gli altri dalle 18:00
      const availableSlots = distributions.map(d => d.startTime).sort()
      const count17 = assignedUsers.get(`${shiftType}_${role}_17:00`) || 0
      
      // Se c'è 17:00 nelle distribuzioni e non è ancora occupato
      if (availableSlots.includes('17:00') && count17 < 1) {
        return '17:00'
      } else {
        // Le altre dalle 18:00 in poi, usa solo orari configurati
        const slots18Plus = availableSlots.filter(slot => slot >= '18:00')
        
        for (const slot of slots18Plus) {
          const currentCount = assignedUsers.get(`${shiftType}_${role}_${slot}`) || 0
          const dist = distributions.find(d => d.startTime === slot)
          const targetCount = dist?.targetCount || 0
          
          if (currentCount < targetCount) {
            return slot
          }
        }
        
        // Default al primo slot dalle 18:00 configurato
        return slots18Plus[0] || availableSlots[0]
      }
    }

    return null // Nessun vincolo per altri ruoli
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

  async generatePerfectSchedule(weekStart: Date): Promise<ScheduleResult> {
    console.log('🧠 Iniziando generazione schedule con algoritmo enhanced...')
    
    // 1. Carica tutti i dati necessari
    const users = await this.loadUserProfiles(weekStart)
    const requirements = await this.loadShiftRequirements()
    const existingShifts = await this.loadExistingShifts(weekStart)
    
    console.log(`👥 Utenti caricati: ${users.length}`)
    console.log(`📋 Requisiti caricati: ${requirements.length}`)
    console.log(`🔄 Turni esistenti: ${existingShifts.length}`)
    
    // 2. Ordina i requisiti per priorità
    const sortedRequirements = this.prioritizeRequirements(requirements)
    
    // 3. PASSO 1: Assegnamento prioritario con ruoli primari
    console.log('\n🥇 PASSO 1: Assegnamento ruoli primari...')
    const primarySchedule = await this.optimizeScheduleAssignment(users, sortedRequirements, existingShifts, true)
    
    // 4. PASSO 2: Completamento con ruoli secondari
    console.log('\n🥈 PASSO 2: Completamento con ruoli secondari...')
    const unfilledRequirements = this.findUnfilledRequirements(requirements, primarySchedule)
    console.log(`📋 Requisiti ancora da riempire: ${unfilledRequirements.length}`)
    
    let finalSchedule = primarySchedule
    if (unfilledRequirements.length > 0) {
      finalSchedule = await this.optimizeScheduleAssignment(users, unfilledRequirements, primarySchedule, false)
    }
    
    // 5. Calcola statistiche e qualità
    const statistics = this.calculateStatistics(finalSchedule, requirements, users)
    
    console.log(`🎯 Schedule generato: ${finalSchedule.length} turni`)
    console.log(`📊 Qualità complessiva: ${(statistics.quality.overallScore * 100).toFixed(1)}%`)
    
    return {
      shifts: finalSchedule,
      statistics
    }
  }

  private async loadUserProfiles(weekStart: Date): Promise<UserProfile[]> {
    // Calcola weekEnd per query assenze
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)
    
    const users = await prisma.user.findMany({
      where: { isActive: true },
      include: {
        userRoles: true,
        userTransports: true,
        availabilities: {
          where: {
            weekStart,
            isAbsentWeek: false
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
      .filter(user => !user.userRoles.some(ur => ur.role === 'ADMIN'))
      .map(user => {
        // Filtra disponibilità escludendo giorni in assenza
        const filteredAvailabilities = user.availabilities
          .filter(av => av.isAvailable)
          .filter(av => {
            // Calcola la data di questo giorno specifico
            const dayDate = new Date(weekStart)
            dayDate.setDate(dayDate.getDate() + av.dayOfWeek)
            dayDate.setHours(0, 0, 0, 0)
            
            // Verifica se questo giorno è coperto da un'assenza
            const isAbsent = user.absences.some(absence => {
              const absStart = new Date(absence.startDate)
              absStart.setHours(0, 0, 0, 0)
              const absEnd = new Date(absence.endDate)
              absEnd.setHours(23, 59, 59, 999)
              
              return dayDate >= absStart && dayDate <= absEnd
            })
            
            return !isAbsent
          })
        
        return {
          id: user.id,
          username: user.username,
          primaryRole: user.primaryRole!,
          roles: user.userRoles.map(ur => ur.role),
          primaryTransport: user.primaryTransport,
          transports: user.userTransports.map(ut => ut.transport),
          availabilities: filteredAvailabilities.map(av => ({
            dayOfWeek: av.dayOfWeek,
            shiftType: av.shiftType,
            isAvailable: av.isAvailable
          })),
          weeklyHours: 0,
          consecutiveShifts: 0,
          lastWorkedShift: null
        }
      })
  }

  private async loadShiftRequirements(): Promise<ShiftRequirement[]> {
    const limits = await prisma.shiftLimits.findMany({
      where: { minStaff: { gt: 0 } }
    })

    return limits.map(limit => ({
      dayOfWeek: limit.dayOfWeek,
      shiftType: limit.shiftType,
      role: limit.role,
      minStaff: limit.minStaff,
      maxStaff: limit.maxStaff,
      priority: this.getRolePriority(limit.role) + this.getShiftPriority(limit.dayOfWeek, limit.shiftType)
    }))
  }

  private async loadExistingShifts(weekStart: Date): Promise<ScheduleShift[]> {
    const existingSchedule = await prisma.schedule.findUnique({
      where: { weekStart },
      include: {
        shifts: {
          include: { user: true }
        }
      }
    })

    if (!existingSchedule) return []

    return existingSchedule.shifts.map(shift => ({
      userId: shift.userId,
      dayOfWeek: shift.dayOfWeek,
      shiftType: shift.shiftType,
      role: shift.role,
      startTime: shift.startTime,
      endTime: shift.endTime,
      priority: this.getRolePriority(shift.role),
      score: 1.0
    }))
  }

  private prioritizeRequirements(requirements: ShiftRequirement[]): ShiftRequirement[] {
    return requirements.sort((a, b) => {
      // Prima priorità: ruolo
      if (a.priority !== b.priority) return b.priority - a.priority
      
      // Seconda priorità: giorno (weekend prima)
      const aWeekend = [0, 5, 6].includes(a.dayOfWeek) ? 1 : 0
      const bWeekend = [0, 5, 6].includes(b.dayOfWeek) ? 1 : 0
      if (aWeekend !== bWeekend) return bWeekend - aWeekend
      
      // Terza priorità: turno (cena prima di pranzo)
      if (a.shiftType !== b.shiftType) {
        return a.shiftType === 'CENA' ? -1 : 1
      }
      
      // Quarta priorità: giorno della settimana
      return a.dayOfWeek - b.dayOfWeek
    })
  }

  private async optimizeScheduleAssignment(
    users: UserProfile[], 
    requirements: ShiftRequirement[], 
    existingShifts: ScheduleShift[],
    priorityMode: boolean = false
  ): Promise<ScheduleShift[]> {
    const schedule: ScheduleShift[] = [...existingShifts]
    const userWorkload = new Map<string, number>()
    const userLastShift = new Map<string, { dayOfWeek: number; shiftType: ShiftType }>()
    const assignedStartTimes = new Map<string, number>() // Traccia assegnazioni per orario

    // Carica limiti di trasporto
    const transportLimits = await this.getTransportLimits()

    // Inizializza workload esistente
    existingShifts.forEach(shift => {
      const current = userWorkload.get(shift.userId) || 0
      userWorkload.set(shift.userId, current + 3) // 3 ore medio per turno
      userLastShift.set(shift.userId, { dayOfWeek: shift.dayOfWeek, shiftType: shift.shiftType })
      
      // Traccia orari di inizio esistenti
      const key = `${shift.dayOfWeek}_${shift.shiftType}_${shift.role}_${shift.startTime}`
      assignedStartTimes.set(key, (assignedStartTimes.get(key) || 0) + 1)
    })

    // Per ogni requisito, trova i migliori candidati
    for (const req of requirements) {
      const assignedCount = schedule.filter(s => 
        s.dayOfWeek === req.dayOfWeek && 
        s.shiftType === req.shiftType && 
        s.role === req.role
      ).length

      const needed = req.minStaff - assignedCount

      if (needed <= 0) continue

      // Trova candidati disponibili per questo ruolo e turno
      const candidates = this.findBestCandidates(users, req, userWorkload, userLastShift, schedule, priorityMode)
      
      // NUOVO: Se ci sono POCHI candidati, riprova con criteri più flessibili
      let finalCandidates = candidates
      if (candidates.length < needed && !priorityMode) {
        console.log(`🔄 Riprovo con criteri rilassati per ${req.role} ${req.dayOfWeek} ${req.shiftType}`)
        finalCandidates = this.findBestCandidates(users, req, userWorkload, userLastShift, schedule, priorityMode, true)
      }
      
      // Assegna i candidati UNO ALLA VOLTA controllando anche i limiti di trasporto
      let assignedThisReq = 0
      
      for (let i = 0; i < finalCandidates.length && assignedThisReq < needed; i++) {
        const candidate = finalCandidates[i]
        
        // Controlla limiti di trasporto PRIMA di assegnare
        const transportCheck = await this.checkTransportLimits(
          candidate,
          schedule,
          req.dayOfWeek,
          req.shiftType,
          transportLimits.maxScooter,
          transportLimits.maxAuto,
          users
        )
        
        if (!transportCheck.canUse) {
          console.log(`⚠️ Saltato ${candidate.username} per limiti trasporto`)
          continue // Salta questo candidato
        }
        
        // CRITICO: Ottieni orario PRIMA, usando il contatore aggiornato
        let startTime: string
        try {
          startTime = await this.getOptimalStartTime(req.shiftType, req.role, req.dayOfWeek, assignedStartTimes)
        } catch (error: any) {
          if (error.message.startsWith('NO_SLOT_AVAILABLE')) {
            console.log(`⚠️ Saltato ${candidate.username} per slot esauriti`)
            continue // Salta questo candidato
          }
          throw error // Altri errori vengono ri-lanciati
        }
        const { end } = this.getGlobalShiftTimes(req.shiftType)
        
        // Se c'è un trasporto suggerito, aggiorna primaryTransport per questo turno
        if (transportCheck.suggestedTransport && transportCheck.suggestedTransport !== candidate.primaryTransport) {
          console.log(`🔄 ${candidate.username}: cambiato trasporto da ${candidate.primaryTransport} a ${transportCheck.suggestedTransport}`)
          // Aggiorna temporaneamente per questo turno
          candidate.primaryTransport = transportCheck.suggestedTransport
        }
        
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
        
        // CRITICO: Aggiorna SUBITO il contatore PRIMA del prossimo assegnamento
        const key = `${req.dayOfWeek}_${req.shiftType}_${req.role}_${startTime}`
        const currentCount = assignedStartTimes.get(key) || 0
        assignedStartTimes.set(key, currentCount + 1)
        
        // Aggiorna workload
        const currentWorkload = userWorkload.get(candidate.id) || 0
        userWorkload.set(candidate.id, currentWorkload + 3)
        userLastShift.set(candidate.id, { dayOfWeek: req.dayOfWeek, shiftType: req.shiftType })
        
        console.log(`✅ Assegnato ${candidate.username} a ${req.dayOfWeek} ${req.shiftType} ${req.role} alle ${startTime}`)
      }
      
      if (assignedThisReq < needed) {
        console.log(`⚠️ ATTENZIONE: Richiesti ${needed}, assegnati solo ${assignedThisReq} per ${req.dayOfWeek} ${req.shiftType} ${req.role}`)
      }
    }

    return schedule
  }

  private findUnfilledRequirements(
    originalRequirements: ShiftRequirement[], 
    currentSchedule: ScheduleShift[]
  ): ShiftRequirement[] {
    const unfilledRequirements: ShiftRequirement[] = []
    
    for (const req of originalRequirements) {
      // Conta quanti sono già assegnati per questo requisito
      const assignedCount = currentSchedule.filter(shift => 
        shift.dayOfWeek === req.dayOfWeek &&
        shift.shiftType === req.shiftType &&
        shift.role === req.role
      ).length
      
      // Se ne servono ancora, aggiungi alla lista
      const stillNeeded = req.minStaff - assignedCount
      if (stillNeeded > 0) {
        // Crea un nuovo requisito per la quantità mancante
        unfilledRequirements.push({
          ...req,
          minStaff: stillNeeded
        })
      }
    }
    
    return unfilledRequirements
  }

  private findBestCandidates(
    users: UserProfile[], 
    requirement: ShiftRequirement,
    userWorkload: Map<string, number>,
    userLastShift: Map<string, { dayOfWeek: number; shiftType: ShiftType }>,
    currentSchedule: ScheduleShift[],
    priorityMode: boolean = false,
    relaxedMode: boolean = false
  ): (UserProfile & { score: number })[] {
    
    const candidates = users
      .filter(user => {
        // 1. Deve avere il ruolo richiesto
        if (!user.roles.includes(requirement.role)) return false
        
        // 2. Deve essere disponibile
        const availability = user.availabilities.find(av => 
          av.dayOfWeek === requirement.dayOfWeek && 
          av.shiftType === requirement.shiftType
        )
        if (!availability?.isAvailable) return false
        
        // 3. Non deve già essere assegnato a questo turno
        const alreadyAssigned = currentSchedule.some(shift => 
          shift.userId === user.id && 
          shift.dayOfWeek === requirement.dayOfWeek && 
          shift.shiftType === requirement.shiftType
        )
        if (alreadyAssigned) return false
        
        // 4. Controllo turni consecutivi
        if (this.hasConflictingShift(user.id, requirement, currentSchedule)) return false
        
        return true
      })
      .map(user => {
        const score = this.calculateUserScore(user, requirement, userWorkload, userLastShift, priorityMode, relaxedMode)
        return { ...user, score }
      })
      .sort((a, b) => b.score - a.score)

    return candidates
  }

  private hasConflictingShift(
    userId: string, 
    requirement: ShiftRequirement, 
    currentSchedule: ScheduleShift[]
  ): boolean {
    // Controlla turni dello stesso giorno
    const sameDay = currentSchedule.filter(s => 
      s.userId === userId && s.dayOfWeek === requirement.dayOfWeek
    )
    
    // Non più di un turno per giorno
    if (sameDay.length > 0) return true
    
    // Controlla turni consecutivi (sera del giorno prima + mattina del giorno dopo)
    if (requirement.shiftType === 'PRANZO') {
      const prevEvening = currentSchedule.some(s => 
        s.userId === userId && 
        s.dayOfWeek === (requirement.dayOfWeek - 1 + 7) % 7 && 
        s.shiftType === 'CENA'
      )
      if (prevEvening) return true
    }
    
    if (requirement.shiftType === 'CENA') {
      const nextMorning = currentSchedule.some(s => 
        s.userId === userId && 
        s.dayOfWeek === (requirement.dayOfWeek + 1) % 7 && 
        s.shiftType === 'PRANZO'
      )
      if (nextMorning) return true
    }
    
    return false
  }

  private calculateUserScore(
    user: UserProfile, 
    requirement: ShiftRequirement,
    userWorkload: Map<string, number>,
    userLastShift: Map<string, { dayOfWeek: number; shiftType: ShiftType }>,
    priorityMode: boolean = false,
    relaxedMode: boolean = false
  ): number {
    let score = 100 // Base score
    
    // 1. Gestione ruoli primari vs secondari
    if (user.primaryRole === requirement.role) {
      score += 20 // Bonus ruolo primario
    } else {
      // Ruolo secondario: nel priorityMode penalizza molto, altrimenti solo un po'
      if (priorityMode) {
        score -= 50 // Penalità pesante in priority mode (solo ruoli primari)
      } else {
        score -= 10 // Penalità leggera nel secondo passaggio
      }
    }
    
    // 2. Penalità workload (favorisce chi ha lavorato meno)
    const workload = userWorkload.get(user.id) || 0
    
    if (relaxedMode) {
      // In modalità rilassata, penalità workload molto ridotta
      const workloadPenalty = Math.min(workload * 0.5, 10) // Max 10 punti di penalità (invece di 30)
      score -= workloadPenalty
      console.log(`🔄 ${user.username}: penalità workload rilassata: ${workloadPenalty} (workload: ${workload})`)
    } else {
      // Modalità normale
      const workloadPenalty = Math.min(workload * 2, 30) // Max 30 punti di penalità
      score -= workloadPenalty
    }
    
    // 3. Bonus distribuzione temporale
    const lastShift = userLastShift.get(user.id)
    if (lastShift) {
      const dayGap = Math.abs(requirement.dayOfWeek - lastShift.dayOfWeek)
      if (dayGap >= 2) score += 10 // Bonus per distanza temporale
    }
    
    // 4. Bonus per fattorini con trasporto appropriato
    if (requirement.role === 'FATTORINO') {
      if (user.primaryTransport && user.transports.length > 0) {
        score += 15
      }
    }
    
    // 5. Bonus weekend per disponibilità
    if ([0, 5, 6].includes(requirement.dayOfWeek)) {
      score += 5 // Piccolo bonus per disponibilità weekend
    }
    
    // 6. Bonus ruoli critici
    if (['PIZZAIOLO', 'CUCINA'].includes(requirement.role)) {
      score += 10
    }
    
    return Math.max(0, score)
  }

  private calculateStatistics(
    schedule: ScheduleShift[], 
    requirements: ShiftRequirement[], 
    users: UserProfile[]
  ): ScheduleResult['statistics'] {
    
    // Calcola gaps
    const gaps = requirements.map(req => {
      const assigned = schedule.filter(s => 
        s.dayOfWeek === req.dayOfWeek && 
        s.shiftType === req.shiftType && 
        s.role === req.role
      ).length
      
      return {
        dayOfWeek: req.dayOfWeek,
        shiftType: req.shiftType,
        role: req.role,
        required: req.minStaff,
        assigned,
        missing: Math.max(0, req.minStaff - assigned)
      }
    })
    
    // Calcola workload per utente
    const userWorkload: Record<string, number> = {}
    schedule.forEach(shift => {
      userWorkload[shift.userId] = (userWorkload[shift.userId] || 0) + 2.5
    })
    
    // Calcola distribuzione ruoli
    const rolesAssigned = schedule.reduce((acc, shift) => {
      acc[shift.role] = (acc[shift.role] || 0) + 1
      return acc
    }, {} as Record<Role, number>)
    
    // Calcola punteggi qualità
    const totalGaps = gaps.reduce((sum, gap) => sum + gap.missing, 0)
    const totalRequired = requirements.reduce((sum, req) => sum + req.minStaff, 0)
    const coverageScore = totalRequired > 0 ? Math.max(0, 1 - totalGaps / totalRequired) : 1
    
    const workloadValues = Object.values(userWorkload)
    const avgWorkload = workloadValues.reduce((a, b) => a + b, 0) / workloadValues.length || 0
    const workloadVariance = workloadValues.reduce((sum, w) => sum + Math.pow(w - avgWorkload, 2), 0) / workloadValues.length || 0
    const fairnessScore = avgWorkload > 0 ? Math.max(0, 1 - workloadVariance / (avgWorkload * avgWorkload)) : 1
    
    const avgScore = schedule.reduce((sum, shift) => sum + shift.score, 0) / schedule.length || 0
    const balanceScore = avgScore / 100
    
    const overallScore = (coverageScore * 0.4 + fairnessScore * 0.3 + balanceScore * 0.3)
    
    return {
      totalShifts: schedule.length,
      rolesAssigned,
      userWorkload,
      gaps,
      quality: {
        balanceScore,
        coverageScore,
        fairnessScore,
        overallScore
      }
    }
  }

  async saveSchedule(weekStart: Date, shifts: ScheduleShift[]): Promise<string> {
    // Elimina schedule esistente per questa settimana
    await prisma.schedule.deleteMany({
      where: { weekStart }
    })

    // Crea nuovo schedule
    const schedule = await prisma.schedule.create({
      data: {
        weekStart,
        shifts: {
          create: shifts.map(shift => ({
            userId: shift.userId,
            dayOfWeek: shift.dayOfWeek,
            shiftType: shift.shiftType,
            role: shift.role,
            startTime: shift.startTime,
            endTime: shift.endTime,
            status: 'ASSIGNED'
          }))
        }
      }
    })

    return schedule.id
  }
}
