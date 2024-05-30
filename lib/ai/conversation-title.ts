import { generateObject } from "ai"
import { z } from "zod"
import { messages } from "../store/chat"
import { currentConversationTitle } from "../store/conversations"
import { currentModel } from "../store/settings"
import { truncate } from "../utils/string-utils"

const conversationTitleSchema = z.object({
  conversationTitle: z.string(),
})

export async function generateNewTitleForConversation() {
  const context = [...messages]
  context.push({
    role: "system",
    content: "Please provide a short, descriptive name for this entire conversation",
  })

  try {
    const { object } = await generateObject({
      model: currentModel.value!,
      schema: conversationTitleSchema,
      messages: context,
    })

    currentConversationTitle.value = truncate(object.conversationTitle, 50)
  } catch (err) {
    warn(new Error("Unable to generate title for conversation", { cause: err }))
  }
}
