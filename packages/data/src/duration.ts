/** A duration as the format writes it: hours, minutes and seconds, in that order, each optional. */
const duration = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/;

/**
 * The seconds in a duration such as `timePerQuestion`: `45s`, `3m`, `1m30s` or `1h`. Returns
 * `undefined` when the text isn't one, or when it adds up to no time at all.
 */
export function secondsOf(text: string): number | undefined {
  const match = duration.exec(text);
  if (match === null || text === "") return undefined;
  const [, hours = "0", minutes = "0", seconds = "0"] = match;
  const total = Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
  return total > 0 ? total : undefined;
}
