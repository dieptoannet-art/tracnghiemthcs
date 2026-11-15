import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  toolName?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class MathLabErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error?.message || 'Đã xảy ra lỗi hiển thị trong mô-đun Toán học.',
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[SmartMathLab ErrorBoundary]:', error, errorInfo);
  }

  handleRecover = () => {
    this.setState({ hasError: false, errorMessage: '' });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 rounded-2xl border border-amber-300 bg-amber-50/90 text-slate-800 max-w-xl mx-auto my-8 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mb-3">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">
            Công cụ {this.props.toolName || 'Smart Math Lab'} gặp sự cố hiển thị tạm thời
          </h3>
          <p className="text-sm text-slate-600 text-center mb-4">
            Hệ thống đã cô lập lỗi an toàn để không ảnh hưởng tới bài giảng hoặc dữ liệu lớp học của thầy/cô.
          </p>
          <code className="text-xs bg-white px-3 py-1.5 rounded border border-amber-200 text-amber-900 mb-4 max-w-full overflow-x-auto">
            {this.state.errorMessage}
          </code>
          <button
            type="button"
            onClick={this.handleRecover}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold transition shadow-sm"
          >
            <RotateCcw className="w-4 h-4" />
            Khôi phục trạng thái mặc định
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
