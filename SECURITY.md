# Security Policy

Last updated: 2026-07-15

## Purpose
This document explains how to report security vulnerabilities in this repository and how we handle them. It also documents supported project versions and our disclosure/triage policies. This policy is intended for security researchers, integrators, and operators of DeFi infrastructure interacting with our code and deployed contracts.

## References
- Eve Security Guidance: <REPLACE_WITH_EVE_SECURITY_DOCS_URL>
  - Please consult Eve's documentation for integration-specific hardening and oracle/agent guidance.
- CVE and CVSS guidance: https://www.first.org/cvss/

## Supported Versions
| Version | Supported for security fixes |
| ------- | ---------------------------: |
| 5.1.x   | :white_check_mark:           |
| 5.0.x   | :x:                         |
| 4.0.x   | :white_check_mark:           |
| < 4.0   | :x:                         |

Keep this table current in releases. If you are unsure whether a deployed instance is supported, include the commit hash / docker image tag / program-id (Solana) in your report.

## Reporting a Vulnerability (private)
Please report security issues ONLY via one of the following private channels:

1. Email (preferred): security@yourdomain.tld
2. Encrypted email using our PGP key (preferred for PoC or credentials):
   -----BEGIN PGP PUBLIC KEY BLOCK-----
   (Replace with project's PGP public key)
   -----END PGP PUBLIC KEY BLOCK-----
3. GitHub private security advisory: https://github.com/{owner}/{repo}/security/advisories/new

Do not open public issues or post PoCs to public channels until the issue is resolved or coordinated disclosure is agreed.

Include the following in your report:
- Affected component(s) and version(s) (git commit, tag, or deployed program-id / contract address).
- Clear description of the issue and impact (on-chain funds risk, oracle manipulation, MEV exploitation potential).
- Step-by-step reproduction, test scripts, transaction hashes, and minimized PoC if possible.
- Expected and observed behavior.
- Any suggested mitigations or fixes.
- Your contact information and PGP key (if not using encrypted email).

## Initial acknowledgement and triage SLAs
- Initial acknowledgement: within 48 hours (24 hours for incidents with suspected immediate fund risk).
- Triage and classification: typically within 7 calendar days.
- Remediation timeline: depends on severity. For critical, time-sensitive issues affecting funds, we will attempt to coordinate and release mitigations or rollbacks within 72 hours where feasible.
We will keep the reporter updated at each stage.

## Severity classification
- Critical: Immediate fund-loss or complete compromise of a private key/validator/oracle causing large-scale theft or irreversible chain state corruption. Requires immediate coordination and emergency response.
- High: Serious vulnerability enabling financial loss, large-scale frontrunning, or prolonged denial of service on core functionality.
- Medium: Vulnerabilities that may degrade security or allow limited exploitability with non-trivial conditions.
- Low: Minor issues, informational, or low-impact bugs.

We may adopt CVSS scoring to quantify severity and use it to coordinate CVE requests.

## Disclosure and coordination
- We will coordinate disclosure with the reporter and, where applicable, affected third parties (e.g., bridges, oracles, node operators).
- We aim to publish a public advisory after a fix is deployed and users are notified, or after an agreed embargo period.
- If an external CVE is warranted, we will request/assign it and include it in the advisory.

## Responsible disclosure / safe harbor
We welcome good-faith security research. To reduce legal risk for researchers, we request:
- Do not exploit vulnerabilities to steal funds, exfiltrate private data, or interfere with production services.
- Limit testing to minimal, non-destructive interactions (use testnets and forks whenever possible).
- If live-system testing is necessary, notify us first and use irreversible actions only with explicit written consent.
- We will not pursue civil or criminal action against researchers acting in good faith and following this policy. This does not protect against criminal actions or activities that exceed the scope of responsible disclosure (e.g., theft).

## Credit and rewards
- We will credit reporters in security advisories unless the reporter requests anonymity.
- We maintain an internal reward policy. If you wish to discuss compensation, include that request in your secure report. (If we operate a public bounty program, details/links will be added here.)

## On-chain emergency handling (DeFi-specific)
If an issue threatens user funds or live contract integrity:
- Immediately contact the emergency security contact (use the same security@ email, mark the subject line as "CRITICAL: ON-CHAIN INCIDENT").
- Provide contract program-ids, tx IDs, and evidence.
- We will, if available, activate emergency pause/guardian/upgrade patterns and coordinate RPC endpoints and mitigation steps.
- Follow the instructions provided by maintainers for any emergency upgrade or governance action; do not accept third-party instructions.

## Dependency and supply-chain security
- We use Dependabot (or similar) to track vulnerabilities in third-party libraries. Security advisories for dependencies will be triaged and patched according to severity.
- For any 3rd-party dependency compromises that could affect this repository, we will publish advisory notes and suggested mitigation steps.

## Internal triage process (high level)
- Receive & acknowledge.
- Reproduce & scope.
- Assign severity and owners.
- Implement fix, test, and backport (where applicable).
- Coordinate disclosure and CVE (if applicable).
- Publish advisory and release patch.

## Privacy and data handling
- Do not include third-party private data in public reports.
- Security reports that contain sensitive data should be submitted via encrypted channel.

## Contact information
Email: security@yourdomain.tld
PGP key: (paste full public key block here)
GitHub: https://github.com/{owner}/{repo}/security

## Additional notes and hardening suggestions (for integrators)
- Follow Eve's security guidance on agent-auth, oracle verification, and key lifecycle management: <REPLACE_WITH_EVE_SECURITY_DOCS_URL>
- Regularly rotate keys, run nodes with hardware security modules (HSMs) where possible, and monitor mempool/transaction patterns for abnormal activity.

## Change log
- 2026-07-15: Initial production-ready policy added.