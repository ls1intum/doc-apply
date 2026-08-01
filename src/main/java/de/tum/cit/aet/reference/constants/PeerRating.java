package de.tum.cit.aet.reference.constants;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Comparative rating of the applicant against a peer group on a single dimension. {@code CANNOT_JUDGE}
 * lets a referee abstain on a dimension they have no basis to assess rather than being forced into a
 * false rating.
 */
@Schema(enumAsRef = true)
public enum PeerRating {
    TOP_ONE_TO_TWO_PERCENT,
    TOP_FIVE_PERCENT,
    TOP_TEN_PERCENT,
    TOP_TWENTY_FIVE_PERCENT,
    TOP_FIFTY_PERCENT,
    BELOW_AVERAGE,
    CANNOT_JUDGE,
}
