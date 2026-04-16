const OpenAI = require("openai");

const aiClient = new OpenAI({
  apiKey: process.env.AI_API_KEY || "no-key",
  baseURL: process.env.AI_BASE_URL || "https://api.openai.com/v1",
});

const askBotForMove = async (cells) => {
  const boardDisplay = cells.map((c, i) => `${i}:${c}`).join(" ");

  try {
    const model = process.env.AI_MODEL || "gpt-4o-mini";

    const response = await aiClient.chat.completions.create({
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
  const empty = cells.reduce(
    (acc, c, i) => (c === "-" ? [...acc, i] : acc),
    [],
  );
  return empty[Math.floor(Math.random() * empty.length)];
};

module.exports = { askBotForMove };
