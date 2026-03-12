import React, { Component } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default class WebGLErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, retryKey: 0, errorMessage: '', autoRetries: 0 };
    this.maxAutoRetries = 2;
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, errorMessage: error?.message || 'unknown' };
  }
  componentDidCatch(error, info) {
    console.error('WebGL Error Boundary caught:', error?.message || error, info?.componentStack?.split('\n').slice(0, 8).join('\n'));
    if (this.state.autoRetries < this.maxAutoRetries) {
      setTimeout(() => {
        this.setState(prev => ({
          hasError: false,
          retryKey: prev.retryKey + 1,
          autoRetries: prev.autoRetries + 1,
        }));
      }, 500);
    }
  }
  render() {
    if (this.state.hasError && this.state.autoRetries >= this.maxAutoRetries) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center p-8">
          <AlertCircle className="w-12 h-12 text-amber-400 mb-4" />
          <h2 className="text-xl font-semibold text-slate-200 mb-2">3D View Unavailable</h2>
          <p className="text-slate-400 mb-6 max-w-md">
            {this.props.fallbackMessage || "The 3D view couldn't load on this device. You can retry or switch to an alternative view."}
          </p>
          <div className="flex gap-3">
            <Button
              onClick={() => {
                try { localStorage.setItem('starthread_quality_tier', 'low'); } catch (e) {}
                this.setState(prev => ({ hasError: false, retryKey: prev.retryKey + 1, autoRetries: 0 }));
              }}
              variant="outline"
              className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
            >
              Retry 3D View
            </Button>
            {this.props.onSwitchView && (
              <Button
                onClick={() => {
                  this.setState({ hasError: false });
                  this.props.onSwitchView?.();
                }}
                className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold"
              >
                {this.props.switchViewLabel || "Switch to List View"}
              </Button>
            )}
          </div>
        </div>
      );
    }
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center p-8">
          <div className="animate-pulse text-center">
            <p className="text-slate-300 text-lg">Loading universe...</p>
            <p className="text-slate-500 text-sm mt-2">Optimizing for your device</p>
          </div>
        </div>
      );
    }
    return React.Children.map(this.props.children, child =>
      React.isValidElement(child) ? React.cloneElement(child, { key: `webgl-${this.state.retryKey}` }) : child
    );
  }
}
