const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

const { expect } = require("chai");

describe("TokenBoundAccountTests", function () {

  let accountContract;
  let accountRegistryContract;
  let erc721Contract;
  let owner;
  let signer1;
  let signer2;
  let otherAccount;
  let tokenId;

  beforeEach(async () => {
    [owner, signer1, signer2, otherAccount] = await ethers.getSigners();
    tokenId = 1;

    const AccountContract = await ethers.getContractFactory("Account");
    accountContract = await AccountContract.deploy(signer1.address);
    await accountContract.waitForDeployment();

    const AccountRegistryContract = await ethers.getContractFactory("AccountRegistry");
    accountRegistryContract = await AccountRegistryContract.deploy(accountContract);

    const ERC721Contract = await ethers.getContractFactory("MYERC721");
    erc721Contract = await ERC721Contract.deploy();
  });

  describe("Deployment", function () {
    it("should deploy all contracts", async function () {
      console.log("Owner address:", owner.address);
      // console.log("Account contract address:", accountContract);
      // console.log("Account registry contract address:", accountRegistryContract);
      // console.log("NFT registry contract address:", erc721Contract);
      expect(await erc721Contract.name()).to.equal("MyToken");
    });

    it("should set the correct name and symbol", async function () {
      expect(await erc721Contract.name()).to.equal("MyToken");
      expect(await erc721Contract.symbol()).to.equal("MTK");
    });
  });


  describe("Cheking functionality of MYERC721 (ownable) ", function () {
    it("should mint NFT with the correct owner", async function () {
      await expect(erc721Contract.safeMint(signer1.address, tokenId)).not.to.be.reverted;
      expect(await erc721Contract.owner()).to.equal(owner.address);
      expect(await erc721Contract.ownerOf(tokenId)).to.equal(signer1.address);
    });

    it("should only allow the contract owner to mint NFTs", async function () {
      await expect(erc721Contract.connect(signer1).safeMint(signer1.address,tokenId)).to.be.revertedWith(
        "Ownable: caller is not the owner");
    });

    it("should transfer ownership of the NFT", async function () {
      await erc721Contract.connect(owner).safeMint(signer1.address, tokenId);
      await erc721Contract.connect(signer1).transferFrom(signer1.address, signer2.address, tokenId);
      expect(await erc721Contract.ownerOf(tokenId)).to.equal(signer2.address);
    });

    it("should only allow the token owner or approved address to transfer the NFT", async function () {
      await erc721Contract.connect(owner).safeMint(signer1.address, tokenId);
      await expect(erc721Contract.connect(signer2).transferFrom(signer1.address, signer2.address, tokenId)).to.be.revertedWith(
        "ERC721: caller is not token owner or approved"
      );
    });

    it("should approve another address to manage the NFT", async function () {
      await erc721Contract.connect(owner).safeMint(signer1.address, tokenId);
      await erc721Contract.connect(signer1).approve(signer2.address, tokenId);
      expect(await erc721Contract.getApproved(tokenId)).to.equal(signer2.address);
    });

    it("should allow the approved address to transfer the NFT", async function () {
      await erc721Contract.connect(owner).safeMint(signer1.address, tokenId);
      await erc721Contract.connect(signer1).approve(signer2.address, tokenId);
      await erc721Contract.connect(signer2).transferFrom(signer1.address, signer2.address, tokenId);
      expect(await erc721Contract.ownerOf(tokenId)).to.equal(signer2.address);
    });

  });

  describe("Create account", function () {
    it("should Create smart wallet account", async function () {

      await expect(erc721Contract.safeMint(signer1.address, tokenId)).not.to.be.reverted;
      expect(await erc721Contract.ownerOf(tokenId)).to.equal(signer1.address);
      await expect(accountRegistryContract.createAccount(erc721Contract, tokenId)).not.to.be.reverted;

    });

    it("check smart wallet account owner ", async function () {

      await expect(erc721Contract.safeMint(signer1.address, tokenId)).not.to.be.reverted;
      expect(await erc721Contract.ownerOf(tokenId)).to.equal(signer1.address);
      await (accountRegistryContract.createAccount(erc721Contract, tokenId));
      const accountAddress = await (accountRegistryContract.account(erc721Contract, tokenId));

      const AccountContract = await ethers.getContractFactory("Account");
      const myContract = await AccountContract.attach(accountAddress);
      expect(await myContract.owner()).to.equal(signer1.address);

    });

    it("transfer nft to token bound account (nft-id tokenId) ", async function () {

      await expect(erc721Contract.safeMint(signer1.address, tokenId)).not.to.be.reverted;
      await expect(erc721Contract.safeMint(signer2.address, 2)).not.to.be.reverted;
      expect(await erc721Contract.ownerOf(tokenId)).to.equal(signer1.address);
      await (accountRegistryContract.createAccount(erc721Contract, tokenId));
      const accountAddress = await (accountRegistryContract.account(erc721Contract, tokenId));

      await expect(erc721Contract.connect(signer2).transferFrom(signer2.address, accountAddress, 2)).not.to.be.reverted;
      expect(await erc721Contract.ownerOf(2)).to.equal(accountAddress);

    });

    it("transfer nft from  token bound account(nft-id tokenId) to EOA address ", async function () {

      await expect(erc721Contract.safeMint(signer1.address, tokenId)).not.to.be.reverted;
      await expect(erc721Contract.safeMint(signer2.address, 2)).not.to.be.reverted;
      expect(await erc721Contract.ownerOf(tokenId)).to.equal(signer1.address);
      await (accountRegistryContract.createAccount(erc721Contract, tokenId));
      const accountAddress = await (accountRegistryContract.account(erc721Contract, tokenId));

      await expect(erc721Contract.connect(signer2).transferFrom(signer2.address, accountAddress, 2)).not.to.be.reverted;
      expect(await erc721Contract.ownerOf(2)).to.equal(accountAddress);
      const AccountContract = await ethers.getContractFactory("Account");
      const myContract = await AccountContract.attach(accountAddress);
      expect(await myContract.owner()).to.equal(signer1.address);
      await expect(myContract.connect(signer1).transferERC721Tokens(erc721Contract, otherAccount.address, 2)).not.to.be.reverted;
      expect(await erc721Contract.ownerOf(2)).to.equal(otherAccount.address);

    });
  });

});



