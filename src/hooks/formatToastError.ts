
export function formatToastError(input: unknown): string {
  if (typeof input === "string") return input;
  if (input && typeof input === "object") {
    if ("message" in input && typeof (input as any).message === "string") {
      return (input as any).message;
    }
    if ("error" in input && typeof (input as any).error === "string") {
      return (input as any).error;
    }
  }
  return "Unknown error";
}
