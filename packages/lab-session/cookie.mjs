export const sessionCookie = "lab_session";
/** @param {string | null | undefined} header */
export function forwardSessionCookie(header) {
  return (
    header
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${sessionCookie}=`)) ?? ""
  );
}
