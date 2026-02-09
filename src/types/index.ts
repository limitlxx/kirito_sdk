// Core Types
export type Address = string;
export type TokenId = string;
export type TransactionHash = string;
export type Timestamp = number;
export type GroupId = string;
export type ProposalId = string;
export type VoteId = string;
export type BoxId = string;

// Cryptographic Types
export interface EncryptionKey {
  key: Uint8Array;
  iv: Uint8Array;
}

export interface EncryptedData {
  data: Uint8Array;
  nonce: Uint8Array;
}

export interface ZKProof {
  proof: Uint8Array;
  publicInputs: Uint8Array[];
}

export interface SemaphoreProof {
  merkleTreeRoot: string;
  nullifierHash: string;
  signal: string;
  externalNullifier: string;
  proof: string[];
}

// Shielded Pool Types
export interface Commitment {
  value: string;
}

export interface Nullifier {
  value: string;
}

export interface EncryptedAmount {
  ciphertext: Uint8Array;
  ephemeralKey: Uint8Array;
}

export interface EncryptedBalance {
  encryptedAmount: EncryptedAmount;
  proof: Uint8Array;
}

export interface ShieldedNote {
  commitment: Commitment;
  nullifier: Nullifier;
  encryptedAmount: EncryptedAmount;
  tokenAddress: Address;
  owner: string; // Public key
}

// NFT and Metadata Types
export interface Attribute {
  trait_type: string;
  value: string | number;
  display_type?: string;
}

export interface TokenMetadata {
  name: string;
  description: string;
  image: string;
  attributes: Attribute[];
  yieldMultiplier: number;
  rarityScore: number;
  semaphoreGroupId?: string;
  hiddenTraits?: EncryptedData;
  auctionId?: string;
}

// Generation Engine Types
export interface LayerConfig {
  name: string;
  path: string;
  weight: number;
  traits: TraitConfig[];
}

export interface TraitConfig {
  name: string;
  weight: number;
  filename: string;
}

export interface RarityConfig {
  [traitType: string]: {
    [traitValue: string]: number;
  };
}

export interface HiddenTraitConfig {
  traits: string[];
  revealConditions: RevealConditions;
}

export interface GenerationConfig {
  layers: LayerConfig[];
  rarityWeights: RarityConfig;
  hiddenTraits?: HiddenTraitConfig;
  collectionSize: number;
  semaphoreGroupId?: string;
  extraMetadata?: any;
}

export interface CollectionMetadata {
  tokens: TokenMetadata[];
  ipfsHashes: IPFSHashes;
  totalSupply: number;
}

export interface IPFSHashes {
  images: string[];
  metadata: string[];
  collection: string;
}

// Mystery Box Types
export interface HiddenData {
  traits: { [key: string]: any };
  yieldRange?: { min: number; max: number };
}

export interface RevealConditions {
  type: 'timelock' | 'action' | 'combined';
  timestamp?: Timestamp;
  requiredAction?: string;
  parameters?: { [key: string]: any };
}

export interface MysteryBox {
  tokenId: TokenId;
  encryptedTraits: EncryptedData;
  revealConditions: RevealConditions;
  revealProof?: ZKProof;
  isRevealed: boolean;
}

export interface RevealedTraits {
  traits: { [key: string]: any };
  timestamp: Timestamp;
  proof: ZKProof;
}

// Governance Types
export interface Proposal {
  id: ProposalId;
  title: string;
  description: string;
  options: string[];
  groupId: GroupId;
  deadline: Timestamp;
  votingPower: VotingPowerType;
}

export enum VotingPowerType {
  EQUAL = 'equal',
  STAKE_WEIGHTED = 'stake_weighted',
  RARITY_WEIGHTED = 'rarity_weighted'
}

export interface VoteResults {
  proposalId: ProposalId;
  totalVotes: number;
  results: { [option: string]: number };
  isFinalized: boolean;
}

// Yield Types
export interface YieldAmount {
  amount: bigint;
  token: Address;
  period: TimePeriod;
}

export interface TimePeriod {
  start: Timestamp;
  end: Timestamp;
}

export interface StakingInfo {
  tokenId: TokenId;
  stakedAmount: bigint;
  rarityScore: number;
  yieldMultiplier: number;
  lastClaimTimestamp: Timestamp;
}

export interface SourceYieldData {
  sourceId: string;
  sourceName: string;
  rawYield: bigint;
  weightedYield: bigint;
  weight: number;
  token: Address;
}

export interface AggregatedYield {
  totalYield: bigint;
  sourceBreakdown: SourceYieldData[];
  period: TimePeriod;
  aggregationTimestamp: Timestamp;
}

export interface StakingStatistics {
  totalStakedAmount: bigint;
  totalRarityWeight: number;
  activeStakers: number;
  averageStake: bigint;
  averageRarity: number;
}

// ZK Proof Types for Yield Claims
export interface YieldClaimProofData {
  tokenId: TokenId;
  stakedAmount: bigint;
  rarityScore: number;
  yieldMultiplier: number;
  claimAmount: bigint;
  stakingNote: ShieldedNote;
  lastClaimTimestamp: Timestamp;
}

export interface YieldEligibilityPublicInputs {
  tokenId: TokenId;
  claimAmount: bigint;
  merkleRoot: string;
  nullifierHash: string;
  currentTimestamp: Timestamp;
}

// Account Abstraction Types
export interface UserOperation {
  sender: Address;
  nonce: bigint;
  initCode: Uint8Array;
  callData: Uint8Array;
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  paymasterAndData: Uint8Array;
  signature: Uint8Array;
}

export interface ValidationResult {
  isValid: boolean;
  validAfter: Timestamp;
  validUntil: Timestamp;
  authorizer: Address;
}

export interface Transaction {
  to: Address;
  value: bigint;
  data: Uint8Array;
  gasLimit: bigint;
}

// Network Configuration
export interface NetworkConfig {
  name: string;
  rpcUrl: string;
  chainId: string;
  contracts: {
    [contractName: string]: Address;
  };
}

// SDK Configuration
export interface KiritoSDKConfig {
  network: NetworkConfig;
  ipfs: {
    url: string;
    projectId?: string;
    projectSecret?: string;
  };
  privacy: {
    tongoEndpoint: string;
    semaphoreEndpoint: string;
  };
}

// Additional types for Governance
export interface Signal {
  message: string;
  scope: string;
}

export interface Identity {
  privateKey: Uint8Array;
  commitment: Commitment;
}

// Additional types for Mystery Box
export interface Secret {
  value: any;
  randomness: Uint8Array;
}

export interface PublicInputs {
  [key: string]: any;
}

export interface NoirCircuit {
  source: string;
  dependencies: string[];
}

export interface CompiledCircuit {
  bytecode: Uint8Array;
  abi: any;
}

// Additional types for Generation Engine
export interface ImageData {
  buffer: Buffer;
  filename: string;
  metadata: any;
}

export interface MetadataSet {
  [tokenId: string]: any;
}

export interface HiddenTraits {
  [traitType: string]: any;
}

// Sealed-Bid Auction Types
export type AuctionId = string;
export type BidId = string;

export interface BidCommitment {
  bidId: BidId;
  commitment: string; // Hash of bid amount + nonce
  bidder: Address;
  timestamp: Timestamp;
}

export interface SealedBid {
  bidId: BidId;
  amount: bigint;
  nonce: Uint8Array;
  bidder: Address;
  commitment: string;
  isRevealed: boolean;
}

export interface AuctionConfig {
  tokenId: TokenId;
  startingPrice: bigint;
  reservePrice?: bigint;
  commitmentPhaseEnd: Timestamp;
  revealPhaseEnd: Timestamp;
  auctioneer: Address;
}

export interface Auction {
  id: AuctionId;
  config: AuctionConfig;
  state: AuctionState;
  bids: BidCommitment[];
  revealedBids: SealedBid[];
  winner?: Address;
  winningBid?: bigint;
  createdAt: Timestamp;
  finalizedAt?: Timestamp;
}

export enum AuctionState {
  CREATED = 'created',
  COMMITMENT_PHASE = 'commitment_phase',
  REVEAL_PHASE = 'reveal_phase',
  FINALIZED = 'finalized',
  CANCELLED = 'cancelled'
}

export interface AuctionResults {
  auctionId: AuctionId;
  winner: Address;
  winningBid: bigint;
  totalBids: number;
  revealedBids: number;
  finalizedAt: Timestamp;
}

// Error Types
export enum ErrorType {
  CRYPTOGRAPHIC_ERROR = 'cryptographic_error',
  NETWORK_ERROR = 'network_error',
  BUSINESS_LOGIC_ERROR = 'business_logic_error',
  PRIVACY_ERROR = 'privacy_error'
}

export interface KiritoError extends Error {
  type: ErrorType;
  code: string;
  details?: any;
}

// Recovery and Retry Types
export enum RecoveryAction {
  RETRY_WITH_NEW_RANDOMNESS = 'retry_with_new_randomness',
  REGENERATE_PROOF = 'regenerate_proof',
  FALLBACK_TO_PUBLIC_MODE = 'fallback_to_public_mode',
  ABORT_OPERATION = 'abort_operation'
}

export interface RetryStrategy {
  maxAttempts: number;
  backoffMs: number;
  exponential: boolean;
}