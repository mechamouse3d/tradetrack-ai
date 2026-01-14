
export type TransactionType = 'BUY' | 'SELL';

export interface User {
  id: string;
  name: string;
  email: string;
  photoURL?: string;
}

export interface Transaction {
  id: string;
  date: string;
  type: TransactionType;
  account: string; // e.g., TFSA, RRSP
  exchange: string; // e.g., NASDAQ, TSX
  symbol: string;
  name: string;
  shares: number;
  price: number;
  currency: string;
}

export interface StockSummary {
  symbol: string;
  name: string;
  totalShares: number;
  avgCost: number;
  currentPrice: number | null;
  totalInvested: number; // For current holdings
  realizedPL: number;
  transactions: Transaction[];
}

export interface PortfolioStats {
  totalValue: number;
  totalCostBasis: number; // of currently held shares
  totalRealizedPL: number;
  totalUnrealizedPL: number;
}
