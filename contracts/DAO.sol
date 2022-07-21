// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

uint256 constant NFT_ITEMS_NUM = 20;
uint256 constant NFT_MINIMUM_QUORUM = 14;  // Ceil of QUORUM * 2 / 3

contract NFT is ERC1155 {
    uint256 public constant GOLD = 0;
    uint256 public constant SILVER = 1;
    uint256 public constant BRONZE = 2;

    constructor () ERC1155("") {
        _mint(msg.sender, GOLD, NFT_ITEMS_NUM, "");
        _mint(msg.sender, SILVER, NFT_ITEMS_NUM, "");
        _mint(msg.sender, BRONZE, NFT_ITEMS_NUM, "");
    }
}

contract DAO is ReentrancyGuard {
    address public owner;
    mapping(uint256 => uint256) public treasuries;  // nft type => treasury
    mapping(uint256 => Proposal) public proposals;  // proposal id => proposal
    mapping(address => mapping(uint8 => uint8)) public stakedTokens;  // user => token type => staked amount
    mapping(address => uint256) public stakingDeadlines;  // user => deadline

    uint256 public proposalsNum;
    uint256 public debatingPeriod;
    IERC1155 public nft;

    struct Proposal {
        uint256 proposalId;
        uint256 deadline;
        address payable userToWithdraw;  
        uint8 votesFor;
        uint8 votesAgainst;  
        uint8 nftType;
        bool finished;  // Struct packing optimization. 20 + 1 * 4 bytes will use one EVM slot
        string description;
    }

    enum VotingType {
        For, Against
    }

    function donate(uint256 nftTypeId) public payable {
        treasuries[nftTypeId] += msg.value;
    }

    constructor(uint256 debatingPeriod_, address nftAddress) {
        owner = msg.sender;
        debatingPeriod = debatingPeriod_;
        nft = IERC1155(nftAddress);
    }

    function addProposal(uint8 nftType, address payable userToWithdraw, string memory description) public {
        uint256 newProposalId = proposalsNum;
        uint256 proposalDeadline = block.timestamp + debatingPeriod;
        proposals[newProposalId] = Proposal(newProposalId, proposalDeadline, userToWithdraw, 0, 0, nftType, false, description);
        proposalsNum++;
        stakingDeadlines[msg.sender] = proposalDeadline;
    }

    function stakeNFT(uint8 tokenType, uint8 amount) public {
        nft.safeTransferFrom(msg.sender, address(this), uint256(tokenType), uint256(amount), "");
        stakedTokens[msg.sender][tokenType] += amount;
    }

    function unstakeNFT(uint8 tokenType, uint8 amount) public {
        require(stakingDeadlines[msg.sender] <= block.timestamp, "It's too early");
        nft.safeTransferFrom(msg.sender, address(this), uint256(tokenType), uint256(amount), "");
        
        stakedTokens[msg.sender][tokenType] += amount;
    }

    function vote(uint256 proposalId, VotingType votingType) public {
        Proposal memory proposal = proposals[proposalId];
        require(!proposal.finished, "Proposal is finished");
        require(proposal.deadline > block.timestamp, "Proposal reached deadline");

        uint8 votingPower = stakedTokens[msg.sender][proposal.nftType]; // Ok because we have no more than 20 tokens
        
        if (votingType == VotingType.For) {
            proposals[proposalId].votesFor += votingPower;
        } else {
            proposals[proposalId].votesAgainst += votingPower;
        }
    }

    function finishProposal(uint256 proposalId) public nonReentrant {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.deadline <= block.timestamp, "It's too early");
        proposal.finished = true;

        if (proposal.votesFor > NFT_MINIMUM_QUORUM) {
            uint256 amountToTransfer = treasuries[proposal.nftType];  // State is mutated before transfer to avoid reentrancy tho function is already protected by nonReentrant modifier
            treasuries[proposal.nftType] = 0;
            proposal.userToWithdraw.transfer(amountToTransfer);
        }
    }
}

