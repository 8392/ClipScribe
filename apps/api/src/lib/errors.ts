import type { ApiErrorResponse, ErrorCode } from '@clipscribe/shared'

export class AppError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: ErrorCode,
  ) {
    super(message)
    this.name = 'AppError'
  }

  toJSON(): ApiErrorResponse {
    return { error: this.message, code: this.code }
  }
}

export function jsonError(error: unknown): Response {
  if (error instanceof AppError) {
    return Response.json(error.toJSON(), { status: error.status })
  }
  console.error(error)
  return Response.json(
    { error: 'Internal server error', code: 'INTERNAL_ERROR' } satisfies ApiErrorResponse,
    { status: 500 },
  )
}
