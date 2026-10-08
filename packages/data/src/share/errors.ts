export type BunbuShareErrorReason =
  /** Not a .bunbu file, or one from a newer version of Bunbu. */
  | "unknown-format"
  /** The file was cut off, for example by an interrupted download. */
  | "incomplete"
  /** The file was altered or damaged. */
  | "corrupt";

const messages: Record<BunbuShareErrorReason, string> = {
  "unknown-format": "This is not a Bunbu quiz file, or it was made by a newer version of Bunbu.",
  incomplete: "This quiz file is incomplete. It was probably cut off while downloading or copying it.",
  corrupt: "This quiz file is damaged and can't be read.",
};

/** Thrown by `uncompress` when a `.bunbu` file can't be read. */
export class BunbuShareError extends Error {
  readonly reason: BunbuShareErrorReason;

  constructor(reason: BunbuShareErrorReason) {
    super(messages[reason]);
    this.name = "BunbuShareError";
    this.reason = reason;
  }
}
