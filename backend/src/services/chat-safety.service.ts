export class ChatSafetyError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'ChatSafetyError';
  }
}

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const CONTACT_WORD_PATTERN = /\b(whats\s*app|whatsapp|call\s+me|phone\s+me|text\s+me|sms\s+me|email\s+me|e-?mail\s+me|contact\s+me|dm\s+me|telegram)\b/i;

const hasLikelyPhoneNumber = (text: string): boolean => {
  const candidates = text.match(/(?:\+?\d[\s().-]*){7,}\d/g) || [];
  return candidates.some((candidate) => candidate.replace(/\D/g, '').length >= 8);
};

export const assertChatTextIsSafe = (text: string): void => {
  const value = text.trim();
  if (!value) return;

  if (EMAIL_PATTERN.test(value) || hasLikelyPhoneNumber(value) || CONTACT_WORD_PATTERN.test(value)) {
    throw new ChatSafetyError(
      'For your safety, please keep all communication inside Padi chat. Phone numbers, email addresses and private contact details cannot be sent here.',
      'PRIVATE_CONTACT_BLOCKED'
    );
  }
};
