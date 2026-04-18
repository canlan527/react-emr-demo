/**
 * 纯文本编辑工具函数。
 *
 * 职责：
 * - 对字符串执行插入、删除、范围删除和范围替换。
 * - 保持函数无副作用，方便编辑命令和历史栈复用。
 *
 * 不直接负责：
 * - 光标状态更新。
 * - 选区状态更新。
 * - 撤销/重做历史。
 */
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
