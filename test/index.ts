import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers, network } from "hardhat";
import { DAO, NFT } from "../typechain";

describe("Test NFT based DAO", function () {

  let nft: NFT;
  let dao: DAO;
  let owner: SignerWithAddress;
  let regularUser: SignerWithAddress;
  let userToWithdraw: SignerWithAddress;
  const firstProposalId = 0;
  const initialNftItemSupply = 20;
  const proposalPeriod = 60;

  enum NftType {
    GOLD = 0,
    SILVER = 1,
    BRONZE = 2
  };

  enum VoteType {
    FOR = 0,
    AGAINST = 1
  };

  this.beforeEach(async () => {
    const NFTContract = await ethers.getContractFactory("NFT");
    nft = await NFTContract.deploy();

    const DAOContract = await ethers.getContractFactory("DAO");
    dao = await DAOContract.deploy(proposalPeriod, nft.address);

    [owner, regularUser, userToWithdraw] = await ethers.getSigners();
  })

  it("Test NFT staking", async function () {
    const sumToStake = 10;
    await nft.setApprovalForAll(dao.address, true);
    await dao.stakeNFT(NftType.GOLD, sumToStake);
    await nft.setApprovalForAll(dao.address, false);
    expect(await nft.balanceOf(owner.address, NftType.GOLD)).to.equal(BigNumber.from(initialNftItemSupply - sumToStake));
  });

  it("Test treasury top up", async function () {
    const sumToDonate = BigNumber.from(10_000);
    const initialUserBalance = await owner.getBalance();
    await dao.donate(NftType.GOLD, {value: sumToDonate});
    expect(await owner.getBalance()).to.lte(initialUserBalance.sub(sumToDonate));
  });

  it("Test that user can't finish proposal until deadline", async function () {
    await dao.connect(regularUser).addProposal(NftType.GOLD, userToWithdraw.address, "To a nice user");
    await expect(dao.finishProposal(firstProposalId)).to.be.revertedWith("It's too early");
  });

  it("Test proposal rejecting if required quorum is not reached", async function () {
    await dao.connect(regularUser).addProposal(NftType.GOLD, userToWithdraw.address, "To a nice user");

    const sumToStake = 5;

    await nft.setApprovalForAll(dao.address, true);
    await dao.stakeNFT(NftType.GOLD, sumToStake);
    await nft.setApprovalForAll(dao.address, false);
    await dao.vote(firstProposalId, VoteType.FOR);

    await network.provider.send("evm_increaseTime", [proposalPeriod+1]);
    
    const finishTransaction = await dao.finishProposal(firstProposalId);
    const rc = await finishTransaction.wait();
    expect(rc.events?.findIndex(x => x.event == 'ProposalRejected')).to.not.equal(-1);
  });

  it("Test proposal execution if required quorum is reached", async function () {
    await dao.connect(regularUser).addProposal(NftType.GOLD, userToWithdraw.address, "To a nice user");

    const sumToStake = 15;
    const sumToDonate = BigNumber.from(10_000);

    await dao.donate(NftType.GOLD, {value: sumToDonate});

    await nft.setApprovalForAll(dao.address, true);
    await dao.stakeNFT(NftType.GOLD, sumToStake);
    await nft.setApprovalForAll(dao.address, false);
    await dao.vote(firstProposalId, VoteType.FOR);

    await network.provider.send("evm_increaseTime", [proposalPeriod+1]);
    
    const userToWithdrawInitialBalance = await userToWithdraw.getBalance();
    const finishTransaction = await dao.finishProposal(firstProposalId);
    const rc = await finishTransaction.wait();
    expect(rc.events?.findIndex(x => x.event == 'ProposalSucceeded')).to.not.equal(-1);
    expect((await userToWithdraw.getBalance()).eq(userToWithdrawInitialBalance.add(sumToDonate))).to.be.true;
  });

  it("Check that user can't vote second time", async function () {
    await dao.connect(regularUser).addProposal(NftType.GOLD, userToWithdraw.address, "To a nice user");

    const sumToStake = 5;

    await nft.setApprovalForAll(dao.address, true);
    await dao.stakeNFT(NftType.GOLD, sumToStake);
    await nft.setApprovalForAll(dao.address, false);
    await dao.vote(firstProposalId, VoteType.AGAINST);
    await expect(dao.vote(firstProposalId, VoteType.AGAINST)).to.be.revertedWith("Already voted!");
  });

  it("Test that stakeholder can't unstake nft if he has an active proposal", async () => {
    const sumToStake = 15;

    await dao.connect(regularUser).addProposal(NftType.GOLD, userToWithdraw.address, "To a nice user");

    await nft.setApprovalForAll(dao.address, true);
    await dao.stakeNFT(NftType.GOLD, sumToStake);

    await dao.vote(firstProposalId, VoteType.FOR);

    await nft.setApprovalForAll(dao.address, false);
    await expect(dao.unstakeNFT(NftType.GOLD, sumToStake)).to.be.revertedWith("It's too early");
  });

  it("Test that stakeholder can if otherwise", async () => {
    const sumToStake = 15;

    await nft.setApprovalForAll(dao.address, true);
    await dao.stakeNFT(NftType.GOLD, sumToStake);
    await nft.setApprovalForAll(dao.address, false);
    await dao.unstakeNFT(NftType.GOLD, sumToStake);

  });

  it("Check that user can't finish or revote a finished proposal", async () => {
    await dao.connect(regularUser).addProposal(NftType.GOLD, userToWithdraw.address, "To a nice user");

    const sumToStake = 5;

    await nft.setApprovalForAll(dao.address, true);
    await dao.stakeNFT(NftType.GOLD, sumToStake);
    await nft.setApprovalForAll(dao.address, false);
    await dao.vote(firstProposalId, VoteType.FOR);

    await network.provider.send("evm_increaseTime", [proposalPeriod+1]);
    
    await dao.finishProposal(firstProposalId);
    await expect(dao.finishProposal(firstProposalId)).to.be.revertedWith("Proposal is finished");
    await expect(dao.vote(firstProposalId, VoteType.FOR)).to.be.revertedWith("Proposal is finished");
  });

  it("Check that user can't vote on an expired proposal", async () => {
    await dao.connect(regularUser).addProposal(NftType.GOLD, userToWithdraw.address, "To a nice user");

    const sumToStake = 5;

    await nft.setApprovalForAll(dao.address, true);
    await dao.stakeNFT(NftType.GOLD, sumToStake);
    await nft.setApprovalForAll(dao.address, false);
    await dao.vote(firstProposalId, VoteType.FOR);

    await network.provider.send("evm_increaseTime", [proposalPeriod+1]);
    await expect(dao.vote(firstProposalId, VoteType.FOR)).to.be.revertedWith("Proposal reached deadline");
  });

  it("Check that user can't vote with no voting power", async () => {
    await dao.connect(regularUser).addProposal(NftType.GOLD, userToWithdraw.address, "To a nice user");
    await expect(dao.vote(firstProposalId, VoteType.FOR)).to.be.revertedWith("You have no voting power");
  });


});
