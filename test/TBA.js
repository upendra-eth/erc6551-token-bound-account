const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

const { expect } = require("chai");

describe("TokenBoundAccountTests", function () {
  async function deployAccountRegistryNftContracts() {
    const [owner, signer1, signer2, otherAccount] = await ethers.getSigners();

    const AccountContract = await ethers.getContractFactory("Account");
    const accountContract = await AccountContract.deploy(signer1.address);
    await accountContract.waitForDeployment();

    const AccountRegistryContract = await ethers.getContractFactory("AccountRegistry");
    const accountRegistryContract = await AccountRegistryContract.deploy(accountContract);
    // await accountRegistryContract.deployed();

    const NFTRegistryContract = await ethers.getContractFactory("MYERC721");
    const nftRegistryContract = await NFTRegistryContract.deploy();
    // await nftRegistryContract.deployed();

    return { owner, signer1, signer2, otherAccount, accountContract, accountRegistryContract, nftRegistryContract };
  }

  // async function accountInstance() {
  //   // const [owner, signer1, signer2, otherAccount] = await ethers.getSigners();
  //   const AccountContract = await ethers.getContractFactory("Account");
  //   myContract = await AccountContract.attach('0xYourContractAddress');

  //   const AwccountContract = await ethers.getContractFactory("Account");
  //   const accountContract = await AccountContract.deploy(signer1.address);
  //   await accountContract.waitForDeployment();

  //   const AccountRegistryContract = await ethers.getContractFactory("AccountRegistry");
  //   const accountRegistryContract = await AccountRegistryContract.deploy(accountContract);
  //   // await accountRegistryContract.deployed();

  //   const NFTRegistryContract = await ethers.getContractFactory("MYERC721");
  //   const nftRegistryContract = await NFTRegistryContract.deploy();
  //   // await nftRegistryContract.deployed();

  //   return { owner, signer1, signer2, otherAccount, accountContract, accountRegistryContract, nftRegistryContract };
  // }

  describe("Deployment", function () {
    it("should deploy all contracts", async function () {
      const { owner, signer1, signer2, otherAccount, accountContract, accountRegistryContract, nftRegistryContract } = await deployAccountRegistryNftContracts();

      console.log("Owner address:", owner.address);
      console.log("Account contract address:", accountContract);
      console.log("Account registry contract address:", accountRegistryContract);
      console.log("NFT registry contract address:", nftRegistryContract);

      expect(await nftRegistryContract.name()).to.equal("MyToken");
    });
  });


  describe("Minting NFTs by contract owner address", function () {
    it("should Minting NFTs", async function () {
      const { owner, signer1, signer2, otherAccount, accountContract, accountRegistryContract, nftRegistryContract } = await deployAccountRegistryNftContracts();
      await expect(nftRegistryContract.safeMint(signer1.address, 1)).not.to.be.reverted;
      expect(await nftRegistryContract.owner()).to.equal(owner.address);
      expect(await nftRegistryContract.ownerOf(1)).to.equal(signer1.address);
    });
  });

  describe("Minting NFTs by non contract owner address", function () {
    it("should revart while Minting NFTs", async function () {
      const { owner, signer1, signer2, otherAccount, accountContract, accountRegistryContract, nftRegistryContract } = await deployAccountRegistryNftContracts();
      await expect(nftRegistryContract.connect(signer1).safeMint(signer1.address, 1)).to.be.revertedWith(
        "Ownable: caller is not the owner");
    });
  });

  describe("Create account", function () {
    it("should Create smart wallet account", async function () {
      const { owner, signer1, signer2, otherAccount, accountContract, accountRegistryContract, nftRegistryContract } = await deployAccountRegistryNftContracts();
      await expect(nftRegistryContract.safeMint(signer1.address, 1)).not.to.be.reverted;
      expect(await nftRegistryContract.ownerOf(1)).to.equal(signer1.address);
      await expect(accountRegistryContract.createAccount(nftRegistryContract,1)).not.to.be.reverted;
     
    });

    it("check smart wallet account owner ", async function () {
      const { owner, signer1, signer2, otherAccount, accountContract, accountRegistryContract, nftRegistryContract } = await deployAccountRegistryNftContracts();
      await expect(nftRegistryContract.safeMint(signer1.address, 1)).not.to.be.reverted;
      expect(await nftRegistryContract.ownerOf(1)).to.equal(signer1.address);
      await (accountRegistryContract.createAccount(nftRegistryContract, 1));
      const accountAddress = await (accountRegistryContract.account(nftRegistryContract, 1));

      const AccountContract = await ethers.getContractFactory("Account");
      const myContract = await AccountContract.attach(accountAddress);
      expect(await myContract.owner()).to.equal(signer1.address);

    });
  });

});



