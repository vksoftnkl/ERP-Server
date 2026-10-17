/**
 * Notes 119 / 127 §5 — every Price Level Master refusal carries one of these in
 * `errors[].code`; the client words its box by the code alone. A code keeps its
 * meaning forever: a new refusal gets a new member.
 */
export enum PriceLevelMasterErrorCode {
  /** A priceLvlId asked for (get) or sent (update) names no price level (404). */
  NOT_FOUND = 'PRICE_LEVEL_NOT_FOUND',
}
