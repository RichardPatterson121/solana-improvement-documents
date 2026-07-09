---
simd: '0531'
title: Rotor — Anza Implementation Plan
authors:
  - Richard Patterson
category: Meta
type: Core
status: Draft
created: 2026-06-26
feature: (fill in with feature key and github tracking issues once accepted)
---

## Summary

This proposal describes the Anza validator client (agave) implementation
plan for Rotor as specified in SIMD-0530. Where SIMD-0530 defines the
protocol-level specification, this SIMD describes the concrete
engineering work required within the Anza/agave codebase, the
activation strategy, and the testnet rollout plan.

## Motivation

SIMD-0530 specifies Rotor at the network protocol level but leaves
implementation details to the client teams. The Anza team maintains the
reference validator implementation (agave), and this SIMD captures the
Anza-specific decisions that would be out of scope for a protocol SIMD
but are necessary to coordinate a successful mainnet activation.

Separating protocol specification (SIMD-0530) from implementation plan
(this SIMD) follows the precedent established by the Alpenglow suite
(SIMD-0326 protocol, SIMD-0384 migration plan).

## New Terminology

All terminology from SIMD-0326 and SIMD-0530 applies. The following
are Anza/agave-specific:

**agave** is the Anza-maintained Solana validator client, the
direct successor to the Solana Labs validator.

**Rotor stage** is the new pipeline stage in the agave TVU (Transaction
Validation Unit) that replaces the existing `RetransmitStage`.

## Detailed Design

### Codebase Structure

The Rotor implementation in agave will be structured as follows:

- `turbine/src/rotor/` — new module containing:
  - `mod.rs` — public API and `RotorStage` struct
  - `smart_sampling.rs` — peer reliability scorer and sampling logic
  - `relay.rs` — shred relay loop
  - `config.rs` — `RotorConfig` with protocol parameters from SIMD-0530
- `turbine/src/retransmit_stage.rs` — retained for Turbine fallback
  during migration window; gated behind `!feature_set.rotor_enabled()`
- `core/src/tvu.rs` — updated to conditionally instantiate `RotorStage`
  or `RetransmitStage` based on the feature gate

### Feature Gate

A new feature gate `rotor_enabled` will be added to
`sdk/src/feature_set.rs`. The gate controls:

1. Whether the leader uses Rotor's first-tier sampling instead of
   Turbine tree construction.
2. Whether validators run `RotorStage` instead of `RetransmitStage`.

The two sides (leader + validator) must activate in the same epoch to
avoid mixed-protocol propagation failures. The feature gate activation
follows the standard process in SIMD-0089 (Feature Gate Program).

### Smart Sampling Implementation

The reliability scorer in `smart_sampling.rs` will maintain a per-peer
`ReliabilityRecord`:

```rust
struct ReliabilityRecord {
    ema_delivery_rate: f64,   // exponential moving average
    ema_latency_ms: f64,
    last_updated_slot: Slot,
}
```

EMA decay uses a configurable `alpha` (default 0.05 per slot, yielding
a ~200-slot effective window matching SIMD-0530's parameter table).

Peer sampling at relay time iterates the current epoch stakes (from
`bank.epoch_stakes()`) and draws a weighted sample without replacement
using the stake × reliability product as weights.

### Migration Coexistence with Turbine

During the transition window defined in SIMD-0532, validators will
advertise Rotor capability in their gossip `ContactInfo` using a new
optional field `rotor_version: u8`. Validators that see a peer without
`rotor_version` fall back to Turbine shred delivery for that peer. This
ensures the network degrades gracefully if any validator has not yet
upgraded.

### Testnet Rollout Plan

| Phase | Network | Criteria to advance |
|---|---|---|
| 1 — Shadow mode | devnet | Rotor runs in parallel with Turbine; metrics compared. No consensus impact. |
| 2 — Rotor primary | testnet | `rotor_enabled` activated on testnet. Turbine fallback remains available. |
| 3 — Turbine deprecated | testnet | Turbine fallback disabled. Soak for ≥2 full epochs. |
| 4 — Mainnet activation | mainnet-beta | Standard feature gate vote following SIMD-0089 process. |

### Metrics

The following metrics will be added to the agave Prometheus endpoint:

- `rotor_shreds_forwarded_total` — counter
- `rotor_relay_latency_ms` — histogram
- `rotor_peer_reliability_score` — gauge (sampled per relay event)
- `rotor_fallback_to_turbine_total` — counter (migration window only)

## Alternatives Considered

- **Single combined SIMD for protocol + implementation**: Rejected to
  maintain the separation of concerns established by the Alpenglow SIMD
  suite, and to allow non-Anza clients to implement SIMD-0530 without
  being bound by Anza-specific engineering decisions in this document.
- **Implement Rotor as a plugin/separate binary**: Rejected; the relay
  hot path requires tight integration with the TVU pipeline to meet
  latency targets.

## Impact

- **Anza engineering**: Significant new module; estimated scope comparable
  to `RetransmitStage` replacement. The migration window adds transient
  complexity.
- **Other client teams**: Not bound by this SIMD. They should implement
  SIMD-0530 per their own design choices.
- **Validator operators**: No configuration changes required for standard
  operation. Operators running custom Turbine topology overrides will need
  to migrate those configs.

## Security Considerations

Same as SIMD-0530. Additionally:

- The `ReliabilityRecord` scorer must not be trivially gameable: a
  malicious peer that delivers shreds reliably for N slots and then
  withholds them will cause the scorer to over-trust it. The
  `last_updated_slot` field enables rapid score decay on silence,
  partially mitigating this.
- Peer score state is lost on restart; the scorer re-warms over
  approximately 200 slots, during which forwarding quality may be
  slightly degraded.

## Drawbacks

- Adds a new long-lived module that must be maintained in perpetuity.
- During the migration window, maintaining dual code paths increases
  testing surface area.

## Backwards Compatibility

Same as SIMD-0530. This SIMD adds no new incompatibilities beyond those
already covered by the protocol specification.

## Bibliography

1. SIMD-0530: Rotor (protocol specification)
2. SIMD-0532: Rotor Migration
3. SIMD-0326: Alpenglow (Votor)
4. SIMD-0384: Alpenglow Migration
5. SIMD-0089: Programify Feature Gate Program
6. *Kniep, Sliwinski, Wattenhofer*, **Solana Alpenglow Consensus:
   Increased Bandwidth, Reduced Latency v1.1**, 2025,
   https://www.anza.xyz/alpenglow-1-1
