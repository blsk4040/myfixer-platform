"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertChatTextIsSafe = exports.ChatSafetyError = void 0;
class ChatSafetyError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = 'ChatSafetyError';
    }
}
exports.ChatSafetyError = ChatSafetyError;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const CONTACT_WORD_PATTERN = /\b(whats\s*app|whatsapp|call\s+me|phone\s+me|text\s+me|sms\s+me|email\s+me|e-?mail\s+me|contact\s+me|dm\s+me|telegram)\b/i;
const hasLikelyPhoneNumber = (text) => {
    const candidates = text.match(/(?:\+?\d[\s().-]*){7,}\d/g) || [];
    return candidates.some((candidate) => candidate.replace(/\D/g, '').length >= 8);
};
const assertChatTextIsSafe = (text) => {
    const value = text.trim();
    if (!value)
        return;
    if (EMAIL_PATTERN.test(value) || hasLikelyPhoneNumber(value) || CONTACT_WORD_PATTERN.test(value)) {
        throw new ChatSafetyError('For your safety, please keep all communication inside Padi chat. Phone numbers, email addresses and private contact details cannot be sent here.', 'PRIVATE_CONTACT_BLOCKED');
    }
};
exports.assertChatTextIsSafe = assertChatTextIsSafe;
//# sourceMappingURL=chat-safety.service.js.map