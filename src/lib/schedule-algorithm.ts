import { prisma } from './prisma'
import { Role, ShiftType } from '@prisma/client'

interface UserAvailability {
  id: string
  username: string
  primaryRole: Role
  roles: Role[]
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
  minStaff: number
  maxStaff: number
}

interface ScheduleShift {
  userId: string
  dayOfWeek: number
  shiftType: ShiftType
  role: Role
  startTime: string
  endTime: string
}

interface ScheduleResult {
  shifts: ScheduleShift[]
  gaps: {
    dayOfWeek: number
    shiftType: ShiftType
    role: Role
    required: number
    assigned: number
  }[]
}

export class ScheduleAlgorithm {
  private getShiftTimes(shiftType: ShiftType): { start: string; end: string } {
    return shiftType === 'PRANZO' 
      ? { start: '11:30', end: '14:00' }
      : { start: '18:00', end: '22:00' }
  }

  async generateSchedule(weekStart: Date): Promise<ScheduleResult> {
    // Fetch all active users with their roles and availabilities
    const users = await this.fetchUsersWithAvailabilities(weekStart)
    
    // Fetch shift requirements (limits)
    const requirements = await this.fetchShiftRequirements()
    
    // Generate schedule
    const result = this.assignShifts(users, requirements)
    
    return result
  }

  private async fetchUsersWithAvailabilities(weekStart: Date): Promise<UserAvailability[]> {
    const users = await prisma.user.findMany({
      where: {
        isActive: true
      },
      include: {
        userRoles: true,
        availabilities: {
          where: {
            weekStart,
            isAbsentWeek: false
          }
        }
      }
    })

    return users.map(user => ({
      id: user.id,
      username: user.username,
      primaryRole: user.primaryRole!,
      roles: user.userRoles.map(ur => ur.role),
      availabilities: user.availabilities
        .filter(a => a.isAvailable)
        .map(a => ({
          dayOfWeek: a.dayOfWeek,
          shiftType: a.shiftType,
          isAvailable: a.isAvailable
        }))
    }))
  }

  private async fetchShiftRequirements(): Promise<ShiftRequirement[]> {
    const limits = await prisma.shiftLimits.findMany()
    
    return limits.map(limit => ({
      dayOfWeek: limit.dayOfWeek,
      shiftType: limit.shiftType,
      role: limit.role,
      minStaff: limit.minStaff,
      maxStaff: limit.maxStaff
    }))
  }

  private assignShifts(users: UserAvailability[], requirements: ShiftRequirement[]): ScheduleResult {
    const shifts: ScheduleShift[] = []
    const gaps: ScheduleResult['gaps'] = []
    const userAssignments = new Map<string, Set<string>>() // userId -> set of "dayOfWeek-shiftType"
    const userShiftRoles = new Map<string, string>() // "userId-dayOfWeek-shiftType" -> assigned role

    // Initialize user assignment tracking
    users.forEach(user => {
      userAssignments.set(user.id, new Set())
    })

    // Group requirements by day and shift to assign one role per person per shift
    const shiftsToProcess = new Map<string, ShiftRequirement[]>()
    requirements.forEach(req => {
      const shiftKey = `${req.dayOfWeek}-${req.shiftType}`
      if (!shiftsToProcess.has(shiftKey)) {
        shiftsToProcess.set(shiftKey, [])
      }
      shiftsToProcess.get(shiftKey)!.push(req)
    })

    // Process each shift (day-shiftType combination)
    shiftsToProcess.forEach((shiftRequirements, shiftKey) => {
      const [dayOfWeek, shiftType] = shiftKey.split('-')
      const dayNum = parseInt(dayOfWeek)
      
      // Get all users available for this shift
      const availableUsers = users.filter(user => {
        const availability = user.availabilities.find(a => 
          a.dayOfWeek === dayNum && a.shiftType === shiftType
        )
        return availability?.isAvailable && 
               !userAssignments.get(user.id)?.has(shiftKey) &&
               user.roles.some(role => shiftRequirements.some(req => req.role === role))
      })

      // For each available user, determine their preferred role for this shift
      const usersWithPreferredRole = availableUsers.map(user => {
        // Find the user's primary role if it's needed for this shift
        const primaryRoleNeeded = shiftRequirements.find(req => req.role === user.primaryRole)
        
        if (primaryRoleNeeded) {
          return { user, preferredRole: user.primaryRole, isPrimary: true }
        }
        
        // Otherwise, pick the first available role they can do
        const availableRole = user.roles.find(role => 
          shiftRequirements.some(req => req.role === role)
        )
        
        return { user, preferredRole: availableRole!, isPrimary: false }
      }).filter(item => item.preferredRole) // Filter out users with no available roles

      // Sort users: primary role first, then by workload
      usersWithPreferredRole.sort((a, b) => {
        // Prefer users using their primary role
        if (a.isPrimary && !b.isPrimary) return -1
        if (!a.isPrimary && b.isPrimary) return 1
        
        // Then prefer users with fewer assignments
        const aAssignments = userAssignments.get(a.user.id)?.size || 0
        const bAssignments = userAssignments.get(b.user.id)?.size || 0
        return aAssignments - bAssignments
      })

      // Track assignments by role for this shift
      const roleAssignments = new Map<string, number>()
      shiftRequirements.forEach(req => {
        roleAssignments.set(req.role, 0)
      })

      const times = this.getShiftTimes(shiftType as ShiftType)

      // Assign users to their preferred roles
      for (const { user, preferredRole } of usersWithPreferredRole) {
        const requirement = shiftRequirements.find(req => req.role === preferredRole)
        const currentAssigned = roleAssignments.get(preferredRole) || 0
        
        // Check if we can assign this user to their preferred role
        if (requirement && currentAssigned < requirement.maxStaff) {
          const userShiftKey = `${user.id}-${shiftKey}`
          
          // Assign the user to this role
          shifts.push({
            userId: user.id,
            dayOfWeek: dayNum,
            shiftType: shiftType as any,
            role: preferredRole as any,
            startTime: times.start,
            endTime: times.end
          })

          userAssignments.get(user.id)?.add(shiftKey)
          roleAssignments.set(preferredRole, currentAssigned + 1)
          userShiftRoles.set(userShiftKey, preferredRole)
        }
      }

      // Check for gaps (minimum requirements not met)
      shiftRequirements.forEach(req => {
        const assigned = roleAssignments.get(req.role) || 0
        if (assigned < req.minStaff) {
          gaps.push({
            dayOfWeek: req.dayOfWeek,
            shiftType: req.shiftType,
            role: req.role,
            required: req.minStaff,
            assigned: assigned
          })
        }
      })
    })

    return { shifts, gaps }
  }

  private getAvailableUsers(
    users: UserAvailability[], 
    dayOfWeek: number, 
    shiftType: ShiftType, 
    role: Role
  ): UserAvailability[] {
    return users.filter(user => {
      // User must have the required role
      if (!user.roles.includes(role)) return false
      
      // User must be available for this day/shift
      return user.availabilities.some(a => 
        a.dayOfWeek === dayOfWeek && 
        a.shiftType === shiftType && 
        a.isAvailable
      )
    })
  }

  async saveSchedule(weekStart: Date, shifts: ScheduleShift[]): Promise<string> {
    // Delete existing schedule for this week
    const existingSchedule = await prisma.schedule.findUnique({
      where: { weekStart }
    })

    if (existingSchedule) {
      await prisma.shift.deleteMany({
        where: { scheduleId: existingSchedule.id }
      })
      await prisma.schedule.delete({
        where: { id: existingSchedule.id }
      })
    }

    // Create new schedule
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
            endTime: shift.endTime
          }))
        }
      }
    })

    return schedule.id
  }
}
