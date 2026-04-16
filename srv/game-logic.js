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

const applyWinnerToSession = async (Sessions, session, winner, sessionId) => {
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

  await UPDATE(Sessions).set(sessionUpdate).where({ ID: sessionId });
  return sessionUpdate;
};

module.exports = { checkWinner, currentPlayer, computeGameState, applyWinnerToSession };
