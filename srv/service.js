const cds = require("@sap/cds");
const OpenAI = require("openai");

const WINS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

const checkWinner = (cells) => {
  for (const [a, b, c] of WINS) {
    if (cells[a] !== "-" && cells[a] === cells[b] && cells[b] === cells[c]) {
      return cells[a];
    }
  }
  return cells.every((c) => c !== "-") ? "draw" : null;
};

const currentPlayer = (cells) =>
  cells.filter((c) => c === "X").length <= cells.filter((c) => c === "O").length
    ? "X"
    : "O";

const computeGameState = (game, session) => {
  if (session?.sessionWinner) return "SESSION_OVER";
  if (game.winner) return "MATCH_OVER";
  return "PLAYING";
};

const getAiClient = () => {
  return new OpenAI({
    apiKey: process.env.AI_API_KEY || "no-key",
    baseURL: process.env.AI_BASE_URL || "https://api.openai.com/v1",
  });
};

const askBotForMove = async (cells) => {
  const boardDisplay = cells
    .map((c, i) => `${i}:${c}`)
    .join(" ");

  try {
    const client = getAiClient();
    const model = process.env.AI_MODEL || "gpt-4o-mini";

    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are playing tic-tac-toe as O. Board positions are numbered 0-8 " +
            "(left-to-right, top-to-bottom). X and O are placed pieces; - is empty. " +
            "Reply with ONLY a single digit (0-8) for your move. Pick an empty (-) cell.",
        },
        {
          role: "user",
          content: `Current board: ${boardDisplay}. Your move (O)?`,
        },
      ],
      max_tokens: 5,
      temperature: 0.2,
    });

    const text = response.choices[0]?.message?.content?.trim() ?? "";
    const pos = parseInt(text, 10);
    if (!isNaN(pos) && pos >= 0 && pos <= 8 && cells[pos] === "-") {
      return pos;
    }
  } catch (err) {
    console.error("[Bot] AI API error:", err.message);
  }

  // Fallback: pick a random empty cell
  const empty = cells.reduce((acc, c, i) => (c === "-" ? [...acc, i] : acc), []);
  return empty[Math.floor(Math.random() * empty.length)];
};

module.exports = cds.service.impl(function () {
  const { Games, Sessions } = this.entities;

  this.on("newSession", async (req) => {
    const { bestOf, mode } = req.data;

    if (![3, 5, 7].includes(bestOf)) {
      return req.error(400, "bestOf must be 3, 5, or 7");
    }

    const validModes = ["HvH", "HvB"];
    const sessionMode = validModes.includes(mode) ? mode : "HvH";

    const entry = {
      ID: cds.utils.uuid(),
      bestOf,
      mode: sessionMode,
      xWins: 0,
      oWins: 0,
      draws: 0,
      sessionWinner: null,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    await INSERT.into(Sessions).entries(entry);
    return entry;
  });

  this.on("newGame", async (req) => {
    const { sessionId } = req.data;

    if (!sessionId) {
      return req.error(400, "sessionId is required");
    }

    const session = await SELECT.one.from(Sessions).where({ ID: sessionId });
    if (!session) return req.error(404, "Session not found");
    if (session.sessionWinner) return req.error(409, "Session already completed");

    const entry = {
      ID: cds.utils.uuid(),
      session_ID: sessionId,
      board: "---------",
      winner: null,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    await INSERT.into(Games).entries(entry);

    const cells = entry.board.split("");
    return {
      ...entry,
      currentPlayer: currentPlayer(cells),
      gameState: computeGameState(entry, session),
    };
  });

  this.on("makeMove", async (req) => {
    const { gameId, position } = req.data;

    if (position < 0 || position > 8) return req.error(400, "Invalid position");

    const game = await SELECT.one.from(Games).where({ ID: gameId });
    if (!game) return req.error(404, "Game not found");
    if (game.winner) return req.error(409, "Game over");

    const session = game.session_ID
      ? await SELECT.one.from(Sessions).where({ ID: game.session_ID })
      : null;

    // Apply human move
    const cells = game.board.split("");
    if (cells[position] !== "-") return req.error(409, "Cell already taken");

    cells[position] = currentPlayer(cells);
    let winner = checkWinner(cells);

    let botPosition = null;

    // In HvB mode let the bot reply if the game is still running
    if (!winner && session?.mode === "HvB") {
      botPosition = await askBotForMove(cells);
      if (botPosition !== null && botPosition !== undefined) {
        cells[botPosition] = "O";
        winner = checkWinner(cells);
      }
    }

    const updated = {
      board: cells.join(""),
      winner: winner ?? null,
      completedAt: winner ? new Date().toISOString() : null,
    };

    await UPDATE(Games).set(updated).where({ ID: gameId });

    if (winner && game.session_ID) {
      if (session) {
        const sessionUpdate = {};
        if (winner === "X") {
          sessionUpdate.xWins = session.xWins + 1;
        } else if (winner === "O") {
          sessionUpdate.oWins = session.oWins + 1;
        } else if (winner === "draw") {
          sessionUpdate.draws = session.draws + 1;
        }

        const winsNeeded = Math.floor(session.bestOf / 2) + 1;
        const newXWins = sessionUpdate.xWins ?? session.xWins;
        const newOWins = sessionUpdate.oWins ?? session.oWins;

        if (newXWins >= winsNeeded) {
          sessionUpdate.sessionWinner = "X";
          sessionUpdate.completedAt = new Date().toISOString();
        } else if (newOWins >= winsNeeded) {
          sessionUpdate.sessionWinner = "O";
          sessionUpdate.completedAt = new Date().toISOString();
        }

        await UPDATE(Sessions).set(sessionUpdate).where({ ID: game.session_ID });
      }
    }

    const updatedSession = game.session_ID
      ? await SELECT.one.from(Sessions).where({ ID: game.session_ID })
      : null;

    return {
      ...game,
      ...updated,
      currentPlayer: currentPlayer(cells),
      gameState: computeGameState({ ...game, ...updated }, updatedSession),
      botPosition,
    };
  });
});
