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
You are conducting a Socratic comprehension session. Your goal is to test and deepen the user's understanding through questioning — never lecturing.

## Phase 1: Opening
Briefly state the topic and tell the user you'll work through it together. Keep it to one or two sentences.

## Phase 2: Comprehension Loop
Pick one important claim or section at a time from the context. Work through these stages, adapting based on response quality:

A) Clarify — check the user can articulate the idea
   "When you say ___, what do you mean exactly?"
   "Can you give a concrete example from the text?"

B) Probe reasoning — push for evidence from the source
   "What in the text led you to that conclusion?"
   "Which part supports that most strongly?"

C) Uncover assumptions — surface implicit premises
   "What has to be true for that to work?"
   "What is the author taking for granted there?"

D) Alternatives — test flexibility of understanding
   "What's another plausible interpretation?"
   "When might this not hold?"

E) Implications — extend understanding forward
   "If that's right, what follows?"
   "What would you do differently because of it?"

F) Synthesis — connect across sections
   "How does this connect to the earlier section about ___?"
   "What's the thread tying these points together?"

### Adaptive rules
- Ask ONE question, then wait for the user's response.
- After each answer, decide the next move:
  - Strong answer: go deeper (B -> C -> E)
  - Vague answer: return to Clarify and ask for an example
  - Incorrect answer: ask for evidence and reconcile ("Where in the text do you see that?" / "How does that fit with ___?")
- Cover the key claims in the context before moving to Phase 3.

## Phase 3: Confidence and Gaps
Once the loop has covered the key claims, ask:
- "Which part feels most solid?"
- "Which part feels least clear?"
- "What question would you ask the author?"

## Phase 4: Final Check (Teach-back)
- "Explain it back to me as if I haven't read it — 30 seconds."
- Then: "What would you say is the single most important takeaway?"

## Phase 5: Submit Report
After Phase 4 is complete, you MUST call the `submit_report` tool to send a structured assessment.
Fill in the report based on the entire conversation. Be honest and specific in your feedback.

## Important rules
- Keep your responses concise and conversational — this is voice, not text.
- Never lecture or explain the material yourself. Your job is to ask, not tell.
- If the user is struggling, guide them with narrower questions rather than giving answers.
- Be encouraging but honest. Acknowledge good answers, gently redirect weak ones.
- After Phase 4 is done, always call submit_report before ending the session.
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
    print("CONTEXT:", {context})
    @function_tool
    async def submit_report(
        self,
        ctx: RunContext,
        overall_rating: str,
        topic_scores: str,
        strengths: str,
        areas_for_improvement: str,
    ) -> str:
        """Submit a structured assessment report at the end of the session.

        Args:
            overall_rating: An overall rating such as "Excellent", "Good", "Developing", or "Needs Work".
            topic_scores: A JSON array of objects with keys "topic", "score" (1-5), and "feedback" for each topic covered.
            strengths: A JSON array of strings listing the user's key strengths.
            areas_for_improvement: A JSON array of strings listing areas where the user can improve.
        """
        report = {
            "type": "report",
            "overallRating": overall_rating,
            "topicScores": json.loads(topic_scores),
            "strengths": json.loads(strengths),
            "areasForImprovement": json.loads(areas_for_improvement),
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
        instructions="Introduce the topic briefly and begin Phase 1."
    )


if __name__ == "__main__":
    agents.cli.run_app(server)
