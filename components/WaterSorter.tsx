
"use client";

import { useMemo, useRef, useState } from "react";

type Tube = number[];

type Move = {
  from: number;
  to: number;
  previous: Tube[];
};

type PourAnimation = {
  from: number;
  to: number;
  color: number;
  angle: number;
  moveX: number;
  moveY: number;
  streamX: number;
  streamY: number;
  streamLength: number;
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

function topRun(tube: Tube): number {
  if (!tube.length) return 0;

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
      (tube.length === CAPACITY &&
        tube.every((color) => color === tube[0]))
  );
}

function generateLevel(level: number): Tube[] {
  const colors = Math.min(
    3 + Math.floor((level - 1) / 8),
    8
  );

  const emptyTubes =
    level < 15 ? 2 : level < 50 ? 3 : 4;

  const tubes: Tube[] = [];

  for (let color = 0; color < colors; color++) {
    tubes.push([color, color, color, color]);
  }

  for (let i = 0; i < emptyTubes; i++) {
    tubes.push([]);
  }

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

      const color = source[source.length - 1];
      const run = topRun(source);

      for (let to = 0; to < tubes.length; to++) {
        if (from === to) continue;

        const target = tubes[to];
        const free = CAPACITY - target.length;

        if (free <= 0) continue;

        if (
          target.length > 0 &&
          target[target.length - 1] === color
        ) {
          continue;
        }

        const maxAmount =
          source.length === run ? run : run - 1;

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
          candidates.push([from, to, amount]);
        }
      }
    }

    if (!candidates.length) break;

    const index = Math.floor(
      random(seed + step * 31) *
        candidates.length
    );

    const [from, to, amount] =
      candidates[index];

    const moved = tubes[from].splice(
      tubes[from].length - amount,
      amount
    );

    tubes[to].push(...moved);

    seed =
      (seed * 1664525 + 1013904223) >>> 0;
  }

  if (isSolved(tubes)) {
    for (
      let extra = 0;
      extra < 100 && isSolved(tubes);
      extra++
    ) {
      const from = extra % colors;
      const to =
        colors + (extra % emptyTubes);

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

      const moved = tubes[from].splice(
        tubes[from].length - amount,
        amount
      );

      tubes[to].push(...moved);
    }
  }

  return tubes;
}

function canPour(
  tubes: Tube[],
  from: number,
  to: number
): boolean {
  if (from === to) return false;

  const source = tubes[from];
  const target = tubes[to];

  if (!source.length) return false;
  if (target.length >= CAPACITY) return false;

  if (target.length === 0) return true;

  return (
    source[source.length - 1] ===
    target[target.length - 1]
  );
}

function pour(
  tubes: Tube[],
  from: number,
  to: number
): Tube[] | null {
  if (!canPour(tubes, from, to)) {
    return null;
  }

  const next = tubes.map((tube) => [
    ...tube,
  ]);

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

  const [tubes, setTubes] = useState<Tube[]>(
    () => generateLevel(1)
  );

  const [selected, setSelected] =
    useState<number | null>(null);

  const [moves, setMoves] = useState(0);

  const [history, setHistory] =
    useState<Move[]>([]);

  const [won, setWon] = useState(false);

  const [muted, setMuted] = useState(false);

  const [pouring, setPouring] =
    useState<PourAnimation | null>(null);

  const audioContext =
    useRef<AudioContext | null>(null);

  const tubeRefs =
    useRef<Array<HTMLButtonElement | null>>([]);

  const difficulty = useMemo(() => {
    if (level < 8) return "EASY";
    if (level < 25) return "NORMAL";
    if (level < 60) return "HARD";
    return "EXPERT";
  }, [level]);

  function sound(
    type: "tap" | "pour" | "bad" | "win"
  ) {
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
        audioContext.current =
          new AudioContextClass();
      }

      const ctx = audioContext.current;

      if (ctx.state === "suspended") {
        void ctx.resume();
      }

      const oscillator =
        ctx.createOscillator();

      const gain = ctx.createGain();

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      const frequencies = {
        tap: 430,
        pour: 205,
        bad: 120,
        win: 720,
      };

      oscillator.frequency.setValueAtTime(
        frequencies[type],
        ctx.currentTime
      );

      oscillator.type =
        type === "bad"
          ? "square"
          : type === "win"
            ? "triangle"
            : "sine";

      const now = ctx.currentTime;

      const duration =
        type === "pour" ? 0.32 : 0.12;

      gain.gain.setValueAtTime(
        0.0001,
        now
      );

      gain.gain.exponentialRampToValueAtTime(
        type === "pour" ? 0.08 : 0.06,
        now + 0.015
      );

      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + duration
      );

      oscillator.start(now);
      oscillator.stop(now + duration);
    } catch {
      // Audio is optional.
    }
  }

  function getPourAnimation(
    from: number,
    to: number
  ): PourAnimation {
    const source =
      tubeRefs.current[from];

    const target =
      tubeRefs.current[to];

    if (!source || !target) {
      return {
        from,
        to,
        color: tubes[from][tubes[from].length - 1],
        angle: to > from ? 48 : -48,
        moveX: to > from ? 100 : -100,
        moveY: -35,
        streamX: to > from ? 65 : -65,
        streamY: 80,
        streamLength: 120,
      };
    }

    const sourceRect =
      source.getBoundingClientRect();

    const targetRect =
      target.getBoundingClientRect();

    const sourceX =
      sourceRect.left +
      sourceRect.width / 2;

    const sourceY =
      sourceRect.top + 10;

    const targetX =
      targetRect.left +
      targetRect.width / 2;

    const targetY =
      targetRect.top + 12;

    const dx = targetX - sourceX;
    const dy = targetY - sourceY;

    const direction = dx >= 0 ? 1 : -1;

    /*
     * Move the tube substantially toward
     * the receiving tube instead of merely
     * rotating it in place.
     */
    const moveX =
      dx * 0.72;

    /*
     * Lift the tube while moving.
     * This creates the "pick up -> swing ->
     * pour -> return" feeling.
     */
    const moveY =
      Math.min(
        -34,
        dy * 0.18 - 28
      );

    /*
     * Stronger physical tilt.
     */
    const distance =
      Math.sqrt(dx * dx + dy * dy);

    const angle = Math.min(
      58,
      Math.max(
        42,
        38 + distance * 0.025
      )
    ) * direction;

    /*
     * Stream geometry.
     */
    const streamX =
      dx * 0.34;

    const streamY =
      Math.max(
        80,
        Math.abs(dy) * 0.35 + 75
      );

    const streamLength =
      Math.min(
        190,
        Math.max(
          105,
          distance * 0.58
        )
      );

    return {
      from,
      to,
      color: tubes[from][
        tubes[from].length - 1
      ],
      angle,
      moveX,
      moveY,
      streamX,
      streamY,
      streamLength,
    };
  }

  function handleTubeClick(index: number) {
    if (won || pouring) return;

    if (selected === null) {
      if (!tubes[index].length) return;

      setSelected(index);
      sound("tap");
      return;
    }

    if (selected === index) {
      setSelected(null);
      return;
    }

    const from = selected;

    if (!canPour(tubes, from, index)) {
      sound("bad");
      setSelected(null);
      return;
    }

    const animation =
      getPourAnimation(from, index);

    setPouring(animation);
    setSelected(null);

    sound("pour");

    window.setTimeout(() => {
      const next = pour(
        tubes,
        from,
        index
      );

      if (!next) {
        setPouring(null);
        return;
      }

      setHistory((current) => [
        ...current,
        {
          from,
          to: index,
          previous: tubes.map((tube) => [
            ...tube,
          ]),
        },
      ]);

      setTubes(next);

      setMoves((value) => value + 1);

      setPouring(null);

      if (isSolved(next)) {
        setWon(true);
        sound("win");
      }
    }, 900);
  }

  function restart() {
    setTubes(generateLevel(level));
    setSelected(null);
    setMoves(0);
    setHistory([]);
    setWon(false);
    setPouring(null);
  }

  function undo() {
    if (pouring) return;

    const last =
      history[history.length - 1];

    if (!last) return;

    setTubes(
      last.previous.map((tube) => [
        ...tube,
      ])
    );

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
    if (pouring) return;

    const nextLevelNumber =
      level + 1;

    setLevel(nextLevelNumber);

    setTubes(
      generateLevel(nextLevelNumber)
    );

    setSelected(null);
    setMoves(0);
    setHistory([]);
    setWon(false);
    setPouring(null);
  }

  return (
    <main className="gamePage">
      <header className="header">
        <div className="logo">
          <div className="logoIcon">
            ∞
          </div>

          <div>
            <strong>1000 GAMES</strong>
            <small>GAME #001</small>
          </div>
        </div>

        <button
          className="soundButton"
          onClick={() =>
            setMuted((value) => !value)
          }
          aria-label={
            muted
              ? "Enable sound"
              : "Disable sound"
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
              Sort every color into its
              own tube.
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
            disabled={
              history.length === 0 ||
              pouring !== null
            }
          >
            ↶ Undo
          </button>

          <button
            onClick={restart}
            disabled={pouring !== null}
          >
            ↻ Restart
          </button>
        </div>

        <div className="board">
          {tubes.map((tube, index) => {
            const isSource =
              pouring?.from === index;

            const isTarget =
              pouring?.to === index;

            const isSelected =
              selected === index;

            const style =
              isSource && pouring
                ? ({
                    "--pour-angle":
                      `${pouring.angle}deg`,
                    "--pour-x":
                      `${pouring.moveX}px`,
                    "--pour-y":
                      `${pouring.moveY}px`,
                    "--stream-x":
                      `${pouring.streamX}px`,
                    "--stream-y":
                      `${pouring.streamY}px`,
                    "--stream-length":
                      `${pouring.streamLength}px`,
                  } as React.CSSProperties)
                : undefined;

            return (
              <button
                key={index}
                ref={(element) => {
                  tubeRefs.current[index] =
                    element;
                }}
                className={[
                  "tubeButton",
                  isSelected
                    ? "selected"
                    : "",
                  isSource
                    ? "pouring"
                    : "",
                  isTarget
                    ? "receiving"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={style}
                onClick={() =>
                  handleTubeClick(index)
                }
                aria-label={`Tube ${index + 1}`}
                disabled={
                  pouring !== null
                }
              >
                <div className="tube">
                  <div className="tubeRim" />

                  <div className="glassReflection" />

                  <div className="water">
                    {tube.map(
                      (color, position) => (
                        <div
                          key={`${index}-${position}`}
                          className="waterLayer"
                          style={
                            {
                              "--liquid-color":
                                COLORS[color],
                            } as React.CSSProperties
                          }
                        />
                      )
                    )}
                  </div>
                </div>

                {isSource &&
                  pouring && (
                    <div
                      className="pourStream"
                      style={
                        {
                          "--liquid-color":
                            COLORS[
                              pouring.color
                            ],
                        } as React.CSSProperties
                      }
                    />
                  )}

                <span className="tubeNumber">
                  {index + 1}
                </span>
              </button>
            );
          })}
        </div>

        <div className="instruction">
          Tap a tube, then tap another
          tube to pour.
        </div>

        {won && (
          <div className="winPanel">
            <div className="stars">
              ★ ★ ★
            </div>

            <div className="complete">
              LEVEL COMPLETE
            </div>

            <h2>
              Perfectly sorted!
            </h2>

            <p>
              Level {level} · {moves} moves
            </p>

            <button
              onClick={nextLevel}
            >
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
