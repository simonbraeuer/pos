# tmf676

TMF-676 Payment Management API mock implementation.

This library provides a mock backend client for payment lifecycle operations following the TMForum TMF-676 specification.

## Payment Methods

Payment methods are configurable via the `PAYMENT_METHODS` registry. Each payment method includes:

- `authorizationMode`: `'online'` or `'offline'` (TMF-670 compliant field)
- `requiresHardware`: Whether hardware devices are needed (e.g., card terminals)

### Available Payment Methods

- **Cash** (`pm-cash`): Offline, no hardware required
- **Credit Card** (`pm-001`): Online, requires card terminal
- **Bank Transfer** (`pm-002`): Online, no hardware required
- **Debit Card** (`pm-debit`): Online, requires card terminal
- **Check** (`pm-check`): Offline, no hardware required

### Configuration

You can configure payment methods by modifying the `PAYMENT_METHODS` Map:

```typescript
import { PAYMENT_METHODS } from '@pos/tmf676';

// Add a new payment method
PAYMENT_METHODS.set('pm-mobile', {
  id: 'pm-mobile',
  name: 'Mobile Payment',
  '@referredType': 'MobileWallet',
  authorizationMode: 'online',
  requiresHardware: false,
});

// Update existing payment method
const cashMethod = PAYMENT_METHODS.get('pm-cash');
if (cashMethod) {
  cashMethod.requiresHardware = true; // e.g., if cash register is required
}
```
