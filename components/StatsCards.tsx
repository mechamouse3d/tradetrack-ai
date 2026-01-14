import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, Wallet } from 'lucide-react';
import { PortfolioStats } from '../types';

interface StatsCardsProps {
  stats: PortfolioStats;
}

const StatsCards: React.FC<StatsCardsProps> = ({ stats }) => {
  const { totalValue, totalCostBasis, totalRealizedPL, totalUnrealizedPL } = stats;
  
  const unrealizedPercent = totalCostBasis > 0 ? (totalUnrealizedPL / totalCostBasis) * 100 : 0;
  const isUnrealizedPositive = totalUnrealizedPL >= 0;
  const isRealizedPositive = totalRealizedPL >= 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Portfolio Value */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-slate-500 text-sm font-medium">Portfolio Value</h3>
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <Wallet size={20} />
          </div>
        </div>
        <div className="text-2xl font-bold text-slate-900">
          ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <p className="text-xs text-slate-400 mt-1">Total Assets Held</p>
      </div>

      {/* Unrealized P/L */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-slate-500 text-sm font-medium">Unrealized P/L</h3>
          <div className={`p-2 rounded-lg ${isUnrealizedPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            {isUnrealizedPositive ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
          </div>
        </div>
        <div className={`text-2xl font-bold ${isUnrealizedPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
          {isUnrealizedPositive ? '+' : ''}${totalUnrealizedPL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <p className={`text-xs mt-1 font-medium ${isUnrealizedPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
          {isUnrealizedPositive ? '+' : ''}{unrealizedPercent.toFixed(2)}% Return
        </p>
      </div>

      {/* Realized P/L */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-slate-500 text-sm font-medium">Realized P/L</h3>
          <div className={`p-2 rounded-lg ${isRealizedPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            <DollarSign size={20} />
          </div>
        </div>
        <div className={`text-2xl font-bold ${isRealizedPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
          {isRealizedPositive ? '+' : ''}${totalRealizedPL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <p className="text-xs text-slate-400 mt-1">Locked in profits/losses</p>
      </div>

      {/* Total Cost Basis */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-slate-500 text-sm font-medium">Total Cost Basis</h3>
          <div className="p-2 bg-slate-50 text-slate-600 rounded-lg">
            <DollarSign size={20} />
          </div>
        </div>
        <div className="text-2xl font-bold text-slate-900">
          ${totalCostBasis.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <p className="text-xs text-slate-400 mt-1">Invested Capital</p>
      </div>
    </div>
  );
};

export default StatsCards;
