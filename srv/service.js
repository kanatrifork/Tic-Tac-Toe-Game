const cds = require("@sap/cds");

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

module.exports = cds.service.impl(function () {
  const { Games } = this.entities;

  this.on("newGame", async () => {
    const entry = {
      ID: cds.utils.uuid(),
      board: "---------",
      winner: null,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    await INSERT.into(Games).entries(entry);
    return entry;
  });

  this.on("makeMove", async (req) => {
    const { gameId, position } = req.data;

    if (position < 0 || position > 8) return req.error(400, "Invalid position");

    const game = await SELECT.one.from(Games).where({ ID: gameId });
    if (!game) return req.error(404, "Game not found");
    if (game.winner) return req.error(409, "Game over");

    const cells = game.board.split("");

    cells[position] = currentPlayer(cells);
    const winner = checkWinner(cells);

    const updated = {
      board: cells.join(""),
      winner: winner ?? null,
      completedAt: winner ? new Date().toISOString() : null,
    };

    await UPDATE(Games).set(updated).where({ ID: gameId });

    return { ...game, ...updated };
  });
});
