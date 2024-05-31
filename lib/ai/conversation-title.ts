import { generateObject } from "ai"
import { z } from "zod"
import { currentConversationTitle } from "../store/conversations"
import { messages } from "../store/messages"
import { currentModel } from "../store/settings"
import { truncate } from "../utils/string-utils"

const conversationTitleSchema = z.object({
  conversationTitle: z.string(),
})

export async function generateNewTitleForConversation() {
  const context = [...messages]
  context.push({
    role: "system",
    content: "Please provide a short, descriptive name for this entire conversation. Less than 60 characters is ideal.",
  })

  try {
    const { object } = await generateObject({
      model: currentModel.value!,
      schema: conversationTitleSchema,
      messages: context,
    })

    currentConversationTitle.value = truncate(object.conversationTitle, 70)
  } catch (err) {
    warn(new Error("Unable to generate title for conversation", { cause: err }))
  }
}
