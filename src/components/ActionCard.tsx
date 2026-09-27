import React from 'react';
import { ActionLogItem } from '../types/assistant';
import { Phone, MessageSquare, ExternalLink, AppWindow, CheckCircle2, XCircle, Clock } from 'lucide-react';

interface ActionCardProps {
  action: ActionLogItem | null;
  onDismiss?: () => void;
}

export const ActionCard: React.FC<ActionCardProps> = ({ action, onDismiss }) => {
  if (!action) return null;

  const getActionIcon = () => {
    switch (action.action) {
      case 'openWhatsApp':
        return <MessageSquare className="w-5 h-5 text-emerald-400" />;
      case 'makeCall':
      case 'callContact':
        return <Phone className="w-5 h-5 text-indigo-400" />;
      case 'openUrl':
        return <ExternalLink className="w-5 h-5 text-sky-400" />;
      case 'openApp':
      default:
        return <AppWindow className="w-5 h-5 text-amber-400" />;
    }
  };

  const getStatusBadge = () => {
    switch (action.status) {
      case 'success':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-300 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" /> Done
          </span>
        );
      case 'failure':
        return (
          <span className="inline-flex items-center gap-1 text-xs text-rose-300 font-medium">
            <XCircle className="w-3.5 h-3.5" /> Failed
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs text-amber-300 font-medium animate-pulse">
            <Clock className="w-3.5 h-3.5" /> Executing
          </span>
        );
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto bg-slate-900/90 backdrop-blur-md border border-slate-700/60 rounded-xl p-3.5 shadow-xl transition-all animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-slate-800/90 border border-slate-700">
          {getActionIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              {action.action}
            </h4>
            {getStatusBadge()}
          </div>
          <p className="text-sm font-medium text-white truncate mt-0.5">
            {action.description}
          </p>
          {action.details?.error && (
            <p className="text-xs text-rose-300 mt-1 line-clamp-2">
              {action.details.error}
            </p>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-slate-400 hover:text-white p-1 text-xs"
            aria-label="Dismiss"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
};
