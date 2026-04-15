import React from "react";
import { ImagePlus, Trash2 } from "lucide-react";

export function ProfilePortfolioSection({ portfolio, portfolioRef, uploadingPortfolio, onUpload, onRemove, getImageUrl }) {
  return (
    <div className="card p-6" data-testid="portfolio-section">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-[#050A30] dark:text-white text-lg" style={{ fontFamily: "Manrope, sans-serif" }}>Portfolio</h3>
          <p className="text-xs text-slate-400">{portfolio.length}/8 images</p>
        </div>
        {portfolio.length < 8 && (
          <button onClick={() => portfolioRef.current?.click()} disabled={uploadingPortfolio}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#050A30] text-white rounded-lg text-xs font-bold hover:bg-[#0a1240] disabled:opacity-60"
            data-testid="portfolio-upload-btn">
            <ImagePlus className="w-3.5 h-3.5" />
            {uploadingPortfolio ? "Uploading..." : "Add Photo"}
          </button>
        )}
        <input ref={portfolioRef} type="file" accept="image/*" className="hidden" onChange={onUpload} />
      </div>

      {portfolio.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center">
          <ImagePlus className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">Add photos of your work to attract more contractors</p>
          <button onClick={() => portfolioRef.current?.click()}
            className="mt-3 text-xs text-[#0000FF] font-semibold hover:underline"
            data-testid="portfolio-empty-upload-btn">
            Upload first photo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {portfolio.map((url, i) => (
            <div key={url || i} className="relative group aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800" data-testid={`portfolio-img-${i}`}>
              <img src={getImageUrl(url)} alt={`Portfolio ${i + 1}`}
                className="w-full h-full object-cover"
                onError={e => { e.target.style.display = "none"; }} />
              <button onClick={() => onRemove(url)}
                className="absolute top-1 right-1 w-6 h-6 bg-black/60 text-white rounded-full items-center justify-center hidden group-hover:flex hover:bg-red-600 transition-colors"
                data-testid={`portfolio-remove-${i}`}>
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
          {portfolio.length < 8 && (
            <button onClick={() => portfolioRef.current?.click()}
              className="aspect-square rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400 hover:border-[#0000FF] hover:text-[#0000FF] transition-colors">
              <ImagePlus className="w-5 h-5 mb-1" />
              <span className="text-xs">Add</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
