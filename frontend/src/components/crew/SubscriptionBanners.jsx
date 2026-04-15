import React from "react";
import { AlertCircle, Clock } from "lucide-react";

/**
 * Renders subscription-related warning banners at the top of the Crew Dashboard.
 */
export function SubscriptionBanners({ isExpired, subStatus }) {
  return (
    <>
      {isExpired && (
        <div
          className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-xl p-3 mb-4 flex items-center gap-3"
          data-testid="subscription-expired-banner"
        >
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-red-700 dark:text-red-300">Subscription Expired</p>
            <p className="text-xs text-red-600 dark:text-red-400">Renew to accept jobs and appear on the map</p>
          </div>
          <a
            href="/subscription"
            className="bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors"
            data-testid="renew-subscription-btn"
          >
            Renew Now
          </a>
        </div>
      )}

      {subStatus?.status === "free" && subStatus.usage_remaining <= 1 && (
        <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 rounded-xl p-3 mb-4 flex items-center gap-3">
          <Clock className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            {subStatus.usage_remaining === 0 ? (
              <>Free plan limit reached.{" "}<a href="/subscription" className="ml-1 underline font-semibold">Upgrade to respond to more jobs.</a></>
            ) : (
              <><strong>{subStatus.usage_remaining} response</strong> remaining this month.{" "}<a href="/subscription" className="ml-1 underline font-semibold">Upgrade for unlimited.</a></>
            )}
          </p>
        </div>
      )}
    </>
  );
}
