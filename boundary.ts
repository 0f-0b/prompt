const graphemeSegmenter = new Intl.Segmenter();
const wordSegmenter = new Intl.Segmenter(undefined, { granularity: "word" });

export interface Range {
  start: number;
  end: number;
}

export function getGraphemeRange(text: string, position: number): Range {
  const { segment, index } = graphemeSegmenter
    .segment(text.replaceAll("\r", "\n"))
    .containing(position);
  return { start: index, end: index + segment.length };
}

export function nextGraphemeBoundary(text: string, position: number): number {
  if (position === text.length) {
    return position;
  }
  const { start, end } = getGraphemeRange(text, position);
  return position === start ? position : end;
}

export function* graphemes(text: string): IteratorObject<string, undefined> {
  for (const { segment } of graphemeSegmenter.segment(text)) {
    yield segment;
  }
}

export function getPreviousWordRange(text: string, position: number): Range {
  const segments = wordSegmenter.segment(text);
  while (position !== 0) {
    const { segment, index, isWordLike } = segments.containing(position - 1);
    if (isWordLike) {
      return { start: index, end: index + segment.length };
    }
    position = index;
  }
  return { start: 0, end: 0 };
}

export function getNextWordRange(text: string, position: number): Range {
  const segments = wordSegmenter.segment(text);
  while (position !== text.length) {
    const { segment, index, isWordLike } = segments.containing(position);
    if (isWordLike) {
      return { start: index, end: index + segment.length };
    }
    position = index + segment.length;
  }
  return { start: text.length, end: text.length };
}
