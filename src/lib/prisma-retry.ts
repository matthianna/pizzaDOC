/**
 * Retry transient Neon/Prisma connectivity failures (cold start, brief network blips).
 */
function isRetryableDbError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const err = error as { code?: string; message?: string; name?: string }
  if (err.code === 'P1001' || err.code === 'P1017' || err.code === 'P2024') return true
  const msg = String(err.message || '')
  return (
    msg.includes("Can't reach database server") ||
    msg.includes('Connection terminated') ||
    msg.includes('Server has closed the connection') ||
    msg.includes('Timed out fetching a new connection') ||
    err.name === 'PrismaClientInitializationError'
  )
}

export async function withPrismaRetry<T>(
  operation: () => Promise<T>,
  options: { retries?: number; delayMs?: number } = {}
): Promise<T> {
  const retries = options.retries ?? 3
  const delayMs = options.delayMs ?? 400
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await operation()
    } catch (error: unknown) {
      lastError = error
      if (!isRetryableDbError(error) || attempt === retries) {
        throw error
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)))
    }
  }

  throw lastError
}
