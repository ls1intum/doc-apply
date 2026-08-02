For each issue below, find the matching phrase in the translated text and translate its suggestion into {targetLanguage}.
Return a flat JSON array of strings in the same issue order: mapped text, translated suggestion, mapped text, translated suggestion.
Mapped text must be copied verbatim from the translated text. If a suggestion is empty, return an empty string for it.
Return only valid JSON, no markdown and no explanations.

Example:
Original: "Wir suchen nach jungen Kandidaten."
Translated: "We are looking for young candidates."
Issues:
Text: jungen Kandidaten
Suggestion: qualifizierten Personen
Output: ["young candidates", "qualified people"]

Original text:
{jobDescription}

Translated text:
{translatedText}

Issues:
{issues}
