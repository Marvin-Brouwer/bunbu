/** The link to Bunbu itself, to send a friend along with a quiz or a score. */
export const appLink = (): string => new URL(import.meta.env.BASE_URL, window.location.origin).href
