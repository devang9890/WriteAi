import os
from app.core.config import settings


class AIService:
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "")

    async def generate_content(self, prompt: str, task_type: str = "generate", tone: str = "professional") -> dict:
        """
        Generates or transforms text based on the task type and tone.
        Can be integrated with Google Gemini API or fallback to mock response for testing.
        """
        if self.api_key:
            try:
                from google import genai
                client = genai.Client(api_key=self.api_key)
                system_instruction = f"You are WriteAI, an elite writing assistant. Task: {task_type}. Tone: {tone}."
                response = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=f"{system_instruction}\n\nInput:\n{prompt}",
                )
                return {
                    "result": response.text,
                    "task_type": task_type,
                    "tone": tone,
                    "suggestions": ["Refine sentence variety", "Add more vivid examples"]
                }
            except Exception as e:
                # If API call fails, provide graceful fallback
                return {
                    "result": f"[Generated with WriteAI]: {prompt.strip()} (Tone: {tone})",
                    "task_type": task_type,
                    "tone": tone,
                    "suggestions": [f"API Notice: {str(e)}"]
                }

        # Mock intelligent completion if API key not configured yet
        return {
            "result": f"✨ WriteAI processed your content ({task_type} - {tone} tone):\n\n{prompt.strip()}",
            "task_type": task_type,
            "tone": tone,
            "suggestions": [
                "Consider strengthening the opening hook",
                "Ensure cohesive transitions between paragraphs"
            ]
        }


ai_service = AIService()
