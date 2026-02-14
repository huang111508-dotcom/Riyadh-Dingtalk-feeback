import { GoogleGenAI, Type } from "@google/genai";
import { ReportItem } from "../types";

export const parseDingTalkLogs = async (rawText: string): Promise<ReportItem[]> => {
  try {
    // Initialize AI client lazily to avoid top-level runtime errors if env vars aren't ready
    // We check for process to avoid ReferenceError in non-shimmed environments, 
    // though Vite usually handles this via define.
    const apiKey = typeof process !== 'undefined' ? process.env.API_KEY : '';
    
    if (!apiKey) {
      throw new Error("API Key is missing. Please check your configuration.");
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

    const text = response.text;
    if (!text) return [];

    const rawData = JSON.parse(text);
    
    // Add IDs for UI handling
    return rawData.map((item: any) => ({
      ...item,
      id: crypto.randomUUID()
    }));

  } catch (error) {
    console.error("Error parsing logs:", error);
    throw error;
  }
};
