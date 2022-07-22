// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";

uint256 constant NFT_ITEMS_NUM = 20;
uint256 constant NFT_MINIMUM_QUORUM = 14;  // Ceil of QUORUM * 2 / 3

enum NftType {
    GOLD, SILVER, BRONZE
}

contract NFT is ERC1155 {
    constructor () ERC1155("") {
        _mint(msg.sender, uint256(NftType.GOLD), NFT_ITEMS_NUM, "");
        _mint(msg.sender, uint256(NftType.SILVER), NFT_ITEMS_NUM, "");
        _mint(msg.sender, uint256(NftType.BRONZE), NFT_ITEMS_NUM, "");
    }
}

contract DAO is ReentrancyGuard, ERC1155Holder {
    address public owner;
    mapping(NftType => uint256) public treasuries;  // nft type => treasury
    mapping(uint256 => Proposal) public proposals;  // proposal id => proposal
    mapping(address => mapping(NftType => uint8)) public stakedTokens;  // user => token type => staked amount
    mapping(address => uint256) public stakingDeadlines;  // user => deadline
    mapping(address => mapping (uint256 => bool)) public votedUsers;  // user id => voting id => is voted

    event ProposalSucceeded();
    event ProposalRejected();

    uint256 public proposalsNum;
    uint256 public debatingPeriod;
    IERC1155 public nft;

    struct Proposal {
        uint256 proposalId;
        NftType nftType;
        uint256 deadline;
        address payable userToWithdraw;  
        uint8 votesFor;
        uint8 votesAgainst;  
        bool finished;  // Struct packing optimization. 20 + 1 * 3 bytes will use one EVM slot
        string description;
    }

    enum VoteType {
        For, Against
    }

    function donate(NftType nftType) public payable {
        treasuries[nftType] += msg.value;
    }

    constructor(uint256 debatingPeriod_, address nftAddress) {
        owner = msg.sender;
        debatingPeriod = debatingPeriod_;
        nft = IERC1155(nftAddress);
    }

    function addProposal(NftType nftType, address payable userToWithdraw, string memory description) public {
        uint256 newProposalId = proposalsNum;
        uint256 proposalDeadline = block.timestamp + debatingPeriod;
        proposals[newProposalId] = Proposal(newProposalId, nftType, proposalDeadline, userToWithdraw, 0, 0, false, description);
        proposalsNum++;
        stakingDeadlines[msg.sender] = proposalDeadline;
    }

    function stakeNFT(NftType tokenType, uint8 amount) public {
        nft.safeTransferFrom(msg.sender, address(this), uint256(tokenType), uint256(amount), "");
        stakedTokens[msg.sender][tokenType] += amount;
    }

    function unstakeNFT(NftType tokenType, uint8 amount) public {
        require(stakingDeadlines[msg.sender] <= block.timestamp, "It's too early");
        nft.safeTransferFrom(address(this), msg.sender, uint256(tokenType), uint256(amount), "");
        
        stakedTokens[msg.sender][tokenType] += amount;
    }

    function vote(uint256 proposalId, VoteType votingType) public {
        Proposal memory proposal = proposals[proposalId];
        require(!proposal.finished, "Proposal is finished");
        require(proposal.deadline > block.timestamp, "Proposal reached deadline");
        require(!votedUsers[msg.sender][proposalId], "Already voted!");

        votedUsers[msg.sender][proposalId] = true;

        uint8 votingPower = stakedTokens[msg.sender][proposal.nftType]; // Ok because we have no more than 20 tokens
        
        if (votingType == VoteType.For) {
            proposals[proposalId].votesFor += votingPower;
        } else {
            proposals[proposalId].votesAgainst += votingPower;
        }
    }

    function finishProposal(uint256 proposalId) public nonReentrant {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.deadline <= block.timestamp, "It's too early");
        require(!proposal.finished, "Proposal is finished");

        proposal.finished = true;

        if (proposal.votesFor > NFT_MINIMUM_QUORUM) {
            uint256 amountToTransfer = treasuries[proposal.nftType];  // State is mutated before transfer to avoid reentrancy tho function is already protected by nonReentrant modifier
            treasuries[proposal.nftType] = 0;
            proposal.userToWithdraw.transfer(amountToTransfer);
            emit ProposalSucceeded();
        } else {
            emit ProposalRejected();
        }
    }
}

