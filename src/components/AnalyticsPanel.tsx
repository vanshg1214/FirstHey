import React, { useState, useEffect } from 'react';
import { Sparkles, Activity, TrendingUp, Users, Target, Lightbulb, AlertTriangle } from 'lucide-react';

interface AnalyticsPanelProps {
  campaignId: string;
}

export default function AnalyticsPanel({ campaignId }: AnalyticsPanelProps) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await fetch(`/api/campaigns/analytics?campaignId=${campaignId}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setAnalytics(data.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAnalytics();
  }, [campaignId]);

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 rounded-2xl animate-pulse mt-8">
        <div className="h-6 w-48 bg-white/10 rounded mb-4"></div>
        <div className="h-4 w-full bg-white/5 rounded mb-2"></div>
        <div className="h-4 w-3/4 bg-white/5 rounded"></div>
      </div>
    );
  }

  if (error || !analytics?.insights) {
    return null; // Silent fail if analytics can't load, keeping main UI clean
  }

  const { insights } = analytics;

  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 rounded-2xl border border-blue-500/30 mt-8 relative overflow-hidden group">
      {/* Decorative gradient */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -z-10 group-hover:bg-blue-500/20 transition-all duration-700"></div>

      <div className="flex items-center space-x-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-slate-900 shadow-lg shadow-blue-500/20">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">AI Campaign Insights</h2>
          <p className="text-sm text-slate-500">Powered by Gemini 1.5</p>
        </div>
      </div>

      <p className="text-slate-700 leading-relaxed mb-6">
        {insights.summary}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white/5 border border-slate-200 rounded-xl p-4 flex items-start space-x-3">
          <Target className="w-5 h-5 text-rose-400 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Top Pain Point</h4>
            <p className="text-sm text-slate-900 font-medium">{insights.top_pain_point}</p>
          </div>
        </div>
        <div className="bg-white/5 border border-slate-200 rounded-xl p-4 flex items-start space-x-3">
          <Users className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Best Target Persona</h4>
            <p className="text-sm text-slate-900 font-medium">{insights.best_target_persona}</p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center">
          <Lightbulb className="w-4 h-4 mr-2 text-yellow-400" />
          Actionable Recommendations
        </h3>
        <ul className="space-y-3">
          {(insights.recommendations || []).map((rec: string, index: number) => (
            <li key={index} className="flex items-start text-sm text-slate-700 bg-white/5 rounded-lg p-3 border border-slate-200">
              <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold mr-3 mt-0.5 flex-shrink-0">
                {index + 1}
              </span>
              {rec}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
