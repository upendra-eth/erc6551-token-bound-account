// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "./contracts/token/ERC721/IERC721.sol";
import "./contracts/token/ERC20/IERC20.sol";
import "./contracts/token/ERC1155/IERC1155.sol";
import "./contracts/interfaces/IERC1271.sol";
import "./contracts/utils/cryptography/SignatureChecker.sol";

import "./contracts/utils/introspection/IERC165.sol";
import "./contracts/token/ERC1155/IERC1155Receiver.sol";

import "./CrossChainExecutorList.sol";
import "./MinimalReceiver.sol";
import "./interfaces/IAccount.sol";
import "./lib/MinimalProxyStore.sol";

/**
 * @title A smart contract wallet owned by a single ERC721 token
 * @author Jayden Windle (jaydenwindle)
 */
contract Account is IERC165, IERC1271, IAccount, MinimalReceiver {
    error NotAuthorized();
    error AccountLocked();
    error ExceedsMaxLockTime();

    CrossChainExecutorList public immutable crossChainExecutorList;

    /**
     * @dev Timestamp at which Account will unlock
     */
    uint256 public unlockTimestamp;

    /**
     * @dev Mapping from owner address to executor address
     */
    mapping(address => address) public executor;

    /**
     * @dev Emitted whenever the lock status of a account is updated
     */
    event LockUpdated(uint256 timestamp);

    // Event emitted when an NFT is transferred
    event NFTTransferred(address from, address to, uint256 tokenId);

    // Event emitted when an ERC2O Token is transferred
    event ERC2OTokenTransferred(address from, address to, uint256 tokenId);

    // Event emitted when spender is approved
    event ERC20Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );

    /**
     * @dev Emitted when `owner` enables `approved` to manage the `tokenId` token.
     */
    event ERC721Approval(
        address indexed owner,
        address indexed approved,
        uint256 indexed tokenId
    );

    // Event emitted when ERC1155 tokens are transferred
    event BatchErc1155TokensTransferred(
        address from,
        address to,
        uint256[] tokenIds,
        uint256[] amounts
    );

    /**
     * @dev Emitted when `account` grants or revokes permission to `operator` to transfer their tokens, according to
     * `approved`.
     */
    event ApprovalForAll(
        address indexed account,
        address indexed operator,
        bool approved
    );

    // Event emitted when an ERC1155 token is transferred
    event ERC1155TokenTransferred(
        address from,
        address to,
        uint256 tokenId,
        uint256 amount
    );

    /**
     * @dev Emitted whenever the executor for a account is updated
     */
    event ExecutorUpdated(address owner, address executor);

    constructor(address _crossChainExecutorList) {
        crossChainExecutorList = CrossChainExecutorList(
            _crossChainExecutorList
        );
    }

    /**
     * @dev Ensures execution can only continue if the account is not locked
     */
    modifier onlyUnlocked() {
        if (unlockTimestamp > block.timestamp) revert AccountLocked();
        _;
    }

    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    /**
     * @dev Throws if the sender is not the owner.
     */
    function _checkOwner() internal view virtual {
        address _owner = owner();
        if (msg.sender != _owner) revert NotAuthorized();
    }

    /**
     * @dev If account is unlocked and an executor is set, pass call to executor
     */
    fallback(
        bytes calldata data
    ) external payable onlyUnlocked returns (bytes memory result) {
        address _owner = owner();
        address _executor = executor[_owner];

        // accept funds if executor is undefined or cannot be called
        if (_executor.code.length == 0) return "";

        return _call(_executor, 0, data);
    }

    /**
     * @dev Executes a transaction from the Account. Must be called by an account owner.
     *
     * @param to      Destination address of the transaction
     * @param value   Ether value of the transaction
     * @param data    Encoded payload of the transaction
     */
    function executeCall(
        address to,
        uint256 value,
        bytes calldata data
    ) external payable onlyUnlocked returns (bytes memory result) {
        address _owner = owner();
        if (msg.sender != _owner) revert NotAuthorized();

        return _call(to, value, data);
    }

    // Transfer an ERC2O Token from this contract to another address
    function transferERC20Tokens(
        address tokenCollection,
        address to,
        uint256 amount
    ) external onlyUnlocked onlyOwner {
        // Get the instance of the IERC20 contract
        IERC20 erc20Contract = IERC20(tokenCollection);

        // Check if the owner have required amount of tokens
        require(
            erc20Contract.balanceOf(address(this)) >= amount,
            "Owner dont have sufficient amount of ERC20 tokens"
        );

        // Transfer the tokens to the specified address
        erc20Contract.transfer(to, amount);

        // Emit the ERC2OTokenTransferred event
        emit ERC2OTokenTransferred(address(this), to, amount);
    }

    // TODO : remove me if not needed
    // Transfer an ERC2O Token to another address (if this wallet address have approval)
    function transferFromERC20Tokens(
        address tokenCollection,
        address from,
        address to,
        uint256 amount
    ) external onlyUnlocked onlyOwner {
        // Get the instance of the IERC20 contract
        IERC20 erc20Contract = IERC20(tokenCollection);

        // Check if the owner have required amount of tokens
        require(
            erc20Contract.balanceOf(from) >= amount,
            "Owner dont have sufficient amount of ERC20 tokens"
        );

        // Transfer the tokens to the specified address
        erc20Contract.transferFrom(from, to, amount);

        // Emit the ERC2OTokenTransferred event
        emit ERC2OTokenTransferred(from, to, amount);
    }

    // TODO : remove me if not needed
    // Approve another address as spender of my ERC2O Token
    function ApproveERC20Tokens(
        address tokenCollection,
        address spender,
        uint256 amount
    ) external onlyUnlocked onlyOwner {
        // Get the instance of the IERC20 contract
        IERC20 erc20Contract = IERC20(tokenCollection);

        // Check if the owner have required amount of tokens
        require(
            erc20Contract.balanceOf(address(this)) >= amount,
            "Owner dont have sufficient amount of ERC20 tokens"
        );

        // Transfer the tokens to the specified address
        erc20Contract.approve(spender, amount);

        // Emit the Approve event
        emit ERC20Approval(address(this), spender, amount);
    }

    // Transfer an NFT from this contract to another address
    function transferERC721Tokens(
        address tokenCollection,
        address to,
        uint256 tokenId
    ) external onlyUnlocked onlyOwner {
        // Get the instance of the ERC721 contract
        IERC721 nftContract = IERC721(tokenCollection);

        // Check if the sender is the current owner of the NFT
        require(
            nftContract.ownerOf(tokenId) == address(this),
            "NFTHandler: Sender is not the owner"
        );

        // Transfer the NFT to the specified address
        nftContract.safeTransferFrom(address(this), to, tokenId);

        // Emit the NFTTransferred event
        emit NFTTransferred(address(this), to, tokenId);
    }

    // Approve spender for your nft
    function ApproveERC721Tokens(
        address tokenCollection,
        address spender,
        uint256 tokenId
    ) external onlyUnlocked onlyOwner {
        // Get the instance of the ERC721 contract
        IERC721 nftContract = IERC721(tokenCollection);

        // Check if the sender is the current owner of the NFT
        require(
            nftContract.ownerOf(tokenId) == address(this),
            "NFTHandler: Sender is not the owner"
        );

        // Transfer the NFT to the specified address
        nftContract.approve(spender, tokenId);

        // Emit the ERC721Approval event
        emit ERC721Approval(address(this), spender, tokenId);
    }

    // Transfer an NFT from on behalf ofowner to another address
    function transferERC721TokensFrom(
        address tokenCollection,
        address from,
        address to,
        uint256 tokenId
    ) external onlyUnlocked onlyOwner {
        // Get the instance of the ERC721 contract
        IERC721 nftContract = IERC721(tokenCollection);

        // Check if the sender is the current owner of the NFT
        require(
            nftContract.getApproved(tokenId) == address(this),
            "NFTHandler: Sender is not approved"
        );

        // Transfer the NFT to the specified address
        nftContract.safeTransferFrom(from, to, tokenId);

        // Emit the NFTTransferred event
        emit NFTTransferred(from, to, tokenId);
    }

    // Transfer ERC1155 tokens from this contract to another address
    function transferERC1155Tokens(
        address tokenCollection,
        address to,
        uint256 tokenId,
        uint256 amount
    ) external onlyUnlocked onlyOwner {
        // Get the instance of the ERC1155 contract
        IERC1155 erc1155Contract = IERC1155(tokenCollection);

        // Check if the sender has enough tokens to transfer
        require(
            erc1155Contract.balanceOf(address(this), tokenId) >= amount,
            "ERC1155Handler: Insufficient balance"
        );

        // Transfer the tokens to the specified address
        erc1155Contract.safeTransferFrom(
            address(this),
            to,
            tokenId,
            amount,
            ""
        );

        // Emit the ERC1155TokenTransferred event
        emit ERC1155TokenTransferred(address(this), to, tokenId, amount);
    }

    /**
     * @dev Grants or revokes permission to `operator` to transfer the caller's tokens, according to `approved`,
     *
     * Emits an {ApprovalForAll} event.
     *
     * Requirements:
     *
     * - `operator` cannot be the caller.
     */
    function setApprovalForAllERC1155(
        address tokenCollection,
        address operator,
        bool approved
    ) external onlyUnlocked onlyOwner {
        // Get the instance of the ERC1155 contract
        IERC1155 erc1155Contract = IERC1155(tokenCollection);

        // Check if the operator is nit owner
        require(
            operator == address(this),
            "NFTHandler: operator should not be owner"
        );
        // Transfer the tokens to the specified address
        erc1155Contract.setApprovalForAll(operator, approved);

        // Emit the ApprovalForAll event
        emit ApprovalForAll(address(this), operator, approved);
    }

    // Transfer ERC1155 tokens from this contract to another address
    function batchTransferERC1155Tokens(
        address tokenCollection,
        address to,
        uint256[] memory tokenIds,
        uint256[] memory amounts
    ) external onlyUnlocked onlyOwner {
        require(
            tokenIds.length == amounts.length,
            "ERC1155Handler: Invalid input length"
        );

        // Get the instance of the ERC1155 contract
        IERC1155 erc1155Contract = IERC1155(tokenCollection);

        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(
                erc1155Contract.balanceOf(address(this), tokenIds[i]) >=
                    amounts[i],
                "ERC1155Handler: Insufficient balance"
            );
        }

        // Batch transfer the tokens to the specified address
        erc1155Contract.safeBatchTransferFrom(
            address(this),
            to,
            tokenIds,
            amounts,
            ""
        );

        // Emit the TokensTransferred event
        emit BatchErc1155TokensTransferred(
            address(this),
            to,
            tokenIds,
            amounts
        );
    }

    /**
     * @dev Executes a transaction from the Account. Must be called by an authorized executor.
     *
     * @param to      Destination address of the transaction
     * @param value   Ether value of the transaction
     * @param data    Encoded payload of the transaction
     */
    function executeTrustedCall(
        address to,
        uint256 value,
        bytes calldata data
    ) external payable onlyUnlocked returns (bytes memory result) {
        address _executor = executor[owner()];
        if (msg.sender != _executor) revert NotAuthorized();

        return _call(to, value, data);
    }

    // TODO - remove if not needed

    /**
     * @dev Executes a transaction from the Account. Must be called by a trusted cross-chain executor.
     * Can only be called if account is owned by a token on another chain.
     *
     * @param to      Destination address of the transaction
     * @param value   Ether value of the transaction
     * @param data    Encoded payload of the transaction
     */
    function executeCrossChainCall(
        address to,
        uint256 value,
        bytes calldata data
    ) external payable onlyUnlocked returns (bytes memory result) {
        (uint256 chainId, , ) = context();

        if (chainId == block.chainid) {
            revert NotAuthorized();
        }

        if (!crossChainExecutorList.isCrossChainExecutor(chainId, msg.sender)) {
            revert NotAuthorized();
        }

        return _call(to, value, data);
    }

    /**
     * @dev Sets executor address for Account, allowing owner to use a custom implementation if they choose to.
     * When the token controlling the account is transferred, the implementation address will reset
     *
     * @param _executionModule the address of the execution module
     */
    function setExecutor(address _executionModule) external onlyUnlocked {
        address _owner = owner();
        if (_owner != msg.sender) revert NotAuthorized();

        executor[_owner] = _executionModule;

        emit ExecutorUpdated(_owner, _executionModule);
    }

    // TODO : in review
    /**
     * @dev Locks Account, preventing transactions from being executed until a certain time
     *
     * @param _unlockTimestamp timestamp when the account will become unlocked
     */
    function lock(uint256 _unlockTimestamp) external onlyUnlocked {
        if (_unlockTimestamp > block.timestamp + 365 days)
            revert ExceedsMaxLockTime();

        address _owner = owner();
        if (_owner != msg.sender) revert NotAuthorized();

        unlockTimestamp = _unlockTimestamp;

        emit LockUpdated(_unlockTimestamp);
    }

    /**
     * @dev Returns Account lock status
     *
     * @return true if Account is locked, false otherwise
     */
    function isLocked() external view returns (bool) {
        return unlockTimestamp > block.timestamp;
    }

    /**
     * @dev Returns true if caller is authorized to execute actions on this account
     *
     * @param caller the address to query authorization for
     * @return true if caller is authorized, false otherwise
     */
    function isAuthorized(address caller) external view returns (bool) {
        (uint256 chainId, address tokenCollection, uint256 tokenId) = context();

        if (chainId != block.chainid) {
            return crossChainExecutorList.isCrossChainExecutor(chainId, caller);
        }

        address _owner = IERC721(tokenCollection).ownerOf(tokenId);
        if (caller == _owner) return true;

        address _executor = executor[_owner];
        if (caller == _executor) return true;

        return false;
    }

    // TODO : remove me if not needed

    /**
     * @dev Implements EIP-1271 signature validation
     *
     * @param hash      Hash of the signed data
     * @param signature Signature to validate
     */
    function isValidSignature(
        bytes32 hash,
        bytes memory signature
    ) external view returns (bytes4 magicValue) {
        // If account is locked, disable signing
        if (unlockTimestamp > block.timestamp) return "";

        // If account has an executor, check if executor signature is valid
        address _owner = owner();
        address _executor = executor[_owner];

        if (
            _executor != address(0) &&
            SignatureChecker.isValidSignatureNow(_executor, hash, signature)
        ) {
            return IERC1271.isValidSignature.selector;
        }

        // Default - check if signature is valid for account owner
        if (SignatureChecker.isValidSignatureNow(_owner, hash, signature)) {
            return IERC1271.isValidSignature.selector;
        }

        return "";
    }

    /**
     * @dev Implements EIP-165 standard interface detection
     *
     * @param interfaceId the interfaceId to check support for
     * @return true if the interface is supported, false otherwise
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(IERC165, ERC1155Receiver) returns (bool) {
        // default interface support
        if (
            interfaceId == type(IAccount).interfaceId ||
            interfaceId == type(IERC1155Receiver).interfaceId ||
            interfaceId == type(IERC165).interfaceId
        ) {
            return true;
        }

        address _executor = executor[owner()];

        if (_executor == address(0) || _executor.code.length == 0) {
            return false;
        }

        // if interface is not supported by default, check executor
        try IERC165(_executor).supportsInterface(interfaceId) returns (
            bool _supportsInterface
        ) {
            return _supportsInterface;
        } catch {
            return false;
        }
    }

    /**
     * @dev Returns the owner of the token that controls this Account (public for Ownable compatibility)
     *
     * @return the address of the Account owner
     */
    function owner() public view returns (address) {
        (uint256 chainId, address tokenCollection, uint256 tokenId) = context();

        if (chainId != block.chainid) {
            return address(0);
        }

        return IERC721(tokenCollection).ownerOf(tokenId);
    }

    /**
     * @dev Returns information about the token that owns this account
     *
     * @return tokenCollection the contract address of the  ERC721 token which owns this account
     * @return tokenId the tokenId of the  ERC721 token which owns this account
     */
    function token()
        public
        view
        returns (address tokenCollection, uint256 tokenId)
    {
        (, tokenCollection, tokenId) = context();
    }

    function context() internal view returns (uint256, address, uint256) {
        bytes memory rawContext = MinimalProxyStore.getContext(address(this));
        if (rawContext.length == 0) return (0, address(0), 0);

        return abi.decode(rawContext, (uint256, address, uint256));
    }

    /**
     * @dev Executes a low-level call
     */
    function _call(
        address to,
        uint256 value,
        bytes calldata data
    ) internal returns (bytes memory result) {
        bool success;
        (success, result) = to.call{value: value}(data);

        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }
}
