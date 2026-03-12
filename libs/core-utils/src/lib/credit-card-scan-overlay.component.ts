import {
  Component,
  computed,
  effect,
  input,
  output,
  signal,
  ViewChild,
  ElementRef,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export interface CreditCardScanResult {
  cardNumber?: string;
  cardHolder?: string;
  expiryDate?: string;
}

type CardSide = 1 | 2;

type TextDetectorCtor = new () => {
  detect(image: ImageBitmapSource): Promise<Array<{ rawValue?: string }>>;
};

@Component({
  selector: 'pos-credit-card-scan-overlay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './credit-card-scan-overlay.component.html',
  styleUrl: './credit-card-scan-overlay.component.scss',
})
export class CreditCardScanOverlayComponent implements OnDestroy {
  readonly open = input<boolean>(false);

  readonly closed = output<void>();
  readonly scanned = output<CreditCardScanResult>();

  @ViewChild('cameraVideo')
  private cameraVideo?: ElementRef<HTMLVideoElement>;

  private mediaStream: MediaStream | null = null;

  readonly step = signal<CardSide>(1);
  readonly isCapturing = signal<boolean>(false);
  readonly statusMessage = signal<string>('');
  readonly scanError = signal<string | null>(null);

  readonly instruction = computed<string>(() => {
    return this.step() === 1
      ? 'Scan side 1: hold the front side of the card exactly inside the frame.'
      : 'Scan side 2: turn the card and hold the back side exactly inside the frame.';
  });

  private readonly sideOneText = signal<string>('');
  private readonly sideTwoText = signal<string>('');

  constructor() {
    effect(() => {
      if (this.open()) {
        void this.startCamera();
      } else {
        this.stopCamera();
      }
    });
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }

  async captureCurrentSide(): Promise<void> {
    if (this.isCapturing()) {
      return;
    }

    this.scanError.set(null);
    this.isCapturing.set(true);
    this.statusMessage.set(this.step() === 1 ? 'Capturing side 1...' : 'Capturing side 2...');

    try {
      const text = await this.captureAndExtractText();

      if (this.step() === 1) {
        this.sideOneText.set(text);
        this.step.set(2);
        this.statusMessage.set('Side 1 captured. Now scan side 2.');
      } else {
        this.sideTwoText.set(text);
        this.statusMessage.set('Processing captured card details on this device...');
        const result = this.extractCardData(this.sideOneText(), this.sideTwoText());
        this.scanned.emit(result);
        this.close();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Card scan failed.';
      this.scanError.set(message);
      this.statusMessage.set('');
    } finally {
      this.isCapturing.set(false);
    }
  }

  close(): void {
    this.stopCamera();
    this.resetState();
    this.closed.emit();
  }

  private resetState(): void {
    this.step.set(1);
    this.statusMessage.set('');
    this.scanError.set(null);
    this.sideOneText.set('');
    this.sideTwoText.set('');
    this.isCapturing.set(false);
  }

  private async startCamera(): Promise<void> {
    if (this.mediaStream) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      this.scanError.set('Camera is not available on this device/browser.');
      return;
    }

    this.scanError.set(null);

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      const video = this.cameraVideo?.nativeElement;
      if (video) {
        video.srcObject = this.mediaStream;
        await video.play();
      }
    } catch {
      this.scanError.set('Unable to access camera. Please allow camera permission and retry.');
      this.stopCamera();
    }
  }

  private stopCamera(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    const video = this.cameraVideo?.nativeElement;
    if (video) {
      video.pause();
      video.srcObject = null;
    }
  }

  private async captureAndExtractText(): Promise<string> {
    const video = this.cameraVideo?.nativeElement;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      throw new Error('Camera preview is not ready yet.');
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Unable to capture card image.');
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return this.extractTextLocally(canvas);
  }

  private async extractTextLocally(canvas: HTMLCanvasElement): Promise<string> {
    const maybeCtor = (window as Window & { TextDetector?: TextDetectorCtor }).TextDetector;

    if (!maybeCtor) {
      return '';
    }

    try {
      const detector = new maybeCtor();
      const lines = await detector.detect(canvas);
      return lines
        .map((line) => line.rawValue?.trim() ?? '')
        .filter((line) => line.length > 0)
        .join('\n');
    } catch {
      return '';
    }
  }

  private extractCardData(sideOneText: string, sideTwoText: string): CreditCardScanResult {
    const merged = `${sideOneText}\n${sideTwoText}`;

    const cardNumber = this.extractCardNumber(merged);
    const expiryDate = this.extractExpiryDate(merged);
    const cardHolder = this.extractCardHolderName(merged);

    return {
      cardNumber,
      expiryDate,
      cardHolder,
    };
  }

  private extractCardNumber(text: string): string | undefined {
    const candidates = text.match(/(?:\d[\s-]?){13,19}/g) ?? [];
    const normalized = candidates
      .map((value) => value.replace(/\D/g, ''))
      .filter((value) => value.length >= 13 && value.length <= 19);

    const best = normalized.sort((a, b) => b.length - a.length)[0];
    if (!best) {
      return undefined;
    }

    return best.slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
  }

  private extractExpiryDate(text: string): string | undefined {
    const match = text.match(/(0[1-9]|1[0-2])\s*\/?\s*([0-9]{2})/);
    if (!match) {
      return undefined;
    }

    const month = match[1];
    const year = match[2];
    return `${month}/${year}`;
  }

  private extractCardHolderName(text: string): string | undefined {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length >= 5);

    const nameLine = lines.find((line) => {
      const upper = line.toUpperCase();
      if (upper.includes('VALID') || upper.includes('THRU') || upper.includes('CARD')) {
        return false;
      }

      return /^[A-Z][A-Z\s\-'.]+$/.test(upper) && upper.includes(' ');
    });

    return nameLine ? nameLine.toUpperCase() : undefined;
  }
}
