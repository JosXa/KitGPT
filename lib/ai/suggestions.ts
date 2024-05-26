import { generateObject } from "ai"
import { z } from "zod"
import { NUM_SUGGESTIONS } from "../settings"
import { currentSuggestions, messages, model, systemPrompt } from "../store"

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

messages.$length!.subscribe(() => (currentSuggestions.value = undefined))

export async function getSuggestions({
  includeSystemPromptInContext = false,
  contextLookbackMessages = 4,
}: { includeSystemPromptInContext?: boolean; contextLookbackMessages?: number } = {}) {
  const context = messages.slice(-contextLookbackMessages)
  context.push({
    role: "system",
    content: `Please list ${NUM_SUGGESTIONS} possible follow-up questions I could ask about this. Also give me a good question to ask if I'm looking for more examples`,
  })

  const { object } = await generateObject({
    model: model.value!,
    schema: followupQuestionsSchema,
    messages: context,
    system: includeSystemPromptInContext ? systemPrompt.value : undefined,
  })

  currentSuggestions.value = object
}
