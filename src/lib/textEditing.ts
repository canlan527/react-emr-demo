export function insertText(value: string, index: number, nextText: string) {
  return `${value.slice(0, index)}${nextText}${value.slice(index)}`;
}

export function deleteBefore(value: string, index: number) {
  if (index <= 0) {
    return value;
  }

  return `${value.slice(0, index - 1)}${value.slice(index)}`;
}

export function deleteRange(value: string, start: number, end: number) {
  return `${value.slice(0, start)}${value.slice(end)}`;
}

export function replaceRange(value: string, start: number, end: number, nextText: string) {
  return `${value.slice(0, start)}${nextText}${value.slice(end)}`;
}
