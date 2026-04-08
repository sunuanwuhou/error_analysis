export type CurrentUser = {
  id: string
  username: string
}

export type MeResponse =
  | {
      authenticated: false
    }
  | {
      authenticated: true
      user: CurrentUser
    }

export type RuntimeInfo = {
  mode: string
  label: string
  origin: string
}

export type PublicEntry = {
  origin: string
  tunnelUrl: string | null
}
