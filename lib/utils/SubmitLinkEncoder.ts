export default class SubmitLinkEncoder {
  params: { [key: string]: string }

  constructor(
    public action: string,
    params: { [key: string]: string } = {},
  ) {
    this.params = params
  }

  public encode(): string {
    let encodedString = ""
    for (const [key, value] of Object.entries(this.params)) {
      if (encodedString.length > 0) {
        encodedString += "__"
      }
      const encodedValue = btoa(value)
      encodedString += `${key}=${encodedValue}`
    }
    return encodedString
  }

  public static decode(encodedString: string): SubmitLinkEncoder {
    const parts = encodedString.split("__")
    const action = parts.shift() || ""
    const params: { [key: string]: string } = {}
    parts.forEach((pair) => {
      const [key, value] = pair.split("=")
      if (key && value) {
        params[key] = atob(value)
      }
    })
    return new SubmitLinkEncoder(action, params)
  }

  public static canDecode(encodedString: string): boolean {
    const parts = encodedString.split("__")
    if (parts.length < 2) {
      return false // Must have at least action and one key-value pair
    }
    const action = parts.shift()
    return parts.every((pair) => {
      const [key, value] = pair.split("=")
      return key !== undefined && value !== undefined
    })
  }

  public toMarkdownLink(text: string): string {
    const encodedParams = this.encode()
    return `[${text}](submit:${this.action}__${encodedParams})`
  }
}
