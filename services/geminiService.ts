
import { GoogleGenAI, Type } from "@google/genai";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const cleanAndParseJSON = (text: string | undefined): any => {
  if (!text) return null;
  let clean = text.replace(/```json\s*|```/g, '').trim();
  const match = clean.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (match) clean = match[0];
  try {
    return JSON.parse(clean);
  } catch (e) {
    console.error("JSON Parse Error:", text);
    return null;
  }
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Handles retries specifically for 429 errors with exponential backoff and jitter.
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 2, baseDelay = 3000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isRateLimit = error?.message?.includes("429") || error?.status === 429 || error?.message?.includes("RESOURCE_EXHAUSTED");
    if (isRateLimit && retries > 0) {
      const delay = baseDelay + Math.random() * 1000; // Add jitter
      console.warn(`Quota exceeded. Retrying in ${Math.round(delay)}ms... (${retries} left)`);
      await wait(delay);
      return withRetry(fn, retries - 1, baseDelay * 2);
    }
    throw error;
  }
}

export const parseTransactionWithAI = async (input: string): Promise<any> => {
  return withRetry(async () => {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Parse into JSON: "${input}". Fields: date, type(BUY/SELL), symbol, name, shares, price, account, exchange, currency.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
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
            currency: { type: Type.STRING }
          },
          required: ["type", "symbol", "shares", "price"]
        }
      }
    });
    return cleanAndParseJSON(response.text);
  });
};

export const parseDocumentsWithAI = async (files: { mimeType: string; data: string }[]): Promise<any[]> => {
  return withRetry(async () => {
    const ai = getAI();
    const parts = files.map(file => {
      if (file.mimeType.includes('csv') || file.mimeType.includes('text') || file.mimeType.includes('excel')) {
        try {
          const textContent = new TextDecoder().decode(Uint8Array.from(atob(file.data), c => c.charCodeAt(0)));
          return { text: `\n--- DOC ---\n${textContent}\n` };
        } catch (e) { console.warn("Fallback to blob", e); }
      }
      return { inlineData: { mimeType: file.mimeType, data: file.data } };
    });

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [...parts, { text: `Return JSON array of BUY/SELL transactions. Mandatory: symbol, exchange, type, shares, price, name, date.` }]
      },
      config: {
        responseMimeType: "application/json",
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
            required: ["date", "type", "symbol", "shares", "price", "name", "exchange"]
          }
        }
      }
    });
    return cleanAndParseJSON(response.text) || [];
  });
};

export const fetchCurrentPrices = async (
  symbols: string[]
): Promise<{ prices: Record<string, number>, sources: any[] }> => {
  if (symbols.length === 0) return { prices: {}, sources: [] };

  return withRetry(async () => {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Stock prices for: ${symbols.join(', ')}. Please provide the data in a clear JSON format like this: {"TICKER": price}. Use current market data from Google Search.`,
      config: {
        tools: [{ googleSearch: {} }],
        // responseMimeType: "application/json" is not supported when using tools like googleSearch
      }
    });

    const rawPrices = cleanAndParseJSON(response.text) || {};
    const normalizedPrices: Record<string, number> = {};
    Object.entries(rawPrices).forEach(([key, value]) => {
      if (typeof value === 'number') normalizedPrices[key.toUpperCase()] = value;
    });
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    return { prices: normalizedPrices, sources };
  }, 1, 5000);
};
