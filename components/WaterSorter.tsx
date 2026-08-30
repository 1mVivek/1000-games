
"use client";

import {
  CSSProperties,
  useMemo,
  useRef,
  useState,
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
  angle: number;
  streamAngle: number;
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
    level < 15
      ? 2
      : level < 50
        ? 3
        : 4;

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
        seed +
          step * 31
      ) *
        candidates.length
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
): boolean {
  if (from === to) return false;

  const source = tubes[from];
  const target = tubes[to];

  if (!source.length) return false;

  if (target.length >= CAPACITY) {
    return false;
  }

  if (target.length === 0) {
    return true;
  }

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
    CAPACITY -
      next[to].length
  );

  const moved =
    next[from].splice(
      next[from].length - amount,
      amount
    );

  next[to].push(...moved);

  return next;
}

function getPourGeometry(
  fromElement: HTMLElement,
  toElement: HTMLElement
) {
  const source =
    fromElement.getBoundingClientRect();

  const target =
    toElement.getBoundingClientRect();

  const sourceX =
    source.left +
    source.width / 2;

  const sourceY =
    source.top + 8;

  const targetX =
    target.left +
    target.width / 2;

  const targetY =
    target.top + 10;

  const dx =
    targetX - sourceX;

  const dy =
    targetY - sourceY;

  const distance =
    Math.sqrt(
      dx * dx +
        dy * dy
    );

  /*
   * Tube tilt is deliberately limited.
   * This keeps the tube looking physical
   * instead of flipping sideways.
   */
  const angle =
    Math.max(
      -48,
      Math.min(
        48,
        dx >= 0
          ? 38
          : -38
      )
    );

  /*
   * A stream is vertical by default.
   * Convert it into the direction
   * between source and target.
   */
  const streamAngle =
    Math.atan2(
      dy,
      dx
    ) *
      (180 / Math.PI) -
    90;

  return {
    angle,
    streamAngle,
    streamLength:
      Math.max(
        55,
        Math.min(
          170,
          distance
        )
      ),
  };
}

export default function WaterSorter() {
  const [level, setLevel] =
    useState(1);

  const [tubes, setTubes] =
    useState<Tube[]>(() =>
      generateLevel(1)
    );

  const [selected, setSelected] =
    useState<number | null>(
      null
    );

  const [moves, setMoves] =
    useState(0);

  const [history, setHistory] =
    useState<Move[]>([]);

  const [won, setWon] =
    useState(false);

  const [muted, setMuted] =
    useState(false);

  const [pourAnimation, setPourAnimation] =
    useState<PourAnimation | null>(
      null
    );

  const tubeRefs =
    useRef<Array<HTMLButtonElement | null>>(
      []
    );

  const audioContext =
    useRef<AudioContext | null>(
      null
    );

  const difficulty =
    useMemo(() => {
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

      if (
        ctx.state ===
        "suspended"
      ) {
        void ctx.resume();
      }

      const oscillator =
        ctx.createOscillator();

      const gain =
        ctx.createGain();

      oscillator.connect(gain);

      gain.connect(
        ctx.destination
      );

      const frequencies = {
        tap: 430,
        pour: 190,
        bad: 110,
        win: 720,
      };

      oscillator.frequency.value =
        frequencies[type];

      oscillator.type =
        type === "bad"
          ? "square"
          : type === "win"
            ? "triangle"
            : "sine";

      const now =
        ctx.currentTime;

      const duration =
        type === "pour"
          ? 0.35
          : type === "win"
            ? 0.45
            : 0.12;

      gain.gain.setValueAtTime(
        0.0001,
        now
      );

      gain.gain.exponentialRampToValueAtTime(
        type === "pour"
          ? 0.045
          : 0.06,
        now + 0.015
      );

      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + duration
      );

      oscillator.start(now);

      oscillator.stop(
        now + duration
      );
    } catch {
      // Audio must never break gameplay.
    }
  }

  function handleTubeClick(
    index: number
  ) {
    if (won) return;

    /*
     * Currently animating a pour.
     * Ignore additional taps until
     * the physical animation finishes.
     */
    if (pourAnimation) return;

    if (selected === null) {
      if (
        tubes[index].length === 0
      ) {
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

    const from =
      selected;

    const sourceElement =
      tubeRefs.current[from];

    const targetElement =
      tubeRefs.current[index];

    if (
      !sourceElement ||
      !targetElement
    ) {
      setSelected(null);

      return;
    }

    const next =
      pour(
        tubes,
        from,
        index
      );

    if (!next) {
      sound("bad");

      setSelected(null);

      return;
    }

    const geometry =
      getPourGeometry(
        sourceElement,
        targetElement
      );

    const source =
      tubes[from];

    const color =
      source[
        source.length - 1
      ];

    setHistory(
      (current) => [
        ...current,
        {
          from,
          to: index,
          previous:
            tubes.map(
              (tube) => [
                ...tube,
              ]
            ),
        },
      ]
    );

    setPourAnimation({
      from,
      to: index,
      color,
      angle:
        geometry.angle,
      streamAngle:
        geometry.streamAngle,
      streamLength:
        geometry.streamLength,
    });

    setSelected(null);

    sound("pour");

    /*
     * Let the physical pour animation
     * play before changing the board.
     */
    window.setTimeout(() => {
      setTubes(next);

      setMoves(
        (value) =>
          value + 1
      );

      setPourAnimation(
        null
      );

      if (isSolved(next)) {
        setWon(true);

        sound("win");
      }
    }, 820);
  }

  function restart() {
    setTubes(
      generateLevel(level)
    );

    setSelected(null);

    setMoves(0);

    setHistory([]);

    setWon(false);

    setPourAnimation(null);
  }

  function undo() {
    if (pourAnimation) return;

    const last =
      history[
        history.length - 1
      ];

    if (!last) return;

    setTubes(
      last.previous.map(
        (tube) => [
          ...tube,
        ]
      )
    );

    setHistory(
      (current) =>
        current.slice(
          0,
          -1
        )
    );

    setMoves(
      (value) =>
        Math.max(
          0,
          value - 1
        )
    );

    setSelected(null);

    setWon(false);
  }

  function nextLevel() {
    if (pourAnimation) return;

    const nextLevelNumber =
      level + 1;

    setLevel(
      nextLevelNumber
    );

    setTubes(
      generateLevel(
        nextLevelNumber
      )
    );

    setSelected(null);

    setMoves(0);

    setHistory([]);

    setWon(false);

    setPourAnimation(null);
  }

  const sourceStyle =
    pourAnimation
      ? ({
          "--pour-angle":
            `${pourAnimation.angle}deg`,
        } as CSSProperties)
      : undefined;

  const streamStyle =
    pourAnimation
      ? ({
          "--stream-angle":
            `${pourAnimation.streamAngle}deg`,
          "--stream-length":
            `${pourAnimation.streamLength}px`,
          "--liquid-color":
            COLORS[
              pourAnimation.color
            ],
        } as CSSProperties)
      : undefined;

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
              (value) =>
                !value
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
              <span>
                LEVEL
              </span>

              <b>
                {level}
              </b>
            </div>

            <div>
              <span>
                MOVES
              </span>

              <b>
                {moves}
              </b>
            </div>

            <div>
              <span>
                MODE
              </span>

              <b>
                {difficulty}
              </b>
            </div>
          </div>
        </div>

        <div className="actions">
          <button
            onClick={undo}
            disabled={
              history.length ===
                0 ||
              Boolean(
                pourAnimation
              )
            }
          >
            ↶ Undo
          </button>

          <button
            onClick={restart}
            disabled={
              Boolean(
                pourAnimation
              )
            }
          >
            ↻ Restart
          </button>
        </div>

        <div className="board">
          {tubes.map(
            (
              tube,
              index
            ) => {
              const isSource =
                pourAnimation?.from ===
                index;

              const isTarget =
                pourAnimation?.to ===
                index;

              const classes = [
                "tubeButton",
                selected ===
                index
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
                .join(" ");

              return (
                <button
                  key={index}
                  ref={(element) => {
                    tubeRefs.current[
                      index
                    ] =
                      element;
                  }}
                  className={
                    classes
                  }
                  style={
                    isSource
                      ? sourceStyle
                      : undefined
                  }
                  onClick={() =>
                    handleTubeClick(
                      index
                    )
                  }
                  aria-label={`Tube ${
                    index + 1
                  }`}
                >
                  {isSource &&
                    pourAnimation && (
                      <div
                        className="pourStream"
                        style={
                          streamStyle
                        }
                      />
                    )}

                  <div className="tube">
                    <div className="tubeRim" />

                    <div className="glassReflection" />

                    <div className="water">
                      {tube.map(
                        (
                          color,
                          position
                        ) => (
                          <div
                            key={`${index}-${position}`}
                            className="waterLayer"
                            style={
                              {
                                "--liquid-color":
                                  COLORS[
                                    color
                                  ],
                                background:
                                  COLORS[
                                    color
                                  ],
                              } as CSSProperties
                            }
                          />
                        )
                      )}

                      {isSource &&
                        pourAnimation && (
                          <div
                            className="pouringLiquid"
                            style={
                              {
                                "--liquid-color":
                                  COLORS[
                                    pourAnimation.color
                                  ],
                              } as CSSProperties
                            }
                          />
                        )}
                    </div>
                  </div>

                  <span className="tubeNumber">
                    {index + 1}
                  </span>
                </button>
              );
            }
          )}
        </div>

        <div className="instruction">
          Tap a tube, then tap
          another tube to pour.
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
              onClick={
                nextLevel
              }
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
