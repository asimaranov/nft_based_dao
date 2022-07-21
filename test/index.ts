import { expect } from "chai";
import { ethers } from "hardhat";

describe("Test NFT based DAO", function () {
  it("Test DAO creation", async function () {
    const NFTContract = await ethers.getContractFactory("NFT");
    const nft = await NFTContract.deploy();

    const DAOContract = await ethers.getContractFactory("DAO");
    const dao = await DAOContract.deploy(60, nft.address);
  });
});
