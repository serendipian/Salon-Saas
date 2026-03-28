import { GoogleGenAI } from "@google/genai";

// Note: VITE_GEMINI_API_KEY is exposed client-side. For production,
// move this to a Supabase Edge Function with the key stored as a secret.
const getAiClient = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const generateServiceDescription = async (serviceName: string, category: string, keywords: string): Promise<string> => {
  const ai = getAiClient();
  if (!ai) return "API Key Missing. Please configure your API Key.";

  try {
    const prompt = `
      You are a marketing expert for a high-end beauty salon.
      Write a short, alluring, and professional description (max 2 sentences) for a service named "${serviceName}" 
      in the category "${category}".
      Include these keywords subtly if possible: ${keywords}.
      Focus on the benefit to the client.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Could not generate description.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error communicating with AI assistant.";
  }
};
