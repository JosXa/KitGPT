export default class SubmitLinkEncoder {
  constructor(
    public action: string,
    public params: Map<string, string> = new Map(),
  ) {}

  public setParam(name: string, value: any) {
    this.params.set(name, String(value))
  }

  public encode(): string {
    let encodedString = ""
    this.params.forEach((value, key) => {
      if (encodedString.length > 0) {
        encodedString += "__"
      }
      encodedString += `${key}=${encodeURIComponent(value)}`
    })
    return encodedString
  }

  public static decode(encodedString: string): SubmitLinkEncoder {
    const parts = encodedString.split("__")
    const action = parts.shift() || ""
    const params = new Map<string, string>()
    parts.forEach((pair) => {
      const [key, value] = pair.split("=")
      if (key && value) {
        params.set(key, decodeURIComponent(value))
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
