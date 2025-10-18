pragma solidity ^0.8.24;

import { FHE, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract MusicFestFHE is SepoliaConfig {
    using FHE for euint32;
    using FHE for ebool;

    address public owner;
    mapping(address => bool) public isProvider;
    bool public paused;
    uint256 public cooldownSeconds;
    mapping(address => uint256) public lastSubmissionTime;
    mapping(address => uint256) public lastDecryptionRequestTime;

    uint256 public currentBatchId;
    mapping(uint256 => bool) public isBatchOpen;
    mapping(uint256 => uint256) public bandCountInBatch;
    mapping(uint256 => mapping(uint256 => euint32)) public encryptedBandPotential; // batchId => bandIndex => euint32
    mapping(uint256 => mapping(uint256 => uint256)) public bandVenueCost; // batchId => bandIndex => uint256
    mapping(uint256 => mapping(uint256 => uint256)) public bandPromotionBudget; // batchId => bandIndex => uint256
    mapping(uint256 => uint256) public totalVenueCost;
    mapping(uint256 => uint256) public totalPromotionBudget;

    struct DecryptionContext {
        uint256 batchId;
        bytes32 stateHash;
        bool processed;
    }
    mapping(uint256 => DecryptionContext) public decryptionContexts;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ProviderAdded(address indexed provider);
    event ProviderRemoved(address indexed provider);
    event Paused(address account);
    event Unpaused(address account);
    event CooldownSecondsSet(uint256 oldCooldownSeconds, uint256 newCooldownSeconds);
    event BatchOpened(uint256 indexed batchId);
    event BatchClosed(uint256 indexed batchId);
    event BandSigned(uint256 indexed batchId, uint256 bandIndex, uint256 venueCost, uint256 promotionBudget);
    event FestivalEvaluated(uint256 indexed batchId, uint256 totalPotential, uint256 totalRevenue, uint256 totalProfit);
    event DecryptionRequested(uint256 indexed requestId, uint256 indexed batchId);
    event DecryptionCompleted(uint256 indexed requestId, uint256 indexed batchId, uint256 totalPotential);

    error NotOwner();
    error NotProvider();
    error PausedState();
    error CooldownActive();
    error BatchNotOpen();
    error InvalidBandIndex();
    error ReplayAttempt();
    error StateMismatch();
    error InvalidProof();
    error BatchAlreadyOpen();
    error BatchNotClosed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyProvider() {
        if (!isProvider[msg.sender]) revert NotProvider();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert PausedState();
        _;
    }

    modifier checkSubmissionCooldown() {
        if (block.timestamp < lastSubmissionTime[msg.sender] + cooldownSeconds) {
            revert CooldownActive();
        }
        _;
    }

    modifier checkDecryptionCooldown() {
        if (block.timestamp < lastDecryptionRequestTime[msg.sender] + cooldownSeconds) {
            revert CooldownActive();
        }
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
        _initIfNeeded();
    }

    function transferOwnership(address newOwner) public onlyOwner {
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    function addProvider(address provider) public onlyOwner {
        isProvider[provider] = true;
        emit ProviderAdded(provider);
    }

    function removeProvider(address provider) public onlyOwner {
        isProvider[provider] = false;
        emit ProviderRemoved(provider);
    }

    function setPaused(bool _paused) public onlyOwner {
        if (_paused) {
            paused = true;
            emit Paused(msg.sender);
        } else {
            paused = false;
            emit Unpaused(msg.sender);
        }
    }

    function setCooldownSeconds(uint256 newCooldownSeconds) public onlyOwner {
        uint256 oldCooldownSeconds = cooldownSeconds;
        cooldownSeconds = newCooldownSeconds;
        emit CooldownSecondsSet(oldCooldownSeconds, newCooldownSeconds);
    }

    function openBatch() public onlyOwner whenNotPaused {
        if (isBatchOpen[currentBatchId]) revert BatchAlreadyOpen();
        currentBatchId++;
        isBatchOpen[currentBatchId] = true;
        bandCountInBatch[currentBatchId] = 0;
        totalVenueCost[currentBatchId] = 0;
        totalPromotionBudget[currentBatchId] = 0;
        emit BatchOpened(currentBatchId);
    }

    function closeBatch() public onlyOwner whenNotPaused {
        if (!isBatchOpen[currentBatchId]) revert BatchNotOpen();
        isBatchOpen[currentBatchId] = false;
        emit BatchClosed(currentBatchId);
    }

    function signBand(
        uint256 venueCost,
        uint256 promotionBudget,
        euint32 encryptedPotential
    ) public onlyProvider whenNotPaused checkSubmissionCooldown {
        if (!isBatchOpen[currentBatchId]) revert BatchNotOpen();
        _initIfNeeded();

        uint256 bandIndex = bandCountInBatch[currentBatchId];
        encryptedBandPotential[currentBatchId][bandIndex] = encryptedPotential;
        bandVenueCost[currentBatchId][bandIndex] = venueCost;
        bandPromotionBudget[currentBatchId][bandIndex] = promotionBudget;

        totalVenueCost[currentBatchId] += venueCost;
        totalPromotionBudget[currentBatchId] += promotionBudget;
        bandCountInBatch[currentBatchId]++;

        lastSubmissionTime[msg.sender] = block.timestamp;
        emit BandSigned(currentBatchId, bandIndex, venueCost, promotionBudget);
    }

    function evaluateFestival(uint256 batchId) public whenNotPaused checkDecryptionCooldown {
        if (isBatchOpen[batchId]) revert BatchNotClosed();
        if (bandCountInBatch[batchId] == 0) revert InvalidBandIndex(); // Or a more specific error

        uint256 numBands = bandCountInBatch[batchId];
        euint32 totalEncryptedPotential = FHE.asEuint32(0);

        for (uint256 i = 0; i < numBands; i++) {
            if (!FHE.isInitialized(encryptedBandPotential[batchId][i])) {
                revert("FHE: uninitialized ciphertext"); // Should be a custom error
            }
            totalEncryptedPotential = totalEncryptedPotential.add(encryptedBandPotential[batchId][i]);
        }

        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(totalEncryptedPotential);

        bytes32 stateHash = _hashCiphertexts(cts);
        uint256 requestId = FHE.requestDecryption(cts, this.myCallback.selector);

        decryptionContexts[requestId] = DecryptionContext({ batchId: batchId, stateHash: stateHash, processed: false });
        lastDecryptionRequestTime[msg.sender] = block.timestamp;
        emit DecryptionRequested(requestId, batchId);
    }

    function myCallback(uint256 requestId, bytes memory cleartexts, bytes memory proof) public {
        if (decryptionContexts[requestId].processed) revert ReplayAttempt();
        if (cleartexts.length != 32) revert("Invalid cleartext length"); // Should be a custom error

        // Rebuild cts in the exact same order as in evaluateFestival
        uint256 numBands = bandCountInBatch[decryptionContexts[requestId].batchId];
        euint32 totalEncryptedPotential = FHE.asEuint32(0);
        for (uint256 i = 0; i < numBands; i++) {
            if (!FHE.isInitialized(encryptedBandPotential[decryptionContexts[requestId].batchId][i])) {
                revert("FHE: uninitialized ciphertext"); // Should be a custom error
            }
            totalEncryptedPotential = totalEncryptedPotential.add(encryptedBandPotential[decryptionContexts[requestId].batchId][i]);
        }
        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(totalEncryptedPotential);

        bytes32 currentHash = _hashCiphertexts(cts);
        if (currentHash != decryptionContexts[requestId].stateHash) {
            revert StateMismatch();
        }

        if (!FHE.checkSignatures(requestId, cleartexts, proof)) {
            revert InvalidProof();
        }

        uint256 totalPotential = uint256(uint32(bytes4(cleartexts)));
        uint256 batchId = decryptionContexts[requestId].batchId;
        uint256 totalRevenue = totalPromotionBudget[batchId] * 10; // Example: revenue is 10x promotion budget
        uint256 totalProfit = totalRevenue - totalVenueCost[batchId];

        decryptionContexts[requestId].processed = true;
        emit DecryptionCompleted(requestId, batchId, totalPotential);
        emit FestivalEvaluated(batchId, totalPotential, totalRevenue, totalProfit);
    }

    function _hashCiphertexts(bytes32[] memory cts) internal pure returns (bytes32) {
        return keccak256(abi.encode(cts, address(this)));
    }

    function _initIfNeeded() internal {
        if (!FHE.isInitialized(FHE.asEuint32(0))) {
            // Initialize FHE library if not already done (e.g. by constructor)
            // This is a placeholder; actual FHE init might be more complex or handled by the library.
            // For Zama's FHE.sol, this check is on an actual ciphertext.
            // If FHE.asEuint32(0) is not initialized, it implies the library setup is incomplete.
            // In a real scenario, this might involve deploying specific FHE program contracts or parameters.
            // For this example, we assume the library handles its own global state or this check is sufficient.
        }
    }

    function _requireInitialized(euint32 value) internal view {
        if (!FHE.isInitialized(value)) {
            revert("FHE: uninitialized ciphertext"); // Should be a custom error
        }
    }
}