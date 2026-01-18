export type UserState = "idle" | "awaiting_slots_input" | "awaiting_slots_text_edit";

const userStates = new Map<number, UserState>();

export function getUserState(telegramUserId: number): UserState {
  return userStates.get(telegramUserId) || "idle";
}

export function setUserState(telegramUserId: number, state: UserState): void {
  userStates.set(telegramUserId, state);
}

export function clearUserState(telegramUserId: number): void {
  userStates.delete(telegramUserId);
}

export function isUserInState(telegramUserId: number, state: UserState): boolean {
  return getUserState(telegramUserId) === state;
}
