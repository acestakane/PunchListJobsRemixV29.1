/**
 * useRatingSubmit — custom hook that encapsulates the contractor crew-rating
 * submission workflow, extracted from ContractorDashboard.jsx for maintainability.
 */
import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { getErr } from "../../utils/errorUtils";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export function useRatingSubmit({ onSuccess }) {
  const [ratingSubmitting, setRatingSubmitting] = useState(false);

  const submitRatings = async (job, ratings, reviews, skippedSet = new Set()) => {
    if (!job?.id) { toast.error("Invalid job data"); return; }
    if (ratingSubmitting) { toast.warning("Rating submission in progress..."); return; }

    const crewAccepted = job.crew_accepted || [];
    if (crewAccepted.length === 0) { toast.error("No crew members to rate"); return; }

    const hasRating = crewAccepted.some(id => (ratings[id] || 0) > 0);
    const hasSkip = skippedSet.size > 0;
    if (!hasRating && !hasSkip) {
      toast.error("Please rate or skip at least one crew member");
      return;
    }

    setRatingSubmitting(true);
    try {
      let ratedCount = 0;
      let skippedCount = 0;
      const errors = [];

      for (const crewId of crewAccepted) {
        if (!crewId) continue;
        const stars = ratings[crewId] || 0;

        if (stars > 0 && !skippedSet.has(crewId)) {
          if (stars < 1 || stars > 5) { errors.push(`Invalid rating (${stars} stars)`); continue; }
          try {
            await axios.post(`${API}/jobs/${job.id}/rate`, {
              rated_id: crewId, job_id: job.id, stars, review: reviews[crewId] || "",
            });
            ratedCount++;
          } catch (e) {
            const msg = e?.response?.data?.detail || "";
            if (msg.includes("Already rated") || msg.includes("Already handled")) { ratedCount++; }
            else if (msg.includes("not pending review") || msg.includes("not completed")) {
              errors.push("Job must be completed before rating"); throw e;
            } else { errors.push(`Failed to rate: ${msg}`); }
          }
        }
      }

      for (const crewId of crewAccepted) {
        if (!crewId) continue;
        const stars = ratings[crewId] || 0;
        if (stars === 0 || skippedSet.has(crewId)) {
          try {
            await axios.post(`${API}/jobs/${job.id}/rate/skip`, { crew_id: crewId });
            skippedCount++;
          } catch (e) {
            const msg = e?.response?.data?.detail || "";
            if (msg.includes("Already") || msg.includes("cannot skip")) { skippedCount++; }
            else { console.warn(`Skip failed for ${crewId}:`, msg); }
          }
        }
      }

      if (errors.length > 0) { toast.error(`Rating errors: ${errors.join(", ")}`); return; }
      if (ratedCount === 0 && skippedCount === 0) { toast.warning("No ratings submitted. Please try again."); return; }

      const parts = [];
      if (ratedCount > 0) parts.push(`${ratedCount} rated`);
      if (skippedCount > 0) parts.push(`${skippedCount} skipped`);
      toast.success(`Ratings submitted! (${parts.join(", ")})`);
      onSuccess?.();
    } catch (e) {
      const detail = getErr(e, "Failed to submit ratings");
      if (detail.includes("not completed") || detail.includes("pending review")) {
        toast.error("Job must be verified complete before rating crew");
      } else if (detail.includes("Not part of this job")) {
        toast.error("You are not authorized to rate this job");
      } else {
        toast.error(detail);
      }
    } finally {
      setRatingSubmitting(false);
    }
  };

  return { submitRatings, ratingSubmitting };
}
