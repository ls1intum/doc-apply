package de.tum.cit.aet.core.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * One address the user can pick while typing an address, so the form can fill the remaining address fields.
 *
 * @param street      the street name, without the house number
 * @param houseNumber the house number, if the suggestion points to a building
 * @param postalCode  the postal code
 * @param city        the city, town or village
 * @param countryCode the country as an uppercase ISO 3166-1 alpha-2 code, such as DE
 * @param label       the whole address in one line, shown in the suggestion list
 */
@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record AddressSuggestionDTO(String street, String houseNumber, String postalCode, String city, String countryCode, String label) {}
