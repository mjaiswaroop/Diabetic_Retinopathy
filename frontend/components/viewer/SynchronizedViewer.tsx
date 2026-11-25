'use client';

import React, { useState, useRef } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Columns, Sparkles, Eye } from 'lucide-react';

interface SynchronizedViewerProps {
  originalSrc?: string;
  overlaySrc?: string;
}

export function SynchronizedViewer({ originalSrc, overlaySrc }: SynchronizedViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [overlayOpacity, setOverlayOpacity] = useState(0.75);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  
  // Interactive Split Slider View Mode
  const [viewMode, setViewMode] = useState<'split_slider' | 'side_by_side'>('split_slider');
  const [sliderPos, setSliderPos] = useState(50); // 0 to 100 percentage
  const [isSliding, setIsSliding] = useState(false);

  const [originalError, setOriginalError] = useState(false);
  const [overlayError, setOverlayError] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    // If clicking directly on or near the slider line, let the slider take precedence
    if (isSliding) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isSliding && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(100, (relativeX / rect.width) * 100));
      setSliderPos(pct);
      return;
    }
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsSliding(false);
  };

  const handleZoom = (delta: number) => {
    setZoom((prev) => Math.max(0.8, Math.min(4, prev + delta)));
  };

  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setBrightness(100);
    setContrast(100);
    setSliderPos(50);
  };

  return (
    <div className="space-y-3" onMouseUp={handleMouseUp}>
      {/* Viewer controls bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-100 rounded-xl border border-slate-200 text-xs">
        <div className="flex items-center gap-1.5">
          {/* View Mode Toggle */}
          <div className="flex bg-white rounded-lg p-0.5 border border-slate-300 shadow-sm mr-2">
            <button
              type="button"
              onClick={() => setViewMode('split_slider')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition ${
                viewMode === 'split_slider'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Interactive Before/After Split Slider"
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Split Slider</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('side_by_side')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition ${
                viewMode === 'side_by_side'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Dual Synchronized Viewports"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Side-by-Side</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleZoom(0.25)}
            className="p-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 shadow-sm"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4 text-slate-700" />
          </button>
          <button
            type="button"
            onClick={() => handleZoom(-0.25)}
            className="p-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 shadow-sm"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4 text-slate-700" />
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="p-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 shadow-sm"
            title="Reset Pan, Zoom & Slider"
          >
            <RotateCcw className="w-4 h-4 text-slate-700" />
          </button>
          <span className="font-mono text-slate-600 font-semibold ml-1">{Math.round(zoom * 100)}%</span>
        </div>

        {/* Tweak brightness / contrast / opacity */}
        <div className="flex items-center gap-3">
          {viewMode === 'side_by_side' && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-600 text-[11px] font-semibold">Overlay</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={overlayOpacity}
                onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                className="w-16 accent-emerald-600 h-1 bg-slate-300 rounded cursor-pointer"
              />
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <span className="text-slate-600 text-[11px] font-semibold">Contrast</span>
            <input
              type="range"
              min="70"
              max="150"
              value={contrast}
              onChange={(e) => setContrast(parseInt(e.target.value))}
              className="w-16 accent-emerald-600 h-1 bg-slate-300 rounded cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* VIEWPORT MODE 1: Interactive Split-Screen Slider */}
      {viewMode === 'split_slider' ? (
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="relative rounded-2xl overflow-hidden bg-black border border-slate-300 h-96 flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
        >
          {/* Label Badges */}
          <div className="absolute top-3 left-3 z-20 px-2.5 py-1 rounded-md bg-black/75 text-emerald-300 text-[11px] font-bold border border-emerald-500/30 flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" />
            <span>Raw Fundus (Left)</span>
          </div>

          <div className="absolute top-3 right-3 z-20 px-2.5 py-1 rounded-md bg-black/75 text-cyan-300 text-[11px] font-bold border border-cyan-500/30 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Grad-CAM++ Hotspot (Right)</span>
          </div>

          {originalSrc && !originalError ? (
            <div
              className="w-full h-full relative flex items-center justify-center transition-transform duration-75"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                filter: `brightness(${brightness}%) contrast(${contrast}%)`
              }}
            >
              {/* Underlying Base Image: Raw Fundus */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={originalSrc}
                alt="Raw Fundus View"
                onError={() => setOriginalError(true)}
                className="max-h-full max-w-full object-contain pointer-events-none"
              />

              {/* Overlay Layer clipped by slider percentage */}
              <div
                className="absolute inset-0 overflow-hidden flex items-center justify-center pointer-events-none"
                style={{
                  clipPath: `polygon(${sliderPos}% 0, 100% 0, 100% 100%, ${sliderPos}% 100%)`
                }}
              >
                {overlaySrc && overlaySrc !== originalSrc && !overlayError ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={overlaySrc}
                    alt="Grad-CAM++ heatmap overlay"
                    onError={() => setOverlayError(true)}
                    className="max-h-full max-w-full object-contain pointer-events-none"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-tr from-rose-600 via-amber-400 to-transparent mix-blend-screen opacity-80 pointer-events-none" />
                )}
              </div>

              {/* Vertical Divider Line with Grab Handle */}
              <div
                className="absolute top-0 bottom-0 z-30 pointer-events-auto cursor-ew-resize flex items-center justify-center"
                style={{ left: `${sliderPos}%` }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setIsSliding(true);
                }}
              >
                <div className="w-[3px] h-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
                <div className="absolute w-8 h-8 rounded-full bg-white border-2 border-emerald-600 shadow-xl flex items-center justify-center text-emerald-800 text-xs font-black select-none">
                  &#8646;
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-400 p-6 text-center space-y-2">
              <p className="text-xs font-semibold text-slate-300">Retinal scan data unavailable</p>
            </div>
          )}
        </div>
      ) : (
        /* VIEWPORT MODE 2: Side-by-side synchronized viewports */
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={`grid grid-cols-1 md:grid-cols-2 gap-3 cursor-${isDragging ? 'grabbing' : 'grab'} select-none`}
        >
          {/* Left: Original Fundus */}
          <div className="relative rounded-2xl overflow-hidden bg-black border border-slate-300 h-80 flex items-center justify-center">
            <div className="absolute top-2 left-2 z-10 px-2.5 py-0.5 rounded bg-black/70 text-white text-[11px] font-semibold">
              Original Fundus
            </div>
            {originalSrc && !originalError ? (
              <div
                className="w-full h-full flex items-center justify-center transition-transform duration-75"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  filter: `brightness(${brightness}%) contrast(${contrast}%)`
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={originalSrc}
                  alt="Original Fundus View"
                  onError={() => setOriginalError(true)}
                  className="max-h-full max-w-full object-contain pointer-events-none"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-400 p-6 text-center space-y-2">
                <p className="text-xs font-medium text-slate-300">Fundus photograph unavailable</p>
              </div>
            )}
          </div>

          {/* Right: XAI Overlay synchronized */}
          <div className="relative rounded-2xl overflow-hidden bg-black border border-slate-300 h-80 flex items-center justify-center">
            <div className="absolute top-2 left-2 z-10 px-2.5 py-0.5 rounded bg-black/70 text-white text-[11px] font-semibold">
              Grad-CAM++ Spatial Saliency
            </div>
            {originalSrc && !originalError ? (
              <div
                className="w-full h-full flex items-center justify-center transition-transform duration-75 relative"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  filter: `brightness(${brightness}%) contrast(${contrast}%)`
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={originalSrc}
                  alt="Overlay base"
                  onError={() => setOriginalError(true)}
                  className="max-h-full max-w-full object-contain pointer-events-none"
                />
                {overlaySrc && overlaySrc !== originalSrc && !overlayError && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={overlaySrc}
                    alt="Grad-CAM++ heatmap"
                    onError={() => setOverlayError(true)}
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none transition-opacity"
                    style={{ opacity: overlayOpacity }}
                  />
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-400 p-6 text-center space-y-2">
                <p className="text-xs font-medium text-slate-300">Attention map unavailable</p>
              </div>
            )}
          </div>
        </div>
      )}

      <p className="text-[11px] text-slate-500 text-center font-medium">
        {viewMode === 'split_slider' 
          ? 'Drag the center line left/right to reveal underlying fundus vs. Grad-CAM++ saliency. Click & drag background to pan.'
          : 'Tip: Pan and zoom are strictly synchronized between both viewports.'}
      </p>
    </div>
  );
}

