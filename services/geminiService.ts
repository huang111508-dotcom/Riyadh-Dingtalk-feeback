import { GoogleGenAI, Type } from "@google/genai";
import { ReportItem } from "../types";

export const parseDingTalkLogs = async (rawText: string): Promise<ReportItem[]> => {
  try {
    // Access the API key injected by Vite during build.
    // We use a fallback to empty string to prevent runtime crashes if env var is missing.
    const apiKey = process.env.API_KEY || '';
    
    if (!apiKey) {
      throw new Error("API Key is missing. Please check your Vercel Environment Variables.");
    }

    const ai = new GoogleGenAI({ apiKey });

    const currentYear = new Date().getFullYear();
    const prompt = `
      You are a strict Data Parser for retail work reports.
      Your ONLY goal is to extract structured data. You must NOT act as an editor.

      **Context Info:**
      - **Current Year**: ${currentYear}.

      **Rules:**
      1. **Grouping**: One entry per person per day.
      2. **Department**: Classify into '蔬果', '水产', '肉品冻品', '熟食', '烘焙', '食百', '后勤', '仓库'.
         - '肉品冻品' includes fresh meat (pork/beef/mutton/poultry) and frozen packaged food.
         - '熟食' (Deli/Cooked Food) includes ready-to-eat meals, roast duck/chicken, cold dishes, steamed buns prepared on-site.
         - '烘焙' (Bakery) includes bread, cakes, pastries, cookies.
         - '仓库' includes warehouse, stock, receiving (收货).
         - Default to '后勤' if unclear.
      3. **Date**: YYYY-MM-DD format.

      4. **CRITICAL INSTRUCTION - CONTENT PRESERVATION**:
         - The 'content' field must be a **VERBATIM COPY** of what the user wrote.
         - **NEVER** merge lines. If the input has a list, the output MUST have a list with '\\n' characters.
         - **NEVER** delete numbers (1., 2., 3.).
         - **NEVER** fix grammar or remove spaces.
         
         **BAD Example (DO NOT DO THIS):**
         Input:
         1. Apple
         2. Banana
         Output JSON content: "1. Apple 2. Banana"  <-- WRONG! You merged lines.

         **GOOD Example (DO THIS):**
         Input:
         1. Apple
         2. Banana
         Output JSON content: "1. Apple\n2. Banana" <-- CORRECT! Newlines preserved.

      **Input Text to Parse:**
      ${rawText}
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              employeeName: { type: Type.STRING },
              date: { type: Type.STRING },
              department: { type: Type.STRING, enum: ['蔬果', '水产', '肉品冻品', '熟食', '烘焙', '食百', '后勤', '仓库'] },
              content: { type: Type.STRING }
            },
            required: ["employeeName", "date", "department", "content"]
          }
        }
      }
    });

    let text = response.text;
    if (!text) throw new Error("AI returned empty response.");

    // CLEANUP: Remove Markdown code blocks (```json ... ```) which Gemini sometimes adds
    // even when responseMimeType is set to application/json
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    let rawData;
    try {
      rawData = JSON.parse(text);
    } catch (e) {
      console.error("JSON Parse Error. Raw Text:", text);
      throw new Error("Failed to parse AI response. The model output was not valid JSON.");
    }
    
    if (!Array.isArray(rawData)) {
       throw new Error("AI response was not a list of reports.");
    }

    // Add IDs for UI handling
    return rawData.map((item: any) => ({
      ...item,
      id: crypto.randomUUID()
    }));

  } catch (error: any) {
    console.error("Error parsing logs:", error);
    // Throw the specific error message so UI can display it
    throw new Error(error.message || "Unknown error occurred during parsing.");
  }
};