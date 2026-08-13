# ADR-0010 — Package-Specific Public Quantity

Status: Accepted

- 2 L, 3 L, and 5 L packages remain fixed at quantity `1`; the customer quantity field is hidden.
- The 10 L package is selected by default when available and exposes a positive integer quantity selector (1–100).
- The server identifies the package by its stored volume, not by a client label. Any non-10 L quantity other than `1` is rejected.
- Capacity reservation uses `package volume × quantity`; item subtotal uses `package price × quantity`.
- Historical order snapshots store the resulting total quantity, litres, and subtotal. Existing orders remain unchanged.
