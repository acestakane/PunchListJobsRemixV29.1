import React, { useState } from "react";
import { Star, X } from "lucide-react";

export function ItineraryRatingModal({ data, onSubmit, onSkip, onClose }) {
  const [stars, setStars] = useState(0);
  const [review, setReview] = useState("");

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center px-4 pb-6 bg-black/50" data-testid="rating-modal">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 w-full max-w-md shadow-2xl relative">
        {/* Exit button */}
        <button
          onClick={onClose || onSkip}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          data-testid="rating-close-btn"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
        <h3 className="font-bold text-[#050A30] dark:text-white mb-3 flex items-center gap-2 pr-8">
          <Star className="w-4 h-4 text-amber-500" /> Rate {data.ratedName}
        </h3>
        <div className="flex gap-2 mb-3">
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} type="button" onClick={() => setStars(n)} data-testid={`star-${n}`}
              className={`p-1 transition-colors ${n <= stars ? "text-amber-400" : "text-slate-200 dark:text-slate-600"}`}>
              <Star className="w-7 h-7 fill-current" />
            </button>
          ))}
        </div>
        <textarea
          value={review}
          onChange={e => setReview(e.target.value)}
          rows={3}
          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0000FF] dark:bg-slate-800 dark:text-white mb-3 resize-none"
          placeholder="Leave a review (optional)…"
          data-testid="rating-review-input"
        />
        <div className="flex gap-2">
          <button
            onClick={() => stars > 0 && onSubmit(stars, review)}
            disabled={stars === 0}
            className="flex-1 py-2.5 rounded-xl font-bold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 transition-colors text-sm"
            data-testid="rating-submit-btn"
          >
            Submit Rating
          </button>
          <button
            onClick={onSkip}
            className="px-4 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-colors text-sm"
            data-testid="rating-skip-btn"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
