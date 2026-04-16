const cds = require("@sap/cds");
const {
  checkWinner,
  currentPlayer,
  computeGameState,
  applyWinnerToSession,
} = require("./game-logic");
const { askBotForMove } = require("./bot");

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

    const cells = game.board.split("");
    if (cells[position] !== "-") return req.error(409, "Cell already taken");

    cells[position] = currentPlayer(cells);
    const winner = checkWinner(cells);

    const updated = {
      board: cells.join(""),
      winner: winner ?? null,
      completedAt: winner ? new Date().toISOString() : null,
    };

    await UPDATE(Games).set(updated).where({ ID: gameId });

    let updatedSession = session;
    if (winner && game.session_ID && session) {
      const sessionUpdate = await applyWinnerToSession(Sessions, session, winner, game.session_ID);
      updatedSession = { ...session, ...sessionUpdate };
    }

    return {
      ...game,
      ...updated,
      currentPlayer: currentPlayer(cells),
      gameState: computeGameState({ ...game, ...updated }, updatedSession),
    };
  });

  this.on("botMove", async (req) => {
    const { gameId } = req.data;

    const game = await SELECT.one.from(Games).where({ ID: gameId });
    if (!game) return req.error(404, "Game not found");
    if (game.winner) return { ...game, gameState: computeGameState(game, null) };

    const session = game.session_ID
      ? await SELECT.one.from(Sessions).where({ ID: game.session_ID })
      : null;

    const cells = game.board.split("");
    const botPosition = await askBotForMove(cells);

    if (botPosition === null || botPosition === undefined) {
      return req.error(500, "Bot could not determine a move");
    }

    cells[botPosition] = "O";
    const winner = checkWinner(cells);

    const updated = {
      board: cells.join(""),
      winner: winner ?? null,
      completedAt: winner ? new Date().toISOString() : null,
    };

    await UPDATE(Games).set(updated).where({ ID: gameId });

    let updatedSession = session;
    if (winner && game.session_ID && session) {
      const sessionUpdate = await applyWinnerToSession(Sessions, session, winner, game.session_ID);
      updatedSession = { ...session, ...sessionUpdate };
    }

    return {
      ...game,
      ...updated,
      currentPlayer: currentPlayer(cells),
      gameState: computeGameState({ ...game, ...updated }, updatedSession),
      botPosition,
    };
  });
});
