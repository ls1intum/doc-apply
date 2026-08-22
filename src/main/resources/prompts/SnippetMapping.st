Map every numbered source issue to the exact phrase in TARGET that expresses the same issue.
Return exactly {count} strings, one per issue, preserving order and duplicates.
Every non-empty result MUST be copied verbatim from TARGET. Use "" only if no matching phrase exists.
Do not analyze compliance. Output one JSON string array immediately, without reasoning, prose, or markdown.

--- EXAMPLE ---
TARGET: Wir suchen ein junges, dynamisches Team für unsere Arbeitsgruppe.
ISSUES:
1	young and dynamic team
2	must hold a German passport
OUTPUT: ["junges, dynamisches Team", ""]

--- INPUT ---
TARGET:
{translatedText}

ISSUES:
{snippets}
