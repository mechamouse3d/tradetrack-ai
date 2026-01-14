import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const parseTransactionWithAI = async (input: string): Promise<any> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Parse the following stock transaction details from the user input into a structured JSON object. 
      Input: "${input}"
      
      If information is missing, try to infer it reasonably (e.g., if no year, use current year) or leave it null.
      Assume 'Buy' if not specified.
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

    if (response.text) {
      return JSON.parse(response.text);
    }
    return null;
  } catch (error) {
    console.error("Gemini parsing error:", error);
    throw error;
  }
};

export const parseDocumentsWithAI = async (files: { mimeType: string; data: string }[]): Promise<any[]> => {
  try {
    const parts = files.map(file => ({
      inlineData: {
        mimeType: file.mimeType,
        data: file.data
      }
    }));

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          ...parts,
          {
            text: `Analyze the provided documents (images, PDFs, or CSVs) and extract all stock purchase or sale transactions.
            
            Return a JSON ARRAY of transactions.
            
            For each transaction found:
            1. **Date**: Extract the trade date or settlement date formatted as YYYY-MM-DD.
            2. **Type**: Identify if it is a BUY or SELL.
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

    if (response.text) {
      return JSON.parse(response.text);
    }
    return [];
  } catch (error) {
    console.error("Gemini document parsing error:", error);
    throw error;
  }
};
