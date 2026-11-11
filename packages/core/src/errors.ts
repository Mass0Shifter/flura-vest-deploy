export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new AppError(404, "not_found", `${what} not found`);
export const forbidden = (msg = "You do not have access to this") => new AppError(403, "forbidden", msg);
export const conflict = (code: string, msg: string) => new AppError(409, code, msg);
export const badRequest = (code: string, msg: string) => new AppError(400, code, msg);
