import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { SummarySchema } from '@/lib/schemas';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SUMMARY_PROMPT = `Read the provided content and produce a structured JSON summary with this exact schema:
{
  "title": "string — the title or topic of the content",
  "mainClaims": [
    { "claim": "string — a key claim or argument", "evidence": "string — supporting evidence from the text" }
  ],
  "summary": "string — a concise 2-3 sentence summary"
}

Return ONLY valid JSON, no markdown fences or extra text. Include 3-6 main claims.`;

export async function POST(req: Request) {
  try {
    const { url, text } = await req.json();

    if (!url && !text) {
      return NextResponse.json({ error: 'Provide a url or text' }, { status: 400 });
    }

    let result: string;

    if (url) {
      const response = await openai.responses.create({
        model: 'gpt-4o-mini',
        tools: [{ type: 'web_search_preview' }],
        input: `Read this URL and summarize its content:\n${url}\n\n${SUMMARY_PROMPT}`,
      });

      result = response.output_text;
    } else {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SUMMARY_PROMPT },
          { role: 'user', content: text },
        ],
      });

      result = response.choices[0]?.message?.content ?? '';
    }

    const cleaned = result.replace(/```json\n?|```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    const summary = SummarySchema.parse(parsed);

    return NextResponse.json(summary);
  } catch (error) {
    console.error('Summarize error:', error);
    const message = error instanceof Error ? error.message : 'Failed to summarize';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
