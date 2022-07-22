# NFT based DAO service

## Solution design 
- This project contains implementation of the ERC1155 NFT and the DAO. NFT is divided into three parts: gold, silver, bronze. Each of them has 20 items
- User can stake some amount of nft token of desired kind to get voting power to the corresponding treasury (Become a stakeholder)
- User can donate eth to any treasury of a specific token type
- User can create a proposal to withdraw funds from treasury to a desired user
- Stakeholders can vote for or against any proposals
- If 2/3 stakeholders voted for a proposal, funds will be withdrawed

## Notes
Proposal considered to be approved if 2/3 of all the voting power is used to vote for the proposal. 

## Tests
✔ Test NFT staking (83ms)
✔ Test treasury top up
✔ Test that user can't finish proposal until deadline (49ms)
✔ Test proposal rejecting if required quorum is not reached (101ms)
✔ Test proposal execution if required quorum is reached (107ms)
✔ Check that user can't vote second time (99ms)
✔ Test that stakeholder can't unstake nft if he has an active proposal (81ms)
✔ Test that stakeholder can if otherwise (60ms)
✔ Check that user can't finish or revote a finished proposal (105ms)
✔ Check that user can't vote on an expired proposal (79ms)
✔ Check that user can't vote with no voting power