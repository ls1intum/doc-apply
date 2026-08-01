For each snippet below, find the matching phrase in the translated text. Return a JSON array of strings, one matched phrase per source snippet, in the same order. Return only valid JSON, no markdown and no explanations.

Example:
Original: "Wir suchen nach jungen Kandidaten."
Translated: "We are looking for young candidates."
Snippets: "jungen Kandidaten"
Output: ["young candidates"]

Original text:
{jobDescription}

Translated text:
{translatedText}

Snippets, one per line:
{snippets}
