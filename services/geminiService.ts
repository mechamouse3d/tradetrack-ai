import { GoogleGenAI, Type } from "@google/genai";

/**
 * Helper to get an initialized AI instance.
 */
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Helper to reliably parse JSON from LLM responses which might include markdown or preamble.
 */
const cleanAndParseJSON = (text: string | undefined): any => {
  if (!text) return null;
  
  // 1. Remove markdown code blocks (```json ... ```)
  let clean = text.replace(/```json\s*|```/g, '').trim();
  
  // 2. Find the first JSON array or object if there is still extra text
  const match = clean.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (match) {
    clean = match[0];
  }

  try {
    return JSON.parse(clean);
  } catch (e) {
    console.error("Failed to parse Gemini response as JSON. Original text:", text);
    return null;
  }
};

export const parseTransactionWithAI = async (input: string): Promise<any> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Parse the following stock transaction details from the user input into a structured JSON object. 
      Input: "${input}"
      
      If information is missing, try to infer it reasonably (e.g., if no year, use current year) or leave it null.
      Strictly normalize 'type' to 'BUY' or 'SELL'.
      Currency should be inferred from exchange if possible (e.g., TSX -> CAD, NASDAQ -> USD), default to USD.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING, description: "YYYY-MM-DD format" },
            type: { type: Type.STRING, description: "BUY or SELL" },
            symbol: { type: Type.STRING, description: "Stock Ticker Symbol, e.g., AAPL" },
            name: { type: Type.STRING, description: "Company Name" },
            shares: { type: Type.NUMBER },
            price: { type: Type.NUMBER },
            account: { type: Type.STRING, description: "Account type like TFSA, RRSP, Cash" },
            exchange: { type: Type.STRING, description: "Exchange like NASDAQ, NYSE, TSX" },
            currency: { type: Type.STRING, description: "USD or CAD" }
          },
          required: ["type", "symbol", "shares", "price"]
        }
      }
    });

    return cleanAndParseJSON(response.text);
  } catch (error) {
    console.error("Gemini parsing error:", error);
    throw error;
  }
};

export const parseDocumentsWithAI = async (files: { mimeType: string; data: string }[]): Promise<any[]> => {
  try {
    const ai = getAI();
    const parts = files.map(file => {
      if (file.mimeType.includes('csv') || file.mimeType.includes('text') || file.mimeType.includes('excel')) {
        try {
          const textContent = new TextDecoder().decode(
            Uint8Array.from(atob(file.data), c => c.charCodeAt(0))
          );
          return { 
            text: `\n--- START OF DOCUMENT (${file.mimeType}) ---\n${textContent}\n--- END OF DOCUMENT ---\n` 
          };
        } catch (e) {
          console.warn("Failed to decode text document, falling back to blob", e);
        }
      }

      return {
        inlineData: {
          mimeType: file.mimeType,
          data: file.data
        }
      };
    });

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          ...parts,
          {
            text: `Analyze the provided documents and extract all stock purchase or sale transactions.
            Return a JSON ARRAY of transactions.
            Normalize strictly to "BUY" or "SELL". Infer tickers from names if needed.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        thinkingConfig: {
          thinkingBudget: 2000 
        },
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              date: { type: Type.STRING },
              type: { type: Type.STRING },
              symbol: { type: Type.STRING },
              name: { type: Type.STRING },
              shares: { type: Type.NUMBER },
              price: { type: Type.NUMBER },
              account: { type: Type.STRING },
              exchange: { type: Type.STRING },
              currency: { type: Type.STRING },
            },
            required: ["date", "type", "shares", "price", "name"]
          }
        }
      }
    });

    const result = cleanAndParseJSON(response.text);
    return Array.isArray(result) ? result : [];
  } catch (error) {
    console.error("Gemini document parsing error:", error);
    throw error;
  }
};

/**
 * Fetch current market prices using Google Search grounding.
 * Using gemini-3-flash-preview for better quota availability.
 */
export const fetchCurrentPrices = async (symbols: string[]): Promise<{ prices: Record<string, number>, sources: any[] }> => {
  if (symbols.length === 0) return { prices: {}, sources: [] };

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Get the exact realtime market price for these tickers: ${symbols.join(', ')}.
      
      Output the data as a JSON object where keys are the ticker symbols and values are the current share prices as numbers.
      Example: {"AAPL": 182.50, "TSLA": 175.20}
      
      Use strictly valid JSON format. If a price is found in a range (e.g. "between 100-110"), use the most recent spot price.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        thinkingConfig: {
          thinkingBudget: 0
        }
      }
    });

    const rawPrices = cleanAndParseJSON(response.text) || {};
    const normalizedPrices: Record<string, number> = {};
    
    Object.entries(rawPrices).forEach(([key, value]) => {
        if (value !== null && typeof value === 'number') {
            normalizedPrices[key.toUpperCase()] = value;
        }
    });
    
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    return { prices: normalizedPrices, sources };
  } catch (error) {
    console.error("Error fetching live prices:", error);
    throw error; // Let the caller handle it (e.g., App.tsx)
  }
};