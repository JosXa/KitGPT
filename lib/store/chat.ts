import { signal } from "@preact/signals-core"
import type { FollowupQuestions } from "../ai/suggestions"

export const currentSuggestions = signal<FollowupQuestions | undefined>(undefined)
