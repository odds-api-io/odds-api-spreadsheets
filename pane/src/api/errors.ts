export type ApiErrorKind = 'auth' | 'plan' | 'rate' | 'notfound' | 'bad_request' | 'network' | 'server'

export class ApiError extends Error {
  constructor(
    public kind: ApiErrorKind,
    public status: number,
    public detail: string,
  ) {
    super(detail)
  }
}

export const kindForStatus = (s: number): ApiErrorKind =>
  s === 401 ? 'auth' : s === 403 ? 'plan' : s === 429 ? 'rate' : s === 404 ? 'notfound' : s >= 500 ? 'server' : 'bad_request'
