const normalizeString = string =>
  string
    // uppercase because that replaces e.g. ß with SS
    .toUpperCase()
    // decompose diacritics
    .normalize('NFD')
    // strip the diacritic part
    .replace(/[\u0300-\u036f]/g, '')
    // collapse whitespace and similar separators
    .replace(/[\p{Separator}]+/gu, ' ')
    // strip anything that's not a letter/number
    .replace(/[^\p{Letter}\p{Nd}]+/gu, ' ');

export const smartContains = (haystack, needle) => {
  const normHaystack = normalizeString(haystack);
  const normNeedle = normalizeString(needle);
  // require all words to appear, but not necessarily in order
  return normNeedle.split(/\s+/).every(x => normHaystack.includes(x));
};
