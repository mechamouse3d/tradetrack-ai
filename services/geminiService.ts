
import { GoogleGenAI, Type } from "@google/genai";

/**
 * Strictly adhering to initialization guidelines:
 * Always use const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
 */
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
    console.error("Failed to parse Gemini response:", text);
    return null;
  }
};

export const parseTransactionWithAI = async (input: string): Promise<any> => {
  try {
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
    const parts = files.map(file => {
      // Robust handling for CSV/Text files: Send as text parts rather than inlineData blobs.
      // This avoids MIME type compatibility issues with the Vision/Multimodal encoder.
      if (file.mimeType.includes('csv') || file.mimeType.includes('text') || file.mimeType.includes('excel')) {
        try {
          // Decode base64 to text
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

      // Default: Send as inlineData (Images, PDFs)
      return {
        inlineData: {
          mimeType: file.mimeType,
          data: file.data
        }
      };
    });

    // Use gemini-3-pro-preview for complex reasoning and multi-document analysis tasks.
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: {
        parts: [
          ...parts,
          {
            text: `Analyze the provided documents (images, PDFs, or CSVs) and extract all stock purchase or sale transactions.
            
            Return a JSON ARRAY of transactions.
            
            For each transaction found:
            1. **Date**: Extract the trade date or settlement date formatted as YYYY-MM-DD.
            2. **Type**: Identify if it is a BUY or SELL. Normalize strictly to "BUY" or "SELL".
            3. **Symbol**: Extract the ticker symbol. If the symbol is not explicitly listed, INFER it from the Company Name (e.g., "Bank of Nova Scotia" -> "BNS").
            4. **Name**: The full company name.
            5. **Shares**: The quantity of shares.
            6. **Price**: The price per share.
            7. **Account**: The account type or number (e.g., "TFSA", "RRSP", "Cash", or "669-747...").
            8. **Currency**: Extract currency (e.g., USD, CAD). If price shows "C$" or similar, use CAD.
            9. **Exchange**: Infer the exchange if possible (e.g., TSX for Canadian stocks, NASDAQ/NYSE for US), otherwise leave null.

            Ignore non-trade rows like dividends, interest, or headers.
            `
          }
        ]
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
 */
export const fetchCurrentPrices = async (symbols: string[]): Promise<{ prices: Record<string, number>, sources: any[] }> => {
  if (symbols.length === 0) return { prices: {}, sources: [] };

  try {
    // Search grounding is a complex task; upgrade to gemini-3-pro-preview.
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `You are a financial data API.
      Task: Get the realtime price for these tickers: ${symbols.join(', ')}.
      
      Output strictly valid JSON:
      {
        "AAPL": 150.25,
        "TSLA": 200.50
      }
      
      Rules:
      1. Use the EXACT ticker symbols provided as keys.
      2. Values must be numbers.
      3. No markdown formatting.
      4. If a price is unavailable, use null.
      `,
      config: {
        tools: [{ googleSearch: {} }],
        // Grounding Metadata will contain the source citations.
      }
    });

    // Use the robust parser
    const rawPrices = cleanAndParseJSON(response.text) || {};
    
    // Normalize keys to uppercase to match application state
    const normalizedPrices: Record<string, number> = {};
    Object.entries(rawPrices).forEach(([key, value]) => {
        if (value !== null && typeof value === 'number') {
            normalizedPrices[key.toUpperCase()] = value;
        }
    });
    
    // Extract sources for display as required by search grounding guidelines.
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    return { prices: normalizedPrices, sources };
  } catch (error) {
    console.error("Error fetching live prices:", error);
    return { prices: {}, sources: [] };
  }
};
