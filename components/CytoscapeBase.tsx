"use client";

import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import type { Core } from "cytoscape";

export interface CytoscapeBaseHandle {
  cy: () => Core | null;
}

interface Props {
  // Plain objects matching cytoscape's stylesheet format
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stylesheet: object[];
  style?: React.CSSProperties;
  className?: string;
}

const CytoscapeBase = forwardRef<CytoscapeBaseHandle, Props>(
  ({ stylesheet, style, className }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const cyRef = useRef<cytoscape.Core | null>(null);

    useImperativeHandle(ref, () => ({
      cy: () => cyRef.current,
    }));

    useEffect(() => {
      if (!containerRef.current || cyRef.current) return;

      let mounted = true;

      import("cytoscape").then(({ default: cytoscape }) => {
        if (!mounted || !containerRef.current) return;
        cyRef.current = cytoscape({
          container: containerRef.current,
          elements: [],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          style: stylesheet as any,
          layout: { name: "null" },
          userZoomingEnabled: false,
          userPanningEnabled: false,
          boxSelectionEnabled: false,
          autoungrabify: true,
        });
      });

      return () => {
        mounted = false;
        cyRef.current?.destroy();
        cyRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
      <div
        ref={containerRef}
        className={className}
        style={{
          width: "100%",
          background: "var(--color-surface-2)",
          border: "1px solid var(--color-border)",
          borderRadius: 12,
          ...style,
        }}
      />
    );
  }
);

CytoscapeBase.displayName = "CytoscapeBase";
export default CytoscapeBase;
