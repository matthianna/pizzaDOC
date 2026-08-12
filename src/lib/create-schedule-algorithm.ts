import { MaxCoverageAlgorithmClassic } from './max-coverage-algorithm-classic'
import { MaxCoverageAlgorithmImproved } from './max-coverage-algorithm'
import type { ScheduleAlgorithmId } from './schedule-algorithms'

export function createScheduleAlgorithm(id: ScheduleAlgorithmId = 'improved') {
  if (id === 'classic') {
    return new MaxCoverageAlgorithmClassic()
  }
  return new MaxCoverageAlgorithmImproved()
}
