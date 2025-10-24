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

interface CandidateScore {
  user: UserProfile
  score: number
  reason: string
}

export class MaxCoverageAlgorithm {
  
  // ⭐ CONFIGURAZIONE UTENTI SPECIALI
  private readonly PRIORITY_USERS = [
    'valentino.dipietro',
    'mario.dipietro', 
    'alessio.tshimanga',
    'giulia' // ⭐ Giulia ha precedenza: quando disponibile, deve lavorare
  ]

  private readonly CUSTOM_START_TIMES: Record<string, { pranzo: string; cena: string }> = {
    'mario.dipietro': { pranzo: '11:00', cena: '17:00' },
    'valentino.dipietro': { pranzo: '11:00', cena: '17:00' }
  }

  // 🎯 PREFERENZE RUOLI SPECIFICHE per coordinamento VIP
  // Quando valentino e mario lavorano INSIEME nello stesso turno:
  // - valentino → PIZZAIOLO (preferito)
  // - mario → CUCINA (preferito)
  private readonly VIP_ROLE_PREFERENCES: Record<string, Role> = {
    'valentino.dipietro': 'PIZZAIOLO',
    'mario.dipietro': 'CUCINA'
  }

  /**
   * Verifica se un utente ha orari personalizzati
   */
  private hasCustomStartTime(username: string): boolean {
    return username in this.CUSTOM_START_TIMES
  }

  /**
   * Ottiene l'orario personalizzato per un utente (se esiste)
   */
  private getCustomStartTime(username: string, shiftType: ShiftType): string | null {
    const custom = this.CUSTOM_START_TIMES[username]
    if (!custom) return null
    return shiftType === 'PRANZO' ? custom.pranzo : custom.cena
  }

  /**
   * Verifica se un utente è prioritario
   */
  private isPriorityUser(username: string): boolean {
    return this.PRIORITY_USERS.includes(username)
  }
  
  /**
   * Ottiene i limiti di trasporto configurati
   */
  private async getTransportLimits(): Promise<{ maxScooter: number }> {
    const scooterSetting = await prisma.systemSettings.findUnique({
      where: { key: 'scooter_count' }
    })
    
    return {
      maxScooter: parseInt(scooterSetting?.value || '4')
    }
  }
  
  /**
   * Verifica se si può aggiungere un altro scooter al turno
   */
  private async checkScooterLimit(
    candidate: UserProfile,
    currentSchedule: ScheduleShift[],
    dayOfWeek: number,
    shiftType: ShiftType,
    maxScooter: number
  ): Promise<boolean> {
    // Se non è fattorino o non usa scooter, ok
    if (!candidate.roles.includes('FATTORINO') || candidate.primaryTransport !== 'SCOOTER') {
      return true
    }
    
    // Conta scooter già assegnati per questo turno
    const sameShiftFattorini = currentSchedule.filter(s => 
      s.dayOfWeek === dayOfWeek && 
      s.shiftType === shiftType &&
      s.role === 'FATTORINO'
    )
    
    let scooterCount = 0
    for (const shift of sameShiftFattorini) {
      const user = await prisma.user.findUnique({
        where: { id: shift.userId },
        select: { primaryTransport: true }
      })
      if (user?.primaryTransport === 'SCOOTER') {
        scooterCount++
      }
    }
    
    return scooterCount < maxScooter
  }

  /**
   * Ottiene gli orari standard per i turni
   */
  private getGlobalShiftTimes(shiftType: ShiftType): { start: string; end: string } {
    return shiftType === 'PRANZO' 
      ? { start: '11:30', end: '14:00' }
      : { start: '18:00', end: '22:00' }
  }

  /**
   * Ottiene l'orario di inizio ottimale basandosi sulle distribuzioni configurate
   */
  private async getOptimalStartTime(
    shiftType: ShiftType, 
    role: Role, 
    dayOfWeek: number,
    assignedStartTimes: Map<string, number>,
    username?: string
  ): Promise<string> {
    // ⭐ PRIORITÀ ASSOLUTA: Orari personalizzati per utenti speciali
    if (username && this.hasCustomStartTime(username)) {
      const customTime = this.getCustomStartTime(username, shiftType)
      if (customTime) {
        console.log(`      🌟 ${username}: orario personalizzato ${customTime}`)
        return customTime
      }
    }
    // Carica le distribuzioni configurate
    const distributions = await prisma.shift_start_time_distributions.findMany({
      where: {
        dayOfWeek: dayOfWeek,
        shiftType: shiftType,
        role: role,
        isActive: true,
        targetCount: { gt: 0 } // Solo slot con targetCount > 0
      },
      orderBy: {
        startTime: 'asc'
      }
    })

    if (distributions.length === 0) {
      return shiftType === 'PRANZO' ? '11:30' : '18:00'
    }

    // Trova lo slot con più spazio disponibile
    let bestSlot = distributions[0].startTime
    let maxSpace = -1

    for (const dist of distributions) {
      const key = `${dayOfWeek}_${shiftType}_${role}_${dist.startTime}`
      const currentCount = assignedStartTimes.get(key) || 0
      const availableSpace = dist.targetCount - currentCount
      
      if (availableSpace > maxSpace) {
        maxSpace = availableSpace
        bestSlot = dist.startTime
      }
    }
    
    return bestSlot
  }

  /**
   * Priorità per i ruoli
   */
  private getRolePriority(role: Role): number {
    const priorities = {
      'PIZZAIOLO': 10,
      'CUCINA': 8,
      'FATTORINO': 6,
      'SALA': 4,
      'ADMIN': 1
    }
    return priorities[role] || 0
  }

  /**
   * Priorità per i turni (weekend e cene più importanti)
   */
  private getShiftPriority(dayOfWeek: number, shiftType: ShiftType): number {
    let priority = 1
    if (dayOfWeek === 4 || dayOfWeek === 5 || dayOfWeek === 6) priority += 2 // Ven/Sab/Dom
    if (shiftType === 'CENA') priority += 1
    return priority
  }

  /**
   * Analizza la scarsità/abbondanza di ogni ruolo nel sistema
   */
  private analyzeRoleScarcity(
    users: UserProfile[], 
    requirements: ShiftRequirement[]
  ): Record<Role, { demand: number; supply: number; scarcityScore: number }> {
    const analysis: Record<Role, { demand: number; supply: number; scarcityScore: number }> = {
      PIZZAIOLO: { demand: 0, supply: 0, scarcityScore: 0 },
      CUCINA: { demand: 0, supply: 0, scarcityScore: 0 },
      FATTORINO: { demand: 0, supply: 0, scarcityScore: 0 },
      SALA: { demand: 0, supply: 0, scarcityScore: 0 },
      ADMIN: { demand: 0, supply: 0, scarcityScore: 0 }
    }

    // DEMAND: Quante volte serve questo ruolo nella settimana?
    requirements.forEach(req => {
      analysis[req.role].demand += req.requiredStaff
    })

    // SUPPLY: Quante persone hanno questo ruolo (pesato)?
    users.forEach(user => {
      user.roles.forEach(role => {
        if (role === user.primaryRole) {
          analysis[role].supply += 1.0  // Ruolo primario: peso pieno
        } else {
          analysis[role].supply += 0.7  // Ruolo secondario: peso ridotto
        }
      })
    })

    // SCARCITY SCORE: Rapporto domanda/offerta
    Object.keys(analysis).forEach(role => {
      const r = role as Role
      if (analysis[r].supply > 0) {
        analysis[r].scarcityScore = analysis[r].demand / analysis[r].supply
      } else {
        analysis[r].scarcityScore = 999
      }
    })

    return analysis
  }

  /**
   * ALGORITMO PRINCIPALE - Genera lo schedule ottimizzato
   */
  async generateMaxCoverageSchedule(weekStart: Date): Promise<ScheduleResult> {
    console.log('\n🚀 ===== NUOVO ALGORITMO INTELLIGENTE DI SCHEDULING =====')
    console.log(`📅 Settimana: ${weekStart.toISOString().split('T')[0]}`)
    
    // 1. Carica tutti i dati necessari
    const users = await this.loadUserProfiles(weekStart)
    const requirements = await this.loadShiftRequirements()
    const existingShifts = await this.loadExistingShifts(weekStart)
    const transportLimits = await this.getTransportLimits()
    
    console.log(`\n📊 Dati caricati:`)
    console.log(`   👥 Utenti attivi: ${users.length}`)
    console.log(`   📋 Requisiti turni: ${requirements.length}`)
    console.log(`   🔄 Turni esistenti: ${existingShifts.length}`)
    console.log(`   🛵 Limite scooter per turno: ${transportLimits.maxScooter}`)
    
    // 1.5 Analizza scarsità ruoli (fondamentale per scoring intelligente!)
    const roleScarcity = this.analyzeRoleScarcity(users, requirements)
    console.log(`\n📊 Analisi scarsità ruoli:`)
    Object.entries(roleScarcity).forEach(([role, stats]) => {
      if (stats.demand > 0) {
        const status = stats.scarcityScore > 1.5 ? '🔴 CRITICO' : 
                       stats.scarcityScore > 1.0 ? '🟡 SCARSO' : 
                       '🟢 OK'
        console.log(`   ${status} ${role}: domanda=${stats.demand.toFixed(0)} offerta=${stats.supply.toFixed(1)} scarsità=${stats.scarcityScore.toFixed(2)}`)
      }
    })
    
    // Statistiche disponibilità
    const totalAvailabilities = users.reduce((sum, u) => sum + u.availabilities.filter(a => a.isAvailable).length, 0)
    const usersWithAvailabilities = users.filter(u => u.availabilities.some(a => a.isAvailable)).length
    console.log(`\n✅ Disponibilità dichiarate:`)
    console.log(`   Total disponibilità: ${totalAvailabilities}`)
    console.log(`   Utenti con disponibilità: ${usersWithAvailabilities}/${users.length}`)
    
    if (usersWithAvailabilities === 0) {
      console.warn('\n⚠️  ATTENZIONE: Nessun utente ha disponibilità per questa settimana!')
      return {
        shifts: existingShifts,
        statistics: this.calculateStatistics(existingShifts, requirements, users)
      }
    }
    
    // 2. Ordina requisiti per priorità
    const sortedRequirements = this.prioritizeRequirements(requirements)
    
    console.log(`\n🎯 Requisiti ordinati per priorità:`)
    sortedRequirements.slice(0, 5).forEach(req => {
      console.log(`   ${this.getDayName(req.dayOfWeek)} ${req.shiftType} ${req.role}: ${req.requiredStaff} persone (priorità: ${req.priority})`)
    })
    
    // 3. FASE 0: Assegnamento Prioritario per VIP (valentino, mario, alessio)
    console.log(`\n\n🌟 === FASE 0: ASSEGNAMENTO UTENTI PRIORITARI ===`)
    let schedule = await this.intelligentAssignment(
      users, 
      sortedRequirements, 
      existingShifts, 
      transportLimits,
      'vip',
      roleScarcity
    )
    
    // 4. FASE 1: Assegnamento Ottimale con Ruoli Primari
    console.log(`\n\n🥇 === FASE 1: ASSEGNAMENTO CON RUOLI PRIMARI ===`)
    schedule = await this.intelligentAssignment(
      users, 
      sortedRequirements, 
      schedule, 
      transportLimits,
      'primary',
      roleScarcity
    )
    
    // 4.5 FASE 1.5: Focus su Ruoli Critici con Ruoli Secondari
    let gaps = this.findGaps(schedule, requirements)
    if (gaps.length > 0) {
      // Filtra solo i gap per ruoli CRITICI (scarsità > 1.5)
      const criticalGaps = gaps.filter(gap => roleScarcity[gap.role].scarcityScore > 1.5)
      
      if (criticalGaps.length > 0) {
        console.log(`\n\n🔴 === FASE 1.5: FOCUS SU RUOLI CRITICI (ruoli secondari) ===`)
        console.log(`   Ruoli critici da coprire: ${criticalGaps.map(g => g.role).join(', ')}`)
        
        const criticalRequirements = this.gapsToRequirements(criticalGaps, requirements)
        schedule = await this.intelligentAssignment(
          users, 
          criticalRequirements, 
          schedule, 
          transportLimits,
          'secondary',
          roleScarcity
        )
      }
    }
    
    // 5. FASE 2: Completamento con Ruoli Secondari
    gaps = this.findGaps(schedule, requirements)
    if (gaps.length > 0) {
      console.log(`\n\n🥈 === FASE 2: COMPLETAMENTO CON RUOLI SECONDARI ===`)
      console.log(`   Gap rimanenti da colmare: ${gaps.length}`)
      
      const gapRequirements = this.gapsToRequirements(gaps, requirements)
      schedule = await this.intelligentAssignment(
        users, 
        gapRequirements, 
        schedule, 
        transportLimits,
        'secondary',
        roleScarcity
      )
    }
    
    // 6. FASE 3: Flessibilità Vincoli Riposo
    gaps = this.findGaps(schedule, requirements)
    if (gaps.length > 0) {
      console.log(`\n\n🔥 === FASE 3: RILASSAMENTO VINCOLI RIPOSO ===`)
      console.log(`   Gap critici rimanenti: ${gaps.length}`)
      
      const gapRequirements = this.gapsToRequirements(gaps, requirements)
      schedule = await this.intelligentAssignment(
        users, 
        gapRequirements, 
        schedule, 
        transportLimits,
        'flexible',
        roleScarcity
      )
    }

    // 7. FASE POST-OTTIMIZZAZIONE: Rifinimento intelligente del piano
    console.log(`\n\n🔧 === FASE POST-OTTIMIZZAZIONE ===`)
    console.log(`   Analisi turno per turno per possibili miglioramenti...`)
    schedule = await this.refineSchedule(schedule, requirements, users, transportLimits)
    
    // 7.5 OTTIMIZZAZIONE COORDINAMENTO VIP (valentino & mario)
    console.log(`\n\n🎯 === OTTIMIZZAZIONE COORDINAMENTO VIP ===`)
    schedule = this.optimizeVIPCoordination(schedule, users)
    
    // 8. Calcola statistiche finali
    const statistics = this.calculateStatistics(schedule, requirements, users)
    
    // 9. Report finale
    const finalGaps = this.findGaps(schedule, requirements)
    console.log(`\n\n✅ ===== RISULTATI FINALI =====`)
    console.log(`📊 Turni generati: ${schedule.length}`)
    console.log(`📈 Copertura: ${(statistics.quality.coverageScore * 100).toFixed(1)}%`)
    console.log(`⚠️  Gap rimanenti: ${finalGaps.length}`)
    
    // Distribuzione carico di lavoro
    const workloadValues = Object.values(statistics.userWorkload)
    if (workloadValues.length > 0) {
      const avgWorkload = workloadValues.reduce((a, b) => a + b, 0) / workloadValues.length
      const maxWorkload = Math.max(...workloadValues)
      const minWorkload = Math.min(...workloadValues)
      console.log(`\n👥 Distribuzione turni:`)
      console.log(`   Media: ${avgWorkload.toFixed(1)} turni/persona`)
      console.log(`   Min: ${minWorkload} turni`)
      console.log(`   Max: ${maxWorkload} turni`)
    }
    
    // Gap dettagliati
    if (finalGaps.length > 0) {
      console.log(`\n⚠️  Gap non risolti:`)
      finalGaps.slice(0, 10).forEach(gap => {
        const potentialCandidates = users.filter(u => u.roles.includes(gap.role))
        console.log(`   - ${this.getDayName(gap.dayOfWeek)} ${gap.shiftType} ${gap.role}: mancano ${gap.missing}/${gap.required}`)
        console.log(`     (${potentialCandidates.length} persone hanno il ruolo)`)
      })
    }
    
    return {
      shifts: schedule,
      statistics
    }
  }

  /**
   * Ottimizza il coordinamento tra valentino e mario
   * Quando lavorano insieme, assicura: valentino→PIZZAIOLO, mario→CUCINA
   */
  private optimizeVIPCoordination(
    schedule: ScheduleShift[],
    users: UserProfile[]
  ): ScheduleShift[] {
    let swapsCount = 0

    // Raggruppa turni per (dayOfWeek, shiftType)
    const turnKeys = new Set<string>()
    schedule.forEach(shift => {
      turnKeys.add(`${shift.dayOfWeek}_${shift.shiftType}`)
    })

    // Per ogni turno, verifica se ci sono sia valentino che mario
    for (const turnKey of Array.from(turnKeys)) {
      const [dayOfWeek, shiftType] = turnKey.split('_')
      const day = parseInt(dayOfWeek)
      const shift = shiftType as ShiftType

      const turnShifts = schedule.filter(s => s.dayOfWeek === day && s.shiftType === shift)

      // Trova valentino e mario in questo turno
      let valentinoShift: ScheduleShift | undefined
      let marioShift: ScheduleShift | undefined

      for (const s of turnShifts) {
        const userProfile = users.find(u => u.id === s.userId)
        if (userProfile?.username === 'valentino.dipietro') {
          valentinoShift = s
        } else if (userProfile?.username === 'mario.dipietro') {
          marioShift = s
        }
      }

      // Se entrambi sono presenti, verifica la configurazione
      if (valentinoShift && marioShift) {
        const valentinoUser = users.find(u => u.id === valentinoShift!.userId)!
        const marioUser = users.find(u => u.id === marioShift!.userId)!

        console.log(`   🔍 ${this.getDayName(day)} ${shift}:`)
        console.log(`      valentino: ${valentinoShift.role}, mario: ${marioShift.role}`)

        // Configurazione attuale
        const valentinoRole = valentinoShift.role
        const marioRole = marioShift.role

        // Configurazione OTTIMALE: valentino=PIZZAIOLO, mario=CUCINA
        const isOptimal = valentinoRole === 'PIZZAIOLO' && marioRole === 'CUCINA'
        
        // Configurazione SWAPPABLE: valentino=CUCINA, mario=PIZZAIOLO
        const isSwappable = valentinoRole === 'CUCINA' && marioRole === 'PIZZAIOLO'

        if (isOptimal) {
          console.log(`      ✅ Configurazione già ottimale!`)
        } else if (isSwappable) {
          // Verifica se entrambi possono fare il ruolo dell'altro
          const valentinoCanBePizzaiolo = valentinoUser.roles.includes('PIZZAIOLO')
          const marioCanBeCucina = marioUser.roles.includes('CUCINA')

          if (valentinoCanBePizzaiolo && marioCanBeCucina) {
            // SWAP!
            console.log(`      🔄 SWAP: valentino ${valentinoRole}→PIZZAIOLO, mario ${marioRole}→CUCINA`)
            
            // Trova gli indici nello schedule originale
            const valentinoIndex = schedule.findIndex(s => 
              s.userId === valentinoShift!.userId &&
              s.dayOfWeek === day &&
              s.shiftType === shift &&
              s.role === valentinoRole
            )
            
            const marioIndex = schedule.findIndex(s => 
              s.userId === marioShift!.userId &&
              s.dayOfWeek === day &&
              s.shiftType === shift &&
              s.role === marioRole
            )

            if (valentinoIndex !== -1 && marioIndex !== -1) {
              schedule[valentinoIndex].role = 'PIZZAIOLO'
              schedule[marioIndex].role = 'CUCINA'
              swapsCount++
              console.log(`      ✅ Swap completato!`)
            }
          } else {
            console.log(`      ⚠️  Swap non possibile: ruoli mancanti`)
          }
        } else {
          // Altra configurazione (es: valentino=SALA, mario=FATTORINO)
          console.log(`      ℹ️  Configurazione diversa, nessuna azione`)
        }
      }
    }

    if (swapsCount > 0) {
      console.log(`\n   ✅ Coordinamento VIP ottimizzato: ${swapsCount} swap effettuati`)
    } else {
      console.log(`\n   ℹ️  Nessuno swap necessario, coordinamento già ottimale`)
    }

    return schedule
  }

  /**
   * Post-ottimizzazione: Rifinisce il piano turno per turno
   * Cerca opportunità per spostare persone tra ruoli per migliorare la copertura
   */
  private async refineSchedule(
    initialSchedule: ScheduleShift[],
    requirements: ShiftRequirement[],
    users: UserProfile[],
    transportLimits: { maxScooter: number }
  ): Promise<ScheduleShift[]> {
    let schedule = [...initialSchedule]
    let improvementsMade = 0
    
    // Raggruppa turni per (dayOfWeek, shiftType)
    const turns = new Set<string>()
    schedule.forEach(shift => {
      turns.add(`${shift.dayOfWeek}_${shift.shiftType}`)
    })
    
    // Per ogni turno, cerca miglioramenti
    for (const turnKey of Array.from(turns)) {
      const [dayOfWeek, shiftType] = turnKey.split('_')
      const day = parseInt(dayOfWeek)
      const shift = shiftType as ShiftType
      
      console.log(`\n   🔍 ${this.getDayName(day)} ${shift}:`)
      
      // Calcola stato attuale del turno
      const turnGaps = this.calculateTurnGaps(schedule, requirements, day, shift)
      const turnShifts = schedule.filter(s => s.dayOfWeek === day && s.shiftType === shift)
      
      // DEBUG: Mostra tutti i gap
      const gapDebug = Object.entries(turnGaps)
        .filter(([_, info]) => info.required > 0)
        .map(([role, info]) => `${role}:${info.assigned}/${info.required}`)
        .join(', ')
      console.log(`      📊 Gap turno: ${gapDebug || 'nessuno'}`)
      
      // Identifica ruoli con problemi
      const overStaffed: Role[] = []
      const underStaffed: Role[] = []
      
      Object.entries(turnGaps).forEach(([role, info]) => {
        if (info.required > 0) {
          if (info.assigned > info.required) {
            overStaffed.push(role as Role)
            console.log(`         → ${role} SOVRA-COPERTO: ${info.assigned} > ${info.required}`)
          } else if (info.assigned < info.required) {
            underStaffed.push(role as Role)
            console.log(`         → ${role} SOTTO-COPERTO: ${info.assigned} < ${info.required}`)
          }
        }
      })
      
      if (overStaffed.length === 0 && underStaffed.length === 0) {
        console.log(`      ✅ Turno già ottimale`)
        continue
      }
      
      // STRATEGIA 1: Swap da ruoli sovra-coperti a sotto-coperti
      for (const fromRole of overStaffed) {
        for (const toRole of underStaffed) {
          // Trova persone nel ruolo sovra-coperto che possono fare il ruolo sotto-coperto
          const shiftsInOverStaffed = turnShifts.filter(s => s.role === fromRole)
          
          for (const shiftToMove of shiftsInOverStaffed) {
            const userProfile = users.find(u => u.id === shiftToMove.userId)
            if (!userProfile) continue
            
            // Verifica se l'utente ha il ruolo necessario
            if (!userProfile.roles.includes(toRole)) continue
            
            // Verifica se è disponibile (dovrebbe già esserlo, ma controlliamo)
            const availability = userProfile.availabilities.find(av =>
              av.dayOfWeek === day && av.shiftType === shift
            )
            if (!availability?.isAvailable) continue
            
            // Verifica limite scooter se cambio comporta fattorini
            let canSwap = true
            if (toRole === 'FATTORINO' && userProfile.primaryTransport === 'SCOOTER') {
              // Esclude temporaneamente questo turno per il check
              const scheduleWithoutCurrent = schedule.filter(s => 
                !(s.userId === shiftToMove.userId && s.dayOfWeek === day && s.shiftType === shift)
              )
              canSwap = await this.checkScooterLimit(
                userProfile,
                scheduleWithoutCurrent,
                day,
                shift,
                transportLimits.maxScooter
              )
              
              if (!canSwap) {
                // Controlla se ha mezzi alternativi (AUTO)
                const hasAlternativeTransport = userProfile.transports.some(t => t !== 'SCOOTER')
                
                if (hasAlternativeTransport) {
                  canSwap = true // Può fare lo swap usando AUTO
                  console.log(`      🚗 ${userProfile.username}: usa AUTO per swap (limite scooter raggiunto)`)
                }
              }
            }
            
            if (!canSwap) {
              console.log(`      ⛔ ${userProfile.username}: limite scooter raggiunto, no alternative`)
              continue
            }
            
            // SWAP! Trova l'indice nello schedule e modifica il ruolo
            const shiftIndex = schedule.findIndex(s => 
              s.userId === shiftToMove.userId && 
              s.dayOfWeek === day && 
              s.shiftType === shift &&
              s.role === fromRole
            )
            
            if (shiftIndex !== -1) {
              const oldRole = schedule[shiftIndex].role
              schedule[shiftIndex].role = toRole
              
              console.log(`      🔄 SWAP: ${userProfile.username} ${oldRole} → ${toRole}`)
              improvementsMade++
              
              // Ricalcola gaps e esci dal loop interno se il ruolo è ora coperto
              const newTurnGaps = this.calculateTurnGaps(schedule, requirements, day, shift)
              if (newTurnGaps[toRole].assigned >= newTurnGaps[toRole].required) {
                break
              }
            }
          }
        }
      }
      
      // STRATEGIA 2: Tentativo di aggiungere persone ai ruoli sotto-coperti
      // Cerca persone disponibili che non sono state assegnate a questo turno
      if (underStaffed.length > 0) {
        console.log(`\n      🔎 Tentativo di aggiungere persone ai ruoli mancanti...`)
        
        for (const toRole of underStaffed) {
          const currentGap = turnGaps[toRole].gap
          if (currentGap === 0) continue // Già coperto da STRATEGIA 1
          
          // Trova utenti che:
          // 1. Hanno il ruolo necessario
          // 2. Sono disponibili per questo turno
          // 3. Non sono ancora assegnati a questo turno
          // 4. Rispettano i vincoli (scooter, riposo, ecc.)
          
          const assignedUserIds = turnShifts.map(s => s.userId)
          const availableUsers = users.filter(u => {
            // Ha il ruolo?
            if (!u.roles.includes(toRole)) return false
            
            // È disponibile?
            const availability = u.availabilities.find(av =>
              av.dayOfWeek === day && av.shiftType === shift
            )
            if (!availability?.isAvailable) return false
            
            // Non è già assegnato a questo turno?
            if (assignedUserIds.includes(u.id)) return false
            
            return true
          })
          
          // Ordina per carico di lavoro (chi ha meno turni)
          const sortedUsers = availableUsers.sort((a, b) => {
            const aShifts = schedule.filter(s => s.userId === a.id).length
            const bShifts = schedule.filter(s => s.userId === b.id).length
            return aShifts - bShifts
          })
          
          // Prova ad aggiungere le persone necessarie
          let added = 0
          for (const user of sortedUsers) {
            if (added >= currentGap) break
            
            // Verifica vincolo scooter se necessario
            if (toRole === 'FATTORINO' && user.primaryTransport === 'SCOOTER') {
              const canAdd = await this.checkScooterLimit(
                user,
                schedule,
                day,
                shift,
                transportLimits.maxScooter
              )
              
              if (!canAdd) {
                // Controlla se ha mezzi alternativi (AUTO)
                const hasAlternativeTransport = user.transports.some(t => t !== 'SCOOTER')
                
                if (!hasAlternativeTransport) {
                  console.log(`         ⛔ ${user.username}: limite scooter raggiunto, no alternative`)
                  continue
                }
                // Ha alternative, può essere assegnato con AUTO
                console.log(`         🚗 ${user.username}: usa AUTO (limite scooter raggiunto)`)
              }
            }
            
            // Verifica vincolo riposo (solo in modalità strict, qui lo saltiamo in post-ottimizzazione)
            // L'obiettivo è massimizzare la copertura
            
            // Ottieni orario ottimale
            const startTime = await this.getOptimalStartTime(
              shift,
              toRole,
              day,
              new Map(), // Non serve per la post-ottimizzazione
              user.username
            )
            
            // Aggiungi il turno!
            const newShift: ScheduleShift = {
              userId: user.id,
              dayOfWeek: day,
              shiftType: shift,
              role: toRole,
              startTime,
              endTime: shift === 'PRANZO' ? '14:00' : '22:00', // Default
              priority: 100, // Post-ottimizzazione priority
              score: 100 // Post-ottimizzazione score
            }
            
            schedule.push(newShift)
            turnShifts.push(newShift)
            assignedUserIds.push(user.id)
            improvementsMade++
            added++
            
            console.log(`      ➕ AGGIUNTO: ${user.username} → ${toRole}`)
          }
          
          if (added > 0) {
            console.log(`         ✅ Aggiunti ${added}/${currentGap} per ${toRole}`)
          } else if (currentGap > 0) {
            console.log(`         ⚠️  Impossibile coprire ${toRole} (gap: ${currentGap})`)
          }
        }
      }
    }
    
    if (improvementsMade > 0) {
      console.log(`\n   ✅ Post-ottimizzazione completata: ${improvementsMade} miglioramenti`)
    } else {
      console.log(`\n   ℹ️  Nessun miglioramento trovato, piano già ottimale`)
    }
    
    return schedule
  }

  /**
   * Assegnamento intelligente dei turni
   */
  private async intelligentAssignment(
    users: UserProfile[], 
    requirements: ShiftRequirement[], 
    existingShifts: ScheduleShift[],
    transportLimits: { maxScooter: number },
    mode: 'vip' | 'primary' | 'secondary' | 'flexible',
    roleScarcity: Record<Role, { demand: number; supply: number; scarcityScore: number }>
  ): Promise<ScheduleShift[]> {
    const schedule: ScheduleShift[] = [...existingShifts]
    const assignedStartTimes = new Map<string, number>()

    // Inizializza contatori orari
    existingShifts.forEach(shift => {
      const key = `${shift.dayOfWeek}_${shift.shiftType}_${shift.role}_${shift.startTime}`
      assignedStartTimes.set(key, (assignedStartTimes.get(key) || 0) + 1)
    })

    // Per ogni requisito
    for (const req of requirements) {
      const assignedCount = schedule.filter(s => 
        s.dayOfWeek === req.dayOfWeek && 
        s.shiftType === req.shiftType && 
        s.role === req.role
      ).length

      const needed = req.requiredStaff - assignedCount
      if (needed <= 0) continue

      console.log(`\n   📋 ${this.getDayName(req.dayOfWeek)} ${req.shiftType} ${req.role}: cerco ${needed} persone`)

      // 🎯 CALCOLA GAP ATTUALI per questo turno (per ottimizzazione globale)
      const currentGaps = this.calculateTurnGaps(schedule, requirements, req.dayOfWeek, req.shiftType)
      
      // Log gap status per questo turno
      const gapSummary = Object.entries(currentGaps)
        .filter(([_, info]) => info.required > 0)
        .map(([role, info]) => `${role}: ${info.assigned}/${info.required}`)
        .join(', ')
      if (gapSummary) {
        console.log(`      📊 Gap turno: ${gapSummary}`)
      }

      // Trova e ordina candidati per score (con context dei gap e scarsità ruoli)
      // Il controllo del limite scooter è già integrato nella funzione
      const candidates = await this.findCandidatesWithScore(users, req, schedule, mode, roleScarcity, transportLimits, currentGaps)
      
      if (candidates.length === 0) {
        console.log(`      ❌ Nessun candidato disponibile`)
        continue
      }

      console.log(`      ✅ ${candidates.length} candidati trovati`)
      if (candidates.length <= 5) {
        candidates.forEach((c, idx) => {
          if (idx < 5) {  // Mostra top 5
            console.log(`         ${idx + 1}. ${c.user.username} (score: ${c.score.toFixed(1)}) - ${c.reason}`)
          }
        })
      } else {
        // Mostra i top 3 e l'ultimo
        candidates.slice(0, 3).forEach((c, idx) => {
          console.log(`         ${idx + 1}. ${c.user.username} (score: ${c.score.toFixed(1)}) - ${c.reason}`)
        })
        console.log(`         ... altri ${candidates.length - 3} candidati`)
      }

      // Assegna i migliori candidati
      let assignedCount2 = 0
      for (const candidate of candidates) {
        if (assignedCount2 >= needed) break
        
        // Ottieni orario ottimale (con supporto orari personalizzati)
        const startTime = await this.getOptimalStartTime(
          req.shiftType,
          req.role, 
          req.dayOfWeek, 
          assignedStartTimes,
          candidate.user.username
        )
        const { end } = this.getGlobalShiftTimes(req.shiftType)
        
        // Crea turno
        const newShift: ScheduleShift = {
          userId: candidate.user.id,
          dayOfWeek: req.dayOfWeek,
          shiftType: req.shiftType,
          role: req.role,
          startTime,
          endTime: end,
          priority: req.priority,
          score: candidate.score
        }

        schedule.push(newShift)
        assignedCount2++
        
        // Aggiorna contatore orari
        const key = `${req.dayOfWeek}_${req.shiftType}_${req.role}_${startTime}`
        assignedStartTimes.set(key, (assignedStartTimes.get(key) || 0) + 1)
        
        console.log(`      ✅ ${candidate.user.username} → ${startTime}-${end} (${candidate.reason})`)
      }

      if (assignedCount2 < needed) {
        console.log(`      ⚠️  Assegnati ${assignedCount2}/${needed}`)
      }
    }

    return schedule
  }

  /**
   * Calcola i gap attuali per un turno specifico (stesso giorno + shiftType)
   */
  private calculateTurnGaps(
    schedule: ScheduleShift[], 
    requirements: ShiftRequirement[], 
    dayOfWeek: number, 
    shiftType: ShiftType
  ): Record<Role, { required: number; assigned: number; gap: number }> {
    const gaps: Record<Role, { required: number; assigned: number; gap: number }> = {
      PIZZAIOLO: { required: 0, assigned: 0, gap: 0 },
      CUCINA: { required: 0, assigned: 0, gap: 0 },
      FATTORINO: { required: 0, assigned: 0, gap: 0 },
      SALA: { required: 0, assigned: 0, gap: 0 },
      ADMIN: { required: 0, assigned: 0, gap: 0 }
    }

    // Calcola required per ogni ruolo in questo turno
    requirements.forEach(req => {
      if (req.dayOfWeek === dayOfWeek && req.shiftType === shiftType) {
        gaps[req.role].required = req.requiredStaff
      }
    })

    // Calcola assigned per ogni ruolo in questo turno
    schedule.forEach(shift => {
      if (shift.dayOfWeek === dayOfWeek && shift.shiftType === shiftType) {
        gaps[shift.role].assigned++
      }
    })

    // Calcola gap
    Object.keys(gaps).forEach(role => {
      const r = role as Role
      gaps[r].gap = Math.max(0, gaps[r].required - gaps[r].assigned)
    })

    return gaps
  }

  /**
   * Trova candidati con score ponderato
   * 
   * REGOLE FONDAMENTALI:
   * 1. Un dipendente DEVE essere disponibile per essere assegnato
   * 2. Un dipendente può lavorare sia PRANZO che CENA nello stesso giorno
   * 3. Un dipendente NON può fare 2 ruoli nello stesso turno (stesso giorno + stesso shiftType)
   * 4. I fattorini con scooter devono rispettare il limite scooter del turno
   */
  private async findCandidatesWithScore(
    users: UserProfile[], 
    requirement: ShiftRequirement,
    currentSchedule: ScheduleShift[],
    mode: 'vip' | 'primary' | 'secondary' | 'flexible',
    roleScarcity: Record<Role, { demand: number; supply: number; scarcityScore: number }>,
    transportLimits: { maxScooter: number },
    turnGaps?: Record<Role, { required: number; assigned: number; gap: number }>
  ): Promise<CandidateScore[]> {
    
    const candidates: CandidateScore[] = []

    for (const user of users) {
      // MODE VIP: Solo utenti prioritari (valentino, mario, alessio)
      if (mode === 'vip' && !this.isPriorityUser(user.username)) continue

      // VINCOLO 1: Deve avere il ruolo richiesto
      const hasRole = user.roles.includes(requirement.role)
      if (!hasRole) continue

      // VINCOLO 2 (mode-specific): Ruolo primario vs secondario
      const isPrimaryRole = user.primaryRole === requirement.role
      if (mode === 'primary' && !isPrimaryRole) continue
      if (mode === 'secondary' && isPrimaryRole) continue
      // mode 'vip' e 'flexible' accettano entrambi

      // ⚠️ VINCOLO 3 FONDAMENTALE: Deve essere disponibile per questo turno
      // Questo vincolo è SEMPRE rispettato in TUTTE le fasi!
      // Un dipendente può essere assegnato SOLO dove ha dichiarato disponibilità
        const availability = user.availabilities.find(av => 
          av.dayOfWeek === requirement.dayOfWeek && 
          av.shiftType === requirement.shiftType
        )
      if (!availability?.isAvailable) continue

      // VINCOLO 4: Non può fare DUE RUOLI nello stesso turno
      // ✅ OK: PRANZO come SALA + CENA come CUCINA (turni diversi, stesso giorno)
      // ❌ NO: PRANZO come SALA + PRANZO come CUCINA (stesso turno, stesso giorno)
      // Verifica: stesso giorno (dayOfWeek) E stesso tipo turno (shiftType)
        const alreadyAssignedThisShift = currentSchedule.some(shift => 
          shift.userId === user.id && 
          shift.dayOfWeek === requirement.dayOfWeek && 
          shift.shiftType === requirement.shiftType
        )
      if (alreadyAssignedThisShift) continue

      // VINCOLO 4.5: 🛵 Limite scooter per fattorini
      // Se il ruolo è FATTORINO e l'utente usa SCOOTER come mezzo primario
      let usesAlternativeTransport = false
      if (requirement.role === 'FATTORINO' && user.primaryTransport === 'SCOOTER') {
        const canAssignScooter = await this.checkScooterLimit(
          user,
          currentSchedule,
          requirement.dayOfWeek,
          requirement.shiftType,
          transportLimits.maxScooter
        )
        
        // Se il limite scooter è raggiunto, controlla se ha mezzi alternativi
        if (!canAssignScooter) {
          // Verifica se ha AUTO o altri mezzi disponibili
          const hasAlternativeTransport = user.transports.some(t => t !== 'SCOOTER')
          
          if (!hasAlternativeTransport) {
            // Non ha alternative, deve essere skippato
            continue
          }
          // Ha alternative (AUTO/BICI), può essere assegnato comunque!
          // (In questo caso userà l'auto invece dello scooter)
          usesAlternativeTransport = true
        }
      }

      // VINCOLO 5 (mode-specific): Riposo tra turni consecutivi
      // VIP e flexible ignorano questo vincolo per massimizzare copertura
      if (mode !== 'vip' && mode !== 'flexible') {
        // Se è pranzo, non deve aver fatto cena la sera prima
          if (requirement.shiftType === 'PRANZO') {
          const prevDay = (requirement.dayOfWeek - 1 + 7) % 7
            const workedPrevEvening = currentSchedule.some(shift => 
              shift.userId === user.id && 
            shift.dayOfWeek === prevDay && 
              shift.shiftType === 'CENA'
            )
          if (workedPrevEvening) continue
          }
          
        // Se è cena, non deve fare pranzo il giorno dopo
          if (requirement.shiftType === 'CENA') {
          const nextDay = (requirement.dayOfWeek + 1) % 7
            const worksNextMorning = currentSchedule.some(shift => 
              shift.userId === user.id && 
            shift.dayOfWeek === nextDay && 
              shift.shiftType === 'PRANZO'
            )
          if (worksNextMorning) continue
          }
        }
        
      // CALCOLO SCORE INTELLIGENTE
        let score = 100
      let reasonParts: string[] = []

      // ⭐ BONUS MASSIMO per utenti prioritari (valentino, mario, alessio)
      if (this.isPriorityUser(user.username)) {
        score += 500
        reasonParts.push('🌟 PRIORITARIO')

        // 🎯 BONUS EXTRA per ruolo preferito (valentino→PIZZAIOLO, mario→CUCINA)
        const preferredRole = this.VIP_ROLE_PREFERENCES[user.username]
        if (preferredRole && requirement.role === preferredRole) {
          score += 150
          reasonParts.push('🎯 RUOLO-PREFERITO')
        }

        // 🤝 COORDINAMENTO VIP: Verifica se l'altro VIP è già nel turno
        // Se valentino e mario lavorano insieme, ottimizza la distribuzione
        if (user.username === 'valentino.dipietro' || user.username === 'mario.dipietro') {
          const otherVip = user.username === 'valentino.dipietro' ? 'mario.dipietro' : 'valentino.dipietro'
          
          // Cerca tutti i turni dello stesso giorno/shiftType e trova l'altro VIP
          const turnShifts = currentSchedule.filter(s => 
            s.dayOfWeek === requirement.dayOfWeek &&
            s.shiftType === requirement.shiftType
          )

          // Trova se l'altro VIP è già in questo turno
          for (const shift of turnShifts) {
            const shiftUser = users.find(u => u.id === shift.userId)
            if (shiftUser && shiftUser.username === otherVip) {
              const otherRole = shift.role
              
              // Scenario: l'altro VIP è già nel turno con otherRole
              // Vogliamo: valentino=PIZZAIOLO, mario=CUCINA
              
              if (user.username === 'valentino.dipietro') {
                if (requirement.role === 'PIZZAIOLO' && otherRole === 'CUCINA') {
                  // ✅ PERFETTO: valentino→PIZZAIOLO, mario→CUCINA
                  score += 100
                  reasonParts.push('🤝 SYNC-PERFETTO')
                } else if (requirement.role === 'CUCINA' && otherRole === 'PIZZAIOLO') {
                  // ⚠️ SUBOTTIMALE: valentino→CUCINA, mario→PIZZAIOLO
                  score -= 50
                  reasonParts.push('⚠️ sync-subottimale')
                }
              } else if (user.username === 'mario.dipietro') {
                if (requirement.role === 'CUCINA' && otherRole === 'PIZZAIOLO') {
                  // ✅ PERFETTO: valentino→PIZZAIOLO, mario→CUCINA
                  score += 100
                  reasonParts.push('🤝 SYNC-PERFETTO')
                } else if (requirement.role === 'PIZZAIOLO' && otherRole === 'CUCINA') {
                  // ⚠️ SUBOTTIMALE: mario→PIZZAIOLO, valentino→CUCINA
                  score -= 50
                  reasonParts.push('⚠️ sync-subottimale')
                }
              }
              break // Trovato l'altro VIP, esci dal loop
            }
          }
        }
      }

      // 🎯 NUOVO: Bonus per scarsità del ruolo
      // Se il ruolo è scarso, è più prezioso assegnare persone che lo hanno
      const scarcity = roleScarcity[requirement.role].scarcityScore
      if (scarcity > 1.5) {
        // Ruolo CRITICO: forte bonus
        score += isPrimaryRole ? 100 : 60
        reasonParts.push(`🔴CRITICO(${scarcity.toFixed(1)})`)
      } else if (scarcity > 1.0) {
        // Ruolo SCARSO: medio bonus
        score += isPrimaryRole ? 60 : 35
        reasonParts.push(`🟡SCARSO(${scarcity.toFixed(1)})`)
        } else {
        // Ruolo OK: bonus standard
        score += isPrimaryRole ? 50 : 20
        reasonParts.push(isPrimaryRole ? 'primario' : 'secondario')
      }

      // 🧠 NUOVO: Bonus versatilità intelligente
      // Se una persona ha molti ruoli, può essere più preziosa per colmare gap diversi
      const versatilityCount = user.roles.length
      if (versatilityCount >= 3 && !isPrimaryRole) {
        // Persona versatile con ruolo secondario: bonus per flessibilità
        score += 15
        reasonParts.push(`versatile(${versatilityCount})`)
      }

      // 🎲 NUOVO: Bonus per gap critici nel turno
      if (turnGaps) {
        const totalGap = Object.values(turnGaps).reduce((sum, g) => sum + g.gap, 0)
        if (totalGap >= 3) {
          // Turno molto scoperto: aumenta priorità
          score += 20
          reasonParts.push(`gap-critico(${totalGap})`)
        }
      }

      // Conta turni già assegnati
      const userShiftsCount = currentSchedule.filter(s => s.userId === user.id).length

      // Bonus per distribuzione equa (chi ha meno turni)
      if (userShiftsCount === 0) {
        score += 30
        reasonParts.push('primo turno')
      } else if (userShiftsCount <= 2) {
        score += 20
        reasonParts.push('pochi turni')
      } else if (userShiftsCount >= 5) {
        score -= 20
        reasonParts.push('molti turni')
      }

      // Penalità proporzionale al carico (ridotta per utenti prioritari)
      if (this.isPriorityUser(user.username)) {
        score -= userShiftsCount * 1  // Penalità minima per prioritari
        } else {
        score -= userShiftsCount * 3  // Penalità normale per altri
      }

      // 🎯 OTTIMIZZAZIONE GLOBALE: Considera i gap di altri ruoli
      if (turnGaps && mode !== 'vip') {
        const currentRoleGap = turnGaps[requirement.role]
        
        // 🔴 PENALITÀ PESANTE: Se il ruolo è già coperto o sovra-coperto
        if (currentRoleGap.assigned >= currentRoleGap.required) {
          score -= 200
          reasonParts.push('ruolo già coperto')
        }

        // 🟢 BONUS: Se l'utente ha altri ruoli con gap maggiori, consideralo
        // Questo favorisce persone versatili nei ruoli più necessari
        let hasMoreNeededRole = false
        let maxGapInOtherRoles = 0
        
        user.roles.forEach(userRole => {
          if (userRole !== requirement.role && turnGaps[userRole]) {
            const otherRoleGap = turnGaps[userRole].gap
            if (otherRoleGap > maxGapInOtherRoles) {
              maxGapInOtherRoles = otherRoleGap
            }
            if (otherRoleGap > currentRoleGap.gap) {
              hasMoreNeededRole = true
            }
          }
        })

        // Se ha un ruolo con gap maggiore, penalizza (dovrebbe fare quell'altro ruolo)
        if (hasMoreNeededRole) {
          score -= 150
          reasonParts.push('più utile altrove')
        }
        
        // Bonus proporzionale al gap del ruolo richiesto
        score += currentRoleGap.gap * 30
        if (currentRoleGap.gap > 0) {
          reasonParts.push(`gap: ${currentRoleGap.gap}`)
        }
      }

      // 🚗 Nota se usa mezzo alternativo (AUTO invece di SCOOTER)
      if (usesAlternativeTransport) {
        reasonParts.push('🚗 usa AUTO')
      }

      candidates.push({
        user,
        score,
        reason: reasonParts.join(', ')
      })
    }

    // Ordina per score decrescente
    return candidates.sort((a, b) => b.score - a.score)
  }

  /**
   * Carica profili utenti con disponibilità filtrate per la settimana
   */
  private async loadUserProfiles(weekStart: Date): Promise<UserProfile[]> {
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)
    
    const users = await prisma.user.findMany({
      where: { isActive: true },
      include: {
        user_roles: true,
        user_transports: true,
        availabilities: {
          where: { weekStart }
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
      .filter(user => user.primaryRole !== null) // Exclude users without primary role
      .map(user => {
        // Filtra disponibilità escludendo giorni in assenza
        const absences = user.absences || []
        const filteredAvailabilities = user.availabilities.filter(av => {
          const dayDate = new Date(weekStart)
          dayDate.setDate(weekStart.getDate() + av.dayOfWeek)
          dayDate.setHours(12, 0, 0, 0)

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
          primaryRole: user.primaryRole as Role, // Safe because we filtered null above
          roles: user.user_roles.map(ur => ur.role),
          primaryTransport: user.primaryTransport,
          transports: user.user_transports.map(ut => ut.transport),
          availabilities: filteredAvailabilities
        }
      })
  }

  /**
   * Carica requisiti turni dal database
   */
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

  /**
   * Carica turni già esistenti per la settimana
   */
  private async loadExistingShifts(weekStart: Date): Promise<ScheduleShift[]> {
    const schedule = await prisma.schedules.findUnique({
      where: { weekStart },
      include: { shifts: true }
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

  /**
   * Ordina requisiti per priorità
   */
  private prioritizeRequirements(requirements: ShiftRequirement[]): ShiftRequirement[] {
    return requirements.sort((a, b) => {
      // 1. Priorità configurata
      if (b.priority !== a.priority) return b.priority - a.priority
      
      // 2. Turni più grandi per primi
      if (b.requiredStaff !== a.requiredStaff) return b.requiredStaff - a.requiredStaff
      
      // 3. Weekend prima
      const aIsWeekend = a.dayOfWeek >= 4 ? 1 : 0
      const bIsWeekend = b.dayOfWeek >= 4 ? 1 : 0
      if (bIsWeekend !== aIsWeekend) return bIsWeekend - aIsWeekend
      
      // 4. Ordina per giorno
      return a.dayOfWeek - b.dayOfWeek
    })
  }

  /**
   * Trova gap tra turni assegnati e requisiti
   */
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

  /**
   * Converte gap in requisiti
   */
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

  /**
   * Calcola statistiche finali
   */
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

    schedule.forEach(shift => {
      rolesAssigned[shift.role]++
      userWorkload[shift.userId] = (userWorkload[shift.userId] || 0) + 1
    })

    const gaps = this.findGaps(schedule, requirements)
    
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

  /**
   * Ottiene il nome del giorno
   */
  private getDayName(dayOfWeek: number): string {
    const days = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']
    return days[dayOfWeek] || 'Unknown'
  }
}
