import json
from multiprocessing import context

from dotenv import load_dotenv
from livekit import agents
from livekit.agents import AgentServer, AgentSession, Agent, function_tool, room_io
from livekit.agents.voice.events import RunContext
from livekit.plugins import openai, noise_cancellation

load_dotenv(".env.local")

MODE_PROMPTS = {
    "socratic": """
You are having a relaxed spoken conversation to check how well the user understood the material. Keep it natural — this is a chat, not an exam.

Move through the key ideas by asking questions. Don't linger on any one point — if you've probed it enough, move on. Aim to cover 3–5 key ideas across the conversation.

Good questions to mix in:
- "What did you make of that?"
- "Why do you think that is?"
- "Can you give me an example?"
- "How does that connect to [earlier point]?"
- "What would change if that wasn't true?"

If an answer is vague, ask one follow-up then move on. Don't loop on the same point.

Once you've covered the main ideas, call `submit_report` with:
- `overall_rating`: "Excellent", "Good", "Developing", or "Needs Work"
- `topic_scores`: one entry per idea you discussed — "topic", "score" (1–5), "feedback"
- `strengths`: what they did well
- `areas_for_improvement`: where they were weak or vague

Call submit_report before ending — do not skip it.
""",
}

BASE_INSTRUCTIONS = """
You are a voice-based understanding checker. You are testing the user's
comprehension of the following material through conversation.

Keep all responses concise and natural — you are speaking, not writing.

Core principles:
- Be interested: practise deep listening, not listening only for "the right answer".
- Suspend judgement: don't "yes/no" too early — avoid closing down thinking.
- The third turn matters: use your response after the learner speaks to open thinking further ("feed-forward"), not just evaluate.
- Encourage elaboration: "Go on", "Say more".
- Seek to understand: "What makes you say that?", "Can you give an example?", "What do you mean by…?", "How did you arrive at that?"
- Support connections and distinctions: link ideas, compare viewpoints.
- Push for reasons and evidence: justify, test consistency.
- Move on from a topic after a few questions, dont get stuck. Cover multiple key points in the material.
- Keep the conversation to no more than 5 minutes

<context>
{context}
</context>

<mode_instructions>
{mode_instructions}
</mode_instructions>
"""


class VoiceAgent(Agent):
    def __init__(self, context: str, mode: str):
        mode_instructions = MODE_PROMPTS[mode]
        instructions = BASE_INSTRUCTIONS.format(
            context=context,
            mode_instructions=mode_instructions,
        )
        super().__init__(instructions=instructions)
        
    @function_tool
    async def submit_report(
        self,
        ctx: RunContext,
        overall_rating: str,
        topic_scores: list[dict] | None = None,
        strengths: list[str] | None = None,
        areas_for_improvement: list[str] | None = None,
    ) -> str:
        """Submit a structured assessment report at the end of the session.

        Args:
            overall_rating: An overall rating such as "Excellent", "Good", "Developing", or "Needs Work".
            topic_scores: An array of objects with keys "topic", "score" (1-5), and "feedback" for each topic covered.
            strengths: An array of strings listing the user's key strengths.
            areas_for_improvement: An array of strings listing areas where the user can improve.
        """
        report = {
            "type": "report",
            "overallRating": overall_rating,
            "topicScores": topic_scores or [],
            "strengths": strengths or [],
            "areasForImprovement": areas_for_improvement or [],
        }

        room = ctx.session.room_io.room
        await room.local_participant.publish_data(
            payload=json.dumps(report),
            topic="report",
            reliable=True,
        )

        return "Report submitted successfully."


server = AgentServer()


@server.rtc_session()
async def entrypoint(ctx: agents.JobContext):
    await ctx.connect()
    await ctx.wait_for_participant()

    metadata = json.loads(ctx.room.metadata or "{}")
    context = metadata.get("context", "")
    mode = metadata.get("mode", "socratic")

    session = AgentSession(
        llm=openai.realtime.RealtimeModel(
            voice="alloy",
            model="gpt-realtime-mini",
        )
    )

    agent = VoiceAgent(context=context, mode=mode)

    await session.start(
        room=ctx.room,
        agent=agent,
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=noise_cancellation.BVC(),
            ),
        ),
    )

    await session.generate_reply(
        instructions="Using the material in the <context> block from your instructions, briefly introduce the topic you'll be discussing and ask your first question."
    )


if __name__ == "__main__":
    agents.cli.run_app(server)