// Name: Chat Bug
import "@johnlindquist/kit"

await chat({
  onSubmit: () => {
    setTimeout(async () => {
      await chat.setMessages?.([{ title: "user", text: "This will be white", position: "right" }])
    }, 1000)
  },
})
