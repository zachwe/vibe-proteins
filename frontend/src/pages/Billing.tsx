import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useCurrentUser, useDepositPresets, useGpuPricing, useTransactions, useCreateDeposit, queryKeys } from "../lib/hooks";
import { useQueryClient } from "@tanstack/react-query";

export default function Billing() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const { data: presets, isLoading: presetsLoading } = useDepositPresets();
  const { data: pricing, isLoading: pricingLoading } = useGpuPricing();
  const { data: transactions, isLoading: transactionsLoading } = useTransactions();
  const deposit = useCreateDeposit();

  const [customAmount, setCustomAmount] = useState("");

  const success = searchParams.get("success") === "true";
  const canceled = searchParams.get("canceled") === "true";

  // Refresh user data after successful purchase
  useEffect(() => {
    if (success) {
      queryClient.invalidateQueries({ queryKey: queryKeys.user });
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
    }
  }, [success, queryClient]);

  const handleDeposit = (amountCents: number) => {
    deposit.mutate(amountCents);
  };

  const handleCustomDeposit = () => {
    const amount = parseFloat(customAmount);
    if (!isNaN(amount) && amount >= 1 && amount <= 500) {
      deposit.mutate(Math.round(amount * 100));
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatCents = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  if (!user && !userLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Sign in to manage billing</h1>
          <Link to="/login" className="text-blue-400 hover:text-blue-300">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <Helmet>
        <title>Billing | ProteinDojo</title>
        <meta name="description" content="Manage your account balance and view GPU pricing on ProteinDojo." />
        <meta name="robots" content="noindex" />
      </Helmet>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link to="/challenges" className="text-blue-400 hover:text-blue-300">
            &larr; Back to Challenges
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-white mb-2">Billing</h1>

        {/* Current balance */}
        <div className="bg-slate-800 rounded-lg p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Current Balance</p>
              <p className="text-4xl font-bold text-white">
                {userLoading ? "..." : user?.balanceFormatted ?? "$0.00"}
              </p>
            </div>
            <div className="text-right text-slate-400 text-sm">
              <p>Pay-per-use billing</p>
              <p>Charged per GPU-second</p>
            </div>
          </div>
        </div>

        {/* Success/Cancel messages */}
        {success && (
          <div className="bg-green-500/10 border border-green-500 text-green-400 rounded-lg p-4 mb-8">
            Payment successful! Your balance has been updated.
          </div>
        )}
        {canceled && (
          <div className="bg-yellow-500/10 border border-yellow-500 text-yellow-400 rounded-lg p-4 mb-8">
            Payment was canceled. No funds were added.
          </div>
        )}

        {/* Add funds */}
        <h2 className="text-xl font-semibold text-white mb-4">Add Funds</h2>

        {presetsLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="bg-slate-800 rounded-lg p-6 mb-8">
            <div className="flex flex-wrap gap-3 mb-4">
              {presets?.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleDeposit(preset.amountCents)}
                  disabled={deposit.isPending}
                  className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="flex gap-3 items-center">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                <input
                  type="number"
                  min="1"
                  max="500"
                  step="0.01"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="Custom amount"
                  className="bg-slate-700 text-white pl-8 pr-4 py-2 rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none w-40"
                />
              </div>
              <button
                onClick={handleCustomDeposit}
                disabled={deposit.isPending || !customAmount || parseFloat(customAmount) < 1}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deposit.isPending ? "Processing..." : "Add Funds"}
              </button>
            </div>
            <p className="text-slate-500 text-sm mt-2">Min: $1.00, Max: $500.00</p>
          </div>
        )}

        {/* GPU Pricing */}
        <h2 className="text-xl font-semibold text-white mb-4">GPU Pricing</h2>

        {pricingLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="bg-slate-800 rounded-lg overflow-hidden mb-8">
            <table className="w-full">
              <thead>
                <tr className="text-left text-slate-400 text-sm border-b border-slate-700">
                  <th className="px-4 py-3">GPU</th>
                  <th className="px-4 py-3 text-right">Per Second</th>
                  <th className="px-4 py-3 text-right">Per Minute</th>
                </tr>
              </thead>
              <tbody>
                {pricing?.map((gpu) => (
                  <tr key={gpu.id} className="border-b border-slate-700 last:border-0">
                    <td className="px-4 py-3 text-white font-medium">{gpu.name}</td>
                    <td className="px-4 py-3 text-right text-slate-300">
                      ${gpu.ourRatePerSec.toFixed(6)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300">
                      ${gpu.ourRatePerMin.toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 bg-slate-700/50 text-slate-400 text-sm">
              Currently using A10G (~$0.024/min) for most jobs, A100 (~$0.045/min) for structure prediction
            </div>
          </div>
        )}

        {/* Transaction history */}
        <h2 className="text-xl font-semibold text-white mb-4">Transaction History</h2>

        {transactionsLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : transactions && transactions.length > 0 ? (
          <div className="bg-slate-800 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="text-left text-slate-400 text-sm border-b border-slate-700">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-slate-700 last:border-0">
                    <td className="px-4 py-3 text-slate-300 text-sm">
                      {formatDate(tx.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-white">
                      {tx.description || tx.type}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${
                      tx.amountCents > 0 ? "text-green-400" : "text-red-400"
                    }`}>
                      {tx.amountCents > 0 ? "+" : ""}{formatCents(tx.amountCents)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-400">
                      {tx.balanceAfterCents !== null ? formatCents(tx.balanceAfterCents) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-slate-800 rounded-lg p-8 text-center">
            <p className="text-slate-400">No transactions yet.</p>
            <p className="text-slate-500 text-sm mt-1">
              Your usage and deposits will appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
