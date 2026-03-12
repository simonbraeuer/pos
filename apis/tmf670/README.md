# tmf670

TMF-670 Payment Method Management API mock implementation.

Provides operations for managing payment methods (cards, bank accounts, digital wallets, etc.) following the TMForum TMF-670 standard.

## Features

- Create, read, update, delete payment methods
- Search payment methods by type, status, customer
- Support for multiple payment method types:
  - Cash
  - Credit/Debit Cards
  - Bank Transfers
  - Digital Wallets
  - Vouchers
  - Loyalty Points
- Mock data with simulated network latency
- HAR logging instrumentation via TMF688
