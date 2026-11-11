import catalogue from './endpoints.json'

export interface EndpointParam {
  name: string
  in: 'query' | 'path'
  required: boolean
  description: string
  example?: string
  enum?: string[]
}

export interface Endpoint {
  path: string
  title: string
  group: string
  params: EndpointParam[]
}

export const ENDPOINTS = catalogue as Endpoint[]

export function fillPath(path: string, values: Record<string, string>) {
  const query: Record<string, string> = {}
  let filled = path
  for (const [k, v] of Object.entries(values)) {
    if (filled.includes(`{${k}}`)) filled = filled.replace(`{${k}}`, encodeURIComponent(v))
    else query[k] = v
  }
  return { path: filled, query }
}
