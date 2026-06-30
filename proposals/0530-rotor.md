---
simd: '0530'
title: Rotor
authors:
  - Richard Patterson
category: Standard
type: Core
status: Draft
created: 2026-06-22
feature: (fill in with feature key and github tracking issues once accepted)
---

## Summary

This proposal introduces **Rotor**, the data dissemination layer for the
Alpenglow consensus protocol, as specified in Section 2.2 of the Alpenglow
White Paper v1.1. Rotor replaces Turbine as Solana's block propagation
protocol. It was explicitly excluded from SIMD-0326 (Alpenglow / Votor) with
the stated intent that it receive its own SIMD. This document fulfills that
intent.

The companion Alpenglow White Paper v1.1 is available at
https://www.anza.xyz/alpenglow-1-1.

## Motivation

SIMD-0326 (Alpenglow) replaced TowerBFT with the Votor voting and finalization
protocol but deliberately deferred Rotor. The preamble of that SIMD states:

> "Section 2.2 Rotor: Initially we stay with Turbine as the data dissemination
> protocol. Rotor will be introduced later and will get its own SIMD."

Turbine was designed around Proof-of-History and the existing validator
communication patterns. With Alpenglow in production, the network now has
the infrastructure (BLS keys via SIMD-0387, admission tickets via SIMD-0357)
to deploy Rotor without the bootstrapping complexity that would have existed
at Votor launch. Rotor offers the following improvements over Turbine:

- **Smart Sampling** (Section 3.1 of the white paper): validators
  strategically select peers to relay data, reducing redundant
  transmissions and improving tail latency.
- **Lower bandwidth overhead**: Rotor eliminates the layer-doubling
  retransmit cost inherent in Turbine's tree structure.
- **Better adversarial resilience**: the sampling strategy is harder for a
  Byzantine minority to selectively attack than Turbine's deterministic
  tree.
- **Alignment with Alpenglow's slice/shred model**: Rotor is designed
  around the slice abstraction introduced by SIMD-0326, where a block is
  divided into slices before being shredded.

## New Terminology

All terminology from SIMD-0326 applies. The following are specific to Rotor:

**Rotor** is the data dissemination protocol used to propagate shreds from
the leader to all validators. It replaces Turbine.

**Smart Sampling** is the technique by which a receiving validator
selects a subset of peers from which to request or forward shreds,
preferring peers with low latency and high reliability. This is described
in Section 3.1 of the white paper and is bundled into this SIMD as it is
architecturally inseparable from Rotor.

**Relay node** is a validator that has received enough shreds to
reconstruct a slice and forwards it to downstream peers under Smart
Sampling.

## Detailed Design

### Overview

Rotor replaces the existing Turbine shred-relay tree with a probabilistic
sampling-based broadcast. The leader shreds each slice and sends those
shreds to a first tier of staked validators. Each first-tier validator,
upon successfully reconstructing the slice, forwards shreds to a set of
peers sampled according to Smart Sampling.

### Smart Sampling

A validator maintains a local view of peer responsiveness (round-trip
latency and delivery rate). When forwarding a shred, it samples peers
proportional to stake weight, with a bias toward low-latency, reliable
peers. The exact sampling function is:

```
P(peer i receives forward) ∝ stake(i) × reliability_score(i)
```

`reliability_score` is a locally computed exponential moving average of
historical delivery success rates for each peer, with a recency-weighted
window.

### Integration with Alpenglow Slices

A **slice** (formerly FEC-set) is the unit of erasure coding. Rotor
operates at the slice level: a validator begins forwarding as soon as it
can reconstruct the slice, not necessarily after receiving every
individual shred. This aligns with Alpenglow's latency targets and
Votor's certificate pipeline.

### Shred Format Compatibility

Rotor uses the existing shred wire format introduced by SIMD-0313 and
SIMD-0317. No changes to the shred encoding are required. The change is
purely in the relay topology and forwarding logic.

### Leader Behavior

The leader shreds each slice using the current FEC parameters and sends
the shreds to a deterministically sampled first-tier set of validators
(sampled by stake using the leader's local view of the active stake map).
The first-tier sample size is a protocol parameter, initially set to a
value sufficient to cover the top-2,000 stake-weighted validators admitted
under SIMD-0357.

### Validator Behavior

Upon receiving enough shreds to reconstruct a slice, a validator:

1. Validates all shreds (existing signature and merkle checks).
2. Forwards shreds to its Smart Sampling-selected peer set.
3. Reports delivery statistics to its local reliability scorer.

Validators do not forward shreds they cannot yet use to reconstruct the
slice (i.e., partial forwarding is disabled to prevent bandwidth waste).

### Configuration Parameters

| Parameter | Initial Value | Notes |
|---|---|---|
| First-tier sample size | TBD (≈20% of active set) | Tunable via feature gate |
| Reliability EMA window | 200 slots | |
| Relay hop limit | 2 | Prevents excessive amplification |

These values are initial suggestions. Final values must be validated by
the implementation team against mainnet topology data before activation.

## Alternatives Considered

- **Keep Turbine indefinitely**: Turbine works but is architecturally
  mismatched with Alpenglow's slice model and does not benefit from BLS
  aggregate key infrastructure.
- **Full push broadcast by leader**: Eliminates relay complexity but
  requires the leader to open O(N) connections; not scalable to 2,000
  validators.
- **DAG-based dissemination**: More bandwidth-efficient in steady state
  but significantly increases implementation complexity and was rejected
  during Alpenglow design as noted in SIMD-0326.

## Impact

- **Validator operators**: Network bandwidth profile changes. Validators
  in the first-tier relay set will see higher inbound shred traffic from
  the leader and higher outbound relay traffic. Net bandwidth is expected
  to decrease compared to Turbine due to elimination of retransmit layers.
- **RPC nodes**: No direct impact on transaction handling; shred delivery
  speed improvements will modestly reduce block landing latency seen by
  RPC subscribers.
- **Client software**: No changes required.

## Security Considerations

Smart Sampling's probabilistic peer selection makes it significantly
harder for a small Byzantine coalition to selectively withhold shreds
from specific validators compared to Turbine's deterministic tree. The
relay hop limit (2) bounds amplification attacks.

The security proof framework from the Alpenglow white paper covers Rotor
under the same 20+20 fault model (20% Byzantine, 20% crash) as Votor.

## Drawbacks

- Implementation complexity is higher than maintaining Turbine.
- The Smart Sampling reliability scorer introduces state that must be
  maintained across epochs, adding memory overhead.
- Behavior under adversarial conditions requires empirical validation on
  testnet before mainnet activation.

## Backwards Compatibility

Incompatible with Turbine. Activation requires a coordinated feature gate
rollout. During the migration window defined in SIMD-0532 (Rotor
Migration), Turbine and Rotor can coexist with validators negotiating
which protocol to use via the existing gossip version negotiation
mechanism.

## Bibliography

1. *Kniep, Sliwinski, Wattenhofer*, **Solana Alpenglow Consensus:
   Increased Bandwidth, Reduced Latency v1.1**, 2025,
   https://www.anza.xyz/alpenglow-1-1
2. SIMD-0326: Alpenglow (Votor)
3. SIMD-0532: Rotor Migration
4. SIMD-0357: Alpenglow Validator Admission Ticket
5. SIMD-0313: Drop Unchained Merkle Shreds
6. SIMD-0317: Enforce 32 Data Shreds
