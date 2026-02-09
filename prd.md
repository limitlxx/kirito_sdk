# Kirito SDK Product Requirements Document (PRD) – MVP for Starknet Hackathon Re{define}

## 1. Document Overview
- **Product Name**: Kirito SDK
- **Version**: 2.1 (MVP – Hackathon Submission Ready)
- **Date**: January 26, 2026
- **Author**: Grok (Acting as Expert Product Manager)
- **Purpose**: This PRD defines the **Minimum Viable Product (MVP)** for the Kirito SDK, optimized for submission to the Starknet Hackathon Re{define} (February 1–28, 2026). The MVP focuses on core functionality with strong privacy features, Starknet-native tools, and direct alignment with Privacy Track curated ideas. It includes NFTs that function as **wallets** (via account abstraction) and adds all necessary URLs to resources.

## 2. Product Vision and Goals (MVP Scope)
### Vision
Kirito SDK is a privacy-first toolkit that lets developers create, mint, and manage yield-generating NFTs on Starknet. Each NFT acts as a **smart wallet** (via ERC-4337 account abstraction), holding tokens and accruing shielded yields. Mystery boxes provide hidden-state gamification, all protected by zk-privacy.

### MVP Goals
- Deliver a functional end-to-end pipeline: **Generation → Private Minting → Shielded Yields → Mystery Reveals**.
- Make NFTs function as **wallets** (store/transfer tokens, receive yields privately).
- Implement 3–4 high-impact Privacy Track ideas: Tongo shielded pools, Noir/Garaga proofs, Semaphore anonymous signaling, sealed-bid auctions.
- Achieve a polished demo for hackathon submission (video + repo).
- Ensure upgradeable contracts and excellent documentation.
- Ensure the SDK is live on npm package

### Success Metrics (MVP)
- Deployable on Starknet Sepolia testnet
- Demo shows private mint → shielded yield accrual → anonymous reveal
- Repo with 90%+ test coverage and clear examples

## 3. Core MVP Features
### Feature 1: NFT Collection Generation
- **Description**: Generate unique NFTs from uploaded layers using a forked HashLips engine.
- **Requirements**:
  - Input: Image layers, rarity config, optional hidden traits (for mystery).
  - Output: Images + metadata JSON uploaded to IPFS.
  - Custom fields: `yieldMultiplier`, `rarityScore`, `semaphoreGroupId` (for anonymous signaling).
  - **Resources**:
    - HashLips Art Engine: https://github.com/HashLips/hashlips_art_engine
    - IPFS Upload: https://docs.ipfs.tech/how-to/

### Feature 2: Private Minting with Staking (NFTs as Wallets)
- **Description**: Mint NFTs with shielded staking. Each NFT is a **smart wallet** (ERC-4337 account abstraction) capable of holding tokens, receiving yields, and executing private transfers.
- **Requirements**:
  - Deploy upgradeable ERC-721 proxy contract.
  - Integrated staking: Deposit into Tongo shielded pool during mint.
  - **NFT as Wallet**: Use Starknet account abstraction to make each NFT a non-custodial wallet (holders can send/receive tokens directly to/from the NFT).
  - Privacy: Shielded stake amounts via Tongo; stealth addresses for transfers.
  - Hackathon Tie-In: Sealed-bid auction for mints (hidden bids until reveal).
  - **Resources**:
    - Starknet Account Abstraction (ERC-4337): https://docs.starknet.io/architecture-and-concepts/accounts/account-abstraction
    - Tongo Shielded Pool SDK: https://docs.tongo.cash/sdk/quick-start.html
    - OpenZeppelin Cairo Contracts (for proxies & ERC-721): https://github.com/OpenZeppelin/cairo-contracts

### Feature 3: Shielded Yields on BTC and Distribution
- **Description**: Accrue and distribute yields privately from DeFi/RWA sources.
- **Requirements**:
  - Yield sources: Mock DeFi pool (Aave-like) or simple RWA oracle.
  - Distribution: Proportional to shielded stake + rarity.
  - Privacy: Claim yields via zk-proof (prove eligibility without revealing balance).
  - NFT Wallet Integration: Yields auto-deposited into the NFT-wallet.
  - **Resources**:
    - Noir + Garaga for zk-proofs: https://github.com/omarespejel/starknet-privacy-toolkit
    - Garaga Verifier: https://garaga.gitbook.io/garaga
    - Chainlink Oracles (for RWA data): https://docs.chain.link/starknet

### Feature 4: Enhanced Mystery Boxes with Private Reveals
- **Description**: Create mystery boxes with hidden traits/yields; reveal privately.
- **Requirements**:
  - Hide elements (traits, yield range) until conditions met (time-lock or user action).
  - Reveal: zk-verified using Noir circuit + Garaga on-chain verifier.
  - Hackathon Tie-In: Bluffing mechanics (prove hidden trait without full reveal).
  - **Resources**:
    - Starknet Privacy Toolkit (Noir circuits): https://github.com/omarespejel/starknet-privacy-toolkit
    - Semaphore for anonymous signaling: https://docs.semaphore.pse.dev/ (port to Cairo)

### Feature 5: Anonymous Governance & Signaling (Optional but High-Impact)
- **Description**: Enable private voting and signaling for collection holders.
- **Requirements**:
  - Use Semaphore to prove "I am a holder" without revealing identity.
  - Private votes on yield strategies or reveal timings.
  - **Resources**:
    - Semaphore Protocol: https://docs.semaphore.pse.dev/

## 4. Technical Requirements (MVP)
- **Blockchain**: Starknet Sepolia testnet (mainnet optional for final demo)
- **SDK**: JavaScript/TypeScript NPM package
- **Smart Contracts**: Cairo 2.0+, upgradeable via UUPS proxies
- **Privacy Stack**: Tongo shielded pools + Noir/Garaga zk-proofs
- **NFT as Wallet**: ERC-4337 account abstraction (Argent X or Braavos compatible)
- **Frontend Demo**: Simple React dApp (Scaffold-Stark recommended)
- **Testing**: Starknet Foundry + Jest (90% coverage)
- **Security**: Basic audit simulation; use OpenZeppelin Wizard

## 5. MVP Roadmap (Hackathon Timeline)
| Phase | Timeline | Deliverables |
|-------|----------|--------------|
| 1     | Feb 1–7  | Generation + Minting (Tongo shielded staking) |
| 2     | Feb 8–14 | Shielded Yields + NFT as Wallet |
| 3     | Feb 15–20| Mystery Boxes + zk-Reveal (Noir/Garaga) |
| 4     | Feb 21–25| Semaphore anonymous signaling + polish |
| 5     | Feb 26–28| Demo video, docs, submission on DoraHacks |

## 6. Resources & References (All Necessary URLs)
| Category                  | Resource Link                                                                 |
|---------------------------|-------------------------------------------------------------------------------|
| Starknet Documentation    | https://docs.starknet.io/                                                    |
| Starknet Hackathon        | https://hackathon.starknet.org                                               |
| HashLips Art Engine       | https://github.com/HashLips/hashlips_art_engine                              |
| Starknet Privacy Toolkit  | https://github.com/omarespejel/starknet-privacy-toolkit                      |
| Tongo Shielded Pool SDK   | https://docs.tongo.cash/sdk/quick-start.html                                 |
| Garaga Verifier           | https://garaga.gitbook.io/garaga                                             |
| Semaphore Protocol        | https://docs.semaphore.pse.dev/                                              |
| OpenZeppelin Cairo        | https://github.com/OpenZeppelin/cairo-contracts                              |
| Starknet Account Abstraction | https://docs.starknet.io/architecture-and-concepts/accounts/account-abstraction |
| Scaffold-Stark (Demo UI)  | https://github.com/Scaffold-Stark/scaffold-stark-2                           |
| Starknet Foundry (Testing)| https://foundry-rs.github.io/starknet-foundry/                               |
| IPFS Documentation        | https://docs.ipfs.tech/                                                      |

## 7. MVP Submission Deliverables
- **GitHub Repo**: Clean, well-documented with README, examples, and deployment scripts
- **Demo Video** (≤3 minutes): Show private mint → shielded yield accrual → zk-reveal → token transfer from NFT wallet
- **Deployment**: Live on Starknet Sepolia (with testnet explorer link)
- **Hackathon Alignment**: Explicitly reference Privacy Track ideas (Tongo, Garaga, Semaphore, sealed-bid auctions)

This MVP PRD is tightly scoped for hackathon success while delivering a compelling, privacy-focused product. If you need code snippets, demo script ideas, or further refinements, let me know! Good luck — this has strong winning potential!