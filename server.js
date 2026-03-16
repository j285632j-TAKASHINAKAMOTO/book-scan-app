import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
app.use(cors());
app.use(express.json());

const client = new OpenAI({
  apiKey: "ここにあなたのOPENAI_API_KEY"
});

app.post("/summary", async (req, res) => {
  const { title } = req.body;

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: "あなたは書籍紹介のプロです。80文字以内でわかりやすい要約を書いてください。"
        },
        {
          role: "user",
          content: `次の本を80文字で要約してください\n${title}`
        }
      ]
    });

    const summary = completion.choices[0].message.content;
    res.json({ summary });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "summary error" });
  }
});

app.listen(3000, () => {
  console.log("summary server running");
});
