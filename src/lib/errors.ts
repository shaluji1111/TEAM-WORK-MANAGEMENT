export class AppError extends Error { constructor(message: string, public code: "forbidden" | "not_found" | "conflict" | "validation" = "validation") { super(message); } }
export function invariant(condition: unknown, message: string, code?: AppError["code"]): asserts condition { if (!condition) throw new AppError(message, code); }
