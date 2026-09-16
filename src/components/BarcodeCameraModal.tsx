import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, AlertCircle } from 'lucide-react';

interface BarcodeCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}

export const BarcodeCameraModal: React.FC<BarcodeCameraModalProps> = ({
  isOpen,
  onClose,
  onScan,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const scanningRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const stopCamera = () => {
    scanningRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async () => {
    setErrorMsg(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setIsSupported(false);
        setErrorMsg('Trình duyệt không hỗ trợ truy cập camera hoặc đang ở chế độ bảo mật.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        scanningRef.current = true;
        initDetector();
      }
    } catch (err: unknown) {
      console.error('Camera access error:', err);
      setErrorMsg('Không thể truy cập camera. Vui lòng cấp quyền hoặc sử dụng máy quét mã vạch chuyên dụng.');
    }
  };

  const initDetector = () => {
    // Check if BarcodeDetector is available natively in browser
    type BarcodeDetectorType = new (opts?: { formats: string[] }) => {
      detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
    };

    const BarcodeDetectorClass = (window as unknown as { BarcodeDetector?: BarcodeDetectorType }).BarcodeDetector;

    if (BarcodeDetectorClass) {
      const barcodeDetector = new BarcodeDetectorClass({
        formats: ['code_128', 'code_39', 'qr_code', 'ean_13', 'ean_8', 'upc_a'],
      });

      const detectFrame = async () => {
        if (!scanningRef.current || !videoRef.current) return;

        try {
          if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
            const barcodes = await barcodeDetector.detect(videoRef.current);
            if (barcodes.length > 0 && barcodes[0].rawValue) {
              const code = barcodes[0].rawValue.trim();
              if (code.length >= 5) {
                scanningRef.current = false;
                onScan(code);
                onClose();
                return;
              }
            }
          }
        } catch {
          // ignore detection frame errors
        }

        if (scanningRef.current) {
          requestAnimationFrame(detectFrame);
        }
      };

      requestAnimationFrame(detectFrame);
    } else {
      // Fallback message for browsers without native BarcodeDetector
      // Warehouse staff usually use handheld 1D/2D USB/Bluetooth scanners which work like keyboard inputs
      setIsSupported(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2 text-slate-800 font-bold">
            <Camera className="h-5 w-5 text-orange-500" />
            <span>Quét mã vạch đơn SPXVN</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative aspect-4/3 w-full bg-slate-950 flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-full w-full object-cover"
          />

          {/* Scanner Guide Overlay */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-44 w-64 rounded-xl border-2 border-orange-500/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
              <div className="absolute top-0 left-0 h-4 w-4 border-t-4 border-l-4 border-orange-500 -mt-1 -ml-1"></div>
              <div className="absolute top-0 right-0 h-4 w-4 border-t-4 border-r-4 border-orange-500 -mt-1 -mr-1"></div>
              <div className="absolute bottom-0 left-0 h-4 w-4 border-b-4 border-l-4 border-orange-500 -mb-1 -ml-1"></div>
              <div className="absolute bottom-0 right-0 h-4 w-4 border-b-4 border-r-4 border-orange-500 -mb-1 -mr-1"></div>

              {/* Red laser scanning line */}
              <div className="absolute top-1/2 left-2 right-2 h-0.5 bg-red-500 shadow-[0_0_8px_#ef4444] animate-pulse"></div>
            </div>
          </div>
        </div>

        <div className="p-5 text-sm text-slate-600 space-y-3">
          {errorMsg ? (
            <div className="flex items-start gap-2.5 rounded-lg bg-red-50 p-3 text-red-700">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Lưu ý camera</p>
                <p className="text-xs mt-0.5">{errorMsg}</p>
              </div>
            </div>
          ) : !isSupported ? (
            <div className="rounded-lg bg-amber-50 p-3 text-amber-800 text-xs leading-relaxed">
              💡 <strong>Mẹo vận hành kho:</strong> Trình duyệt này chưa kích hoạt nhận diện trực tiếp qua camera. Bạn có thể dùng <strong>máy quét barcode cầm tay (Scanner súng quét)</strong> — chỉ cần bấm cò vào tem đơn, mã SPXVN sẽ tự động điền và kích hoạt kiểm ngay lập tức!
            </div>
          ) : (
            <p className="text-center text-slate-500 text-xs">
              Hướng camera về phía mã vạch đơn hàng SPXVN trên gói hàng. Hệ thống sẽ tự động bắt mã.
            </p>
          )}

          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
