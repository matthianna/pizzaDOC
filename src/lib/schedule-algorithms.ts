export type ScheduleAlgorithmId = 'classic' | 'improved'

export const SCHEDULE_ALGORITHM_IDS: ScheduleAlgorithmId[] = ['classic', 'improved']

export function isScheduleAlgorithmId(value: unknown): value is ScheduleAlgorithmId {
  return value === 'classic' || value === 'improved'
}

export function getScheduleAlgorithmLabel(id: ScheduleAlgorithmId): string {
  return id === 'classic' ? 'Classico' : 'Migliorato'
}
