export function boundedText(value: unknown, label: string, max: number, min?: number): string;
export function safeImageUrl(value: unknown): string | null;
export function validEmail(value: unknown): string;
export function validPassword(value: unknown, minimum?: number): string;
export function validUsername(value: unknown): string;
export function validateMessage(
  content: unknown,
  attachments?: unknown,
  mentions?: unknown,
): string;
export function validReaction(value: unknown): string;
