import { AlertTriangle, RefreshCw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

import { Banner, Btn } from "./gitPrimitives";

interface Props {
  panelName: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class PanelErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(`[PanelErrorBoundary] Error caught in ${this.props.panelName}:`, error, errorInfo);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  public override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="p-6">
          <Banner
            tone="bad"
            title={`Something went wrong in the ${this.props.panelName} panel`}
            body={this.state.error?.message || "An unexpected error occurred while rendering this panel."}
            actions={
              <Btn sm ghost icon={RefreshCw} onClick={this.handleRetry}>
                Try again
              </Btn>
            }
          />
        </div>
      );
    }

    return this.props.children;
  }
}
