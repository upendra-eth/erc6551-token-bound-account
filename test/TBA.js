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
    const ERC721Contract = await NFTRegistryContract.deploy();
    // await ERC721Contract.deployed();

    return { owner, signer1, signer2, otherAccount, accountContract, accountRegistryContract, ERC721Contract };
  }

  describe("Deployment", function () {
    it("should deploy all contracts", async function () {
      const { owner, signer1, signer2, otherAccount, accountContract, accountRegistryContract, ERC721Contract } = await deployAccountRegistryNftContracts();

      console.log("Owner address:", owner.address);
      console.log("Account contract address:", accountContract);
      console.log("Account registry contract address:", accountRegistryContract);
      console.log("NFT registry contract address:", ERC721Contract);

      expect(await ERC721Contract.name()).to.equal("MyToken");
    });
  });


  describe("Minting NFTs by contract owner address", function () {
    it("should Minting NFTs", async function () {
      const { owner, signer1, signer2, otherAccount, accountContract, accountRegistryContract, ERC721Contract } = await deployAccountRegistryNftContracts();
      await expect(ERC721Contract.safeMint(signer1.address, 1)).not.to.be.reverted;
      expect(await ERC721Contract.owner()).to.equal(owner.address);
      expect(await ERC721Contract.ownerOf(1)).to.equal(signer1.address);
    });
  });

  describe("Minting NFTs by non contract owner address", function () {
    it("should revart while Minting NFTs", async function () {
      const { owner, signer1, signer2, otherAccount, accountContract, accountRegistryContract, ERC721Contract } = await deployAccountRegistryNftContracts();
      await expect(ERC721Contract.connect(signer1).safeMint(signer1.address, 1)).to.be.revertedWith(
        "Ownable: caller is not the owner");
    });
  });

  describe("Create account", function () {
    it("should Create smart wallet account", async function () {
      const { owner, signer1, signer2, otherAccount, accountContract, accountRegistryContract, ERC721Contract } = await deployAccountRegistryNftContracts();
      await expect(ERC721Contract.safeMint(signer1.address, 1)).not.to.be.reverted;
      expect(await ERC721Contract.ownerOf(1)).to.equal(signer1.address);
      await expect(accountRegistryContract.createAccount(ERC721Contract, 1)).not.to.be.reverted;

    });

    it("check smart wallet account owner ", async function () {
      const { owner, signer1, signer2, otherAccount, accountContract, accountRegistryContract, ERC721Contract } = await deployAccountRegistryNftContracts();
      await expect(ERC721Contract.safeMint(signer1.address, 1)).not.to.be.reverted;
      expect(await ERC721Contract.ownerOf(1)).to.equal(signer1.address);
      await (accountRegistryContract.createAccount(ERC721Contract, 1));
      const accountAddress = await (accountRegistryContract.account(ERC721Contract, 1));

      const AccountContract = await ethers.getContractFactory("Account");
      const myContract = await AccountContract.attach(accountAddress);
      expect(await myContract.owner()).to.equal(signer1.address);

    });

    it("transfer nft to token bound account (nft-id 1) ", async function () {
      const { owner, signer1, signer2, otherAccount, accountContract, accountRegistryContract, ERC721Contract } = await deployAccountRegistryNftContracts();
      await expect(ERC721Contract.safeMint(signer1.address, 1)).not.to.be.reverted;
      await expect(ERC721Contract.safeMint(signer2.address, 2)).not.to.be.reverted;
      expect(await ERC721Contract.ownerOf(1)).to.equal(signer1.address);
      await (accountRegistryContract.createAccount(ERC721Contract, 1));
      const accountAddress = await (accountRegistryContract.account(ERC721Contract, 1));

      await expect(ERC721Contract.connect(signer2).transferFrom(signer2.address, accountAddress, 2)).not.to.be.reverted;
      expect(await ERC721Contract.ownerOf(2)).to.equal(accountAddress);

    });

    it("transfer nft from  token bound account(nft-id 1) to EOA address ", async function () {
      const { owner, signer1, signer2, otherAccount, accountContract, accountRegistryContract, ERC721Contract } = await deployAccountRegistryNftContracts();
      await expect(ERC721Contract.safeMint(signer1.address, 1)).not.to.be.reverted;
      await expect(ERC721Contract.safeMint(signer2.address, 2)).not.to.be.reverted;
      expect(await ERC721Contract.ownerOf(1)).to.equal(signer1.address);
      await (accountRegistryContract.createAccount(ERC721Contract, 1));
      const accountAddress = await (accountRegistryContract.account(ERC721Contract, 1));

      await expect(ERC721Contract.connect(signer2).transferFrom(signer2.address, accountAddress, 2)).not.to.be.reverted;
      expect(await ERC721Contract.ownerOf(2)).to.equal(accountAddress);
      const AccountContract = await ethers.getContractFactory("Account");
      const myContract = await AccountContract.attach(accountAddress);
      expect(await myContract.owner()).to.equal(signer1.address);
      await expect(myContract.connect(signer1).transferERC721Tokens(ERC721Contract, otherAccount.address, 2)).not.to.be.reverted;
      expect(await ERC721Contract.ownerOf(2)).to.equal(otherAccount.address);

    });
  });

});



