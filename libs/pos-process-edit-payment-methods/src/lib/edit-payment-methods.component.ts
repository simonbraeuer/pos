import { Component, inject, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import {
  Tmf670ApiService,
  PaymentMethod,
  CreatePaymentMethodRequest,
  PaymentMethodType,
  PaymentMethodStatus,
  AuthorizationMode,
} from "@pos/tmf670";
import { DeviceApiService, Device, DeviceType } from "@pos/device";
import { DialogService } from "@pos/core-ui";

@Component({
  selector: "lib-edit-payment-methods",
  standalone: true,
  imports: [FormsModule],
  templateUrl: "./edit-payment-methods.component.html",
  styleUrl: "./edit-payment-methods.component.scss",
})
export class EditPaymentMethodsComponent implements OnInit {
  private tmf670 = inject(Tmf670ApiService);
  private deviceApi = inject(DeviceApiService);
  private dialog = inject(DialogService);

  paymentMethods = signal<PaymentMethod[]>([]);
  devices = signal<Device[]>([]);
  loading = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);
  editingId = signal<string | null>(null);
  editForm: {
    name: string;
    description: string;
    status: PaymentMethodStatus;
    isPreferred: boolean;
    authorizationMode?: AuthorizationMode;
    requiresHardware?: boolean;
    deviceId?: number | null;
  } = { name: "", description: "", status: "active", isPreferred: false };

  newPaymentMethod: CreatePaymentMethodRequest = {
    name: "",
    description: "",
    type: "cash",
    isPreferred: false,
    authorizationMode: "offline",
    requiresHardware: false,
    deviceId: undefined,
  };

  // Available types for dropdown
  availableTypes: PaymentMethodType[] = [
    "cash",
    "creditCard",
    "debitCard",
    "bankTransfer",
    "directDebit",
    "digitalWallet",
    "voucher",
    "loyaltyPoints",
    "other",
  ];

  availableStatuses: PaymentMethodStatus[] = [
    "active",
    "inactive",
    "suspended",
    "expired",
  ];

  availableAuthModes: AuthorizationMode[] = ["online", "offline"];

  ngOnInit(): void {
    this.load();
    this.loadDevices();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.tmf670.searchPaymentMethods({}, 0, 100).subscribe({
      next: (result) => {
        this.paymentMethods.set(result.items);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(e?.message);
        this.loading.set(false);
      },
    });
  }

  private loadDevices(): void {
    this.deviceApi.listDevices().subscribe({
      next: (devices) => this.devices.set(devices),
      error: () => {/* non-critical */},
    });
  }

  devicesForType(type: PaymentMethodType): Device[] {
    const deviceType = this.paymentMethodTypeToDeviceType(type);
    if (!deviceType) return [];
    return this.devices().filter((d) => d.type === deviceType);
  }

  paymentMethodTypeToDeviceType(type: PaymentMethodType): DeviceType | null {
    if (type === "creditCard" || type === "debitCard") return "EFT";
    if (type === "cash") return "CASH_DRAWER";
    return null;
  }

  deviceName(deviceId: number | undefined): string {
    if (deviceId === undefined) return "—";
    const d = this.devices().find((dev) => dev.id === deviceId);
    return d ? d.name : `Device #${deviceId}`;
  }

  deviceOnline(deviceId: number | undefined): boolean {
    if (deviceId === undefined) return false;
    const d = this.devices().find((dev) => dev.id === deviceId);
    return d?.isOnline ?? false;
  }

  startEdit(pm: PaymentMethod): void {
    this.editingId.set(pm.id);
    this.editForm = {
      name: pm.name,
      description: pm.description || "",
      status: pm.status || "active",
      isPreferred: pm.isPreferred || false,
      authorizationMode: pm.authorizationMode,
      requiresHardware: pm.requiresHardware,
      deviceId: pm.deviceId ?? null,
    };
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  saveEdit(id: string): void {
    this.saving.set(true);
    this.error.set(null);
    const paymentMethod = this.paymentMethods().find((pm) => pm.id === id);
    const canMapDevice = paymentMethod
      ? !!this.paymentMethodTypeToDeviceType(paymentMethod.type)
      : false;
    const payload = {
      ...this.editForm,
      deviceId: canMapDevice ? this.editForm.deviceId : null,
    };
    this.tmf670.updatePaymentMethod(id, payload).subscribe({
      next: (updated) => {
        this.paymentMethods.update((list) =>
          list.map((pm) => (pm.id === id ? updated : pm))
        );
        this.editingId.set(null);
        this.saving.set(false);
      },
      error: (e) => {
        this.error.set(e?.message);
        this.saving.set(false);
      },
    });
  }

  async deletePaymentMethod(id: string): Promise<void> {
    const confirmed = await this.dialog.show({
      title: "Delete Payment Method",
      message: "Delete this payment method?",
      confirmText: "Delete",
      cancelText: "Cancel",
      dismissible: true,
    });
    if (!confirmed) return;

    this.tmf670.deletePaymentMethod(id).subscribe({
      next: () =>
        this.paymentMethods.update((list) => list.filter((pm) => pm.id !== id)),
      error: (e) => this.error.set(e?.message),
    });
  }

  addPaymentMethod(): void {
    this.saving.set(true);
    this.error.set(null);
    const payload: CreatePaymentMethodRequest = { ...this.newPaymentMethod };
    if (!this.paymentMethodTypeToDeviceType(payload.type)) {
      delete payload.deviceId;
    }
    this.tmf670.createPaymentMethod(payload).subscribe({
      next: (pm) => {
        this.paymentMethods.update((list) => [...list, pm]);
        this.newPaymentMethod = {
          name: "",
          description: "",
          type: "cash",
          isPreferred: false,
          authorizationMode: "offline",
          requiresHardware: false,
          deviceId: undefined,
        };
        this.saving.set(false);
      },
      error: (e) => {
        this.error.set(e?.message);
        this.saving.set(false);
      },
    });
  }

  getTypeLabel(type: PaymentMethodType): string {
    const labels: Record<PaymentMethodType, string> = {
      cash: "💵 Cash",
      creditCard: "💳 Credit Card",
      debitCard: "💳 Debit Card",
      bankTransfer: "🏦 Bank Transfer",
      directDebit: "🔄 Direct Debit",
      digitalWallet: "📱 Digital Wallet",
      voucher: "🎫 Voucher",
      loyaltyPoints: "⭐ Loyalty Points",
      other: "❓ Other",
    };
    return labels[type] || type;
  }

  getPaymentDetails(pm: PaymentMethod): string {
    if (pm.card) {
      return `${pm.card.brand || ""} ${pm.card.cardNumber || ""}`.trim();
    }
    if (pm.bankAccount) {
      return pm.bankAccount.iban || pm.bankAccount.accountNumber || "";
    }
    if (pm.digitalWallet) {
      return `${pm.digitalWallet.provider || ""} ${pm.digitalWallet.accountEmail || ""}`.trim();
    }
    return "";
  }

  /**
   * Determine if a payment type can be configured for online/offline mode.
   * Some types are inherently online or offline only.
   */
  canConfigureAuthMode(type: PaymentMethodType): boolean {
    // Types that can be both online and offline
    return [
      "creditCard",
      "debitCard",
      "voucher",
      "other",
    ].includes(type);
  }

  /**
   * Get default authorization mode for a payment type
   */
  getDefaultAuthMode(type: PaymentMethodType): AuthorizationMode {
    const offlineTypes: PaymentMethodType[] = ["cash", "voucher"];
    return offlineTypes.includes(type) ? "offline" : "online";
  }

  /**
   * Update authorization mode when payment type changes
   */
  onTypeChange(): void {
    const type = this.newPaymentMethod.type;
    if (!this.canConfigureAuthMode(type)) {
      this.newPaymentMethod.authorizationMode = this.getDefaultAuthMode(type);
    }
    if (!this.paymentMethodTypeToDeviceType(type)) {
      this.newPaymentMethod.deviceId = undefined;
    }
  }
}
