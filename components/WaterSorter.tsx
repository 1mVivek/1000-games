
"use client";

import {
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

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

  left: number;
  top: number;

  moveX: number;
  moveY: number;

  angle: number;

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

function topRun(tube: Tube) {
  if (!tube.length) return 0;

  const color = tube[tube.length - 1];

  let count = 0;

  for (let i = tube.length - 1; i >= 0; i--) {
    if (tube[i] !== color) break;
    count++;
  }

  return count;
}

function isSolved(tubes: Tube[]) {
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
    tubes.push([
      color,
      color,
      color,
      color,
    ]);
  }

  for (let i = 0; i < emptyTubes; i++) {
    tubes.push([]);
  }

  const targetMoves = Math.min(
    18 + level * 4,
    220
  );

  let seed = level * 7919 + 17;

  for (
    let step = 0;
    step < targetMoves;
    step++
  ) {
    const candidates: Array<
      [number, number, number]
    > = [];

    for (
      let from = 0;
      from < tubes.length;
      from++
    ) {
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

        if (
          target.length > 0 &&
          target[target.length - 1] === color
        ) {
          continue;
        }

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

    if (!candidates.length) break;

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

    const moved = tubes[from].splice(
      tubes[from].length - amount,
      amount
    );

    tubes[to].push(...moved);

    seed =
      (seed * 1664525 +
        1013904223) >>>
      0;
  }

  return tubes;
}

function canPour(
  tubes: Tube[],
  from: number,
  to: number
) {
  if (from === to) return false;

  const source = tubes[from];
  const target = tubes[to];

  if (!source.length) return false;

  if (target.length >= CAPACITY) {
    return false;
  }

  if (!target.length) return true;

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

function tubeMarkup(
  tube: Tube[],
  tubeIndex: number
) {
  return tube.map((color, position) => {
    const sameAsBelow =
      position > 0 &&
      tube[position - 1] === color;

    return (
      <div
        key={`${tubeIndex}-${position}`}
        className={[
          "waterLayer",
          sameAsBelow
            ? "mergedLayer"
            : "liquidBoundary",
        ].join(" ")}
        style={
          {
            "--liquid-color":
              COLORS[color],
          } as CSSProperties
        }
      />
    );
  });
}

export default function WaterSorter() {
  const [level, setLevel] =
    useState(1);

  const [tubes, setTubes] =
    useState<Tube[]>(() =>
      generateLevel(1)
    );

  const [selected, setSelected] =
    useState<number | null>(null);

  const [moves, setMoves] =
    useState(0);

  const [history, setHistory] =
    useState<Move[]>([]);

  const [won, setWon] =
    useState(false);

  const [muted, setMuted] =
    useState(false);

  const [pouring, setPouring] =
    useState<PourAnimation | null>(
      null
    );

  const [receiving, setReceiving] =
    useState<number | null>(null);

  const boardRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const tubeRefs =
    useRef<
      Array<HTMLButtonElement | null>
    >([]);

  const audioContext =
    useRef<AudioContext | null>(
      null
    );

  const difficulty = useMemo(() => {
    if (level < 8) return "EASY";
    if (level < 25) return "NORMAL";
    if (level < 60) return "HARD";
    return "EXPERT";
  }, [level]);

  function sound(
    type:
      | "tap"
      | "pour"
      | "bad"
      | "win"
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

      const ctx =
        audioContext.current;

      if (ctx.state === "suspended") {
        void ctx.resume();
      }

      const oscillator =
        ctx.createOscillator();

      const gain =
        ctx.createGain();

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      const frequency = {
        tap: 430,
        pour: 205,
        bad: 120,
        win: 720,
      }[type];

      oscillator.type =
        type === "bad"
          ? "square"
          : type === "win"
            ? "triangle"
            : "sine";

      const now =
        ctx.currentTime;

      oscillator.frequency.setValueAtTime(
        frequency,
        now
      );

      gain.gain.setValueAtTime(
        0.0001,
        now
      );

      gain.gain.exponentialRampToValueAtTime(
        type === "pour"
          ? 0.075
          : 0.06,
        now + 0.015
      );

      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now +
          (type === "pour"
            ? 0.35
            : 0.12)
      );

      oscillator.start(now);

      oscillator.stop(
        now +
          (type === "pour"
            ? 0.35
            : 0.12)
      );
    } catch {
      // Audio must never break gameplay.
    }
  }

  function createPourAnimation(
    from: number,
    to: number
  ): PourAnimation | null {
    const board =
      boardRef.current;

    const source =
      tubeRefs.current[from];

    const target =
      tubeRefs.current[to];

    if (!board || !source || !target) {
      return null;
    }

    const boardRect =
      board.getBoundingClientRect();

    const sourceRect =
      source.getBoundingClientRect();

    const targetRect =
      target.getBoundingClientRect();

    const sourceCenterX =
      sourceRect.left +
      sourceRect.width / 2;

    const targetCenterX =
      targetRect.left +
      targetRect.width / 2;

    const sourceTop =
      sourceRect.top -
      boardRect.top;

    const targetTop =
      targetRect.top -
      boardRect.top;

    const dx =
      targetCenterX -
      sourceCenterX;

    /*
     * The ghost travels most of the distance
     * toward the receiving tube.
     */
    const moveX =
      dx * 0.72;

    /*
     * Lift before pouring.
     */
    const moveY =
      -Math.min(
        82,
        Math.max(
          42,
          Math.abs(dx) * 0.16
        )
      );

    const direction =
      dx >= 0 ? 1 : -1;

    const angle =
      direction *
      Math.min(
        58,
        Math.max(
          45,
          45 +
            Math.abs(dx) * 0.018
        )
      );

    const streamX =
      dx * 0.44;

    const streamY =
      Math.max(
        90,
        targetTop -
          sourceTop +
          110
      );

    const streamLength =
      Math.min(
        190,
        Math.max(
          105,
          Math.abs(dx) * 0.55 +
            85
        )
      );

    return {
      from,
      to,

      color:
        tubes[from][
          tubes[from].length - 1
        ],

      left:
        sourceRect.left -
        boardRect.left,

      top:
        sourceTop,

      moveX,
      moveY,
      angle,

      streamX,
      streamY,
      streamLength,
    };
  }

  function handleTubeClick(
    index: number
  ) {
    if (won || pouring) return;

    if (selected === null) {
      if (!tubes[index].length) {
        return;
      }

      setSelected(index);
      sound("tap");

      return;
    }

    if (selected === index) {
      setSelected(null);
      return;
    }

    const from = selected;

    if (!canPour(
      tubes,
      from,
      index
    )) {
      sound("bad");
      setSelected(null);
      return;
    }

    const next = pour(
      tubes,
      from,
      index
    );

    if (!next) return;

    const animation =
      createPourAnimation(
        from,
        index
      );

    if (!animation) {
      setTubes(next);
      setMoves(
        (value) => value + 1
      );
      setSelected(null);
      return;
    }

    setHistory((current) => [
      ...current,
      {
        from,
        to: index,
        previous:
          tubes.map((tube) => [
            ...tube,
          ]),
      },
    ]);

    setSelected(null);

    setPouring(animation);

    setReceiving(index);

    sound("pour");

    window.setTimeout(() => {
      setTubes(next);

      setMoves(
        (value) => value + 1
      );

      setPouring(null);

      window.setTimeout(() => {
        setReceiving(null);
      }, 180);

      if (isSolved(next)) {
        setWon(true);
        sound("win");
      }
    }, 1050);
  }

  function restart() {
    if (pouring) return;

    setTubes(
      generateLevel(level)
    );

    setSelected(null);
    setMoves(0);
    setHistory([]);
    setWon(false);
    setPouring(null);
    setReceiving(null);
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

    setMoves(
      (value) =>
        Math.max(0, value - 1)
    );

    setSelected(null);
    setWon(false);
  }

  function nextLevel() {
    if (pouring) return;

    const nextLevel =
      level + 1;

    setLevel(nextLevel);

    setTubes(
      generateLevel(nextLevel)
    );

    setSelected(null);
    setMoves(0);
    setHistory([]);
    setWon(false);
  }

  return (
    <main className="gamePage">
      <header className="header">
        <div className="logo">
          <div className="logoIcon">
            ∞
          </div>

          <div>
            <strong>
              1000 GAMES
            </strong>

            <small>
              GAME #001
            </small>
          </div>
        </div>

        <button
          className="soundButton"
          onClick={() =>
            setMuted(
              (value) => !value
            )
          }
          aria-label={
            muted
              ? "Enable sound"
              : "Disable sound"
          }
        >
          {muted
            ? "🔇"
            : "🔊"}
        </button>
      </header>

      <section className="gameContainer">
        <div className="heading">
          <div>
            <div className="eyebrow">
              LIQUID PUZZLE
            </div>

            <h1>
              Water Sorter
            </h1>

            <p>
              Sort every color into
              its own tube.
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
            disabled={
              pouring !== null
            }
          >
            ↻ Restart
          </button>
        </div>

        <div
          ref={boardRef}
          className="board"
        >
          {tubes.map(
            (tube, index) => (
              <button
                key={index}
                ref={(element) => {
                  tubeRefs.current[
                    index
                  ] = element;
                }}
                className={[
                  "tubeButton",
                  selected === index
                    ? "selected"
                    : "",
                  receiving === index
                    ? "receiving"
                    : "",
                  pouring?.from ===
                    index
                    ? "sourceHidden"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() =>
                  handleTubeClick(
                    index
                  )
                }
                aria-label={`Tube ${
                  index + 1
                }`}
                disabled={
                  pouring !== null
                }
              >
                <div className="tube">
                  <div className="tubeRim" />

                  <div className="glassReflection" />

                  <div className="water">
                    {tubeMarkup(
                      tube,
                      index
                    )}
                  </div>
                </div>

                <span className="tubeNumber">
                  {index + 1}
                </span>
              </button>
            )
          )}

          {pouring && (
            <div
              className="pourScene"
              aria-hidden="true"
            >
              <div
                className="pourGhost"
                style={
                  {
                    left:
                      `${pouring.left}px`,
                    top:
                      `${pouring.top}px`,
                    "--pour-x":
                      `${pouring.moveX}px`,
                    "--pour-y":
                      `${pouring.moveY}px`,
                    "--pour-angle":
                      `${pouring.angle}deg`,
                    "--stream-x":
                      `${pouring.streamX}px`,
                    "--stream-y":
                      `${pouring.streamY}px`,
                    "--stream-length":
                      `${pouring.streamLength}px`,
                  } as CSSProperties
                }
              >
                <div className="tube">
                  <div className="tubeRim" />

                  <div className="glassReflection" />

                  <div className="water">
                    {tubeMarkup(
                      tubes[
                        pouring.from
                      ],
                      pouring.from
                    )}
                  </div>
                </div>

                <div
                  className="pourStream"
                  style={
                    {
                      "--liquid-color":
                        COLORS[
                          pouring.color
                        ],
                    } as CSSProperties
                  }
                />
              </div>
            </div>
          )}
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
              Level {level} ·{" "}
              {moves} moves
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
        <span>
          ♾ Infinite Levels
        </span>

        <span>•</span>

        <span>
          Procedural Generation
        </span>

        <span>•</span>

        <span>
          Sound FX
        </span>
      </footer>
    </main>
  );
      }
