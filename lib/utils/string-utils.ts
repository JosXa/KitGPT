export function titleCase(role: string): string {
  if (!role) {
    return ""
  }
  return role[0]!.toUpperCase() + role.slice(1)
}

export function truncate(str: string, n: number) {
  return str.length > n ? str.slice(0, n - 1) + "…" : str
}

export const primaryHighlight = (val: string) =>
  `<b style="color: rgba(var(--color-primary), var(--tw-text-opacity))">${val}</b>`
