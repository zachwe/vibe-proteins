/**
 * Minimal Mol* viewer for the landing page hero section.
 * Just shows a spinning, interactive protein structure - no controls.
 */

import { useEffect, useRef, useState } from "react";
import { Viewer } from "molstar/lib/apps/viewer/app";
import { PluginConfig } from "molstar/lib/mol-plugin/config";
import { Color } from "molstar/lib/mol-util/color";

interface MolstarHeroProps {
  pdbId: string;
  className?: string;
}

// Exact match with the section background (#0a101f)
const BG_COLOR = Color(0x0a101f);

export default function MolstarHero({ pdbId, className = "" }: MolstarHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const spinIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;

    let viewer: Viewer | null = null;
    let mounted = true;

    async function init() {
      if (!containerRef.current) return;

      try {
        // Create minimal viewer - no UI controls at all
        viewer = await Viewer.create(containerRef.current, {
          layoutIsExpanded: false,
          layoutShowControls: false,
          layoutShowRemoteState: false,
          layoutShowSequence: false,
          layoutShowLog: false,
          layoutShowLeftPanel: false,
          viewportShowExpand: false,
          viewportShowControls: false,
          viewportShowSelectionMode: false,
          viewportShowToggleFullscreen: false,
          viewportShowAnimation: false,
          viewportShowSettings: false,
          config: [
            [PluginConfig.Viewport.ShowXR, "never"],
            [PluginConfig.Viewport.ShowIllumination, false],
            [PluginConfig.Viewport.ShowScreenshotControls, false],
            [PluginConfig.Viewport.ShowReset, false],
          ],
        });

        if (!mounted) {
          viewer.plugin.dispose();
          return;
        }

        viewerRef.current = viewer;

        // Set background color to match page
        const canvas = viewer.plugin.canvas3d;
        if (canvas) {
          const renderer = canvas.props.renderer;
          canvas.setProps({
            renderer: {
              ...renderer,
              backgroundColor: BG_COLOR,
            },
            // Hide the axis indicator
            trackball: {
              ...canvas.props.trackball,
              animate: { name: 'off', params: {} },
              noScroll: true, // Disable zoom via scroll
            },
          });

          // Hide axis/gizmo by setting helper options
          canvas.setProps({
            camera: {
              ...canvas.props.camera,
              helper: {
                axes: { name: 'off', params: {} },
              },
            },
          });
        }

        // Load structure from RCSB
        const url = `https://files.rcsb.org/download/${pdbId}.pdb`;
        await viewer.loadStructureFromUrl(url, "pdb", false);

        if (!mounted) return;

        // Start spinning
        spinIntervalRef.current = setInterval(() => {
          if (!viewerRef.current) return;
          try {
            const canvas = viewerRef.current.plugin.canvas3d;
            if (canvas) {
              const snapshot = canvas.camera.getSnapshot();
              const angle = Math.PI / 180;
              const cos = Math.cos(angle);
              const sin = Math.sin(angle);
              const x = snapshot.position[0];
              const z = snapshot.position[2];
              snapshot.position[0] = x * cos - z * sin;
              snapshot.position[2] = x * sin + z * cos;
              canvas.camera.setState({ ...snapshot }, 0);
            }
          } catch {
            // Ignore rotation errors
          }
        }, 50);

        setIsLoading(false);
      } catch (err) {
        console.error("Failed to initialize hero viewer:", err);
        setIsLoading(false);
      }
    }

    init();

    return () => {
      mounted = false;
      if (spinIntervalRef.current) {
        clearInterval(spinIntervalRef.current);
      }
      viewer?.plugin.dispose();
      viewerRef.current = null;
    };
  }, [pdbId]);

  // Prevent scroll/zoom on the container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const preventZoom = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    container.addEventListener('wheel', preventZoom, { passive: false });
    return () => container.removeEventListener('wheel', preventZoom);
  }, []);

  return (
    <div className={`relative ${className}`}>
      {/* Mol* container - hide all UI chrome and remove border */}
      <div
        ref={containerRef}
        className="molstar-hero w-full h-full [&_.msp-viewport-controls]:hidden [&_.msp-layout-region-top]:hidden [&_.msp-layout-region-bottom]:hidden [&_.msp-layout-region-left]:hidden [&_.msp-layout-region-right]:hidden"
      />

      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      )}
    </div>
  );
}
