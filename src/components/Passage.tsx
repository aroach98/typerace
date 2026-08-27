import { memo } from 'react';

interface Props {
  words: string[];
  wordIndex: number;
  typed: string;
  okLen: number;
  dim?: boolean;
}

/**
 * Renders the passage with TypeRacer-style colouring: committed text green,
 * a red highlight over the mistyped stretch, a blinking caret at the cursor.
 */
export const Passage = memo(function Passage({ words, wordIndex, typed, okLen, dim }: Props) {
  return (
    <div className={`passage ${dim ? 'dim' : ''}`} aria-hidden>
      {words.map((w, wi) => {
        if (wi < wordIndex) {
          return (
            <span className="w" key={wi}>
              {Array.from(w).map((ch, ci) => (
                <span className="c ok" key={ci}>
                  {ch}
                </span>
              ))}
            </span>
          );
        }
        if (wi === wordIndex) {
          const badEnd = Math.min(w.length, Math.max(typed.length, okLen));
          const caretAt = Math.min(w.length, typed.length);
          return (
            <span className="w" key={wi}>
              {Array.from(w).map((ch, ci) => {
                let cls = 'c';
                if (ci < okLen) cls += ' ok';
                else if (ci < badEnd) cls += ' bad';
                if (ci === caretAt) cls += ' cur';
                return (
                  <span className={cls} key={ci}>
                    {ch}
                  </span>
                );
              })}
            </span>
          );
        }
        return (
          <span className="w" key={wi}>
            {Array.from(w).map((ch, ci) => (
              <span className="c" key={ci}>
                {ch}
              </span>
            ))}
          </span>
        );
      })}
    </div>
  );
});
