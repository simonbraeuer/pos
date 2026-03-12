# @pos/device

POS Device API library — mock implementation of the device resource.

## Device types

| Type | Description |
|---|---|
| `TABLET` | Tablet running the POS application |
| `EFT` | Electronic Funds Transfer terminal (card reader) |
| `CASH_DRAWER` | Cash drawer peripheral |
| `PRINTER` | Receipt or label printer |

## Features

- Each device can optionally be linked to a Hardware Station (`hwStationId`).
- Devices flagged with `managedByRemoteDeviceService: true` are considered **online** devices — their `isOnline` status is polled from the remote-device-service (simulated in the mock).
- Payment methods can reference a device via `deviceId`:
  - EFT payment methods → `EFT` devices
  - Cash payment methods → `CASH_DRAWER` devices

## Usage

```ts
import { DeviceApiService, DeviceType } from '@pos/device';
```
