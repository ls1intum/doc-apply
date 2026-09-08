package de.tum.cit.aet.core.constants;

/**
 * Identifies which {@link GenderBiasWordLists} category matched a word during analysis:
 * NON_INCLUSIVE findings lower the gender score, while INCLUSIVE findings
 * contribute as a counterweight when both categories occur.
 */
public enum GenderCategory {
    NON_INCLUSIVE,
    INCLUSIVE,
}
