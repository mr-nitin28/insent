"use client";

import { Clock, Send, AlertTriangle, ShieldCheck, Inbox, Activity } from "lucide-react";
import type { DashboardStats } from "./types";

interface StatsCardsProps {
  stats: DashboardStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      label: "Pending in Queue",
      value: stats.pending,
      icon: Clock,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      label: "In-Flight Sending",
      value: stats.sending,
      icon: Activity,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
    },
    {
      label: "Sent Today",
      value: stats.sentToday,
      icon: Send,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
    {
      label: "Safety Halted (Unknown)",
      value: stats.unknownDelivery,
      icon: ShieldCheck,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      label: "Permanent Errors",
      value: stats.failed,
      icon: AlertTriangle,
      color: "text-rose-600",
      bgColor: "bg-rose-50",
    },
    {
      label: "Total Lifetime Runs",
      value: stats.total,
      icon: Inbox,
      color: "text-slate-600",
      bgColor: "bg-slate-100",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 sm:grid-cols-3 lg:grid-cols-6 mb-6 sm:mb-8">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="group rounded-2xl border border-slate-200/70 bg-white p-3.5 sm:p-4 shadow-[0_1px_3px_rgba(15,23,42,0.03),0_4px_14px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300/80 hover:shadow-[0_4px_18px_rgba(15,23,42,0.07)]"
          >
            <div className="flex items-center justify-between">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-xl border border-slate-100 ${card.bgColor} ${card.color} shadow-[0_1px_2px_rgba(0,0,0,0.02)]`}
              >
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2.5 sm:mt-3">
              <div className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-800 tabular-nums">
                {card.value}
              </div>
              <div className="mt-1 text-[11px] sm:text-xs leading-snug sm:leading-normal font-normal text-slate-500 line-clamp-2 sm:line-clamp-1 group-hover:text-slate-600 transition-colors">
                {card.label}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
