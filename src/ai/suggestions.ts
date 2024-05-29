import { generateObject } from "ai"
import { z } from "zod"
import { NUM_SUGGESTIONS } from "../settings"
import { currentSuggestions, messages } from "../store/chat"
import { currentModel } from "../store/settings"

const followupQuestionsSchema = z.object({
  moreExamplesQuestion: z.string(),
  followupQuestions: z.array(
    z.object({
      question: z.string(),
      emoji: z.string(),
    }),
  ),
})

export type FollowupQuestions = z.infer<typeof followupQuestionsSchema>

messages.$length!.subscribe(() => {
  currentSuggestions.value = undefined
})

export async function getSuggestions({ contextLookbackMessages = 4 }: { contextLookbackMessages?: number } = {}) {
  const context = messages.slice(-contextLookbackMessages)
  context.unshift({
    role: "system",
    content: `For the following conversation, please list ${NUM_SUGGESTIONS} possible follow-up questions I could 
    ask. Also give me one good question to ask if I'm looking for more examples.
    Note: The questions should all be from the user's (my) perspective.`,
  })

  const lastMsg = context[context.length - 1]
  if (lastMsg && lastMsg.role === "assistant") {
    context.push({
      role: "user",
      content: `Please list ${NUM_SUGGESTIONS} possible follow-up questions I could ask about this. Also give me a good question to ask if I'm looking for more examples.`,
    })
  }

  try {
    const { object } = await generateObject({
      model: currentModel.value!,
      schema: followupQuestionsSchema,
      messages: context,
    })

    currentSuggestions.value = object
  } catch (err) {
    warn(`Unable to generate suggestions: ${err instanceof Error ? err.message : err}`)
  }
}
