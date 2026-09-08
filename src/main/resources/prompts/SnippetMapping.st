For each source issue, map its text to the exact phrase in TARGET that expresses the same issue.
Directly after each mapped text, return that issue's existing suggestion translated into {targetLanguage} without changing its meaning.
Return one flat JSON string array containing exactly two strings per issue, preserving order and duplicates.
Every non-empty mapped text MUST be copied verbatim from TARGET. Use "" if no matching phrase or source suggestion exists.
Do not create new suggestions or analyze compliance. Output the JSON array immediately, without reasoning, prose, or markdown.

--- EXAMPLE ---
TARGET: Wir suchen ein junges, dynamisches Team für unsere Arbeitsgruppe.
ISSUES:
Text: young and dynamic team
Suggestion: experienced team
OUTPUT: ["junges, dynamisches Team", "erfahrenes und dynamisches Team"]

--- INPUT ---
TARGET:
{translatedText}

ISSUES:
{issues}
