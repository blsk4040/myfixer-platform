import assert from 'node:assert/strict';
import { assertChatTextIsSafe, ChatSafetyError } from '../src/services/chat-safety.service';

const assertBlocked = (text: string) => {
  assert.throws(
    () => assertChatTextIsSafe(text),
    (error) => error instanceof ChatSafetyError && error.code === 'PRIVATE_CONTACT_BLOCKED'
  );
};

assert.doesNotThrow(() => assertChatTextIsSafe('Gate code is 1234. Please park near block B.'));
assert.doesNotThrow(() => assertChatTextIsSafe('The unit number is 12 and security knows you are coming.'));
assertBlocked('Please call me on 071 234 5678.');
assertBlocked('My email is client@example.com.');
assertBlocked('WhatsApp me when you arrive.');
assertBlocked('+27 82 123 4567');

console.log('Chat safety tests passed.');
