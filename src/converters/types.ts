import type { Conversation } from '../model/conversation'

export interface Converter {
  id: string
  label: string
  convert: (conversation: Conversation) => string
}
