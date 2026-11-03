// How many characters of an entry the journal list shows before "show more".
export const journalPreviewChars = 100;

export type JournalPreview = { text: string; truncated: boolean };

// The opening of an entry for the list. Whitespace runs (line breaks
// included) fold into one space so every collapsed entry takes the same
// room; the cut falls on the last word boundary when one is near the end,
// and never splits a character made of two code units (an emoji).
export function previewJournalText(text: string, max = journalPreviewChars): JournalPreview {
  const folded = text.replace(/\s+/g, ' ').trim();
  const characters = Array.from(folded);
  if (characters.length <= max) {
    return { text, truncated: false };
  }
  const head = characters.slice(0, max).join('');
  const boundary = head.lastIndexOf(' ');
  const cut = boundary >= Math.floor(head.length * 0.6) ? head.slice(0, boundary) : head;
  return { text: `${cut.trimEnd()}…`, truncated: true };
}
