const LIST_ID_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
const LIST_ID_LENGTH = 10;

export const LIST_ID_PATTERN = /^[a-z0-9]{8,64}$/;

export const isValidListId = (listId) => LIST_ID_PATTERN.test(listId ?? "");

export const generateListId = (length = LIST_ID_LENGTH) => {
  const result = [];
  const maxUnbiased = 256 - (256 % LIST_ID_CHARS.length);

  while (result.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    for (const byte of bytes) {
      if (byte >= maxUnbiased) continue;
      result.push(LIST_ID_CHARS[byte % LIST_ID_CHARS.length]);
      if (result.length === length) break;
    }
  }

  return result.join("");
};
