import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeSvgProps {
  value: string;
  className?: string;
  width?: number | string;
  height?: number;
}

export const BarcodeSvg: React.FC<BarcodeSvgProps> = ({
  value,
  className = '',
  width = 200,
  height = 32,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const numericWidth = typeof width === 'number' ? width : 200;

  useEffect(() => {
    if (!svgRef.current || !value) return;
    const svg = svgRef.current;
    try {
      JsBarcode(svg, value, {
        format: 'CODE128',
        width: 2,
        height,
        displayValue: false,
        margin: 0,
      });
      // JsBarcode sizes the SVG to the barcode's natural pixel width, which
      // is often wider than the box we actually have room for (longer SKUs/
      // order numbers produce more bars) - that's what was overflowing.
      // Pin a viewBox to that natural size, then force the display width/
      // height back down to what was requested, so the browser scales the
      // whole barcode to fit instead of letting it spill out of its box.
      const naturalWidth = parseFloat(svg.getAttribute('width') || String(numericWidth));
      const naturalHeight = parseFloat(svg.getAttribute('height') || String(height));
      svg.setAttribute('viewBox', `0 0 ${naturalWidth} ${naturalHeight}`);
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      svg.setAttribute('width', String(numericWidth));
      svg.setAttribute('height', String(height));
    } catch {
      // Value has characters CODE128 can't encode (rare) - leave the SVG empty
      // rather than fall back to a fake pattern.
    }
  }, [value, height, numericWidth]);

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      <svg ref={svgRef} width={numericWidth} height={height} className="block max-w-full" />
      {value && (
        <span className="text-sm tracking-[2px] font-bold text-v26-ink mt-1">
          {value}
        </span>
      )}
    </div>
  );
};
