"use client";

import { useMemo, useRef, useState } from "react";

type Tube = number[];
type Move = {
  from: number;
  to: number;
  previous: Tube[];
};

const CAPACITY = 4;

const COLORS = [
  "#ff3b5c",
  "#ffb020",
  "#27d17f",
  "#20c9e8",
  "#4d7cff",
  "#a855f7",
  "#f45fb0",
  "#ff7138",
];

function random(seed: number) {
  const x = Math.sin(seed * 9999.91) * 43758.5453;
  return x - Math.floor(x);
}

function shuffle<T>(array: T[], seed: number): T[] {
  const result = [...array];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random(seed + i) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

function topRun(tube: Tube): number {
  if (tube.length === 0) return 0;

  const color = tube[tube.length - 1];
  let count = 0;

  for (let i = tube.length - 1; i >= 0; i--) {
    if (tube[i] !== color) break;
    count++;
  }

  return count;
}

function isSolved(tubes: Tube[]): boolean {
  return tubes.every(
    (tube) =>
      tube.length === 0 ||
      (tube.length === CAPACITY && tube.every((color) => color === tube[0]))
  );
}

/*
 * Generate from a solved state and scramble it using legal moves.
 *
 * This is important:
 * We never create an arbitrary random puzzle.
 * Every generated puzzle originates from a known solved state,
 * therefore the generator always has a valid solution path.
 */
function generateLevel(level: number): Tube[] {
  const colors = Math.min(
    3 + Math.floor((level - 1) / 8),
    8
  );

  const emptyTubes =
    level < 15
      ? 2
      : level < 50
        ? 3
        : 4;

  const tubes: Tube[] = [];

  // Start solved.
  for (let color = 0; color < colors; color++) {
    tubes.push([color, color, color, color]);
  }

  for (let i = 0; i < emptyTubes; i++) {
    tubes.push([]);
  }

  /*
   * Reverse-scramble the solved board.
   *
   * Each reverse operation is guaranteed to be the inverse
   * of a legal forward pour. Therefore the generated puzzle
   * always has a known solution.
   */
  const targetMoves = Math.min(
    18 + level * 4,
    220
  );

  let seed = level * 7919 + 17;

  for (let step = 0; step < targetMoves; step++) {
    const candidates: Array<
      [number, number, number]
    > = [];

    for (let from = 0; from < tubes.length; from++) {
      const source = tubes[from];

      if (!source.length) continue;

      const color =
        source[source.length - 1];

      const run = topRun(source);

      for (
        let to = 0;
        to < tubes.length;
        to++
      ) {
        if (from === to) continue;

        const target = tubes[to];

        const free =
          CAPACITY - target.length;

        if (free <= 0) continue;

        // Don't merge with an existing same-color run.
        if (
          target.length > 0 &&
          target[target.length - 1] === color
        ) {
          continue;
        }

        /*
         * If we remove the entire run, the newly exposed
         * layer must be a different color (or the tube empty).
         */
        const maxAmount =
          source.length === run
            ? run
            : run - 1;

        if (maxAmount <= 0) continue;

        const max = Math.min(
          maxAmount,
          free
        );

        for (
          let amount = 1;
          amount <= max;
          amount++
        ) {
          candidates.push([
            from,
            to,
            amount,
          ]);
        }
      }
    }

    if (!candidates.length) {
      break;
    }

    const index = Math.floor(
      random(
        seed + step * 31
      ) * candidates.length
    );

    const [
      from,
      to,
      amount,
    ] = candidates[index];

    const moved =
      tubes[from].splice(
        tubes[from].length - amount,
        amount
      );

    tubes[to].push(...moved);

    seed =
      (seed * 1664525 + 1013904223) >>> 0;
  }

  /*
   * Never recursively regenerate.
   * If an extremely unusual seed produces a solved
   * board, make additional deterministic reverse moves.
   */
  if (isSolved(tubes)) {
    for (
      let extra = 0;
      extra < 100 && isSolved(tubes);
      extra++
    ) {
      const from =
        extra % colors;

      const to =
        colors +
        (extra % emptyTubes);

      if (
        !tubes[from].length ||
        tubes[to].length >= CAPACITY
      ) {
        continue;
      }

      const amount = Math.min(
        topRun(tubes[from]),
        CAPACITY - tubes[to].length
      );

      if (!amount) continue;

      const moved =
        tubes[from].splice(
          tubes[from].length - amount,
          amount
        );

      tubes[to].push(...moved);
    }
  }

  return tubes;
}

function canPour(tubes: Tube[], from: number, to: number): boolean {
  if (from === to) return false;

  const source = tubes[from];
  const target = tubes[to];

  if (source.length === 0) return false;
  if (target.length >= CAPACITY) return false;

  if (target.length === 0) return true;

  return (
    source[source.length - 1] ===
    target[target.length - 1]
  );
}

function pour(tubes: Tube[], from: number, to: number): Tube[] | null {
  if (!canPour(tubes, from, to)) return null;

  const next = tubes.map((tube) => [...tube]);

  const amount = Math.min(
    topRun(next[from]),
    CAPACITY - next[to].length
  );

  const moved = next[from].splice(
    next[from].length - amount,
    amount
  );

  next[to].push(...moved);

  return next;
}

export default function WaterSorter() {
  const [level, setLevel] = useState(1);

  const [tubes, setTubes] = useState<Tube[]>(() =>
    generateLevel(1)
  );

  const [selected, setSelected] = useState<number | null>(null);

  const [moves, setMoves] = useState(0);

  const [history, setHistory] = useState<Move[]>([]);

  const [won, setWon] = useState(false);

  const [muted, setMuted] = useState(false);

  const audioContext = useRef<AudioContext | null>(null);

  const difficulty = useMemo(() => {
    if (level < 8) return "EASY";
    if (level < 25) return "NORMAL";
    if (level < 60) return "HARD";

    return "EXPERT";
  }, [level]);

  function sound(type: "tap" | "pour" | "bad" | "win") {
    if (muted) return;

    try {
      const AudioContextClass =
        window.AudioContext ||
        (
          window as typeof window & {
            webkitAudioContext?: typeof AudioContext;
          }
        ).webkitAudioContext;

      if (!AudioContextClass) return;

      if (!audioContext.current) {
        audioContext.current = new AudioContextClass();
      }

      const ctx = audioContext.current;

      if (ctx.state === "suspended") {
        void ctx.resume();
      }

      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      const frequencies = {
        tap: 430,
        pour: 220,
        bad: 120,
        win: 720,
      };

      oscillator.frequency.value = frequencies[type];

      oscillator.type =
        type === "bad"
          ? "square"
          : type === "win"
            ? "triangle"
            : "sine";

      const now = ctx.currentTime;

      gain.gain.setValueAtTime(0.0001, now);

      gain.gain.exponentialRampToValueAtTime(
        0.06,
        now + 0.01
      );

      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + (type === "pour" ? 0.2 : 0.12)
      );

      oscillator.start(now);
      oscillator.stop(
        now + (type === "pour" ? 0.2 : 0.12)
      );
    } catch {
      // Audio is optional; gameplay must never fail because of audio.
    }
  }

  function handleTubeClick(index: number) {
    if (won) return;

    if (selected === null) {
      if (tubes[index].length === 0) return;

      setSelected(index);
      sound("tap");

      return;
    }

    if (selected === index) {
      setSelected(null);

      return;
    }

    const next = pour(tubes, selected, index);

    if (!next) {
      sound("bad");
      setSelected(null);

      return;
    }

    setHistory((current) => [
      ...current,
      {
        from: selected,
        to: index,
        previous: tubes.map((tube) => [...tube]),
      },
    ]);

    setTubes(next);

    setMoves((value) => value + 1);

    setSelected(null);

    sound("pour");

    if (isSolved(next)) {
      setWon(true);
      sound("win");
    }
  }

  function restart() {
    setTubes(generateLevel(level));
    setSelected(null);
    setMoves(0);
    setHistory([]);
    setWon(false);
  }

  function undo() {
    const last = history[history.length - 1];

    if (!last) return;

    setTubes(last.previous.map((tube) => [...tube]));

    setHistory((current) =>
      current.slice(0, -1)
    );

    setMoves((value) =>
      Math.max(0, value - 1)
    );

    setSelected(null);
    setWon(false);
  }

  function nextLevel() {
    const nextLevelNumber = level + 1;

    setLevel(nextLevelNumber);
    setTubes(generateLevel(nextLevelNumber));
    setSelected(null);
    setMoves(0);
    setHistory([]);
    setWon(false);
  }

  return (
    <main className="gamePage">
      <header className="header">
        <div className="logo">
          <div className="logoIcon">∞</div>

          <div>
            <strong>1000 GAMES</strong>
            <small>GAME #001</small>
          </div>
        </div>

        <button
          className="soundButton"
          onClick={() => setMuted((value) => !value)}
          aria-label={
            muted ? "Enable sound" : "Disable sound"
          }
        >
          {muted ? "🔇" : "🔊"}
        </button>
      </header>

      <section className="gameContainer">
        <div className="heading">
          <div>
            <div className="eyebrow">
              LIQUID PUZZLE
            </div>

            <h1>Water Sorter</h1>

            <p>
              Sort every color into its own tube.
            </p>
          </div>

          <div className="stats">
            <div>
              <span>LEVEL</span>
              <b>{level}</b>
            </div>

            <div>
              <span>MOVES</span>
              <b>{moves}</b>
            </div>

            <div>
              <span>MODE</span>
              <b>{difficulty}</b>
            </div>
          </div>
        </div>

        <div className="actions">
          <button
            onClick={undo}
            disabled={history.length === 0}
          >
            ↶ Undo
          </button>

          <button onClick={restart}>
            ↻ Restart
          </button>
        </div>

        <div className="board">
          {tubes.map((tube, index) => (
            <button
              key={index}
              className={`tubeButton ${
                selected === index
                  ? "selected"
                  : ""
              }`}
              onClick={() =>
                handleTubeClick(index)
              }
              aria-label={`Tube ${index + 1}`}
            >
              <div className="tube">
                <div className="tubeRim" />

                <div className="glassReflection" />

                <div className="water">
                  {tube.map((color, position) => (
                    <div
                      key={`${index}-${position}`}
                      className="waterLayer"
                      style={{
                        background: COLORS[color],
                      }}
                    >
                      <span />
                    </div>
                  ))}
                </div>
              </div>

              <span className="tubeNumber">
                {index + 1}
              </span>
            </button>
          ))}
        </div>

        <div className="instruction">
          Tap a tube, then tap another tube to pour.
        </div>

        {won && (
          <div className="winPanel">
            <div className="stars">
              ★ ★ ★
            </div>

            <div className="complete">
              LEVEL COMPLETE
            </div>

            <h2>Perfectly sorted!</h2>

            <p>
              Level {level} · {moves} moves
            </p>

            <button onClick={nextLevel}>
              Next Level →
            </button>
          </div>
        )}
      </section>

      <footer>
        <span>♾ Infinite Levels</span>
        <span>•</span>
        <span>Procedural Generation</span>
        <span>•</span>
        <span>Sound FX</span>
      </footer>
    </main>
  );
    }
