Check Readme on Frontend Repo - https://github.com/abhinavtiwari77/xplainer-frontend

Backend service for Xplainer, an AI-powered educational platform that converts complex technical topics into simple, structured, and visual explanations.

The backend acts as the central orchestration layer between the frontend, AI models, speech generation, media generation, and persistence services.

🚀 Features
🤖 AI-powered explanations — Generates structured explanations based on the user's prompt.
🧠 Adaptive explanations — Adjusts explanation depth based on user feedback such as too basic, just right, or too advanced.
🎙️ Text-to-Speech — Converts generated explanations into natural audio narration.
🖼️ Visual generation — Generates image/visual prompts corresponding to explanation steps.
📡 Streaming responses — Uses NDJSON streaming to progressively send generated explanation data to the frontend instead of waiting for the complete response.
💬 Conversation management — Supports chat/session-based interactions so users can continue previous explanations.
🔄 AI orchestration — Coordinates multiple AI services instead of exposing individual AI providers directly to the frontend.
🛡️ Environment-based configuration — API keys and service credentials are managed through environment variables.
