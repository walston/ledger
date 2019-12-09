import "extend-error";

declare global {
  interface ErrorConstructor {
    extend: (name: string, code?: number) => ErrorConstructor;
  }
}

export const DuplicateEntry = Error.extend("DuplicateEntry", 409);
export const InvalidCredentials = Error.extend("InvalidCredentials", 401);
export const AuthenticationError = Error.extend("AuthenticationError", 401);
export const DatabaseDisconnect = Error.extend("DatabaseDisconnect", 500);
