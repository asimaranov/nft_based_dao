import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { assert } from "console";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { DAO, NFT } from "../typechain";

describe("Test NFT based DAO", function () {

  let nft: NFT;
  let dao: DAO;
  let owner: SignerWithAddress;
  let regularUser: SignerWithAddress;
  let userToWithdraw: SignerWithAddress;

  enum NftType {
    GOLD = 0,
    SILVER = 1,
    BRONZE = 2
  }

  enum VoteType {
    FOR = 0,
    AGAINST = 1
  }


  const initialNftItemSupply = 20;

  this.beforeEach(async () => {
    const NFTContract = await ethers.getContractFactory("NFT");
    nft = await NFTContract.deploy();

    const DAOContract = await ethers.getContractFactory("DAO");
    dao = await DAOContract.deploy(60, nft.address);

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

  it("Test proposal creating", async function () {
    await dao.connect(regularUser).addProposal(NftType.GOLD, userToWithdraw.address, "To a nice user");
  });

});
