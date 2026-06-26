---
simd: '0532'
title: Rotor Migration
authors:
  - Richard Patterson
category: Standard
type: Core
status: Draft
created: 2026-06-26
feature: (fill in with feature key and github tracking issues once accepted)
---

## Summary

This proposal specifies the migration procedure for transitioning the
Solana network's data dissemination layer from **Turbine** to **Rotor**,
as defined in SIMD-0530. It defines the handoff mechanism, coexistence
window, activation sequencing, rollback conditions, and the deprecation
path for Turbine. This document covers the full lifecycle from feature
gate activation through Turbine removal.

## Motivation

SIMD-0530 (Rotor) defines the protocol. SIMD-0531 (Rotor — Anza
Implementation Plan) defines the agave engineering work. Neither
document specifies *how* the network transitions from a live Turbine
deployment to a live Rotor deployment without risking a propagation
outage. This SIMD fills that gap.

The migration must satisfy four constraints:

1. **Safety**: No finalized block may be lost during the transition.
   Shred delivery must not drop below the erasure-coding recovery
   threshold at any point during the switchover.
2. **Liveness**: Validators that have not yet upgraded must still
   receive shreds via Turbine fallback throughout the coexistence window.
3. **Observability**: Operators and the broader community must have clear
   on-chain and metric-level signals indicating migration progress.
4. **Reversibility**: If Rotor exhibits unexpected behavior on
   mainnet-beta, a safe rollback path must exist before Turbine is
   removed.

## Dependencies

This proposal depends on the following accepted proposals:

- **[SIMD-0326]: Alpenglow (Votor)**

  Rotor is designed around the Alpenglow slice/shred model. The active
  validator set is governed by the Validator Admission Ticket (VAT)
  mechanism from SIMD-0326, which bounds the active set to ≤2,000
  validators and is required to make Rotor's first-tier sample sizing
  tractable.

- **[SIMD-0357]: Alpenglow Validator Admission Ticket**

  Defines the admission mechanism that bounds the active validator set
  Rotor must reach.

- **[SIMD-0384]: Alpenglow Migration**

  Rotor migration occurs inside an already-Alpenglow cluster. The
  migration boundary, genesis block, and BLS key infrastructure
  established by SIMD-0384 are prerequisites. Rotor migration cannot
  begin until SIMD-0384 activation is complete and the network is
  running Alpenglow/Votor.

- **[SIMD-0387]: BLS Pubkey Management in Vote Account**

  Rotor's Smart Sampling peer selection uses BLS-keyed validator
  identities. BLS keys must be populated in all active vote accounts
  before Rotor activation.

- **[SIMD-0530]: Rotor**

  Protocol specification this migration implements.

- **[SIMD-0531]: Rotor — Anza Implementation Plan**

  Defines the agave feature gate (`rotor_enabled`), the
  `ContactInfo.rotor_version` gossip field, and the shadow-mode metrics
  that serve as the go/no-go signal for mainnet activation.

- **[SIMD-0313]: Drop Unchained Merkle Shreds**
- **[SIMD-0317]: Enforce 32 Data Shreds**

  These define the shred wire format that Rotor reuses without
  modification.

## New Terminology

All terminology from SIMD-0326, SIMD-0530, and SIMD-0531 applies.
The following are specific to this migration:

**Rotor migration boundary slot** (`R`): the slot at which the
`rotor_enabled` feature gate activates. All slots ≥ `R` use Rotor as
the primary dissemination protocol. Turbine fallback remains available
until the **Turbine deprecation slot** (`D`).

**Turbine fallback**: the behavior of a Rotor-capable validator that
sends Turbine-format shred relays to peers that have not yet advertised
`ContactInfo.rotor_version`. Active during the coexistence window
`[R, D)`.

**Turbine deprecation slot** (`D`): the slot at which Turbine fallback
is disabled. Set to `R + 50,000` (approximately 5.5 days at 400ms
slots). This provides a safe window for all validators to upgrade while
keeping the migration window short enough to retire technical debt
promptly.

**Shadow mode**: the devnet phase (SIMD-0531 Phase 1) during which Rotor
runs in parallel with Turbine but does not influence block delivery.
Metrics from shadow mode form the primary empirical basis for the
mainnet activation decision.

**Go/no-go criteria**: the quantitative thresholds defined in the
**Activation Criteria** section below that must be met before advancing
each migration phase.

**Rotor coverage ratio**: the fraction of the active stake-weighted
validator set advertising `ContactInfo.rotor_version ≥ 1` in gossip at
any given slot.

## Detailed Design

### Phase Overview

The migration proceeds through four phases. Each phase has explicit
entry criteria and exit criteria. No phase may be skipped.

```
Phase 1 — Shadow Mode (devnet)
  ↓  [go/no-go: shadow metrics pass]
Phase 2 — Rotor Primary (testnet, Turbine fallback active)
  ↓  [go/no-go: testnet soak, coverage ≥ 95%]
Phase 3 — Turbine Deprecated (testnet)
  ↓  [go/no-go: ≥2 full epochs clean, no relay failures]
Phase 4 — Mainnet Activation
```

---

### Phase 1 — Shadow Mode (devnet)

**Entry criteria**: agave release containing SIMD-0531 shadow-mode
instrumentation is deployed to ≥90% of devnet validators.

**Behavior**: Rotor runs the full Smart Sampling relay pipeline but the
`RotorStage` output is discarded. Block delivery continues via Turbine
exclusively. The following shadow metrics are collected per slot:

- Projected Rotor delivery latency (estimated from peer reliability
  scores, not from actual delivery).
- Smart Sampling peer selection distribution (Gini coefficient over
  stake; should be ≤0.4 to confirm the sampler is not over-concentrating
  relay load).
- `rotor_peer_reliability_score` EMA convergence: scores should
  stabilize within 200 slots of devnet start.

**Exit criteria (go/no-go to Phase 2)**:

| Metric | Threshold |
|--------|-----------|
| Shadow latency p50 vs Turbine p50 | Rotor ≤ Turbine |
| Shadow latency p99 vs Turbine p99 | Rotor ≤ Turbine × 1.2 |
| Reliability score Gini coefficient | ≤ 0.40 |
| Consecutive slots with no sampler panic | ≥ 10,000 |

If any threshold is not met after 30 days of shadow operation, the
implementation team must diagnose, fix, and restart the shadow window.

---

### Phase 2 — Rotor Primary, Turbine Fallback Active (testnet)

**Entry criteria**: Phase 1 go/no-go criteria met. agave release
activating `rotor_enabled` feature gate deployed to testnet.

The `rotor_enabled` feature gate activation sets the **Rotor migration
boundary slot** `R` to `feature_activation_slot + 5,000` (mirroring
SIMD-0384's `X + 5,000` convention to avoid epoch boundaries).

**Behavior from slot `R` onwards**:

- Leaders use Rotor first-tier sampling instead of Turbine tree
  construction for shred dissemination.
- Validators run `RotorStage` for relay. Validators forward Turbine
  shreds to any peer not advertising `rotor_version` in `ContactInfo`.
- `rotor_fallback_to_turbine_total` counter is active.

**Exit criteria (go/no-go to Phase 3)**:

| Metric | Threshold |
|--------|-----------|
| Rotor coverage ratio (testnet) | ≥ 95% of stake |
| Block skip rate delta vs pre-Rotor baseline | ≤ +0.5% |
| `rotor_relay_latency_ms` p99 | ≤ 150ms |
| Duration at above thresholds | ≥ 2 full epochs |

---

### Phase 3 — Turbine Deprecated (testnet)

**Entry criteria**: Phase 2 exit criteria met. A new agave release is
cut that disables the Turbine fallback path.

The **Turbine deprecation slot** `D` is set to `R + 50,000` on testnet.
On mainnet-beta, `D` will be set by a separate feature gate
`turbine_disabled` activated via the standard SIMD-0089 vote process,
no earlier than `R_mainnet + 50,000`.

**Behavior from slot `D` onwards**:

- `RetransmitStage` is fully disabled. Validators no longer send or
  accept Turbine-format relay shreds.
- `ContactInfo.rotor_version` advertisement becomes mandatory for
  inclusion in any validator's relay peer list.

**Exit criteria (go/no-go to Phase 4)**:

| Metric | Threshold |
|--------|-----------|
| Block skip rate delta vs pre-Rotor baseline | ≤ +0.5% |
| Relay delivery rate (slices reaching ≥80% of stake within 1 slot) | ≥ 99.5% |
| Duration clean | ≥ 2 full epochs |
| Open P0/P1 issues against `rotor` label in agave repo | 0 |

---

### Phase 4 — Mainnet Activation

**Entry criteria**: All Phase 3 exit criteria met. A governance
discussion thread on the SIMD repository has been open for ≥14 days
with no unresolved objections.

**Activation sequence**:

1. An agave release with `rotor_enabled` targeting mainnet-beta is cut.
2. The feature gate is activated via the standard SIMD-0089 process.
   The Rotor migration boundary slot `R_mainnet` is set to
   `activation_slot + 5,000`.
3. The coexistence window `[R_mainnet, D_mainnet)` runs for 50,000 slots
   (≈5.5 days). During this window, Turbine fallback remains active.
4. After observing Rotor coverage ratio ≥ 97% of mainnet-beta stake (or
   after 50,000 slots, whichever is later), a second feature gate
   `turbine_disabled` is activated via SIMD-0089, setting
   `D_mainnet = R_mainnet + 50,000`.
5. From slot `D_mainnet`, Turbine is fully retired.

### Rollback Procedure

If at any point during Phases 2–4 a severity-1 relay outage is
attributed to Rotor (defined as block skip rate > 5% sustained for >100
consecutive slots), the following rollback steps apply:

1. The implementation team activates a `rotor_disabled` kill-switch
   feature gate (pre-baked into the agave release for exactly this
   purpose). This gate overrides `rotor_enabled` and forces all
   validators back to Turbine immediately.
2. `D_mainnet` (if already set) is voided; Turbine fallback is
   re-enabled cluster-wide.
3. A post-mortem is published within 7 days on the SIMD GitHub
   discussion thread for SIMD-0530.
4. Re-entry to Phase 2 requires a new agave release with the root cause
   addressed and a fresh Phase 1 shadow window (minimum 14 days).

The `rotor_disabled` kill-switch is architecturally simpler than a full
feature-gate reversal because it only needs to flip a single boolean in
the TVU pipeline constructor, which is safe to activate mid-epoch
without a cluster restart.

### On-Chain Migration Signal

Following the pattern established in SIMD-0384, a migration success
signal is written to an off-curve account once the first Rotor-delivered
block achieves a Votor finalization certificate. The account address is:

```
Pubkey::find_program_address(&[b"rotor_migration"], alpenglow::id())
```

This account is populated by the leader of the first block after `R`
that receives a finalization certificate via the Rotor relay path. Its
presence in any subsequent snapshot signals to newly joining validators
that they should initialize with Rotor active, without needing to replay
the migration boundary.

### ContactInfo Gossip Extension

SIMD-0531 introduces `ContactInfo.rotor_version: Option<u8>`. For the
purposes of this migration:

- `None` or absent: validator is running Turbine only; must receive
  Turbine fallback during coexistence window.
- `rotor_version = 1`: validator is running SIMD-0530 Rotor with Smart
  Sampling as specified in this document.

Future Rotor protocol revisions increment this field. Validators MUST
reject relay connections from peers claiming `rotor_version` values
higher than their own supported maximum, to prevent version-skew relay
failures.

### Interaction with Alpenglow Migration (SIMD-0384)

Rotor migration is strictly sequenced *after* Alpenglow (Votor)
migration. The invariant is:

```
slot(Alpenglow genesis block) < R_mainnet
```

This is enforced in the agave feature gate dependency graph:
`rotor_enabled` has `alpenglow_enabled` as a hard prerequisite and will
not activate if `alpenglow_enabled` is not already active.

The reason for strict sequencing is that Rotor's first-tier sample size
is parameterized against the VAT-bounded active validator set
(SIMD-0357), which only exists after the Alpenglow migration is
complete. Activating Rotor against a Turbine-era validator set of
unbounded size would violate the bandwidth assumptions in SIMD-0530
Section on Configuration Parameters.

## Alternatives Considered

**Flag-day cutover**: Activate Rotor and disable Turbine atomically in a
single feature gate. Simpler to implement but eliminates the coexistence
window, meaning any validator that has not upgraded before the activation
slot loses shred delivery entirely. Rejected as incompatible with the
network's rolling-upgrade operational model.

**Longer coexistence window (100,000 slots)**: Provides more time for
lagging validators to upgrade but doubles the period during which both
code paths must be maintained and tested. Rejected; the 50,000-slot
window (~5.5 days) is consistent with historical Solana feature gate
upgrade windows and aligns with the validator community's established
upgrade cadence.

**Rotor and Turbine as permanent co-protocols**: Keep Turbine as a
permanent fallback for validators excluded from Rotor's first-tier
sample. Rejected because this would permanently bifurcate the relay
codebase and create an incentive for validators to avoid upgrading,
accumulating technical debt indefinitely.

**Rollback via feature-gate reversal**: Reversing a feature gate
requires a supermajority vote and carries risks of state inconsistency.
The `rotor_disabled` kill-switch approach (a separate additive gate) is
safer because it does not require undoing any already-processed state.

## Impact

**Validator operators**: Must upgrade to a Rotor-capable agave release
before `D_mainnet` to avoid losing relay connectivity. The upgrade path
is a standard binary replacement; no configuration changes are required
for default-configured validators. Operators running custom Turbine
topology overrides (e.g., custom `--turbine-fanout` settings) must
remove those before `D_mainnet` as the configuration key will be removed
from the CLI.

**RPC node operators**: No breaking API changes. Rotor delivery
improvements will reduce the observed time between transaction
submission and block inclusion for latency-sensitive RPC subscribers.

**Client software and dApps**: No changes required.

**Non-Anza client implementations**: Any client implementing
SIMD-0530 must also implement the `ContactInfo.rotor_version` gossip
field and the Turbine fallback behavior during the coexistence window.
Clients that do not implement the fallback will be unable to relay to
non-upgraded peers during `[R, D)` and may degrade propagation for
those peers' stake.

## Security Considerations

**Coexistence window amplification**: During `[R, D)`, a validator
receives shreds via both Rotor and Turbine paths. Duplicate shred
handling (already present in the agave shred pipeline) prevents
double-processing. The `rotor_fallback_to_turbine_total` counter
provides visibility into whether the fallback path is being exploited
to inflate bandwidth.

**Kill-switch timing**: The `rotor_disabled` gate, if activated, affects
all validators simultaneously at the slot boundary. There is a
brief (~one slot) window during which some validators may have already
applied the Rotor path for a given slot's shreds while others have not.
This is safe because Turbine shreds for that slot continue to propagate
during the fallback transition and FEC recovery handles any gap.

**Stake-weighted coverage threshold**: The 97% coverage threshold for
mainnet activation of `turbine_disabled` ensures that validators holding
at most 3% of stake may lag upgrades without blocking the network. This
is consistent with the VAT eviction threshold from SIMD-0357.

## Drawbacks

- The four-phase process extends the calendar time from first devnet
  deployment to full mainnet Turbine removal to approximately 60–90
  days. This is a deliberate tradeoff for safety over speed.
- The `rotor_disabled` kill-switch adds a code path that must be
  maintained but is intended never to be used. It imposes a small
  ongoing maintenance burden.
- The on-chain migration signal account adds a small rent-exempt
  balance requirement to the Alpenglow program.

## Backwards Compatibility

Not backwards compatible. Validators that do not upgrade before
`D_mainnet` will be unable to participate in shred relay after the
Turbine deprecation slot. Their stake will not receive relay traffic
and they will fall back to repair (which remains available indefinitely)
at the cost of increased latency.

## Bibliography

1. SIMD-0326: Alpenglow (Votor)
2. SIMD-0357: Alpenglow Validator Admission Ticket
3. SIMD-0384: Alpenglow Migration
4. SIMD-0387: BLS Pubkey Management in Vote Account
5. SIMD-0530: Rotor (protocol specification)
6. SIMD-0531: Rotor — Anza Implementation Plan
7. SIMD-0307: Add Block Footer
8. SIMD-0313: Drop Unchained Merkle Shreds
9. SIMD-0317: Enforce 32 Data Shreds
10. SIMD-0089: Programify Feature Gate Program
11. *Kniep, Sliwinski, Wattenhofer*, **Solana Alpenglow Consensus:
    Increased Bandwidth, Reduced Latency v1.1**, 2025,
    https://www.anza.xyz/alpenglow-1-1
