import { useRef, useEffect } from 'react';
import useResizeObserver from '../../hooks/useResizeObserver';
import { createSystemLevelSvg } from './systemLevelSvg';

/** The displayed chart and downloaded paper figures use the same SVG renderer. */
const MainMethodStackedChart = ({ data, criterion = 'supervision' }) => {
  const containerRef = useRef();
  const svgRef = useRef();
  const dimensions = useResizeObserver(containerRef);

  useEffect(() => {
    if (!data?.length || !dimensions || dimensions.width <= 0) return;
    // All text is escaped by the shared renderer; category values are validated.
    svgRef.current.innerHTML = createSystemLevelSvg(data, {
      criterion,
      width: dimensions.width,
      height: Math.max(280, Math.min(400, dimensions.height || 400)),
      textColor: '#d1d5db',
    });
  }, [data, dimensions, criterion]);

  return (
    <div ref={containerRef} className="w-full h-full flex justify-center items-center">
      <div ref={svgRef} />
    </div>
  );
};

export default MainMethodStackedChart;
