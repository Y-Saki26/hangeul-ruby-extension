(function () {
  "use strict";

  const S_BASE = 0xac00;
  const L_COUNT = 19;
  const V_COUNT = 21;
  const T_COUNT = 28;
  const N_COUNT = V_COUNT * T_COUNT;
  const S_COUNT = L_COUNT * N_COUNT;

  const JAMO_PATTERN = /[\u1100-\u11ff\u3130-\u318f\ua960-\ua97f\ud7b0-\ud7ff]/;

  const INITIALS = [
    "g",
    "kk",
    "n",
    "d",
    "tt",
    "r",
    "m",
    "b",
    "pp",
    "s",
    "ss",
    "",
    "j",
    "jj",
    "ch",
    "k",
    "t",
    "p",
    "h"
  ];

  const MEDIALS = [
    "a",
    "ae",
    "ya",
    "yae",
    "eo",
    "e",
    "yeo",
    "ye",
    "o",
    "wa",
    "wae",
    "oe",
    "yo",
    "u",
    "wo",
    "we",
    "wi",
    "yu",
    "eu",
    "ui",
    "i"
  ];

  const FINALS = [
    "",
    "k",
    "k",
    "ks",
    "n",
    "nj",
    "nh",
    "t",
    "l",
    "lk",
    "lm",
    "lb",
    "ls",
    "lt",
    "lp",
    "lh",
    "m",
    "p",
    "ps",
    "t",
    "t",
    "ng",
    "t",
    "t",
    "k",
    "t",
    "p",
    "t"
  ];

  const COMPAT_INITIAL_INDEX = {
    "ㄱ": 0,
    "ㄲ": 1,
    "ㄴ": 2,
    "ㄷ": 3,
    "ㄸ": 4,
    "ㄹ": 5,
    "ㅁ": 6,
    "ㅂ": 7,
    "ㅃ": 8,
    "ㅅ": 9,
    "ㅆ": 10,
    "ㅇ": 11,
    "ㅈ": 12,
    "ㅉ": 13,
    "ㅊ": 14,
    "ㅋ": 15,
    "ㅌ": 16,
    "ㅍ": 17,
    "ㅎ": 18
  };

  const COMPAT_MEDIAL_INDEX = {
    "ㅏ": 0,
    "ㅐ": 1,
    "ㅑ": 2,
    "ㅒ": 3,
    "ㅓ": 4,
    "ㅔ": 5,
    "ㅕ": 6,
    "ㅖ": 7,
    "ㅗ": 8,
    "ㅘ": 9,
    "ㅙ": 10,
    "ㅚ": 11,
    "ㅛ": 12,
    "ㅜ": 13,
    "ㅝ": 14,
    "ㅞ": 15,
    "ㅟ": 16,
    "ㅠ": 17,
    "ㅡ": 18,
    "ㅢ": 19,
    "ㅣ": 20
  };

  const COMPAT_FINAL_INDEX = {
    "": 0,
    "ㄱ": 1,
    "ㄲ": 2,
    "ㄳ": 3,
    "ㄴ": 4,
    "ㄵ": 5,
    "ㄶ": 6,
    "ㄷ": 7,
    "ㄹ": 8,
    "ㄺ": 9,
    "ㄻ": 10,
    "ㄼ": 11,
    "ㄽ": 12,
    "ㄾ": 13,
    "ㄿ": 14,
    "ㅀ": 15,
    "ㅁ": 16,
    "ㅂ": 17,
    "ㅄ": 18,
    "ㅅ": 19,
    "ㅆ": 20,
    "ㅇ": 21,
    "ㅈ": 22,
    "ㅊ": 23,
    "ㅋ": 24,
    "ㅌ": 25,
    "ㅍ": 26,
    "ㅎ": 27
  };

  const COMPAT_ROMANIZATION = {
    ...Object.fromEntries(Object.entries(COMPAT_INITIAL_INDEX).map(([char, index]) => [char, INITIALS[index]])),
    ...Object.fromEntries(Object.entries(COMPAT_MEDIAL_INDEX).map(([char, index]) => [char, MEDIALS[index]]))
  };

  function romanizeSyllable(char) {
    const code = char.charCodeAt(0);
    const index = code - S_BASE;

    if (index < 0 || index >= S_COUNT) {
      return char;
    }

    const initialIndex = Math.floor(index / N_COUNT);
    const medialIndex = Math.floor((index % N_COUNT) / T_COUNT);
    const finalIndex = index % T_COUNT;

    return INITIALS[initialIndex] + MEDIALS[medialIndex] + FINALS[finalIndex];
  }

  function composeCompatJamo(chars) {
    const composed = [];
    let index = 0;

    while (index < chars.length) {
      const initialIndex = COMPAT_INITIAL_INDEX[chars[index]];
      const medialIndex = COMPAT_MEDIAL_INDEX[chars[index + 1]];

      if (initialIndex === undefined || medialIndex === undefined) {
        composed.push(chars[index]);
        index += 1;
        continue;
      }

      let finalIndex = 0;
      const finalCandidate = chars[index + 2];
      const nextAfterFinal = chars[index + 3];

      if (
        finalCandidate &&
        COMPAT_FINAL_INDEX[finalCandidate] !== undefined &&
        COMPAT_MEDIAL_INDEX[nextAfterFinal] === undefined
      ) {
        finalIndex = COMPAT_FINAL_INDEX[finalCandidate];
        index += 3;
      } else {
        index += 2;
      }

      composed.push(String.fromCharCode(S_BASE + initialIndex * N_COUNT + medialIndex * T_COUNT + finalIndex));
    }

    return composed.join("");
  }

  function normalizeHangeul(text) {
    if (!JAMO_PATTERN.test(text)) {
      return text;
    }

    return composeCompatJamo(Array.from(text)).normalize("NFC");
  }

  function romanizeCharacter(char) {
    const syllable = romanizeSyllable(char);
    if (syllable !== char) {
      return syllable;
    }

    return COMPAT_ROMANIZATION[char] || char;
  }

  function romanizeHangeul(text) {
    return Array.from(normalizeHangeul(text), romanizeCharacter).join("");
  }

  window.HangeulRubyRomanizer = {
    romanize: romanizeHangeul
  };
})();
