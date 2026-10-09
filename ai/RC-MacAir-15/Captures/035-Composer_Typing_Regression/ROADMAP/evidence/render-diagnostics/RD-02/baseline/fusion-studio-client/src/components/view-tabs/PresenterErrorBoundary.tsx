import { Component, type ReactNode } from 'react';

interface PresenterErrorBoundaryProps {
  resetKey: string;
  fallback: ReactNode;
  children: ReactNode;
}

interface PresenterErrorBoundaryState {
  hasError: boolean;
  resetKey: string;
}

/** Contains descendant presenter failures without retaining or rendering error details. */
export class PresenterErrorBoundary extends Component<
  PresenterErrorBoundaryProps,
  PresenterErrorBoundaryState
> {
  state: PresenterErrorBoundaryState = {
    hasError: false,
    resetKey: this.props.resetKey,
  };

  static getDerivedStateFromProps(
    props: PresenterErrorBoundaryProps,
    state: PresenterErrorBoundaryState,
  ): PresenterErrorBoundaryState | null {
    return props.resetKey === state.resetKey
      ? null
      : { hasError: false, resetKey: props.resetKey };
  }

  static getDerivedStateFromError(): Pick<PresenterErrorBoundaryState, 'hasError'> {
    return { hasError: true };
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
